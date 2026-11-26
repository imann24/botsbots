-- Extend the exhausted run and restart it in one transaction. A delayed click
-- from an older run cannot raise the caps on a later one.
create function public.extend_room_replies(p_room uuid, p_user uuid, p_run uuid)
returns jsonb language plpgsql set search_path to '' as $$
declare
  r public.rooms;
  total_messages integer;
  fewest_replies integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  select * into strict r from public.rooms where id = p_room and user_id = p_user for update;
  if r.status <> 'limited' or r.run_id is distinct from p_run or
     coalesce(r.reason, '') not in ('Every bot has reached its reply limit.', 'Room message limit reached.') then
    raise exception 'The conversation has changed. Refresh the room to continue.';
  end if;

  select count(*) into total_messages from public.messages where room_id = p_room;
  select min((select count(*) from public.messages
              where room_id = p_room and bot_id = (bot->>'id')::uuid))
    into fewest_replies from jsonb_array_elements(r.bots) bot;

  if total_messages >= 100 or fewest_replies >= 30 then
    raise exception 'This conversation is at its maximum reply capacity.';
  end if;
  update public.rooms set settings = settings || jsonb_build_object(
    'maxMessages', greatest((settings->>'maxMessages')::int,
                            least(100, total_messages + jsonb_array_length(bots))),
    'maxPerBot', greatest((settings->>'maxPerBot')::int, fewest_replies + 1)
  ) where id = p_room;

  return public.room_action(p_room, p_user, 'start');
end $$;

revoke all on function public.extend_room_replies(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.extend_room_replies(uuid, uuid, uuid) to service_role;
