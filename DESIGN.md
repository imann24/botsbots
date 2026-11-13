---
name: BotsBots
description: Different minds. Shared momentum.
colors:
  navy: "#122747"
  navy-raised: "#1b3459"
  red: "#c92d36"
  red-hover: "#ad2029"
  paper: "#faf9f6"
  white: "#fff"
  ink: "#182b48"
  muted: "#657084"
  line: "#dddfe4"
  carbon: "#63467d"
  blue: "#e1eaf8"
  night-frame: "#0f2140"
  night-paper: "#10151d"
  night-surface: "#161c26"
  night-ink: "#e3e8f0"
  night-muted: "#99a4b5"
  night-line: "#273141"
  night-select: "#2b4876"
  night-accent: "#c9d6ea"
  night-carbon: "#b9a1d8"
  night-red-text: "#f2777c"
typography:
  display:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "clamp(36px, 3.65vw, 58px)"
    lineHeight: 1.13
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "36px"
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
  button-secondary-night:
    backgroundColor: "{colors.night-surface}"
    textColor: "{colors.night-ink}"
  button-text:
    textColor: "{colors.red}"
    padding: "0"
  button-text-night:
    textColor: "{colors.night-red-text}"
  button-icon:
    size: "34px"
    rounded: "{rounded.compact}"
    padding: "7px"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "12px 14px"
  input-night:
    backgroundColor: "{colors.night-surface}"
    textColor: "{colors.night-ink}"
  navigation:
    backgroundColor: "{colors.navy}"
    padding: "28px 17px 0"
  navigation-night:
    backgroundColor: "{colors.night-frame}"
  usage-popover:
    backgroundColor: "{colors.navy-raised}"
    rounded: "{rounded.field}"
    padding: "14px 14px 12px"
  purpose-chip:
    backgroundColor: "{colors.white}"
    textColor: "{colors.muted}"
    rounded: "{rounded.compact}"
    padding: "9px 11px"
  purpose-chip-selected:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.white}"
  purpose-chip-selected-night:
    backgroundColor: "{colors.night-select}"
    textColor: "{colors.white}"
  setup-shortcut:
    textColor: "{colors.ink}"
    rounded: "{rounded.compact}"
    padding: "4px 6px"
    height: "44px"
  mode-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "12px"
  command-option-selected:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.white}"
    rounded: "{rounded.compact}"
  limit-strip:
    height: "13px"
  turn-number:
    textColor: "{colors.carbon}"
    padding: "1px 5px"
  turn-number-night:
    textColor: "{colors.night-carbon}"
---

# Design System: BotsBots

## Overview

**Creative North Star: "Jet age"**

Jet age gives the workspace a confident navy frame, warm paper reading surface, decisive red controls, and tightly organized information. The reference is expressed through proportion, typography, the stepped brand mark, numbered turns, and finite allowance segments; it does not become a physical ticket or travel interface.

The conversation stays generous while navigation and settings stay compact. Flat surfaces, fine dividers, and small tonal changes establish hierarchy. The same visual language carries into the split authentication screen without adding decorative imagery. A night appearance keeps that hierarchy intact: the navy frame deepens around a blue-black canvas rather than becoming a different interface.

**Key Characteristics:**

- Navy structure, paper reading space, red actions.
- Manrope headings paired with DM Sans interface and conversation text.
- Numbered replies and visible finite allowances.
- Flat surfaces, restrained corners, and short state changes.
- One palette defined twice, day and night, switched as a whole.

This record describes the implemented system in `src/app/globals.css`, `src/components/workspace.tsx`, `src/components/account-usage.tsx`, `src/components/appearance.tsx`, `src/components/auth-form.tsx`, and `src/components/brand.tsx`. The fonts are bundled through Fontsource in `src/app/layout.tsx`. BotsBots remains a working product name. Surface-specific direction lives in `.impeccable/surfaces/workspace.md`.

## Colors

Deep navy structure and warm paper carry the interface; red creates a clear action point, while muted purple marks quantities.

### Primary

