SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.room_action (
  p_room    uuid,
  p_user    uuid,
  p_action  text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare r public.rooms; n integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select * into r from public.rooms where id=p_room and user_id=p_user for update;
 if not found then raise exception 'Room not found'; end if;
 -- Lost requests keep their reservation charged; never silently retry a potentially billed call.
 update public.messages set status='failed',error='Reply timed out. Its reserved budget is retained.',completed_at=now()
 where room_id=p_room and status='pending' and created_at<now()-interval '120 seconds';
 if p_action='start' then
   if r.status='running' then return to_jsonb(r); end if;
   if r.status='stopped' then raise exception 'This room has ended. Create a new room to continue.'; end if;
   if exists(select 1 from public.messages where room_id=p_room and status='pending') then raise exception 'Wait for current replies to finish.'; end if;
   if exists(select 1 from public.rooms where user_id=p_user and id<>p_room and status='running' and run_started_at>now()-interval '30 minutes') then raise exception 'Pause your other running room first.'; end if;
   update public.rooms set status='running',reason=null,run_id=gen_random_uuid(),run_started_at=now(),updated_at=now() where id=p_room returning * into r;
 elsif p_action in ('pause','stop') then
   update public.rooms set status=case when p_action='stop' then 'stopped' else 'paused' end,
    reason=case when p_action='stop' then 'Room ended. In-flight replies may still finish.' else 'Paused. In-flight replies may still finish.' end,updated_at=now() where id=p_room returning * into r;
 elsif p_action='message' then
   if r.status='stopped' then raise exception 'This room has ended.'; end if;
   if exists(select 1 from public.messages where room_id=p_room and request_id=(p_payload->>'requestId')::uuid) then return to_jsonb(r); end if;
   select count(*) into n from public.messages where room_id=p_room;
   if n >= (r.settings->>'maxMessages')::int then raise exception 'Message limit reached. Increase the limit in Room settings.'; end if;
   if length(p_payload->>'content') not between 1 and 4000 then raise exception 'Message must be 1–4000 characters.'; end if;
   insert into public.messages(room_id,speaker,content,request_id) values(p_room,'You',p_payload->>'content',(p_payload->>'requestId')::uuid);
   update public.rooms set updated_at=now() where id=p_room returning * into r;
   -- Save and resume atomically; reuse start guards and preserve the current run if already active.
   -- Duplicate request IDs return above, so retries cannot start another round.
   return public.room_action(p_room,p_user,'start');
 elsif p_action='settings' then
   if r.status in ('running','stopped') or exists(select 1 from public.messages where room_id=p_room and status='pending') then raise exception 'Pause and wait for replies before editing.'; end if;
   update public.rooms set title=p_payload->>'title', topic=p_payload->>'topic', purpose=p_payload->>'purpose', bots=p_payload->'bots', settings=p_payload->'settings', status='paused',reason=null,updated_at=now() where id=p_room returning * into r;
 else raise exception 'Unknown room action';
 end if;
 return to_jsonb(r);
end $function$;

