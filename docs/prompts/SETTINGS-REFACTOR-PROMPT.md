# Settings System Refactor Prompt

**Task ID**: TASK-193
**Priority**: P2
**Estimated Effort**: 12-16 hours
**Dependencies**: Follow patterns from TASK-191 (Board View) and TASK-192 (Calendar View)

---

## Context

You are refactoring the Settings system in a Vue 3 + TypeScript + Pinia application. The Settings system currently scores **5.8/10** in a tech debt audit with issues including a monolithic modal, scattered persistence logic, and broken/inconsistent i18n.

**Goal**: Extract tab components, unify settings persistence, fix i18n consistency, and improve maintainability - WITHOUT breaking existing functionality.

---

## Current State (Problems to Fix)

### File Overview

| File | LOC | Issues |
|------|-----|--------|
| `src/components/layout/SettingsModal.vue` | 690 | Monolithic - all 4 tabs inline, 350+ lines CSS |
| `src/components/settings/LanguageSettings.vue` | 387 | Uses i18n, excessive CSS |
| `src/stores/ui.ts` | 340 | Mixed concerns (UI + settings) |
| `src/stores/timer.ts` | ~466 | Timer settings embedded |

**Total**: ~1,883 LOC across 4 files

### Critical Issues

#### 1. Monolithic Modal (690 LOC)
**Location**: `SettingsModal.vue`

All 4 tabs are defined inline in a single component:
- Timer tab (~70 lines template)
- Appearance tab (~35 lines template)
- Workflow tab (~65 lines template)
- Account tab (~35 lines template)
- CSS (~350 lines)

**Problem**: Hard to maintain, test, or extend individual tabs.

#### 2. Dual Persistence (localStorage + Stores)
**Location**: `SettingsModal.vue:283-336`

```typescript
// ❌ CURRENT - Direct localStorage access in component
onMounted(() => {
  const savedSettings = localStorage.getItem('pomo-flow-kanban-settings')
  if (savedSettings) {
    const settings = JSON.parse(savedSettings)
    showDoneColumn.value = settings.showDoneColumn || false
  }
})

const saveSettings = () => {
  localStorage.setItem('pomo-flow-settings', JSON.stringify(timerStore.settings))
}

const saveKanbanSettings = () => {
  localStorage.setItem('pomo-flow-kanban-settings', JSON.stringify(settings))
  // Custom event for cross-component communication
  window.dispatchEvent(new CustomEvent('kanban-settings-changed', { ... }))
}
```

**Problems**:
- Settings persistence scattered (some in stores, some direct localStorage)
- CustomEvent for settings changes (tight coupling)
- No single source of truth

#### 3. Inconsistent i18n
**Location**: `LanguageSettings.vue` vs `SettingsModal.vue`

- LanguageSettings.vue: Uses `$t('settings.language')` i18n
- SettingsModal.vue: All strings hardcoded ("Timer", "Appearance", etc.)
- Mixed approach makes translation incomplete

#### 4. Settings Scattered Across Stores

| Setting | Current Location |
|---------|-----------------|
| Timer durations | `timerStore.settings` |
| Power group mode | `uiStore.powerGroupOverrideMode` |
| Board density | `uiStore.boardDensity` |
| Show done column | `localStorage` (not in store!) |
| Language/direction | `LanguageSettings` local state |

---

## Target Architecture

### New File Structure

```
src/
├── components/
│   └── settings/
│       ├── SettingsModal.vue          # ~150 LOC - Shell/layout only
│       ├── tabs/
│       │   ├── TimerSettingsTab.vue   # ~120 LOC
│       │   ├── AppearanceSettingsTab.vue # ~100 LOC
│       │   ├── WorkflowSettingsTab.vue   # ~120 LOC
│       │   └── AccountSettingsTab.vue    # ~80 LOC
│       ├── LanguageSettings.vue       # Keep, reduce CSS
│       └── SettingsSection.vue        # Reusable section wrapper
├── composables/
│   └── settings/
│       ├── useSettingsState.ts        # Central settings state
│       └── useSettingsPersistence.ts  # Unified localStorage handling
├── stores/
│   └── settings.ts                    # NEW - Dedicated settings store
```

