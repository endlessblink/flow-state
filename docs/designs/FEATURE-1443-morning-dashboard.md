# FEATURE-1443: Morning Dashboard Design Specification

## Overview

A calm, focused morning landing page that helps users plan their day in under 60 seconds. Bento grid layout with glass morphism, progressive disclosure, and playful gamification integration.

**Design Philosophy:** "Calm cockpit" -- show just enough to orient, never overwhelm. Each widget scannable in 3 seconds (Apple's Liquid Glass principle). Morning ritual feel inspired by Fabulous app.

---

## ASCII Mockups

### Desktop Layout (1280px+)

```
+============================================================================+
|  MORNING DASHBOARD                                        [Collapse] [Nav] |
+============================================================================+
|                                                                            |
|  +--------------------------------------+  +---------------------------+  |
|  |                                      |  |     MORNING SCORE         |  |
|  |  Good morning, Alex                  |  |                           |  |
|  |  Tuesday, March 4, 2026              |  |  [LevelBadge]  Level 12   |  |
|  |                                      |  |  [====XpBar=======---]    |  |
|  |  "Focus on progress, not perfection" |  |  2,450 / 3,000 XP        |  |
|  |                                      |  |                           |  |
|  +--------------------------------------+  |  [Flame] 14 days  [Ice]1  |  |
|                                             +---------------------------+  |
|                                                                            |
|  +------------------------------------------------------------------+     |
|  |                                                                    |    |
|  |  YOUR BIG 3 TODAY                              0 of 3 committed   |    |
|  |  ~~~~~~~~~~~~~~~~                                                  |    |
|  |  +------------------------------------------------------+        |    |
|  |  |  1. [   Pick or type your first focus...          ]   |        |    |
|  |  +------------------------------------------------------+        |    |
|  |  +------------------------------------------------------+        |    |
|  |  |  2. [   Pick or type your second focus...         ]   |        |    |
|  |  +------------------------------------------------------+        |    |
|  |  +------------------------------------------------------+        |    |
|  |  |  3. [   Pick or type your third focus...          ]   |        |    |
|  |  +------------------------------------------------------+        |    |
|  |                                                                    |    |
|  |  Suggestions from your backlog:                                   |    |
|  |  [Finish API docs] [Review PR #42] [Update tests] ...            |    |
|  |                                                                    |    |
|  |  [        Start My Day  ->        ]                               |    |
|  |                                                                    |    |
|  +------------------------------------------------------------------+     |
|                                                                            |
|  +-------------------------------+  +-------------------------------+     |
|  |  DAILY MISSIONS        2/3   |  |  TOP STORIES            HN   |     |
|  |                               |  |                               |     |
|  |  [*] Complete 3 tasks   50xp |  |  1. Show HN: New tool...     |     |
|  |  [ ] 25-min focus       75xp |  |  2. Why Rust is taking...    |     |
|  |  [ ] Review a task      30xp |  |  3. The state of AI in...    |     |
|  |                               |  |  4. Database indexing...     |     |
|  |  ACTIVE: 25-min focus         |  |  5. Open source update...   |     |
|  +-------------------------------+  |                               |     |
|                                      |  [Show more...]              |     |
|                                      +-------------------------------+     |
|                                                                            |
+============================================================================+
|  [+  Quick capture a task...]                              [Board] [Cal]  |
+============================================================================+
```

### Tablet Layout (768px - 1279px)

```
+================================================+
|  MORNING DASHBOARD                    [Nav]    |
+================================================+
|                                                 |
|  +-------------------------------------------+ |
|  |  Good morning, Alex           [LvlBadge]  | |
|  |  Tuesday, March 4, 2026                   | |
|  |  [Flame]14d  [XP====----] 2,450/3,000    | |
|  +-------------------------------------------+ |
|                                                 |
|  +-------------------------------------------+ |
|  |  YOUR BIG 3 TODAY              0/3        | |
|  |                                            | |
|  |  1. [  Pick or type first focus...     ]  | |
|  |  2. [  Pick or type second focus...    ]  | |
|  |  3. [  Pick or type third focus...     ]  | |
|  |                                            | |
|  |  Suggestions: [API docs] [PR #42] [...]   | |
|  |  [       Start My Day  ->       ]         | |
|  +-------------------------------------------+ |
|                                                 |
|  +--------------------+ +--------------------+ |
|  | DAILY MISSIONS 2/3 | | TOP STORIES    HN  | |
|  | [*] 3 tasks   50xp | | 1. Show HN:...    | |
|  | [ ] Focus     75xp | | 2. Why Rust...    | |
|  | [ ] Review    30xp | | 3. State of...    | |
|  +--------------------+ +--------------------+ |
|                                                 |
|  [+  Quick capture...]             [Board][Cal] |
+================================================+
```

### Mobile Layout (<768px)

```
+================================+
|  MORNING DASHBOARD       [=]  |
+================================+
|                                 |
|  Good morning, Alex            |
|  Tuesday, March 4              |
|                                 |
|  [LvlBadge] Lv.12  [Flame]14d |
|  [======XpBar=========---]     |
|                                 |
+--------------------------------+
|                                 |
|  YOUR BIG 3 TODAY        0/3  |
|                                 |
|  1. [  First focus...       ] |
|  2. [  Second focus...      ] |
|  3. [  Third focus...       ] |
|                                 |
|  [API docs] [PR #42] [tests] |
|                                 |
|  [     Start My Day  ->     ] |
|                                 |
+--------------------------------+
|                                 |
|  DAILY MISSIONS          2/3  |
|  [*] Complete 3 tasks    50xp |
|  [ ] 25-min focus        75xp |
|  [ ] Review a task       30xp |
|                                 |
+--------------------------------+
|                                 |
|  TOP STORIES              HN  |
|  1. Show HN: New tool...      |
|  2. Why Rust is taking...     |
|  3. The state of AI in...     |
|  [Show more]                   |
|                                 |
+================================+
|  [+  Quick capture...]        |
+================================+
```

---

## Design Specification

### 1. Color & Token Usage

| Section | Background | Border | Text | Accent |
|---------|-----------|--------|------|--------|
| Page | `--app-background-gradient` | -- | -- | -- |
| Greeting card | `var(--glass-bg-soft)` | `var(--glass-border)` | `--text-primary` (name), `--text-tertiary` (date) | -- |
| Morning Score | `var(--glass-bg-soft)` | `var(--glass-border)` | Reuses gamification tokens | `--brand-primary` (teal) |
| Big 3 (hero) | `var(--glass-bg-medium)` | `1px solid var(--brand-primary-dim)` | `--text-primary` | `--brand-primary` for CTA |
| Big 3 slots | `var(--glass-bg-light)` | `var(--border-subtle)` | `--text-secondary` (placeholder), `--text-primary` (filled) | `--brand-primary` on focus |
| Suggestion chips | `var(--glass-bg-light)` | `var(--border-medium)` | `--text-tertiary` | `--brand-primary` on hover |
| Daily Missions | `var(--overlay-component-bg)` | `var(--border-color)` | Reuses DailyChallengesPanel tokens | -- |
| News Headlines | `var(--glass-bg-soft)` | `var(--glass-border)` | `--text-secondary` (titles), `--text-muted` (source) | `--brand-primary` on hover |
| Quick Capture bar | `var(--glass-bg-heavy)` | `var(--border-medium)` | `--text-muted` (placeholder) | -- |
| Start My Day CTA | `var(--glass-bg-soft)` + `backdrop-filter: blur(8px)` | `1px solid var(--brand-primary)` | `var(--brand-primary)` | teal glow on hover |

**CTA Button (Start My Day):** Glass morphism, NEVER solid fill:
```css
background: var(--glass-bg-soft);
color: var(--brand-primary);
border: 1px solid var(--brand-primary);
backdrop-filter: blur(8px);
/* Hover: */
box-shadow: 0 0 var(--space-4) rgba(78, 205, 196, 0.2);
```

### 2. Typography Hierarchy

| Element | Token | Weight | Color |
|---------|-------|--------|-------|
| "Good morning" greeting | `--text-2xl` (1.5rem) | `--font-light` (300) | `--text-primary` |
| User name | `--text-2xl` | `--font-semibold` | `--text-primary` |
| Date line | `--text-base` | `--font-normal` | `--text-tertiary` |
| Motivational quote | `--text-sm` | `--font-normal` italic | `--text-muted` |
| "YOUR BIG 3 TODAY" | `--text-lg` | `--font-semibold` | `--text-primary` |
| Big 3 slot numbers | `--text-lg` | `--font-bold` | `--brand-primary` |
| Big 3 input text | `--text-base` | `--font-medium` | `--text-primary` |
| Section headers | `--text-base` | `--font-semibold` | `--text-primary` |
| News headline | `--text-sm` | `--font-medium` | `--text-secondary` |
| News source/time | `--text-xs` | `--font-normal` | `--text-muted` |
| Counter badges | `--text-sm` | `--font-semibold` | `--text-tertiary` |

### 3. Layout Grid

**Desktop (1280px+):** CSS Grid with named areas
```
grid-template-columns: 1fr 300px;
grid-template-rows: auto auto auto;
grid-template-areas:
  "greeting    score"
  "big3        big3"
  "missions    news";
gap: var(--space-4);
padding: var(--space-6);
```

**Tablet (768-1279px):** Same grid but greeting+score merge into one row
```
grid-template-columns: 1fr;
grid-template-areas:
  "header"
  "big3"
  "bottom";
/* bottom = missions + news side by side via inner flex */
```

**Mobile (<768px):** Single column stack
```
grid-template-columns: 1fr;
/* Everything stacks vertically */
gap: var(--space-3);
padding: var(--space-4);
```

### 4. Animation & Transitions

All animations respect `prefers-reduced-motion`:

| Element | Animation | Duration | Trigger |
|---------|-----------|----------|---------|
| Page entry | Cards stagger fade-in + translateY(8px) | 300ms each, 100ms stagger | Route enter |
| Big 3 slot fill | Border glows teal briefly | 400ms ease-out | Task committed |
| All 3 committed | Subtle confetti particles (5-8 pieces) | 800ms | Third task picked |
| "Start My Day" | Pulse glow when all 3 ready | 2s infinite ease-in-out | All slots filled |
| Suggestion chips | Fade in on mount | 200ms | Mount |
| News items | Skeleton shimmer while loading | -- | Fetch pending |
| Score card numbers | CountUp animation | 600ms | Mount |
| Quick capture expand | Height expand + focus ring | 200ms | Click |

**Stagger entry pattern (already used in gamification views):**
```css
.card { animation: cardEntry 0.3s ease-out backwards; }
.card:nth-child(1) { animation-delay: 0ms; }
.card:nth-child(2) { animation-delay: 100ms; }
.card:nth-child(3) { animation-delay: 200ms; }

@keyframes cardEntry {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### 5. Big 3 Task Interaction Pattern

**Slot States:**
1. **Empty** -- Dashed border (`var(--border-subtle)`), placeholder text, number dimmed
2. **Focused** -- Solid teal border, input active, suggestions dropdown
3. **Filled** -- Glass bg with subtle teal border glow, task title displayed, "x" to clear
4. **All Committed** -- Hero card border pulses teal, "Start My Day" button appears bright

**How users fill slots:**
- Click slot -> Shows inline input + dropdown of "Today" tasks from backlog
- Type to filter existing tasks OR create new
- Click a suggestion chip to auto-fill next empty slot
- Drag to reorder priorities (optional, v2)

**Suggestion source:** `useSmartViews().isTodayTask(task)` for tasks already tagged "today", plus top 5 incomplete tasks by priority from `useTaskStore`.

### 6. News Feed Configuration

**Default (zero-config):** HN Algolia API (free, no auth, unlimited)
- Endpoint: `https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=7`
- Refresh: On dashboard mount + every 30 minutes
- Cache: Store in `localStorage` with 30min TTL

**User-configurable (Settings > Integrations):**
- Additional sources via API key: NewsData.io, OpenWeatherMap
- Toggle news section on/off
- Choose categories (tech, general, science)

**News card structure:**
```
[rank] Title of the article...             [source]
       145 points  |  32 comments  |  2h ago
```

### 7. Progressive Disclosure

| Level | What's Visible | Trigger |
|-------|----------------|---------|
| **Ambient** (default) | Greeting, score summary (compact), Big 3 slots, quick capture | Page load |
| **Engaged** | + Suggestion chips, daily missions, news headlines | Scroll or first interaction |
| **Deep** | + News expanded, mission details, quote of the day | Explicit expand clicks |

On mobile, everything stacks but loads progressively (Big 3 first, then missions after 200ms, news after 400ms).

### 8. Motivational Quotes

Rotate daily from a built-in list of ~30 productivity quotes. No API needed. Stored as a simple array constant. Seeded by date so all devices show the same quote.

---

## Component Architecture

```
MorningDashboardView.vue
  |
  +-- MorningGreeting.vue           (greeting + date + quote)
  +-- MorningScore.vue              (level, XP, streak - wraps existing components)
  |     +-- LevelBadge.vue          (existing, compact mode)
  |     +-- XpBar.vue               (existing, compact mode)
  |     +-- StreakCounter.vue        (existing, compact mode)
  |
  +-- BigThreeCard.vue              (hero card - the main interaction)
  |     +-- BigThreeSlot.vue        (individual slot - input/display)
  |     +-- TaskSuggestionChip.vue  (backlog suggestions)
  |
  +-- MorningMissions.vue           (wraps DailyChallengesPanel compact)
  |     +-- DailyChallengesPanel.vue (existing, compact mode)
  |
  +-- MorningNews.vue               (HN headlines)
  |     +-- NewsCard.vue            (individual story card)
  |
  +-- MorningQuickCapture.vue       (bottom bar quick add)
```

**New files:** 8 components in `src/components/morning-dashboard/` + 1 view + 1 composable

**Composable:** `useMorningDashboard.ts`
- Manages Big 3 state (persisted in localStorage per day)
- Fetches news
- Computes task suggestions
- Tracks "Start My Day" completion
- Emits XP reward on all-3-committed

---

## Accessibility

- All interactive elements keyboard navigable (Tab through Big 3 slots)
- ARIA labels on cards: `aria-label="Priority task slot 1 of 3"`
- Screen reader announces slot fill: `aria-live="polite"`
- News links have descriptive labels
- Color contrast meets WCAG 2.1 AA on all text tokens
- `prefers-reduced-motion` disables all animations

---

## Open Questions for User

1. Should "Start My Day" navigate to Board view, or just dismiss the dashboard?
2. Weather widget -- include in v1 or defer to v2?
3. Should Big 3 tasks auto-save to Supabase or stay local-only until "Start My Day"?
4. Time-of-day greeting cutoffs: Morning (<12), Afternoon (<17), Evening (<21), Night?
