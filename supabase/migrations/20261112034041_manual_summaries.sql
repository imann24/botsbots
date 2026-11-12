SET local check_function_bodies = off;

CREATE TABLE "public"."summaries" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "room_id"          uuid                     NOT NULL,
  "request_id"       uuid                     NOT NULL,
  "model"            text                     NOT NULL,
  "source_ids"       uuid[]                   NOT NULL,
  "source_count"     integer                  NOT NULL,
  "through_sequence" bigint                   NOT NULL,
  "status"           text                     NOT NULL DEFAULT 'pending'::text,
  "content"          text                     NOT NULL DEFAULT ''::text,
  "reserved_cost"    numeric(14,8)            NOT NULL,
  "cost"             numeric(14,8),
  "error"            text,
  "finish_reason"    text,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  "completed_at"     timestamp with time zone,
  CONSTRAINT "summaries_cost_check" CHECK ((cost >= (0)::numeric)),
  CONSTRAINT "summaries_pkey" PRIMARY KEY (id),
  CONSTRAINT "summaries_reserved_cost_check" CHECK ((reserved_cost > (0)::numeric)),
  CONSTRAINT "summaries_room_id_request_id_key" UNIQUE (room_id, request_id),
  CONSTRAINT "summaries_source_count_check" CHECK ((source_count > 0)),
  CONSTRAINT "summaries_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'complete'::text, 'failed'::text])))
);

ALTER TABLE "public"."summaries"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."summaries" FROM "anon";

