SET local check_function_bodies = off;

CREATE TABLE "public"."messages" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "room_id"       uuid                     NOT NULL,
  "sequence"      bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "bot_id"        uuid,
  "speaker"       text                     NOT NULL,
  "model"         text,
  "content"       text                     NOT NULL DEFAULT ''::text,
  "status"        text                     NOT NULL DEFAULT 'complete'::text,
  "run_id"        uuid,
  "request_id"    uuid,
  "reserved_cost" numeric(14,8)            NOT NULL DEFAULT 0,
  "cost"          numeric(14,8),
  "input_tokens"  integer,
  "output_tokens" integer,
  "error"         text,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "completed_at"  timestamp with time zone,
  CONSTRAINT "messages_cost_check" CHECK ((cost >= (0)::numeric)),
  CONSTRAINT "messages_pkey" PRIMARY KEY (id),
  CONSTRAINT "messages_reserved_cost_check" CHECK ((reserved_cost >= (0)::numeric)),
  CONSTRAINT "messages_room_id_request_id_key" UNIQUE (room_id, request_id),
  CONSTRAINT "messages_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'complete'::text, 'failed'::text])))
);

ALTER TABLE "public"."messages"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."messages" FROM "anon";

CREATE TABLE "public"."rooms" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"        uuid                     NOT NULL,
  "title"          text                     NOT NULL,
  "topic"          text                     NOT NULL,
  "purpose"        text                     NOT NULL,
  "bots"           jsonb                    NOT NULL,
  "settings"       jsonb                    NOT NULL,
  "status"         text                     NOT NULL DEFAULT 'paused'::text,
  "reason"         text,
  "run_id"         uuid,
  "run_started_at" timestamp with time zone,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "rooms_pkey" PRIMARY KEY (id),
  CONSTRAINT "rooms_status_check" CHECK ((status = ANY (ARRAY['paused'::text, 'running'::text, 'stopped'::text, 'limited'::text, 'error'::text])))
);

ALTER TABLE "public"."rooms"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."rooms" FROM "anon";

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
 select coalesce(sum(coalesce(m.cost,m.reserved_cost)),0) into daily from public.messages m join public.rooms x on x.id=m.room_id where x.user_id=p_user and m.created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
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

REVOKE ALL ON FUNCTION "public"."claim_turn"(uuid, uuid, uuid, jsonb, numeric) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.finish_turn (
  p_room    uuid,
  p_message uuid,
  p_content text,
  p_cost    numeric,
  p_input   integer,
  p_output  integer,
  p_error   text    DEFAULT NULL::text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare r public.rooms; m public.messages;
begin
 select * into r from public.rooms where id=p_room for update;
 select * into m from public.messages where id=p_message and room_id=p_room and status='pending' for update;
 if not found then return false; end if;
 update public.messages set content=p_content,cost=case when p_error is null then greatest(0,p_cost) else null end,input_tokens=p_input,output_tokens=p_output,
 status=case when p_error is null then 'complete' else 'failed' end,error=p_error,completed_at=now() where id=p_message;
 update public.rooms set updated_at=now(),status=case when p_error is not null and status='running' then 'error' else status end,
 reason=case when p_error is not null and status='running' then 'A model could not reply. Review the error and resume when ready.' else reason end where id=p_room;
 return true;
end $function$;

REVOKE ALL ON FUNCTION "public"."finish_turn"(uuid, uuid, text, numeric, integer, integer, text) FROM PUBLIC, "anon", "authenticated";

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
 elsif p_action='settings' then
   if r.status in ('running','stopped') or exists(select 1 from public.messages where room_id=p_room and status='pending') then raise exception 'Pause and wait for replies before editing.'; end if;
   update public.rooms set title=p_payload->>'title', topic=p_payload->>'topic', purpose=p_payload->>'purpose', bots=p_payload->'bots', settings=p_payload->'settings', status='paused',reason=null,updated_at=now() where id=p_room returning * into r;
 else raise exception 'Unknown room action';
 end if;
 return to_jsonb(r);
end $function$;

REVOKE ALL ON FUNCTION "public"."room_action"(uuid, uuid, text, jsonb) FROM PUBLIC, "anon", "authenticated";

ALTER TABLE "public"."messages"
  ADD CONSTRAINT "messages_room_id_fkey" FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;

ALTER TABLE "public"."rooms"
  ADD CONSTRAINT "rooms_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX messages_room_order ON public.messages USING btree (room_id, SEQUENCE);

CREATE UNIQUE INDEX one_pending_per_bot ON public.messages USING btree (room_id, bot_id)
  WHERE (status = 'pending'::text);

CREATE INDEX rooms_owner ON public.rooms USING btree (user_id, updated_at DESC);

CREATE POLICY "owner_messages" ON "public"."messages"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.rooms r
  WHERE ((r.id = messages.room_id) AND (r.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "owner_rooms" ON "public"."rooms"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = user_id));

REVOKE ALL ON FUNCTION "public"."claim_turn"(uuid, uuid, uuid, jsonb, numeric) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."claim_turn"(uuid, uuid, uuid, jsonb, numeric) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."claim_turn"(uuid, uuid, uuid, jsonb, numeric) TO "service_role";

REVOKE ALL ON FUNCTION "public"."finish_turn"(uuid, uuid, text, numeric, integer, integer, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."finish_turn"(uuid, uuid, text, numeric, integer, integer, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."finish_turn"(uuid, uuid, text, numeric, integer, integer, text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."room_action"(uuid, uuid, text, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."room_action"(uuid, uuid, text, jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."room_action"(uuid, uuid, text, jsonb) TO "service_role";

REVOKE ALL ON SEQUENCE "public"."messages_sequence_seq" FROM "anon";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."messages_sequence_seq" TO "anon";

REVOKE ALL ON SEQUENCE "public"."messages_sequence_seq" FROM "authenticated";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."messages_sequence_seq" TO "authenticated";

REVOKE ALL ON SEQUENCE "public"."messages_sequence_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."messages_sequence_seq" TO "postgres";

REVOKE ALL ON SEQUENCE "public"."messages_sequence_seq" FROM "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."messages_sequence_seq" TO "service_role";

REVOKE ALL ON TABLE "public"."messages" FROM "authenticated";

GRANT SELECT ON TABLE "public"."messages" TO "authenticated";

REVOKE ALL ON TABLE "public"."messages" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."messages" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."messages" TO "service_role";

REVOKE ALL ON TABLE "public"."rooms" FROM "authenticated";

GRANT SELECT ON TABLE "public"."rooms" TO "authenticated";

REVOKE ALL ON TABLE "public"."rooms" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."rooms" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."rooms" TO "service_role";

