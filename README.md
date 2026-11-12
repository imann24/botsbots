# Botsbots

A conversation-first workspace for one human and 2–6 AI participants. Each bot has its own model, name, and perspective. Built with TypeScript, Next.js, pnpm, Vercel AI Gateway, and Supabase.

## Run locally

Requirements: Node.js 22+, pnpm 10, and OrbStack with Docker running.

```sh
pnpm install
docker context use orbstack
pnpm db:start
pnpm db:setup
pnpm dev
```

Supabase applies the committed migrations when creating its local database. For an existing local database, apply pending migrations with `pnpm exec supabase db push` (CLI v3 defaults to local).

Set `VERCEL_AI_GATEWAY_API_KEY` in `.env.local`. `db:setup` fills the local Supabase URL and keys while preserving your Gateway key. Never commit this file. Create an account at [the local app](http://127.0.0.1:3000); local email confirmation is disabled. Supabase Studio runs at [localhost:54323](http://127.0.0.1:54323).

## Using a room

1. Pick a purpose and topic. Expand each participant to change its model, name, and perspective; add or remove bots.
2. Tune the room limits. New rooms default to 16 total messages, 4 replies per bot, an $0.25 room budget, 800 output tokens per reply, and a five-minute session.
3. Start a moderated round (each bot once, sequentially, then pause) or free-for-all (bounded concurrency with one active reply per bot).
4. Add your own messages at any time. Pause and wait for current replies before editing. Continue intentionally; ending a room is final. Export a transcript as Markdown.

All message attempts count toward limits, including human messages and failed bot calls. A room can pause before the displayed budget is exhausted because the next response needs a conservative reservation. Tokens include reasoning where a model requires it. Replies use the lowest reasoning setting, request concise answers, and show a notice if the model reaches its output limit. Increasing that limit applies to future replies; existing truncated text cannot be recovered automatically. Bot messages show local timestamps with the full date on hover.

## Cost and concurrency controls

### Manual summaries

Click **Summarize**, choose a model from the catalog, then click **Generate summary**. Opening the panel, selecting a model, polling, and resuming a room never generate summaries automatically. Each result separates the bots' contributions using their existing room colors, names, and models, followed by a neutral combined synthesis.

Summaries are saved separately with the exact source message IDs and coverage count. They include completed messages across the conversation (including human steering), not just the bots' recent context window. Pending/failed replies are excluded, and incomplete replies are identified to the summarizer. Newer messages are flagged without updating the summary automatically. Saved summaries are available after reloading.

Summary calls share room and daily spending limits with bot calls, including pending reservations. They do not consume chat-message or per-bot quotas and are never fed back into the bots' conversation. Duplicate request IDs and a per-room lock prevent duplicate paid work. Each request allows up to 1,200 output tokens and 48 KB of serialized source; oversized conversations fail clearly instead of silently dropping earlier contributions. Failed calls retain their reservations and require a manual retry.

- Server-side PostgreSQL transactions lock the account, then the room, before claiming work. A partial unique index prevents two pending replies from one bot. Run IDs fence old workers; human request IDs prevent duplicate sends.
- Current Gateway prices are fetched and cached for five minutes. Missing pricing blocks paid calls. The app reserves bounded input plus the configured output cap, using the highest listed price tier and a 25% margin.
- Actual reported usage settles reservations conservatively. Failed or uncertain calls retain the reservation. There are no automatic paid retries or automatic continuations of truncated replies.
- Limits cover total attempts, per-bot attempts, per-room budget, per-account daily budget, tokens, recent context, concurrent replies, cooldown, and session duration. `DAILY_BUDGET_USD` defaults to 10 per account per UTC day.
- Reservations are an application guardrail, not a guaranteed billing cap. Provider pricing and usage reporting can differ; also set a spending limit in your Vercel account.

The model catalog uses contemporary small/mid spending tiers from major providers, excluding Grok. See [catalog notes and sources](docs/MODELS.md). These tiers describe price/positioning, not undisclosed parameter counts.

## Persistence and deployment

Rooms and messages persist in PostgreSQL. Supabase Auth issues sessions; RLS limits reads to the owning user. Mutations use authenticated Next.js routes and server-only database credentials. Public database roles cannot call orchestration functions or write tables directly.

For hosted Supabase, provision a project, apply the files in `supabase/migrations`, and replace `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`. Configure that project's Auth site/redirect URLs and email policy. Local CLI v3 operations target local by default; review `--help` before using an explicit hosted target.

This first version is driven by the open room's browser tab: polling schedules bounded server requests. Closing the tab stops new work, but already-started calls may finish. Reopening a running room resumes scheduling within its limits. A hosted service should move scheduling to a durable worker and add abuse protection, rate limiting, billing, and recovery flows before opening public signup. Billing, multi-human rooms, BYOK, and production deployment are outside this version.

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
