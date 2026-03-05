# Morning Dashboard Builder

Build the FlowState Morning Dashboard (FEATURE-1443) -- a calm, focused bento-grid landing page that helps users plan their day in under 60 seconds. Glass morphism, gamification integration, zero-config news feed.

**Use this skill when:** Implementing any part of the Morning Dashboard feature, including the view, components, composable, route, or news API integration.

**Design doc:** `docs/designs/FEATURE-1443-morning-dashboard.md`

---

## Architecture

### Component Tree

```
src/views/MorningDashboardView.vue          -- Main view, bento CSS Grid layout
src/components/morning-dashboard/
  MorningGreeting.vue                        -- Greeting + date + motivational quote
  MorningScore.vue                           -- Wraps LevelBadge, XpBar, StreakCounter (compact)
  BigThreeCard.vue                           -- Hero card with 3 commitment slots
  BigThreeSlot.vue                           -- Individual slot (input + display states)
  TaskSuggestionChip.vue                     -- Pill chip for backlog task suggestion
  MorningMissions.vue                        -- Wraps DailyChallengesPanel (compact mode)
  MorningNews.vue                            -- HN top stories list
  NewsCard.vue                               -- Individual news story row
  MorningQuickCapture.vue                    -- Bottom bar inline task creation
src/composables/useMorningDashboard.ts       -- State management, news fetch, suggestions
```

### Existing Components to Reuse (DO NOT recreate)

- `src/components/gamification/StreakCounter.vue` -- Use with `compact` prop
- `src/components/gamification/XpBar.vue` -- Use with `compact` prop
- `src/components/gamification/LevelBadge.vue` -- Use with `size="sm"` prop
- `src/components/gamification/DailyChallengesPanel.vue` -- Use with `compact` prop

### Stores to Import

- `useTaskStore` from `@/stores/tasks` -- Task CRUD, task list
- `useGamificationStore` from `@/stores/gamification` -- XP, level, streak info
- `useChallengesStore` from `@/stores/challenges` -- Daily challenges
- `useTimerStore` from `@/stores/timer` -- Active timer state (optional indicator)
- `useSmartViews` from `@/composables/useSmartViews` -- `isTodayTask()` filter

---

## Design Specification

### Layout: Bento CSS Grid

```css
/* Desktop 1280px+ */
.morning-grid {
  display: grid;
  grid-template-columns: 1fr 300px;
  grid-template-rows: auto auto auto;
  grid-template-areas:
    "greeting    score"
    "big3        big3"
    "missions    news";
  gap: var(--space-4);
  padding: var(--space-6);
  max-width: 1200px;
  margin: 0 auto;
}

/* Tablet 768-1279px */
@media (max-width: 1279px) {
  .morning-grid {
    grid-template-columns: 1fr;
    grid-template-areas:
      "header"
      "big3"
      "bottom";
    padding: var(--space-4);
  }
}

/* Mobile <768px */
@media (max-width: 767px) {
  .morning-grid {
    grid-template-columns: 1fr;
    grid-template-areas:
      "greeting"
      "score"
      "big3"
      "missions"
      "news";
    gap: var(--space-3);
    padding: var(--space-3);
  }
}
```

### Token Usage (MANDATORY)

**Card backgrounds:** `var(--glass-bg-soft)` with `backdrop-filter: blur(12px)`
**Card borders:** `1px solid var(--glass-border)`
**Card border-radius:** `var(--radius-lg)`
**Card padding:** `var(--space-4)` (desktop), `var(--space-3)` (mobile)

**Hero card (Big 3):** `var(--glass-bg-medium)` with `border: 1px solid var(--brand-primary-dim)`

**Text hierarchy:**
- Greeting name: `--text-2xl`, `--font-semibold`, `--text-primary`
- Date: `--text-base`, `--font-normal`, `--text-tertiary`
- Quote: `--text-sm`, italic, `--text-muted`
- Section headers: `--text-lg`, `--font-semibold`, `--text-primary`
- Body text: `--text-sm`, `--text-secondary`

**BUTTON RULE -- CRITICAL:**
```css
/* ALL buttons must use glass morphism. NEVER solid fill. */
.btn-morning {
  background: var(--glass-bg-soft);
  color: var(--brand-primary);
  border: 1px solid var(--brand-primary);
  backdrop-filter: blur(8px);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-4);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
}
.btn-morning:hover {
  box-shadow: 0 0 var(--space-4) rgba(78, 205, 196, 0.2);
  border-color: var(--brand-primary);
}
```

### Animations

All wrapped in `@media (prefers-reduced-motion: no-preference)`.