### Settings Store (Single Source of Truth)

```typescript
// src/stores/settings.ts
import { defineStore } from 'pinia'

interface AppSettings {
  // Timer
  workDuration: number
  shortBreakDuration: number
  longBreakDuration: number
  autoStartBreaks: boolean
  autoStartPomodoros: boolean
  playNotificationSounds: boolean

  // Workflow
  showDoneColumn: boolean
  powerGroupOverrideMode: 'always' | 'only_empty' | 'ask'
  boardDensity: 'comfortable' | 'compact' | 'ultrathin'

  // Appearance
  language: string
  textDirection: 'auto' | 'ltr' | 'rtl'
  theme: 'light' | 'dark' | 'system'
}

export const useSettingsStore = defineStore('settings', {
  state: (): AppSettings => ({
    // Timer defaults
    workDuration: 25 * 60,
    shortBreakDuration: 5 * 60,
    longBreakDuration: 15 * 60,
    autoStartBreaks: false,
    autoStartPomodoros: false,
    playNotificationSounds: true,

    // Workflow defaults
    showDoneColumn: true,
    powerGroupOverrideMode: 'only_empty',
    boardDensity: 'comfortable',

    // Appearance defaults
    language: 'en',
    textDirection: 'auto',
    theme: 'system'
  }),

  actions: {
    loadFromStorage() {
      const saved = localStorage.getItem('pomo-flow-settings-v2')
      if (saved) {
        const parsed = JSON.parse(saved)
        Object.assign(this.$state, parsed)
      }
    },

    saveToStorage() {
      localStorage.setItem('pomo-flow-settings-v2', JSON.stringify(this.$state))
    },

    updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
      this.$state[key] = value
      this.saveToStorage()
    }
  }
})
```

---

## Implementation Phases

### Phase 1: Create Settings Store (2-3 hours)

**Create**: `src/stores/settings.ts`

1. Define unified `AppSettings` interface
2. Implement load/save from localStorage
3. Create `updateSetting` action
4. Add migration from old localStorage keys

```typescript
// Migration from old keys
loadFromStorage() {
  // Try new key first
  let saved = localStorage.getItem('pomo-flow-settings-v2')

  if (!saved) {
    // Migrate from old keys
    const oldTimerSettings = localStorage.getItem('pomo-flow-settings')
    const oldKanbanSettings = localStorage.getItem('pomo-flow-kanban-settings')

    if (oldTimerSettings || oldKanbanSettings) {
      const migrated = {
        ...JSON.parse(oldTimerSettings || '{}'),
        ...JSON.parse(oldKanbanSettings || '{}')
      }
      this.$state = { ...this.$state, ...migrated }
      this.saveToStorage()

      // Clean up old keys
      localStorage.removeItem('pomo-flow-settings')
      localStorage.removeItem('pomo-flow-kanban-settings')
    }
  } else {
    Object.assign(this.$state, JSON.parse(saved))
  }
}
```

### Phase 2: Extract Tab Components (4-5 hours)

**Create directory**: `src/components/settings/tabs/`

#### 2.1 TimerSettingsTab.vue

```vue
<script setup lang="ts">
import { useSettingsStore } from '@/stores/settings'
import { useTimerStore } from '@/stores/timer'

const settingsStore = useSettingsStore()
const timerStore = useTimerStore()

const workDurations = [15, 20, 25, 30]
const shortBreakDurations = [3, 5, 10]
const longBreakDurations = [10, 15, 20]

const updateWorkDuration = (minutes: number) => {
  settingsStore.updateSetting('workDuration', minutes * 60)
  timerStore.settings.workDuration = minutes * 60
}
// ... similar for other duration updates
</script>

<template>
  <div class="timer-settings-tab">
    <SettingsSection title="🍅 Pomodoro Settings">
      <SettingsDurationPicker
        label="Work Duration"
        :options="workDurations"
        :value="settingsStore.workDuration / 60"
        @update="updateWorkDuration"
      />
      <!-- ... other settings -->
    </SettingsSection>
  </div>
</template>
```

