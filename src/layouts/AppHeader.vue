<template>
  <header class="app-header">
    <div class="header-section">
      <!-- USER PROFILE (Left side) - Firebase Auth disabled -->
      <div class="user-profile-container">
        <!-- UserProfile v-if="authStore.isAuthenticated" /-->
      </div>

      <div class="page-title">
        <h1 class="title-main">
          {{ pageTitleInfo.main }}
        </h1>
        <span v-if="pageTitleInfo.filter" class="title-filter" dir="auto">
          <template v-if="typeof pageTitleInfo.filter === 'object' && pageTitleInfo.filter.type === 'project'">
            <!-- Emoji Indicator -->
            <ProjectEmojiIcon
              v-if="pageTitleInfo.filter.project?.colorType === 'emoji'"
              :emoji="pageTitleInfo.filter.project.emoji || ''"
              size="sm"
              :title="`Project: ${pageTitleInfo.filter.project.name}`"
              class="project-emoji-header"
            />
            <!-- Color Indicator -->
            <span
              v-else
              class="project-color-header"
              :style="{ backgroundColor: Array.isArray(pageTitleInfo.filter.project?.color) ? pageTitleInfo.filter.project.color[0] : pageTitleInfo.filter.project?.color }"
            />
            {{ pageTitleInfo.filter.project?.name }}
          </template>
          <template v-else-if="typeof pageTitleInfo.filter === 'object' && pageTitleInfo.filter.type === 'smart-view'">
            <!-- Smart View Emoji Indicator -->
            <ProjectEmojiIcon
              v-if="pageTitleInfo.filter.emoji"
              :emoji="pageTitleInfo.filter.emoji"
              size="sm"
              :title="`Smart View: ${pageTitleInfo.filter.name}`"
              class="project-emoji-header"
            />
            {{ pageTitleInfo.filter.name }}
          </template>
          <template v-else>
            {{ pageTitleInfo.filter }}
          </template>
        </span>
      </div>

      <!-- INTEGRATED CONTROL PANEL: Sync + AI + Clock + Timer -->
      <div class="control-panel">
        <!-- TASK-1177: Sync Status Indicator -->
        <SyncStatusIndicator />

        <div class="control-divider" />

        <!-- TASK-1319: Keyboard Shortcuts Help -->
        <button
          class="help-btn"
          title="Keyboard Shortcuts (?)"
          @click="uiStore.toggleShortcutsPanel()"
        >
          <Keyboard :size="18" />
        </button>

        <div class="control-divider" />

        <!-- AI Assistant Toggle (TASK-1120) -->
        <button
          class="ai-toggle-btn"
          :class="{ 'ai-active': aiChatStore.isPanelOpen }"
          title="AI Assistant (Ctrl+/)"
          @click="aiChatStore.togglePanel"
        >
          <Sparkles :size="18" />
          <span v-if="aiChatStore.pendingSuggestionCount > 0" class="ai-badge">
            {{ aiChatStore.pendingSuggestionCount }}
          </span>
        </button>

        <div class="control-divider" />

        <div class="time-display-container">
          <TimeDisplay />
        </div>

        <!-- FEATURE-1248: Quick Task Shortcuts -->
        <QuickTaskDropdown />

        <!-- POMODORO TIMER DISPLAY -->
        <div class="timer-container">
          <div class="timer-display" :class="{ 'timer-active': timerStore.isTimerActive, 'timer-break': timerStore.currentSession?.isBreak }">
            <div class="timer-icon">
              <AppLogo v-if="timerStore.isTimerActive && !timerStore.currentSession?.isBreak" size="sm" class="timer-emoticon active" />
              <AppLogo v-else-if="timerStore.isTimerActive && timerStore.currentSession?.isBreak" size="sm" class="timer-emoticon active" />
              <Timer
                v-else
                :size="20"
                :stroke-width="1.5"
                class="timer-stroke"
              />
            </div>
            <div class="timer-info">
              <div class="timer-time">
                {{ timerStore.displayTime }}
              </div>
            </div>
            <div class="timer-controls">
              <div v-if="!timerStore.currentSession" class="timer-start-options">
                <button
                  class="timer-btn timer-start"
                  title="Start 25-min work timer"
                  @click="startQuickTimer"
                >
                  <Play :size="16" />
                </button>
                <button
                  class="timer-btn timer-break"
                  title="Start 5-min break"
                  @click="startShortBreak"
                >
                  <Coffee :size="16" :stroke-width="1.5" class="coffee-stroke" />
                </button>
                <button
                  class="timer-btn timer-break"
                  title="Start 15-min long break"
                  @click="startLongBreak"
                >
                  <User :size="16" :stroke-width="1.5" class="meditation-stroke" />
                </button>
              </div>

              <button
                v-else-if="timerStore.isPaused"
                class="timer-btn timer-resume"
                title="Resume timer"
                @click="timerStore.resumeTimer"
              >
                <Play :size="16" />
              </button>

              <button
                v-else-if="timerStore.isTimerActive"
                class="timer-btn timer-pause"
                title="Pause timer"
                @click="timerStore.pauseTimer"
              >
                <Pause :size="16" />
              </button>

              <button
                v-if="timerStore.currentSession"
                class="timer-btn timer-stop"
                title="Stop timer"
                @click="timerStore.stopTimer"
              >
                <Square :size="16" />
              </button>
            </div>
          </div>
        </div>

        <!-- TASK-1435: Active Task Glass Pill -->
        <Transition name="task-pill">
          <div
            v-if="timerStore.isTimerActive && timerStore.currentTaskName"
            class="active-task-pill"
          >
            <span
              v-if="activeTaskProject"
              class="active-task-dot"
              :class="{ 'active-task-dot--emoji': activeTaskProject.type === 'emoji' }"
              :style="activeTaskProject.type !== 'emoji' ? { backgroundColor: activeTaskProject.color || '#6B7280' } : undefined"
            >
              <template v-if="activeTaskProject.type === 'emoji'">{{ activeTaskProject.content }}</template>
            </span>
            <span v-else class="active-task-dot" />
            <OverflowTooltip :text="timerStore.currentTaskName" class="active-task-name" style="flex: 1; min-width: 0">{{ timerStore.currentTaskName }}</OverflowTooltip>
          </div>
        </Transition>
      </div>
    </div>

    <!-- VIEW TABS AND CONTROLS -->
    <div class="content-header">
      <div class="view-tabs">
        <router-link v-if="isNavItemVisible('canvas')" to="/" class="view-tab" active-class="active">
          {{ $t('views.canvas') }}
        </router-link>
        <router-link to="/calendar" class="view-tab" active-class="active">
          {{ $t('views.calendar') }}
        </router-link>
        <router-link to="/board" class="view-tab" active-class="active">
          {{ $t('views.board') }}
        </router-link>
        <router-link to="/catalog" class="view-tab" active-class="active">
          {{ $t('views.catalog') }}
        </router-link>
        <router-link v-if="isNavItemVisible('quick-sort')" to="/quick-sort" class="view-tab" active-class="active">
          {{ $t('views.quick_sort') }}
          <span v-if="uncategorizedCount > 0" class="tab-badge">{{ uncategorizedCount }}</span>
        </router-link>
        <router-link v-if="isNavItemVisible('ai')" to="/ai" class="view-tab" active-class="active">
          {{ $t('views.ai') }}
        </router-link>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useTaskStore, type Project } from '@/stores/tasks'
