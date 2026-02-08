---
name: cyberflow-design-system
description: "Cyberpunk visual design system for FlowState's Cyberflow RPG. Encodes augmented-ui patterns, neon glow recipes, scanline/glitch effects, cyberpunk typography, color palette, intensity-level CSS architecture, and prefers-reduced-motion accessibility patterns. Use when implementing any cyberpunk-styled UI component."
---

# Cyberflow Design System -- Cyberpunk Visual Foundation

**Version:** 1.0.0
**Category:** Design System / Visual Engineering
**Related Skills:** cyberflow-rpg, dev-implement-ui-ux, frontend-design

## Overview

Complete CSS design system for FlowState's Cyberflow RPG layer. This skill encodes every visual pattern needed to build cyberpunk-themed UI components: augmented-ui panel frames, neon glow effects, scanline overlays, glitch text, terminal animations, and the full color palette with intensity-level scaling.

All styles are scoped under `.cyberflow` to prevent bleed into Board/Calendar/Canvas views. Tokens live in `src/assets/cyberflow-tokens.css`, imported AFTER `design-tokens.css`.

## When to Activate

Invoke this skill when:
- Building any cyberpunk-styled UI component (mission cards, boss panels, character profiles)
- Adding or modifying neon glow effects, scanlines, or glitch animations
- Working with the augmented-ui CSS library for panel frames
- Implementing intensity-level visual scaling (minimal/moderate/intense)
- Adding accessibility patterns (prefers-reduced-motion) to Cyberflow components
- Choosing colors, fonts, or spacing for gamification UI
- Debugging visual rendering of Cyberflow components

## Automatic Skill Chaining

1. **After visual component work** -> Chain `cyberflow-rpg` for game logic integration
2. **After adding animations** -> Verify `prefers-reduced-motion` fallback exists
3. **After intensity-level changes** -> Test at all 3 levels (minimal, moderate, intense)
4. **After augmented-ui panel work** -> Verify `data-augmented-ui` attribute is set on the element

---

## 1. augmented-ui CSS Library

### Installation and Setup

```bash
npm install augmented-ui
```

```css
/* In main CSS entry point (e.g., src/assets/main.css) */
@import 'augmented-ui/augmented-ui.min.css';
```

### Core Concept

augmented-ui uses a `data-augmented-ui` HTML attribute to define corner/edge shapes and activation type. CSS custom properties control dimensions, colors, and gradients.

```html
<div
  class="cyber-panel"
  data-augmented-ui="tl-clip tr-scoop br-clip bl-rect border"
>
  Panel content
</div>
```

### Corner and Edge Shapes

| Shape | Suffix | Visual |
|-------|--------|--------|
| Clip | `-clip` | Angled cut (45-degree diagonal) |
| Scoop | `-scoop` | Concave inward curve |
| Round | `-round` | Convex outward curve |
| Rect | `-rect` | Rectangular notch |
| Step | `-step` | Stepped/staircase cut |

### Position Prefixes

| Prefix | Position |
|--------|----------|
| `tl-` | Top-left corner |
| `tr-` | Top-right corner |
| `br-` | Bottom-right corner |
| `bl-` | Bottom-left corner |
| `t-` | Top edge (center) |
| `r-` | Right edge (center) |
| `b-` | Bottom edge (center) |
| `l-` | Left edge (center) |

### Activation Types

| Type | Effect |
|------|--------|
| `border` | Outer frame only (single border line around the shape) |
| `inlay` | Inner frame only (inset border inside the shape) |
| `both` | Dual layer -- outer border + inner inlay |

### CSS Custom Properties

| Property | Purpose | Example |
|----------|---------|---------|
| `--aug-border-all` | Border thickness (all sides) | `2px` |
| `--aug-border-bg` | Border color/gradient | `linear-gradient(...)` |
| `--aug-inlay-all` | Inlay thickness (all sides) | `4px` |
| `--aug-inlay-bg` | Inlay color/gradient | `rgba(0, 240, 255, 0.05)` |
| `--aug-tl1` | Top-left corner size | `20px` |
| `--aug-tr1` | Top-right corner size | `15px` |
| `--aug-br1` | Bottom-right corner size | `20px` |
| `--aug-bl1` | Bottom-left corner size | `10px` |
| `--aug-t1` | Top edge size | `40px` |
| `--aug-r1` | Right edge size | `30px` |
| `--aug-b1` | Bottom edge size | `40px` |
| `--aug-l1` | Left edge size | `30px` |
| `--aug-border` | Override border on specific side | per-side value |
| `--aug-inlay` | Override inlay on specific side | per-side value |

### Panel Recipes

#### Mission Card (Daily/Weekly Challenge)

```html
<div
  class="cf-mission-card"
  data-augmented-ui="tl-clip br-clip border"
>
  <div class="cf-mission-card__header">DAILY MISSION</div>
  <div class="cf-mission-card__body">Complete 5 tasks</div>
</div>
```

```css
.cf-mission-card {
  --aug-border-all: 1px;
  --aug-border-bg: var(--cf-cyan);
  --aug-tl1: 16px;
  --aug-br1: 16px;
  background: var(--cf-dark-2);
  padding: 16px 20px;
  position: relative;
}

.cf-mission-card:hover {
  --aug-border-all: 2px;
  --aug-border-bg: linear-gradient(135deg, var(--cf-cyan), var(--cf-magenta));
}
```

#### Character Profile Panel

```html
<div
  class="cf-profile-panel"
  data-augmented-ui="tl-clip tr-scoop br-clip bl-scoop both"
>
  <div class="cf-profile-panel__avatar">...</div>
  <div class="cf-profile-panel__stats">...</div>
</div>
```

```css
.cf-profile-panel {
  --aug-border-all: 2px;
  --aug-border-bg: linear-gradient(135deg, var(--cf-cyan), var(--cf-purple));
  --aug-inlay-all: 4px;
  --aug-inlay-bg: rgba(0, 240, 255, 0.03);
  --aug-tl1: 24px;
  --aug-tr1: 16px;
  --aug-br1: 24px;
  --aug-bl1: 16px;
  background: var(--cf-dark-1);
  padding: 24px;
  min-width: 280px;
}
```

