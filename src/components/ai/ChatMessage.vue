<script setup lang="ts">
/**
 * Chat Message Component
 *
 * Displays a single message in the AI chat panel.
 * Supports:
 * - User and assistant message styling
 * - Markdown rendering via markdown-it
 * - Tool JSON stripping
 * - Copy to clipboard
 * - Streaming animation with thinking indicator
 * - Action buttons
 * - Tool result display
 * - Error states
 * - RTL support
 *
 * @see TASK-1120 in MASTER_PLAN.md
 */

import { computed, ref } from 'vue'
import { User, Sparkles, Loader2, Check, Copy, CheckCheck, Zap, PenLine, Trash2, Trophy, Flame, Shield, Swords, TrendingUp, Target, Play, CheckCircle2, CalendarDays } from 'lucide-vue-next'
import MarkdownIt from 'markdown-it'
import type { ChatMessage, ChatAction } from '@/stores/aiChat'
import { formatRelativeDate } from '@/utils/dateUtils'
import TaskQuickEditPopover from './TaskQuickEditPopover.vue'
import { executeTool } from '@/services/ai/tools'
import { sanitizeMarkdownHtml } from '@/utils/security'

// ============================================================================
// Props
// ============================================================================

const props = defineProps<{
  message: ChatMessage
  direction?: 'auto' | 'ltr' | 'rtl'
}>()

const emit = defineEmits<{
  'selectTask': [taskId: string]
}>()

// ============================================================================
// Markdown Setup
// ============================================================================

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
})

// Make links open in new tab
const defaultRender = md.renderer.rules.link_open || function (tokens: any[], idx: number, options: any, _env: any, self: any) {
  return self.renderToken(tokens, idx, options)
}
md.renderer.rules.link_open = function (tokens: any[], idx: number, options: any, env: any, self: any) {
  tokens[idx].attrSet('target', '_blank')
  tokens[idx].attrSet('rel', 'noopener noreferrer')
  return defaultRender(tokens, idx, options, env, self)
}

// ============================================================================
// State
// ============================================================================

const loadingActions = ref<Set<string>>(new Set())
const copied = ref(false)

// Track which tasks have been actioned (for visual feedback)
const completedTaskIds = ref<Set<string>>(new Set())
const timerStartedTaskIds = ref<Set<string>>(new Set())
const actionLoading = ref<Record<string, string>>({}) // taskId -> 'done' | 'timer'

// ============================================================================
// Computed
// ============================================================================

const isUser = computed(() => props.message.role === 'user')
const isAssistant = computed(() => props.message.role === 'assistant')
const isStreaming = computed(() => props.message.isStreaming)
const hasError = computed(() => !!props.message.error)
const hasActions = computed(() =>
  props.message.actions && props.message.actions.length > 0
)
const isThinking = computed(() =>
  isStreaming.value && (!props.message.content || props.message.content.trim() === '')
)

/**
 * Strip tool JSON blocks and AI preamble, then render markdown.
 */