**Card stagger entry:**
```css
.morning-card {
  animation: cardEntry 0.3s ease-out backwards;
}
.morning-card:nth-child(1) { animation-delay: 0ms; }
.morning-card:nth-child(2) { animation-delay: 100ms; }
.morning-card:nth-child(3) { animation-delay: 200ms; }
.morning-card:nth-child(4) { animation-delay: 300ms; }
.morning-card:nth-child(5) { animation-delay: 400ms; }

@keyframes cardEntry {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

**Big 3 slot commit glow:**
```css
@keyframes slotCommit {
  0% { border-color: var(--brand-primary); box-shadow: 0 0 0 rgba(78, 205, 196, 0); }
  50% { box-shadow: 0 0 var(--space-3) rgba(78, 205, 196, 0.3); }
  100% { box-shadow: 0 0 0 rgba(78, 205, 196, 0); }
}
```

**Start My Day pulse (when all 3 ready):**
```css
@keyframes ctaPulse {
  0%, 100% { box-shadow: 0 0 0 rgba(78, 205, 196, 0); }
  50% { box-shadow: 0 0 var(--space-4) rgba(78, 205, 196, 0.25); }
}
```

---

## Implementation Steps

### Step 1: Create the composable

File: `src/composables/useMorningDashboard.ts`

```typescript
import { ref, computed, onMounted } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useSmartViews } from '@/composables/useSmartViews'

interface BigThreeSlot {
  taskId: string | null
  customTitle: string
  committed: boolean
}

interface NewsItem {
  title: string
  url: string
  points: number
  numComments: number
  author: string
  createdAt: string
  objectID: string
}

export function useMorningDashboard() {
  const taskStore = useTaskStore()
  const { isTodayTask } = useSmartViews()

  // Big 3 state -- persisted per day in localStorage
  const todayKey = new Date().toISOString().slice(0, 10) // "2026-03-04"
  const STORAGE_KEY = `flowstate-big3-${todayKey}`

  const slots = ref<BigThreeSlot[]>(loadSlots())
  const allCommitted = computed(() => slots.value.every(s => s.committed))

  function loadSlots(): BigThreeSlot[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved)
    } catch { /* ignore */ }
    return [
      { taskId: null, customTitle: '', committed: false },
      { taskId: null, customTitle: '', committed: false },
      { taskId: null, customTitle: '', committed: false },
    ]
  }

  function saveSlots() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots.value))
  }

  // Task suggestions: today tasks + top priority incomplete
  const suggestions = computed(() => {
    const tasks = taskStore.tasks.filter(t =>
      t.status !== 'done' && !slots.value.some(s => s.taskId === t.id)
    )
    const todayTasks = tasks.filter(t => isTodayTask(t))
    const otherByPriority = tasks
      .filter(t => !isTodayTask(t))
      .sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority))
      .slice(0, 5)
    return [...todayTasks, ...otherByPriority].slice(0, 8)
  })

  // News feed
  const news = ref<NewsItem[]>([])
  const newsLoading = ref(false)

  async function fetchNews() {
    newsLoading.value = true
    try {
      // Check cache first
      const cached = localStorage.getItem('flowstate-hn-cache')
      if (cached) {
        const { data, timestamp } = JSON.parse(cached)
        if (Date.now() - timestamp < 30 * 60 * 1000) {
          news.value = data
          newsLoading.value = false
          return
        }
      }
      const res = await fetch(
        'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=7'
      )
      const json = await res.json()
      news.value = json.hits.map((hit: any) => ({
        title: hit.title,
        url: hit.url,
        points: hit.points,
        numComments: hit.num_comments,
        author: hit.author,
        createdAt: hit.created_at,
        objectID: hit.objectID,
      }))
      localStorage.setItem('flowstate-hn-cache', JSON.stringify({
        data: news.value,
        timestamp: Date.now(),
      }))
    } catch (e) {
      console.warn('[MorningDashboard] News fetch failed:', e)
    } finally {
      newsLoading.value = false
    }
  }

  // Greeting
  const greeting = computed(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    if (hour < 21) return 'Good evening'
    return 'Good night'
  })

  // Quote of the day (seeded by date)
  const quotes = [
    'Focus on progress, not perfection.',
    'Small steps lead to big changes.',
    'Start where you are. Use what you have.',
    'The secret of getting ahead is getting started.',
    'Done is better than perfect.',
    'Energy flows where attention goes.',
    'What you do today matters most.',
    'Discipline is choosing between what you want now and what you want most.',
  ]
  const dailyQuote = computed(() => {
    const day = new Date().getDate() + new Date().getMonth() * 31
    return quotes[day % quotes.length]
  })

  onMounted(() => { fetchNews() })

  return {
    slots, allCommitted, suggestions, news, newsLoading,
    greeting, dailyQuote, saveSlots, fetchNews,
  }
}