#### Boss Fight Panel

```html
<div
  class="cf-boss-panel"
  data-augmented-ui="tl-clip tr-clip br-clip bl-clip both"
>
  <h2 class="cf-boss-panel__name glitch" data-text="PHANTOM OVERSEER">PHANTOM OVERSEER</h2>
  <div class="cf-boss-panel__health-bar">...</div>
  <div class="cf-boss-panel__objectives">...</div>
</div>
```

```css
.cf-boss-panel {
  --aug-border-all: 3px;
  --aug-border-bg: linear-gradient(135deg, var(--cf-magenta), var(--cf-orange), var(--cf-magenta));
  --aug-inlay-all: 6px;
  --aug-inlay-bg: rgba(255, 0, 153, 0.05);
  --aug-tl1: 32px;
  --aug-tr1: 32px;
  --aug-br1: 32px;
  --aug-bl1: 32px;
  background: var(--cf-dark-1);
  padding: 32px;
  box-shadow: 0 0 20px rgba(255, 0, 153, 0.3), 0 0 40px rgba(255, 0, 153, 0.1);
}
```

#### Stat Display (XP, Level, Streak)

```html
<div
  class="cf-stat-display"
  data-augmented-ui="tl-rect br-rect border"
>
  <span class="cf-stat-display__label">XP</span>
  <span class="cf-stat-display__value">2,450</span>
</div>
```

```css
.cf-stat-display {
  --aug-border-all: 1px;
  --aug-border-bg: var(--cf-cyan-50);
  --aug-tl1: 8px;
  --aug-br1: 8px;
  background: var(--cf-dark-3);
  padding: 8px 16px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-cyber-data);
}

.cf-stat-display__value {
  color: var(--cf-cyan);
  font-size: 1.25rem;
  font-weight: 700;
}
```

#### Shop Item Card

```html
<div
  class="cf-shop-card"
  data-augmented-ui="tl-clip br-clip border"
>
  <div class="cf-shop-card__preview">...</div>
  <div class="cf-shop-card__price">
    <span class="cf-shop-card__cost">500</span> XP
  </div>
</div>
```

```css
.cf-shop-card {
  --aug-border-all: 1px;
  --aug-border-bg: var(--cf-gold-50);
  --aug-tl1: 14px;
  --aug-br1: 14px;
  background: var(--cf-dark-2);
  padding: 16px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.cf-shop-card:hover {
  --aug-border-all: 2px;
  --aug-border-bg: var(--cf-gold);
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.2);
  transform: translateY(-2px);
}

.cf-shop-card__cost {
  font-family: var(--font-cyber-data);
  color: var(--cf-gold);
  font-weight: 700;
}
```

#### Achievement Badge

```html
<div
  class="cf-achievement-badge"
  data-augmented-ui="tl-scoop tr-scoop br-scoop bl-scoop border"
>
  <div class="cf-achievement-badge__icon">...</div>
  <div class="cf-achievement-badge__name">First Blood</div>
</div>
```

```css
.cf-achievement-badge {
  --aug-border-all: 2px;
  --aug-border-bg: var(--cf-gold);
  --aug-tl1: 12px;
  --aug-tr1: 12px;
  --aug-br1: 12px;
  --aug-bl1: 12px;
  background: var(--cf-dark-3);
  padding: 12px;
  text-align: center;
  min-width: 100px;
}

/* Locked achievement */
.cf-achievement-badge--locked {
  --aug-border-bg: var(--cf-dark-4);
  opacity: 0.5;
  filter: grayscale(0.8);
}

/* Rare achievement */
.cf-achievement-badge--rare {
  --aug-border-bg: linear-gradient(135deg, var(--cf-gold), var(--cf-purple), var(--cf-gold));
  box-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
}
```

---

## 2. Neon Glow Recipes

The signature cyberpunk look comes from multi-layered `box-shadow` and `text-shadow`. Each layer increases the blur radius to create an authentic neon light bloom.

### Box Shadow Glow (Panel/Card Borders)

#### Cyan (Primary -- UI elements, info, borders)

```css
.neon-cyan {
  box-shadow:
    0 0 5px #00f0ff,
    0 0 10px #00f0ff,
    0 0 20px #00f0ff,
    0 0 40px #00f0ff;
}

/* Subtle variant (for moderate intensity) */
.neon-cyan--subtle {
  box-shadow:
    0 0 5px rgba(0, 240, 255, 0.5),
    0 0 10px rgba(0, 240, 255, 0.2);
}
```

#### Magenta (Danger -- boss fights, penalties, high corruption)

```css
.neon-magenta {
  box-shadow:
    0 0 5px #ff0099,
    0 0 10px #ff0099,
    0 0 20px #ff0099,
    0 0 40px #ff0099;
}

.neon-magenta--subtle {
  box-shadow:
    0 0 5px rgba(255, 0, 153, 0.5),
    0 0 10px rgba(255, 0, 153, 0.2);
}
```

#### Lime (Success -- XP gain, task completion, health)

```css
.neon-lime {
  box-shadow:
    0 0 5px #39ff14,
    0 0 10px #39ff14,
    0 0 20px #39ff14,
    0 0 40px #39ff14;
}

.neon-lime--subtle {
  box-shadow:
    0 0 5px rgba(57, 255, 20, 0.5),
    0 0 10px rgba(57, 255, 20, 0.2);
}
```

#### Orange (Warning -- mid corruption, streak at risk)

```css
.neon-orange {
  box-shadow:
    0 0 5px #ff6b35,
    0 0 10px #ff6b35,
    0 0 20px #ff6b35,
    0 0 40px #ff6b35;
}

.neon-orange--subtle {
  box-shadow:
    0 0 5px rgba(255, 107, 53, 0.5),
    0 0 10px rgba(255, 107, 53, 0.2);
}
```

#### Gold (Achievement -- rare items, platinum tier)

