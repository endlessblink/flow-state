<template>
  <Teleport to="body">
    <BaseModal
      :is-open="isOpen"
      title=""
      size="md"
      :show-header="false"
      :show-footer="false"
      :close-on-overlay-click="true"
      :close-on-escape="true"
      @close="handleCancel"
    >
      <div class="voice-confirmation-content">
        <!-- Header -->
        <div class="confirmation-header">
          <div class="header-info">
            <CheckCircle2 :size="18" class="header-icon" />
            <span class="header-title">{{ $t?.('voice.confirmTask') || 'Confirm Task' }}</span>
          </div>
          <button class="close-btn" @click="handleCancel">
            <X :size="18" />
          </button>
        </div>

        <!-- Editable Fields -->
        <div class="confirmation-body">
          <!-- Title Textarea (RTL-aware) -->
          <div class="field-section">
            <label class="field-label">{{ $t?.('task.title') || 'Title' }}</label>
            <textarea
              ref="titleInputRef"
              v-model="editedTitle"
              :dir="titleDirection"
              class="title-textarea"
              :placeholder="$t?.('task.titlePlaceholder') || 'Task title...'"
              rows="3"
              @keydown.enter.exact.prevent="handleConfirm"
            />
          </div>

          <!-- Priority Pills -->
          <div class="field-section">
            <label class="field-label">
              <Flag :size="12" />
              {{ $t?.('task.priority') || 'Priority' }}
            </label>
            <div class="pill-options">
              <button
                class="pill priority-high"
                :class="[{ active: editedPriority === 'high' }]"
                @click="setPriority('high')"
              >
                {{ $t?.('priority.high') || 'High' }}
              </button>
              <button
                class="pill priority-medium"
                :class="[{ active: editedPriority === 'medium' }]"
                @click="setPriority('medium')"
              >
                {{ $t?.('priority.medium') || 'Medium' }}
              </button>
              <button
                class="pill priority-low"
                :class="[{ active: editedPriority === 'low' }]"
                @click="setPriority('low')"
              >
                {{ $t?.('priority.low') || 'Low' }}
              </button>
              <button
                class="pill priority-none"
                :class="[{ active: editedPriority === null }]"
                @click="setPriority(null)"
              >
                {{ $t?.('priority.none') || 'None' }}
              </button>
            </div>
          </div>

          <!-- Due Date Chips -->
          <div class="field-section">
            <label class="field-label">
              <Calendar :size="12" />
              {{ $t?.('task.dueDate') || 'Due Date' }}
            </label>
            <div class="pill-options">
              <button
                class="pill date-pill"
                :class="[{ active: isToday }]"
                @click="setDueDate('today')"
              >
                {{ $t?.('date.today') || 'Today' }}
              </button>
              <button
                class="pill date-pill"
                :class="[{ active: isTomorrow }]"
                @click="setDueDate('tomorrow')"
              >
                {{ $t?.('date.tomorrow') || 'Tomorrow' }}
              </button>
              <button
                class="pill date-pill"
                :class="[{ active: isNextWeek }]"
                @click="setDueDate('week')"
              >
                {{ $t?.('date.nextWeek') || 'Next Week' }}
              </button>
              <button
                v-if="editedDueDate"
                class="pill clear-pill"
                @click="clearDueDate"
              >
                <X :size="14" />
              </button>
            </div>
            <!-- Show detected date label if different from presets -->
            <div v-if="parsedTask?.dueDateLabel && editedDueDate && !isPresetDate" class="detected-label">
              {{ $t?.('voice.detected') || 'Detected' }}: {{ parsedTask.dueDateLabel }}
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="confirmation-actions">
          <button class="action-btn cancel-btn" @click="handleCancel">
            {{ $t?.('common.cancel') || 'Cancel' }}
          </button>
          <button
            class="action-btn confirm-btn"
            :disabled="!editedTitle.trim()"
            @click="handleConfirm"
          >
            <Plus :size="18" />
            {{ $t?.('task.create') || 'Create Task' }}
          </button>
        </div>
      </div>
    </BaseModal>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { CheckCircle2, X, Flag, Calendar, Plus } from 'lucide-vue-next'
import BaseModal from '@/components/base/BaseModal.vue'
import type { ParsedVoiceTask } from '@/composables/useVoiceTaskParser'

interface Props {
  isOpen: boolean
  parsedTask: ParsedVoiceTask | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  confirm: [task: { title: string; priority: 'high' | 'medium' | 'low' | null; dueDate: Date | null }]
  cancel: []
}>()

// Refs
const titleInputRef = ref<HTMLTextAreaElement | null>(null)

// Editable state
const editedTitle = ref('')
const editedPriority = ref<'high' | 'medium' | 'low' | null>(null)
const editedDueDate = ref<Date | null>(null)

// RTL detection for title text
const titleDirection = computed(() => {
  if (!editedTitle.value.trim()) return 'auto'
  const firstChar = editedTitle.value.trim()[0]
  // Hebrew, Arabic, Persian, Urdu character ranges
  const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
  return rtlRegex.test(firstChar) ? 'rtl' : 'ltr'
})

// Initialize from parsed task
watch(() => props.parsedTask, (task) => {
  if (task) {
    editedTitle.value = task.title
    editedPriority.value = task.priority
    editedDueDate.value = task.dueDate
  }
}, { immediate: true })

// Focus title when opened
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    // Small delay to ensure modal animation completes
    setTimeout(() => {
      titleInputRef.value?.focus()
      titleInputRef.value?.select()
    }, 100)
  }
})

