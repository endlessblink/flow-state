<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div
        v-if="isOpen"
        class="sheet-overlay"
        @click="handleCancel"
      >
        <div
          class="task-edit-sheet"
          @click.stop
          @touchmove.stop
        >
          <!-- Sheet Handle (drag to dismiss) -->
          <div class="sheet-handle-area" @click="handleCancel">
            <div class="sheet-handle" />
          </div>

          <!-- Scrollable Form -->
          <div class="edit-form">
            <!-- Title Input — large, prominent -->
            <input
              ref="titleInputRef"
              v-model="editedTitle"
              :dir="titleDirection"
              type="text"
              class="title-input"
              placeholder="Task title"
              @keydown.enter.prevent="handleSave"
            >

            <!-- Description — auto-expanding -->
            <textarea
              v-model="editedDescription"
              :dir="descriptionDirection"
              class="desc-input"
              placeholder="Add notes..."
              rows="2"
            />

            <!-- Priority — large pill row -->
            <div class="field-section">
              <span class="section-label">Priority</span>
              <div class="pill-row">
                <button
                  v-for="option in priorityOptions"
                  :key="option.value"
                  class="pill"
                  :class="[`pill-${option.value}`, { active: editedPriority === option.value }]"
                  @click="editedPriority = editedPriority === option.value ? null : option.value"
                >
                  <Flag :size="16" />
                  {{ option.label }}
                </button>
              </div>
            </div>

            <!-- Due Date — quick presets -->
            <div class="field-section">
              <span class="section-label">Due Date</span>
              <div class="pill-row">
                <button
                  class="pill"
                  :class="{ active: isDueToday }"
                  @click="toggleDueDate('today')"
                >
                  Today
                </button>
                <button
                  class="pill"
                  :class="{ active: isDueTomorrow }"
                  @click="toggleDueDate('tomorrow')"
                >
                  Tomorrow
                </button>
                <button
                  class="pill"
                  :class="{ active: isDueIn3Days }"
                  @click="toggleDueDate('in3days')"
                >
                  +3 days
                </button>
                <button
                  class="pill"
                  :class="{ active: isDueNextWeek }"
                  @click="toggleDueDate('nextweek')"
                >
                  Next week
                </button>
              </div>
              <div class="pill-row" style="margin-top: var(--space-2)">
                <button
                  class="pill pill-pick-date"
                  :class="{ active: hasCustomDate }"
                  @click="showDatePicker = true"
                >
                  <CalendarDays :size="16" />
                  {{ hasCustomDate ? formatDate(editedDueDate!) : 'Pick date' }}
                </button>
                <button
                  v-if="hasDueDate"
                  class="pill pill-clear"
                  @click="clearDueDate"
                >
                  <X :size="16" />
                  Clear
                </button>
              </div>
              <!-- Native date picker (shown inline when activated) -->
              <input
                v-if="showDatePicker"
                ref="datePickerRef"
                v-model="editedDueDateInput"
                type="date"
                class="native-date-picker"
                @change="handleDatePickerChange"
              >
            </div>

            <!-- Status — simple toggle -->
            <div class="field-section">
              <span class="section-label">Status</span>
              <div class="pill-row">
                <button
                  class="pill"
                  :class="{ active: editedStatus === 'todo' }"
                  @click="editedStatus = 'todo'"
                >
                  <Circle :size="16" />
                  To Do
                </button>
                <button
                  class="pill"
                  :class="{ active: editedStatus === 'in-progress' }"
                  @click="editedStatus = 'in-progress'"
                >
                  <Clock :size="16" />
                  In Progress
                </button>
                <button
                  class="pill"
                  :class="{ active: editedStatus === 'done' }"
                  @click="editedStatus = 'done'"
                >
                  <CheckCircle2 :size="16" />
                  Done
                </button>
              </div>
            </div>
          </div>

          <!-- Bottom Action Bar — thumb zone -->
          <div class="action-bar">
            <button class="action-btn cancel-btn" @click="handleCancel">
              Cancel
            </button>
            <button
              class="action-btn save-btn"
              :disabled="!editedTitle.trim()"
              @click="handleSave"
            >
              <Check :size="18" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import {
  Flag, CalendarDays, X, Check,
  Circle, CheckCircle2, Clock
} from 'lucide-vue-next'
import type { Task } from '@/types/tasks'

interface Props {
  isOpen: boolean
  task: Task | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  save: [taskId: string, updates: Partial<Task>]
}>()

// Form state
const editedTitle = ref('')
const editedDescription = ref('')
const editedPriority = ref<'low' | 'medium' | 'high' | null>(null)
const editedDueDate = ref<string | undefined>(undefined)
const editedDueDateInput = ref('')
const editedStatus = ref<Task['status']>('todo')
const showDatePicker = ref(false)

