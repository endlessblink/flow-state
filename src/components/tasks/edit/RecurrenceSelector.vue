<template>
  <div class="recurrence-selector">
    <div class="selector-header">
      <div class="header-left">
        <Repeat :size="16" class="header-icon" />
        <span class="header-label">Repeat</span>
      </div>
      <label class="toggle-switch">
        <input
          type="checkbox"
          :checked="safeModelValue.isEnabled"
          @change="toggleEnabled"
        >
        <span class="slider" />
      </label>
    </div>

    <Transition name="expand">
      <div v-if="safeModelValue.isEnabled" class="selector-body">
        <!-- Pattern Selection -->
        <div class="form-group">
          <label class="field-label">Frequency</label>
          <CustomSelect
            :model-value="safeModelValue.rule.pattern"
            :options="patternOptions"
            @update:model-value="updatePattern"
          />
        </div>

        <!-- Pattern Details -->
        <div class="pattern-details">
          <!-- Daily -->
          <div v-if="safeModelValue.rule.pattern === RecurrencePattern.DAILY" class="detail-row">
            <span>Every</span>
            <input
              type="number"
              class="number-input"
              :value="(safeModelValue.rule as DailyRecurrenceRule).interval"
              min="1"
              @input="updateInterval"
            >
            <span>day(s)</span>
          </div>

          <!-- Weekly -->
          <div v-if="safeModelValue.rule.pattern === RecurrencePattern.WEEKLY" class="detail-column">
            <div class="detail-row">
              <span>Every</span>
              <input
                type="number"
                class="number-input"
                :value="(safeModelValue.rule as WeeklyRecurrenceRule).interval"
                min="1"
                @input="updateInterval"
              >
              <span>week(s) on:</span>
            </div>
            <div class="weekday-picker">
              <button
                v-for="day in weekdays"
                :key="day.value"
                class="weekday-btn"
                :class="{ 'is-active': isWeekdaySelected(day.value) }"
                @click="toggleWeekday(day.value)"
              >
                {{ day.label }}
              </button>
            </div>
          </div>

          <!-- Monthly -->
          <div v-if="safeModelValue.rule.pattern === RecurrencePattern.MONTHLY" class="detail-column">
            <div class="detail-row">
              <span>Every</span>
              <input
                type="number"
                class="number-input"
                :value="(safeModelValue.rule as MonthlyRecurrenceRule).interval"
                min="1"
                @input="updateInterval"
              >
              <span>month(s)</span>
            </div>
            <div class="detail-row">
              <span>Day</span>
              <input
                type="number"
                class="number-input"
                :value="(safeModelValue.rule as MonthlyRecurrenceRule).dayOfMonth"
                min="1"
                max="31"
                @input="updateDayOfMonth"
              >
              <span>of the month</span>
            </div>
          </div>

          <!-- Custom Rule Builder -->
          <div v-if="safeModelValue.rule.pattern === RecurrencePattern.CUSTOM" class="custom-builder">
            <div class="field-info">
              <span class="field-label">Custom Rule</span>
              <span class="syntax-hint">Format: EVERY N DAYS/WEEKS/MONTHS...</span>
            </div>
            <input
              type="text"
              class="text-input"
              :value="(safeModelValue.rule as any).customRule || ''"
              placeholder="e.g. EVERY 2 WEEKS ON MON,FRI"
              @input="updateCustomRule"
            >
            <div v-if="validationErrors.length > 0" class="validation-errors">
              <span v-for="err in validationErrors" :key="err" class="error-msg">
                <AlertCircle :size="12" /> {{ err }}
              </span>
            </div>
            <div class="syntax-examples">
              <button
                v-for="ex in examples"
                :key="ex"
                class="example-btn"
                @click="setCustomRule(ex)"
              >
                {{ ex }}
              </button>
            </div>
          </div>
        </div>

        <!-- End Condition -->
        <div class="form-group">
          <label class="field-label">Ends</label>
          <div class="detail-column">
            <div class="detail-row">
              <input
                id="end-never"
                type="radio"
                name="endCondition"
                :checked="safeModelValue.endCondition.type === EndCondition.NEVER"
                @change="updateEndType(EndCondition.NEVER)"
              >
              <label for="end-never">Never</label>
            </div>
            <div class="detail-row">
              <input
                id="end-date"
                type="radio"
                name="endCondition"
                :checked="safeModelValue.endCondition.type === EndCondition.ON_DATE"
                @change="updateEndType(EndCondition.ON_DATE)"
              >
              <label for="end-date">On Date</label>
              <input
                v-if="safeModelValue.endCondition.type === EndCondition.ON_DATE"
                type="date"
                class="date-input"
                :value="safeModelValue.endCondition.date"
                @input="updateEndDate"
              >
            </div>
            <div class="detail-row">
              <input
                id="end-after"
                type="radio"
                name="endCondition"
                :checked="safeModelValue.endCondition.type === EndCondition.AFTER_COUNT"
                @change="updateEndType(EndCondition.AFTER_COUNT)"
              >
              <label for="end-after">After</label>
              <input
                v-if="safeModelValue.endCondition.type === EndCondition.AFTER_COUNT"
                type="number"
                class="number-input"
                min="1"
                :value="safeModelValue.endCondition.count"
                @input="updateEndCount"
              >
              <span v-if="safeModelValue.endCondition.type === EndCondition.AFTER_COUNT">occurrences</span>
            </div>
          </div>
        </div>

        <!-- Preview -->
        <div v-if="previewDates.length > 0" class="recurrence-preview">
          <span class="preview-label">Next occurrences:</span>
          <div class="preview-list">
            <span v-for="date in previewDates" :key="date" class="preview-item">
              {{ date }}
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Repeat, AlertCircle } from 'lucide-vue-next'
import {
  RecurrencePattern,
  EndCondition,
  Weekday,
  type TaskRecurrence,
  type DailyRecurrenceRule,
  type WeeklyRecurrenceRule,
  type MonthlyRecurrenceRule,
  type RecurrenceRule
} from '@/types/recurrence'
import CustomSelect from '@/components/common/CustomSelect.vue'
import { validateRecurrenceRule, generateRecurringInstances } from '@/utils/recurrenceUtils'