#### 2.2 AppearanceSettingsTab.vue

```vue
<script setup lang="ts">
import { useSettingsStore } from '@/stores/settings'
import { useTimerStore } from '@/stores/timer'
import LanguageSettings from '../LanguageSettings.vue'

const settingsStore = useSettingsStore()
const timerStore = useTimerStore()
</script>

<template>
  <div class="appearance-settings-tab">
    <SettingsSection title="🎨 Interface Settings">
      <SettingsToggle
        label="Sound effects"
        :value="settingsStore.playNotificationSounds"
        @update="val => settingsStore.updateSetting('playNotificationSounds', val)"
      />
      <div class="sound-test-buttons">
        <button @click="timerStore.playStartSound">🔊 Test start</button>
        <button @click="timerStore.playEndSound">🔔 Test end</button>
      </div>
    </SettingsSection>

    <SettingsSection>
      <LanguageSettings />
    </SettingsSection>
  </div>
</template>
```

#### 2.3 WorkflowSettingsTab.vue

```vue
<script setup lang="ts">
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()

const powerGroupModes = [
  { value: 'always', label: 'Always update' },
  { value: 'only_empty', label: 'Only if empty' },
  { value: 'ask', label: 'Ask each time' }
]
</script>

<template>
  <div class="workflow-settings-tab">
    <SettingsSection title="📋 Kanban Settings">
      <SettingsToggle
        label="Show 'Done' column"
        description="Hide the done column to reduce visual clutter"
        :value="settingsStore.showDoneColumn"
        @update="val => settingsStore.updateSetting('showDoneColumn', val)"
      />
    </SettingsSection>

    <SettingsSection title="🎨 Canvas Settings">
      <SettingsOptionPicker
        label="Power Group Behavior"
        description="When dropping tasks on power groups"
        :options="powerGroupModes"
        :value="settingsStore.powerGroupOverrideMode"
        @update="val => settingsStore.updateSetting('powerGroupOverrideMode', val)"
      />
    </SettingsSection>
  </div>
</template>
```

#### 2.4 AccountSettingsTab.vue

```vue
<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { LogOut } from 'lucide-vue-next'

const authStore = useAuthStore()
const emit = defineEmits<{ 'close-modal': [] }>()

const handleSignOut = async () => {
  await authStore.signOut()
  emit('close-modal')
}
</script>

<template>
  <div class="account-settings-tab">
    <SettingsSection title="👤 Account Settings">
      <div v-if="authStore.isAuthenticated" class="account-info">
        <div class="user-email">{{ authStore.user?.email }}</div>
        <div class="user-status">Logged in via Supabase</div>
        <button class="logout-btn" @click="handleSignOut">
          <LogOut :size="16" />
          <span>Log Out</span>
        </button>
      </div>
      <div v-else class="guest-info">
        <div class="status-badge">Guest Mode</div>
        <p>Create an account to sync across devices.</p>
      </div>
    </SettingsSection>
  </div>
</template>
```

### Phase 3: Create Reusable Settings Components (2-3 hours)

#### SettingsSection.vue

```vue
<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<template>
  <section class="settings-section">
    <h3 v-if="title" class="section-title">{{ title }}</h3>
    <slot />
  </section>
</template>

<style scoped>
.settings-section {
  margin-bottom: var(--space-6);
}
.section-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-4);
}
</style>
```

#### SettingsToggle.vue

```vue
<script setup lang="ts">
defineProps<{
  label: string
  description?: string
  value: boolean
}>()

const emit = defineEmits<{
  update: [value: boolean]
}>()
</script>

<template>
  <div class="setting-toggle">
    <label class="toggle-label">
      <input
        type="checkbox"
        :checked="value"
        @change="emit('update', ($event.target as HTMLInputElement).checked)"
      >
      <span class="toggle-slider" />
      {{ label }}
    </label>
    <p v-if="description" class="setting-description">{{ description }}</p>
  </div>
</template>
```

