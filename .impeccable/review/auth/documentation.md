# Authentication implementation record

Disposition: **ship**. This is a scoped extension of the confirmed **Jet age** system, not a replacement visual identity. The built source and review captures are the evidence; this record describes auth-specific decisions without promoting them into global rules.

## Comparison with the incumbent

| Incumbent decision | Built authentication expression |
| --- | --- |
| Navy structure, warm paper, decisive red action | Navy product panel, paper account-access panel, red submit action; the shared palette variables remain authoritative. |
| Manrope headings and DM Sans interface text | Manrope product/form headings; DM Sans labels, fields, replies, model names, and supporting copy. |
| Flat surfaces and fine rules | A deeper navy example room, translucent dividers, white fields, and restrained borders; no shadows or decorative raster imagery. |
| Shared provider marks identify vendors | `ProviderIcon` supplies existing licensed SVG marks in neutral circles. The preview enlarges those marks rather than creating a second identity system. |
| Split authentication screen, vertical on phones | Desktop uses a slightly broader product panel; phones explicitly order brand, form, then product preview. |
| Human-controlled multi-model conversations | One labeled example room shows three model perspectives on one question. The form remains the sole primary task. |

`PRODUCT.md` supports the shared-room explanation and configurable perspectives. The example is illustrative, not a live conversation or capability guarantee. No pricing or billing claim is introduced.

## Auth-specific design details

The desktop grid is `minmax(0, 1.15fr) / minmax(0, 1fr)`, with the brand above the story and the form spanning both rows. The story is capped at 600px; the form remains capped at 360px. Desktop story padding scales between 32px and 76px. The preview uses a 12px corner radius and `--navy-deep`; it is a local conversation container, not a new global card primitive.

The product heading uses `clamp(36px, 3.65vw, 58px)`, line height 1.13, and tight tracking. The form title is 32px. Fields use 16px text and a minimum height of 50px; the primary action also has a minimum height of 50px. Shared white field styling, red caret, blue keyboard focus, hover treatment, and disabled opacity are retained. The mode switch has a 44px minimum height.

At 760px and below, the page becomes brand → form → story. The form title becomes 28px and the product title uses `clamp(29px, 6.7vw, 38px)`. The story is capped at 440px, with 24px horizontal page insets. Additional models become a vertical list. Between 761px and 1100px, reply perspectives wrap below their model names, additional model marks sit above their labels, and the compact room heading omits its trailing example label; the preview retains its accessible example-conversation name. These are auth layout decisions, not changes to workspace breakpoints.

## Catalog and asset provenance

`src/lib/models.ts` owns the curated presentation. `FEATURED_MODELS` filters `MODEL_CHOICES` by `featured` metadata and sorts by `featured.order`; `featured.preview` selects the three example replies. The remaining featured entries populate the additional-model list. Names, providers, ordering, illustrative perspectives, and reply text are not duplicated in `auth-form.tsx`. The available-model count derives from `MODEL_CHOICES.length` (14 in the reviewed build).

`src/components/model-identity.tsx` supplies the shared `ProviderIcon`. Existing local SVGs in `public/providers` come from Lobe Icons under the bundled MIT license; `public/providers/README.md` and `LICENSE` retain provenance. No new raster assets were created for the interface. The JPEGs below are review evidence only, not shipping product imagery or generated artwork.

## Completion evidence

- Source checked: `src/components/auth-form.tsx`, auth rules in `src/app/globals.css`, `src/lib/models.ts`, and the shared provider identity component.
- Incumbent checked: `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, and the auth surface direction contract.
- Captures: [desktop login](desktop-login.jpg), [desktop signup](desktop-signup.jpg), [mobile login](mobile-login.jpg), [mobile signup](mobile-signup.jpg). Desktop login and mobile signup were visually sampled for this documentation pass.
- Finish review: [finish-review.md](finish-review.md) records `disposition: ship`, with no material fixes. [detector-summary.json](detector-summary.json) records no non-advisory findings.
- Parent verification reports 66 passing tests (`pnpm test`), passing typecheck and production build, and production responsive checks at 320, 390, 768, 1024, and 1440px in both modes. Password confirmation, mode switching, loading, mocked error recovery, and keyboard behavior passed. This documentation pass did not rerun those checks.

## Preserved drift

The global `DESIGN.md` and `.impeccable/design.json` are preserved. The existing sidecar predates later `DESIGN.md` additions (including provider-mark guidance) and was already reported stale. Global auth measurements also describe the previous split and type sizes; the current local measurements are recorded above. The palette, type families, flat hierarchy, and identity remain consistent. An ordinary scoped auth extension does not authorize an unrelated global documentation reconciliation. No advisory detector finding or local size has been canonized as a new global rule.