CREATE OR REPLACE FUNCTION public.claim_summary (
  p_room         uuid,
  p_user         uuid,
  p_request      uuid,
  p_model        text,
  p_source_ids   uuid[],
  p_quote        numeric,
  p_daily_budget numeric
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
DECLARE r public.rooms; s public.summaries; spent numeric; daily numeric; n integer; last_sequence bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 SELECT * INTO r FROM public.rooms WHERE id=p_room AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
 UPDATE public.summaries SET status='failed',error='Summary timed out. Reserved budget retained. Try again manually.',completed_at=now()
 WHERE room_id=p_room AND status='pending' AND created_at<now()-interval '120 seconds';
 SELECT * INTO s FROM public.summaries WHERE room_id=p_room AND request_id=p_request;
 IF FOUND THEN RETURN jsonb_build_object('claimed',false,'summary',to_jsonb(s)); END IF;
 IF EXISTS(SELECT 1 FROM public.summaries WHERE room_id=p_room AND status='pending') THEN
   RAISE EXCEPTION 'A summary is already being generated for this room.';
 END IF;
 IF p_quote IS NULL OR p_quote<=0 OR p_daily_budget IS NULL OR p_daily_budget<=0 THEN RAISE EXCEPTION 'Summary pricing is unavailable'; END IF;
 SELECT count(*),max(sequence) INTO n,last_sequence FROM public.messages
 WHERE room_id=p_room AND id=ANY(p_source_ids) AND status='complete' AND length(trim(content))>0;
 IF n=0 OR n IS DISTINCT FROM cardinality(p_source_ids) OR NOT EXISTS(
   SELECT 1 FROM public.messages WHERE room_id=p_room AND id=ANY(p_source_ids) AND bot_id IS NOT NULL
 ) THEN RAISE EXCEPTION 'Wait for at least one bot reply before summarizing.'; END IF;
 SELECT coalesce(sum(coalesce(cost,reserved_cost)),0) INTO spent FROM public.messages WHERE room_id=p_room;
 SELECT spent+coalesce(sum(coalesce(cost,reserved_cost)),0) INTO spent FROM public.summaries WHERE room_id=p_room;
 IF spent+p_quote>(r.settings->>'budget')::numeric THEN RAISE EXCEPTION 'Not enough room budget to reserve a summary. Raise the room budget in settings.'; END IF;
 SELECT coalesce(sum(coalesce(m.cost,m.reserved_cost)),0) INTO daily FROM public.messages m JOIN public.rooms x ON x.id=m.room_id
 WHERE x.user_id=p_user AND m.created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 SELECT daily+coalesce(sum(coalesce(m.cost,m.reserved_cost)),0) INTO daily FROM public.summaries m JOIN public.rooms x ON x.id=m.room_id
 WHERE x.user_id=p_user AND m.created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 IF daily+p_quote>p_daily_budget THEN RAISE EXCEPTION 'Daily account budget reached.'; END IF;
 INSERT INTO public.summaries(room_id,request_id,model,source_ids,source_count,through_sequence,reserved_cost)
 VALUES(p_room,p_request,p_model,p_source_ids,n,last_sequence,p_quote) RETURNING * INTO s;
 UPDATE public.rooms SET updated_at=now() WHERE id=p_room;
 RETURN jsonb_build_object('claimed',true,'summary',to_jsonb(s));
END $function$;

REVOKE ALL ON FUNCTION "public"."claim_summary"(uuid, uuid, uuid, text, uuid[], numeric, numeric) FROM PUBLIC, "anon", "authenticated";

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
 select spent+coalesce(sum(coalesce(cost,reserved_cost)),0) into spent from public.summaries where room_id=p_room;
 if n >= (r.settings->>'maxMessages')::int then why:='Room message limit reached.'; end if;
 if now()>r.run_started_at+make_interval(mins=>(r.settings->>'maxMinutes')::int) then why:='Session time limit reached.'; end if;
 if why is not null then
  update public.rooms set status='limited',reason=why,updated_at=now() where id=p_room; return null;
 end if;
 if pending >= (case when r.settings->>'mode'='moderated' then 1 else (r.settings->>'concurrency')::int end) then return null; end if;
 select coalesce(sum(coalesce(msg.cost,msg.reserved_cost)),0) into daily from public.messages msg join public.rooms x on x.id=msg.room_id where x.user_id=p_user and msg.created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 select daily+coalesce(sum(coalesce(msg.cost,msg.reserved_cost)),0) into daily from public.summaries msg join public.rooms x on x.id=msg.room_id where x.user_id=p_user and msg.created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
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

CREATE OR REPLACE FUNCTION public.finish_summary (
  p_summary       uuid,
  p_content       text,
  p_cost          numeric,
  p_finish_reason text    DEFAULT NULL::text,
  p_error         text    DEFAULT NULL::text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
DECLARE rid uuid;
BEGIN
 SELECT room_id INTO rid FROM public.summaries WHERE id=p_summary;
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM 1 FROM public.rooms WHERE id=rid FOR UPDATE;
 UPDATE public.summaries SET content=p_content,cost=CASE WHEN p_error IS NULL THEN greatest(0,p_cost) ELSE NULL END,
 status=CASE WHEN p_error IS NULL THEN 'complete' ELSE 'failed' END,error=p_error,finish_reason=p_finish_reason,completed_at=now()
 WHERE id=p_summary AND status='pending';
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.rooms SET updated_at=now() WHERE id=rid;
 RETURN true;
END $function$;

REVOKE ALL ON FUNCTION "public"."finish_summary"(uuid, text, numeric, text, text) FROM PUBLIC, "anon", "authenticated";

ALTER TABLE "public"."summaries"
  ADD CONSTRAINT "summaries_room_id_fkey" FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX one_pending_summary ON public.summaries USING btree (room_id)
  WHERE (status = 'pending'::text);

CREATE INDEX summaries_room_created ON public.summaries USING btree (room_id, created_at DESC);

CREATE POLICY "owner_summaries" ON "public"."summaries"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.rooms r
  WHERE ((r.id = summaries.room_id) AND (r.user_id = ( SELECT auth.uid() AS uid))))));

REVOKE ALL ON FUNCTION "public"."claim_summary"(uuid, uuid, uuid, text, uuid[], numeric, numeric) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."claim_summary"(uuid, uuid, uuid, text, uuid[], numeric, numeric) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."claim_summary"(uuid, uuid, uuid, text, uuid[], numeric, numeric) TO "service_role";

REVOKE ALL ON FUNCTION "public"."finish_summary"(uuid, text, numeric, text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."finish_summary"(uuid, text, numeric, text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."finish_summary"(uuid, text, numeric, text, text) TO "service_role";

REVOKE ALL ON TABLE "public"."summaries" FROM "authenticated";

GRANT SELECT ON TABLE "public"."summaries" TO "authenticated";

REVOKE ALL ON TABLE "public"."summaries" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."summaries" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."summaries" TO "service_role";

