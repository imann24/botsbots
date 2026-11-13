# Archive chats documentation comparison

Mode: Operate. Scope: ordinary local workspace extension, preserving the incumbent
Jet age system in `PRODUCT.md`, `DESIGN.md` and `.impeccable/surfaces/workspace.md`.

## System comparison

The archive controls extend the existing navy room navigation. A quiet Archived
chats entry follows the room list; archive icons use the incumbent inverse colors,
stroked SVG vocabulary and hover treatment. Fine pointers reveal row actions on
hover or focus, while touch keeps them visible and coarse pointers receive (44px)
targets. The archive list retains the sidebar's density and dividers.

Confirmation reuses the contact dialog's paper surface, Manrope heading, DM Sans
copy, restrained corners and fine rules. Red identifies the confirmation action;
Cancel uses the existing secondary button. Native modal behavior contains focus,
starts on Cancel, supports Escape/backdrop dismissal and restores focus on close.
Loading, retry, empty, search and success states remain explicit. There is no new
palette, typography role, shadow, component identity or visual-world decision to
promote into the root design system.

The behavior supports the product's human-control and persistent-history
constraints: archive hides a room from active navigation and global room search,
retains messages and summaries and pauses new bot replies. Already in-flight
replies may finish. Sidebar restore returns to the conversation with generation
paused. Archive/restore preserve activity timestamps and ordering, with stable
ties handled by creation time and room ID.

Comparison outcome: **consistent with the incumbent system**. Root `PRODUCT.md`,
`DESIGN.md` and `.impeccable/design.json` were preserved. Existing sidecar drift
and incumbent CSS size/color advisories were not repaired or adopted as new rules.

## Finish review and evidence

The supplied scoped finish reviewer disposition is **SHIP**, with no material
fixes. Its five valid captures are:

- `desktop-subtle.png`: quiet archive entry and desktop row controls.
- `desktop-modal.png`: desktop archive confirmation.
- `desktop-list.png`: desktop archived-chat list and restoration controls.
- `mobile-modal.png`: mobile archive confirmation.
- `mobile-list.png`: mobile archived-chat list and restoration controls.

All paths are relative to this document. They are local preview review evidence,
not shipping raster assets. This documentation pass compared the incumbent records
and implementation; it did not repeat browser or screenshot review.

Reported validation: 108 unit tests passed, TypeScript checking passed, full local
Supabase integration passed and the production build passed. No Gateway calls
were made. The archive migration was applied locally; database security advisors
reported no issues. The detector and automatic hook found no new non-advisory UI
issues. Global CSS advisories concern the pre-existing sidecar and incumbent
sizes/colors, outside this extension's boundary.

Implementation scope: `src/components/archive-chat-modal.tsx`,
`src/components/workspace.tsx`, `src/app/globals.css`, `src/lib/room-order.ts` and
`supabase/migrations/20261113055134_archive_chats.sql`. Documentation changes are
limited to this record and the archive section of the workspace surface brief.