```css
.neon-gold {
  box-shadow:
    0 0 5px #ffd700,
    0 0 10px #ffd700,
    0 0 20px #ffd700,
    0 0 40px #ffd700;
}

.neon-gold--subtle {
  box-shadow:
    0 0 5px rgba(255, 215, 0, 0.5),
    0 0 10px rgba(255, 215, 0, 0.2);
}
```

### Text Glow

```css
/* Generic text glow -- uses currentColor so it adapts to the text color */
.neon-text {
  text-shadow:
    0 0 5px currentColor,
    0 0 10px currentColor,
    0 0 20px currentColor,
    0 0 40px currentColor;
}

/* Color-specific text glow */
.neon-text-cyan {
  color: #00f0ff;
  text-shadow:
    0 0 5px #00f0ff,
    0 0 10px #00f0ff,
    0 0 20px #00f0ff,
    0 0 40px #00f0ff;
}

.neon-text-magenta {
  color: #ff0099;
  text-shadow:
    0 0 5px #ff0099,
    0 0 10px #ff0099,
    0 0 20px #ff0099,
    0 0 40px #ff0099;
}

.neon-text-lime {
  color: #39ff14;
  text-shadow:
    0 0 5px #39ff14,
    0 0 10px #39ff14,
    0 0 20px #39ff14,
    0 0 40px #39ff14;
}

.neon-text-gold {
  color: #ffd700;
  text-shadow:
    0 0 5px #ffd700,
    0 0 10px #ffd700,
    0 0 20px #ffd700,
    0 0 40px #ffd700;
}
```

### Pulse Glow Animation (for active/highlighted elements)

```css
@keyframes neon-pulse-cyan {
  0%, 100% {
    box-shadow:
      0 0 5px #00f0ff,
      0 0 10px #00f0ff,
      0 0 20px #00f0ff,
      0 0 40px #00f0ff;
  }
  50% {
    box-shadow:
      0 0 10px #00f0ff,
      0 0 20px #00f0ff,
      0 0 40px #00f0ff,
      0 0 60px #00f0ff;
  }
}

@keyframes neon-pulse-magenta {
  0%, 100% {
    box-shadow:
      0 0 5px #ff0099,
      0 0 10px #ff0099,
      0 0 20px #ff0099,
      0 0 40px #ff0099;
  }
  50% {
    box-shadow:
      0 0 10px #ff0099,
      0 0 20px #ff0099,
      0 0 40px #ff0099,
      0 0 60px #ff0099;
  }
}

@keyframes neon-pulse-lime {
  0%, 100% {
    box-shadow:
      0 0 5px #39ff14,
      0 0 10px #39ff14,
      0 0 20px #39ff14,
      0 0 40px #39ff14;
  }
  50% {
    box-shadow:
      0 0 10px #39ff14,
      0 0 20px #39ff14,
      0 0 40px #39ff14,
      0 0 60px #39ff14;
  }
}

@keyframes neon-pulse-gold {
  0%, 100% {
    box-shadow:
      0 0 5px #ffd700,
      0 0 10px #ffd700,
      0 0 20px #ffd700,
      0 0 40px #ffd700;
  }
  50% {
    box-shadow:
      0 0 10px #ffd700,
      0 0 20px #ffd700,
      0 0 40px #ffd700,
      0 0 60px #ffd700;
  }
}

.neon-pulse-cyan { animation: neon-pulse-cyan 2s ease-in-out infinite; }
.neon-pulse-magenta { animation: neon-pulse-magenta 2s ease-in-out infinite; }
.neon-pulse-lime { animation: neon-pulse-lime 1.5s ease-in-out infinite; }
.neon-pulse-gold { animation: neon-pulse-gold 2.5s ease-in-out infinite; }
```

### Glow Intensity Scaling per Level

| Intensity | Box-Shadow Layers | Blur Range | Opacity |
|-----------|-------------------|------------|---------|
| `.cf-minimal` | 0 layers | None | -- |
| `.cf-moderate` | 2 layers | 5px, 10px | 50% alpha |
| `.cf-intense` | 4 layers | 5px, 10px, 20px, 40px | 100% alpha |

---

## 3. Scanline Overlay

Creates a CRT monitor / retro terminal scanline effect over panels.

### CSS Implementation

```css
.scanlines {
  position: relative;
  overflow: hidden;
}

.scanlines::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    transparent 50%,
    rgba(0, 0, 0, 0.3) 50%
  );
  background-size: 100% 4px;
  pointer-events: none;
  z-index: 10;
  animation: scanline-drift 8s linear infinite;
}

@keyframes scanline-drift {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 0 100%;
  }
}
```

### Intensity Rules

- **`.cf-minimal`** -- No scanlines
- **`.cf-moderate`** -- No scanlines
- **`.cf-intense`** -- Scanlines active with slow drift animation

### Accessibility: prefers-reduced-motion

```css
@media (prefers-reduced-motion: reduce) {
  .scanlines::before {
    animation: none;
    /* Static scanlines remain visible -- only motion is removed */
  }
}
```

---

## 4. Glitch Text Effect

RGB channel-split glitch animation for boss names, corruption warnings, and critical headers.

### HTML Usage

```html
<span class="glitch" data-text="SYSTEM BREACH">SYSTEM BREACH</span>
```

The `data-text` attribute MUST match the text content exactly. The `::before` and `::after` pseudo-elements use `attr(data-text)` to create the offset layers.

### CSS Implementation

