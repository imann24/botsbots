---
version: 1
slug: "src-components-auth-form-tsx"
primary_target: "src/components/auth-form.tsx"
related_targets: ["src/app/globals.css","src/lib/models.ts"]
---

# Authentication
Mode: Operate. Route: / when signed out. Targets: auth-form.tsx and auth styles.

## Direction contract
THESIS: Make multi-model conversation immediately tangible while keeping account access the primary task. Replace abstract persona copy with real provider marks and catalog-backed models.
OWN-WORLD: Inherit Jet age: navy product panel, warm paper form, red action, Manrope and DM Sans, fine rules and flat surfaces. The user confirmed this direction.
STORY: See that different AI models share one room, sign in or create an account, then start a conversation. Curated models use the platform catalog as their source of truth. Preview replies are explicitly illustrative.
FIRST VIEWPORT: Desktop has a broad navy left panel with brand, a two-line product headline, and a compact three-model example conversation plus three more featured models. A quiet paper right panel centers the form. Phones place brand and form before the product preview; all content reflows without horizontal scrolling.
FORM: Code-led scoped redesign inside the established system; no new identity or concept seed. Signature: real provider marks turn the preview into a recognizable AI lineup. No continuous animation or simulated controls.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Constraints
Preserve email/password authentication, confirmation, validation and errors. No pricing or unsupported capability claims. Keep concise copy, visible labels, keyboard focus and 16px mobile fields. Featured selections live in catalog metadata; names and provider details are never duplicated in the auth component.

## Completion evidence

Disposition: **ship**. The [finish review](../review/auth/finish-review.md) records no material fixes; [implementation documentation](../review/auth/documentation.md) compares the shipped auth surface with the incumbent Jet age system and records local layout/type details, catalog ownership, asset provenance, and preserved global drift.

Review evidence: [desktop login](../review/auth/desktop-login.jpg), [desktop signup](../review/auth/desktop-signup.jpg), [mobile login](../review/auth/mobile-login.jpg), and [mobile signup](../review/auth/mobile-signup.jpg). These JPEGs document the review and are not shipping raster assets. The interface reuses existing licensed provider SVGs through `ProviderIcon`; no new raster artwork was commissioned.

The preview and extra models derive from `MODEL_CHOICES` metadata (`featured.order` and optional `featured.preview`), with the model count derived from the live catalog array. Parent verification reports 66 passing tests, passing typecheck/build, both modes checked at 320/390/768/1024/1440px, and passing confirmation, mode toggle, loading, mocked error recovery, and keyboard checks.

The existing global `DESIGN.md` and stale `.impeccable/design.json` are intentionally preserved for this scoped extension. Auth-specific changes are documented locally; no new global identity or visual-system replacement occurred.
