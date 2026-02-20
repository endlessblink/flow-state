<template>
  <div class="reminder-picker-wrapper">
    <NPopover
      v-model:show="popoverVisible"
      trigger="click"
      placement="bottom-start"
      :show-arrow="false"
      :style="{ padding: '0' }"
    >
      <template #trigger>
        <button
          class="bell-btn"
          :class="{
            'bell-has-reminders': activeReminders.length > 0,
            'bell-upcoming': hasUpcomingReminder
          }"
          :title="activeReminders.length ? `${activeReminders.length} reminder(s)` : 'Add reminder'"
          @click.stop
        >
          <Bell :size="compact ? 14 : 16" />
          <span v-if="activeReminders.length > 0" class="reminder-badge">
            {{ activeReminders.length > 9 ? '9+' : activeReminders.length }}
          </span>
        </button>
      </template>

      <div class="reminder-popover">
        <!-- Header -->
        <div class="popover-header">
          <span class="popover-title">Reminders</span>
          <button class="close-btn" @click="popoverVisible = false">
            <X :size="14" />
          </button>
        </div>

        <!-- Existing reminders list -->
        <div v-if="props.reminders.length > 0" class="reminders-list">
          <div
            v-for="reminder in sortedReminders"
            :key="reminder.id"
            class="reminder-item"
            :class="{
              'reminder-fired': reminder.fired,
              'reminder-dismissed': reminder.dismissed
            }"
          >
            <div class="reminder-info">
              <div class="reminder-datetime">
                <Clock :size="12" class="reminder-icon" />
                <span>{{ formatDateTime(reminder.datetime) }}</span>
              </div>
              <div v-if="reminder.label" class="reminder-label">
                {{ reminder.label }}
              </div>
            </div>
            <div class="reminder-actions">
              <span class="reminder-status">
                <span v-if="reminder.fired && !reminder.dismissed" class="status-fired">Fired</span>
                <span v-else-if="reminder.dismissed" class="status-dismissed">Dismissed</span>
                <span v-else class="status-pending">Pending</span>
              </span>
              <button
                class="remove-btn"
                title="Remove reminder"
                @click="emit('remove-reminder', reminder.id)"
              >
                <X :size="12" />
              </button>
            </div>
          </div>
        </div>

        <div v-else class="no-reminders">
          <span>No reminders set</span>
        </div>

        <!-- Divider -->
        <div class="popover-divider" />

        <!-- Quick add buttons -->
        <div class="quick-add-section">
          <span class="section-label">Quick add</span>
          <div class="quick-add-buttons">
            <button class="quick-btn" @click="addQuickReminder('1hour')">
              In 1 hour
            </button>
            <button class="quick-btn" @click="addQuickReminder('tomorrow9am')">
              Tomorrow 9am
            </button>
            <button class="quick-btn" @click="addQuickReminder('nextMonday9am')">
              Next Mon 9am
            </button>
          </div>
        </div>

        <!-- Divider -->
        <div class="popover-divider" />

        <!-- Custom add reminder -->
        <div class="add-reminder-section">
          <span class="section-label">Custom reminder</span>
          <div class="add-reminder-form">
            <div class="form-row">
              <NDatePicker
                v-model:value="newDateTimestamp"
                type="date"
                size="small"
                class="reminder-date-picker"
                placeholder="Pick date"
                :is-date-disabled="isDateDisabled"
                clearable
              />
              <NTimePicker
                v-model:value="newTimeTimestamp"
                size="small"
                class="reminder-time-picker"
                placeholder="Time"
                format="HH:mm"
                :hours="[7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22]"
                clearable
              />
            </div>
            <input
              v-model="newLabel"
              type="text"
              class="label-input"
              placeholder="Note (optional)"
              maxlength="100"
            >
            <button
              class="add-btn"
              :disabled="!canAddCustom"
              @click="addCustomReminder"
            >
              <Plus :size="14" />
              Add Reminder
            </button>
          </div>
        </div>
      </div>
    </NPopover>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { NPopover, NDatePicker, NTimePicker } from 'naive-ui'
import { Bell, X, Plus, Clock } from 'lucide-vue-next'
import type { TaskReminder } from '@/types/notifications'

interface Props {
  reminders: TaskReminder[]
  dueDate?: string
  dueTime?: string
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  compact: false
})

const emit = defineEmits<{
  (e: 'add-reminder', reminder: TaskReminder): void
  (e: 'remove-reminder', reminderId: string): void
  (e: 'dismiss-reminder', reminderId: string): void
}>()

const popoverVisible = ref(false)
const newDateTimestamp = ref<number | null>(null)
const newTimeTimestamp = ref<number | null>(null)
const newLabel = ref('')

const isDateDisabled = (ts: number) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return ts < today.getTime()
}

const activeReminders = computed(() =>
  props.reminders.filter(r => !r.dismissed)
)

const sortedReminders = computed(() =>
  [...props.reminders].sort((a, b) =>
    new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
  )
)

const hasUpcomingReminder = computed(() => {
  const now = Date.now()
  const oneHourMs = 3600000
  return activeReminders.value.some(r => {
    if (r.fired || r.dismissed) return false
    const diff = new Date(r.datetime).getTime() - now
    return diff >= 0 && diff <= oneHourMs
  })
})