```css
.glitch {
  position: relative;
  display: inline-block;
  font-family: var(--font-cyber-title);
  font-weight: 700;
  color: #fff;
}

.glitch::before,
.glitch::after {
  content: attr(data-text);
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.glitch::before {
  left: 2px;
  text-shadow: -2px 0 #ff0099;
  animation: glitch-channel-1 3s infinite linear alternate-reverse;
  will-change: clip-path;
}

.glitch::after {
  left: -2px;
  text-shadow: 2px 0 #00f0ff;
  animation: glitch-channel-2 2s infinite linear alternate-reverse;
  will-change: clip-path;
}

@keyframes glitch-channel-1 {
  0% {
    clip-path: inset(40% 0 61% 0);
  }
  10% {
    clip-path: inset(92% 0 1% 0);
  }
  20% {
    clip-path: inset(43% 0 1% 0);
  }
  30% {
    clip-path: inset(25% 0 58% 0);
  }
  40% {
    clip-path: inset(54% 0 7% 0);
  }
  50% {
    clip-path: inset(58% 0 43% 0);
  }
  60% {
    clip-path: inset(70% 0 7% 0);
  }
  70% {
    clip-path: inset(9% 0 55% 0);
  }
  80% {
    clip-path: inset(18% 0 37% 0);
  }
  90% {
    clip-path: inset(80% 0 4% 0);
  }
  100% {
    clip-path: inset(30% 0 28% 0);
  }
}

@keyframes glitch-channel-2 {
  0% {
    clip-path: inset(25% 0 58% 0);
  }
  10% {
    clip-path: inset(17% 0 76% 0);
  }
  20% {
    clip-path: inset(71% 0 12% 0);
  }
  30% {
    clip-path: inset(84% 0 2% 0);
  }
  40% {
    clip-path: inset(3% 0 46% 0);
  }
  50% {
    clip-path: inset(31% 0 60% 0);
  }
  60% {
    clip-path: inset(48% 0 23% 0);
  }
  70% {
    clip-path: inset(63% 0 18% 0);
  }
  80% {
    clip-path: inset(6% 0 83% 0);
  }
  90% {
    clip-path: inset(42% 0 41% 0);
  }
  100% {
    clip-path: inset(55% 0 29% 0);
  }
}
```

### Usage Guidelines

| Context | Apply Glitch? |
|---------|---------------|
| Boss names | Yes -- always |
| Corruption warnings (>75%) | Yes |
| Critical system headers | Yes -- sparingly |
| Normal UI labels | No -- never |
| Achievement titles | No -- use neon-text instead |

### Intensity Rules

- **`.cf-minimal`** -- No glitch
- **`.cf-moderate`** -- No glitch
- **`.cf-intense`** -- Glitch active

### Accessibility: prefers-reduced-motion

```css
@media (prefers-reduced-motion: reduce) {
  .glitch::before,
  .glitch::after {
    animation: none;
    clip-path: none;
    text-shadow: none;
  }
}
```

---

## 5. Terminal Text Reveal Animation

Typewriter effect for ARIA game master messages and mission briefings.

### CSS Implementation

```css
.terminal-reveal {
  overflow: hidden;
  white-space: nowrap;
  border-right: 2px solid var(--cf-cyan);
  width: 0;
  animation:
    terminal-typing var(--terminal-speed, 2s) steps(var(--terminal-steps, 40)) forwards,
    terminal-cursor-blink 0.8s step-end infinite;
}

@keyframes terminal-typing {
  0% {
    width: 0;
  }
  100% {
    width: 100%;
  }
}

@keyframes terminal-cursor-blink {
  0%, 100% {
    border-right-color: var(--cf-cyan);
  }
  50% {
    border-right-color: transparent;
  }
}
```

### Configurable Speed

Override via CSS custom properties on the element:

```css
/* Fast reveal (short text) */
.terminal-reveal--fast {
  --terminal-speed: 0.8s;
  --terminal-steps: 20;
}

/* Slow dramatic reveal (boss intro, long message) */
.terminal-reveal--slow {
  --terminal-speed: 4s;
  --terminal-steps: 80;
}
```

### HTML Usage

```html
<p class="terminal-reveal" style="--terminal-steps: 35; --terminal-speed: 1.5s;">
  ARIA: New mission parameters uploaded to your deck.
</p>
```

### Multi-line Terminal (sequential reveal)

For multi-line messages, stagger with `animation-delay`:

```css
.terminal-reveal-line {
  overflow: hidden;
  white-space: nowrap;
  border-right: 2px solid var(--cf-cyan);
  width: 0;
  animation:
    terminal-typing 1.5s steps(40) forwards,
    terminal-cursor-blink 0.8s step-end infinite;
}

.terminal-reveal-line:nth-child(1) { animation-delay: 0s; }
.terminal-reveal-line:nth-child(2) { animation-delay: 1.5s; }
.terminal-reveal-line:nth-child(3) { animation-delay: 3s; }
.terminal-reveal-line:nth-child(4) { animation-delay: 4.5s; }

/* Only show cursor on the currently-typing line */
.terminal-reveal-line:not(:last-child) {
  animation:
    terminal-typing 1.5s steps(40) forwards,
    terminal-cursor-hide 0s 1.5s forwards;
}

@keyframes terminal-cursor-hide {
  to {
    border-right-color: transparent;
  }
}
```

### Intensity Rules

- **`.cf-minimal`** -- No terminal reveal (text appears instantly)
- **`.cf-moderate`** -- No terminal reveal (text appears instantly)
- **`.cf-intense`** -- Full terminal reveal animation

### Accessibility: prefers-reduced-motion

```css
@media (prefers-reduced-motion: reduce) {
  .terminal-reveal,
  .terminal-reveal-line {
    animation: none;
    width: auto;
    overflow: visible;
    white-space: normal;
    border-right: none;
  }
}
```

---

## 6. Corner-Cut Clip Paths

Lightweight alternative to augmented-ui for simple elements like buttons, badges, and small cards. Uses CSS `clip-path` -- no library dependency.

### Size Variants

```css
/* Small (buttons, badges, tags) */
.corner-cut-sm {
  clip-path: polygon(
    8px 0,
    100% 0,
    100% calc(100% - 8px),
    calc(100% - 8px) 100%,
    0 100%,
    0 8px
  );
}

/* Medium (cards, panels) */
.corner-cut-md {
  clip-path: polygon(
    12px 0,
    100% 0,
    100% calc(100% - 12px),
    calc(100% - 12px) 100%,
    0 100%,
    0 12px
  );
}

/* Large (hero panels, boss frames) */
.corner-cut-lg {
  clip-path: polygon(
    20px 0,
    100% 0,
    100% calc(100% - 20px),
    calc(100% - 20px) 100%,
    0 100%,
    0 20px
  );
}
```

### When to Use clip-path vs augmented-ui

