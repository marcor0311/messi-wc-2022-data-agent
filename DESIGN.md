---
name: Messi / Mundial 2022
description: Photographic Argentina narrative entry and Spanish World Cup final analysis workspace.
colors:
  paper: "#f5f5f0"
  surface: "#fff"
  ink: "#202d29"
  muted: "#66716b"
  line: "#dedfd7"
  accent: "#275c47"
  accent-hover: "#1c4836"
  pitch: "#244c3d"
  pitch-line: "#91aa98"
  player-one: "#98deee"
  player-two: "#f3ce7b"
  danger: "#873a2e"
  focus: "#27715a"
  memory-ink: "#0b203b"
  memory-blue: "#b8e4ed"
  memory-paper: "#f2eee3"
  memory-muted: "#c2cfdc"
  memory-line: "#ffffff35"
typography:
  display:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "2rem"
    fontWeight: 550
    lineHeight: 1.25
    letterSpacing: "-.03em"
  headline:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1.75rem"
    fontWeight: 550
    lineHeight: 1.25
    letterSpacing: "-.03em"
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1.0625rem"
    fontWeight: 600
    letterSpacing: "-.02em"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
  mono:
    fontFamily: "ui-monospace, monospace"
    fontSize: "0.875rem"
    lineHeight: 1.6
  memory-display:
    fontFamily: '"Barlow Condensed", sans-serif'
    fontSize: "clamp(4.2rem, 9.6vw, 9rem)"
    fontWeight: 700
    lineHeight: 0.92
    letterSpacing: "-.02em"
  memory-headline:
    fontFamily: '"Barlow Condensed", sans-serif'
    fontSize: "clamp(2.3rem, 4vw, 4.2rem)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-.02em"
  memory-body:
    fontFamily: '"Manrope", sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  memory-label:
    fontFamily: '"Manrope", sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
  memory-date:
    fontFamily: '"Manrope", sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  chip: "4px"
  control: "5px"
  pitch: "6px"
  composer: "8px"
  memory-square: "0"
  memory-circle: "50%"
spacing:
  compact: "8px"
  control: "12px"
  group: "16px"
  inset: "20px"
  section: "24px"
  conversation: "26px"
  header: "32px"
  memory-gutter: "5%"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    width: "34px"
    height: "34px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "8px 0"
  button-prompt:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "14px"
    width: "100%"
  button-result:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px"
    width: "100%"
  composer:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.composer}"
    padding: "12px"
  filter-chip:
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "3px 9px"
  pitch:
    backgroundColor: "{colors.pitch}"
    rounded: "{rounded.pitch}"
    padding: "17px 15px 10px"
  memory-enter:
    backgroundColor: "{colors.memory-blue}"
    textColor: "{colors.memory-ink}"
    rounded: "{rounded.memory-square}"
    padding: "12px 18px"
  memory-enter-hover:
    backgroundColor: "{colors.memory-paper}"
  memory-start-circle:
    backgroundColor: "transparent"
    textColor: "{colors.memory-paper}"
    rounded: "{rounded.memory-circle}"
    width: "44px"
    height: "44px"
  memory-timeline-link:
    textColor: "{colors.memory-muted}"
    height: "44px"
  memory-timeline-link-current:
    textColor: "{colors.memory-blue}"
---

# Design System: Messi / Mundial 2022

## Overview

**Creative North Star: "El juego en contexto"**

The implemented workspace uses a sober Spanish analytical voice, light neutral surfaces, forest-green pitches, and restrained system typography. “El juego en contexto” is a descriptive working label drawn from the header copy, not a confirmed brand metaphor. The definitive audience and broader brand preferences remain undecided in PRODUCT.md; the museum entry now has its own approved photographic reference.

Flat borders and typographic hierarchy organize the conversation and its evidence. Color identifies actions and players; the pitches provide the strongest visual field. These decisions describe the current implementation and are the baseline for extending it.

