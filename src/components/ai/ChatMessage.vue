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

import { computed, ref, nextTick, onMounted, onUnmounted } from 'vue'
import { User, Sparkles, Loader2, Check, Copy, CheckCheck, Zap, PenLine, Trash2 } from 'lucide-vue-next'
import MarkdownIt from 'markdown-it'
import type { ChatMessage, ChatAction } from '@/stores/aiChat'
import { executeTool } from '@/services/ai/tools'
import type { ToolCall } from '@/services/ai/tools'
import { formatRelativeDate } from '@/utils/dateUtils'

// ============================================================================
// Props
// ============================================================================

const props = defineProps<{
  message: ChatMessage
}>()

const emit = defineEmits<{
  'select-task': [taskId: string]
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
    // Strip "I'll use the X tool" preamble lines
    content = content.replace(/^I['']ll (?:use|call|invoke) the \w[\w\s]* tool.*$/gm, '')
    // Clean up extra blank lines left behind
    content = content.replace(/\n{3,}/g, '\n\n').trim()
  }

  if (!content) return ''

  return md.render(content)
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
const TASK_LIST_TOOLS = ['get_overdue_tasks', 'list_tasks', 'search_tasks', 'get_daily_summary']

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

function priorityColor(priority?: string): string {
  switch (priority) {
    case 'urgent': return '#ef4444'
    case 'high': return '#f97316'
    case 'medium': return '#eab308'
    case 'low': return '#22c55e'
    default: return 'rgba(255,255,255,0.4)'
  }
}

function selectTask(taskId: string) {
  // Emit event to parent to navigate/select the task
  emit('select-task', taskId)
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

// ============================================================================
// Inline Editing
// ============================================================================

const editingTaskId = ref<string | null>(null)
const editingField = ref<'priority' | 'status' | 'date' | null>(null)
const editDateValue = ref('')

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
  { value: 'high', label: 'High', color: '#f97316' },
  { value: 'medium', label: 'Medium', color: '#eab308' },
  { value: 'low', label: 'Low', color: '#22c55e' },
  { value: null, label: 'None', color: 'rgba(255,255,255,0.4)' }
] as const

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
  { value: 'backlog', label: 'Backlog' }
] as const

function isDropdownOpen(taskId: string, field: 'priority' | 'status' | 'date'): boolean {
  return editingTaskId.value === taskId && editingField.value === field
}

function toggleDropdown(taskId: string, field: 'priority' | 'status' | 'date', event: Event) {
  event.stopPropagation()
  if (editingTaskId.value === taskId && editingField.value === field) {
    closeDropdown()
  } else {
    editingTaskId.value = taskId
    editingField.value = field
  }
}

function closeDropdown() {
  editingTaskId.value = null
  editingField.value = null
  editDateValue.value = ''
}

function handleDocumentClick() {
  if (editingTaskId.value) closeDropdown()
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
})

async function updateTaskPriority(taskId: string, priority: string | null, event: Event) {
  event.stopPropagation()
  closeDropdown()
  try {
    await executeTool({ tool: 'update_task', parameters: { taskId, updates: { priority } } })
  } catch (err) {
    console.error('[ChatMessage] Failed to update priority:', err)
  }
}

async function updateTaskStatus(taskId: string, status: string, event: Event) {
  event.stopPropagation()
  closeDropdown()
  try {
    await executeTool({ tool: 'update_task', parameters: { taskId, updates: { status } } })
  } catch (err) {
    console.error('[ChatMessage] Failed to update status:', err)
  }
}

async function updateTaskDueDate(taskId: string, event: Event) {
  event.stopPropagation()
  const input = event.target as HTMLInputElement
  const dueDate = input.value || null
  closeDropdown()
  try {
    await executeTool({ tool: 'update_task', parameters: { taskId, updates: { dueDate } } })
  } catch (err) {
    console.error('[ChatMessage] Failed to update due date:', err)
  }
}