import { useWorkspaceNavigation } from '@/composables/useWorkspaceNavigation'
import OverflowTooltip from '@/components/base/OverflowTooltip.vue'
import { useTimerStore } from '@/stores/timer'
import { useAIChatStore } from '@/stores/aiChat'
import { useSettingsStore } from '@/stores/settings'
import { useUIStore } from '@/stores/ui'
import { Timer, Play, Pause, Coffee, Square, User, Sparkles, Keyboard } from 'lucide-vue-next'
import TimeDisplay from '@/components/common/TimeDisplay.vue'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'
import SyncStatusIndicator from '@/components/sync/SyncStatusIndicator.vue'
import { useAuthStore } from '@/stores/auth'
import QuickTaskDropdown from '@/components/timer/QuickTaskDropdown.vue'
import AppLogo from '@/components/base/AppLogo.vue'

const router = useRouter()
const { t } = useI18n()
const taskStore = useTaskStore()
const timerStore = useTimerStore()
const aiChatStore = useAIChatStore()
const settingsStore = useSettingsStore()
const authStore = useAuthStore()
const uiStore = useUIStore()
const { isNavItemVisible } = useWorkspaceNavigation()

// TASK-1435: Active task project visual for glass pill
const activeTaskProject = computed(() => {
  const taskId = timerStore.currentTaskId
  if (!taskId) return null
  const task = taskStore.tasks.find((t: any) => t.id === taskId)
  if (!task?.projectId) return null
  return taskStore.getProjectVisual(task.projectId)
})

