# BotsBots
<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
TypeScript, Next.js App Router, pnpm, Vercel AI Gateway, local Supabase via OrbStack Docker. Environment configuration must support hosted Supabase later.

## Users
One human working with multiple AI bots on knowledge, planning, productivity, or recreational exploration. Multi-human rooms are outside the initial scope.

## Product Purpose
Bring different providers' models into a shared conversation, each with a configurable perspective, to make constructive progress on a human-defined topic.

## Capabilities and Constraints
Tunable moderated rounds and free-for-all. Atomic locking prevents overlapping bot turns and overspending under concurrent requests. User chooses models, topic, perspectives, message limits, token limits, concurrency, and budget. Budget-focused models only, excluding Grok. Local email/password auth and persistent room history. No billing or BYOK yet. Gateway key remains server-side. Commit incremental progress.

## Operating Context
A conversation-first workspace with a compact bot and settings panel, explicitly chosen by the user. The human can intervene, pause, stop, and extend limits intentionally.

## Product Principles
- The human stays in control of the conversation.
- Spending and limits are visible and enforced on the server.
- Diverse perspectives should produce constructive progress.
- Defaults should make the first room easy to start.

## Open Decisions
BotsBots is the working name from the repository, not a confirmed permanent brand. Future monetization and deployment are undecided.