- **Signal Red** (`red`): start, submit, and send controls; also attention text where context identifies an error. `red-hover` darkens active controls on hover.
- **Navigation Navy** (`navy`): persistent room navigation, the authentication story panel, selected purpose chips, selected command results, human avatars, and used allowance segments. **Raised Navy** (`navy-raised`) is the one lifted navy surface: the weekly usage popover floating over the room list.

### Secondary

- **Carbon Purple** (`carbon`): numerical limits, budget progress, and reply turn markers.
- **Agent identity hues** (`.agent-0` to `.agent-9`, defined in OKLCH at one shared lightness): each agent in a room owns one hue for its avatar and summary contribution, paired with darker lettering in the same hue. Colors belong to the agent, never the model, and are unique per room: the slot is stored on the bot, new bots take the lowest free slot, and the first six slots are the most widely spaced because a room holds at most six bots. These are identity accents, not interchangeable status signals.

### Neutral

- **Warm Paper** (`paper`): main workspace, composer surround, and dialogs.
- **White** (`white`): settings panel, fields, buttons, composer interior, and command results. It is also the constant text color on navy and red.
- **Navy Ink** (`ink`): primary text; **Slate** (`muted`): supporting text and light-surface placeholders.
- **Fine Rule** (`line`): pane boundaries, rows, and controls.
- **Pale Sky** (`blue`): text selection inside the contact dialog.

**The Action Color Rule.** Use red for primary actions and attention; use carbon purple for measurement and turn markers.

### Night appearance

Light is the default. A dark choice is stored per browser (`botsbots:theme`) and applied by a head script before first paint; there is no system-following mode. Every surface color is a `light-dark()` token in `:root` (`--paper`, `--surface`, `--ink`, `--select-fill`, `--measure-used`, and so on), so components never branch on theme.

