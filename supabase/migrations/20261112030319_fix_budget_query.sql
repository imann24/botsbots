SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.claim_turn (
  p_room         uuid,
  p_user         uuid,
  p_run          uuid,
  p_prices       jsonb,
  p_daily_budget numeric
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare r public.rooms; b jsonb; m public.messages; n int; pending int; spent numeric; quote numeric; daily numeric; why text; eligible boolean:=false;
begin
 -- Lock the account before the room everywhere to avoid deadlocks and cross-room budget races.
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select * into r from public.rooms where id=p_room and user_id=p_user for update;
 if not found then raise exception 'Room not found'; end if;
 if r.status<>'running' or r.run_id is distinct from p_run then return null; end if;
 update public.messages set status='failed',error='Reply timed out. Reserved budget retained.',completed_at=now()
 where room_id=p_room and status='pending' and created_at<now()-interval '120 seconds';
 if exists(select 1 from public.messages where room_id=p_room and run_id=p_run and status='failed') then why:='A model failed. Review the reply, then resume when ready.'; end if;
 select count(*),count(*) filter(where status='pending'),coalesce(sum(coalesce(cost,reserved_cost)),0) into n,pending,spent from public.messages where room_id=p_room;
 if n >= (r.settings->>'maxMessages')::int then why:='Room message limit reached.'; end if;
 if now()>r.run_started_at+make_interval(mins=>(r.settings->>'maxMinutes')::int) then why:='Session time limit reached.'; end if;
 if why is not null then
  update public.rooms set status='limited',reason=why,updated_at=now() where id=p_room; return null;
 end if;
 if pending >= (case when r.settings->>'mode'='moderated' then 1 else (r.settings->>'concurrency')::int end) then return null; end if;
 select coalesce(sum(coalesce(msg.cost,msg.reserved_cost)),0) into daily from public.messages msg join public.rooms x on x.id=msg.room_id where x.user_id=p_user and msg.created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 -- Fewest attempts first gives every bot a chance in free-for-all mode.
 for b in select value from jsonb_array_elements(r.bots) with ordinality a(value,ord)
 order by (select count(*) from public.messages where room_id=p_room and bot_id=(value->>'id')::uuid),ord loop
  if (select count(*) from public.messages where room_id=p_room and bot_id=(b->>'id')::uuid)>=(r.settings->>'maxPerBot')::int then continue; end if;
  if r.settings->>'mode'='moderated' and exists(select 1 from public.messages where room_id=p_room and bot_id=(b->>'id')::uuid and run_id=p_run) then continue; end if;
  eligible:=true;
  if exists(select 1 from public.messages where room_id=p_room and bot_id=(b->>'id')::uuid and (status='pending' or completed_at>now()-make_interval(secs=>(r.settings->>'cooldownSeconds')::int))) then continue; end if;
  quote:=(p_prices->>(b->>'model'))::numeric;
  if quote is null or quote<=0 then raise exception 'Current model pricing is unavailable'; end if;
  if spent+quote>(r.settings->>'budget')::numeric then why:='Budget limit: not enough left to reserve another reply.'; continue; end if;
  if daily+quote>p_daily_budget then why:='Daily account budget reached.'; continue; end if;
  insert into public.messages(room_id,bot_id,speaker,model,status,run_id,reserved_cost)
  values(p_room,(b->>'id')::uuid,b->>'name',b->>'model','pending',p_run,quote) returning * into m;
  return to_jsonb(m);
 end loop;
 if pending=0 then
  if not eligible then
   if exists(select 1 from jsonb_array_elements(r.bots) a where (select count(*) from public.messages where room_id=p_room and bot_id=(a->>'id')::uuid)<(r.settings->>'maxPerBot')::int) then
    update public.rooms set status='paused',reason='Round complete. Add your perspective or start the next round.',updated_at=now() where id=p_room;
   else update public.rooms set status='limited',reason='Every bot has reached its reply limit.',updated_at=now() where id=p_room; end if;
  elsif why is not null then update public.rooms set status='limited',reason=why,updated_at=now() where id=p_room;
  end if;
 end if;
 return null;
end $function$;