The `/` entry, “La memoria albiceleste”, follows the user-approved `playbook-memoria.html` gallery, including all fifteen existing chapter photographs and the final analysis card. It pairs midnight blue, pale Argentine blue, warm white type, and locally hosted Barlow Condensed Bold / Manrope. A vertical cover precedes a pinned photographic gallery with shared perspective and stable frontal captions. Desktop is the only required product target; narrow layouts preserve accessible reading as a fallback. This route-specific expression leads to `/analisis`, which retains the incumbent system above; the broader project identity remains open.

**Key Characteristics:**

- Light neutral workspace with flat dividers.
- System typography and compact analytical labels.
- Forest-green full pitches with cyan and gold player markers.
- Visible context, recoverable results, and inspectable event evidence.
- Route-scoped photographic museum with condensed upright headlines, a perspective gallery driven by native scroll, and direct access to analysis.

## Colors

The palette combines warm neutral surfaces with green controls and pitches; cyan and gold identify the compared players. The frontmatter preserves the source CSS custom-property names and values.

### Primary

- **Forest accent** (`accent`): send action, links, analysis labels, and contextual actions. `accent-hover` deepens interactive emphasis.
- **Focus green** (`focus`): visible keyboard outlines.

### Secondary

- **Pitch forest** (`pitch`): full SVG field backgrounds and hollow shot interiors. **Pitch line sage** (`pitch-line`) draws field geometry.
- **Player cyan** (`player-one`) and **Player gold** (`player-two`): pitch markers and caption dots. The table uses darker related dots for contrast on the light background.

### Tertiary

- **Error rust** (`danger`): recovery notices, on a pale warm error surface.

### Neutral

- **Warm paper** (`paper`): visual workspace and quiet action surfaces.
- **White surface** (`surface`): header, conversation, composer.
- **Deep green ink** (`ink`): primary text.
- **Muted gray-green** (`muted`): context, labels, helper copy, evidence.
- **Soft neutral line** (`line`): panel, table, and section dividers.

### Museum entry (`/`)

`memory-*` tokens apply only to the museum. Midnight ink supplies the continuous canvas; pale blue marks headline emphasis, dates, the current chapter, focus, and the main analysis link. Warm white is reading text and the analysis link’s hover surface. Muted blue-gray supports copy and navigation; the transparent white line divides scores, timeline, and controls. The cover uses directional blue gradients; gallery captions sit directly on the midnight canvas without local text backplates.

**The Route Scope Rule.** Keep museum colors and typography within `/`; retain the incumbent green analytical workspace at `/analisis`.

## Typography

For `/analisis`, use the system sans-serif stack in the frontmatter; event identifiers use the separate monospace role. That route has no external font dependency or promotional display face. The hierarchy uses observed sizes rather than a regular ratio.

- **Display:** empty-state heading; reduced to (1.625rem) in the narrow layout.
- **Headline:** active visualization title; reduced to (1.5625rem) in the narrow layout.
- **Title:** conversation heading. Detail headings use (0.9375rem), medium weight (550).
- **Body:** scalable base reading style. User messages use medium weight (550); analysis copy, reading paragraphs, and the composer keep the body size with generous leading.
- **Label:** supporting controls, captions, context, and evidence use the label role as the minimum HTML text size, with regular weight and sentence case.
- **Mono:** event identifiers and provenance hashes. Long identifiers wrap instead of widening the workspace.

Table numbers use tabular figures. Evidence paragraphs have a readable maximum width (70ch).

### Museum entry (`/`)

Barlow Condensed Bold is the locally hosted display face (TTF, weight 700); Manrope is the locally hosted interface and reading face (WOFF2, weights 300–700). Both use sans-serif fallbacks. All museum type is upright, with no letter shadows. The uppercase cover uses the `memory-display` ramp with leading (.92); its narrow layout uses `clamp(4rem,16vw,6.4rem)`. Chapter headlines use the `memory-headline` ramp with leading (1.02), changing to `clamp(2.3rem,8vw,3.6rem)` at (760px) and `clamp(2rem,7.2vw,3rem)` in the narrow enhanced gallery. Blue supplies headline emphasis on the cover. Narrative copy uses the `memory-body` role; the narrow enhanced gallery reduces leading to (1.5). Dates, scores, index links, and controls use the (.875rem) supporting role. Results use tabular numerals. Reading mode lets headings wrap and raises cover leading to (1.1). The frontmatter records the desktop hierarchy; these responsive overrides are part of the same route-specific system.

