---
name: Botsbots
description: Different minds. Shared momentum.
colors:
  navy: "#122747"
  red: "#c92d36"
  red-hover: "#ad2029"
  paper: "#faf9f6"
  white: "#fff"
  ink: "#182b48"
  muted: "#657084"
  line: "#dddfe4"
  carbon: "#63467d"
  lavender: "#eee8f5"
  green: "#dcebe2"
  orange: "#fae5d9"
  blue: "#e1eaf8"
typography:
  display:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "clamp(38px, 4.2vw, 64px)"
    lineHeight: 1.13
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "clamp(32px, 3.1vw, 47px)"
    fontWeight: 750
    lineHeight: 1.15
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "15px"
    fontWeight: 750
  body:
    fontFamily: "DM Sans Variable, sans-serif"
    fontSize: "13px"
    lineHeight: 1.8
  label:
    fontFamily: "DM Sans Variable, sans-serif"
    fontSize: "13px"
    fontWeight: 600
rounded:
  compact: "5px"
  button: "6px"
  field: "8px"
  avatar: "9px"
  composer: "10px"
spacing:
  icon-gap: "7px"
  control-gap: "9px"
  small: "12px"
  medium: "18px"
  section: "24px"
  large: "30px"
components:
  button-primary:
    backgroundColor: "{colors.red}"
    textColor: "{colors.white}"
    rounded: "{rounded.button}"
    padding: "12px 22px"
  button-primary-hover:
    backgroundColor: "{colors.red-hover}"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "10px 17px"
  button-text:
    textColor: "{colors.red}"
    padding: "0"
  button-icon:
    size: "34px"
    rounded: "{rounded.compact}"
    padding: "7px"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "12px 14px"
  navigation:
    backgroundColor: "{colors.navy}"
    padding: "28px 17px 0"
  purpose-chip:
    backgroundColor: "{colors.white}"
    textColor: "{colors.muted}"
    rounded: "{rounded.compact}"
    padding: "9px 11px"
  purpose-chip-selected:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.white}"
  mode-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "17px 14px"
  limit-strip:
    height: "13px"
  turn-number:
    textColor: "{colors.carbon}"
    padding: "1px 5px"
---

# Design System: Botsbots

## Overview

**Creative North Star: "Jet age"**

Jet age gives the workspace a confident navy frame, warm paper reading surface, decisive red controls, and tightly organized information. The reference is expressed through proportion, typography, the stepped brand mark, numbered turns, and finite allowance segments; it does not become a physical ticket or travel interface.

The conversation stays generous while navigation and settings stay compact. Flat surfaces, fine dividers, and small tonal changes establish hierarchy. The same visual language carries into the split authentication screen without adding decorative imagery.

**Key Characteristics:**
- Navy structure, paper reading space, red actions.
- Manrope headings paired with DM Sans interface and conversation text.
- Numbered replies and visible finite allowances.
- Flat surfaces, restrained corners, and short state changes.

This record describes the implemented system in `src/app/globals.css`, `src/components/workspace.tsx`, `src/components/auth-form.tsx`, and `src/components/brand.tsx`. The fonts are bundled through Fontsource in `src/app/layout.tsx`. Botsbots remains a working product name. Surface-specific direction lives in `.impeccable/surfaces/workspace.md`.

## Colors

Deep navy structure and warm paper carry the interface; red creates a clear action point, while muted purple marks quantities.

### Primary
- **Signal Red** (`red`): start, submit, and send controls; also attention text where context identifies an error. `red-hover` darkens active controls on hover.
- **Navigation Navy** (`navy`): persistent room navigation, selected purpose chips, human avatars, and used allowance segments.

### Secondary
- **Carbon Purple** (`carbon`): numerical limits, budget progress, and reply turn markers. **Lavender** (`lavender`) supports the purple participant identity.
- **Sage**, **Apricot**, and **Powder Blue** (`green`, `orange`, `blue`): participant avatar backgrounds, paired with darker identity-specific lettering. These are identity accents, not interchangeable status signals.