The night world maps role for role. **Night Frame** (`night-frame`) deepens the navy sidebar and authentication panel. **Night Paper** (`night-paper`) is the blue-black canvas and **Night Surface** (`night-surface`) the slightly raised panel, field, and button surface. Text becomes **Night Ink** (`night-ink`) and **Night Slate** (`night-muted`) over **Night Rule** (`night-line`). Navy fills that mark selection become **Night Selection** (`night-select`) with white text, while navy text and used allowance segments invert to **Night Accent** (`night-accent`) and a paler measurement blue (#a7bbdc). Red keeps filling primary actions; red text lightens to **Night Signal** (`night-red-text`), with error and warning text at (#f39a9e) and (#e7a46f). Carbon purple becomes **Night Carbon** (`night-carbon`). Agent hues keep their slots and flip lightness: dark tinted squares with pale lettering. Provider marks swap their white disc for a dark chip.

**The Paired Token Rule.** A new surface color is declared once as a `light-dark()` pair in `:root`; no component carries a light-only hex on a light surface. Colors set on the navy frame (pale sidebar text, the usage popover) are already dark-surface colors and stay constant.

**The One Frame Rule.** Switching appearance changes the whole palette in a single frame; transitions are suppressed during the switch so no control fades on its own.

The frontmatter contains reused primitives, not every one-off state tint. Sidecar tonal ramps are generated previews, not additional production tokens.

## Typography

**Display Font:** Manrope Variable, sans-serif.  
**Body Font:** DM Sans Variable, sans-serif.

Manrope brings broad, firm headings; DM Sans keeps dense controls and sustained reading clear. There is no separate branded monospace role; code uses the browser's code-font behavior. Numbered turns, times, and monetary values use tabular figures.

### Hierarchy

- **Display:** the authentication headline, a responsive clamp with tight tracking; on phones it becomes `clamp(29px, 6.7vw, 38px)`.
- **Headline:** the new-room heading, semibold-heavy (750), becoming (28px) on phones. The existing room editor keeps a compact heading scale (`clamp(28px, 4.5dvh, 40px)`).
- **Title:** settings and dialog headings use the compact title token. The authentication form heading uses (32px), reducing to (28px) on phones; the contact dialog heading uses (28px), reducing to (25px).
- **Body:** conversation prose uses the frontmatter body role and a maximum measure of (72ch); mobile prose is (12px). The builder introduction uses (13px) with line height (1.6).
- **Label:** field labels use the frontmatter label role. Dense participant and measurement metadata uses (10–12px); it is supporting information rather than a display treatment.

**The Reading Rhythm Rule.** Keep conversation text at a comfortable line height and bounded measure; compact metadata must remain subordinate.

## Layout

The workspace occupies (100dvh), with independently scrolling conversation, builder, room list, and roster. The default grid is (216px / minmax(0, 1fr) / 310px). At widths of at least (1500px), side columns grow to (240px / 340px), and conversation padding centers an approximately (800px) reading region. At (1180px) and below, columns contract to (190px / flexible / 280px).

At (980px) and below, room setup becomes a right-hand drawer (330px); the left navigation remains a column. At (640px) and below, navigation becomes a left drawer (`min(320px, 86vw)`) that gives its height to the room list (see Navigation), the conversation fills the width, and setup becomes a full-width sheet with a (65px) header matching the conversation header. Explicit buttons open and close drawers. Closed drawers are hidden and inert; active drawers have dialog semantics, focus management, and inert surroundings.

Desktop pane headers align at (78px); mobile conversation headers are (65px), wrapping actions to a second row inside a room. New conversations use two columns on desktop: room navigation and a paper canvas. The setup panel opens as a (380px) drawer, becoming a full-width sheet on phones, without changing the saved panel preference used by existing rooms.

The new-room builder is capped at (780px). The opening topic leads. Three flat setup shortcuts beneath the composer show the bot avatars/count, selected conversation style, and explicit budget/message cap. The lineup opens the roster; each bot's model, name and perspective is a second click away. The limits shortcut opens all eight numeric controls and focuses the first input. The style shortcut opens Conversation details and focuses the selected mode. Conversation details also contains purpose and optional room name; its collapsed summary shows the chosen purpose or title. The existing room editor opens these details by default.

On phones the new-room header stays one (56px) row and Create room remains in a sticky paper footer. Setup shortcuts wrap into two rows at narrow widths, using (44px) targets; below (360px), slightly tighter labels keep the lineup and style together. Short phones omit the supporting paragraph. Expanded details grow the form into its scrolling region, keeping the footer from obscuring the final settings row. Existing rooms retain the three-column desktop workspace and responsive setup drawer.

Authentication uses a (1.15fr / 1fr) split with a (360px) form maximum, becoming a vertical page on mobile with the brand and form above the navy story panel.

Every room-panel section (heading, roster, limits, info, footer) shares one horizontal inset, `--panel-pad`: (24px) by default, (28px) at (1500px) and above, (18px) at (1180px) and below, and (20px) on phones. On tall screens the roster scrolls independently above the pinned allowance section, and expanded limit settings have their own bounded scroll area (`max-height: min(55dvh, max(190px, calc(100dvh - 310px)))`). At (640px) and below, or below (700px) of height, the panel scrolls as one column with a sticky heading instead, so the roster is never reduced to a sliver and rows are not cut off. Read-only perspective text indents to the name column (44px), not under the avatar. On coarse pointers, panel rows and actions are at least (44px) tall and panel fields use (16px) text so iOS does not zoom on focus. Dashed outlines mean "add" (Add a bot); "Edit bots & settings" uses the solid secondary style.

## Elevation & Depth

The workspace is flat. Navy, paper, white, subtle selected fills, and fine borders provide depth, in both appearances. Drawers and dialogs use translucent navy scrims and layering; they do not add a floating-card shadow. The latest-replies control sits above content through positioning and a border.

### Shadow Vocabulary

- **Usage lift** (`box-shadow: 0 14px 32px -10px #040c1ccc, 0 2px 6px #040c1c66`): the weekly usage popover only, which floats upward over the room list inside the navy sidebar. It pairs a raised navy fill and a pale hairline with this shadow so the account footer never moves when usage opens.

**The Flat Surface Rule.** Separate surfaces with color and fine borders. The usage popover is the single sanctioned shadow, and it lives inside the navy frame; paper and white surfaces never carry elevation shadows.

## Shapes

Controls use restrained corners: compact chips and icon buttons, slightly rounder action buttons, and fields follow the frontmatter radius roles. Participant avatars are soft squares; the human account avatar is circular. The composer and dialogs are the broadest recurring rounded frames; the authentication example room uses (12px). Turn markers remain square-edged; allowance segments have only (1px) rounding. The latest-replies button is a deliberate pill exception (20px radius).

The brand is a compact stepped, slanted SVG mark beside a heavy wordmark and red period. Interface icons are stroked SVGs. Do not reinterpret the mark as a detailed illustration.

## Components

### Buttons

Compact, direct, and visibly interactive. Primary controls use red with white text and a minimum height of (46px); secondary controls use the surface color, ink, and a fine border with a minimum height of (42px). Small secondary controls reduce to (33px). Text actions use red text and underline on hover. Icon actions use a transparent square and a subtle hover fill; on mobile they have a minimum target of (36px).

Button color transitions last (150ms). Keyboard focus uses a (3px) blue outline offset by (4px). Disabled buttons keep their form and reduce opacity to (0.45), with a not-allowed cursor. Primary and secondary hover treatments remain distinct.

### Chips

Purpose choices inside Conversation details use compact bordered surface chips with muted text, arranged in a wrapping row. Selection fills a chip navy (night selection after dark) and turns its text white; `aria-pressed` exposes that state. Hover on an unselected chip strengthens its border and text. Chips are controls, not ornamental labels.

Setup shortcuts beneath the topic are flat, borderless (44px) rows of icon plus value with a chevron. Hover adds a pale blue-gray fill and navy text; the limits value is carbon purple with tabular figures.

### Cards / Containers

Mode choices are low, bordered selection cards with restrained corners and descriptive secondary copy. Selection changes the border to navy and the background to a pale blue-gray. Conversation replies and roster entries are divided rows rather than individual floating cards. Roster rows use colored initial avatars, names, model metadata, and collapsible detail controls.

### Inputs / Fields

Surface fields have a fine cool-gray border, ink text, red caret, and visible labels. Placeholders use Slate. Focus uses a (2px) blue outline with a (1px) offset. The sidebar search is a specific inverse treatment with a transparent background and pale placeholder text. Error text and banners combine explicit wording with red tones.

The composer wraps a borderless textarea and a red square send button inside a single surface border; focus changes the outer border. The room builder's topic field uses the same frame, with the muted “Try a starting prompt” action tucked into its foot. The send control retains an accessible name.

### Navigation

The navy sidebar contains a white new-room action, compact search, room rows, and account controls. Room rows use pale text, a subtle translucent hover, and a stronger selected fill. Long titles truncate within their available width. Mobile uses the explicit navigation drawer described in Layout, with Escape dismissal and focus return. On phones the drawer budgets height for rooms: a bordered (44px) search field with (16px) text, an Archived chats link in the rooms heading row, (15px) room titles, a quieter archive icon (full strength on the active room), and a ruled footer. The footer collapses weekly usage to one line plus its bar (remaining, reset and Request higher limits sit inside the disclosure unless usage is in warning or exhausted), and Contact us becomes a labeled mail icon beside Sign out. The room list keeps at least (168px); beyond that the drawer itself scrolls.

The account row ends with the appearance toggle and Sign out. The toggle is an icon action with a stable accessible name, “Dark appearance”, and `aria-pressed`; it shows a moon in light and a sun in dark, with a title naming the switch. Appearance is always one click away: when rooms are collapsed on wider screens, the same toggle appears in the conversation header beside the usage shortcut; on phones it ends the title row of a room header (a 44px target, balancing the menu button) and joins the actions of the single-row new-room header. Below (360px), the new-room header's Room setup control drops to its icon to make room, keeping its accessible name. The command bar mirrors it with “Use dark appearance” or “Use light appearance”.

Conversation titles have a persistent pencil action in the main header. Renaming uses an inline input, a save check and cancel icon with accessible names; Enter saves, Escape cancels, and focus returns to the pencil. The field uses (16px) text and icon targets grow to (44px) on coarse pointers. Save failures stay beside the retained draft with explicit error text. Renaming is available in every room state and leaves bot orchestration unchanged. Blank new-room names receive a saved adjective–noun name such as `cosmic-capybara` on creation.

### Command bar and dialogs

The command bar, contact form, and archive confirmation are native modal dialogs on paper with a fine rule and the composer's broad radius, over a translucent navy scrim. Command results sit on the surface color; the selected result fills navy (night selection after dark) with white text. Dialog headings use Manrope, controls use DM Sans, and the only motion is a short (180ms) settling arrival.

### Weekly usage meter

The sidebar's account meter uses the inverse text colors with a pale lavender (#c9b4e3) progress fill for contrast against navy. Warning text uses apricot (#ffd2bb), and exhausted usage uses pale red (#ffc4c8). Explicit text accompanies each state. Its 10–13px type matches adjacent account metadata, increasing to 12px body text on mobile. A “Weekly usage” disclosure heads an explicit used-of-limit amount, a 3px bar, and the remaining allowance and reset date.

Opening the disclosure floats the breakdown upward over the room list as the usage popover (raised navy, pale hairline, usage lift), so Contact us and the account row stay fixed. It holds plan status and a two-part accounting breakdown: recorded cost plus reserved cost, followed by a ruled total used. Reserved cost groups requests in progress and requests that ended without a confirmed cost, with a shared explanation of how reservations count toward usage and why unconfirmed costs remain reserved. Empty reservation rows are omitted. The popover scrolls within `min(420px, max(160px, 100dvh − 300px))`, arrives with a (160ms) fade and (6px) rise, and closes on Escape (returning focus to the summary) or an outside click. The main-pane allowance notice uses the paired alert tokens (warm pale red by day, dark red-brown by night). Unlimited plans have no progress bar. On mobile, header actions occupy a second row so the usage shortcut does not crowd out room controls.

### Numbered conversation and finite allowances

Bot replies carry a stable padded turn number in a thin rectangular carbon-purple marker. Failed and interrupted replies remain visible with explanatory text. Message rows arrive with a short (350ms) clipped reveal and a (5px) upward settling motion. Thinking dots use a staggered (1s) color animation. Reduced-motion preferences remove animations and transitions.

The message allowance is a segmented strip (13px high, 3px gaps), pale when unused and navy when consumed (pale measurement blue on dark). It renders up to (40) segments: above that message limit, segments represent proportional usage rather than one message each. Always keep the explicit used/total text. Accounted budget is a separate thin purple progress bar with visible monetary values and a programmatic label. These patterns express finite room limits without suggesting billing or a payment balance.

### Model provider marks

Model names carry a (20px) circular provider mark with a fine rule and a (12px) logo, separated from the label by (5px): a white disc with a navy logo by day, a dark chip with a pale logo by night. Use the shared `ModelLabel` and `ModelSelect` components across the roster, replies, summaries, and model fields. Provider marks identify the model vendor; the colored avatars continue to identify individual bots. Selects retain native keyboard and touch behavior, with the current provider mark inset beside the selected text. SVG assets are bundled in `public/providers` with their source license. Unknown providers use a neutral processor icon.

## Do's and Don'ts

### Do:

- **Do** use the navy frame, paper canvas, and surface controls as the default hierarchy, by day and by night.
- **Do** declare every new surface color as a `light-dark()` pair and check both appearances at 4.5:1 for text.
- **Do** keep allowance counts, budget, and turn numbers visually distinct from conversation prose.
- **Do** carry visible focus, selected states, disabled states, and reduced-motion behavior into new controls.
- **Do** switch compact screens to explicit drawers and preserve independently scrollable content.

### Don't:

- **Don't** turn the Jet age reference into fake travel controls or a physical ticket costume.
- **Don't** replace the established flat hierarchy with floating shadow cards; the usage popover is the only lifted surface.
- **Don't** hardcode a light-only color on a paper or white surface.
- **Don't** use red for routine measurement or carbon purple for the primary action.
- **Don't** squeeze all three workspace columns into a narrow screen.