### Typography accessibility (both routes)

All live HTML type uses scalable `rem` sizes. Reading copy and input text use the body role; auxiliary and control text never falls below the label role. Preserve upright text and headings without final periods. Contrast must remain at least (4.5:1) for normal text and (3:1) for large text under WCAG 2.2 AA. A font family alone does not establish accessibility; the rendered size, weight, color, spacing, and surrounding layout determine the result.

The typography checks cover WCAG 2.2 AA contrast (1.4.3), text resizing (1.4.4), reflow (1.4.10), and text spacing (1.4.12). They exercise every museum section and populated analysis, doubled default text size, custom line/letter/word/paragraph spacing, and both routes at (320 CSS px). This describes the tested typography criteria, not whole-site WCAG certification or certified fonts.

**The Scalable Reading Rule.** Preserve readable text and access to every action when default text size doubles or user spacing expands. Let content reflow instead of clipping text to preserve a composition.

## Layout

The `/analisis` desktop shell fills the viewport (100dvh), with a minimum height (560px) and a header (76px). The workspace uses a conversation column ranging from (320px) to (390px) and a flexible analysis column. Conversation and analysis scroll independently. Header insets are (32px); the conversation uses (26px) horizontal message insets; the visual panel uses fluid horizontal insets (`clamp(24px, 3vw, 56px)`).

Comparison uses two equal-width full pitches with a gap (18px), the same SVG viewBox, and the same rendering constraints. At widths up to (1050px), the conversation is (330px) and the comparison pitches stack, each capped at (240px) high. At widths up to (720px), conversation precedes analysis in a single document flow; message history is bounded (130–380px), visual insets are (20px), the composer retains the body text size, and comparison pitch height is uncapped. At widths from (1700px), the conversation is (430px), visual insets are (70px), and pitches cap at (430px) rather than the default (340px).

The analytical header wraps and its text actions allow long labels. Captions and heading groups can wrap, event controls break long text, and the summary table scrolls horizontally within its own region when needed. Spacing is compact within controls and increases between analytical groups. Filter rows and legends wrap. The desktop left/right relationship follows the user's brief. Equal comparison scale and the responsive expression above describe the current implementation.

### Museum entry (`/`)

Desktop is the only required gallery delivery target. Narrow layout behavior is a reading and reflow fallback. The cover is outside the pinned stage and scrolls vertically out of view. It fills (100svh), with a minimum height (680px; 650px at widths up to 760px). The title sits lower left; brand, full chapter index, and analysis access frame the top. Shared gutters are (5%), changing to (6%) at (760px).

Only the gallery pins. Its shared perspective is (1200px), with origin (50% 41%); the narrow version uses (900px) and (50% 31%). Centered photographs are (53vw) wide, or (76vw) at (760px). Each caption occupies a stable frontal plane below the photographs: a two-column grid (1.15fr / 1fr, gap 48px) between (12%) insets and (108px) from the bottom. Narrow captions stack between (8%) insets, (152px) from the bottom. The largest caption height is measured once per ScrollTrigger refresh, reserving space for one common photo frame throughout the journey. Captions never move or rotate with their photographs.

The timeline shows five contextual chapter links around the current position, followed by a (1 / 16) position counter and previous/next controls. The upper-right disclosure provides the complete index, including the cover and final card. The header becomes fixed only when the gallery enhancement is enabled; in reading mode it joins document flow. Analysis remains accessible from the header, Qatar caption, and final card.

The current `.is-coverflow` composition follows the enlarged photo and caption proportions approved on 9 November 2026. Photographs are (62vw) wide and up to (60svh) high, with height bounded by the space reserved for captions, controls and bottom margin. The Loopem perspective geometry scales from the rendered photo width; step (100), spread (80), depth (86) and perspective (900) share a width/220 scale. Neighboring photos remain opaque and visible at the edges. Image `sizes` matches the larger frame (62vw).

