# Foundations

See `colour.png` and `type-and-space.png`.

## The idea
A Google Slides "Simple" theme applied to a football notebook.

Non-negotiables:
- The border is the primary separator. Shadow means "this floats" — dialogs and toasts only.
- No gradients, no photography, no illustration, no texture, no pattern, no frosted glass, no emoji.
- Never hard-code a hex in product code. Always a semantic token.

---

## Colour

### Neutral ramp (base tokens — never change across themes)
| Token | Hex |
| --- | --- |
| `--gray-0` | `#ffffff` |
| `--gray-1` | `#f8f8f8` |
| `--gray-2` | `#eeeeee` |
| `--gray-3` | `#dddddd` |
| `--gray-4` | `#cccccc` |
| `--gray-5` | `#b0b0b0` |
| `--gray-6` | `#999999` |
| `--gray-7` | `#595959` |
| `--gray-8` | `#333333` |
| `--gray-85` | `#2b2b2b` |
| `--gray-90` | `#212121` |
| `--gray-9` | `#000000` |

### Accents (the six Google Slides theme accents + hyperlink)
`--accent-blue #4285f4` · `--accent-red #db4437` · `--accent-yellow #f4b400` · `--accent-green #0f9d58` · `--accent-purple #ab47bc` · `--accent-cyan #00acc1` · `--link-blue #1155cc`

### Tinted pairs (fill + readable ink on white)
| Pair | Fill | Ink |
| --- | --- | --- |
| green (STANDOUT) | `--green-bg #e3f3ea` | `--green-ink #0b7d46` |
| red (FLOP) | `--red-bg #fbe6e4` | `--red-ink #c5372c` |
| yellow (MVP) | `--yellow-bg #fdf3d9` | `--yellow-ink #a17400` |
| blue (info) | `--blue-bg #e6effd` | `--blue-ink #1155cc` |

The inks are darkened versions of the raw accents so the label passes contrast on white. The raw accent (`--*-mark`) is used only for the icon glyph inside inverse surfaces (toast).

### Semantic tokens

| Semantic | Simple Light (default) | Simple Dark |
| --- | --- | --- |
| `--page` | `#f8f8f8` | `#212121` |
| `--surface` | `#ffffff` | `#212121` |
| `--surface-alt` | `#f8f8f8` | `#2b2b2b` |
| `--surface-sunken` | `#eeeeee` | `#191919` |
| `--surface-header` | `#eeeeee` | `#333333` |
| `--surface-inverse` | `#000000` | `#ffffff` |
| `--border` | `#dddddd` | `#3d3d3d` |
| `--border-strong` | `#b0b0b0` | `#5c5c5c` |
| `--border-focus` | `#000000` | `#ffffff` |
| `--text` | `#000000` | `#ffffff` |
| `--text-muted` | `#595959` | `#cccccc` |
| `--text-faint` | `#999999` | `#999999` |
| `--text-inverse` | `#ffffff` | `#212121` |
| `--link` | `#1155cc` | `#8ab4f8` |
| `--link-hover` | `#000000` | `#ffffff` |
| `--overlay` | `rgba(0,0,0,.45)` | `rgba(0,0,0,.7)` |
| `--standout` / `--standout-bg` | `#0b7d46` / `#e3f3ea` | `#4bcf8b` / `#12331f` |
| `--flop` / `--flop-bg` | `#c5372c` / `#fbe6e4` | `#f28b82` / `#3a1c19` |
| `--mvp` / `--mvp-bg` | `#a17400` / `#fdf3d9` | `#fdd663` / `#3a2f0d` |
| `--info` / `--info-bg` | `#1155cc` / `#e6effd` | `#8ab4f8` / `#16243d` |

`--standout-mark #0f9d58`, `--flop-mark #db4437`, `--mvp-mark #f4b400` are the same in both themes.

### Club colours are the one sanctioned exception to the no-hex rule

A club's colour is a fact about the club, not a decision about the interface, so no semantic token could ever express it — there is no "Chelsea blue" in this system and there must not be. Club colours therefore live in the database, on `Team.colour`, and reach the DOM through an inline `style` on the crest chip. Product code still holds no hex.

The chip's ink is picked by contrast against that colour and is `--gray-0` or `--gray-9` — **base tokens, not `--text-inverse`**. The chip sits on a fixed colour, so its ink must not move with the theme; the neutral ramp never changes across themes, which is exactly the guarantee this needs.

Nothing else may claim this exception.

### Theming
Light is the default and needs no attribute. Dark is `data-theme="dark"` on `<html>` (or any container — it re-points semantics on any subtree). Only semantics re-point; base tokens never change.

### Links
`a { color: var(--link); text-decoration: none }` · `a:hover { color: var(--link-hover); text-decoration: underline }`

Selection: `::selection` is `#dddddd` on `#000000` (light), `#333333` on `#ffffff` (dark).