| Element | Use |
|---------|-----|
| Buttons | `clip-path` (lighter, no border needed) |
| Badges/Tags | `clip-path` (small, inline) |
| Progress bar containers | `clip-path` (simple shape) |
| Mission cards | `augmented-ui` (needs border + inlay) |
| Boss panels | `augmented-ui` (needs multi-corner shapes) |
| Profile panels | `augmented-ui` (needs gradient borders) |

---

## 7. Font Stacks

### Font Definitions

| Token | Font | Usage | Fallback |
|-------|------|-------|----------|
| `--font-cyber-ui` | `'Rajdhani', sans-serif` | Body text, labels, navigation, form inputs | `system-ui, sans-serif` |
| `--font-cyber-title` | `'Orbitron', sans-serif` | Headings, boss names, level numbers, rank titles | `'Rajdhani', sans-serif` |
| `--font-cyber-data` | `'Space Mono', monospace` | XP numbers, timers, stats, terminal text, code | `'Courier New', monospace` |

### Google Fonts Import

```html
<!-- In index.html <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Rajdhani:wght@300;400;500;600;700&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
```

### CSS Token Definitions

```css
.cyberflow {
  --font-cyber-ui: 'Rajdhani', system-ui, sans-serif;
  --font-cyber-title: 'Orbitron', 'Rajdhani', sans-serif;
  --font-cyber-data: 'Space Mono', 'Courier New', monospace;
}
```

### Weight Recommendations

| Font | Weight | Usage |
|------|--------|-------|
| Rajdhani 300 | Light | Subtle labels, secondary text |
| Rajdhani 400 | Regular | Body text, descriptions |
| Rajdhani 500 | Medium | Navigation items, form labels |
| Rajdhani 600 | SemiBold | Emphasized text, sub-headings |
| Rajdhani 700 | Bold | Primary labels, active states |
| Orbitron 400 | Regular | Small headings, stat labels |
| Orbitron 600 | SemiBold | Section headers |
| Orbitron 700 | Bold | Boss names, level display |
| Orbitron 900 | Black | Hero titles, XP level-up splash |
| Space Mono 400 | Regular | Data values, timer display |
| Space Mono 700 | Bold | Highlighted data, active stats |

### Letter-Spacing Adjustments

Orbitron is geometrically spaced and reads better with slightly wider tracking:

```css
.cyberflow h1, .cyberflow h2, .cyberflow h3 {
  font-family: var(--font-cyber-title);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.cyberflow .stat-value {
  font-family: var(--font-cyber-data);
  letter-spacing: 0.02em;
}

.cyberflow body, .cyberflow p, .cyberflow span {
  font-family: var(--font-cyber-ui);
  letter-spacing: 0.01em;
}
```

---

## 8. Color Palette

### Primary Palette

| Token | Hex | HSL | Usage |
|-------|-----|-----|-------|
| `--cf-cyan` | `#00f0ff` | `184 100% 50%` | Primary, info, borders, UI elements |
| `--cf-magenta` | `#ff0099` | `324 100% 50%` | Danger, boss fights, penalties, corruption high |
| `--cf-lime` | `#39ff14` | `109 100% 54%` | Success, XP gain, completion, health |
| `--cf-orange` | `#ff6b35` | `17 100% 60%` | Warning, corruption mid, streak at risk |
| `--cf-gold` | `#ffd700` | `51 100% 50%` | Achievements, rare items, platinum tier |
| `--cf-purple` | `#9333ea` | `271 81% 56%` | XP bar fill, mystical/rare |

### Dark Backgrounds

| Token | Hex | HSL | Usage |
|-------|-----|-----|-------|
| `--cf-dark-1` | `#050508` | `240 23% 2%` | Deepest background (app bg when cyberflow active) |
| `--cf-dark-2` | `#0a0a12` | `240 25% 5%` | Panel backgrounds |
| `--cf-dark-3` | `#12121a` | `240 17% 8%` | Card backgrounds |
| `--cf-dark-4` | `#1a1a25` | `240 18% 12%` | Elevated surfaces, hover states |

### Opacity Variants

Each primary color has 3 opacity levels:

```css
.cyberflow {
  /* Cyan */
  --cf-cyan: #00f0ff;
  --cf-cyan-50: rgba(0, 240, 255, 0.5);
  --cf-cyan-20: rgba(0, 240, 255, 0.2);

  /* Magenta */
  --cf-magenta: #ff0099;
  --cf-magenta-50: rgba(255, 0, 153, 0.5);
  --cf-magenta-20: rgba(255, 0, 153, 0.2);

  /* Lime */
  --cf-lime: #39ff14;
  --cf-lime-50: rgba(57, 255, 20, 0.5);
  --cf-lime-20: rgba(57, 255, 20, 0.2);

  /* Orange */
  --cf-orange: #ff6b35;
  --cf-orange-50: rgba(255, 107, 53, 0.5);
  --cf-orange-20: rgba(255, 107, 53, 0.2);

  /* Gold */
  --cf-gold: #ffd700;
  --cf-gold-50: rgba(255, 215, 0, 0.5);
  --cf-gold-20: rgba(255, 215, 0, 0.2);

  /* Purple */
  --cf-purple: #9333ea;
  --cf-purple-50: rgba(147, 51, 234, 0.5);
  --cf-purple-20: rgba(147, 51, 234, 0.2);

  /* Backgrounds */
  --cf-dark-1: #050508;
  --cf-dark-2: #0a0a12;
  --cf-dark-3: #12121a;
  --cf-dark-4: #1a1a25;
}
```

### Semantic Color Aliases

```css
.cyberflow {
  --cf-success: var(--cf-lime);
  --cf-danger: var(--cf-magenta);
  --cf-warning: var(--cf-orange);
  --cf-info: var(--cf-cyan);
  --cf-accent: var(--cf-purple);
  --cf-achievement: var(--cf-gold);
}
```

### Color Usage Rules

