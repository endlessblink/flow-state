<template>
  <Transition name="expand">
    <div v-if="isOpen && parsedTask" class="voice-confirmation">
      <!-- Header -->
      <div class="confirmation-header">
        <div class="header-info">
          <CheckCircle2 :size="18" class="header-icon" />
          <span class="header-title">Confirm Task</span>
        </div>
        <button class="close-btn" @click="handleCancel">
          <X :size="18" />
        </button>
      </div>

      <!-- Editable Fields -->
      <div class="confirmation-body">
        <!-- Title Input -->
        <div class="field-section">
          <label class="field-label">Title</label>
          <input
            ref="titleInputRef"
            v-model="editedTitle"
            type="text"
            class="title-input"
            placeholder="Task title..."
            @keydown.enter="handleConfirm"
          />
        </div>

        <!-- Priority Pills -->
        <div class="field-section">
          <label class="field-label">
            <Flag :size="12" />
            Priority
          </label>
          <div class="pill-options">
            <button
              :class="['pill', 'priority-high', { active: editedPriority === 'high' }]"
              @click="setPriority('high')"
            >
              High
            </button>
            <button
              :class="['pill', 'priority-medium', { active: editedPriority === 'medium' }]"
              @click="setPriority('medium')"
            >
              Medium
            </button>
            <button
              :class="['pill', 'priority-low', { active: editedPriority === 'low' }]"
              @click="setPriority('low')"
            >
              Low
            </button>
            <button
              :class="['pill', 'priority-none', { active: editedPriority === null }]"
              @click="setPriority(null)"
            >
              None
            </button>
          </div>
        </div>

        <!-- Due Date Chips -->
        <div class="field-section">
          <label class="field-label">
            <Calendar :size="12" />
            Due Date
          </label>
          <div class="pill-options">
            <button
              :class="['pill', 'date-pill', { active: isToday }]"
              @click="setDueDate('today')"
            >
              Today
            </button>
            <button
              :class="['pill', 'date-pill', { active: isTomorrow }]"
              @click="setDueDate('tomorrow')"
            >
              Tomorrow
            </button>
            <button
              :class="['pill', 'date-pill', { active: isNextWeek }]"
              @click="setDueDate('week')"
            >
              Next Week
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
          <div v-if="parsedTask.dueDateLabel && editedDueDate && !isPresetDate" class="detected-label">
            Detected: {{ parsedTask.dueDateLabel }}
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="confirmation-actions">
        <button class="action-btn cancel-btn" @click="handleCancel">
          Cancel
        </button>
        <button
          class="action-btn confirm-btn"
          :disabled="!editedTitle.trim()"
          @click="handleConfirm"
        >
          <Plus :size="18" />
          Create Task
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { CheckCircle2, X, Flag, Calendar, Plus } from 'lucide-vue-next'
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
const titleInputRef = ref<HTMLInputElement | null>(null)

// Editable state
const editedTitle = ref('')
const editedPriority = ref<'high' | 'medium' | 'low' | null>(null)
const editedDueDate = ref<Date | null>(null)

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
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
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
   VOICE TASK CONFIRMATION
   Inline expansion panel
   ================================ */

.voice-confirmation {
  background: var(--surface-primary, hsl(240, 18%, 12%));
  border-radius: 16px;
  margin-top: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* Header */
.confirmation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(78, 205, 196, 0.08);
}

.header-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  color: var(--brand-primary, #4ECDC4);
}

.header-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn:active {
  transform: scale(0.9);
  background: rgba(255, 255, 255, 0.1);
}

/* Body */
.confirmation-body {
  padding: 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted, rgba(255, 255, 255, 0.5));
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.title-input {
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: var(--text-primary, #fff);
  font-size: 15px;
  outline: none;
  transition: all 0.2s ease;
}

.title-input:focus {
  border-color: var(--brand-primary, #4ECDC4);
  box-shadow: 0 0 0 2px rgba(78, 205, 196, 0.15);
}

.title-input::placeholder {
  color: var(--text-muted, rgba(255, 255, 255, 0.4));
}

/* Pill Options */
.pill-options {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.pill {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
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
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: var(--text-primary, #fff);
}

/* Date pills */
.pill.date-pill.active {
  background: rgba(78, 205, 196, 0.15);
  border-color: rgba(78, 205, 196, 0.5);
  color: var(--brand-primary, #4ECDC4);
}

.pill.clear-pill {
  padding: 8px 10px;
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.detected-label {
  font-size: 12px;
  color: var(--text-muted, rgba(255, 255, 255, 0.5));
  font-style: italic;
}

/* Actions */
.confirmation-actions {
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  padding-bottom: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 16px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:active {
  transform: scale(0.97);
}

.cancel-btn {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
}

.cancel-btn:active {
  background: rgba(255, 255, 255, 0.1);
}

.confirm-btn {
  background: var(--brand-primary, #4ECDC4);
  color: hsl(230, 20%, 10%);
}

.confirm-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.confirm-btn:not(:disabled):active {
  transform: scale(0.97);
}

/* ================================
   TRANSITIONS
   ================================ */

.expand-enter-active {
  animation: expandIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.expand-leave-active {
  animation: expandOut 0.2s ease-out forwards;
}

@keyframes expandIn {
  from {
    opacity: 0;
    transform: translateY(-10px) scaleY(0.9);
    transform-origin: top;
  }
  to {
    opacity: 1;
    transform: translateY(0) scaleY(1);
  }
}

@keyframes expandOut {
  from {
    opacity: 1;
    transform: translateY(0) scaleY(1);
  }
  to {
    opacity: 0;
    transform: translateY(-10px) scaleY(0.9);
  }
}

/* ================================
   ACCESSIBILITY - REDUCED MOTION
   ================================ */

@media (prefers-reduced-motion: reduce) {
  .expand-enter-active,
  .expand-leave-active {
    animation: none;
    transition: opacity 0.15s ease;
  }

  .expand-enter-from,
  .expand-leave-to {
    opacity: 0;
  }
}
</style>
