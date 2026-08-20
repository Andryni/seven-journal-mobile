---
name: Seven Journal
description: Bloomberg-inspired quantitative trading terminal mobile app
colors:
  primary: "#6366f1"
  primary-light: "#818cf8"
  primary-deep: "#4f46e5"
  gold: "#f59e0b"
  gold-light: "#fbbf24"
  green: "#10b981"
  green-light: "#34d399"
  red: "#ef4444"
  red-light: "#f87171"
  cyan: "#06b6d4"
  cyan-light: "#67e8f9"
  background: "#07080a"
  background-elevated: "#0d0f15"
  card: "#12141c"
  surface: "#161922"
  surface-light: "#1f2330"
  text-primary: "#ffffff"
  text-secondary: "#94a3b8"
  text-muted: "#64748b"
typography:
  mono:
    fontFamily: "JetBrainsMono_400Regular"
    fontSize: "11px"
    fontWeight: 400
  mono-bold:
    fontFamily: "JetBrainsMono_700Bold"
    fontSize: "11px"
    fontWeight: 700
  mono-extra-bold:
    fontFamily: "JetBrainsMono_800ExtraBold"
    fontSize: "14px"
    fontWeight: 800
  sans:
    fontFamily: "PlusJakartaSans_400Regular"
    fontSize: "12px"
    fontWeight: 400
  sans-bold:
    fontFamily: "PlusJakartaSans_700Bold"
    fontSize: "13px"
    fontWeight: 700
  sans-extra-bold:
    fontFamily: "PlusJakartaSans_800ExtraBold"
    fontSize: "16px"
    fontWeight: 800
rounded:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "28px"
components:
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  badge-green:
    backgroundColor: "rgba(16, 185, 129, 0.12)"
    textColor: "{colors.green-light}"
    rounded: "{rounded.xs}"
  badge-red:
    backgroundColor: "rgba(239, 68, 68, 0.12)"
    textColor: "{colors.red-light}"
    rounded: "{rounded.xs}"
  badge-blue:
    backgroundColor: "rgba(99, 102, 241, 0.12)"
    textColor: "{colors.primary-light}"
    rounded: "{rounded.xs}"
  badge-gold:
    backgroundColor: "rgba(245, 158, 11, 0.12)"
    textColor: "{colors.gold-light}"
    rounded: "{rounded.xs}"
---

# Design System: Seven Journal

## Overview

**Creative North Star: "The Bloomberg Terminal"**

Seven Journal is a data-dense, dark-mode-first trading terminal designed for quantitative traders. Every screen feels like a Bloomberg terminal cockpit — high contrast, monospaced financial data, and information density that rewards experienced eyes while remaining scannable for quick glances between sessions.

