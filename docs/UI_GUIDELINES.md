# UI Guidelines

UI is the #1 product priority. This document is the design source of truth.

> **Rule:** every UI task uses the `frontend-design` skill. Loading and applying that skill is part of "starting a UI task," not optional polish.

**North star references:** Linear, Arc, Things 3, Vercel dashboard, Rauno's portfolio. Quiet, confident, dense.

---

## 1. Design principles

1. **One number, hero-treated.** The Confidence score is the protagonist of every screen. Make it big, make it weighted, make it move when it changes.
2. **Restraint over decoration.** No gradients on everything. No glassmorphism. No neon. Premium = quiet.
3. **Information density done right.** Tables should feel like Linear's issue list — dense but breathable.
4. **Color carries meaning only.** Green = positive confidence, red = negative, gray = zero. Don't use color decoratively.
5. **Motion only on state change.** Numbers count up. Hover states are subtle. No decorative scroll animations.

---

## 2. Color tokens

Define these in `globals.css` using Tailwind v4's `@theme` directive. Reference them via Tailwind utilities (`bg-surface`, `text-positive`, etc.) — never use hex codes inline.

### Light mode

```
--color-bg:        #FAFAF9
--color-surface:   #FFFFFF
--color-border:    #E7E5E4
--color-text:      #0A0A0A
--color-muted:     #78716C
```

### Dark mode

```
--color-bg:        #0A0A0A
--color-surface:   #141414
--color-border:    #1F1F1F
--color-text:      #FAFAF9
--color-muted:     #A1A1AA
```

### Semantic (both modes)

```
--color-positive:  #16A34A   /* confidence > 0 */
--color-negative:  #DC2626   /* confidence < 0 */
--color-neutral:   #A1A1AA   /* confidence = 0 */
--color-accent:    #1E40AF   /* links, focus rings, primary actions */
```

Confidence color logic:

- `> 0` → `positive`
- `< 0` → `negative`
- `= 0` → `neutral`

---

## 3. Typography

### Stack (intentional, non-generic)

The `frontend-design` skill warns against generic fonts (Inter, Roboto, etc). For this project we use:

- **UI:** [Geist Sans](https://vercel.com/font) — Vercel's distinctive sans, excellent tabular numerics, pairs well with FPL's data-heavy interface.
- **Display accents:** [Fraunces](https://fonts.google.com/specimen/Fraunces) — variable serif with character. Used only for player names on the detail page and one or two hero moments.
- **Numerics everywhere:** `font-variant-numeric: tabular-nums` enabled globally on numeric cells.

Both are loaded via `next/font` for zero CLS and self-hosted delivery.

### Scale

| Use                                         | Size | Weight | Notes                              |
| ------------------------------------------- | ---- | ------ | ---------------------------------- |
| Hero confidence number                      | 96px | 600    | tight tracking (-0.02em), tabular  |
| Page title                                  | 32px | 600    | -0.01em tracking                   |
| Display serif (player names on detail page) | 44px | 400    | Fraunces, optical size 96          |
| Section header                              | 14px | 500    | uppercase, +0.05em tracking, muted |
| Body                                        | 15px | 400    | 1.5 line-height                    |
| Table cell                                  | 14px | 400    | tabular for numbers                |
| Caption / meta                              | 12px | 500    | muted color                        |

---

## 4. Spacing & sizing

- Base grid: 4px. All paddings/margins must be multiples of 4.
- Common gaps: 8, 12, 16, 24, 32, 48.
- Border radius: 8px on cards, 6px on buttons, 4px on inputs. Avatars are fully round.
- Max content width: 1280px. Center with auto margins.

---

## 5. Component patterns

### ConfidenceNumber (the hero)

The single most important component in the app. Built first, in isolation, before any other UI work.

- Three sizes: `xl` (96px, detail page), `md` (32px, cards), `sm` (16px, table cells).
- Always tabular numerics.
- Always color-coded by sign.
- Always animates on mount and on value change (count-up via Motion's `useMotionValue` + `animate`).
- Always shows the sign explicitly: `+3`, `−1`, `0`. Use Unicode minus `−` (U+2212), not ASCII hyphen.
- Exposes a `data-sign` attribute (`positive`/`negative`/`neutral`) for testing.

### ConfidenceSlider

- Horizontal track from −5 to +5 with tick marks at integers.
- A pill-shaped marker with the current value sits on the track.
- Track background uses muted color; the segment from 0 to current value uses the semantic color.

### ConfidenceTrend

- Inline sparkline of last N matches' deltas.
- ~64px wide, ~20px tall.
- No axes, no grid, no tooltip. Just the line.

### Tables

- Linear-style: 1px borders only between rows (no vertical lines), zebra striping is forbidden.
- Row height: 56px on the players list.
- Hover: bg shifts to `--color-surface` with a 1px accent left-border.
- Sticky header with a subtle bottom shadow only when scrolled.
- Sort indicators are tiny chevrons next to the column header — only on the active sort column.

### Buttons

- Primary: solid `--color-accent`, white text, 6px radius.
- Secondary: `--color-surface`, `--color-border` border, `--color-text` text.
- Ghost: transparent, only bg on hover.
- All buttons: 36px height by default, 12px horizontal padding, 14px font.

### Cards

- `--color-surface` bg, 1px `--color-border`, 8px radius, 24px padding.
- No shadow in light mode. Subtle 0 1px 2px rgba(0,0,0,0.5) in dark mode.

### Forms (settings)

- Labels above inputs, never beside.
- Inputs: 40px height, 4px radius, 1px border, focuses with `--color-accent` ring.
- Help text below input in 12px muted.

---

## 6. Motion

- Use Motion (formerly Framer Motion) for state changes, not for decoration.
- **Confidence number changes:** count from old to new value over 600ms with `easeOut`.
- **Page transitions:** 150ms opacity fade only. No slide, no scale.
- **Pin button bounce:** scale 1 → 1.15 → 1 over 250ms when toggling pin.
- **Skeleton shimmer:** 1.5s linear loop, only on initial load.

Forbidden: parallax, scroll-triggered reveals, decorative hover lifts, bouncy springs on layout, anything that delays user interaction.

---

## 7. Screen-by-screen briefs

### Dashboard (`/`)

- **Top bar:** wordmark left, current Gameweek pill (e.g. "GW 32") right, theme toggle right.
- **Hero strip (3 cards side-by-side):**
  1. **Biggest Risers** — top 3 players by positive confidence delta this GW.
  2. **Biggest Fallers** — top 3 by negative delta.
  3. **Watchlist** — user-pinned players.
     Each card: jersey thumb + name + position + ConfidenceNumber (md) + tiny trend arrow.
- **Confidence leaderboard:** top 10 players by current confidence, table style. Click row → player detail.
- **Empty states:** "No watchlist yet" with a small CTA. "Pin players from the players list to see them here." Designed, not afterthought, and tested.

### Players list (`/players`)

- Linear-style table. Columns:
  - Player (avatar + name)
  - Team (badge + jersey thumb)
  - Position (chip)
  - Price (£m, tabular)
  - **Confidence (largest column, color-coded, ConfidenceNumber sm)**
  - Last 5 matches (ConfidenceTrend sparkline)
  - Trend arrow
- Sticky filter bar at top:
  - Position chips (GK / DEF / MID / FWD), multi-select
  - Team multi-select dropdown
  - Price range slider
  - Confidence range slider
  - Search input on the far right
- Default sort: confidence descending.
- Row hover reveals a "Pin to watchlist" button on the far right.
- Use `@tanstack/react-virtual` — there are 700+ players.

### Player detail (`/players/[id]`)

- **Header:**
  - Big jersey shirt (FPL CDN PNG) on a soft circular gradient bg.
  - Player name in 44px Fraunces.
  - Team + position chip + price below.
- **Hero confidence:** dead center, 96px ConfidenceNumber. Below it, ConfidenceSlider showing position on −5..+5. Number animates from 0 on mount.
- **Match history strip:** horizontal-scroll of match cards. Each card shows opponent badge + name, H/A, result, event icons (goal/assist/CS/blank) with the delta applied (+3, −1, etc.), color-coded background tint.
- **Confidence chart:** Recharts line chart, season view. X = gameweek, Y = confidence. Threshold line at 0. **Heavily restyled** — no default colors, custom tooltip, custom ticks.
- **Big-team breakdown:** two stat blocks: "vs Big Teams" / "vs Others". Each shows avg delta + match count.

### Settings (`/settings`)

- Single column, max-width 600px, centered.
- **Section: Big Teams.** All 20 PL teams listed with badge + name + checkbox. Save persists to localStorage (validated through Zod on read) AND triggers full confidence recompute. Show last-modified timestamp.
- **Section: Cache.** Last sync time + "Refresh data" button.
- **Section: Appearance.** Theme radio (System / Light / Dark).

---

## 8. Accessibility

- All interactive elements keyboard-reachable, visible focus ring (`--color-accent` 2px outline).
- Min contrast 4.5:1 for body text, 3:1 for large text.
- Color is never the only signal — confidence sign also shown via `+` / `−` glyph.
- Skeleton loaders use `aria-busy="true"` on the parent.
- Cmd/Ctrl+K opens search palette via `cmdk`. Escape closes it.
- Every page tested with `axe-core` per `docs/TESTING.md` §5.5.

---

## 9. Anti-patterns (do not do)

- ❌ Spinners (use skeletons matching final layout)
- ❌ Inter, Roboto, or any other generic AI default font
- ❌ Purple gradients on white backgrounds (the canonical "AI app" look)
- ❌ Hex codes inline (use tokens)
- ❌ Modals for confirmation flows (use inline confirms or destructive button states)
- ❌ Toast notifications for success on every action (only on errors or async outcomes)
- ❌ Decorative emoji in UI copy
- ❌ Tooltips that explain things the UI itself should make clear
- ❌ Centered text in tables
- ❌ Tailwind utility soup with 15+ classes per element — extract to a component
