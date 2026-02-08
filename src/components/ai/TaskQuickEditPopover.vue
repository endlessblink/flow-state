<script setup lang="ts">
/**
 * Task Quick-Edit Popover
 *
 * Lightweight popover for editing task properties directly from AI chat results.
 * Uses BasePopover for auto-positioning, teleport, click-outside dismiss.
 * Calls executeTool for all updates (same path as AI tool calls).
 *
 * @see TASK-1283 in MASTER_PLAN.md
 */

import { ref, computed, watch } from 'vue'
import { Check, Play, ExternalLink, AlertCircle } from 'lucide-vue-next'
import BasePopover from '@/components/base/BasePopover.vue'
import { executeTool } from '@/services/ai/tools'
import { useTimerStore } from '@/stores/timer'
import { useChallengesStore } from '@/stores/challenges'
import { getTaskContextTips } from '@/composables/useTaskContextTips'

// ============================================================================
// Types
// ============================================================================

interface QuickEditTask {
  id: string
  title: string
  priority?: string | null
  status?: string
  dueDate?: string | null
  estimatedDuration?: number | null
}

// ============================================================================
// Props & Emits
// ============================================================================

const props = defineProps<{
  isVisible: boolean
  task: QuickEditTask | null
  x: number
  y: number
}>()

const emit = defineEmits<{
  close: []
  'open-full-editor': []
}>()

// ============================================================================
// State
// ============================================================================

const localPriority = ref<string | null>(null)
const localStatus = ref<string>('planned')
const localDueDate = ref<string>('')
const updating = ref(false)
const successFlash = ref(false)

let timerStore: ReturnType<typeof useTimerStore> | null = null
try {
  timerStore = useTimerStore()
} catch { /* not available */ }

// ============================================================================
// Constants
// ============================================================================

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'U', color: '#ef4444' },
  { value: 'high', label: 'H', color: '#f97316' },
  { value: 'medium', label: 'M', color: '#eab308' },
  { value: 'low', label: 'L', color: '#22c55e' },
  { value: null, label: '—', color: 'rgba(255,255,255,0.3)' },
] as const

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'Active' },
  { value: 'done', label: 'Done' },
  { value: 'backlog', label: 'Backlog' },
] as const

// ============================================================================
// Computed
// ============================================================================

const contextTips = computed(() => {
  if (!props.task) return []
  let challengeStore = undefined
  try {
    challengeStore = useChallengesStore()
  } catch { /* not available */ }
  return getTaskContextTips(props.task, timerStore || undefined, challengeStore)
})

// ============================================================================
// Watchers
// ============================================================================

watch(() => props.task, (task) => {
  if (task) {
    localPriority.value = task.priority || null
    localStatus.value = task.status || 'planned'
    localDueDate.value = task.dueDate ? (task.dueDate.includes('T') ? task.dueDate.split('T')[0] : task.dueDate) : ''
  }
}, { immediate: true })

// ============================================================================
// Actions
// ============================================================================

function showSuccess() {
  successFlash.value = true
  setTimeout(() => { successFlash.value = false }, 600)
}

async function setPriority(priority: string | null) {
  if (!props.task || updating.value) return
  localPriority.value = priority
  updating.value = true
  try {
    await executeTool({
      tool: 'update_task',
      parameters: { taskId: props.task.id, priority }
    })
    showSuccess()
  } catch (err) {
    console.error('[TaskQuickEdit] Priority update failed:', err)
  } finally {
    updating.value = false
  }
}

async function setStatus(status: string) {
  if (!props.task || updating.value) return
  localStatus.value = status
  updating.value = true
  try {
    await executeTool({
      tool: 'update_task',
      parameters: { taskId: props.task.id, status }
    })
    showSuccess()
    if (status === 'done') {
      setTimeout(() => emit('close'), 400)
    }
  } catch (err) {
    console.error('[TaskQuickEdit] Status update failed:', err)
  } finally {
    updating.value = false
  }
}

async function setDueDate(event: Event) {
  if (!props.task || updating.value) return
  const input = event.target as HTMLInputElement
  const dueDate = input.value || null
  localDueDate.value = input.value
  updating.value = true
  try {
    await executeTool({
      tool: 'update_task',
      parameters: { taskId: props.task.id, dueDate }
    })
    showSuccess()
  } catch (err) {
    console.error('[TaskQuickEdit] Due date update failed:', err)
  } finally {
    updating.value = false
  }
}