| Context | Primary Color | Secondary Color |
|---------|---------------|-----------------|
| Task completion | `--cf-lime` | `--cf-cyan` |
| XP gain notification | `--cf-lime` | `--cf-gold` (if large amount) |
| Boss fight active | `--cf-magenta` | `--cf-orange` |
| Boss defeated | `--cf-gold` | `--cf-lime` |
| Mission available | `--cf-cyan` | -- |
| Mission in progress | `--cf-orange` | `--cf-cyan` |
| Mission complete | `--cf-lime` | `--cf-gold` |
| Achievement unlocked | `--cf-gold` | `--cf-purple` (if rare) |
| Shop item affordable | `--cf-gold` | `--cf-lime` |
| Shop item locked | `--cf-dark-4` | `--cf-cyan-20` |
| Corruption 0-25% | `--cf-cyan` | -- |
| Corruption 26-50% | `--cf-orange` | `--cf-cyan` |
| Corruption 51-75% | `--cf-orange` | `--cf-magenta` |
| Corruption 76-100% | `--cf-magenta` | `--cf-orange` |
| Streak active | `--cf-lime` | `--cf-cyan` |
| Streak at risk | `--cf-orange` | `--cf-magenta` |
| Level up | `--cf-gold` | `--cf-purple` |

---

## 9. Intensity Level CSS Architecture

All Cyberflow visual effects are scoped under a `.cyberflow` root class. The intensity level is controlled by an additional class: `.cf-minimal`, `.cf-moderate`, or `.cf-intense`.

### Class Application

The `useCyberflowTheme.ts` composable returns the correct CSS class string based on user settings:

```typescript
// In component setup
const { cyberflowClasses, intensity, prefersReducedMotion } = useCyberflowTheme()
```

```html
<!-- Applied to root gamification container -->
<div :class="cyberflowClasses">
  <!-- All cyberflow content here -->
</div>
```

The computed class will be one of:
- `"cyberflow cf-minimal"`
- `"cyberflow cf-moderate"`
- `"cyberflow cf-intense"`

### CSS Scope Pattern

```css
/* Base tokens -- always active when .cyberflow is present */
.cyberflow {
  /* Color tokens */
  --cf-cyan: #00f0ff;
  --cf-magenta: #ff0099;
  --cf-lime: #39ff14;
  --cf-orange: #ff6b35;
  --cf-gold: #ffd700;
  --cf-purple: #9333ea;
  --cf-dark-1: #050508;
  --cf-dark-2: #0a0a12;
  --cf-dark-3: #12121a;
  --cf-dark-4: #1a1a25;

  /* Font tokens */
  --font-cyber-ui: 'Rajdhani', system-ui, sans-serif;
  --font-cyber-title: 'Orbitron', 'Rajdhani', sans-serif;
  --font-cyber-data: 'Space Mono', 'Courier New', monospace;

  /* Semantic aliases */
  --cf-success: var(--cf-lime);
  --cf-danger: var(--cf-magenta);
  --cf-warning: var(--cf-orange);
  --cf-info: var(--cf-cyan);
}

/* ============================== */
/* MINIMAL -- Colors + Fonts only */
/* ============================== */
.cyberflow.cf-minimal {
  /* No augmented-ui frames */
  /* No neon glow */
  /* No text glow */
  /* No scanlines */
  /* No glitch effects */
  /* No terminal reveal */
  /* No pulse animations */
  /* No corruption overlay */
}

/* Force-disable effects at minimal level */
.cyberflow.cf-minimal .scanlines::before { display: none; }
.cyberflow.cf-minimal .glitch::before,
.cyberflow.cf-minimal .glitch::after { display: none; }
.cyberflow.cf-minimal .terminal-reveal {
  animation: none;
  width: auto;
  overflow: visible;
  white-space: normal;
  border-right: none;
}
.cyberflow.cf-minimal .neon-pulse-cyan,
.cyberflow.cf-minimal .neon-pulse-magenta,
.cyberflow.cf-minimal .neon-pulse-lime,
.cyberflow.cf-minimal .neon-pulse-gold {
  animation: none;
  box-shadow: none;
}

/* ============================================ */
/* MODERATE -- Frames + Subtle glow + Subtle pulse */
/* ============================================ */
.cyberflow.cf-moderate [data-augmented-ui] {
  /* augmented-ui frames active */
}

/* Subtle glow (2 layers, reduced opacity) */
.cyberflow.cf-moderate .neon-cyan {
  box-shadow:
    0 0 5px rgba(0, 240, 255, 0.5),
    0 0 10px rgba(0, 240, 255, 0.2);
}
.cyberflow.cf-moderate .neon-magenta {
  box-shadow:
    0 0 5px rgba(255, 0, 153, 0.5),
    0 0 10px rgba(255, 0, 153, 0.2);
}
.cyberflow.cf-moderate .neon-lime {
  box-shadow:
    0 0 5px rgba(57, 255, 20, 0.5),
    0 0 10px rgba(57, 255, 20, 0.2);
}
.cyberflow.cf-moderate .neon-orange {
  box-shadow:
    0 0 5px rgba(255, 107, 53, 0.5),
    0 0 10px rgba(255, 107, 53, 0.2);
}
.cyberflow.cf-moderate .neon-gold {
  box-shadow:
    0 0 5px rgba(255, 215, 0, 0.5),
    0 0 10px rgba(255, 215, 0, 0.2);
}

/* Subtle pulse (slower, smaller range) */
@keyframes neon-pulse-subtle {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}
.cyberflow.cf-moderate .neon-pulse-cyan,
.cyberflow.cf-moderate .neon-pulse-magenta,
.cyberflow.cf-moderate .neon-pulse-lime,
.cyberflow.cf-moderate .neon-pulse-gold {
  animation: neon-pulse-subtle 3s ease-in-out infinite;
}

/* No scanlines at moderate */
.cyberflow.cf-moderate .scanlines::before { display: none; }

/* No glitch at moderate */
.cyberflow.cf-moderate .glitch::before,
.cyberflow.cf-moderate .glitch::after { display: none; }

/* No terminal reveal at moderate */
.cyberflow.cf-moderate .terminal-reveal {
  animation: none;
  width: auto;
  overflow: visible;
  white-space: normal;
  border-right: none;
}

/* ============================================= */
/* INTENSE -- Everything enabled at full power   */
/* ============================================= */
.cyberflow.cf-intense [data-augmented-ui] {
  /* augmented-ui frames active */
}

/* Full neon glow (4 layers, full opacity) */
.cyberflow.cf-intense .neon-cyan {
  box-shadow:
    0 0 5px #00f0ff,
    0 0 10px #00f0ff,
    0 0 20px #00f0ff,
    0 0 40px #00f0ff;
}
.cyberflow.cf-intense .neon-magenta {
  box-shadow:
    0 0 5px #ff0099,
    0 0 10px #ff0099,
    0 0 20px #ff0099,
    0 0 40px #ff0099;
}
.cyberflow.cf-intense .neon-lime {
  box-shadow:
    0 0 5px #39ff14,
    0 0 10px #39ff14,
    0 0 20px #39ff14,
    0 0 40px #39ff14;
}
.cyberflow.cf-intense .neon-orange {
  box-shadow:
    0 0 5px #ff6b35,
    0 0 10px #ff6b35,
    0 0 20px #ff6b35,
    0 0 40px #ff6b35;
}
.cyberflow.cf-intense .neon-gold {
  box-shadow:
    0 0 5px #ffd700,
    0 0 10px #ffd700,
    0 0 20px #ffd700,
    0 0 40px #ffd700;
}

/* Full text glow */
.cyberflow.cf-intense .neon-text {
  text-shadow:
    0 0 5px currentColor,
    0 0 10px currentColor,
    0 0 20px currentColor,
    0 0 40px currentColor;
}

/* Full pulse */
.cyberflow.cf-intense .neon-pulse-cyan { animation: neon-pulse-cyan 2s ease-in-out infinite; }
.cyberflow.cf-intense .neon-pulse-magenta { animation: neon-pulse-magenta 2s ease-in-out infinite; }
.cyberflow.cf-intense .neon-pulse-lime { animation: neon-pulse-lime 1.5s ease-in-out infinite; }
.cyberflow.cf-intense .neon-pulse-gold { animation: neon-pulse-gold 2.5s ease-in-out infinite; }

/* Scanlines active */
.cyberflow.cf-intense .scanlines::before {
  display: block;
}

/* Glitch active */
.cyberflow.cf-intense .glitch::before,
.cyberflow.cf-intense .glitch::after {
  display: block;
}

/* Terminal reveal active */
.cyberflow.cf-intense .terminal-reveal {
  animation:
    terminal-typing var(--terminal-speed, 2s) steps(var(--terminal-steps, 40)) forwards,
    terminal-cursor-blink 0.8s step-end infinite;
}
```