// Route name to display title mapping
const routeNameToTitle = computed(() => ({
  'canvas': t('views.canvas'),
  'calendar': t('views.calendar'),
  'board': t('views.board'),
  'catalog': t('views.catalog'),
  'all-tasks': t('views.all_tasks'),
  'quick-sort': t('views.quick_sort'),
  'focus': t('views.focus'),
  'today': t('smart_views.today'),
  'keyboard-test': 'Keyboard Test',
  'yjs-test': 'YJS Test',
  'design-system': 'Design System',
  'ai': t('views.ai'),
}))

// Define proper types for page title info
interface FilterContext {
  type?: string
  name: string
  emoji?: string
  smartView?: string
  project?: Project
}

interface PageTitleInfo {
  main: string
  filter: string | FilterContext
}

// Dynamic page title with hierarchical display and smart defaults
const pageTitleInfo = computed<PageTitleInfo>(() => {
  // Get current route name for main title
  const currentRouteName = router.currentRoute.value.name as string
  const mainTitle = routeNameToTitle.value[currentRouteName as keyof typeof routeNameToTitle.value] || t('views.canvas')

  // Determine filter context with priority order:
  // 1. Explicit smart views (highest priority)
  // 2. Selected projects
  // 3. Route-based defaults (fallback to ensure context is always shown)
  let filterContext: string | FilterContext = ''

  // Priority 1: Check for active smart views
  if (taskStore.activeSmartView === 'today') {
    filterContext = {
      type: 'smart-view',
      name: t('smart_views.today'),
      emoji: '📅',
      smartView: 'today'
    }
  } else if (taskStore.activeSmartView === 'week') {
    filterContext = {
      type: 'smart-view',
      name: t('smart_views.week'),
      emoji: '📆',
      smartView: 'week'
    }
  } else if (taskStore.activeSmartView === 'uncategorized') {
    filterContext = {
      type: 'smart-view',
      name: t('smart_views.uncategorized_tasks'),
      emoji: '🪣',
      smartView: 'uncategorized'
    }
  } else if (taskStore.activeSmartView === 'all_active') {
    filterContext = {
      type: 'smart-view',
      name: t('smart_views.all_active_tasks'),
      emoji: '📋',
      smartView: 'all_active'
    }
  }
  // Priority 2: Check for selected projects
  else if (taskStore.activeProjectId) {
    const project = taskStore.projects.find(p => p.id === taskStore.activeProjectId)
    if (project) {
      filterContext = {
        type: 'project',
        name: project.name,
        project: project
      }
    }
  }
  // Priority 3: Route-based smart defaults (ensure context is never empty)
  else {
    // Apply smart defaults based on current route
    switch (currentRouteName) {
      case 'canvas':
        filterContext = t('views.workflow')
        break
      case 'calendar':
        filterContext = t('views.schedule')
        break
      case 'board':
        filterContext = t('views.overview')
        break
      case 'catalog':
        filterContext = t('views.knowledge_base')
        break
      case 'quick-sort':
        filterContext = t('views.triage')
        break
      case 'ai':
        filterContext = t('views.assistant')
        break
      default:
        filterContext = ''
    }
  }

  return {
    main: mainTitle,
    filter: filterContext
  }
})