The caption refinement of 11 November 2026 follows the user's corrected direction: the year itself grows to end at the narrative's last line; the title and narrative retain their natural grouping; the scoreboard moves down to use the remaining space. The band and its divider use (5%) side insets, a height of `clamp(19rem,38svh,27rem)`, and (32px)/(24px) top/bottom padding. The columns use `minmax(0,1.24fr) minmax(0,1.4fr) minmax(0,1fr)`, with `clamp(24px,2vw,36px)` gaps, preserving the former year/title/score widths while allowing the year height to change independently. Photographs retain their existing geometry.

The year is a live Barlow Condensed SVG text treatment fitted to the visible numeral outlines. Canvas text metrics define its ink bounds; its height follows the actual heading-plus-narrative height through a ResizeObserver and after local fonts load. The original HTML year remains available to assistive technology and returns as ordinary text in reading/no-JavaScript mode. This avoids using the font's extra line-box space as an alignment reference. The year has no added day/month footer. A resized or enlarged reading layout clears the enhancement's year height.

Chapter headings retain `clamp(3rem,4.55vw,6rem)` and narratives stay (16px) below them, using `clamp(1.125rem,1.25vw,1.375rem)`. Location remains aligned with the top of the year and heading. The score column stretches across the caption content area with `auto minmax(0,1fr) auto` rows and (16px) gaps. Its scoreboard aligns at the bottom of the flexible middle row; competition, penalties and any dismissal sit at the bottom, (24px) from the viewport edge. Result size remains `clamp(6rem,8vw,9rem)`, with (12px) board gaps and (14px) numeral gaps. The correction intentionally does not spread the narrative away from its heading or force three equal-width columns.