async function markDone() {
  if (!props.task || updating.value) return
  await setStatus('done')
}

async function startTimer() {
  if (!props.task || updating.value) return
  updating.value = true
  try {
    await executeTool({
      tool: 'start_timer',
      parameters: { taskId: props.task.id }
    })
    showSuccess()
    setTimeout(() => emit('close'), 400)
  } catch (err) {
    console.error('[TaskQuickEdit] Start timer failed:', err)
  } finally {
    updating.value = false
  }
}

function openFullEditor() {
  emit('open-full-editor')
}

function close() {
  emit('close')
}
</script>

<template>
  <BasePopover
    :is-visible="isVisible && !!task"
    :x="x"
    :y="y"
    variant="menu"
    position="auto"
    @close="close"
  >
    <div v-if="task" class="quick-edit-popover">
      <!-- Context Tips -->
      <div v-if="contextTips.length > 0" class="tips-banner">
        <div v-for="(tip, idx) in contextTips" :key="idx" class="tip-item">
          <span class="tip-icon">{{ tip.icon }}</span>
          <span class="tip-text">{{ tip.text }}</span>
        </div>
      </div>

      <!-- Task Title -->
      <div class="task-title-row" dir="auto">
        {{ task.title || '(untitled)' }}
      </div>

      <div class="popover-divider" />

      <!-- Priority -->
      <div class="field-row">
        <span class="field-label">Priority</span>
        <div class="priority-dots">
          <button
            v-for="opt in PRIORITY_OPTIONS"
            :key="String(opt.value)"
            class="priority-dot-btn"
            :class="{ active: localPriority === opt.value }"
            :title="opt.label"
            @click="setPriority(opt.value as string | null)"
          >
            <span class="priority-dot" :style="{ background: opt.color }" />
          </button>
        </div>
      </div>

      <!-- Status -->
      <div class="field-row">
        <span class="field-label">Status</span>
        <div class="status-badges">
          <button
            v-for="opt in STATUS_OPTIONS"
            :key="opt.value"
            class="status-badge-btn"
            :class="['status-' + opt.value, { active: localStatus === opt.value }]"
            @click="setStatus(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- Due Date -->
      <div class="field-row">
        <span class="field-label">Due</span>
        <input
          type="date"
          class="date-input"
          :value="localDueDate"
          @change="setDueDate"
        />
      </div>

      <div class="popover-divider" />

      <!-- Action Buttons -->
      <div class="actions-row">
        <button
          class="action-btn action-done"
          :disabled="updating || localStatus === 'done'"
          @click="markDone"
        >
          <Check :size="14" />
          <span>Mark Done</span>
        </button>
        <button
          class="action-btn action-timer"
          :disabled="updating"
          @click="startTimer"
        >
          <Play :size="14" />
          <span>Start Timer</span>
        </button>
      </div>

      <!-- Open Full Editor -->
      <button class="full-editor-link" @click="openFullEditor">
        <span>Open full editor</span>
        <ExternalLink :size="12" />
      </button>

      <!-- Success Flash -->
      <Transition name="flash">
        <div v-if="successFlash" class="success-flash">
          <Check :size="16" />
        </div>
      </Transition>
    </div>
  </BasePopover>
</template>

<style scoped>
.quick-edit-popover {
  width: 280px;
  position: relative;
}

/* ── Tips Banner ── */
.tips-banner {
  background: rgba(234, 179, 8, 0.08);
  border-bottom: 1px solid rgba(234, 179, 8, 0.15);
  padding: var(--space-2, 8px) var(--space-3, 12px);
  border-radius: var(--radius-xl, 16px) var(--radius-xl, 16px) 0 0;
  margin: calc(-1 * var(--space-2, 8px)) calc(-1 * var(--space-2, 8px)) 0;
}

.tip-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-1, 4px);
  font-size: var(--text-xs);
  color: rgba(234, 179, 8, 0.9);
  line-height: 1.4;
}

.tip-item + .tip-item {
  margin-top: 4px;
}

.tip-icon {
  flex-shrink: 0;
  font-size: var(--text-xs);
}