const props = withDefaults(defineProps<{
  modelValue?: TaskRecurrence
  startDate?: string
  taskId?: string
}>(), {
  modelValue: () => ({
    isEnabled: false,
    rule: { pattern: RecurrencePattern.NONE },
    endCondition: { type: EndCondition.NEVER },
    exceptions: [],
    generatedInstances: []
  }),
  startDate: undefined,
  taskId: undefined
})

const emit = defineEmits<{
  'update:modelValue': [value: TaskRecurrence]
}>()

// Default recurrence value for computed fallback
const defaultRecurrence: TaskRecurrence = {
  isEnabled: false,
  rule: { pattern: RecurrencePattern.NONE },
  endCondition: { type: EndCondition.NEVER },
  exceptions: [],
  generatedInstances: []
}

// Computed to safely access modelValue with fallback
const safeModelValue = computed(() => props.modelValue ?? defaultRecurrence)

const patternOptions = [
  { label: 'Daily', value: RecurrencePattern.DAILY },
  { label: 'Weekly', value: RecurrencePattern.WEEKLY },
  { label: 'Monthly', value: RecurrencePattern.MONTHLY },
  { label: 'Custom', value: RecurrencePattern.CUSTOM }
]

const weekdays = [
  { label: 'S', value: Weekday.SUNDAY },
  { label: 'M', value: Weekday.MONDAY },
  { label: 'T', value: Weekday.TUESDAY },
  { label: 'W', value: Weekday.WEDNESDAY },
  { label: 'T', value: Weekday.THURSDAY },
  { label: 'F', value: Weekday.FRIDAY },
  { label: 'S', value: Weekday.SATURDAY }
]

const examples = [
  'EVERY 3 DAYS',
  'EVERY 2 WEEKS ON MON,FRI',
  'EVERY 1 MONTHS ON LAST DAY',
  'EVERY 1 MONTHS ON 2ND TUESDAY'
]

const validationErrors = ref<string[]>([])