---

## Type

Two families, loaded from Google Fonts:
- **Archivo** (400/500/600/700) — everything spoken. Fallback stack `"Archivo","Helvetica Neue",Arial,sans-serif`. It is the neutral grotesque stand-in for the theme's Arial, with better weights.
- **JetBrains Mono** (400/500/700) — everything **counted**: scores, tallies, shirt numbers, dates, minute marks. Fallback `"JetBrains Mono","Roboto Mono",monospace`.

The rule: **if it is a number you can add up, it is monospaced.**

### Scale
| Role | Weight / Size / Line-height / Family | Tracking | Used for |
| --- | --- | --- | --- |
| `--text-display` | 700 · 40px · 1.1 · Archivo | `-0.02em` | Reserved for large headers |
| `--text-title` | 700 · 24px · 1.25 · Archivo | `-0.02em` | Page titles ("Fixtures", player name) |
| `--text-heading` | 600 · 18px · 1.25 · Archivo | 0 | Dialog titles, team names on MatchCard |
| `--text-body-lg` | 400 · 16px · 1.65 · Archivo | 0 | Diary notes — read as prose |
| `--text-body` | 400 · 14px · 1.45 · Archivo | 0 | Default UI text |
| `--text-label` | 500 · 13px · 1.25 · Archivo | 0 | Buttons, tabs, fixture lines |
| `--text-caption` | 400 · 12px · 1.25 · Archivo | 0 | Sub-labels, meta |
| `--text-caps` | 700 · 11px · 1.25 · Archivo | `+0.08em`, uppercase | Micro-labels: COMPETITION, STARTING XI |
| `--text-stat` | 700 · 32px · 1.1 · JetBrains Mono | `-0.02em` | Stat tile numbers |
| `--text-data` | 500 · 13px · 1.25 · JetBrains Mono | 0 | Shirt numbers, dates, counts |

Sizes available: 11, 12, 13, 14, 16, 18, 20, 24, 32, 40, 56.
Line heights: tight 1.1, snug 1.25, normal 1.45, loose 1.65.

**Caps appear in exactly two places**: the three verdict words (STANDOUT / FLOP / MVP) and micro-labels. Everything else is sentence case.

---

## Spacing & layout

4px base, fine-grained at the small end because rows are dense:

`--sp-1 2` · `--sp-2 4` · `--sp-3 6` · `--sp-4 8` · `--sp-5 12` · `--sp-6 16` · `--sp-7 20` · `--sp-8 24` · `--sp-9 32` · `--sp-10 40` · `--sp-11 48` · `--sp-12 64` (px)

### Frame
| Token | Value |
| --- | --- |
| `--sidebar-w` | 232px |
| `--rail-w` (top bar height) | 56px |
| `--container` | 1120px max content width |
| page padding | 24px (`--sp-8`) at `md` and up, 16px (`--sp-6`) below |

Sidebar and top bar are fixed; content scrolls. Below `md` the sidebar is a
drawer — see Responsive.

### Responsive

The rest of this document is viewport-independent; this section is not. It was
added after the fact, because the reference screens were drawn at desktop width
only and the frame above describes a single layout.

**Breakpoints are Tailwind's defaults, unchanged**: `sm 640` · `md 768` ·
`lg 1024` · `xl 1280`. No custom scale. Nothing in `globals.css` overrides them,
and a parallel set would give the project two vocabularies for one idea.

**The frame's fixed widths stay fixed.** `--sidebar-w` and `--rail-w` never scale
with the viewport. Chrome has an intrinsic size set by its contents — a fluid
sidebar is dead space on a wide screen and truncates its own labels on a narrow
one. Layout responds by **changing arrangement at a breakpoint**, not by scaling
chrome. The sidebar is 232px or it is a drawer; it is never 180px.

**`md` (768px) is the frame breakpoint.** At and above, the sidebar is a grid
column exactly as drawn. Below, it becomes an overlay drawer opened from a menu
button in the top bar — the one control that exists nowhere in the reference
images, because they have no narrow state to have put it in. At 768px the sidebar
plus padding still leaves ~490px of content; much below that it does not.

**Author mobile-first — a CSS convention, not a statement of priority.** Desktop
is the primary target and the desktop result is what the reference images show.
But Tailwind's responsive variants are *min-width only*: `md:` means "≥768px",
and there is no plain "below 768" variant. So an unprefixed utility necessarily
applies at every width and prefixed ones layer on as the screen widens — hence
`h-(--row-h-lg) md:h-(--row-h)`, "44px, and 36px from 768 up". Inverting it with
`max-md:` mixes max- and min-width rules over one property, which is where
cascade bugs come from.

**`--row-h-lg` applies below `md`.** See Control heights.

Content stays fluid up to `--container`.