const canAddCustom = computed(() => {
  if (!newDateTimestamp.value || !newTimeTimestamp.value) return false
  const date = new Date(newDateTimestamp.value)
  const time = new Date(newTimeTimestamp.value)
  date.setHours(time.getHours(), time.getMinutes(), 0, 0)
  return date.getTime() > Date.now()
})

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}

function getNextMonday(): Date {
  const d = new Date()
  const day = d.getDay()
  const daysUntilMonday = day === 0 ? 1 : 8 - day
  d.setDate(d.getDate() + daysUntilMonday)
  d.setHours(9, 0, 0, 0)
  return d
}

function addQuickReminder(type: '1hour' | 'tomorrow9am' | 'nextMonday9am') {
  let datetime: Date
  if (type === '1hour') {
    datetime = new Date(Date.now() + 3600000)
  } else if (type === 'tomorrow9am') {
    datetime = new Date()
    datetime.setDate(datetime.getDate() + 1)
    datetime.setHours(9, 0, 0, 0)
  } else {
    datetime = getNextMonday()
  }

  const reminder: TaskReminder = {
    id: crypto.randomUUID(),
    datetime: datetime.toISOString(),
    fired: false,
    dismissed: false,
    createdAt: new Date().toISOString()
  }
  emit('add-reminder', reminder)
}

function addCustomReminder() {
  if (!canAddCustom.value || !newDateTimestamp.value || !newTimeTimestamp.value) return
  const date = new Date(newDateTimestamp.value)
  const time = new Date(newTimeTimestamp.value)
  date.setHours(time.getHours(), time.getMinutes(), 0, 0)
  const reminder: TaskReminder = {
    id: crypto.randomUUID(),
    datetime: date.toISOString(),
    label: newLabel.value.trim() || undefined,
    fired: false,
    dismissed: false,
    createdAt: new Date().toISOString()
  }
  emit('add-reminder', reminder)
  newDateTimestamp.value = null
  newTimeTimestamp.value = null
  newLabel.value = ''
}
</script>

<style scoped>
.reminder-picker-wrapper {
  display: inline-flex;
  align-items: center;
}

/* Bell trigger button */
.bell-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast);
  padding: 0;
}

.bell-btn:hover {
  background: var(--glass-bg-soft);
  border-color: var(--glass-border);
  color: var(--text-secondary);
}

.bell-btn.bell-has-reminders {
  color: var(--brand-primary);
}

.bell-btn.bell-upcoming {
  color: var(--color-warning);
  animation: bell-pulse 2s ease-in-out infinite;
}

@keyframes bell-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.1); }
}

.reminder-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  background: var(--brand-primary);
  color: var(--text-primary);
  font-size: 9px;
  font-weight: var(--font-medium);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

/* Popover content */
.reminder-popover {
  width: 320px;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--glass-border);
}

.popover-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast);
  padding: 0;
}

.close-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

/* Reminders list */
.reminders-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: 180px;
  overflow-y: auto;
  padding: var(--space-2);
}

.no-reminders {
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-xs);
  color: var(--text-muted);
  text-align: center;
}

.reminder-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--glass-bg-tint, rgba(255,255,255,0.03));
  border: 1px solid var(--glass-border);
  gap: var(--space-2);
  transition: background var(--duration-fast);
}

.reminder-item:hover {
  background: var(--glass-bg-medium);
}

.reminder-item.reminder-fired {
  opacity: 0.7;
}

.reminder-item.reminder-dismissed {
  opacity: 0.4;
}

.reminder-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.reminder-datetime {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.reminder-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.reminder-label {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reminder-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

.reminder-status {
  font-size: var(--font-size-xs);
}

.status-pending {
  color: var(--brand-primary);
}

.status-fired {
  color: var(--color-warning);
}

.status-dismissed {
  color: var(--text-muted);
}

.remove-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast);
  padding: 0;
}

.remove-btn:hover {
  background: var(--danger-bg-subtle);
  color: var(--priority-high-text);
}

/* Divider */
.popover-divider {
  height: 1px;
  background: var(--glass-border);
  margin: 0;
}

/* Quick add */
.quick-add-section {
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.section-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-medium);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.quick-add-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.quick-btn {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-soft);
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: all var(--duration-fast);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.quick-btn:hover {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  background: var(--glass-bg-medium);
}

/* Add reminder form */
.add-reminder-section {
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.add-reminder-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-row {
  display: flex;
  gap: var(--space-2);
}

.reminder-date-picker {
  flex: 1;
}

.reminder-time-picker {
  flex: 0 0 auto;
  width: 110px;
}

.label-input {
  width: 100%;
  padding: var(--space-1) var(--space-2);
  background: var(--overlay-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  transition: border-color var(--duration-fast);
  outline: none;
}

.label-input:focus {
  border-color: var(--brand-primary);
}

.label-input::placeholder {
  color: var(--text-muted);
}

/* Add button — glass morphism, NEVER solid fill */
.add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--brand-primary);
  background: var(--glass-bg-soft);
  color: var(--brand-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  width: 100%;
}

.add-btn:hover:not(:disabled) {
  background: var(--glass-bg-medium);
  box-shadow: var(--brand-glow-sm);
}

.add-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  border-color: var(--glass-border);
  color: var(--text-muted);
}
</style>