// Uncategorized task count for Quick Sort badge
const uncategorizedCount = computed(() => {
  return taskStore.getUncategorizedTaskCount()
})

// Timer methods
const startQuickTimer = async () => {
  // BUG-1051: AWAIT for timer sync
  await timerStore.startTimer('quick-timer', timerStore.settings.workDuration, false)
}

const startShortBreak = async () => {
  // BUG-1051: AWAIT for timer sync
  await timerStore.startTimer('short-break', timerStore.settings.shortBreakDuration, true)
}

const startLongBreak = async () => {
  // BUG-1051: AWAIT for timer sync
  await timerStore.startTimer('long-break', timerStore.settings.longBreakDuration, true)
}
</script>

<style scoped>
/* App Header Container */
.app-header {
  display: flex;
  flex-direction: column;
  width: 100%;
}

/* HEADER SECTION */
.header-section {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
  pointer-events: none;
  position: relative;
  z-index: 5;
}

/* Raise above .content-header when gamification panel is open
   so the fixed backdrop blocks clicks on nav tabs */
.header-section--panel-open {
  z-index: 10;
}

/* USER PROFILE CONTAINER */
.user-profile-container {
  pointer-events: auto;
}

/* Hierarchical page title display */
.page-title {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  pointer-events: auto;
}

.title-main {
  font-size: var(--text-2xl);
  font-weight: 800;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0;
  line-height: 1.1;
}

.title-filter {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-top: var(--space-1);
}

.project-color-header {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
}

.project-emoji-header {
  font-size: var(--text-sm);
}

/* INTEGRATED CONTROL PANEL */
.control-panel {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  margin-inline-start: auto;
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
  box-shadow: var(--shadow-xl);
  pointer-events: auto;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.control-panel:hover {
  background: var(--glass-bg-soft);
  border-color: var(--state-hover-border);
  box-shadow: var(--shadow-lg);
}

.time-display-container {
  display: flex;
  align-items: center;
}

.timer-container {
  display: flex;
  align-items: center;
}

.timer-display {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-xl);
  border: 1.5px solid transparent;
  transition: all var(--duration-normal) var(--spring-smooth);
}

/* Work Timer - Stroke + Glow (NO fill) */
.timer-display.timer-active {
  background: transparent !important;
  border: 1.5px solid var(--timer-work-stroke);
  box-shadow: var(--timer-work-stroke-glow);
}

.timer-display.timer-active:hover {
  box-shadow: var(--timer-work-stroke-glow-intense);
}

/* Break Timer - Stroke + Glow (NO fill) */
.timer-display.timer-break {
  background: transparent !important;
  border: 1.5px solid var(--timer-break-stroke);
  box-shadow: var(--timer-break-stroke-glow);
}

.timer-display.timer-break:hover {
  box-shadow: var(--timer-break-stroke-glow-intense);
}

.timer-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.timer-emoticon {
  font-size: var(--text-2xl);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.timer-emoticon.active {
  animation: emoticonBounce 1.5s ease-in-out infinite;
}

@keyframes emoticonBounce {
  0%, 100% { transform: translateY(0) scale(1); }
  25% { transform: translateY(-6px) scale(1.1); }
  50% { transform: translateY(0) scale(1); }
  75% { transform: translateY(-3px) scale(1.05); }
}

.timer-stroke {
  color: var(--color-work);
  animation: pulse 2s infinite;
}

.coffee-stroke {
  color: var(--color-break);
}

.meditation-stroke {
  color: var(--color-focus);
}

.timer-info {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-2);
}

.timer-time {
  font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  min-width: 4rem;
  letter-spacing: 0.025em;
}

.timer-controls {
  display: flex;
  gap: var(--space-1);
}

