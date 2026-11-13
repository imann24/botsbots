# Interaction analytics

BotsBots uses the existing `@vercel/analytics` installation for pageviews and
client-side custom events. Enable **Web Analytics** for the Vercel project and
deploy the app. Custom events require a Vercel **Pro or Enterprise** plan. In the
project dashboard, open **Analytics → Events**, select an event, and filter by
its properties. See [Vercel's custom events guide](https://vercel.com/docs/analytics/custom-events).

## Semantics

- Names use stable `snake_case`. The typed catalog and helpers live in
  `src/lib/analytics.ts`; UI handlers explicitly choose what to send.
- Async actions emit `<action>_started`, then exactly one `<action>_succeeded`
  or `<action>_failed` for each attempt. Success means the app received a
  successful response for that operation. Subsequent UI refresh failures do not
  change the recorded outcome. Sign-in/up success requires an active session.
- A retry is another attempt, even if the server deduplicates the write. These
  are interaction metrics, not a billing ledger or unique database object counts.
- Summary generation inspects the returned summary status, since HTTP 200 can
  contain a failed or pending summary. Pending responses have their own event;
  polling does not later emit an additional completion event.
- Automatic polling, worker ticks, restored layout preferences, initial room
  loading from the URL, and automatic draft resets after archiving emit no custom
  events. Button and command actions share the same domain handlers. A command
  emits both `command_executed` (entry point) and its domain action; do not add
  those together as one metric.
- Typed text does not emit per-keystroke events. Bot text fields and numeric
  settings emit only on blur after a change. Room search emits on blur for a
  nonempty search; command search emits on close/execute with a nonempty query.
- Browser blockers, disabled JavaScript, network loss, and leaving a page before
  a response can prevent delivery. No client event is a guaranteed audit record.

## Async action catalog

Every row expands to `_started`, `_succeeded`, and `_failed` event names.
All failures include `error_type`: `request`, `network_or_client`, `timeout`, or
`aborted`. Error messages and arbitrary provider error codes are never sent.

| Action prefix                                 | Properties                                          | Trigger                                                     |
| --------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| `sign_in`, `sign_up`, `sign_out`              | None                                                | Authentication attempt and session outcome                  |
| `room_create`                                 | `purpose`, `mode`, `bot_count`, `start_immediately` | Create a room, including the start shortcut                 |
| `room_update`                                 | `purpose`, `mode`, `bot_count`, `start_immediately` | Save room configuration                                     |
| `room_start`                                  | `mode`, `source` (`control` or `create`)            | Start/continue, or start immediately after creation         |
| `room_pause`, `room_stop`                     | `mode`                                              | Pause or end a room                                         |
| `room_rename`, `room_archive`, `room_restore` | None                                                | Confirm the corresponding mutation                          |
| `message_send`                                | `mode`, `room_status`, `length_bucket`              | Send a human message; status is captured before sending     |
| `defaults_save`                               | `purpose`, `mode`, `bot_count`                      | Save the draft's lineup and limits as account defaults      |
| `defaults_reset`                              | None                                                | Restore the built-in defaults                               |
| `contact_send`                                | `kind`                                              | Submit support, question, feedback, or higher-limit request |

`length_bucket` is `1-100`, `101-500`, `501-2000`, or `2001+` characters.
`purpose` is `plan`, `research`, `debate`, or `explore`; `mode` is `moderated` or
`free`. `defaults_save.purpose` describes the current draft, not a saved default
purpose. `room_start_succeeded` acknowledges the start request, not a completed
AI reply. `message_send_succeeded` acknowledges a human message, not the automatic
bot replies that may follow.

## Other events

| Events                                                                               | Properties / meaning                                                                                            |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `auth_mode_changed`                                                                  | `mode`: `sign_in` / `sign_up`                                                                                   |
| `auth_validation_failed`                                                             | `reason`: `password_mismatch`; no auth request occurred                                                         |
| `room_draft_opened`                                                                  | `custom_defaults`; explicitly opened via New room, brand button, or command                                     |
| `room_opened`                                                                        | `source`: `navigation` / `command`; `filtered` describes sidebar search when navigating there                   |
| `room_editor_opened`, `room_editor_cancelled`                                        | Edit-room entry and cancellation                                                                                |
| `room_purpose_selected`, `room_prompt_applied`                                       | `purpose`; no prompt text                                                                                       |
| `room_start_blocked`                                                                 | `reason`: `account_limit`; blocked before making a start request                                                |
| `room_archive_prompted`, `room_archive_cancelled`                                    | Confirmation open / dismissal; successful archive is not cancellation                                           |
| `room_rename_opened`, `room_rename_cancelled`                                        | Inline title editor open / cancellation                                                                         |
| `room_exported`                                                                      | `message_count`, `format`: `markdown`; browser download triggered, not proof the file was saved                 |
| `archive_view_changed`                                                               | `open`                                                                                                          |
| `room_search_used`                                                                   | `scope`: `active` / `archived`, `result_count`; no query                                                        |
| `bot_added`, `bot_removed`                                                           | Catalog `model`, resulting `bot_count`                                                                          |
| `bot_details_toggled`                                                                | `model`, `open`                                                                                                 |
| `bot_model_selected`                                                                 | Catalog `model`                                                                                                 |
| `bot_field_edited`                                                                   | `field`: `name` / `perspective`; no field value                                                                 |
| `room_setting_changed`                                                               | `setting`, numeric or mode `value`                                                                              |
| `panel_toggled`                                                                      | `panel`: `nav` / `setup` / `limits` / `summary`, `open`, `layout`: `desktop` / `drawer` / `inline`              |
| `latest_replies_clicked`                                                             | Explicit jump to the latest replies                                                                             |
| `usage_viewed`, `usage_retry_clicked`                                                | Usage shortcut and explicit retry                                                                               |
| `usage_details_toggled`, `room_help_toggled`                                         | `open`                                                                                                          |
| `summary_model_selected`                                                             | Catalog `model`                                                                                                 |
| `summary_history_toggled`                                                            | `open`                                                                                                          |
| `summary_selected`                                                                   | `model`, saved summary `status`; no summary ID or content                                                       |
| `summary_generate_started`, `summary_generate_succeeded`, `summary_generate_pending` | `model`; succeeded requires `status: complete`                                                                  |
| `summary_generate_failed`                                                            | `model`, `reason`: `generation` (returned failed summary) / `request` (HTTP, transport, or malformed response)  |
| `contact_opened`, `contact_kind_selected`                                            | `kind`                                                                                                          |
| `contact_closed`                                                                     | `kind`, `sent`; includes cancel, Escape, backdrop, and completion dismissal                                     |
| `command_bar_opened`                                                                 | `source`: `button` / `keyboard`, `shortcuts`                                                                    |
| `command_executed`                                                                   | Static `command`, `source`: `palette` / `shortcut`, `filtered`; room commands normalize to `open_room`          |
| `command_search_used`                                                                | `result_count`; no query                                                                                        |
| `shortcuts_viewed`                                                                   | Switch an already-open palette to shortcut help; opening straight into help uses `command_bar_opened.shortcuts` |
| `hotkeys_changed`                                                                    | `enabled`                                                                                                       |

## Privacy and maintenance

Properties exclude emails, passwords, account/room/bot/message/summary IDs, room
titles, topics, prompts, perspectives, message bodies, support messages, search
queries, and raw errors. Model IDs are public catalog identifiers, not bot IDs.
The client Analytics component strips all query parameters and URL fragments
from both pageviews and custom events, including the private `?room=` locator.
This also removes campaign query parameters from captured URLs.

Events contain at most five flat properties (including failure classification),
using finite numbers, booleans, and strings up to 255 characters. Invalid property
values are dropped; analytics errors are swallowed so they cannot interrupt app
behavior. Keep new event properties aggregate and extend the typed catalog rather
than importing `track` directly into another component.

## Useful comparisons

- Room activation: compare `room_create_started` → `room_create_succeeded` →
  `room_start_succeeded`, split by purpose, mode, and bot count where available.
- Human participation: `message_send_succeeded`, split by mode and length bucket.
- Summary adoption/reliability: summary panel opens → `summary_generate_started`
  → `summary_generate_succeeded`; review failures by reason and model.
- Defaults and model adoption: `defaults_save_succeeded`, `bot_model_selected`,
  and `summary_model_selected`.
- Upgrade interest: `contact_opened` versus `contact_send_succeeded`, filtered to
  `kind=limits`. This measures requests, not paid upgrades.
- Discoverability: `command_executed.source` and `command`, search result counts,
  and room/panel navigation events.

These are aggregate comparisons; no identity or room correlation is added for
per-user, cross-session, or per-room funnel joins.

## Verification

Run `pnpm typecheck`, `pnpm test`, and `pnpm build`. Analytics unit tests cover
success/failure timing, SDK failures, SSR, private metadata exclusion, URL
redaction, and payload constraints. In `pnpm dev`, Vercel's development script
logs events in the browser console instead of sending production traffic. Exercise
representative actions and check event names/properties. After deploying, confirm
receipt under Analytics → Events; local tests cannot verify dashboard ingestion.