.tip-text {
  min-width: 0;
}

/* ── Task Title ── */
.task-title-row {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary, #fff);
  line-height: 1.4;
  padding: var(--space-2, 8px) var(--space-1, 4px);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  unicode-bidi: plaintext;
}

/* ── Divider ── */
.popover-divider {
  height: 1px;
  background: var(--border-subtle, rgba(255, 255, 255, 0.08));
  margin: var(--space-1, 4px) 0;
}

/* ── Field Rows ── */
.field-row {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  padding: var(--space-1, 4px) 0;
}

.field-label {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-tertiary, rgba(255, 255, 255, 0.4));
  text-transform: uppercase;
  letter-spacing: 0.04em;
  width: 52px;
  flex-shrink: 0;
}

/* ── Priority Dots ── */
.priority-dots {
  display: flex;
  gap: 4px;
}

.priority-dot-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 2px solid transparent;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  transition: border-color 0.12s ease, transform 0.12s ease;
  padding: 0;
}

.priority-dot-btn:hover {
  transform: scale(1.15);
}

.priority-dot-btn.active {
  border-color: rgba(255, 255, 255, 0.4);
}

.priority-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

/* ── Status Badges ── */
.status-badges {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.status-badge-btn {
  font-size: var(--text-xs);
  font-weight: 500;
  padding: 2px 8px;
  border-radius: var(--radius-sm, 4px);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.12s ease;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.status-badge-btn.status-planned {
  background: rgba(139, 92, 246, 0.08);
  color: rgba(167, 139, 250, 0.6);
}
.status-badge-btn.status-planned.active {
  background: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
  border-color: rgba(139, 92, 246, 0.4);
}

.status-badge-btn.status-in_progress {
  background: rgba(59, 130, 246, 0.08);
  color: rgba(96, 165, 250, 0.6);
}
.status-badge-btn.status-in_progress.active {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border-color: rgba(59, 130, 246, 0.4);
}

.status-badge-btn.status-done {
  background: rgba(34, 197, 94, 0.08);
  color: rgba(74, 222, 128, 0.6);
}
.status-badge-btn.status-done.active {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  border-color: rgba(34, 197, 94, 0.4);
}

.status-badge-btn.status-backlog {
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.35);
}
.status-badge-btn.status-backlog.active {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.6);
  border-color: rgba(255, 255, 255, 0.2);
}

.status-badge-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* ── Date Input ── */
.date-input {
  flex: 1;
  font-size: var(--text-xs);
  padding: 4px 8px;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.12));
  border-radius: var(--radius-sm, 4px);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-primary, #fff);
  color-scheme: dark;
  min-width: 0;
}

.date-input:focus {
  outline: none;
  border-color: var(--accent-primary, #8b5cf6);
}

/* ── Action Buttons ── */
.actions-row {
  display: flex;
  gap: var(--space-2, 8px);
  padding: var(--space-2, 8px) 0;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: var(--radius-md, 8px);
  font-size: var(--text-xs);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.12s ease;
  border: 1px solid transparent;
  flex: 1;
  justify-content: center;
}

.action-done {
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
  border-color: rgba(34, 197, 94, 0.2);
}

.action-done:hover:not(:disabled) {
  background: rgba(34, 197, 94, 0.2);
}

.action-timer {
  background: rgba(59, 130, 246, 0.12);
  color: #60a5fa;
  border-color: rgba(59, 130, 246, 0.2);
}

.action-timer:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.2);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Full Editor Link ── */
.full-editor-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  padding: var(--space-1, 4px);
  border: none;
  background: transparent;
  color: var(--text-tertiary, rgba(255, 255, 255, 0.4));
  font-size: var(--text-xs);
  cursor: pointer;
  transition: color 0.12s ease;
}

.full-editor-link:hover {
  color: var(--accent-primary, #8b5cf6);
}

/* ── Success Flash ── */
.success-flash {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(34, 197, 94, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4ade80;
  pointer-events: none;
}

.flash-enter-active {
  animation: flashPop 0.4s ease;
}

.flash-leave-active {
  animation: flashPop 0.2s ease reverse;
}

@keyframes flashPop {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.5);
  }
  50% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.2);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}
</style>