#### SettingsDurationPicker.vue

```vue
<script setup lang="ts">
defineProps<{
  label: string
  options: number[]
  value: number
  suffix?: string
}>()

const emit = defineEmits<{
  update: [value: number]
}>()
</script>

<template>
  <div class="setting-group">
    <label class="setting-label">{{ label }}</label>
    <div class="duration-options">
      <button
        v-for="option in options"
        :key="option"
        class="duration-btn"
        :class="{ active: value === option }"
        @click="emit('update', option)"
      >
        {{ option }}{{ suffix || 'm' }}
      </button>
    </div>
  </div>
</template>
```

### Phase 4: Refactor SettingsModal.vue (2-3 hours)

After extracting tabs, SettingsModal.vue becomes a simple shell:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { X, Timer, Palette, Layout, User } from 'lucide-vue-next'

// Tab components
import TimerSettingsTab from './tabs/TimerSettingsTab.vue'
import AppearanceSettingsTab from './tabs/AppearanceSettingsTab.vue'
import WorkflowSettingsTab from './tabs/WorkflowSettingsTab.vue'
import AccountSettingsTab from './tabs/AccountSettingsTab.vue'

defineProps<{ isOpen: boolean }>()
const emit = defineEmits<{ close: [] }>()

const activeTab = ref('timer')
const tabs = [
  { id: 'timer', label: 'Timer', icon: Timer, component: TimerSettingsTab },
  { id: 'appearance', label: 'Appearance', icon: Palette, component: AppearanceSettingsTab },
  { id: 'workflow', label: 'Workflow', icon: Layout, component: WorkflowSettingsTab },
  { id: 'account', label: 'Account', icon: User, component: AccountSettingsTab }
]

const currentTab = computed(() => tabs.find(t => t.id === activeTab.value))
</script>

<template>
  <div v-if="isOpen" class="settings-overlay" @click="emit('close')">
    <div class="settings-modal" @click.stop>
      <header class="settings-header">
        <h2>Settings</h2>
        <button class="close-btn" @click="emit('close')">
          <X :size="16" />
        </button>
      </header>

      <div class="settings-layout">
        <aside class="settings-sidebar">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="tab-btn"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <component :is="tab.icon" :size="18" />
            <span>{{ tab.label }}</span>
          </button>
        </aside>

        <main class="settings-content">
          <Transition name="tab-fade" mode="out-in">
            <component
              :is="currentTab?.component"
              :key="activeTab"
              @close-modal="emit('close')"
            />
          </Transition>
        </main>
      </div>
    </div>
  </div>
</template>
```

**Target**: ~150 LOC (down from 690)

### Phase 5: Remove CustomEvent Pattern (1-2 hours)

**Current**: Settings changes emit CustomEvents that components listen to

```typescript
// ❌ CURRENT - In SettingsModal.vue
window.dispatchEvent(new CustomEvent('kanban-settings-changed', { ... }))

// ❌ CURRENT - In BoardView.vue
window.addEventListener('kanban-settings-changed', handleKanbanSettingsChange)
```

**Fix**: Use reactive store that components watch

```typescript
// ✅ FIXED - In BoardView.vue
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()

