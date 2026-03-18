---
name: gamification-intensity-system
description: "Gamification intensity level architecture for FlowState's Cyberflow RPG. Encodes the minimal/moderate/intense system — CSS class strategy, component visibility matrix, header widget variants, toast filtering, corruption overlay rules, settings UI with live previews, and performance budgets. Use when implementing intensity-aware UI or modifying gamification visibility."
---

# Gamification Intensity Level System

## 1. Core Architecture

The intensity system is the UX contract between the RPG and the productivity app. Users control how much game they see.

**Three levels:**
- `minimal` — Productivity-first. Just a level number in the header. No animations, no glow, no game UI in main views.
- `moderate` — Balanced. Header shows level + XP bar + streak. Toast notifications for XP and level-ups. Nav link to Cyberflow page visible.
- `intense` — Full RPG. All effects active: neon glow, scanlines, glitch text, corruption overlay, animations, the whole cyberpunk experience.

**Existing infrastructure (already in codebase):**
- `settingsStore.gamificationEnabled` — master kill switch (boolean)
- `settingsStore.gamificationIntensity` — `'minimal' | 'moderate' | 'intense'`
- Both stored in `user_settings` Supabase table

---

## 2. CSS Class Strategy

```typescript
// useCyberflowTheme.ts composable
const cyberflowClasses = computed(() => {
  if (!settingsStore.gamificationEnabled) return []
  return ['cyberflow', `cf-${settingsStore.gamificationIntensity}`]
})
```