### Neutral
- **Warm Paper** (`paper`): main workspace and composer surround.
- **White** (`white`): settings panel, fields, buttons, and composer interior.
- **Navy Ink** (`ink`): primary text; **Slate** (`muted`): supporting text and light-surface placeholders.
- **Fine Rule** (`line`): pane boundaries, rows, and controls.

**The Action Color Rule.** Use red for primary actions and attention; use carbon purple for measurement and turn markers.

The frontmatter contains reused primitives, not every one-off state tint. Sidecar tonal ramps are generated previews, not additional production tokens.

## Typography

**Display Font:** Manrope Variable, sans-serif.  
**Body Font:** DM Sans Variable, sans-serif.

Manrope brings broad, firm headings; DM Sans keeps dense controls and sustained reading clear. There is no separate branded monospace role; code uses the browser's code-font behavior. Numbered turns, times, and monetary values use tabular figures.

### Hierarchy
- **Display:** authentication headline; responsive clamp and tight tracking are recorded in frontmatter. It becomes (44px) at the medium breakpoint and (36px) on mobile.
- **Headline:** room-builder heading, semibold-heavy (750), becoming (36px) on mobile.
- **Title:** settings headings use the compact title token; authentication form headings use (28px), reducing to (25px) on mobile.
- **Body:** conversation prose uses the frontmatter body role and a maximum measure of (72ch); mobile prose is (12px). Builder introduction uses (14px) and line height (1.75).
- **Label:** field labels use the frontmatter label role. Dense participant and measurement metadata uses (10–12px); it is supporting information rather than a display treatment.

**The Reading Rhythm Rule.** Keep conversation text at a comfortable line height and bounded measure; compact metadata must remain subordinate.

## Layout

The workspace occupies (100dvh), with independently scrolling conversation, builder, room list, and roster. The default grid is (216px / minmax(0, 1fr) / 310px). At widths of at least (1500px), side columns grow to (240px / 340px), and conversation padding centers an approximately (800px) reading region. At (1180px) and below, columns contract to (190px / flexible / 280px).

At (980px) and below, room setup becomes a right-hand drawer (330px); the left navigation remains a column. At (640px) and below, navigation becomes a left drawer (250px), the conversation fills the width, and setup becomes a full-width sheet with a (65px) header matching the conversation header. Explicit buttons open and close drawers. Closed drawers are hidden and inert; active drawers have dialog semantics, focus management, and inert surroundings.

Desktop pane headers align at (78px); mobile conversation headers are (65px). The builder is capped at (770px) with broad internal padding; purpose chips wrap, and mode choices switch between one and two columns according to available space. Authentication uses a (1.08fr / 1fr) split with a (360px) form maximum, becoming a vertical page on mobile.

Every room-panel section (heading, roster, limits, info, footer) shares one horizontal inset, `--panel-pad`: (24px) by default, (28px) at (1500px) and above, (18px) at (1180px) and below, and (20px) on phones. On tall screens the roster scrolls independently above the pinned allowance section, and expanded limit settings have their own bounded scroll area (`max-height: min(55dvh, max(190px, calc(100dvh - 310px)))`). At (640px) and below, or below (700px) of height, the panel scrolls as one column with a sticky heading instead, so the roster is never reduced to a sliver and rows are not cut off. Read-only perspective text indents to the name column (44px), not under the avatar. On coarse pointers, panel rows and actions are at least (44px) tall and panel fields use (16px) text so iOS does not zoom on focus. Dashed outlines mean "add" (Add a bot); "Edit bots & settings" uses the solid secondary style.

## Elevation & Depth

There are no box shadows in the implemented system. Navy, paper, white, subtle selected fills, and fine borders provide depth. Drawers use translucent navy backdrops and layering; they do not add a floating-card shadow. The latest-replies control sits above content through positioning and a border.