The aesthetic is **Swiss precision meets OLED dark**. Deep near-black backgrounds (#07080a) create maximum contrast for colored data (green for gains, red for losses, indigo for actions, gold for prop firm targets). Typography splits cleanly: JetBrains Mono for all financial numbers and technical labels, Plus Jakarta Sans for UI chrome and headers. The result is a terminal that feels simultaneously premium and functional.

**Key Characteristics:**
- OLED-optimized dark backgrounds with subtle card elevation
- Color = semantic meaning (never decorative)
- Monospaced tabular numbers for all financial data
- High information density with maintained readability
- Animated micro-interactions (glow halos, progress rings, live ticker)

## Colors

The palette follows a strict semantic system: each color family owns one meaning, and that meaning never shifts.

### Primary (Brand / Action)
- **Indigo** (#6366f1): Interactive elements — buttons, active tabs, links, focus rings, "live" indicators
- **Indigo Light** (#818cf8): Active icon states, labels, lighter accents
- **Indigo Deep** (#4f46e5): Gradient endpoints for primary buttons

### Gain / Loss (P&L)
- **Emerald** (#10b981): All positive P&L, wins, gains, "safe" states
- **Emerald Light** (#34d399): Text on dark backgrounds for positive values
- **Crimson** (#ef4444): All negative P&L, losses, deletions, "danger" states
- **Crimson Light** (#f87171): Text on dark backgrounds for negative values

### Prop Firm / Target
- **Gold** (#f59e0b): Prop firm targets, challenge progress, streaks, consistency rules
- **Gold Light** (#fbbf24): Text labels for prop firm data

### Information
- **Cyan** (#06b6d4): Neutral informational metrics (ratios, R-multiples, cumulative data)
- **Cyan Light** (#67e8f9): Text for informational values

### Neutral
- **Background** (#07080a): Root app background (deepest OLED black)
- **Background Elevated** (#0d0f15): Raised surfaces (cards, modals)
- **Card** (#12141c): Standard card containers
- **Surface** (#161922): Sub-surfaces, pickers, sections
- **Surface Light** (#1f2330): Hover states, elevated sub-surfaces
- **Text Primary** (#ffffff): Main text
- **Text Secondary** (#94a3b8): KPI labels, secondary information
- **Text Muted** (#64748b): Dates, timestamps, tertiary information

### Named Rules

**The One Color Rule.** Each color family owns exactly one semantic meaning. Green is ONLY for gains. Red is ONLY for losses. Gold is ONLY for prop firm. Indigo is ONLY for actions. Breaking this rule destroys the terminal's scannability.

**The No-Gray Rule.** Never use pure gray (#808080) or pure white (#ffffff) for backgrounds. Always tint toward the brand palette. The background is #07080a (blue-black), not #000000.

## Typography

**Display Font:** JetBrains Mono (400 / 500 / 700 / 800)
**Body Font:** Plus Jakarta Sans (400 / 500 / 600 / 700 / 800)

**Character:** The mono/sans split creates a clear hierarchy — monospace is for data (prices, PnL, timestamps, KPIs), sans-serif is for everything else (headers, descriptions, labels). This mirrors Bloomberg Terminal conventions.

### Hierarchy

- **Screen Title** (sansExtraBold, 16px, letterSpacing 1.2): Top of each screen — "ANALYTICS & PROP FIRM"
- **Card Title** (sansExtraBold, 12px, letterSpacing 1.2, uppercase): Section headers — "KPI GLOBAUX"
- **KPI Value** (monoExtraBold, 20px, tabular-nums): Hero numbers — "$1,234.56", "62.5%"
- **KPI Label** (monoBold, 9px, letterSpacing 0.8): Above KPI values — "NET P&L TOTAL"
- **Body Text** (sans, 11px): Descriptions, notes, empty states
- **Timestamp** (monoMedium, 9-10px): Dates, times, trade entries
- **Badge Label** (monoBold, 9-10px, letterSpacing 0.5): Status tags — "BUY", "TP", "OPEN"
- **Tab Label** (monoBold, 9px): Bottom navigation — "TABLEAU", "TRADES"

### Named Rules

**The Tabular Nums Rule.** Every financial number must use `fontVariant: ['tabular-nums']`. This ensures vertical alignment of decimal points and digits across rows — critical for scanning P&L columns.

**The Minimum 9px Rule.** No essential label falls below 9px. Body text stays at 10px minimum. This preserves readability on small mobile screens.

## Layout

The app uses a single-column mobile layout with consistent horizontal padding (16px) across all screens. Cards and sections stack vertically with 16px gaps. The bottom tab navigator provides the primary navigation with 6 tabs maximum.

**Density:** High but readable. Cards use 16px internal padding. KPI grids use flex row with 12px gaps. The information density is intentionally high — this is a terminal, not a consumer app.

**Responsive:** Fixed mobile layout. No breakpoints or responsive adaptation — the app is designed for phone screens (375px+).

## Elevation & Depth

The system uses a hybrid approach: subtle shadows for depth and glow effects for emphasis.

### Shadow Vocabulary

- **Card Shadow** (`shadowColor: '#000', shadowOffset: {0,6}, shadowOpacity: 0.4, shadowRadius: 12`): Standard card elevation
- **Modal Shadow** (`shadowColor: '#000', shadowOffset: {0,15}, shadowOpacity: 0.8, shadowRadius: 25`): Modal overlays
- **Glow Halo** (`shadowColor: primary, shadowOpacity: 0.8, shadowRadius: 6`): Logo and active elements

### Named Rules

**The Glow-For-Active Rule.** Shadows with brand color (indigo glow) appear ONLY on active/selected states. Static elements use neutral black shadows only.

## Shapes

Cards and containers use generous border radii (18px for cards, 24px for modals, 9999px for pills/badges). The radius language is consistent: small elements (badges, chips) use 4-8px, medium elements (buttons, inputs) use 12px, large containers use 18-24px.

Borders are subtle — 1px solid with low-opacity white (`rgba(255,255,255,0.08)`) for cards, or brand-colored for active states (`rgba(99,102,241,0.4)`).

## Components

### Card
- **Character:** Elevated container with gradient background, top highlight line, and optional badge
- **Corner:** 18px radius
- **Background:** Linear gradient from card (#12141c) to backgroundElevated (#0d0f15)
- **Border:** 1px solid rgba(255,255,255,0.08)
- **Shadow:** Standard card shadow
- **Internal Padding:** 16px

### Badge
- **Character:** Compact status tag with semantic coloring
- **Variants:** green (gain), red (loss), blue (action), gold (prop firm), cyan (info), neutral (default)
- **Shape:** 4px radius (sm variant: 2px), 1px border with matching alpha
- **Typography:** monoBold 9-10px, uppercase, letterSpacing 0.5

### KpiCard
- **Character:** Single metric display with label, value, and subtitle
- **Layout:** Vertical stack — label (top, muted), value (center, large mono), sub (bottom, small)
- **Background:** card color with 1px border

### Bottom Tab Navigator
- **Height:** 64px
- **Background:** backgroundElevated
- **Active:** primaryLight color + label
- **Inactive:** textDark color
- **Label:** monoBold 9px, letterSpacing 0.5

## Do's and Don'ts

### Do:
- **Do** use `fontVariant: ['tabular-nums']` on every financial number
- **Do** use semantic color families consistently (green=gain, red=loss, gold=prop firm)
- **Do** keep labels at 9px minimum, body text at 10px minimum
- **Do** use mono for data, sans for UI chrome
- **Do** use `createStyles(theme)` pattern — never hardcode colors in components
- **Do** add `accessibilityLabel` to every icon button

### Don't:
- **Don't** use hex colors in components — always `theme.colors.*`
- **Don't** use green/red for anything other than P&L
- **Don't** use bounce/elastic easing (feels dated)
- **Don't** nest cards inside cards
- **Don't** use emoji as icons — use lucide-react-native
- **Don't** put text below 9px for essential labels