// Reactive - automatically updates when store changes
const showDoneColumn = computed(() => settingsStore.showDoneColumn)
```

Remove from:
- `SettingsModal.vue:333-335` - CustomEvent dispatch
- `BoardView.vue:196-197` - addEventListener
- `BoardView.vue:200-201` - removeEventListener
- `useBoardDensity.ts` - event listener handling

### Phase 6: Extract CSS (Optional, 1-2 hours)

If time permits, extract CSS to separate files:

```
src/components/settings/
├── styles/
│   ├── settings-modal.css
│   ├── settings-toggle.css
│   └── settings-section.css
```

Or convert to Tailwind utilities for consistency.

---

## Verification Checklist

### After Each Phase

- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] Settings modal opens correctly

### Full Manual Testing

- [ ] Open Settings modal
- [ ] Switch between all 4 tabs
- [ ] Change timer work duration → verify timer uses new value
- [ ] Change short/long break durations
- [ ] Toggle auto-start breaks/pomodoros
- [ ] Toggle sound effects → test sounds work
- [ ] Change language (if i18n working)
- [ ] Toggle "Show Done column" → verify Board View updates
- [ ] Change Power Group behavior → verify Canvas respects setting
- [ ] Log out (if authenticated) → verify redirect
- [ ] Close and reopen settings → verify values persisted
- [ ] Refresh page → verify settings persist

### Migration Testing

- [ ] Clear localStorage
- [ ] Set old format settings: `localStorage.setItem('pomo-flow-settings', '{...}')`
- [ ] Open app → verify migration to new format
- [ ] Verify old keys removed

---

## Success Criteria

| Metric | Before | Target |
|--------|--------|--------|
| SettingsModal.vue | 690 LOC | <150 LOC |
| Tab components | 0 | 4 (each <120 LOC) |
| Reusable components | 0 | 3+ |
| Settings store | scattered | 1 unified store |
| CustomEvent usage | 2 | 0 |
| localStorage access points | 4+ | 1 (in store) |
| Health Score | 5.8/10 | 7.5+/10 |

---

## Files to Create

- `src/stores/settings.ts`
- `src/components/settings/tabs/TimerSettingsTab.vue`
- `src/components/settings/tabs/AppearanceSettingsTab.vue`
- `src/components/settings/tabs/WorkflowSettingsTab.vue`
- `src/components/settings/tabs/AccountSettingsTab.vue`
- `src/components/settings/SettingsSection.vue`
- `src/components/settings/SettingsToggle.vue`
- `src/components/settings/SettingsDurationPicker.vue`
- `src/components/settings/SettingsOptionPicker.vue`

## Files to Modify

- `src/components/layout/SettingsModal.vue` (690 → ~150 LOC)
- `src/views/BoardView.vue` (remove CustomEvent listener)
- `src/composables/board/useBoardDensity.ts` (use settings store)
- `src/stores/ui.ts` (move settings to new store)
- `src/stores/timer.ts` (reference settings store)

## Files to Potentially Remove

- Old localStorage keys (via migration)

---

## Order of Operations

1. **Phase 1** - Create settings store (foundation)
2. **Phase 2** - Extract tab components (biggest impact)
3. **Phase 3** - Create reusable components
4. **Phase 4** - Refactor SettingsModal shell
5. **Phase 5** - Remove CustomEvent pattern
6. **Phase 6** - Extract CSS (optional)

Commit after each phase for easy rollback.

---

## Reference Patterns

### From Board View Refactor (TASK-191)
- `src/composables/board/useBoardState.ts` - Composable patterns
- `src/components/kanban/card/` - Component extraction

### From Calendar View Refactor (TASK-192)
- `src/utils/calendar/overlapCalculation.ts` - Shared utilities

---

## IMPORTANT RULES

1. **Preserve all existing settings values** - Migration must be lossless
2. **Do NOT break existing functionality** - Test after each change
3. **One phase at a time** - Complete, test, commit
4. **Remove CustomEvents** - Use reactive stores instead
5. **Update MASTER_PLAN.md** - Mark progress as you go
6. **Commit after each phase** - Small, reversible commits

---

## Getting Started

```bash
# 1. Create a new branch
git checkout -b refactor/settings-TASK-193

# 2. Verify current state works
npm run dev
# Open settings modal, verify all tabs work

# 3. Create settings store first
mkdir -p src/stores
# Create settings.ts with unified state

# 4. Verify existing settings migrate correctly
# Check localStorage before/after

# 5. Start Phase 2 (tab extraction)
mkdir -p src/components/settings/tabs
```

Good luck!