function priorityWeight(p: string | undefined): number {
  if (p === 'high') return 3
  if (p === 'medium') return 2
  if (p === 'low') return 1
  return 0
}
```

### Step 2: Create the view

File: `src/views/MorningDashboardView.vue`

Key patterns:
- Use `<div class="morning-grid">` with CSS Grid areas
- Import and compose the morning-dashboard components
- Use `useMorningDashboard()` composable for all state
- Page-level padding via `--content-padding` or `--space-6`
- Wrap in scrollable container with `overflow-y: auto`

### Step 3: Create individual components

Each component in `src/components/morning-dashboard/`:

**MorningGreeting.vue** -- Props: `greeting: string`, `dailyQuote: string`. Display user name from auth store if available, else "there". Show formatted date via `Intl.DateTimeFormat`.

**MorningScore.vue** -- No props. Imports `LevelBadge`, `XpBar`, `StreakCounter` from gamification. All in compact mode. Horizontal layout on desktop, stacked on mobile.

**BigThreeCard.vue** -- Props: `slots: BigThreeSlot[]`, `suggestions: Task[]`. Emits: `update:slots`, `start-day`. The hero card. Contains 3 `BigThreeSlot` instances + suggestion chips + CTA button.

**BigThreeSlot.vue** -- Props: `slot: BigThreeSlot`, `index: number`, `suggestions: Task[]`. Emits: `commit`, `clear`. States: empty (dashed border, input), focused (solid teal border, dropdown), filled (glass bg, task title, x button).

**TaskSuggestionChip.vue** -- Props: `task: Task`. Emits: `select`. Glass pill with task title, truncated. Teal border on hover.

**MorningMissions.vue** -- Thin wrapper around `<DailyChallengesPanel compact />`. Adds section header.

**MorningNews.vue** -- Props: `items: NewsItem[]`, `loading: boolean`. Renders list of `NewsCard`. Shows skeleton placeholders while loading. "Show more" link to HN.

**NewsCard.vue** -- Props: `item: NewsItem`, `rank: number`. Single row: rank + title + metadata. Link opens in new tab. Glass hover effect.

**MorningQuickCapture.vue** -- Reuses pattern from `QuickTaskCreate.vue`. Pinned to bottom of dashboard. Input + Enter to create task.

### Step 4: Add route

File: `src/router/index.ts`

```typescript
{
  path: '/morning',
  name: 'morning',
  component: () => import('@/views/MorningDashboardView.vue'),
  meta: { title: 'Morning Dashboard', requiresAuth: true },
}
```

Add navigation link to the sidebar/nav component.

### Step 5: Wire up "Start My Day"

When user clicks "Start My Day" (all 3 slots committed):
1. Award XP via gamification store (e.g., 25 XP for morning planning)
2. Mark the 3 tasks as "today" tasks if they aren't already
3. Navigate to Board view (or whichever view user prefers)
4. Persist Big 3 state so returning to `/morning` shows committed tasks

---

## API Integration

### Hacker News (Default, Zero-Config)

```
GET https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=7

Response shape:
{
  hits: [{
    title: string,
    url: string | null,
    points: number,
    num_comments: number,
    author: string,
    created_at: string,
    objectID: string
  }]
}
```

- **Rate limit:** None (public API)
- **Auth:** None required
- **Cache:** localStorage with 30-minute TTL
- **Fallback:** Show "Unable to load stories" message, don't break the dashboard

### Weather (Optional, v2)

If user configures OpenWeatherMap API key in Settings:
```
GET https://api.openweathermap.org/data/2.5/weather?q={city}&appid={key}&units=metric
```

Store key in Supabase `user_settings` table (encrypted). Never expose via VITE_ prefix.

### NewsData.io (Optional, v2)

If user configures API key in Settings:
```
GET https://newsdata.io/api/1/news?apikey={key}&language=en&category=technology
```

Same storage approach as weather key.

---

## Testing Checklist

### Visual
- [ ] Glass morphism cards visible on dark background gradient
- [ ] Text readable at all hierarchy levels (primary, secondary, tertiary, muted)
- [ ] Teal (#4ECDC4) used consistently for accents, NOT green
- [ ] No solid-fill buttons anywhere
- [ ] Responsive at 1280px, 1024px, 768px, 375px breakpoints
- [ ] Cards stagger-animate on page load
- [ ] Big 3 slot states: empty, focused, filled -- all visually distinct

### Functional
- [ ] Big 3 persists per day (refresh shows same state)
- [ ] New day resets Big 3 slots
- [ ] Task suggestions come from store (today tasks + priority backlog)
- [ ] Suggestion chip click fills next empty slot
- [ ] "Start My Day" only enabled when all 3 committed
- [ ] "Start My Day" awards XP and navigates to Board
- [ ] News loads from HN without any configuration
- [ ] News cache respects 30-minute TTL
- [ ] Quick capture creates a real task in the store
- [ ] Route `/morning` accessible and requires auth

### Accessibility
- [ ] Tab navigation through Big 3 slots
- [ ] ARIA labels on interactive elements
- [ ] Screen reader announces slot commits
- [ ] All animations disabled with `prefers-reduced-motion: reduce`
- [ ] Color contrast AA on all text

### Gamification Integration
- [ ] StreakCounter shows in compact mode with correct data
- [ ] XpBar shows progress in compact mode
- [ ] LevelBadge shows current level
- [ ] DailyChallengesPanel shows in compact mode
- [ ] XP reward fires on "Start My Day"

### Edge Cases
- [ ] No tasks in store -- suggestions empty, slots still work with custom text
- [ ] News API failure -- graceful fallback message, no crash
- [ ] User not authenticated -- redirect to login
- [ ] Dashboard works in Tauri desktop app (no CORS issues with HN API)
- [ ] Multiple tabs -- localStorage Big 3 state consistent