const toggleEnabled = (e: Event) => {
  const isEnabled = (e.target as HTMLInputElement).checked
  emit('update:modelValue', {
    ...safeModelValue.value,
    isEnabled,
    rule: isEnabled ? (safeModelValue.value.rule.pattern === RecurrencePattern.NONE ? { pattern: RecurrencePattern.DAILY, interval: 1 } as DailyRecurrenceRule : safeModelValue.value.rule) : { pattern: RecurrencePattern.NONE }
  })
}

const updatePattern = (pattern: string | number) => {
  let newRule: RecurrenceRule
  switch (pattern) {
    case RecurrencePattern.DAILY:
      newRule = { pattern: RecurrencePattern.DAILY, interval: 1 }
      break
    case RecurrencePattern.WEEKLY:
      newRule = { pattern: RecurrencePattern.WEEKLY, interval: 1, weekdays: [Weekday.MONDAY] }
      break
    case RecurrencePattern.MONTHLY:
      newRule = { pattern: RecurrencePattern.MONTHLY, interval: 1, dayOfMonth: 1 }
      break
    case RecurrencePattern.CUSTOM:
      newRule = { pattern: RecurrencePattern.CUSTOM, customRule: 'EVERY 1 DAYS' }
      break
    default:
      newRule = { pattern: RecurrencePattern.NONE }
  }
  emit('update:modelValue', { ...safeModelValue.value, rule: newRule })
}

const updateInterval = (e: Event) => {
  const interval = parseInt((e.target as HTMLInputElement).value) || 1
  const newRule = { ...safeModelValue.value.rule, interval } as RecurrenceRule
  emit('update:modelValue', { ...safeModelValue.value, rule: newRule })
}

const updateDayOfMonth = (e: Event) => {
  const dayOfMonth = parseInt((e.target as HTMLInputElement).value) || 1
  const newRule = { ...safeModelValue.value.rule, dayOfMonth } as RecurrenceRule
  emit('update:modelValue', { ...safeModelValue.value, rule: newRule })
}

const isWeekdaySelected = (day: Weekday) => {
  if (safeModelValue.value.rule.pattern !== RecurrencePattern.WEEKLY) return false
  return (safeModelValue.value.rule as WeeklyRecurrenceRule).weekdays.includes(day)
}

const toggleWeekday = (day: Weekday) => {
  if (safeModelValue.value.rule.pattern !== RecurrencePattern.WEEKLY) return
  const rule = safeModelValue.value.rule as WeeklyRecurrenceRule
  const weekdays = rule.weekdays.includes(day)
    ? rule.weekdays.filter(d => d !== day)
    : [...rule.weekdays, day]

  if (weekdays.length === 0) return // Must have at least one day

  emit('update:modelValue', {
    ...safeModelValue.value,
    rule: { ...rule, weekdays }
  })
}

const updateCustomRule = (e: Event) => {
  const customRule = (e.target as HTMLInputElement).value
  setCustomRule(customRule)
}

const setCustomRule = (customRule: string) => {
  const newRule = { pattern: RecurrencePattern.CUSTOM, customRule }
  validationErrors.value = validateRecurrenceRule(newRule as RecurrenceRule).errors
  emit('update:modelValue', { ...safeModelValue.value, rule: newRule as RecurrenceRule })
}

const updateEndType = (type: EndCondition) => {
  const endCondition = { ...safeModelValue.value.endCondition, type }
  if (type === EndCondition.ON_DATE && !endCondition.date) {
    endCondition.date = new Date().toISOString().split('T')[0]
  }
  if (type === EndCondition.AFTER_COUNT && !endCondition.count) {
    endCondition.count = 5
  }
  emit('update:modelValue', { ...safeModelValue.value, endCondition })
}

const updateEndDate = (e: Event) => {
  const date = (e.target as HTMLInputElement).value
  emit('update:modelValue', {
    ...safeModelValue.value,
    endCondition: { ...safeModelValue.value.endCondition, date }
  })
}

