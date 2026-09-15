---
name: Seven Journal
description: Trading-desk inspired quantitative trading journal for mobile
colors:
  primary: "#FF9F1C"
  primary-light: "#FFB74D"
  primary-deep: "#E08600"
  gold: "#D4A24C"
  gold-light: "#E8BF74"
  green: "#2BD576"
  green-light: "#5FE49A"
  red: "#FF4D4D"
  red-light: "#FF7A7A"
  cyan: "#4EC9E8"
  cyan-light: "#8BDDF0"
  background: "#0A0A0B"
  background-elevated: "#101012"
  card: "#121214"
  surface: "#161618"
  surface-light: "#1C1C1F"
  text-primary: "#F5F3F0"
  text-secondary: "#A3A09B"
  text-muted: "#6E6B67"
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
  xs: "3px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
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

**Creative North Star: "The Trading Desk"**

Seven Journal is a data-dense, dark-only journal for traders who size by risk.
Every screen is a readout: flat panels delimited by hairlines, numbers set in
tabular monospace, and exactly one accent colour that means "interactive".

The aesthetic is **amber phosphor on warm black**. The accent (#FF9F1C) is
inherited from the amber CRTs of real financial terminals — it is instantly
legible as "finance" and, unlike the indigo-500 it replaced, it is not the
default palette of every generated dashboard. Neutrals are warm-tinted so the
screen never reads blue-violet.

**Key characteristics:**
- Warm near-black surfaces (#0A0A0B), never pure black, never blue-black
- Colour = semantic meaning, enforced: there are no decorative colours left
- **No glows.** Depth is hairlines plus a single elevation step
- Monospaced tabular numbers for every financial value
- A gapped type scale so hierarchy is legible at a glance

## Colors

### Primary / Action — amber phosphor
- **Amber** (#FF9F1C): interactive elements, active tabs, focus, primary buttons
- **Amber Light** (#FFB74D) / **Amber Deep** (#E08600): secondary accent states

### Gain / Loss
- **Green** (#2BD576) — all positive P&L
- **Red** (#FF4D4D) — all negative P&L

Both are desaturated relative to the old emerald/crimson: they inform without
shouting, and they are applied to *text and bars only, never to fills*.

### Prop Firm / Target
- **Brass** (#D4A24C) — prop-firm targets, challenge progress, consistency

Deliberately distinct from the amber accent so "action" and "target" never blur.

### Information
- **Cyan** (#4EC9E8) — neutral metrics (ratios, R-multiples)

### Neutral ramp
`#0A0A0B` background · `#101012` elevated · `#121214` card · `#161618` surface ·
`#1C1C1F` surface-light · text `#F5F3F0` / `#A3A09B` / `#6E6B67` / `#4A4845`

### Named rules

**The One Color Rule.** Each family owns one meaning. Green is only gain, red
only loss, brass only prop firm, amber only action.

**The No-Hex-In-Components Rule.** Components read `theme.colors.*`. This is now
actually true — the 145 hardcoded `rgba()` and 32 hex literals were removed.

**The No-Glow Rule.** No `shadowColor` set to a brand colour. Emphasis is a
2px solid rail or a tinted fill, never a halo.

## Typography

**Data:** JetBrains Mono · **UI chrome:** Plus Jakarta Sans

### Scale (`theme.type`)

The old scale crammed everything into 9–16px, so nothing read as hierarchy.
The current scale is intentionally gapped:

| Token | Size | Use |
|---|---|---|
| `hero` | 40 | The one number on a screen (net P&L, discipline score) |
| `display` | 26 | Screen titles |
| `metric` | 19 | Panel-level KPI values |
| `metricSm` | 15 | Row-level values, blotter P&L |
| `title` | 13 | Modal / section titles |
| `body` | 12 | Values, inputs, descriptions |
| `label` | 10 | Uppercase captions |
| `micro` | 9 | Sub-captions, timestamps, badges |

**The Tabular Nums Rule.** Every financial number sets
`fontVariant: ['tabular-nums']`.

**The 9px Floor.** No essential label below 9px.

## Components

### Panel  (`components/ui/Panel.tsx`)
The base container. Flat `card` fill, 1px hairline border, 10px radius, no
gradient, no glow, no accent dot. `flush` removes padding for blotters.
Supersedes `Card`, which is kept as a compatibility shim.

### Metric  (`components/ui/Metric.tsx`)
A number with its caption. Sizes `hero | display | default | small`, tones
`default | pnl | accent | muted | info | gold`. Numbers live on the panel
surface — they are not each wrapped in their own box.

### DataRow  (`components/ui/DataRow.tsx`)
One label/value line: muted uppercase label left, tabular value right,
hairline below. The workhorse of dense readouts.

### Hairline
1px full-bleed separator with optional inset. The primary structural device.

### Blotter row  (Trades screen)
One trade per line: 2px direction rail, instrument + timestamp, R column,
P&L column. ~11 trades visible per screen instead of 5.

### Bottom tabs
62px, background-coloured, hairline top border, amber active tint,
9px uppercase mono labels.

## Do's and Don'ts

### Do
- Use `theme.colors.*`, `theme.type.*`, `theme.spacing.*`
- Use `<Panel>` for new containers and `<Metric>` for new numbers
- Keep one hero number per screen
- Use lucide icons at `strokeWidth` 1.75–2

### Don't
- **Don't** add glows, halos or brand-coloured shadows
- **Don't** use gradients as surface fills
- **Don't** hardcode hex or rgba in components
- **Don't** use emoji as icons (the achievements wall that did was removed)
- **Don't** nest panels
- **Don't** reintroduce a light theme — the app is dark-only by decision