const renderedContent = computed(() => {
  let content = props.message.content || ''

  if (isAssistant.value) {
    // Strip ```json tool call blocks
    content = content.replace(/```json\s*\{[\s\S]*?\}\s*```/g, '')
    // Strip bare JSON tool calls (models sometimes output without code fences)
    content = content.replace(/\{\s*"tool"\s*:\s*"[^"]+"\s*,\s*"parameters"\s*:\s*\{[^}]*\}\s*\}/g, '')
    // Strip "I'll use the X tool" preamble lines (EN)
    content = content.replace(/^I['']ll (?:use|call|invoke) the \w[\w\s]* tool.*$/gm, '')
    // Strip standalone tool name references (e.g. "list_tasks" on its own or at end of line)
    content = content.replace(/\b(list_tasks|get_overdue_tasks|search_tasks|get_daily_summary|get_timer_status|get_productivity_stats|suggest_next_task|get_weekly_summary|get_gamification_status|get_active_challenges|get_achievements_near_completion|list_projects|list_groups|create_task|update_task|delete_task|mark_task_done|start_timer|stop_timer|bulk_update_tasks|bulk_delete_tasks)\b/g, '')
    // Strip raw HTML tags that AI models may hallucinate (with html:false they appear as raw text)
    content = content.replace(/<[^>]+>/g, '')
    // Clean up extra blank lines left behind
    content = content.replace(/\n{3,}/g, '\n\n').trim()
  }

  if (!content) return ''

  // FIX: Sanitize the rendered HTML to prevent XSS (even though we strip tags above)
  return sanitizeMarkdownHtml(md.render(content))
})

/**
 * Tool results extracted from metadata for display.
 * Includes full data for rich rendering (task lists, summaries, etc.)
 */
const toolResults = computed(() => {
  const meta = props.message.metadata as any
  if (!meta?.toolResults || !Array.isArray(meta.toolResults)) return []
  return meta.toolResults as Array<{
    tool: string
    message: string
    success: boolean
    data?: any
    type?: 'read' | 'write' | 'destructive'
  }>
})

/**
 * Check if a tool result contains a task list that should be rendered as clickable items.
 */
function isTaskListResult(result: { tool: string; data?: any }): boolean {
  if (!result.data) return false
  // Direct array of tasks
  if (Array.isArray(result.data) && result.data.length > 0 && result.data[0]?.title) return true
  // Daily summary with nested task arrays
  if (result.data.dueTodayTasks?.length > 0 || result.data.overdueTasks?.length > 0) return true
  return false
}

function getTasksFromResult(result: { tool: string; data?: any }): Array<{ id: string; title: string; dueDate?: string; priority?: string; status?: string; daysOverdue?: number }> {
  if (!result.data) return []
  // Direct array (get_overdue_tasks, list_tasks, search_tasks)
  if (Array.isArray(result.data)) return result.data
  // Daily summary — merge overdue + due today
  const tasks: any[] = []
  if (result.data.overdueTasks) tasks.push(...result.data.overdueTasks)
  if (result.data.dueTodayTasks) tasks.push(...result.data.dueTodayTasks)
  return tasks
}

/**
 * Check if a tool result is a daily summary with stats to render as a rich card.
 */
function isDailySummaryResult(result: { tool: string; data?: any }): boolean {
  return result.tool === 'get_daily_summary' && result.data && typeof result.data.totalTasks === 'number'
}

/**
 * Gamification & productivity tool result detection helpers
 */

function isGamificationStatusResult(result: { tool: string; data?: any }): boolean {
  return result.tool === 'get_gamification_status' && result.data && typeof result.data.level === 'number'
}

function isActiveChallengesResult(result: { tool: string; data?: any }): boolean {
  return result.tool === 'get_active_challenges' && result.data && Array.isArray(result.data.dailies)
}

function isAchievementsNearResult(result: { tool: string; data?: any }): boolean {
  return result.tool === 'get_achievements_near_completion' && Array.isArray(result.data)
}

function isProductivityStatsResult(result: { tool: string; data?: any }): boolean {
  return result.tool === 'get_productivity_stats' && result.data && typeof result.data.totalTasks === 'number'
}

function isSuggestNextTaskResult(result: { tool: string; data?: any }): boolean {
  return result.tool === 'suggest_next_task' && Array.isArray(result.data)
}

function isWeeklySummaryResult(result: { tool: string; data?: any }): boolean {
  return result.tool === 'get_weekly_summary' && result.data && typeof result.data.completedThisWeek === 'number'
}

function isWeeklyPlanResult(result: { tool: string; data?: any }): boolean {
  return result.tool === 'generate_weekly_plan' && result.data && result.data.plan
}

const PLAN_DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatTimeRemaining(minutes: number): string {
  if (minutes < 60) return `${minutes}m left`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m left` : `${h}h left`
}

function tierColor(tier?: string): string {
  switch (tier) {
    case 'bronze': return 'rgb(var(--tier-bronze))'
    case 'silver': return 'rgb(var(--tier-silver))'
    case 'gold': return 'rgb(var(--tier-gold))'
    case 'platinum': return 'rgb(var(--tier-platinum))'
    default: return 'var(--text-secondary)'
  }
}

function priorityColor(priority?: string): string {
  switch (priority) {
    case 'urgent': return 'var(--color-priority-high)'
    case 'high': return 'var(--color-priority-medium)'
    case 'medium': return 'var(--color-priority-low)' // Typically yellow/orange
    case 'low': return 'var(--color-success)'
    default: return 'var(--glass-handle)'
  }
}

// ============================================================================
// Quick-Edit Popover
// ============================================================================

// Collapse long task lists — show max 3, expandable
const MAX_VISIBLE_TASKS = 3
const expandedSections = ref<Set<string>>(new Set())

function toggleSection(key: string) {
  if (expandedSections.value.has(key)) {
    expandedSections.value.delete(key)
  } else {
    expandedSections.value.add(key)
  }
}

function visibleTasks(tasks: any[], sectionKey: string): any[] {
  if (expandedSections.value.has(sectionKey) || tasks.length <= MAX_VISIBLE_TASKS) return tasks
  return tasks.slice(0, MAX_VISIBLE_TASKS)
}

const quickEditTask = ref<{ id: string; title: string; priority?: string | null; status?: string; dueDate?: string | null; estimatedDuration?: number | null } | null>(null)
const quickEditPos = ref({ x: 0, y: 0 })
const quickEditPosition = ref<'left' | 'auto'>('left')

function openQuickEdit(task: any, event: MouseEvent) {
  event.stopPropagation()
  quickEditTask.value = {
    id: task.id,
    title: task.title || '(untitled)',
    priority: task.priority || null,
    status: task.status || 'planned',
    dueDate: task.dueDate || null,
    estimatedDuration: task.estimatedDuration || null,
  }
  const panel = document.querySelector('.ai-chat-panel')
  const isFullscreen = panel?.classList.contains('panel-fullscreen')
  if (isFullscreen || !panel) {
    // Fullscreen or no panel: position at click point with auto layout
    quickEditPos.value = { x: event.clientX, y: event.clientY }
    quickEditPosition.value = 'auto'
  } else {
    // Compact/expanded: position to the left of the panel
    const panelRect = panel.getBoundingClientRect()
    quickEditPos.value = { x: panelRect.left, y: event.clientY }
    quickEditPosition.value = 'left'
  }
}

function closeQuickEdit() {
  quickEditTask.value = null
}

function openFullEditor() {
  if (quickEditTask.value) {
    emit('selectTask', quickEditTask.value.id)
  }
  closeQuickEdit()
}

// ============================================================================
// Actions
// ============================================================================

async function handleAction(action: ChatAction) {
  if (loadingActions.value.has(action.id)) return
  if (action.completed) return

  loadingActions.value.add(action.id)

  try {
    await action.handler()
    action.completed = true
  } catch (err) {
    console.error('[ChatMessage] Action failed:', err)
  } finally {
    loadingActions.value.delete(action.id)
  }
}

function isActionLoading(action: ChatAction): boolean {
  return loadingActions.value.has(action.id)
}

async function copyMessage() {
  try {
    await navigator.clipboard.writeText(props.message.content || '')
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch (err) {
    console.error('[ChatMessage] Copy failed:', err)
  }
}

function toolIcon(type?: string) {
  switch (type) {
    case 'write': return PenLine
    case 'destructive': return Trash2
    default: return Zap
  }
}

async function markTaskDone(taskId: string, event: MouseEvent) {
  event.stopPropagation() // Don't open popover
  if (actionLoading.value[taskId]) return

  actionLoading.value[taskId] = 'done'
  try {
    await executeTool({ tool: 'update_task', parameters: { taskId, updates: { status: 'done' } } })
    completedTaskIds.value.add(taskId)
  } catch (err) {
    console.error('[ChatMessage] Mark done failed:', err)
  } finally {
    delete actionLoading.value[taskId]
  }
}

async function startTaskTimer(taskId: string, event: MouseEvent) {
  event.stopPropagation() // Don't open popover
  if (actionLoading.value[taskId]) return

  actionLoading.value[taskId] = 'timer'
  try {
    await executeTool({ tool: 'start_timer', parameters: { taskId } })
    timerStartedTaskIds.value.add(taskId)
  } catch (err) {
    console.error('[ChatMessage] Start timer failed:', err)
  } finally {
    delete actionLoading.value[taskId]
  }
}
</script>

<template>
  <div
    class="chat-message"
    :class="{
      'message-user': isUser,
      'message-assistant': isAssistant,
      'message-streaming': isStreaming,
      'message-error': hasError
    }"
  >
    <!-- Avatar -->
    <div class="message-avatar">
      <User v-if="isUser" :size="16" />
      <Sparkles v-else :size="16" />
    </div>

    <!-- Content -->
    <div class="message-content">
      <!-- Thinking Indicator -->
      <div v-if="isThinking" class="thinking-indicator">
        <span class="thinking-dot" />
        <span class="thinking-dot" />
        <span class="thinking-dot" />
      </div>

      <!-- Rendered Message Text -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div
        v-else-if="renderedContent"
        class="message-text markdown-body"
        :dir="direction || 'auto'"
        v-html="renderedContent"
      />

      <!-- Streaming cursor (when there IS content) -->
      <span v-if="isStreaming && !isThinking && renderedContent" class="cursor-blink">|</span>

      <!-- Tool Results -->
      <div v-if="toolResults.length > 0 && !isStreaming" class="tool-results">
        <template v-for="(result, idx) in toolResults" :key="idx">
          <!-- Daily summary stats card -->
          <div v-if="isDailySummaryResult(result)" class="tool-result-card">
            <div class="tool-result-header tool-read">
              <component :is="toolIcon(result.type)" :size="14" class="tool-result-icon" />
              <span class="tool-result-title" dir="auto">{{ result.message }}</span>
            </div>
            <div class="summary-stats-grid">
              <div class="summary-stat">
                <span class="summary-stat-value">{{ result.data.totalTasks }}</span>
                <span class="summary-stat-label">Total</span>
              </div>
              <div class="summary-stat">
                <span class="summary-stat-value">{{ result.data.inProgress }}</span>
                <span class="summary-stat-label">In Progress</span>
              </div>
              <div class="summary-stat">
                <span class="summary-stat-value summary-stat-success">{{ result.data.completedToday }}</span>
                <span class="summary-stat-label">Done Today</span>
              </div>
              <div class="summary-stat">
                <span class="summary-stat-value">{{ result.data.dueToday }}</span>
                <span class="summary-stat-label">Due Today</span>
              </div>
              <div class="summary-stat">
                <span class="summary-stat-value" :class="{ 'summary-stat-danger': result.data.overdueCount > 0 }">{{ result.data.overdueCount }}</span>
                <span class="summary-stat-label">Overdue</span>
              </div>
              <div class="summary-stat">
                <span class="summary-stat-value">{{ result.data.timerSessionsCompleted }}</span>
                <span class="summary-stat-label">Pomodoros</span>
              </div>
            </div>
            <!-- Overdue task list if any -->
            <div v-if="result.data.overdueTasks?.length > 0" class="task-list">
              <div class="summary-section-label">
                Overdue Tasks
                <span class="section-count">({{ result.data.overdueTasks.length }})</span>
              </div>
              <button
                v-for="task in visibleTasks(result.data.overdueTasks, 'overdue-' + result.tool)"
                :key="task.id"
                class="task-list-item"
                :class="{ 'task-completed': completedTaskIds.has(task.id) }"
                @click="openQuickEdit(task, $event)"
              >
                <span
                  class="task-priority-dot"
                  :style="{ background: 'var(--color-priority-high)' }"
                />
                <span class="task-title" :dir="direction || 'auto'">{{ task.title || '(untitled)' }}</span>
                <div class="task-meta-row">
                  <span v-if="task.dueDate" class="task-due-date">{{ formatRelativeDate(task.dueDate) }}</span>
                </div>
                <div class="task-inline-actions" @click.stop>
                  <button
                    v-if="!completedTaskIds.has(task.id)"
                    class="inline-action-btn inline-done-btn"
                    :class="{ loading: actionLoading[task.id] === 'done' }"
                    title="Mark done"
                    @click="markTaskDone(task.id, $event)"
                  >
                    <Loader2 v-if="actionLoading[task.id] === 'done'" :size="12" class="spin" />
                    <CheckCircle2 v-else :size="12" />
                  </button>
                  <button
                    v-if="!timerStartedTaskIds.has(task.id)"
                    class="inline-action-btn inline-timer-btn"
                    :class="{ loading: actionLoading[task.id] === 'timer' }"
                    title="Start timer"
                    @click="startTaskTimer(task.id, $event)"
                  >
                    <Loader2 v-if="actionLoading[task.id] === 'timer'" :size="12" class="spin" />
                    <Play v-else :size="12" />
                  </button>
                  <span v-if="completedTaskIds.has(task.id)" class="inline-action-done-badge">
                    <CheckCircle2 :size="12" /> Done
                  </span>
                  <span v-if="timerStartedTaskIds.has(task.id)" class="inline-action-timer-badge">
                    <Play :size="12" /> Timer started
                  </span>
                </div>
              </button>
              <button
                v-if="result.data.overdueTasks.length > MAX_VISIBLE_TASKS"
                class="show-more-btn"
                @click="toggleSection('overdue-' + result.tool)"
              >
                {{ expandedSections.has('overdue-' + result.tool)
                  ? 'Show less'
                  : `Show all ${result.data.overdueTasks.length} overdue tasks` }}
              </button>
            </div>
            <!-- Due today task list if any -->
            <div v-if="result.data.dueTodayTasks?.length > 0" class="task-list">
              <div class="summary-section-label">
                Due Today
                <span class="section-count">({{ result.data.dueTodayTasks.length }})</span>
              </div>
              <button
                v-for="task in visibleTasks(result.data.dueTodayTasks, 'duetoday-' + result.tool)"
                :key="task.id"
                class="task-list-item"
                :class="{ 'task-completed': completedTaskIds.has(task.id) }"
                @click="openQuickEdit(task, $event)"
              >
                <span
                  class="task-priority-dot"
                  :style="{ background: priorityColor(task.priority) }"
                />
                <span class="task-title" :dir="direction || 'auto'">{{ task.title || '(untitled)' }}</span>
                <div class="task-meta-row">
                  <span
                    v-if="task.status"
                    class="task-status-badge"
                    :class="'status-' + task.status"
                  >{{ task.status }}</span>
                </div>
                <div class="task-inline-actions" @click.stop>
                  <button
                    v-if="!completedTaskIds.has(task.id)"
                    class="inline-action-btn inline-done-btn"
                    :class="{ loading: actionLoading[task.id] === 'done' }"
                    title="Mark done"
                    @click="markTaskDone(task.id, $event)"
                  >
                    <Loader2 v-if="actionLoading[task.id] === 'done'" :size="12" class="spin" />
                    <CheckCircle2 v-else :size="12" />
                  </button>
                  <button
                    v-if="!timerStartedTaskIds.has(task.id)"
                    class="inline-action-btn inline-timer-btn"
                    :class="{ loading: actionLoading[task.id] === 'timer' }"
                    title="Start timer"
                    @click="startTaskTimer(task.id, $event)"
                  >
                    <Loader2 v-if="actionLoading[task.id] === 'timer'" :size="12" class="spin" />
                    <Play v-else :size="12" />
                  </button>
                  <span v-if="completedTaskIds.has(task.id)" class="inline-action-done-badge">
                    <CheckCircle2 :size="12" /> Done
                  </span>
                  <span v-if="timerStartedTaskIds.has(task.id)" class="inline-action-timer-badge">
                    <Play :size="12" /> Timer started
                  </span>
                </div>
              </button>
              <button
                v-if="result.data.dueTodayTasks.length > MAX_VISIBLE_TASKS"
                class="show-more-btn"
                @click="toggleSection('duetoday-' + result.tool)"
              >
                {{ expandedSections.has('duetoday-' + result.tool)
                  ? 'Show less'
                  : `Show all ${result.data.dueTodayTasks.length} tasks` }}
              </button>
            </div>
          </div>
          <!-- Gamification Status Card -->
          <div v-else-if="isGamificationStatusResult(result)" class="tool-result-card gamification-card">
            <div class="tool-result-header tool-read">
              <Trophy :size="14" class="tool-result-icon" />
              <span class="tool-result-title" dir="auto">{{ result.message }}</span>
            </div>
            <div class="gam-profile-row">
              <div class="gam-level-badge">
                <span class="gam-level-number">{{ result.data.level }}</span>
                <span class="gam-level-label">LEVEL</span>
              </div>
              <div class="gam-xp-section">
                <div class="gam-xp-bar-wrapper">
                  <div class="gam-xp-bar" :style="{ width: result.data.levelProgress + '%' }" />
                </div>
                <div class="gam-xp-text">
                  {{ result.data.totalXp }} XP &middot; {{ result.data.xpToNextLevel }} to next
                </div>
              </div>
            </div>
            <div class="gam-stats-row">
              <div class="gam-stat">
                <Flame :size="14" class="gam-stat-icon gam-streak-icon" />
                <span class="gam-stat-value">{{ result.data.currentStreak }}</span>
                <span class="gam-stat-label">Streak</span>
              </div>
              <div class="gam-stat">
                <Shield :size="14" class="gam-stat-icon gam-corruption-icon" :class="{ 'gam-corruption-high': result.data.corruptionLevel > 60 }" />
                <span class="gam-stat-value">{{ result.data.corruptionLevel }}%</span>
                <span class="gam-stat-label">Corruption</span>
              </div>
              <div class="gam-stat">
                <Trophy :size="14" class="gam-stat-icon gam-achievement-icon" />
                <span class="gam-stat-value">{{ result.data.achievementsEarned }}/{{ result.data.achievementsTotal }}</span>
                <span class="gam-stat-label">Achievements</span>
              </div>
            </div>
            <div v-if="result.data.streakAtRisk" class="gam-warning" dir="auto">
              Streak at risk! Complete a task today to keep your {{ result.data.currentStreak }}-day streak.
            </div>
          </div>

          <!-- Active Challenges Card -->
          <div v-else-if="isActiveChallengesResult(result)" class="tool-result-card challenges-card">
            <div class="tool-result-header tool-read">
              <Swords :size="14" class="tool-result-icon" />
              <span class="tool-result-title" dir="auto">{{ result.message }}</span>
            </div>
            <!-- Daily Challenges -->
            <div v-if="result.data.dailies.length > 0" class="challenge-section">
              <div class="summary-section-label">
                Daily Missions
              </div>
              <div
                v-for="ch in result.data.dailies"
                :key="ch.id"
                class="challenge-item"
              >
                <div class="challenge-header">
                  <span class="challenge-title" :dir="direction || 'auto'">{{ ch.title }}</span>
                  <span class="challenge-difficulty" :class="'diff-' + ch.difficulty">{{ ch.difficulty }}</span>
                </div>
                <div v-if="ch.narrativeFlavor" class="challenge-flavor" :dir="direction || 'auto'">
                  {{ ch.narrativeFlavor }}
                </div>
                <div class="challenge-progress-row">
                  <div class="challenge-progress-bar-wrapper">
                    <div
                      class="challenge-progress-bar"
                      :style="{ width: ch.progressPercent + '%' }"
                      :class="{ 'bar-complete': ch.progressPercent >= 100 }"
                    />
                  </div>
                  <span class="challenge-progress-text">{{ ch.objectiveCurrent }}/{{ ch.objectiveTarget }}</span>
                </div>
                <div class="challenge-meta">
                  <span class="challenge-reward">+{{ ch.rewardXp }} XP</span>
                  <span class="challenge-time">{{ formatTimeRemaining(ch.timeRemaining) }}</span>
                </div>
              </div>
            </div>
            <!-- Boss Fight -->
            <div v-if="result.data.boss" class="challenge-section">
              <div class="summary-section-label">
                Boss Fight
              </div>
              <div class="challenge-item challenge-boss">
                <div class="challenge-header">
                  <span class="challenge-title boss-title" :dir="direction || 'auto'">{{ result.data.boss.title }}</span>
                  <span class="challenge-difficulty diff-boss">BOSS</span>
                </div>
                <div v-if="result.data.boss.narrativeFlavor" class="challenge-flavor" :dir="direction || 'auto'">
                  {{ result.data.boss.narrativeFlavor }}
                </div>
                <div class="challenge-progress-row">
                  <div class="challenge-progress-bar-wrapper boss-bar-wrapper">
                    <div
                      class="challenge-progress-bar boss-bar"
                      :style="{ width: result.data.boss.progressPercent + '%' }"
                    />
                  </div>
                  <span class="challenge-progress-text">{{ result.data.boss.objectiveCurrent }}/{{ result.data.boss.objectiveTarget }}</span>
                </div>
                <div class="challenge-meta">
                  <span class="challenge-reward boss-reward">+{{ result.data.boss.rewardXp }} XP</span>
                  <span class="challenge-time">{{ formatTimeRemaining(result.data.boss.timeRemaining) }}</span>
                </div>
              </div>
            </div>
            <div v-if="result.data.dailies.length === 0 && !result.data.boss" class="gam-empty" dir="auto">
              No active challenges. New dailies generate each morning.
            </div>
          </div>

          <!-- Achievements Near Completion Card -->
          <div v-else-if="isAchievementsNearResult(result)" class="tool-result-card achievements-card">
            <div class="tool-result-header tool-read">
              <Target :size="14" class="tool-result-icon" />
              <span class="tool-result-title" dir="auto">{{ result.message }}</span>
            </div>
            <div v-if="result.data.length === 0" class="gam-empty" dir="auto">
              No achievements close to completion yet. Keep going!
            </div>
            <div
              v-for="ach in result.data"
              :key="ach.id"
              class="achievement-item"
            >
              <div class="achievement-header">
                <span class="achievement-tier-dot" :style="{ background: tierColor(ach.tier) }" />
                <span class="achievement-name">{{ ach.name }}</span>
                <span class="achievement-percent">{{ ach.progressPercent }}%</span>
              </div>
              <div class="achievement-desc" dir="auto">
                {{ ach.description }}
              </div>
              <div class="achievement-progress-row">
                <div class="achievement-bar-wrapper">
                  <div
                    class="achievement-bar"
                    :style="{ width: ach.progressPercent + '%', background: tierColor(ach.tier) }"
                  />
                </div>
                <span class="achievement-remaining">{{ ach.remaining }} left</span>
              </div>
              <span class="achievement-reward">+{{ ach.xpReward }} XP</span>
            </div>
          </div>

          <!-- Productivity Stats Card -->
          <div v-else-if="isProductivityStatsResult(result)" class="tool-result-card">
            <div class="tool-result-header tool-read">
              <TrendingUp :size="14" class="tool-result-icon" />
              <span class="tool-result-title" dir="auto">{{ result.message }}</span>
            </div>
            <div class="summary-stats-grid">
              <div class="summary-stat">
                <span class="summary-stat-value summary-stat-success">{{ result.data.completedToday }}</span>
                <span class="summary-stat-label">Done Today</span>
              </div>
              <div class="summary-stat">
                <span class="summary-stat-value">{{ result.data.totalTasks }}</span>
                <span class="summary-stat-label">Total Tasks</span>
              </div>
              <div class="summary-stat">
                <span class="summary-stat-value" :class="{ 'summary-stat-danger': result.data.overdueCount > 0 }">{{ result.data.overdueCount }}</span>
                <span class="summary-stat-label">Overdue</span>
              </div>
              <div class="summary-stat">
                <span class="summary-stat-value">{{ result.data.pomodorosToday }}</span>
                <span class="summary-stat-label">Pomodoros</span>
              </div>
              <div v-if="result.data.totalFocusMinutes != null" class="summary-stat">
                <span class="summary-stat-value">{{ formatMinutes(result.data.totalFocusMinutes) }}</span>
                <span class="summary-stat-label">Focus Time</span>
              </div>
              <div v-if="result.data.currentStreak != null" class="summary-stat">
                <span class="summary-stat-value">{{ result.data.currentStreak }}d</span>
                <span class="summary-stat-label">Streak</span>
              </div>
            </div>
          </div>

          <!-- Suggest Next Task Card -->
          <div v-else-if="isSuggestNextTaskResult(result)" class="tool-result-card">
            <div class="tool-result-header tool-read">
              <TrendingUp :size="14" class="tool-result-icon" />
              <span class="tool-result-title" dir="auto">{{ result.message }}</span>
            </div>
            <div v-if="result.data.length === 0" class="gam-empty" dir="auto">
              No suggestions available. All tasks are done!
            </div>
            <div class="task-list">
              <button
                v-for="(task, taskIdx) in result.data"
                :key="task.id"
                class="task-list-item suggest-item"
                :class="{ 'task-completed': completedTaskIds.has(task.id) }"
                @click="openQuickEdit(task, $event)"
              >
                <span class="suggest-rank">{{ Number(taskIdx) + 1 }}</span>
                <span class="task-title" :dir="direction || 'auto'">{{ task.title }}</span>
                <div class="task-meta-row">
                  <span
                    class="task-priority-dot"
                    :style="{ background: priorityColor(task.priority) }"
                  />
                  <span class="suggest-reason" :class="'reason-' + task.reason.replace(/\s+/g, '-')" dir="auto">{{ task.reason }}</span>
                  <span v-if="task.dueDate" class="task-due-date">{{ formatRelativeDate(task.dueDate) }}</span>
                </div>
                <div class="task-inline-actions" @click.stop>
                  <button
                    v-if="!completedTaskIds.has(task.id)"
                    class="inline-action-btn inline-done-btn"
                    :class="{ loading: actionLoading[task.id] === 'done' }"
                    title="Mark done"
                    @click="markTaskDone(task.id, $event)"
                  >
                    <Loader2 v-if="actionLoading[task.id] === 'done'" :size="12" class="spin" />
                    <CheckCircle2 v-else :size="12" />
                  </button>
                  <button
                    v-if="!timerStartedTaskIds.has(task.id)"
                    class="inline-action-btn inline-timer-btn"
                    :class="{ loading: actionLoading[task.id] === 'timer' }"
                    title="Start timer"
                    @click="startTaskTimer(task.id, $event)"
                  >
                    <Loader2 v-if="actionLoading[task.id] === 'timer'" :size="12" class="spin" />
                    <Play v-else :size="12" />
                  </button>
                  <span v-if="completedTaskIds.has(task.id)" class="inline-action-done-badge">
                    <CheckCircle2 :size="12" /> Done
                  </span>
                  <span v-if="timerStartedTaskIds.has(task.id)" class="inline-action-timer-badge">
                    <Play :size="12" /> Timer started
                  </span>
                </div>
              </button>
            </div>
          </div>

          <!-- Weekly Summary Card -->
          <div v-else-if="isWeeklySummaryResult(result)" class="tool-result-card">
            <div class="tool-result-header tool-read">
              <TrendingUp :size="14" class="tool-result-icon" />
              <span class="tool-result-title" dir="auto">{{ result.message }}</span>
            </div>
            <div class="summary-stats-grid">
              <div class="summary-stat">
                <span class="summary-stat-value summary-stat-success">{{ result.data.completedThisWeek }}</span>
                <span class="summary-stat-label">Done This Week</span>
              </div>
              <div class="summary-stat">
                <span class="summary-stat-value">{{ result.data.remainingTasks }}</span>
                <span class="summary-stat-label">Remaining</span>
              </div>
              <div v-if="result.data.level != null" class="summary-stat">
                <span class="summary-stat-value">Lv.{{ result.data.level }}</span>
                <span class="summary-stat-label">Level</span>
              </div>
              <div v-if="result.data.currentStreak != null" class="summary-stat">
                <span class="summary-stat-value">{{ result.data.currentStreak }}d</span>
                <span class="summary-stat-label">Streak</span>
              </div>
              <div v-if="result.data.focusMinutes != null" class="summary-stat">
                <span class="summary-stat-value">{{ formatMinutes(result.data.focusMinutes) }}</span>
                <span class="summary-stat-label">Focus Time</span>
              </div>
              <div v-if="result.data.totalXp != null" class="summary-stat">
                <span class="summary-stat-value">{{ result.data.totalXp }}</span>
                <span class="summary-stat-label">Total XP</span>
              </div>
            </div>
            <!-- Challenge info if available -->
            <div v-if="result.data.challenges" class="gam-footer-row">
              <span v-if="result.data.challenges.completedToday > 0" class="gam-footer-badge gam-badge-success">
                {{ result.data.challenges.completedToday }} challenges done today
              </span>
              <span v-if="result.data.challenges.corruptionLevel > 0" class="gam-footer-badge gam-badge-corruption">
                Corruption: {{ result.data.challenges.corruptionLevel }}%
              </span>
            </div>
          </div>

          <!-- Weekly Plan Card -->
          <div v-else-if="isWeeklyPlanResult(result)" class="tool-result-card weekly-plan-card">
            <div class="tool-result-header tool-read">
              <CalendarDays :size="14" class="tool-result-icon" />
              <span class="tool-result-title" dir="auto">{{ result.message }}</span>
            </div>
            <div class="summary-stats-grid">
              <div class="summary-stat">
                <span class="summary-stat-value summary-stat-success">{{ result.data.totalScheduled }}</span>
                <span class="summary-stat-label">Scheduled</span>
              </div>
              <div class="summary-stat">
                <span class="summary-stat-value">{{ result.data.daysUsed }}</span>
                <span class="summary-stat-label">Days Used</span>
              </div>
              <div class="summary-stat">
                <span class="summary-stat-value" :class="{ 'summary-stat-danger': result.data.unscheduled?.length > 0 }">{{ result.data.unscheduled?.length || 0 }}</span>
                <span class="summary-stat-label">Unscheduled</span>
              </div>
            </div>
            <template v-for="(dayKey) in ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']" :key="dayKey">
              <div v-if="result.data.plan[dayKey]?.length > 0" class="task-list">
                <div class="summary-section-label">
                  {{ PLAN_DAY_LABELS[dayKey] }}
                  <span class="section-count">({{ result.data.plan[dayKey].length }})</span>
                </div>
                <button
                  v-for="task in result.data.plan[dayKey]"
                  :key="task.id"
                  class="task-list-item"
                  :class="{ 'task-completed': completedTaskIds.has(task.id) }"
                  @click="openQuickEdit(task, $event)"
                >
                  <span
                    class="task-priority-dot"
                    :style="{ background: priorityColor(task.priority) }"
                  />
                  <span class="task-title" :dir="direction || 'auto'">{{ task.title }}</span>
                  <div class="task-inline-actions" @click.stop>
                    <button
                      v-if="!completedTaskIds.has(task.id)"
                      class="inline-action-btn inline-done-btn"
                      :class="{ loading: actionLoading[task.id] === 'done' }"
                      title="Mark done"
                      @click="markTaskDone(task.id, $event)"
                    >
                      <Loader2 v-if="actionLoading[task.id] === 'done'" :size="12" class="spin" />
                      <CheckCircle2 v-else :size="12" />
                    </button>
                    <button
                      v-if="!timerStartedTaskIds.has(task.id)"
                      class="inline-action-btn inline-timer-btn"
                      :class="{ loading: actionLoading[task.id] === 'timer' }"
                      title="Start timer"
                      @click="startTaskTimer(task.id, $event)"
                    >
                      <Loader2 v-if="actionLoading[task.id] === 'timer'" :size="12" class="spin" />
                      <Play v-else :size="12" />
                    </button>
                    <span v-if="completedTaskIds.has(task.id)" class="inline-action-done-badge">
                      <CheckCircle2 :size="12" /> Done
                    </span>
                    <span v-if="timerStartedTaskIds.has(task.id)" class="inline-action-timer-badge">
                      <Play :size="12" /> Timer started
                    </span>
                  </div>
                </button>
              </div>
            </template>
            <div v-if="result.data.unscheduled?.length > 0" class="task-list">
              <div class="summary-section-label">
                Unscheduled
                <span class="section-count">({{ result.data.unscheduled.length }})</span>
              </div>
              <button
                v-for="task in result.data.unscheduled"
                :key="task.id"
                class="task-list-item task-unscheduled"
                @click="openQuickEdit(task, $event)"
              >
                <span
                  class="task-priority-dot"
                  :style="{ background: priorityColor(task.priority) }"
                />
                <span class="task-title" :dir="direction || 'auto'">{{ task.title }}</span>
              </button>
            </div>
            <div v-if="result.data.reasoning" class="plan-reasoning" dir="auto">
              {{ result.data.reasoning }}
            </div>
          </div>

          <!-- Rich task list for read tools that return tasks -->
          <div v-else-if="isTaskListResult(result)" class="tool-result-card">
            <div class="tool-result-header" :class="'tool-' + (result.type || 'read')">
              <component :is="toolIcon(result.type)" :size="14" class="tool-result-icon" />
              <span class="tool-result-title" dir="auto">{{ result.message }}</span>
              <span v-if="getTasksFromResult(result).length > MAX_VISIBLE_TASKS" class="section-count">({{ getTasksFromResult(result).length }})</span>
            </div>
            <div class="task-list">
              <button
                v-for="task in visibleTasks(getTasksFromResult(result), 'tasklist-' + result.tool)"
                :key="task.id"
                class="task-list-item"
                :class="{ 'task-completed': completedTaskIds.has(task.id) }"
                @click="openQuickEdit(task, $event)"
              >
                <span
                  class="task-priority-dot"
                  :style="{ background: priorityColor(task.priority) }"
                />
                <span class="task-title" :dir="direction || 'auto'">{{ task.title || '(untitled)' }}</span>
                <div class="task-meta-row">
                  <span v-if="task.daysOverdue" class="task-overdue-badge">{{ task.daysOverdue }}d overdue</span>
                  <span
                    v-else-if="task.dueDate"
                    class="task-due-date"
                  >{{ formatRelativeDate(task.dueDate) }}</span>
                  <span
                    v-if="task.status"
                    class="task-status-badge"
                    :class="'status-' + task.status"
                  >{{ task.status }}</span>
                </div>
                <div class="task-inline-actions" @click.stop>
                  <button
                    v-if="!completedTaskIds.has(task.id)"
                    class="inline-action-btn inline-done-btn"
                    :class="{ loading: actionLoading[task.id] === 'done' }"
                    title="Mark done"
                    @click="markTaskDone(task.id, $event)"
                  >
                    <Loader2 v-if="actionLoading[task.id] === 'done'" :size="12" class="spin" />
                    <CheckCircle2 v-else :size="12" />
                  </button>
                  <button
                    v-if="!timerStartedTaskIds.has(task.id)"
                    class="inline-action-btn inline-timer-btn"
                    :class="{ loading: actionLoading[task.id] === 'timer' }"
                    title="Start timer"
                    @click="startTaskTimer(task.id, $event)"
                  >
                    <Loader2 v-if="actionLoading[task.id] === 'timer'" :size="12" class="spin" />
                    <Play v-else :size="12" />
                  </button>
                  <span v-if="completedTaskIds.has(task.id)" class="inline-action-done-badge">
                    <CheckCircle2 :size="12" /> Done
                  </span>
                  <span v-if="timerStartedTaskIds.has(task.id)" class="inline-action-timer-badge">
                    <Play :size="12" /> Timer started
                  </span>
                </div>
              </button>
              <button
                v-if="getTasksFromResult(result).length > MAX_VISIBLE_TASKS"
                class="show-more-btn"
                @click="toggleSection('tasklist-' + result.tool)"
              >
                {{ expandedSections.has('tasklist-' + result.tool)
                  ? 'Show less'
                  : `Show all ${getTasksFromResult(result).length} tasks` }}
              </button>
            </div>
          </div>
          <!-- Simple chip for write/destructive results or results without task data -->
          <div v-else class="tool-result-chip" :class="'tool-' + (result.type || 'read')">
            <component :is="toolIcon(result.type)" :size="12" class="tool-result-icon" />
            <span dir="auto">{{ result.message }}</span>
          </div>
        </template>
      </div>

      <!-- Error -->
      <div v-if="hasError" class="message-error-text">
        {{ message.error }}
      </div>

      <!-- Actions -->
      <div v-if="hasActions && !isStreaming" class="message-actions">
        <button
          v-for="action in message.actions"
          :key="action.id"
          class="action-btn"
          :class="{
            'action-primary': action.variant === 'primary',
            'action-secondary': action.variant === 'secondary',
            'action-danger': action.variant === 'danger',
            'action-completed': action.completed
          }"
          :disabled="isActionLoading(action) || action.completed"
          @click="handleAction(action)"
        >
          <Loader2
            v-if="isActionLoading(action)"
            class="action-icon spin"
            :size="14"
          />
          <Check
            v-else-if="action.completed"
            class="action-icon"
            :size="14"
          />
          <span>{{ action.label }}</span>
        </button>
      </div>

      <!-- Metadata -->
      <div v-if="message.metadata && !isStreaming" class="message-meta">
        <span v-if="message.metadata.model">{{ message.metadata.model }}</span>
        <span v-if="message.metadata.latencyMs">{{ message.metadata.latencyMs }}ms</span>
      </div>
    </div>

    <!-- Copy Button (hover overlay) -->
    <button
      v-if="!isStreaming && message.content"
      class="copy-btn"
      :class="{ 'copy-success': copied }"
      :title="copied ? 'Copied!' : 'Copy message'"
      @click="copyMessage"
    >
      <CheckCheck v-if="copied" :size="14" />
      <Copy v-else :size="14" />
    </button>

    <!-- Task Quick-Edit Popover -->
    <TaskQuickEditPopover
      :is-visible="!!quickEditTask"
      :task="quickEditTask"
      :x="quickEditPos.x"
      :y="quickEditPos.y"
      :position="quickEditPosition"
      @close="closeQuickEdit"
      @open-full-editor="openFullEditor"
    />
  </div>
</template>

<style scoped>
/* ============================================================================
   Message Container
   ============================================================================ */

.chat-message {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3);
  padding-inline-end: calc(var(--space-3) + 36px); /* Reserve space for copy button */
  border-radius: var(--radius-lg);
  animation: fadeIn 0.2s ease;
  position: relative;
}

.chat-message:hover .copy-btn {
  opacity: 1;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(var(--space-1));
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ============================================================================
   User Message
   ============================================================================ */

.message-user {
  background: var(--purple-bg-subtle);
  margin-inline-start: var(--space-4);
}

.message-user .message-avatar {
  background: var(--color-focus);
  color: white;
}

/* ============================================================================
   Assistant Message
   ============================================================================ */

.message-assistant {
  background: var(--glass-bg-weak);
  margin-inline-end: var(--space-4);
}

.message-assistant .message-avatar {
  background: linear-gradient(135deg, var(--color-focus), var(--color-info));
  color: white;
}

/* ============================================================================
   Avatar
   ============================================================================ */

.message-avatar {
  width: var(--space-7);
  height: var(--space-7);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* ============================================================================
   Content
   ============================================================================ */

.message-content {
  flex: 1;
  min-width: 0;
}

.message-text {
  color: var(--text-primary);
  font-size: var(--text-sm);
  line-height: 1.6;
  word-break: break-word;
}

/* ============================================================================
   Copy Button
   ============================================================================ */

.copy-btn {
  position: absolute;
  top: var(--space-2);
  inset-inline-end: var(--space-2);
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--space-7);
  height: var(--space-7);
  border: none;
  background: var(--border-subtle);
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.copy-btn:hover {
  background: var(--border-medium);
  color: var(--text-primary);
}

.copy-btn.copy-success {
  opacity: 1;
  color: var(--color-success);
}

/* ============================================================================
   Thinking Indicator
   ============================================================================ */

.thinking-indicator {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-2) 0;
}

.thinking-dot {
  width: var(--space-1_5);
  height: var(--space-1_5);
  border-radius: 50%;
  background: var(--color-focus);
  animation: thinking 1.4s ease-in-out infinite;
}

.thinking-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.thinking-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes thinking {
  0%, 80%, 100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}

/* ============================================================================
   Streaming Cursor
   ============================================================================ */

.cursor-blink {
  animation: blink 1s step-end infinite;
  color: var(--color-focus);
  font-weight: bold;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.message-streaming {
  border: 1px solid var(--color-focus);
  border-style: dashed;
}

/* ============================================================================
   Markdown Styles
   ============================================================================ */

.markdown-body :deep(p) {
  margin: 0 0 var(--space-2);
}

.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  color: var(--text-primary);
  font-weight: var(--font-semibold);
  margin: var(--space-3) 0 var(--space-2);
}

.markdown-body :deep(h1) { font-size: 1.25em; }
.markdown-body :deep(h2) { font-size: 1.15em; }
.markdown-body :deep(h3) { font-size: 1.05em; }
.markdown-body :deep(h4) { font-size: 1em; }

.markdown-body :deep(h1:first-child),
.markdown-body :deep(h2:first-child),
.markdown-body :deep(h3:first-child),
.markdown-body :deep(h4:first-child) {
  margin-top: 0;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-inline-start: var(--space-4);
  margin: 0 0 var(--space-2);
}

.markdown-body :deep(li) {
  margin-bottom: var(--space-1);
}

.markdown-body :deep(li:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(code) {
  background: var(--overlay-bg);
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.9em;
  color: var(--color-focus);
}

.markdown-body :deep(pre) {
  background: var(--overlay-dark);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  margin: var(--space-2) 0;
  overflow-x: auto;
}

.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
  color: var(--text-primary);
  font-size: var(--text-meta);
  line-height: 1.5;
}

.markdown-body :deep(blockquote) {
  border-inline-start: 3px solid var(--color-focus);
  padding-inline-start: var(--space-3);
  margin: var(--space-2) 0;
  color: var(--text-secondary);
  font-style: italic;
}

.markdown-body :deep(a) {
  color: var(--color-focus);
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(strong) {
  color: var(--text-primary);
  font-weight: var(--font-semibold);
}

.markdown-body :deep(em) {
  color: var(--text-secondary);
}

.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--border-subtle);
  margin: var(--space-3) 0;
}

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: var(--space-2) 0;
  font-size: var(--text-meta);
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid var(--border-subtle);
  padding: var(--space-1) var(--space-2);
  text-align: inherit;
}

.markdown-body :deep(th) {
  background: var(--overlay-dark);
  font-weight: var(--font-semibold);
}

/* ============================================================================
   Tool Result Chips
   ============================================================================ */

.tool-results {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-top: var(--space-2);
}

.tool-result-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-0_5) var(--space-2);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.tool-read {
  background: var(--blue-bg-light);
  color: var(--status-planned-text);
}

.tool-write {
  background: var(--success-bg-light);
  color: var(--color-success-500);
}

.tool-destructive {
  background: var(--danger-bg-light);
  color: var(--color-priority-high);
}

.tool-result-icon {
  flex-shrink: 0;
}

/* ============================================================================
   Rich Tool Result Cards (task lists)
   ============================================================================ */

.tool-result-card {
  width: 100%;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  overflow: visible;
  margin-top: var(--space-2);
}

.tool-result-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
}

.tool-result-header.tool-read {
  background: var(--blue-bg-subtle);
  color: var(--status-planned-text);
}

.tool-result-header.tool-write {
  background: var(--success-bg-light);
  color: var(--color-success-500);
}

.tool-result-header.tool-destructive {
  background: var(--danger-bg-light);
  color: var(--color-priority-high);
}

.tool-result-title {
  flex: 1;
  min-width: 0;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
}

.task-list-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-rows: auto auto;
  gap: var(--space-0_5) var(--space-2);
  align-items: center;
  padding: var(--space-2_5) var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-primary);
  font-size: var(--text-sm);
  text-align: start;
  cursor: pointer;
  transition: all 0.12s ease;
  width: 100%;
  position: relative;
}

.task-list-item:hover {
  background: var(--glass-bg-light);
  border-color: var(--glass-border);
}

.task-priority-dot {
  grid-row: 1;
  grid-column: 1;
  width: var(--space-2_5);
  height: var(--space-2_5);
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: var(--space-1);
  cursor: pointer;
  /* Bigger click target via padding + negative margin */
  padding: var(--space-1);
  background-clip: content-box;
}

.task-meta-row {
  grid-row: 2;
  grid-column: 2 / -1;
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
  align-items: center;
}

.task-title {
  grid-row: 1;
  grid-column: 2;
  min-width: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
  text-align: start;
  unicode-bidi: plaintext;
  font-weight: var(--font-medium);
  line-height: 1.4;
}

.task-overdue-badge {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--color-priority-high);
  background: var(--danger-bg-light);
  padding: 1px var(--space-1_5);
  border-radius: var(--radius-full);
  flex-shrink: 0;
  cursor: pointer;
}

.task-due-date {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.task-status-badge {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.status-planned { background: var(--purple-bg-subtle); color: var(--status-planned-text); }
.status-in_progress { background: var(--blue-bg-light); color: var(--status-in-progress-text); }
.status-done { background: var(--success-bg-light); color: var(--status-done-text); }
.status-backlog { background: var(--glass-bg-light); color: var(--text-muted); }

/* ============================================================================
   Daily Summary Stats Grid
   ============================================================================ */

.summary-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: var(--glass-border-faint);
}

.summary-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-0_5);
  padding: var(--space-2) var(--space-1);
  background: var(--overlay-component-bg);
}

.summary-stat-value {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  line-height: 1;
}

.summary-stat-label {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.summary-stat-success {
  color: var(--color-success-500);
}

.summary-stat-danger {
  color: var(--color-priority-high);
}

.summary-section-label {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-3) var(--space-1);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-top: 1px solid var(--glass-border-faint);
}

.section-count {
  font-weight: var(--font-medium);
  color: var(--text-muted);
  text-transform: none;
  letter-spacing: normal;
}

.show-more-btn {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: none;
  background: transparent;
  color: var(--accent-primary, #8b5cf6);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  text-align: center;
  border-top: 1px solid var(--glass-border-faint);
  transition: background var(--duration-fast) ease;
}

.show-more-btn:hover {
  background: var(--purple-bg-subtle);
}

/* ============================================================================
   Error
   ============================================================================ */

.message-error {
  border: 1px solid var(--color-danger);
}

.message-error-text {
  color: var(--color-danger);
  font-size: var(--text-xs);
  margin-top: var(--space-2);
}

/* ============================================================================
   Actions
   ============================================================================ */

.message-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-meta);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

.action-primary {
  background: var(--color-focus);
  color: white;
}

.action-primary:hover:not(:disabled) {
  background: var(--brand-hover);
}

.action-secondary {
  background: transparent;
  border-color: var(--border-medium);
  color: var(--text-primary);
}

.action-secondary:hover:not(:disabled) {
  background: var(--border-subtle);
}

.action-danger {
  background: transparent;
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.action-danger:hover:not(:disabled) {
  background: var(--danger-bg-light);
}

.action-completed {
  background: var(--success-bg-light);
  border-color: var(--color-success);
  color: var(--color-success);
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-icon {
  flex-shrink: 0;
}

/* ============================================================================
   Metadata
   ============================================================================ */

.message-meta {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

/* ============================================================================
   Animations
   ============================================================================ */

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ============================================================================
   Gamification Status Card
   ============================================================================ */

.gam-profile-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
}

.gam-level-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: var(--level-badge-size);
  height: var(--level-badge-size);
  border-radius: 50%;
  background: var(--level-badge-bg);
  flex-shrink: 0;
}

.gam-level-number {
  font-size: var(--text-xl);
  font-weight: 800;
  color: white;
  line-height: 1;
}

.gam-level-label {
  font-size: 8px;
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.gam-xp-section {
  flex: 1;
  min-width: 0;
}

.gam-xp-bar-wrapper {
  height: var(--space-2);
  background: var(--border-subtle);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.gam-xp-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--color-focus), #06b6d4);
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}

.gam-xp-text {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-top: var(--space-1);
}

.gam-stats-row {
  display: flex;
  border-top: 1px solid var(--glass-border-faint);
}

.gam-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-0_5);
  padding: var(--space-2) var(--space-1);
}

.gam-stat-icon {
  color: var(--text-secondary);
}

.gam-streak-icon {
  color: var(--color-priority-medium);
}

.gam-corruption-icon {
  color: var(--color-info);
}

.gam-corruption-icon.gam-corruption-high {
  color: var(--color-priority-high);
}

.gam-achievement-icon {
  color: rgb(var(--tier-gold));
}

.gam-stat-value {
  font-size: var(--text-sm);
  font-weight: var(--font-bold);
  color: var(--text-primary);
}

.gam-stat-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.gam-warning {
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-xs);
  color: var(--color-priority-medium);
  background: var(--orange-bg-light);
  border-top: 1px solid var(--orange-bg-medium);
}

.gam-empty {
  padding: var(--space-3);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  text-align: center;
  font-style: italic;
}

/* ============================================================================
   Challenges Card
   ============================================================================ */

.challenge-section {
  /* Sections container */
}

.challenge-item {
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--glass-border-faint);
}

.challenge-item.challenge-boss {
  background: var(--danger-bg-subtle);
}

.challenge-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.challenge-title {
  font-size: var(--text-meta);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
}

.boss-title {
  color: var(--color-priority-high);
}

.challenge-difficulty {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  padding: 1px var(--space-1_5);
  border-radius: var(--radius-sm);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

.diff-easy { background: var(--success-bg-light); color: var(--status-done-text); }
.diff-normal { background: var(--blue-bg-light); color: var(--status-planned-text); }
.diff-hard { background: var(--orange-bg-light); color: var(--color-priority-medium); }
.diff-boss { background: var(--danger-bg-light); color: var(--color-priority-high); }

.challenge-flavor {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  font-style: italic;
  margin-top: var(--space-0_5);
}

.challenge-progress-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.challenge-progress-bar-wrapper {
  flex: 1;
  height: var(--space-1_5);
  background: var(--border-subtle);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.challenge-progress-bar {
  height: 100%;
  background: var(--color-focus);
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}

.challenge-progress-bar.bar-complete {
  background: var(--status-done-text);
}

.boss-bar-wrapper {
  height: var(--space-2);
}

.boss-bar {
  background: linear-gradient(90deg, var(--color-priority-high), var(--color-priority-medium));
}

.challenge-progress-text {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  white-space: nowrap;
}

.challenge-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--space-1);
}

.challenge-reward {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--color-focus);
}

.boss-reward {
  color: var(--color-priority-high);
}

.challenge-time {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

/* ============================================================================
   Achievements Near Completion Card
   ============================================================================ */

.achievement-item {
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--glass-border-faint);
}

.achievement-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.achievement-tier-dot {
  width: var(--space-2);
  height: var(--space-2);
  border-radius: 50%;
  flex-shrink: 0;
}

.achievement-name {
  font-size: var(--text-meta);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  flex: 1;
}

.achievement-percent {
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  color: var(--color-focus);
}

.achievement-desc {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-top: var(--space-0_5);
}

.achievement-progress-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.achievement-bar-wrapper {
  flex: 1;
  height: var(--space-1);
  background: var(--border-subtle);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.achievement-bar {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}

.achievement-remaining {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  white-space: nowrap;
}

.achievement-reward {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--color-focus);
}

/* ============================================================================
   Suggest Next Task Card
   ============================================================================ */

.suggest-item {
  grid-template-columns: auto auto 1fr;
}

.suggest-rank {
  grid-row: 1;
  grid-column: 1;
  width: var(--space-5);
  height: var(--space-5);
  border-radius: 50%;
  background: var(--color-focus);
  color: white;
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.suggest-item .task-title {
  grid-row: 1;
  grid-column: 2 / -1;
}

.suggest-item .task-meta-row {
  grid-row: 2;
  grid-column: 2 / -1;
}

.suggest-reason {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: 1px var(--space-1_5);
  border-radius: var(--radius-full);
}

.reason-overdue { background: var(--danger-bg-light); color: var(--color-priority-high); }
.reason-due-today { background: var(--orange-bg-light); color: var(--color-priority-medium); }
.reason-high-priority { background: var(--purple-bg-subtle); color: var(--status-planned-text); }
.reason-next-up { background: var(--blue-bg-light); color: var(--status-planned-text); }

/* ============================================================================
   Weekly Summary Footer
   ============================================================================ */

.gam-footer-row {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--glass-border-faint);
  flex-wrap: wrap;
}

.gam-footer-badge {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: var(--space-0_5) var(--space-2);
  border-radius: var(--radius-full);
}

.gam-badge-success {
  background: var(--success-bg-light);
  color: var(--status-done-text);
}

.gam-badge-corruption {
  background: var(--danger-bg-light);
  color: var(--color-priority-high);
}

/* ============================================================================
   Inline Task Actions (hover)
   ============================================================================ */

.task-inline-actions {
  grid-row: 1;
  grid-column: 3;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  opacity: 0.7;
  transition: opacity 0.15s ease;
}

.task-list-item:hover .task-inline-actions {
  opacity: 1;
}

.inline-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--glass-border-faint);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.inline-done-btn {
  background: var(--success-bg-light);
  color: var(--color-success);
}

.inline-done-btn:hover {
  background: var(--color-success);
  color: white;
}

.inline-timer-btn {
  background: var(--blue-bg-light);
  color: var(--status-in-progress-text);
}

.inline-timer-btn:hover {
  background: var(--status-in-progress-text);
  color: white;
}

.inline-action-btn.loading {
  opacity: 0.6;
  pointer-events: none;
}

.inline-action-done-badge,
.inline-action-timer-badge {
  display: flex;
  align-items: center;
  gap: var(--space-0_5);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: 2px var(--space-1_5);
  border-radius: var(--radius-sm);
}

.inline-action-done-badge {
  background: var(--success-bg-light);
  color: var(--color-success);
}

.inline-action-timer-badge {
  background: var(--blue-bg-light);
  color: var(--status-in-progress-text);
}

.task-list-item.task-completed .task-title {
  text-decoration: line-through;
  opacity: 0.6;
}

/* ============================================================================
   Weekly Plan Card
   ============================================================================ */

.weekly-plan-card .task-list-item {
  grid-template-columns: auto 1fr auto;
  grid-template-rows: auto;
}

.task-unscheduled {
  opacity: 0.6;
}

.plan-reasoning {
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  font-style: italic;
  border-top: 1px solid var(--glass-border-faint);
}
</style>