// Refs
const titleInputRef = ref<HTMLInputElement | null>(null)
const datePickerRef = ref<HTMLInputElement | null>(null)

// Options
const priorityOptions = [
  { value: 'high' as const, label: 'High' },
  { value: 'medium' as const, label: 'Med' },
  { value: 'low' as const, label: 'Low' }
]

// RTL detection
const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/

const titleDirection = computed(() => {
  if (!editedTitle.value.trim()) return 'auto'
  return rtlRegex.test(editedTitle.value.trim()[0]) ? 'rtl' : 'ltr'
})

const descriptionDirection = computed(() => {
  if (!editedDescription.value.trim()) return 'auto'
  return rtlRegex.test(editedDescription.value.trim()[0]) ? 'rtl' : 'ltr'
})

// Date computeds
const hasDueDate = computed(() => !!editedDueDate.value)

function getDateString(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  d.setHours(0, 0, 0, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getNextMondayString(): string {
  const d = new Date()
  const day = d.getDay()
  const daysUntilMonday = day === 0 ? 1 : 8 - day
  d.setDate(d.getDate() + daysUntilMonday)
  d.setHours(0, 0, 0, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const isDueToday = computed(() => editedDueDate.value === getDateString(0))
const isDueTomorrow = computed(() => editedDueDate.value === getDateString(1))
const isDueIn3Days = computed(() => editedDueDate.value === getDateString(3))
const isDueNextWeek = computed(() => editedDueDate.value === getNextMondayString())
const hasCustomDate = computed(() => hasDueDate.value && !isDueToday.value && !isDueTomorrow.value && !isDueIn3Days.value && !isDueNextWeek.value)

// Watch for task changes
watch(() => props.task, (task) => {
  if (task) {
    editedTitle.value = task.title
    editedDescription.value = task.description || ''
    editedPriority.value = task.priority
    editedDueDate.value = task.dueDate || undefined
    editedStatus.value = task.status
    showDatePicker.value = false
    if (task.dueDate) {
      editedDueDateInput.value = new Date(task.dueDate).toISOString().split('T')[0]
    } else {
      editedDueDateInput.value = ''
    }
  }
}, { immediate: true })

// Focus title when opened
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    titleInputRef.value?.focus()
  }
})

// Actions
function toggleDueDate(preset: 'today' | 'tomorrow' | 'in3days' | 'nextweek') {
  const dateMap: Record<string, string> = {
    today: getDateString(0),
    tomorrow: getDateString(1),
    in3days: getDateString(3),
    nextweek: getNextMondayString()
  }
  const target = dateMap[preset]
  // Toggle off if already selected
  if (editedDueDate.value === target) {
    editedDueDate.value = undefined
    editedDueDateInput.value = ''
  } else {
    editedDueDate.value = target
    editedDueDateInput.value = new Date(target + 'T00:00:00').toISOString().split('T')[0]
  }
  showDatePicker.value = false
  triggerHaptic()
}

function clearDueDate() {
  editedDueDate.value = undefined
  editedDueDateInput.value = ''
  showDatePicker.value = false
  triggerHaptic()
}

function handleDatePickerChange() {
  if (editedDueDateInput.value) {
    const date = new Date(editedDueDateInput.value + 'T00:00:00')
    editedDueDate.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
  showDatePicker.value = false
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function handleCancel() {
  triggerHaptic()
  emit('close')
}

function handleSave() {
  if (!props.task || !editedTitle.value.trim()) return

  const updates: Partial<Task> = {}

  if (editedTitle.value.trim() !== props.task.title) updates.title = editedTitle.value.trim()
  if (editedDescription.value !== (props.task.description || '')) updates.description = editedDescription.value
  if (editedPriority.value !== props.task.priority) updates.priority = editedPriority.value
  if (editedDueDate.value !== props.task.dueDate) updates.dueDate = editedDueDate.value || ''
  if (editedStatus.value !== props.task.status) updates.status = editedStatus.value

  if (Object.keys(updates).length > 0) {
    triggerHaptic(30)
    emit('save', props.task.id, updates)
  }

  emit('close')
}

function triggerHaptic(duration: number = 10) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(duration) } catch { /* noop */ }
  }
}
</script>

<style scoped>
/* ================================
   TASK EDIT BOTTOM SHEET v2
   Thumb-zone optimized, large touch targets
   ================================ */

.sheet-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  backdrop-filter: blur(var(--blur-xs));
  -webkit-backdrop-filter: blur(var(--blur-xs));
  display: flex;
  align-items: flex-end;
  z-index: var(--z-modal);
}

.task-edit-sheet {
  width: 100%;
  max-height: 90vh;
  background: var(--surface-primary);
  border-top-left-radius: var(--radius-2xl);
  border-top-right-radius: var(--radius-2xl);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow:
    0 -4px 24px rgba(0, 0, 0, 0.3),
    0 -1px 0 var(--glass-border);
}