// Date computations
const today = computed(() => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
})

const tomorrow = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
})

const nextWeek = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
})

const isToday = computed(() => {
  if (!editedDueDate.value) return false
  const d = new Date(editedDueDate.value)
  d.setHours(0, 0, 0, 0)
  return d.getTime() === today.value
})

const isTomorrow = computed(() => {
  if (!editedDueDate.value) return false
  const d = new Date(editedDueDate.value)
  d.setHours(0, 0, 0, 0)
  return d.getTime() === tomorrow.value
})

const isNextWeek = computed(() => {
  if (!editedDueDate.value) return false
  const d = new Date(editedDueDate.value)
  d.setHours(0, 0, 0, 0)
  return d.getTime() === nextWeek.value
})

const isPresetDate = computed(() => isToday.value || isTomorrow.value || isNextWeek.value)

// Actions
function setPriority(value: 'high' | 'medium' | 'low' | null) {
  editedPriority.value = value
  triggerHaptic(10)
}

function setDueDate(preset: 'today' | 'tomorrow' | 'week') {
  const d = new Date()
  d.setHours(23, 59, 59, 999)

  switch (preset) {
    case 'today':
      // Keep today
      break
    case 'tomorrow':
      d.setDate(d.getDate() + 1)
      break
    case 'week':
      d.setDate(d.getDate() + 7)
      break
  }

  editedDueDate.value = d
  triggerHaptic(10)
}

function clearDueDate() {
  editedDueDate.value = null
  triggerHaptic(10)
}

function handleConfirm() {
  if (!editedTitle.value.trim()) return

  triggerHaptic(30)
  emit('confirm', {
    title: editedTitle.value.trim(),
    priority: editedPriority.value,
    dueDate: editedDueDate.value
  })
}

function handleCancel() {
  triggerHaptic(10)
  emit('cancel')
}

function triggerHaptic(duration: number = 10) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(duration)
    } catch {
      // Vibration API not supported
    }
  }
}
</script>

<style scoped>
/* ================================
   VOICE TASK CONFIRMATION MODAL
   Popup window with RTL support
   ================================ */

.voice-confirmation-content {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Header */
.confirmation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--glass-border);
  background: rgba(78, 205, 196, 0.05);
}

.header-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.header-icon {
  color: var(--brand-primary, #4ECDC4);
}

.header-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-full);
  background: var(--glass-bg-soft);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.close-btn:hover {
  background: var(--glass-bg);
  color: var(--text-primary);
}

.close-btn:active {
  transform: scale(0.9);
}

/* Body */
.confirmation-body {
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.field-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-label {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Title Textarea - RTL-aware */
.title-textarea {
  width: 100%;
  min-height: 80px;
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: var(--text-base);
  font-family: inherit;
  line-height: var(--leading-relaxed);
  outline: none;
  resize: vertical;
  transition: all var(--duration-fast);
}

.title-textarea:focus {
  border-color: var(--brand-primary, #4ECDC4);
  box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.15);
}

.title-textarea::placeholder {
  color: var(--text-muted);
}

/* RTL text alignment is handled by dir attribute */
.title-textarea[dir="rtl"] {
  text-align: right;
}

.title-textarea[dir="ltr"] {
  text-align: left;
}

/* Pill Options */
.pill-options {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.pill {
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.pill:hover {
  background: var(--glass-bg);
  border-color: var(--glass-border-hover);
}

.pill:active {
  transform: scale(0.95);
}

/* Priority pills */
.pill.priority-high.active {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.5);
  color: #ef4444;
}

.pill.priority-medium.active {
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.5);
  color: #f59e0b;
}

.pill.priority-low.active {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.5);
  color: #3b82f6;
}

.pill.priority-none.active {
  background: var(--glass-bg);
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

/* Date pills */
.pill.date-pill.active {
  background: rgba(78, 205, 196, 0.15);
  border-color: rgba(78, 205, 196, 0.5);
  color: var(--brand-primary, #4ECDC4);
}

.pill.clear-pill {
  padding: var(--space-2);
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.pill.clear-pill:hover {
  background: rgba(239, 68, 68, 0.2);
}

.detected-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-style: italic;
  margin-top: var(--space-1);
}

/* Actions */
.confirmation-actions {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--glass-border);
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border: none;
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.action-btn:active {
  transform: scale(0.97);
}

.cancel-btn {
  background: var(--glass-bg-soft);
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
}

.cancel-btn:hover {
  background: var(--glass-bg);
  color: var(--text-primary);
}

.confirm-btn {
  background: var(--brand-primary, #4ECDC4);
  color: var(--surface-primary, hsl(230, 20%, 10%));
}

.confirm-btn:hover:not(:disabled) {
  filter: brightness(1.1);
}

.confirm-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ================================
   RESPONSIVE
   ================================ */

@media (max-width: 480px) {
  .confirmation-header {
    padding: var(--space-3) var(--space-4);
  }

  .confirmation-body {
    padding: var(--space-4);
    gap: var(--space-4);
  }

  .confirmation-actions {
    padding: var(--space-3) var(--space-4);
    flex-direction: column;
  }

  .action-btn {
    width: 100%;
  }
}

/* ================================
   ACCESSIBILITY - REDUCED MOTION
   ================================ */

@media (prefers-reduced-motion: reduce) {
  .pill,
  .close-btn,
  .action-btn,
  .title-textarea {
    transition: none;
  }
}
</style>