**The Flat Surface Rule.** Separate surfaces with color and fine borders; do not add elevation shadows to the established workspace.

## Shapes

Controls use restrained corners: compact chips and icon buttons, slightly rounder action buttons, and fields follow the frontmatter radius roles. Participant avatars are soft squares; the human account avatar is circular. The composer is the broadest recurring rounded field. Turn markers remain square-edged; allowance segments have only (1px) rounding. The latest-replies button is a deliberate pill exception (20px radius).

The brand is a compact stepped, slanted SVG mark beside a heavy lowercase wordmark and red period. Interface icons are stroked SVGs. Do not reinterpret the mark as a detailed illustration.

## Components

### Buttons

Compact, direct, and visibly interactive. Primary controls use red with white text and a minimum height of (46px); secondary controls use white, ink, and a fine border with a minimum height of (42px). Small secondary controls reduce to (33px). Text actions use red and underline on hover. Icon actions use a transparent square and a subtle hover fill; on mobile they have a minimum target of (36px).

Button color transitions last (150ms). Keyboard focus uses a (3px) blue outline offset by (4px). Disabled buttons keep their form and reduce opacity to (0.45), with a not-allowed cursor. Primary and secondary hover treatments remain distinct.

### Chips

Purpose choices use compact bordered white chips with muted text, arranged in a wrapping row. Selection fills a chip navy and turns its text white; `aria-pressed` exposes that state. Hover on an unselected chip strengthens its border and text. Chips are controls, not ornamental labels.

### Cards / Containers

Mode choices are low, bordered selection cards with restrained corners and descriptive secondary copy. Selection changes the border to navy and the background to a pale blue-gray. Conversation replies and roster entries are divided rows rather than individual floating cards. Roster rows use colored initial avatars, names, model metadata, and collapsible detail controls.

### Inputs / Fields

White fields have a fine cool-gray border, ink text, red caret, and visible labels. Light-surface placeholders use Slate. Focus uses a (2px) blue outline with a (1px) offset. The sidebar search is a specific inverse treatment with a transparent background and pale placeholder text. Error text and banners combine explicit wording with red tones.

The composer wraps a borderless textarea and a red square send button inside a single white border; focus changes the outer border. Its textarea is non-resizable and limited to (180px) in height. The send control retains an accessible name.

### Navigation

The navy sidebar contains a white new-room action, compact search, room rows, and account controls. Room rows use pale text, a subtle translucent hover, and a stronger selected fill. Long titles truncate within their available width. Mobile uses the explicit navigation drawer described in Layout, with Escape dismissal and focus return.

### Numbered conversation and finite allowances

Bot replies carry a stable padded turn number in a thin rectangular carbon-purple marker. Failed and interrupted replies remain visible with explanatory text. Message rows arrive with a short (350ms) clipped reveal and a (5px) upward settling motion. Thinking dots use a staggered (1s) color animation. Reduced-motion preferences remove animations and transitions.

The message allowance is a segmented strip (13px high, 3px gaps), pale when unused and navy when consumed. It renders up to (40) segments: above that message limit, segments represent proportional usage rather than one message each. Always keep the explicit used/total text. Accounted budget is a separate thin purple progress bar with visible monetary values and a programmatic label. These patterns express finite room limits without suggesting billing or a payment balance.

## Do's and Don'ts

### Do:
- **Do** use the navy frame, paper canvas, and white controls as the default surface hierarchy.
- **Do** keep allowance counts, budget, and turn numbers visually distinct from conversation prose.
- **Do** carry visible focus, selected states, disabled states, and reduced-motion behavior into new controls.
- **Do** switch compact screens to explicit drawers and preserve independently scrollable content.

### Don't:
- **Don't** turn the Jet age reference into fake travel controls or a physical ticket costume.
- **Don't** replace the established flat hierarchy with floating shadow cards.
- **Don't** use red for routine measurement or carbon purple for the primary action.
- **Don't** squeeze all three workspace columns into a narrow screen.