const updateEndCount = (e: Event) => {
  const count = parseInt((e.target as HTMLInputElement).value) || 1
  emit('update:modelValue', {
    ...safeModelValue.value,
    endCondition: { ...safeModelValue.value.endCondition, count }
  })
}

const previewDates = computed(() => {
  if (!safeModelValue.value.isEnabled) return []

  const validation = validateRecurrenceRule(safeModelValue.value.rule)
  if (!validation.isValid) return []

  const startDate = props.startDate ? new Date(props.startDate) : new Date()

  // Generate a few instances for preview
  const previewInstances = generateRecurringInstances(
    props.taskId || 'preview',
    safeModelValue.value.rule,
    safeModelValue.value.endCondition,
    [],
    startDate,
    undefined,
    undefined,
    5 // Show next 5
  )

  return previewInstances.map(inst => inst.scheduledDate)
})

// Watch for manual rule changes to refresh validation
watch(() => safeModelValue.value.rule, (newRule) => {
  if (newRule.pattern === RecurrencePattern.CUSTOM) {
     validationErrors.value = validateRecurrenceRule(newRule as RecurrenceRule).errors
  } else {
     validationErrors.value = []
  }
}, { deep: true })
</script>

<style scoped>
.recurrence-selector {
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  margin-top: var(--space-4);
  color: var(--text-primary);
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.header-icon {
  color: var(--brand-primary);
}

.header-label {
  font-weight: var(--font-semibold);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 32px;
  height: 18px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--glass-bg-heavy);
  transition: .2s;
  border-radius: var(--text-lg);
  border: 1px solid var(--glass-border);
}

.slider:before {
  position: absolute;
  content: "";
  height: 12px;
  width: 12px;
  left: var(--space-0_5);
  bottom: var(--space-0_5);
  background-color: var(--text-muted);
  transition: .2s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--brand-primary);
}

input:checked + .slider:before {
  transform: translateX(14px);
  background-color: white;
}

.selector-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px dashed var(--glass-border);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-label {
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.pattern-details {
  background: var(--glass-bg-light);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.detail-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  margin-bottom: var(--space-2);
}

.detail-row:last-child {
  margin-bottom: 0;
}

.detail-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.number-input {
  width: 60px;
  background: var(--glass-bg-base);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  padding: var(--space-0_5) var(--space-2);
  font-size: var(--text-sm);
}

.text-input {
  width: 100%;
  background: var(--glass-bg-base);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  margin-top: var(--space-1);
}

.text-input:focus {
  outline: none;
  border-color: var(--brand-primary);
}

.weekday-picker {
  display: flex;
  gap: var(--space-1);
}

.weekday-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-base);
  color: var(--text-muted);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-fast);
  display: flex;
  align-items: center;
  justify-content: center;
}

.weekday-btn:hover {
  border-color: var(--glass-border-hover);
  color: var(--text-secondary);
}

.weekday-btn.is-active {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
  color: white;
}

.custom-builder {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-info {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.syntax-hint {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.syntax-examples {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.example-btn {
  font-size: var(--text-xs);
  padding: var(--space-0_5) var(--space-2);
  border-radius: var(--radius-full);
  background: var(--glass-bg-heavy);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.example-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--text-secondary);
}

.validation-errors {
  display: flex;
  flex-direction: column;
  gap: var(--space-0_5);
  margin-top: var(--space-1);
}

.error-msg {
  font-size: var(--text-xs);
  color: var(--color-priority-high);
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.date-input {
  background: var(--glass-bg-base);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  padding: var(--space-0_5) var(--space-2);
  font-size: var(--text-sm);
}

.recurrence-preview {
  margin-top: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--glass-border);
}

.preview-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
  display: block;
  margin-bottom: var(--space-2);
}

.preview-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.preview-item {
  font-size: var(--text-xs);
  background: var(--glass-bg-tint);
  padding: var(--space-0_5) var(--space-2);
  border-radius: var(--radius-sm);
  color: var(--brand-primary);
  border: 1px solid var(--brand-primary-bg-heavy);
}

/* Transitions */
.expand-enter-active,
.expand-leave-active {
  transition: all var(--duration-normal) var(--spring-smooth);
  max-height: 500px;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>