function toolIcon(type?: string) {
  switch (type) {
    case 'write': return PenLine
    case 'destructive': return Trash2
    default: return Zap
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
      <div
        v-else-if="renderedContent"
        class="message-text markdown-body"
        dir="auto"
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
              <span class="tool-result-title">{{ result.message }}</span>
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
              <div class="summary-section-label">Overdue Tasks</div>
              <button
                v-for="task in result.data.overdueTasks"
                :key="task.id"
                class="task-list-item"
                @click="selectTask(task.id)"
              >
                <span
                  class="task-priority-dot"
                  :style="{ background: '#ef4444' }"
                  @click="toggleDropdown(task.id, 'priority', $event)"
                />
                <!-- Priority dropdown -->
                <div v-if="isDropdownOpen(task.id, 'priority')" class="inline-dropdown" @click.stop>
                  <button
                    v-for="opt in PRIORITY_OPTIONS"
                    :key="String(opt.value)"
                    class="dropdown-option"
                    @click="updateTaskPriority(task.id, opt.value as string | null, $event)"
                  >
                    <span class="task-priority-dot" :style="{ background: opt.color }" />
                    {{ opt.label }}
                  </button>
                </div>
                <span class="task-title" dir="auto">{{ task.title }}</span>
                <div class="task-meta-row">
                  <span v-if="task.dueDate" class="task-due-date" @click="toggleDropdown(task.id, 'date', $event)">{{ formatRelativeDate(task.dueDate) }}</span>
                  <input
                    v-if="isDropdownOpen(task.id, 'date')"
                    type="date"
                    class="inline-date-input"
                    :value="task.dueDate?.slice(0, 10) || ''"
                    @change="updateTaskDueDate(task.id, $event)"
                    @click.stop
                  />
                </div>
              </button>
            </div>
            <!-- Due today task list if any -->
            <div v-if="result.data.dueTodayTasks?.length > 0" class="task-list">
              <div class="summary-section-label">Due Today</div>
              <button
                v-for="task in result.data.dueTodayTasks"
                :key="task.id"
                class="task-list-item"
                @click="selectTask(task.id)"
              >
                <span
                  class="task-priority-dot"
                  :style="{ background: priorityColor(task.priority) }"
                  @click="toggleDropdown(task.id, 'priority', $event)"
                />
                <!-- Priority dropdown -->
                <div v-if="isDropdownOpen(task.id, 'priority')" class="inline-dropdown" @click.stop>
                  <button
                    v-for="opt in PRIORITY_OPTIONS"
                    :key="String(opt.value)"
                    class="dropdown-option"
                    @click="updateTaskPriority(task.id, opt.value as string | null, $event)"
                  >
                    <span class="task-priority-dot" :style="{ background: opt.color }" />
                    {{ opt.label }}
                  </button>
                </div>
                <span class="task-title" dir="auto">{{ task.title }}</span>
                <div class="task-meta-row">
                  <span
                    v-if="task.status"
                    class="task-status-badge"
                    :class="'status-' + task.status"
                    @click="toggleDropdown(task.id, 'status', $event)"
                  >{{ task.status }}</span>
                  <!-- Status dropdown -->
                  <div v-if="isDropdownOpen(task.id, 'status')" class="inline-dropdown" @click.stop>
                    <button
                      v-for="opt in STATUS_OPTIONS"
                      :key="opt.value"
                      class="dropdown-option"
                      @click="updateTaskStatus(task.id, opt.value, $event)"
                    >
                      <span class="task-status-badge" :class="'status-' + opt.value">{{ opt.label }}</span>
                    </button>
                  </div>
                </div>
              </button>
            </div>
          </div>
          <!-- Rich task list for read tools that return tasks -->
          <div v-else-if="isTaskListResult(result)" class="tool-result-card">
            <div class="tool-result-header" :class="'tool-' + (result.type || 'read')">
              <component :is="toolIcon(result.type)" :size="14" class="tool-result-icon" />
              <span class="tool-result-title">{{ result.message }}</span>
            </div>
            <div class="task-list">
              <button
                v-for="task in getTasksFromResult(result)"
                :key="task.id"
                class="task-list-item"
                @click="selectTask(task.id)"
              >
                <span
                  class="task-priority-dot"
                  :style="{ background: priorityColor(task.priority) }"
                  @click="toggleDropdown(task.id, 'priority', $event)"
                />
                <!-- Priority dropdown -->
                <div v-if="isDropdownOpen(task.id, 'priority')" class="inline-dropdown" @click.stop>
                  <button
                    v-for="opt in PRIORITY_OPTIONS"
                    :key="String(opt.value)"
                    class="dropdown-option"
                    @click="updateTaskPriority(task.id, opt.value as string | null, $event)"
                  >
                    <span class="task-priority-dot" :style="{ background: opt.color }" />
                    {{ opt.label }}
                  </button>
                </div>
                <span class="task-title" dir="auto">{{ task.title }}</span>
                <div class="task-meta-row">
                  <span v-if="task.daysOverdue" class="task-overdue-badge">{{ task.daysOverdue }}d overdue</span>
                  <span
                    v-else-if="task.dueDate"
                    class="task-due-date"
                    @click="toggleDropdown(task.id, 'date', $event)"
                  >{{ formatRelativeDate(task.dueDate) }}</span>
                  <input
                    v-if="isDropdownOpen(task.id, 'date')"
                    type="date"
                    class="inline-date-input"
                    :value="task.dueDate?.slice(0, 10) || ''"
                    @change="updateTaskDueDate(task.id, $event)"
                    @click.stop
                  />
                  <span
                    v-if="task.status"
                    class="task-status-badge"
                    :class="'status-' + task.status"
                    @click="toggleDropdown(task.id, 'status', $event)"
                  >{{ task.status }}</span>
                  <!-- Status dropdown -->
                  <div v-if="isDropdownOpen(task.id, 'status')" class="inline-dropdown" @click.stop>
                    <button
                      v-for="opt in STATUS_OPTIONS"
                      :key="opt.value"
                      class="dropdown-option"
                      @click="updateTaskStatus(task.id, opt.value, $event)"
                    >
                      <span class="task-status-badge" :class="'status-' + opt.value">{{ opt.label }}</span>
                    </button>
                  </div>
                </div>
              </button>
            </div>
          </div>
          <!-- Simple chip for write/destructive results or results without task data -->
          <div v-else class="tool-result-chip" :class="'tool-' + (result.type || 'read')">
            <component :is="toolIcon(result.type)" :size="12" class="tool-result-icon" />
            <span>{{ result.message }}</span>
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
  </div>
</template>

<style scoped>
/* ============================================================================
   Message Container
   ============================================================================ */

.chat-message {
  display: flex;
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px);
  border-radius: var(--radius-lg, 12px);
  animation: fadeIn 0.2s ease;
  position: relative;
}

.chat-message:hover .copy-btn {
  opacity: 1;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
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
  background: var(--accent-bg, rgba(139, 92, 246, 0.1));
  margin-inline-start: var(--space-4, 16px);
}

.message-user .message-avatar {
  background: var(--accent-primary, #8b5cf6);
  color: white;
}

/* ============================================================================
   Assistant Message
   ============================================================================ */

.message-assistant {
  background: var(--bg-elevated, rgba(255, 255, 255, 0.03));
  margin-inline-end: var(--space-4, 16px);
}

.message-assistant .message-avatar {
  background: linear-gradient(135deg, #8b5cf6, #06b6d4);
  color: white;
}

/* ============================================================================
   Avatar
   ============================================================================ */

.message-avatar {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md, 8px);
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
  color: var(--text-primary, #fff);
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

/* ============================================================================
   Copy Button
   ============================================================================ */

.copy-btn {
  position: absolute;
  top: var(--space-2, 8px);
  inset-inline-end: var(--space-2, 8px);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: var(--bg-hover, rgba(255, 255, 255, 0.08));
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.copy-btn:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.12));
  color: var(--text-primary, #fff);
}

.copy-btn.copy-success {
  opacity: 1;
  color: var(--success, #10b981);
}

/* ============================================================================
   Thinking Indicator
   ============================================================================ */

.thinking-indicator {
  display: flex;
  gap: 4px;
  padding: var(--space-2, 8px) 0;
}

.thinking-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-primary, #8b5cf6);
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
  color: var(--accent-primary, #8b5cf6);
  font-weight: bold;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.message-streaming {
  border: 1px solid var(--accent-primary, #8b5cf6);
  border-style: dashed;
}

/* ============================================================================
   Markdown Styles
   ============================================================================ */

.markdown-body :deep(p) {
  margin: 0 0 var(--space-2, 8px);
}

.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  color: var(--text-primary, #fff);
  font-weight: 600;
  margin: var(--space-3, 12px) 0 var(--space-2, 8px);
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
  padding-inline-start: var(--space-4, 16px);
  margin: 0 0 var(--space-2, 8px);
}

.markdown-body :deep(li) {
  margin-bottom: var(--space-1, 4px);
}

.markdown-body :deep(li:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(code) {
  background: rgba(0, 0, 0, 0.3);
  padding: 1px 5px;
  border-radius: var(--radius-sm, 4px);
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.9em;
  color: var(--accent-primary, #8b5cf6);
}

.markdown-body :deep(pre) {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  border-radius: var(--radius-md, 8px);
  padding: var(--space-3, 12px);
  margin: var(--space-2, 8px) 0;
  overflow-x: auto;
}

.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
  color: var(--text-primary, #fff);
  font-size: 13px;
  line-height: 1.5;
}

.markdown-body :deep(blockquote) {
  border-inline-start: 3px solid var(--accent-primary, #8b5cf6);
  padding-inline-start: var(--space-3, 12px);
  margin: var(--space-2, 8px) 0;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  font-style: italic;
}

.markdown-body :deep(a) {
  color: var(--accent-primary, #8b5cf6);
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(strong) {
  color: var(--text-primary, #fff);
  font-weight: 600;
}

.markdown-body :deep(em) {
  color: var(--text-secondary, rgba(255, 255, 255, 0.8));
}

.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  margin: var(--space-3, 12px) 0;
}

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: var(--space-2, 8px) 0;
  font-size: 13px;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  padding: var(--space-1, 4px) var(--space-2, 8px);
  text-align: inherit;
}

.markdown-body :deep(th) {
  background: rgba(0, 0, 0, 0.2);
  font-weight: 600;
}

/* ============================================================================
   Tool Result Chips
   ============================================================================ */

.tool-results {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1, 4px);
  margin-top: var(--space-2, 8px);
}

.tool-result-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1, 4px);
  padding: 2px var(--space-2, 8px);
  border-radius: var(--radius-full, 9999px);
  font-size: 11px;
  font-weight: 500;
}

.tool-read {
  background: rgba(59, 130, 246, 0.12);
  color: rgb(96, 165, 250);
}

.tool-write {
  background: rgba(34, 197, 94, 0.12);
  color: rgb(74, 222, 128);
}

.tool-destructive {
  background: rgba(239, 68, 68, 0.12);
  color: rgb(248, 113, 113);
}

.tool-result-icon {
  flex-shrink: 0;
}

/* ============================================================================
   Rich Tool Result Cards (task lists)
   ============================================================================ */

.tool-result-card {
  width: 100%;
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  overflow: hidden;
  margin-top: var(--space-2, 8px);
}

.tool-result-header {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  padding: var(--space-2, 8px) var(--space-3, 12px);
  font-size: 12px;
  font-weight: 600;
}

.tool-result-header.tool-read {
  background: rgba(59, 130, 246, 0.08);
  color: rgb(96, 165, 250);
}

.tool-result-header.tool-write {
  background: rgba(34, 197, 94, 0.08);
  color: rgb(74, 222, 128);
}

.tool-result-header.tool-destructive {
  background: rgba(239, 68, 68, 0.08);
  color: rgb(248, 113, 113);
}

.tool-result-title {
  flex: 1;
  min-width: 0;
}

.task-list {
  display: flex;
  flex-direction: column;
}

.task-list-item {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  gap: 2px var(--space-2, 8px);
  align-items: start;
  padding: var(--space-2, 8px) var(--space-3, 12px);
  border: none;
  background: transparent;
  color: var(--text-primary, #fff);
  font-size: 13px;
  text-align: start;
  cursor: pointer;
  transition: background 0.12s ease;
  width: 100%;
  position: relative;
}

.task-list-item:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.06));
}

.task-list-item + .task-list-item {
  border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.05));
}

.task-priority-dot {
  grid-row: 1;
  grid-column: 1;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 6px;
  cursor: pointer;
}

.task-meta-row {
  grid-row: 2;
  grid-column: 2;
  display: flex;
  gap: var(--space-1, 4px);
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
}

.task-overdue-badge {
  font-size: 11px;
  font-weight: 500;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.12);
  padding: 1px 6px;
  border-radius: var(--radius-full, 9999px);
  flex-shrink: 0;
}

.task-due-date {
  font-size: 11px;
  color: var(--text-tertiary, rgba(255, 255, 255, 0.4));
  flex-shrink: 0;
}

.task-status-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 1px 5px;
  border-radius: var(--radius-sm, 4px);
  flex-shrink: 0;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.status-planned { background: rgba(139, 92, 246, 0.12); color: #a78bfa; }
.status-in_progress { background: rgba(59, 130, 246, 0.12); color: #60a5fa; }
.status-done { background: rgba(34, 197, 94, 0.12); color: #4ade80; }
.status-backlog { background: rgba(255, 255, 255, 0.06); color: rgba(255, 255, 255, 0.5); }

/* ============================================================================
   Daily Summary Stats Grid
   ============================================================================ */

.summary-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: var(--border-subtle, rgba(255, 255, 255, 0.05));
}

.summary-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--space-2, 8px) var(--space-1, 4px);
  background: var(--bg-primary, rgba(18, 18, 20, 0.98));
}

.summary-stat-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary, #fff);
  line-height: 1;
}

.summary-stat-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-tertiary, rgba(255, 255, 255, 0.4));
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.summary-stat-success {
  color: rgb(74, 222, 128);
}

