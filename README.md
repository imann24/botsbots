# BotsBots

A conversation-first workspace for one human and 2–6 AI participants. Each bot has its own model, name, and perspective. Built with TypeScript, Next.js, pnpm, Vercel AI Gateway, and Supabase.

## Run locally

Requirements: Node.js 22+, pnpm 10, and a running Docker runtime: Docker Engine on Linux, or Docker Desktop/OrbStack on macOS.

```sh
pnpm install
pnpm db:start
pnpm env:setup
pnpm dev
```

On Linux, install Docker Engine using your distribution's instructions and start it with `sudo systemctl start docker` on systemd systems. Configure your user's Docker socket access or use rootless Docker; `docker ps` must succeed **without sudo** in the same terminal used for pnpm. If group membership changed, log out and back in first. Do not run pnpm with sudo. See [Docker's Linux post-install instructions](https://docs.docker.com/engine/install/linux-postinstall/) for access setup and its security implications.

On macOS with OrbStack, start OrbStack and run `docker context use orbstack` before `pnpm db:start`. On either OS, check `docker context show` and `DOCKER_HOST` if Docker is unreachable. `pnpm db:setup` requires an already running local stack; `pnpm db:start` starts it and also performs that setup automatically.

Supabase applies the committed migrations when creating its local database. For an existing local database, apply pending migrations with `pnpm exec supabase db push` (CLI v3 defaults to local).

`pnpm db:start` checks all configured service ports and automatically replaces occupied ports, including those used by other Docker projects. It saves the selected ports in Git-ignored `supabase/.env`, keeps the committed `config.toml` unchanged, and refreshes the Supabase URL and keys in `.env.local` after a successful start. Subsequent starts reuse the ports; an already running BotsBots stack keeps its ports. `db:stop`, `db:status`, and direct Supabase CLI commands read the same local overrides. Run `pnpm db:status` for the current URLs; the default ports below may change when another project uses them.

`pnpm env:setup` creates or updates `.env.local` in an interactive terminal. It prompts for the Gateway key, Supabase connection, standard/premium weekly budgets, and optional site URL. Key input is hidden and existing secrets are never displayed. Press Enter to keep an existing value; Ctrl+C cancels without saving. The file has owner-only permissions (`0600`) and is ignored by Git. Values are stored as plaintext for Next.js to read; hidden prompts and file permissions do not encrypt them. `NEXT_PUBLIC_` values are public in the browser; the Gateway and Supabase secret keys stay server-only.

`db:setup` fills the local Supabase URL and keys while preserving your Gateway key. For hosted Supabase, run `pnpm env:setup` and enter the hosted values instead. Restart the dev server after changing configuration. Create an account at [the local app](http://127.0.0.1:3000); local email confirmation is disabled. Supabase Studio runs at [localhost:54323](http://127.0.0.1:54323).

## Using a room

1. Pick a purpose and topic. Expand each participant to change its model, name, and perspective; add or remove bots.
   The room name is optional. Names are saved with the room. Click the pencil beside a conversation's title to rename it, even while bots are running or after the room has ended; Enter saves and Escape cancels.
2. Tune the room limits. New rooms default to 16 total messages, 4 replies per bot, an $0.25 room budget, 800 output tokens per reply, and a five-minute session.
   To start every new room with your own lineup, set up the bots and limits in the room setup panel and click **Save as my defaults**. Defaults are saved to your account (`public.account_preferences`) and apply to rooms you create afterwards; existing rooms keep their own settings. **Restore BotsBots defaults** removes them. If a saved bot uses a model that later leaves the catalog, new rooms fall back to the built-in lineup.
3. Start a moderated round (each bot once, sequentially, then pause) or free-for-all (bounded concurrency with one active reply per bot).
4. Sending a message automatically starts or resumes the bots within the room's limits. During an active run, it adds your perspective without restarting the round. You can also Continue without sending a message. Pause and wait for current replies before editing; ending a room is final. Export a transcript as Markdown.

All message attempts count toward limits, including human messages and failed bot calls. A room can pause before the displayed budget is exhausted because the next response needs a conservative reservation. Tokens include reasoning where a model requires it. Replies use the lowest reasoning setting, request concise answers, and show a notice if the model reaches its output limit. Increasing that limit applies to future replies; existing truncated text cannot be recovered automatically. Bot messages show local timestamps with the full date on hover.

## Cost and concurrency controls

### Manual summaries

Click **Summarize**, choose a model from the catalog, then click **Generate summary**. Opening the panel, selecting a model, polling, and resuming a room never generate summaries automatically. Each result separates the bots' contributions using their existing room colors, names, and models, followed by a neutral combined synthesis.

Summaries are saved separately with the exact source message IDs and coverage count. They include completed messages across the conversation (including human steering), not just the bots' recent context window. Pending/failed replies are excluded, and incomplete replies are identified to the summarizer. Newer messages are flagged without updating the summary automatically. Saved summaries are available after reloading.

Summary calls share room and weekly spending limits with bot calls, including pending reservations. They do not consume chat-message or per-bot quotas and are never fed back into the bots' conversation. Duplicate request IDs and a per-room lock prevent duplicate paid work. Each request allows up to 1,200 output tokens and 48 KB of serialized source; oversized conversations fail clearly instead of silently dropping earlier contributions. Failed calls retain their reservations and require a manual retry.

- Server-side PostgreSQL transactions lock the account, then the room, before claiming work. A partial unique index prevents two pending replies from one bot. Run IDs fence old workers; human request IDs prevent duplicate sends.
- Current Gateway prices are fetched and cached for five minutes. Missing pricing blocks paid calls. The app reserves bounded input plus the configured output cap, using the highest listed price tier and a 25% margin.
- Actual reported usage settles reservations conservatively. Failed or uncertain calls retain the reservation. There are no automatic paid retries or automatic continuations of truncated replies.
- Limits cover total attempts, per-bot attempts, per-room budget, per-account standard/premium weekly budgets, tokens, recent context, concurrent replies, cooldown, and session duration. `WEEKLY_BUDGET_USD` defaults to $10 per standard account per week; premium defaults to unlimited.
- Reservations are an application guardrail, not a guaranteed billing cap. Provider pricing and usage reporting can differ; also set a spending limit in your Vercel account.

The model catalog uses contemporary small/mid spending tiers from major providers, excluding Grok. See [catalog notes and sources](docs/MODELS.md). These tiers describe price/positioning, not undisclosed parameter counts.

## Persistence and deployment

### Weekly metering and premium accounts

`WEEKLY_BUDGET_USD=10` is the default weekly allowance for each standard account.
`PREMIUM_WEEKLY_BUDGET_USD=unlimited` is the default for **all** premium accounts;
set it to a dollar amount such as `50` to give each premium account that weekly cap.
Blank/unset values use those defaults. Both settings accept `0` to block new spend;
negative, malformed and nonfinite amounts fail closed. Restart/redeploy the server
after changing environment variables. The previous `DAILY_BUDGET_USD` is no longer read.

Weeks run Monday 00:00 UTC to the following Monday, without rollover. Replies and
summaries share an account's allowance across every room. Pending and uncertain
requests reserve allowance; successful requests replace their reservation with the
recorded cost. A request can pause before the displayed remaining amount is zero
because the next reservation must fit. Premium accounts retain all room limits.

In Supabase's Table Editor, open **public.account_billing**, find the `user_id` from
Authentication → Users, and set **is_premium** to **true**. Set it back to false to
downgrade. Existing users are backfilled; new users get a billing row when usage is
first checked. To upgrade an account before its first visit, use the SQL Editor:

```sql
insert into public.account_billing (user_id, is_premium)
select id, true from auth.users where email = 'person@example.com'
on conflict (user_id) do update set is_premium = excluded.is_premium;
```

Only administrators/service credentials can change tiers. User metadata and client
writes cannot grant premium. Changes apply to the next server budget check and
appear in the meter within five seconds while the page is visible. Upgrading,
downgrading or adjusting a cap never clears spend; choose Continue to resume a
paused room after allowance becomes available.

The weekly meter lives above the sidebar account controls, with a compact shortcut
when navigation is hidden. Details distinguish recorded spend, pending reservations
and uncertain requests. These are estimated AI costs, not customer charges.
The `usage_events` ledger retains spend if a room is deleted and removes it when
the account is deleted. Historical messages and summaries are backfilled by the
metering migration; usage already deleted before migration cannot be reconstructed.

Apply the new migration before deploying the updated server (the claim RPC signatures
change together). Stop generation during that rollout. After checking the installed
CLI's help, use `supabase db push` for a local stack or the explicit remote target
for your hosted project. Do not reset a database containing chats you want to keep.

### Storage and hosting

Rooms and messages persist in PostgreSQL. Supabase Auth issues sessions; RLS limits reads to the owning user. Mutations use authenticated Next.js routes and server-only database credentials. Public database roles cannot call orchestration functions or write tables directly.

For hosted Supabase, provision a project, apply the files in `supabase/migrations`, and replace `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`. Configure that project's Auth site/redirect URLs and email policy; turn off "Confirm email" under Auth providers so signup starts a session immediately. Local CLI v3 operations target local by default; review `--help` before using an explicit hosted target.

This first version is driven by the open room's browser tab: polling schedules bounded server requests. Closing the tab stops new work, but already-started calls may finish. Reopening a running room resumes scheduling within its limits. A hosted service should move scheduling to a durable worker and add abuse protection, rate limiting, billing, and recovery flows before opening public signup. Billing, multi-human rooms, BYOK, and production deployment are outside this version.

## Brand assets

The favicon uses the stepped brand mark, with a signal-red final step. The social preview uses the existing tagline, fonts, and participant colors. Next.js serves these static assets without authentication.

Edit `src/app/icon.svg` or `assets/brand/social-preview.html`, then run `pnpm assets:brand` to regenerate the multi-size ICO, Apple touch icon, and 1200 × 630 Open Graph PNG. Install Playwright Chromium with `pnpm exec playwright install chromium` first, or use `PLAYWRIGHT_CHANNEL=chrome pnpm assets:brand` with installed Google Chrome. Review the PNG at full size and at a typical 600 × 315 share size.

Open Graph and Twitter/X use the same preview. Vercel's production domain supplies the absolute image origin; set `SITE_URL` to the public origin when deploying elsewhere or overriding the domain.

## Checks

```sh
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```

Integration checks use isolated, disposable users against local Supabase only, clean up their own records, and make no Gateway calls. They cover competing workers, budget reservations, ownership, idempotency, and stale work.

An optional paid smoke test sends two short Haiku requests (450 and 800 tokens) and asserts natural completion:

```sh
node --conditions=react-server --import tsx scripts/gateway-smoke.ts
```

`pnpm db:stop` stops local Supabase while preserving its database volume. Do not reset the database if you want to keep your chats.

### Contact and usage-limit requests

The sidebar's **Contact us** opens a form for support, questions, feedback, or
higher usage limits. **Request higher limits** beside weekly usage opens the
same form with that topic selected. Both are also available in Search.
Requests require a signed-in account and go through the server's Resend API call.
The reply address is prefilled from the account; emails include the verified
account email and account ID so an administrator can identify an upgrade request.
Submitting a request does not change the account's allowance or tier.

Set `RESEND_API_KEY` in `.env.local` and your deployment's server environment.
Verify `botsbots.app` as a sending domain in Resend before sending from it.
`CONTACT_ADMIN_EMAIL` defaults to `isaiahbmann@gmail.com` and
`CONTACT_FROM_EMAIL` defaults to `noreply@botsbots.app`; either can be overridden.
A custom sender must also belong to a verified Resend domain. Restart/redeploy
after changing these values. These variables must never use a `NEXT_PUBLIC_` prefix.
Identical submissions from the same account share a Resend idempotency key,
preventing duplicate delivery on retries within Resend's 24-hour window.