### Control heights
| Token | Value | Where |
| --- | --- | --- |
| `--row-h` | 36px | Nav items, dense rows — at `md` and up |
| `--row-h-lg` | 44px | Touch rows: the same rows below `md` |
| `--control-h` | 32px | Default button, input, select, icon button |
| `--control-h-lg` | 40px | Large button, tab |
| — | 26px | Small button / small icon button |
| — | 28px | VerdictChip (md), pill tab |
| — | 24px | Tag |
| — | 20px | Badge, crest chip |
| — | 16px | Checkbox / radio box |
| — | 34×18px | Switch track (14px thumb, travels 16px) |

### Radius — near-square
| Token | Value | Where |
| --- | --- | --- |
| `--radius-sm` | 2px | Checkboxes, badges, crest chips, tooltip |
| `--radius-md` | 4px | **Almost everything**: buttons, fields, cards, tiles, dialogs, toasts |
| `--radius-lg` | 8px | Rare |
| `--radius-pill` | 999px | **Only two things**: Tags and pill Tabs (plus radio and switch) |

No 12px or 16px "friendly" radii.

Borders: `--border-w 1px`, `--border-w-strong 2px`.

---

## Elevation
| Token | Value | Where |
| --- | --- | --- |
| `--shadow-0` | none | Cards, tiles — the default |
| `--shadow-1` | `0 1px 2px rgba(0,0,0,.12)` | Lifted row, switch thumb |
| `--shadow-2` | `0 1px 3px rgba(0,0,0,.14), 0 2px 8px rgba(0,0,0,.08)` | Raised card |
| `--shadow-3` | `0 8px 24px rgba(0,0,0,.18)` | Dialogs and toasts only |

Dark theme deepens all three: `.6` / `.7`+`.5` / `.8` alpha respectively.

`--focus-ring: 0 0 0 2px var(--surface), 0 0 0 4px var(--border-focus)` — a 2px black ring with a 2px surface-coloured gap; white in dark.

---

## Motion
| Token | Value |
| --- | --- |
| `--dur-1` | 80ms |
| `--dur-2` | 140ms |
| `--dur-3` | 220ms |
| `--dur-4` | 320ms |
| `--ease-standard` | `cubic-bezier(.2,0,0,1)` |
| `--ease-out` | `cubic-bezier(0,0,0,1)` |
| `--ease-in` | `cubic-bezier(.3,0,1,1)` |

Standard hover transition (`--t-hover`) is `background-color, border-color, color` at 140ms `--ease-standard`.

The complete motion inventory:
- Colour crossfade on hover — 140ms.
- Dialog and toast: fade + 8px rise — 220ms `--ease-out`. Scrim fades at 140ms.
- Switch thumb slide — 140ms.

Nothing else animates. No bounce, no spring, no scale-in, no page transitions, no skeleton choreography. **All durations collapse to 0 under `prefers-reduced-motion: reduce`.**

---

## Interaction states

**Hover** — surfaces darken one step (`--surface` → `--surface-alt` → `--surface-sunken`); bordered controls darken their border to `--border-strong`; muted text goes to `--text`. Never opacity fades, never lightening on light backgrounds.

**Press** — one step darker again, plus `translateY(1px)`. No scale.

**Focus** — `--focus-ring` on `:focus-visible`. Fields instead take `border-color: var(--border-focus)` plus `box-shadow: inset 0 0 0 1px var(--border-focus)`. Focus is never removed.

**Disabled** — `opacity: .4`, `cursor: not-allowed`, no other change.

**Error** — border goes `--flop`; the hint line is replaced by the error message in `--flop`.

**Verdict states** — resting is a plain outlined chip in muted grey; this matters, because most players stay unrated. Selected fills with the verdict tint, colours the border and label, and switches the Material Symbol to its filled axis. There is no third "neutral" state — unselected *is* average.

---

## Iconography
**Material Symbols Outlined**, variable font, weight 400, optical size 24, `FILL 0` by default.

**Filled (`FILL 1`) means "on"** — an applied verdict, the active nav item, a favourited player. Nothing else fills.

Sizes: 14 in badges and micro-labels, 16 in chips, 18 in buttons and fields, 20 default, 22 for large icon buttons. Icons inherit `currentColor` and are never given their own colour except through the element holding them.

Working vocabulary: `trending_up` (STANDOUT), `trending_down` (FLOP), `star` (MVP), `sports_soccer`, `edit_note`, `add_comment`, `visibility`, `how_to_reg`, `groups`, `view_agenda`, `stadium`, `two_pager`, `calendar_today`, `search`, `settings`, `notifications`, `check`, `close`, `expand_more`, `chevron_left`, `chevron_right`, `more_horiz`, `delete`, `share`, `arrow_forward`, `light_mode`, `dark_mode`.

**No emoji, no unicode glyphs as icons, no hand-drawn SVG.** If a glyph does not exist in Material Symbols, use a word.