Applied to: The CyberflowView page root element (NOT the global app root — we don't pollute other views).

**For header widgets:** Individual components check intensity and render conditionally:
```typescript
const showXpBar = computed(() => intensity.value !== 'minimal')
const showStreak = computed(() => intensity.value === 'intense')
const showGlow = computed(() => intensity.value === 'intense')
```

---

## 3. Complete Component Visibility Matrix

This is the single source of truth for what shows at each intensity level. Every intensity-aware component MUST conform to this table.

| Component/Feature | `gamificationEnabled: false` | `minimal` | `moderate` | `intense` |
|---|---|---|---|---|
| **Header: Level badge** | Hidden | Compact number only | Badge with tier color | Badge + tier glow + pulse |
| **Header: XP bar** | Hidden | Hidden | Thin bar, no glow | Full bar + glow + shine animation |
| **Header: Streak counter** | Hidden | Hidden | Hidden | Fire effect + day count |
| **Header: XP balance** | Hidden | Compact number | Number + label | Number + label + gold glow |
| **Sidebar: Cyberflow nav link** | Hidden | Hidden | Visible (icon + text) | Visible + neon glow pulse |
| **Toasts: XP awarded** | None | None | Show (simple style) | Show (cyberpunk style + glow) |
| **Toasts: Level up** | None | None | Show (simple) | Show (full celebration overlay) |
| **Toasts: Achievement unlocked** | None | None | None | Show (cyberpunk toast) |
| **Toasts: Challenge completed** | None | None | None | Show (mission complete sequence) |
| **Toasts: Boss phase change** | None | None | None | Show (dramatic announcement) |
| **Corruption overlay** | None | None | None | Active (visual decay) |
| **Cyberflow page: All panels** | Redirect to home | All visible (plain style) | All visible (moderate style) | All visible (full cyberpunk) |
| **Cyberflow page: Scanlines** | N/A | None | None | Active |
| **Cyberflow page: Glitch effects** | N/A | None | None | Active |
| **Cyberflow page: Terminal text** | N/A | None | None | Active |
| **Cyberflow page: augmented-ui frames** | N/A | None | Active | Active |
| **Level-up overlay** | None | None | None | Full-screen flash + animation |
| **XP pop-ups** | None | None | Subtle fade | Full float + glow |
| **Remotion animations** | None | None | None | Active (boss defeat, etc.) |

---

## 4. Header Widget Variants

### Minimal Header
```html
<span class="cf-level-minimal">Lv.{{ level }}</span>
```
- Just text, no decoration
- Monospace font (Space Mono)
- Subtle text color (--cf-cyan at 70% opacity)
- No click interaction

### Moderate Header
```html
<div class="cf-header-moderate">
  <div class="cf-level-badge-moderate">{{ level }}</div>
  <div class="cf-xp-bar-moderate">
    <div class="cf-xp-fill" :style="{ width: progress + '%' }"></div>
  </div>
</div>
```
- Level in a small rounded badge with tier color
- Thin XP bar below (6px height)
- Click navigates to /cyberflow

### Intense Header
```html
<div class="cf-header-intense">
  <div class="cf-level-badge-intense" data-augmented-ui="all-hex border">{{ level }}</div>
  <div class="cf-xp-bar-intense">
    <div class="cf-xp-fill-glow" :style="{ width: progress + '%' }"></div>
    <span class="cf-xp-text">{{ currentXp }}/{{ nextLevelXp }}</span>
  </div>
  <div class="cf-streak-counter">
    <span class="cf-flame">{{ fireEmoji }}</span>
    <span class="cf-streak-num">{{ streak }}</span>
  </div>
</div>
```
- Hexagonal level badge with glow
- Full XP bar with shine animation
- Streak counter with fire effect
- Click navigates to /cyberflow

---

## 5. Toast Filtering Logic

```typescript
// In GamificationToasts.vue or wherever toasts are dispatched
function shouldShowToast(toast: GamificationToast, intensity: string): boolean {
  if (!gamificationEnabled) return false

  const toastRules: Record<string, string[]> = {
    'xp_awarded': ['moderate', 'intense'],
    'level_up': ['moderate', 'intense'],
    'achievement_unlocked': ['intense'],
    'challenge_completed': ['intense'],
    'challenge_failed': ['intense'],
    'boss_phase_change': ['intense'],
    'corruption_tier_change': ['intense'],
    'streak_milestone': ['moderate', 'intense'],
    'shop_purchase': ['intense'],
  }

  return toastRules[toast.type]?.includes(intensity) ?? false
}
```

---

## 6. Corruption Overlay Activation Rules

- **ONLY active at `intense` level** — this is critical for non-intrusion
- At `minimal` and `moderate`: corruption still TRACKED in the store (so switching to intense shows the correct state), but NO visual effects applied
- Corruption overlay applies to the GLOBAL layout (MainLayout.vue), not just Cyberflow page
- Implementation:
```typescript
// In MainLayout.vue
const showCorruptionOverlay = computed(() =>
  gamificationEnabled &&
  intensity === 'intense' &&
  corruptionLevel > 20 // Clean tier (0-20) has no visual effect
)
```

---

## 7. Settings UI with Live Preview

### Settings Location
Add to Settings > General tab (or create new "Gamification" tab if complex enough):

```
Gamification
|-- Enable Gamification     [toggle]    <-- master switch
|-- Intensity Level         [minimal | moderate | intense]    <-- cards below
|   +------------+ +------------+ +------------+
|   | MINIMAL    | | MODERATE   | | INTENSE    |
|   |            | |            | |            |
|   | Lv.12      | | [===] 12   | | [glow]     |
|   |            | | streak 5d  | | scanlines  |
|   | Just a     | | XP bar +   | | Full RPG   |
|   | number     | | notifs     | | effects    |
|   +------------+ +------------+ +------------+
|-- Show XP Notifications   [toggle] (only visible at moderate+)
|-- Show Achievement Popups [toggle] (only visible at intense)
+-- Auto-accept Missions    [toggle] (future feature placeholder)
```

### Preview Cards Implementation
Each card should be a mini-preview showing what that intensity level looks like:
- `minimal`: Just "Lv.12" text
- `moderate`: Small XP bar + level badge + "5 day streak"
- `intense`: Glow effects + scanline overlay + mini corruption bar

Clicking a card selects that level and updates the setting immediately.

---

## 8. Performance Budget Per Intensity Level

| Metric | `minimal` | `moderate` | `intense` |
|--------|-----------|------------|-----------|
| Extra CSS loaded | ~2KB (tokens only) | ~8KB (tokens + augmented-ui) | ~15KB (all effects) |
| Box-shadow layers | 0 | 1 per element | 4 per element |
| Active animations | 0 | 1-2 (XP bar shine) | 5-8 (scanlines, glitch, pulse, etc.) |
| DOM elements added | 1 (level text) | 5-8 (badges, bars) | 15-20 (overlays, effects, counters) |
| GPU layers (will-change) | 0 | 0-1 | 3-5 |
| Remotion player | Not loaded | Not loaded | Lazy-loaded on trigger |

### Lazy Loading Strategy
```typescript
// Only load heavy effects at intense level
const CyberLevelUp = intensity === 'intense'
  ? defineAsyncComponent(() => import('./CyberLevelUp.vue'))
  : null

const RemotionPlayer = intensity === 'intense'
  ? defineAsyncComponent(() => import('./RemotionBridge.vue'))
  : null
```

---

## 9. Transition Between Intensity Levels

When user changes intensity in settings:
1. New CSS classes apply immediately
2. Elements that should hide: fade out (200ms opacity transition)
3. Elements that should appear: fade in (300ms, staggered 50ms)
4. Heavy effects (scanlines, corruption): 500ms fade for smooth transition
5. No page reload needed — all reactive via computed properties

```css
.cf-transition-element {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.cf-transition-element.cf-hidden {
  opacity: 0;
  transform: scale(0.95);
  pointer-events: none;
}
```

---

## 10. Route Guards

```typescript
// In router/index.ts
{
  path: '/cyberflow',
  component: CyberflowView,
  beforeEnter: (to, from, next) => {
    const settings = useSettingsStore()
    if (!settings.gamificationEnabled) {
      next('/') // Redirect to home if gamification disabled
    } else {
      next()
    }
  }
}
```

---

## 11. Kill Switch Behavior

When `gamificationEnabled` is set to `false`:
- ALL gamification UI hidden instantly (no fade)
- Toasts queue cleared
- Corruption overlay removed
- Sidebar nav link hidden
- /cyberflow route redirects to /
- Stores continue to track data in background (so re-enabling preserves progress)
- No data is deleted

---

## 12. Testing Checklist

For every intensity-aware component, test:
- [ ] `gamificationEnabled: false` — component invisible
- [ ] `minimal` — only minimal elements visible
- [ ] `moderate` — moderate elements visible, intense-only hidden
- [ ] `intense` — all elements visible
- [ ] Switching levels — smooth transitions, no flicker
- [ ] `prefers-reduced-motion` + `intense` — animations disabled but layout preserved
- [ ] Route guard: /cyberflow redirects when disabled
- [ ] Performance: minimal adds <5ms to render, intense adds <20ms