.summary-stat-danger {
  color: #ef4444;
}

.summary-section-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  padding: var(--space-2, 8px) var(--space-3, 12px) var(--space-1, 4px);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.05));
}

/* ============================================================================
   Error
   ============================================================================ */

.message-error {
  border: 1px solid var(--error, #ef4444);
}

.message-error-text {
  color: var(--error, #ef4444);
  font-size: 12px;
  margin-top: var(--space-2, 8px);
}

/* ============================================================================
   Actions
   ============================================================================ */

.message-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2, 8px);
  margin-top: var(--space-3, 12px);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1, 4px);
  padding: var(--space-1, 4px) var(--space-3, 12px);
  border-radius: var(--radius-md, 8px);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

.action-primary {
  background: var(--accent-primary, #8b5cf6);
  color: white;
}

.action-primary:hover:not(:disabled) {
  background: var(--accent-hover, #7c3aed);
}

.action-secondary {
  background: transparent;
  border-color: var(--border-subtle, rgba(255, 255, 255, 0.12));
  color: var(--text-primary, #fff);
}

.action-secondary:hover:not(:disabled) {
  background: var(--bg-hover, rgba(255, 255, 255, 0.08));
}

.action-danger {
  background: transparent;
  border-color: var(--error, #ef4444);
  color: var(--error, #ef4444);
}

.action-danger:hover:not(:disabled) {
  background: var(--error-bg, rgba(239, 68, 68, 0.1));
}

.action-completed {
  background: var(--success-bg, rgba(16, 185, 129, 0.1));
  border-color: var(--success, #10b981);
  color: var(--success, #10b981);
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
  gap: var(--space-2, 8px);
  margin-top: var(--space-2, 8px);
  font-size: 11px;
  color: var(--text-tertiary, rgba(255, 255, 255, 0.4));
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
   Inline Editing Dropdowns
   ============================================================================ */

.inline-dropdown {
  position: absolute;
  top: 100%;
  inset-inline-start: 0;
  z-index: 50;
  min-width: 140px;
  background: var(--bg-primary, rgba(18, 18, 20, 0.98));
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.12));
  border-radius: var(--radius-md, 8px);
  padding: var(--space-1, 4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  margin-top: 2px;
}

.dropdown-option {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  width: 100%;
  padding: var(--space-1, 4px) var(--space-2, 8px);
  border: none;
  background: transparent;
  color: var(--text-primary, #fff);
  font-size: 12px;
  cursor: pointer;
  border-radius: var(--radius-sm, 4px);
  transition: background 0.1s ease;
}

.dropdown-option:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.08));
}

.inline-date-input {
  font-size: 11px;
  padding: 2px 4px;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.12));
  border-radius: var(--radius-sm, 4px);
  background: var(--bg-primary, rgba(18, 18, 20, 0.98));
  color: var(--text-primary, #fff);
  color-scheme: dark;
}

.task-due-date,
.task-status-badge,
.task-priority-dot {
  cursor: pointer;
}

.task-due-date:hover,
.task-status-badge:hover {
  opacity: 0.8;
}
</style>
