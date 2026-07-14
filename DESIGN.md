---
name: Plaud Mirror Operator Panel
description: A dense, quiet console for governing a self-hosted Plaud audio mirror.
colors:
  page: "#d7d9dd"
  rail: "#f1f2f4"
  surface: "#fbfbfc"
  line: "#e6e8ec"
  line-strong: "#d3d6db"
  text: "#1a1d21"
  muted: "#6b6f76"
  faint: "#9a9ea5"
  accent: "#0f7a5a"
  success: "#16a06f"
  warning: "#c2891b"
  danger: "#d1413b"
  info: "#1f6ca0"
typography:
  heading:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "normal"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "11px 18px"
  button-danger-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "9px 12px"
---

## Overview

Plaud Mirror uses a restrained light-console system for repeated operator work.
The full viewport is the application, with a fixed navigation rail, compact
status surfaces, and information-dense task views. Visual interest comes from
hierarchy and state, not decoration. The interface must keep local mirror state,
Plaud account state, scheduler behavior, and downstream delivery visibly
separate.

## Colors

The base is a cool neutral stack: grey page, lighter rail, near-white working
surface, and low-contrast separators. Green is reserved for primary actions,
selection, and healthy state. Amber marks attention or local dismissal; red is
reserved for failures and irreversible commands. Every state also carries text
or an icon, never color alone.

## Typography

Archivo carries controls, labels, and body copy. Space Grotesk is limited to
view and brand headings. JetBrains Mono identifies timestamps, counts, ids, and
compact status metadata. Type uses fixed sizes; responsive behavior changes
layout, not font scale.

## Elevation

The production shell is unframed and full viewport. Most separation uses
borders and surface changes. Shadows are reserved for transient overlays or
focused elevated tools, not ordinary sections. Cards are used only for bounded
operator tools and repeated records, never nested inside other cards.

## Components

- Primary buttons use the green accent and contain explicit commands.
- Secondary and destructive buttons use a neutral surface with a semantic
  border and text color. Irreversible commands remain text-labelled.
- Library rows are stable grid records with sequence, recording identity,
  player, state pill, and a right-aligned action group.
- Icon-only controls are limited to familiar actions such as dismiss, restore,
  play, and pagination, with accessible names and tooltips.
- Mobile controls retain at least a 44 px touch target and move structurally
  into the row without changing command meaning.

## Do's and Don'ts

- Do place an action beside the recording it affects.
- Do name whether a command changes local storage, Plaud, or downstream state.
- Do use a single clear confirmation for irreversible account mutation.
- Do keep Spanish and English copy semantically equivalent.
- Don't use success styling to claim an upstream effect before the API returns.
- Don't hide destructive scope behind an icon or generic `Delete` label.
- Don't add decorative gradients, glass effects, oversized metrics, or nested
  cards.
