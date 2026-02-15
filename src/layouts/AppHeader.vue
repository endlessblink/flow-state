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
        <span v-if="pageTitleInfo.filter" class="title-filter">
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

      <!-- INTEGRATED CONTROL PANEL: Gamification + Sync + AI + Clock + Timer -->
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
              <span v-else-if="timerStore.isTimerActive && timerStore.currentSession?.isBreak" class="timer-emoticon active">🧎</span>
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
              <div class="timer-task" dir="auto">
                {{ timerStore.currentTaskName || '&nbsp;' }}
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
      </div>
    </div>

    <!-- VIEW TABS AND CONTROLS -->
    <div class="content-header">
      <div class="view-tabs">
        <router-link to="/" class="view-tab" active-class="active">
          Canvas
        </router-link>
        <router-link to="/calendar" class="view-tab" active-class="active">
          Calendar
        </router-link>
        <router-link to="/board" class="view-tab" active-class="active">
          Board
        </router-link>
        <router-link to="/catalog" class="view-tab" active-class="active">
          Catalog
        </router-link>
        <router-link to="/quick-sort" class="view-tab" active-class="active">
          Quick Sort
          <span v-if="uncategorizedCount > 0" class="tab-badge">{{ uncategorizedCount }}</span>
        </router-link>
        <router-link to="/ai" class="view-tab" active-class="active">
          AI
        </router-link>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskStore, type Project } from '@/stores/tasks'
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
const taskStore = useTaskStore()
const timerStore = useTimerStore()
const aiChatStore = useAIChatStore()
const settingsStore = useSettingsStore()
const authStore = useAuthStore()
const uiStore = useUIStore()

// Route name to display title mapping
const routeNameToTitle = {
  'canvas': 'Canvas',
  'calendar': 'Calendar',
  'board': 'Board',
  'catalog': 'Task Catalog',
  'all-tasks': 'All Tasks',
  'quick-sort': 'Quick Sort',
  'focus': 'Focus',
  'today': 'Today',
  'calendar-test': 'Calendar Test',
  'keyboard-test': 'Keyboard Test',
  'yjs-test': 'YJS Test',
  'design-system': 'Design System',
  'ai': 'AI Hub',
}

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
  const mainTitle = routeNameToTitle[currentRouteName as keyof typeof routeNameToTitle] || 'Canvas'

  // Determine filter context with priority order:
  // 1. Explicit smart views (highest priority)
  // 2. Selected projects
  // 3. Route-based defaults (fallback to ensure context is always shown)
  let filterContext: string | FilterContext = ''

  // Priority 1: Check for active smart views
  if (taskStore.activeSmartView === 'today') {
    filterContext = {
      type: 'smart-view',
      name: 'Today',
      emoji: '📅',
      smartView: 'today'
    }
  } else if (taskStore.activeSmartView === 'week') {
    filterContext = {
      type: 'smart-view',
      name: 'This Week',
      emoji: '📆',
      smartView: 'week'
    }
  } else if (taskStore.activeSmartView === 'uncategorized') {
    filterContext = {
      type: 'smart-view',
      name: 'Uncategorized Tasks',
      emoji: '🪣',
      smartView: 'uncategorized'
    }
  } else if (taskStore.activeSmartView === 'all_active') {
    filterContext = {
      type: 'smart-view',
      name: 'All Active Tasks',
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
        filterContext = 'Workflow'
        break
      case 'calendar':
        filterContext = 'Schedule'
        break
      case 'board':
        filterContext = 'Overview'
        break
      case 'catalog':
        filterContext = 'Knowledge Base'
        break
      case 'quick-sort':
        filterContext = 'Triage'
        break
      case 'ai':
        filterContext = 'Assistant'
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
  margin-left: auto;
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
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15),
              0 2px 6px rgba(0, 0, 0, 0.1);
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

.timer-task {
  font-size: var(--text-sm);
  color: var(--text-muted);
  font-weight: var(--font-medium);
  max-width: 150px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  /* RTL support: auto-detect text direction for Hebrew/Arabic */
  unicode-bidi: plaintext;
  text-align: start;
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
  margin-left: calc(var(--space-12) * -1);
  margin-right: calc(var(--space-12) * -1);
  padding-left: var(--space-12);
  padding-right: var(--space-12);
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
  border-radius: var(--radius-md);
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
  margin-left: var(--space-1_5);
  background: linear-gradient(135deg, var(--color-blue), #8b5cf6);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: 700;
  color: #ffffff;
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
  color: var(--accent-primary, #8b5cf6);
  background: var(--state-hover-bg);
}

.ai-toggle-btn.ai-active {
  color: var(--accent-primary, #8b5cf6);
  background: var(--accent-bg, rgba(139, 92, 246, 0.15));
}

.ai-badge {
  position: absolute;
  top: 2px;
  right: 2px;
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
  background: var(--border-subtle, rgba(255, 255, 255, 0.1));
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

/* GAMIFICATION WIDGETS (FEATURE-1118) */
.gamification-widgets {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  position: relative;
}

.gamification-dropdown {
  position: absolute;
  top: calc(100% + var(--space-2));
  right: 0;
  z-index: 100;
  min-width: 320px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.gamification-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99;
}

/* Cyberflow intensity: intense glow on Cyberflow nav tab */
.cyberflow-tab--glow {
  box-shadow: 0 0 8px var(--neon-magenta, rgba(255, 0, 255, 0.4)),
              0 0 16px var(--neon-magenta, rgba(255, 0, 255, 0.2));
  animation: cyberflowPulse 2s ease-in-out infinite;
}

@keyframes cyberflowPulse {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.15); }
}
</style>
