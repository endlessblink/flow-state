# 📱 Mobile PWA Design Skill

## When to Use This Skill

Use this skill when:
- Implementing mobile/responsive layouts for FlowState
- Adding new task views on mobile (Inbox, Timer, Calendar)
- Designing quick-add task flows
- Implementing filter/grouping UI on mobile
- Debugging PWA sync issues through tunnel/Caddy proxy
- Optimizing mobile UX for productivity apps

**Triggers**: "mobile design", "PWA layout", "mobile task", "quick add", "mobile filter", "bottom nav", "thumb zone", "mobile sync issue"

## Architecture Overview

### FlowState Mobile Structure

```
src/
├── mobile/
│   ├── layouts/
│   │   └── MobileLayout.vue      # Main mobile shell
│   ├── components/
│   │   └── MobileNav.vue         # Bottom tab navigation
│   └── views/
│       ├── MobileInboxView.vue   # Task list view
│       ├── MobileTimerView.vue   # Pomodoro timer
│       └── (future views)
└── composables/
    └── useMobileDetection.ts     # Device detection
```

### Mobile Detection

```typescript
// src/composables/useMobileDetection.ts
const isMobile = computed(() => {
  const userAgent = navigator.userAgent.toLowerCase()
  const isMobileDevice = /android|webos|iphone|ipad|ipod/i.test(userAgent)
  const isSmallScreen = window.matchMedia('(max-width: 768px)').matches
  return isMobileDevice || isSmallScreen
})
```

### Layout Switching (App.vue)

```vue
<template>
  <MobileLayout v-if="isMobile" />
  <MainLayout v-else />
</template>
```

---

## Design Patterns

### 1. Bottom Navigation (Tab Bar)

