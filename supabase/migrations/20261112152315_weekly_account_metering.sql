-- Premium is an administrator-managed entitlement, never a user-editable JWT claim.
CREATE TABLE public.account_billing (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_premium boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_billing ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_billing FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.account_billing TO authenticated;
GRANT ALL ON public.account_billing TO service_role;
CREATE POLICY own_account_billing ON public.account_billing FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
INSERT INTO public.account_billing(user_id) SELECT id FROM auth.users;
COMMENT ON COLUMN public.account_billing.is_premium IS
  'Admin managed. Premium uses PREMIUM_WEEKLY_BUDGET_USD, which defaults to unlimited.';

-- Keep usage after a room is deleted. Deleting the account removes its ledger.
CREATE TABLE public.usage_events (
  source_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('reply', 'summary')),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  model text,
  status text NOT NULL CHECK (status IN ('pending', 'complete', 'failed')),
  reserved_cost numeric(14,8) NOT NULL CHECK (reserved_cost >= 0 AND reserved_cost < 'Infinity'::numeric),
  cost numeric(14,8) CHECK (cost >= 0 AND cost < 'Infinity'::numeric),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, source_id)
);
CREATE INDEX usage_events_user_created ON public.usage_events(user_id, created_at);
CREATE INDEX usage_events_room ON public.usage_events(room_id);
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.usage_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;
CREATE POLICY own_usage_events ON public.usage_events FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Runs with the caller's privileges. All writes to the source tables are server-only.
CREATE FUNCTION public.record_usage_event() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_TABLE_NAME='messages' THEN
    IF NEW.bot_id IS NULL AND NEW.reserved_cost=0 AND coalesce(NEW.cost,0)=0 THEN
      RETURN NEW;
    END IF;
  END IF;
  INSERT INTO public.usage_events(source_id, kind, user_id, room_id, model, status, reserved_cost, cost, created_at)
  SELECT NEW.id, CASE WHEN TG_TABLE_NAME='messages' THEN 'reply' ELSE 'summary' END,
    r.user_id, r.id, NEW.model, NEW.status, NEW.reserved_cost, NEW.cost, NEW.created_at
  FROM public.rooms r WHERE r.id=NEW.room_id
  ON CONFLICT (kind, source_id) DO UPDATE SET
    status=EXCLUDED.status, reserved_cost=EXCLUDED.reserved_cost, cost=EXCLUDED.cost;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.record_usage_event() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_usage_event() TO service_role;
CREATE TRIGGER meter_replies AFTER INSERT OR UPDATE OF cost, reserved_cost, status ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.record_usage_event();
CREATE TRIGGER meter_summaries AFTER INSERT OR UPDATE OF cost, reserved_cost, status ON public.summaries
  FOR EACH ROW EXECUTE FUNCTION public.record_usage_event();

-- Install triggers before taking the backfill snapshot; their DDL locks fence source writes
-- until this migration commits, so requests cannot fall between the snapshot and metering.
INSERT INTO public.usage_events(source_id, kind, user_id, room_id, model, status, reserved_cost, cost, created_at)
SELECT m.id, 'reply', r.user_id, r.id, m.model, m.status, m.reserved_cost, m.cost, m.created_at
FROM public.messages m JOIN public.rooms r ON r.id=m.room_id
WHERE m.bot_id IS NOT NULL OR m.reserved_cost>0 OR m.cost>0;
INSERT INTO public.usage_events(source_id, kind, user_id, room_id, model, status, reserved_cost, cost, created_at)
SELECT s.id, 'summary', r.user_id, r.id, s.model, s.status, s.reserved_cost, s.cost, s.created_at
FROM public.summaries s JOIN public.rooms r ON r.id=s.room_id;