/* Sheet Handle — tappable area */
.sheet-handle-area {
  padding: var(--space-3) 0 var(--space-1);
  cursor: pointer;
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}

.sheet-handle {
  width: 36px;
  height: 4px;
  background: var(--border-hover);
  border-radius: var(--radius-full);
}

/* Scrollable Form */
.edit-form {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2) var(--space-5) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

/* Title — large, no label needed */
.title-input {
  width: 100%;
  padding: var(--space-3) var(--space-1);
  background: transparent;
  border: none;
  border-bottom: 2px solid var(--glass-border);
  color: var(--text-primary);
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  outline: none;
  transition: border-color var(--duration-normal) ease;
}

.title-input:focus {
  border-bottom-color: var(--brand-primary);
}

.title-input::placeholder {
  color: var(--text-muted);
  font-weight: var(--font-normal);
}

/* Description — subtle */
.desc-input {
  width: 100%;
  padding: var(--space-3) var(--space-1);
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--glass-border-light);
  color: var(--text-secondary);
  font-size: var(--text-base);
  outline: none;
  resize: none;
  font-family: inherit;
  line-height: var(--leading-relaxed);
  transition: border-color var(--duration-normal) ease;
}

.desc-input:focus {
  border-bottom-color: var(--brand-primary);
}

.desc-input::placeholder {
  color: var(--text-muted);
}

/* Field Sections */
.field-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2_5);
}

.section-label {
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* Pill Buttons — 48px min height for touch */
.pill-row {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.pill {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1_5);
  min-height: 44px;
  padding: var(--space-2_5) var(--space-4);
  background: var(--glass-bg-weak);
  border: 1.5px solid var(--glass-border);
  border-radius: var(--radius-xl);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  -webkit-tap-highlight-color: transparent;
  flex: 1;
  min-width: 0;
}

.pill:active {
  transform: scale(0.95);
}

/* Active state — generic */
.pill.active {
  background: var(--state-active-bg);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

/* Priority-specific active colors */
.pill.pill-high.active {
  background: var(--priority-high-bg);
  border-color: var(--color-priority-high);
  color: var(--color-priority-high);
}

.pill.pill-medium.active {
  background: var(--priority-medium-bg);
  border-color: var(--color-priority-medium);
  color: var(--color-priority-medium);
}

.pill.pill-low.active {
  background: var(--priority-low-bg);
  border-color: var(--color-priority-low);
  color: var(--color-priority-low);
}

/* Date-specific pills */
.pill-pick-date {
  flex: unset;
}

.pill-clear {
  flex: unset;
  color: var(--text-muted);
}

.pill-clear:active {
  color: var(--color-danger);
}

/* Native date picker */
.native-date-picker {
  margin-top: var(--space-2);
  padding: var(--space-3);
  background: var(--glass-bg-weak);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: var(--text-base);
  color-scheme: dark;
  width: 100%;
}

/* Bottom Action Bar — sticky in thumb zone */
.action-bar {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--glass-border-light);
  background: var(--surface-primary);
  flex-shrink: 0;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 48px;
  border-radius: var(--radius-xl);
  font-size: var(--text-base);
  font-weight: var(--font-bold);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  -webkit-tap-highlight-color: transparent;
}

.action-btn:active {
  transform: scale(0.97);
}

.cancel-btn {
  background: var(--glass-bg-weak);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  flex: 0.4;
}

.save-btn {
  background: var(--glass-bg-soft);
  border: 1.5px solid var(--brand-primary);
  color: var(--brand-primary);
  backdrop-filter: blur(8px);
  flex: 0.6;
}

.save-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.save-btn:not(:disabled):active {
  background: var(--brand-primary);
  color: var(--surface-primary);
}

/* ================================
   TRANSITIONS
   ================================ */

.sheet-enter-active,
.sheet-leave-active {
  transition: all var(--duration-slow) var(--spring-gentle);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .task-edit-sheet,
.sheet-leave-to .task-edit-sheet {
  transform: translateY(100%);
}

/* ================================
   REDUCED MOTION
   ================================ */

@media (prefers-reduced-motion: reduce) {
  .sheet-enter-active,
  .sheet-leave-active {
    transition: opacity var(--duration-fast) ease;
  }

  .sheet-enter-from .task-edit-sheet,
  .sheet-leave-to .task-edit-sheet {
    transform: none;
  }
}

/* ================================
   RTL SUPPORT
   ================================ */

[dir="rtl"] .edit-form {
  text-align: right;
}

.title-input[dir="rtl"],
.desc-input[dir="rtl"] {
  text-align: right;
}

[dir="rtl"] .pill-row {
  flex-direction: row-reverse;
}

[dir="rtl"] .pill {
  flex-direction: row-reverse;
}

[dir="rtl"] .action-bar {
  flex-direction: row-reverse;
}
</style>