**Golden Rules:**
- **3-5 tabs maximum** (thumb zone ergonomics)
- **Persistent visibility** (don't hide on scroll for productivity apps)
- **Icons + labels** (icons alone are often misunderstood)
- **Clear active state** (color + icon style change)

**FlowState Implementation:**

```vue
<!-- MobileNav.vue -->
<nav class="mobile-nav">
  <button v-for="tab in tabs" :class="{ active: isActive(tab) }">
    <component :is="tab.icon" />
    <span>{{ tab.label }}</span>
  </button>
</nav>

<style>
.mobile-nav {
  position: fixed;
  bottom: 0;
  height: 56px;  /* Android: 56dp, iOS: 49pt */
  display: flex;
  justify-content: space-around;
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(var(--blur-lg));
  border-top: 1px solid var(--glass-border);
  z-index: 100;
  padding-bottom: env(safe-area-inset-bottom); /* iPhone notch */
}
</style>
```

**Recommended Tabs for FlowState:**

| Tab | Icon | Purpose |
|-----|------|---------|
| Inbox | 📥 | Quick task list, today's tasks |
| Timer | ⏱️ | Pomodoro timer |
| Calendar | 📅 | Week/day view |
| Menu | ☰ | Settings, projects, filters |

### 2. Quick Add Task

**Pattern: Floating Action Button (FAB) or Persistent Input**

```vue
<!-- Option A: FAB -->
<button class="fab" @click="openQuickAdd">
  <PlusIcon />
</button>

<!-- Option B: Persistent bottom input (preferred for task apps) -->
<div class="quick-add-bar">
  <input
    v-model="newTaskTitle"
    placeholder="Add task..."
    @keyup.enter="createTask"
  />
  <button @click="createTask">
    <SendIcon />
  </button>
</div>
```

**Quick Add UX Principles:**
- **One-tap access** - never more than 1 tap to start adding
- **Minimal fields** - title only, expand for details
- **Smart defaults** - auto-assign to current view/project
- **Haptic feedback** - vibrate on successful add

### 3. Filter & Grouping UI

**Mobile Filter Patterns:**

| Pattern | When to Use |
|---------|-------------|
| **Filter Page** | Many filter options, complex combinations |
| **Side Drawer** | Medium complexity, want to see results while filtering |
| **Chips/Pills** | Few filters, quick toggles |
| **Collapsed Header** | Filtering is secondary to content |

**FlowState Implementation:**

```vue
<!-- Collapsed filter header -->
<div class="filter-header" @click="toggleFilters">
  <span>{{ activeFilterCount }} filters active</span>
  <ChevronIcon :class="{ expanded: filtersOpen }" />
</div>

<Transition name="slide">
  <div v-if="filtersOpen" class="filter-panel">
    <!-- Filter chips -->
    <div class="filter-group">
      <h4>Status</h4>
      <div class="chips">
        <Chip v-for="status in statuses"
              :active="isActive(status)"
              @click="toggleFilter(status)">
          {{ status }}
        </Chip>
      </div>
    </div>

    <button class="clear-all" @click="clearFilters">
      Clear All
    </button>
  </div>
</Transition>
```

**Best Practices:**
- Show number of active filters
- Always provide "Clear All"
- Show result count after filtering
- Group related filters logically
- Primary filters first, advanced collapsed

### 4. Task List on Mobile

**Swipe Actions Pattern:**

```vue
<SwipeableItem
  v-for="task in tasks"
  @swipe-left="completeTask(task)"
  @swipe-right="deleteTask(task)"
>
  <TaskRow :task="task" />
</SwipeableItem>
```

**List Item Guidelines:**
- **Tap target: 48dp minimum** (Google Material)
- **Visual hierarchy**: Title > Due date > Project tag
- **Checkbox on left** (natural swipe-to-complete)
- **Actions on long-press** or swipe

---

## PWA Sync Through Tunnel

### Architecture

```
Phone Browser → Cloudflare Tunnel → Caddy → Supabase (localhost:54321)
```

### Common Issues & Debugging

#### Issue 1: Tasks Not Loading After Sign In

**Possible Causes:**

| Cause | Debug | Fix |
|-------|-------|-----|
| RLS filtering wrong user | Check `user_id` in JWT vs database | Verify same email creates same user |
| Session not persisting | Check localStorage `flowstate-supabase-auth` | Ensure same storage key across domains |
| Auth token expired | Check network requests for 401/403 | Implement token refresh |
| CORS blocking | Check console for CORS errors | Verify Caddyfile CORS headers |

**Debug Commands:**

```javascript
// In browser console after sign in:

// 1. Check user ID
const { data: { user } } = await supabase.auth.getUser()
console.log('User ID:', user?.id)

// 2. Check tasks query
const { data, error } = await supabase.from('tasks').select('*').limit(5)
console.log('Tasks:', data, 'Error:', error)

// 3. Check auth session
console.log('Session:', await supabase.auth.getSession())
```

**Console Logs to Look For:**

```
✅ Good: "[SUPABASE] Loaded 42 tasks"
❌ Bad:  "[SUPABASE] Load failed: 401"
❌ Bad:  "[SUPABASE] Loaded 0 tasks" (when you have tasks on desktop)
```

#### Issue 2: WebSocket/Realtime Not Connecting

**Symptoms:** Tasks created on phone don't appear on desktop in real-time

**Debug:**

```javascript
// Check realtime connection
supabase.channel('tasks').subscribe((status) => {
  console.log('Realtime status:', status)
})
```

**Fix:** Ensure Caddyfile has WebSocket headers:

```caddyfile
reverse_proxy http://host.docker.internal:54321 {
    header_up Connection {header.Connection}
    header_up Upgrade {header.Upgrade}
}
```

---

## CSS Tokens for Mobile

```css
/* Mobile-specific design tokens */
:root {
  /* Touch targets */
  --touch-target-min: 48px;
  --touch-target-comfortable: 56px;

  /* Safe areas (iPhone notch) */
  --safe-area-top: env(safe-area-inset-top);
  --safe-area-bottom: env(safe-area-inset-bottom);

  /* Mobile spacing */
  --mobile-padding: 16px;
  --mobile-nav-height: 56px;

  /* Mobile typography */
  --mobile-title: 20px;
  --mobile-body: 16px;
  --mobile-caption: 14px;
}

/* Apply safe areas */
.mobile-layout {
  padding-top: var(--safe-area-top);
  padding-bottom: calc(var(--mobile-nav-height) + var(--safe-area-bottom));
}
```

---

## Implementation Checklist

### New Mobile View

- [ ] Create view in `src/mobile/views/`
- [ ] Add route in `src/router/index.ts`
- [ ] Add tab in `MobileNav.vue` (if primary view)
- [ ] Test on actual device (not just browser resize)
- [ ] Test with tunnel URL
- [ ] Verify touch targets (48dp minimum)
- [ ] Add safe area padding

### Quick Add Implementation

- [ ] One-tap access from any view
- [ ] Keyboard-friendly (auto-focus input)
- [ ] Smart defaults (current project, today's date)
- [ ] Success feedback (haptic/visual)
- [ ] Sync to Supabase immediately

### Filter Implementation

- [ ] Clear active filter indication
- [ ] "Clear All" button
- [ ] Result count display
- [ ] Collapse by default on mobile
- [ ] Remember filter state

---

## References

**Design Patterns:**
- [Mobile Filter UX Design Patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-mobile-filters)
- [Bottom Navigation Golden Rules](https://www.smashingmagazine.com/2016/11/the-golden-rules-of-mobile-navigation-design/)
- [Filter UI Examples for SaaS](https://www.eleken.co/blog-posts/filter-ux-and-ui-for-saas)

**PWA Best Practices:**
- [MDN Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [PWA Design Practices](https://www.gomage.com/blog/pwa-design/)

**Platform Guidelines:**
- [Material Design - Navigation](https://m3.material.io/components/navigation-bar)
- [Apple HIG - Tab Bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)

---

## Related SOPs

- **SOP-013**: Cloudflare Tunnel with Local Supabase
- **SOP-014**: Tauri Supabase Detection Fix

---
**Created**: 2026-01-21
**Author**: Claude Code
**Status**: Active