.timer-start-options {
  display: flex;
  gap: var(--space-1);
}

.timer-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  width: 1.75rem;
  height: 1.75rem;
  border-radius: var(--radius-6);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast) var(--ease-out);
}

.timer-btn:hover {
  background: var(--surface-hover);
  color: var(--text-secondary);
}

.timer-start, .timer-resume {
  color: var(--color-work);
}

.timer-start:hover, .timer-resume:hover {
  background: var(--state-hover-bg);
  color: var(--color-work);
}

.timer-pause {
  color: var(--color-break);
}

.timer-pause:hover {
  background: var(--glass-bg-tint);
  color: var(--color-break);
}

.timer-stop {
  color: var(--color-danger);
}

.timer-stop:hover {
  background: var(--danger-bg-subtle);
  color: var(--color-danger);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.sync-status-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* CONTENT HEADER */
.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--nav-tabs-spacing-below);
  /* border-bottom removed — shared layout-header-border in MainLayout handles this */
  padding-bottom: var(--nav-tabs-padding-bottom);
  margin-inline-start: calc(var(--space-12) * -1);
  margin-inline-end: calc(var(--space-12) * -1);
  padding-inline-start: var(--space-12);
  padding-inline-end: var(--space-12);
  pointer-events: none;
  position: relative;
  z-index: 5;
}

.view-tabs {
  display: flex;
  gap: 0.125rem;
  pointer-events: auto;
}

.view-tab {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  text-decoration: none;
}

.view-tab:hover {
  color: var(--text-secondary);
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  backdrop-filter: var(--state-active-glass);
  box-shadow: var(--shadow-md);
}

.view-tab.active {
  color: var(--state-active-text);
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  font-weight: var(--font-semibold);
  box-shadow: var(--shadow-md), var(--state-hover-glow);
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 var(--space-1_5);
  margin-inline-start: var(--space-1_5);
  background: linear-gradient(135deg, var(--color-blue), #8b5cf6);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}

.view-tab.active .tab-badge {
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
}

/* AI TOGGLE BUTTON (TASK-1120) */
.ai-toggle-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.ai-toggle-btn:hover {
  color: var(--accent-primary);
  background: var(--state-hover-bg);
}

.ai-toggle-btn.ai-active {
  color: var(--accent-primary);
  background: var(--accent-bg);
}

.ai-badge {
  position: absolute;
  top: 2px;
  inset-inline-end: 2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: var(--text-xs);
  font-weight: 700;
  color: white;
  background: linear-gradient(135deg, #8b5cf6, #06b6d4);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: badgePulse 2s ease-in-out infinite;
}

@keyframes badgePulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.control-divider {
  width: 1px;
  height: 24px;
  background: var(--border-subtle);
  margin: 0 var(--space-2);
}

/* HELP BUTTON (TASK-1319) */
.help-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.help-btn:hover {
  color: var(--brand-primary);
  background: var(--state-hover-bg);
}

/* TASK-1435: Active Task Glass Pill */
.active-task-pill {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1_5) var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  cursor: default;
  max-width: 240px;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.active-task-pill:hover {
  border-color: var(--state-hover-border);
  background: var(--glass-bg-medium);
}

.active-task-dot {
  width: 8px;
  height: 8px;
  min-width: 8px;
  border-radius: var(--radius-full);
  background-color: #6B7280;
}

.active-task-dot--emoji {
  width: auto;
  height: auto;
  min-width: auto;
  background: none;
  font-size: var(--text-sm);
  line-height: 1;
}

.active-task-name {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  unicode-bidi: plaintext;
  text-align: start;
}

/* Transition: fade + slide */
.task-pill-enter-active {
  transition: all var(--duration-normal) var(--spring-smooth);
}

.task-pill-leave-active {
  transition: all var(--duration-fast) var(--ease-out);
}

.task-pill-enter-from {
  opacity: 0;
  transform: translateX(-8px);
}

.task-pill-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}
</style>