### Complete Feature Matrix

| CSS Feature | `.cf-minimal` | `.cf-moderate` | `.cf-intense` |
|-------------|---------------|----------------|----------------|
| Font stacks (`--font-cyber-*`) | Yes | Yes | Yes |
| Color tokens (`--cf-*`) | Yes | Yes | Yes |
| Semantic aliases (`--cf-success`, etc.) | Yes | Yes | Yes |
| Corner-cut clip paths | Yes | Yes | Yes |
| augmented-ui frames | No | Yes | Yes |
| Neon glow (box-shadow) | No | Subtle (2 layers, 50% alpha) | Full (4 layers, 100% alpha) |
| Text glow (text-shadow) | No | No | Yes (4 layers) |
| Scanlines overlay | No | No | Yes (with drift animation) |
| Glitch text effect | No | No | Yes (dual channel) |
| Terminal text reveal | No | No | Yes (typewriter + cursor) |
| Pulse glow animation | No | Subtle (opacity only) | Full (shadow expansion) |
| Corruption visual overlay | No | No | Yes |

---

## 10. prefers-reduced-motion Accessibility

Every animation in the Cyberflow system MUST have a `prefers-reduced-motion` fallback. The principle: **keep color and layout, remove motion**.

### Master Reduced-Motion Block

```css
@media (prefers-reduced-motion: reduce) {
  /* Glitch -- remove channel split animation, keep text visible */
  .cyberflow .glitch::before,
  .cyberflow .glitch::after {
    animation: none;
    clip-path: none;
    text-shadow: none;
  }

  /* Scanlines -- remove drift, keep static pattern */
  .cyberflow .scanlines::before {
    animation: none;
    /* Static scanline pattern remains visible */
  }

  /* Neon pulse -- remove pulse, keep static glow */
  .cyberflow .neon-pulse-cyan,
  .cyberflow .neon-pulse-magenta,
  .cyberflow .neon-pulse-lime,
  .cyberflow .neon-pulse-gold {
    animation: none;
  }

  /* Terminal reveal -- show text immediately, no typewriter */
  .cyberflow .terminal-reveal,
  .cyberflow .terminal-reveal-line {
    animation: none;
    width: auto;
    overflow: visible;
    white-space: normal;
    border-right: none;
  }

  /* General transitions -- reduce to instant */
  .cyberflow * {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

### What Stays vs What Goes

| Visual | Reduced Motion | Reason |
|--------|----------------|--------|
| Neon glow (static box-shadow) | Stays | No motion, just color |
| Neon pulse (animated box-shadow) | Removed | Motion |
| Glitch text (channel split) | Removed | Motion + flashing |
| Scanlines (static pattern) | Stays | No motion |
| Scanlines (drift animation) | Removed | Motion |
| Terminal typewriter | Removed | Motion |
| Terminal cursor blink | Removed | Motion |
| Color tokens | Stays | Not motion |
| Font stacks | Stays | Not motion |
| augmented-ui frames | Stays | Not motion |
| Corner-cut clip paths | Stays | Not motion |
| Hover transitions | Near-instant | Reduced to ~0ms |

### Vue Composable Integration

```typescript
// useCyberflowTheme.ts provides:
const { prefersReducedMotion } = useCyberflowTheme()