The opening chapter includes the senior debut: Argentina 2–1 Hungary, Budapest, 17 August 2005, with an accessible red-card SVG and “Messi 64′” beside the competition. The result, city and dismissal minute follow the [AFA match summary](https://www.afa.com.ar/es122/posts/hace-18-anos-debutaba-leo-messi-en-la-seleccion-argentina); its subtitle explains the immediate dismissal. All fifteen chapters have a scoreboard.

The user requested removing the gallery previous/next buttons on 11 November 2026. Their markup, CSS and event handlers are removed. The shared caption inset is reduced from (64px) to (32px), raising year, heading and location together by (32px) while retaining the divider and photographic geometry. The gallery remains focusable with its accessible label and keyboard shortcut metadata; Loopem supplies the enhanced listbox role. Arrow keys, Home/End, PageUp/PageDown, wheel, drag, direct chapter URLs and browser history remain available.

Caption refinement verification: all fifteen captions fit without text overflow or photo overlap at (1440×800), (1440×1000) and (1920×1080). All 45 measured states align year/title/location at the top, match the year bottom to the narrative bottom within one CSS pixel, and place the competition row at the caption's lower inset. Chromium captures are in `artifacts/landing-review/year-fit-*.png`. All 12 selected desktop gallery and typography tests pass, including the new year/narrative and lower-score alignment assertions, navigation, reduced motion, no JavaScript, image failure and 200% text enlargement. The optional Playwright WebKit browser is not installed, so no WebKit validation is claimed.

The server-rendered baseline is the full intrinsic vertical document: centered photographs (90%, capped at 1200px; 92% on narrow screens), reading copy beneath, and ordinary chapter anchors. GSAP enhances it only with no reduced-motion preference and sufficient reading space. Intrinsic reading mode applies below (360px) width or (740px) height, above (20px) root text size, or when heading line-height exceeds (1.35) or letter-spacing exceeds (.08em). It removes the pin, exposes every chapter, and allows copy and header actions to reflow. Resize and preference changes can re-enable the gallery. Without JavaScript or if the enhancement fails, all chapters remain readable vertically.

The final caption direction on 11 November 2026 prioritizes a stable composition between chapters. The user rejected changing the year's dimensions to fit each narrative. The year returns to ordinary HTML at `clamp(9rem,15.5vw,19rem)`, with lining tabular numerals. There is no SVG fitting, glyph deformation, per-chapter scaling or JavaScript text measurement.

One shared CSS grid in `.museum-world` reserves the largest content requirements of all fifteen chapters, including the invisible ones. Each overlapping caption uses `subgrid` in both dimensions, and its narrative and score use the same three row tracks. A chapter change affects visibility and accessibility state only. Year, title and location occupy the same upper positions; subtitle and competition start in a shared footer track. Short content leaves its reserved space available rather than moving other elements. This supersedes forcing the visible year to end at every subtitle's last line. The (5%) side insets, equal (24px) vertical padding and photograph geometry remain in place.

Scoreboard numerals retain a constant font and tabular widths. Team slots stretch to a common row height; the opponent slot receives slightly more width and (6px) board gaps so that “Serbia y Montenegro” wraps between words at the supported desktop sizes. The footer always reserves a (7rem) slot for penalties or a dismissal, including when neither is present. These shared tracks adapt to the viewport and to font loading, not to the active chapter. This implementation follows [CSS Grid Level 2 subgrids](https://www.w3.org/TR/css-grid-2/#subgrids) and [tabular numeric typography](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-variant-numeric).

Verification covers all fifteen captions at (1440×800), (1440×1000) and (1920×1080). The regression compares every main text and score slot's x/y coordinates, width, height, font size and transform across chapters and requires exact equality. All 45 states retain the same geometry without clipping. The desktop gallery and typography checks also cover navigation, reduced motion, no JavaScript, image failure and 200% text enlargement with custom spacing. Intrinsic reading mode retains natural content flow.

**The Native Narrative Rule.** Keep native document scrolling and chapter anchors usable before hydration. Only the gallery pins; downward scroll drives its reversible horizontal journey without intercepting the wheel.

## Elevation & Depth

The analytical workspace has no box shadows. White and paper surfaces, thin borders, spacing, and the green field background establish hierarchy. Selected historical results use a pale green fill and a stronger green border. Focus uses an outline (2px) with offset (4px); the composer uses a border color change on focus within.

The museum also avoids box shadows and letter shadows. The cover uses photographic light and directional gradients. Its lower fade sits above the lateral shade, progresses from transparent at 58% to solid `memory-ink` at 92%, and keeps the last 8% identical to the gallery canvas to avoid a visible seam. The shorter fade concentrates opacity near the bottom, preserving more of the photograph above. Gallery photographs share a single 3D space: the current photograph is frontal while neighbors recede, rotate slightly, and fade with distance. Captions remain on the front plane against the continuous midnight canvas, without text backplates. Inactive panels are inert and hidden from assistive technology in the enhanced gallery; every panel returns to the reading order in vertical mode.

## Shapes

Controls have gently rounded corners, with compact chips, field containers, and the composer using the distinct radii in the frontmatter. Structural panels remain flat rectangular regions divided by single-pixel borders. Player keys and shot markers are circular. The pitch preserves its full rectangular geometry and (120 × 80) coordinate scale inside the SVG viewBox (`-5 -5 130 90`).

The museum uses square rectangular photographs, outlined controls, and analysis links. The circular start affordance is its recurring curved form; a short blue rule marks the active timeline link. Do not transfer the analytical composer or chip radii to editorial photographs.

## Components

### Buttons

The send action is a compact green square with an inline arrow; its hover uses the deeper accent. Text actions use green type without a filled surface and underline on hover. The suggested prompt is a full-width bordered quiet button. Result recovery uses a similar full-width control with a supporting context line; `aria-pressed` adds pale green selection. Buttons transition background and text color (150ms); disabled buttons have opacity (.5) and a blocked cursor. Reduced-motion preferences remove transitions.

### Composer

A bordered white group contains the textarea and send button, with a gap (8px). The group changes border color on focus within. The textarea has an accessible label and a muted placeholder; the wrapper supplies the visible focus treatment. Enter submits; Shift+Enter inserts a line break. Input text uses the scalable body role at all widths.

### Context chips

Small outlined, minimally rounded labels show the match and penalty scope. These are static context labels, not interactive filters. The shootout exclusion remains supporting text beside them.

### Header and result history

The header combines a compact inline pitch symbol, product name, contextual note, and a text action. No separate navigation component exists within `/analisis`. Conversation turns are separated by borders rather than chat bubbles; result controls recover prior context and visibly mark the active result.

### Pitch

A dark green figure contains a player caption, circular color key, attack direction, and a full SVG field. Goals use filled player-colored markers; other outcomes use hollow markers. Selection adds a white ring, and pointer hover or keyboard focus strengthens the marker stroke. Markers are buttons with keyboard activation and accessible descriptions. Equivalent event-list buttons provide a text route to selection.

### Summary and evidence

The flat table right-aligns tabular numbers, left-aligns player names, and separates rows with thin borders. Event detail follows the summary. Native disclosures expose the event list and provenance; identifiers wrap. These surfaces preserve the existing analytical result while pending or recovery information appears nearby.

### Museum navigation and analysis links

The brand, complete chapter disclosure, and analysis link frame the route. The contextual timeline uses muted text, pale-blue current text, and a short blue rule with `aria-current="location"`; only five links are visible at a time. Previous/next controls disable at the gallery boundaries. The start link pairs a (44px) outlined circular arrow with text. The final analysis link is square and pale-blue filled, with (12px 18px) padding, (48px) minimum height, (1rem) type, and warm-white hover. Museum actions use a blue focus outline (3px, offset 5px). Inline arrows are SVG. The chapter disclosure closes after navigation or Escape; Escape restores focus to its summary. Direct hashes, browser history, and keyboard-activated chapter links map to the same gallery position; keyboard links focus the destination heading.

### Museum scenes and photography

Preserve all fifteen chapter photographs, dates, copy, match results, and penalty distinctions, followed by the final analysis card. The original assets and provenance remain in `public/memoria/sources.json` and `public/memoria/seleccion/selection.json`. An unavailable photograph becomes a labeled blue fallback while its chapter remains readable. Only the cover photo is preloaded; gallery images within two positions of the current chapter become eager as they approach.

GSAP and ScrollTrigger load as an enhancement and scrub one continuous gallery position against native scroll (`ease: none`, `scrub: true`). Only photographs receive x/y/z and rotationY transforms. The desktop step uses x (67% of viewport width), receding z (320px per position, capped at three), y (20px per position, capped at two), and rotationY (20° per position, capped at ±30°); the narrow version uses x (86%), z (230px), and y (8px). Images beyond (2.5) positions are hidden; opacity falls by (.42) per position to a floor (.15). The cover has no GSAP transform. React does not rerender on animation frames. Reduced motion and expanded reading layout restore intrinsic vertical content, anchors, and every panel.

## Do's and Don'ts

### Do:

- **Do** preserve conversation on the left and visual analysis on the right at desktop widths.
- **Do** render both comparison pitches at the same scale, including when stacked.
- **Do** retain visible match and penalty context alongside the active result.
- **Do** pair player colors with names and distinguish goals with filled markers.
- **Do** preserve keyboard access, visible focus, and reduced-motion behavior.

- **Do** keep museum photography, editorial type, and `memory-*` tokens scoped to `/`.
- **Do** preserve photographic subjects, all fifteen chapters, and the existing provenance files.
- **Do** keep direct access to `/analisis` available from the museum header, Qatar scene, and finale.
- **Do** retain native scroll, chapter anchors, visible focus, and the full intrinsic vertical fallback.
- **Do** keep headings free of final periods and all typography upright, using blue for museum emphasis.
- **Do** preserve scalable body and label roles, AA text contrast, and unclipped reading flow under zoom and user text spacing.

### Don't:

- **Don’t** use shadows to separate the existing flat panels.
- **Don’t** crop the pitch or change scale between compared players.
- **Don’t** rely on color alone for player identity or selected events.
- **Don’t** treat the provisional audience or descriptive working label as a confirmed brand preference.

- **Don’t** replace the analytical palette or typography with the museum’s editorial system.
- **Don’t** intercept wheel scrolling or require animation for reading the museum.
- **Don’t** rotate captions, pin the cover, or add text backplates or letter shadows.