CREATE FUNCTION public.account_usage(
  p_user uuid,
  p_weekly_budget numeric DEFAULT 10,
  p_premium_weekly_budget numeric DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  premium boolean; allowance numeric; recorded numeric; pending numeric; uncertain numeric;
  week_start timestamptz := date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  week_end timestamptz := (date_trunc('week', now() AT TIME ZONE 'UTC') + interval '7 days') AT TIME ZONE 'UTC';
BEGIN
  IF p_weekly_budget IS NULL OR NOT (p_weekly_budget>=0 AND p_weekly_budget<'Infinity'::numeric)
    OR (p_premium_weekly_budget IS NOT NULL AND NOT (p_premium_weekly_budget>=0 AND p_premium_weekly_budget<'Infinity'::numeric)) THEN
    RAISE EXCEPTION 'Weekly budgets must be finite nonnegative amounts; only premium may be unlimited.';
  END IF;
  -- Lazily creates billing rows for new signups; never overwrites an upgrade.
  INSERT INTO public.account_billing(user_id) VALUES(p_user) ON CONFLICT DO NOTHING;
  SELECT is_premium INTO STRICT premium FROM public.account_billing WHERE user_id=p_user;
  allowance := CASE WHEN premium THEN p_premium_weekly_budget ELSE p_weekly_budget END;
  SELECT coalesce(sum(cost),0),
    coalesce(sum(reserved_cost) FILTER (WHERE cost IS NULL AND status='pending'),0),
    coalesce(sum(reserved_cost) FILTER (WHERE cost IS NULL AND status<>'pending'),0)
  INTO recorded, pending, uncertain
  FROM public.usage_events WHERE user_id=p_user AND created_at>=week_start AND created_at<week_end;
  RETURN jsonb_build_object(
    'tier', CASE WHEN premium THEN 'premium' ELSE 'standard' END,
    'limit', allowance, 'spent', recorded, 'pending', pending, 'uncertain', uncertain,
    'used', recorded+pending+uncertain,
    'remaining', CASE WHEN allowance IS NULL THEN NULL ELSE greatest(0,allowance-recorded-pending-uncertain) END,
    'periodStart', week_start, 'resetsAt', week_end
  );
END $$;
REVOKE ALL ON FUNCTION public.account_usage(uuid,numeric,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_usage(uuid,numeric,numeric) TO service_role;

-- Remove the old signatures so no caller can bypass weekly metering via the daily API.
DROP FUNCTION public.claim_turn(uuid,uuid,uuid,jsonb,numeric);
DROP FUNCTION public.claim_summary(uuid,uuid,uuid,text,uuid[],numeric,numeric);


CREATE OR REPLACE FUNCTION public.claim_turn (
  p_room         uuid,
  p_user         uuid,
  p_run          uuid,
  p_prices       jsonb,
  p_weekly_budget numeric DEFAULT 10,
  p_premium_weekly_budget numeric DEFAULT NULL
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare r public.rooms; b jsonb; m public.messages; n int; pending int; spent numeric; quote numeric; meter jsonb; weekly numeric; allowance numeric; why text; eligible boolean:=false;
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
 meter := public.account_usage(p_user,p_weekly_budget,p_premium_weekly_budget);
 weekly := (meter->>'used')::numeric;
 allowance := (meter->>'limit')::numeric;
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
  if allowance is not null and weekly+quote>allowance then why:='Weekly account budget: not enough available to reserve another reply. Resets Monday at 00:00 UTC.'; continue; end if;
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

CREATE OR REPLACE FUNCTION public.claim_summary (
  p_room         uuid,
  p_user         uuid,
  p_request      uuid,
  p_model        text,
  p_source_ids   uuid[],
  p_quote        numeric,
  p_weekly_budget numeric DEFAULT 10,
  p_premium_weekly_budget numeric DEFAULT NULL
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
DECLARE r public.rooms; s public.summaries; spent numeric; meter jsonb; weekly numeric; allowance numeric; n integer; last_sequence bigint;
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
 IF p_quote IS NULL OR p_quote<=0 THEN RAISE EXCEPTION 'Summary pricing is unavailable'; END IF;
 SELECT count(*),max(sequence) INTO n,last_sequence FROM public.messages
 WHERE room_id=p_room AND id=ANY(p_source_ids) AND status='complete' AND length(trim(content))>0;
 IF n=0 OR n IS DISTINCT FROM cardinality(p_source_ids) OR NOT EXISTS(
   SELECT 1 FROM public.messages WHERE room_id=p_room AND id=ANY(p_source_ids) AND bot_id IS NOT NULL
 ) THEN RAISE EXCEPTION 'Wait for at least one bot reply before summarizing.'; END IF;
 SELECT coalesce(sum(coalesce(cost,reserved_cost)),0) INTO spent FROM public.messages WHERE room_id=p_room;
 SELECT spent+coalesce(sum(coalesce(cost,reserved_cost)),0) INTO spent FROM public.summaries WHERE room_id=p_room;
 IF spent+p_quote>(r.settings->>'budget')::numeric THEN RAISE EXCEPTION 'Not enough room budget to reserve a summary. Raise the room budget in settings.'; END IF;
 meter := public.account_usage(p_user,p_weekly_budget,p_premium_weekly_budget);
 weekly := (meter->>'used')::numeric;
 allowance := (meter->>'limit')::numeric;
 IF allowance IS NOT NULL AND weekly+p_quote>allowance THEN RAISE EXCEPTION 'Weekly account budget: not enough available to reserve a summary. Resets Monday at 00:00 UTC.'; END IF;
 INSERT INTO public.summaries(room_id,request_id,model,source_ids,source_count,through_sequence,reserved_cost)
 VALUES(p_room,p_request,p_model,p_source_ids,n,last_sequence,p_quote) RETURNING * INTO s;
 UPDATE public.rooms SET updated_at=now() WHERE id=p_room;
 RETURN jsonb_build_object('claimed',true,'summary',to_jsonb(s));
END $function$;

CREATE OR REPLACE FUNCTION public.finish_turn (
  p_room             uuid,
  p_message          uuid,
  p_content          text,
  p_cost             numeric,
  p_input            integer,
  p_output           integer,
  p_error            text    DEFAULT NULL::text,
  p_finish_reason    text    DEFAULT NULL::text,
  p_reasoning_tokens integer DEFAULT NULL::integer
)
  RETURNS boolean
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare r public.rooms; m public.messages;
begin
 perform pg_advisory_xact_lock(hashtextextended((select user_id::text from public.rooms where id=p_room),0));
 select * into r from public.rooms where id=p_room for update;
 select * into m from public.messages where id=p_message and room_id=p_room and status='pending' for update;
 if not found then return false; end if;
 update public.messages set content=p_content,cost=case when p_error is null then greatest(0,p_cost) else null end,input_tokens=p_input,output_tokens=p_output,
 finish_reason=p_finish_reason,reasoning_tokens=p_reasoning_tokens,
 status=case when p_error is null then 'complete' else 'failed' end,error=p_error,completed_at=now() where id=p_message;
 update public.rooms set updated_at=now(),status=case when p_error is not null and status='running' then 'error' else status end,
 reason=case when p_error is not null and status='running' then 'A model could not reply. Review the error and resume when ready.' else reason end where id=p_room;
 return true;
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
 PERFORM pg_advisory_xact_lock(hashtextextended((SELECT user_id::text FROM public.rooms WHERE id=rid),0));
 PERFORM 1 FROM public.rooms WHERE id=rid FOR UPDATE;
 UPDATE public.summaries SET content=p_content,cost=CASE WHEN p_error IS NULL THEN greatest(0,p_cost) ELSE NULL END,
 status=CASE WHEN p_error IS NULL THEN 'complete' ELSE 'failed' END,error=p_error,finish_reason=p_finish_reason,completed_at=now()
 WHERE id=p_summary AND status='pending';
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.rooms SET updated_at=now() WHERE id=rid;
 RETURN true;
END $function$;

REVOKE ALL ON FUNCTION public.claim_turn(uuid,uuid,uuid,jsonb,numeric,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_turn(uuid,uuid,uuid,jsonb,numeric,numeric) TO service_role;
REVOKE ALL ON FUNCTION public.claim_summary(uuid,uuid,uuid,text,uuid[],numeric,numeric,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_summary(uuid,uuid,uuid,text,uuid[],numeric,numeric,numeric) TO service_role;