// Use for JavaScript-driven animations (not CSS)
if (!prefersReducedMotion.value) {
  // Run JS-driven animation (particles, canvas effects, etc.)
}
```

---

## 11. Performance Guidelines

### will-change

Apply `will-change` to frequently animated elements to hint GPU compositing:

```css
/* Glitch pseudo-elements -- frequent clip-path changes */
.glitch::before,
.glitch::after {
  will-change: clip-path;
}

/* Pulse glow -- frequent box-shadow changes */
.neon-pulse-cyan,
.neon-pulse-magenta,
.neon-pulse-lime,
.neon-pulse-gold {
  will-change: box-shadow;
}

/* Terminal reveal -- width animation */
.terminal-reveal {
  will-change: width;
}
```

**Warning:** Do not overuse `will-change`. Only apply to elements that are actively animating. Remove when animation ends.

### Box-Shadow Layer Limits

Multi-layer `box-shadow` is expensive on lower-end devices. Scale down for mobile:

```css
@media (max-width: 768px) {
  .cyberflow.cf-intense .neon-cyan,
  .cyberflow.cf-intense .neon-magenta,
  .cyberflow.cf-intense .neon-lime,
  .cyberflow.cf-intense .neon-orange,
  .cyberflow.cf-intense .neon-gold {
    /* Reduce from 4 layers to 2 on mobile */
    box-shadow:
      0 0 5px currentColor,
      0 0 15px currentColor;
  }
}
```

### GPU-Accelerated Transforms for Glitch

Use `transform: translate3d()` instead of `left` for glitch offset to trigger GPU acceleration:

```css
.glitch::before {
  transform: translate3d(2px, 0, 0);
  /* Instead of: left: 2px; */
}
.glitch::after {
  transform: translate3d(-2px, 0, 0);
  /* Instead of: left: -2px; */
}
```

### Debounce Corruption Level CSS Updates

Corruption level changes trigger class swaps. Debounce to avoid layout thrashing:

```typescript
// In useCyberflowTheme.ts
const debouncedCorruptionClass = useDebounceFn(() => {
  // Update corruption CSS classes
}, 300)
```

### Lazy-Load augmented-ui

Only load augmented-ui CSS when gamification is enabled:

```typescript
// In useCyberflowTheme.ts or gamification init
if (settingsStore.gamificationEnabled) {
  import('augmented-ui/augmented-ui.min.css')
}
```

### Animation Frame Budget

Keep total animation cost under 16ms/frame (60fps target):

| Effect | Approx Cost | Notes |
|--------|-------------|-------|
| box-shadow pulse | ~2ms | Triggers paint, not layout |
| clip-path glitch | ~3ms | Triggers paint |
| Scanline drift | ~1ms | Background-position is cheap |
| Terminal width | ~2ms | Triggers layout -- limit to 1 element |
| augmented-ui render | ~1ms | Static after initial paint |

---

## 12. Integration with Existing Design System

### File Architecture

```
src/assets/
  design-tokens.css           # Existing FlowState tokens (DO NOT MODIFY)
  cyberflow-tokens.css        # Cyberflow tokens (imported AFTER design-tokens.css)
  main.css                    # Import order matters
```

### Import Order (in main.css or equivalent)

```css
/* 1. FlowState base design tokens */
@import './design-tokens.css';

/* 2. Cyberflow tokens (extends, never overrides) */
@import './cyberflow-tokens.css';

/* 3. augmented-ui (conditionally loaded) */
/* @import 'augmented-ui/augmented-ui.min.css'; */
/* Loaded dynamically when gamification enabled */
```

### Scoping Rules

- ALL Cyberflow tokens are defined inside `.cyberflow { }` -- they only exist when the class is present
- ZERO visual bleed to Board, Calendar, or Canvas views
- The `.cyberflow` class is added/removed by `useCyberflowTheme.ts` based on user settings
- `design-tokens.css` variables (e.g., `--overlay-component-bg`) are NEVER modified by Cyberflow
- Cyberflow can READ existing tokens but must define its own aliases

### Composable API

```typescript
// useCyberflowTheme.ts returns:
interface CyberflowTheme {
  /** CSS classes to apply: "cyberflow cf-minimal|cf-moderate|cf-intense" */
  cyberflowClasses: ComputedRef<string>

  /** Current intensity: 'minimal' | 'moderate' | 'intense' */
  intensity: ComputedRef<'minimal' | 'moderate' | 'intense'>

  /** Whether user prefers reduced motion */
  prefersReducedMotion: Ref<boolean>

  /** Whether gamification (and thus Cyberflow) is enabled */
  isEnabled: ComputedRef<boolean>

  /** Current corruption level (0-100) */
  corruptionLevel: ComputedRef<number>

  /** Corruption CSS class: 'cf-corruption-low|mid|high|critical' */
  corruptionClass: ComputedRef<string>
}
```

### Corruption Level Classes

```css
.cyberflow.cf-corruption-low {
  /* 0-25%: Normal -- cyan tints */
}
.cyberflow.cf-corruption-mid {
  /* 26-50%: Warning -- orange tints */
  --cf-info: var(--cf-orange);
}
.cyberflow.cf-corruption-high {
  /* 51-75%: Danger -- magenta bleeds in */
  --cf-info: var(--cf-magenta);
}
.cyberflow.cf-corruption-critical {
  /* 76-100%: Critical -- full magenta, glitch on headers */
  --cf-info: var(--cf-magenta);
  --aug-border-bg: var(--cf-magenta) !important;
}
```

---

## Quick Reference: Copy-Paste Checklist

When building a new Cyberflow component:

1. Wrap in `.cyberflow` scope (via `cyberflowClasses` from composable)
2. Use `--cf-*` color tokens, never hardcoded hex
3. Use `--font-cyber-*` font tokens
4. Add `data-augmented-ui` for panels that need shaped borders
5. Add `data-text` attribute if using `.glitch` class
6. Verify `prefers-reduced-motion` fallback for any animation
7. Test at all 3 intensity levels (minimal, moderate, intense)
8. Test with DevTools "Emulate CSS media: prefers-reduced-motion: reduce"
9. Check mobile viewport -- reduce box-shadow layers if needed
10. Confirm no CSS bleeds outside `.cyberflow` scope