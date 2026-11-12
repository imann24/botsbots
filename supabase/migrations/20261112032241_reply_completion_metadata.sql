SET local check_function_bodies = off;

DROP FUNCTION "public"."finish_turn"(uuid, uuid, text, numeric, integer, integer, text);

ALTER TABLE "public"."messages"
  ADD COLUMN "finish_reason" text;

ALTER TABLE "public"."messages"
  ADD COLUMN "reasoning_tokens" integer;

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

REVOKE ALL ON FUNCTION "public"."finish_turn"(uuid, uuid, text, numeric, integer, integer, text, text, integer) FROM PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."finish_turn"(uuid, uuid, text, numeric, integer, integer, text, text, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."finish_turn"(uuid, uuid, text, numeric, integer, integer, text, text, integer) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."finish_turn"(uuid, uuid, text, numeric, integer, integer, text, text, integer) TO "service_role";

