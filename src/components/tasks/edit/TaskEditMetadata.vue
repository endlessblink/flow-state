<template>
  <div class="metadata-bar">
    <!-- Schedule -->
    <div class="metadata-box">
      <span class="metadata-label">SCHEDULE</span>
      <div class="metadata-field" title="Due date - When this task must be completed by">
        <Calendar :size="14" />
        <span class="field-label">Due</span>
        <input
          :value="modelValue.dueDate"
          type="date"
          class="inline-input"
          @input="updateDate('dueDate', $event)"
        >
      </div>

      <div class="metadata-field" title="Do date - When you plan to do this task">
        <Clock :size="14" />
        <span class="field-label">Do</span>
        <input
          :value="modelValue.scheduledDate"
          type="date"
          class="inline-input"
          @input="updateDate('scheduledDate', $event)"
        >
        <input
          v-if="modelValue.scheduledDate"
          :value="modelValue.scheduledTime"
          type="time"
          class="inline-input"
          @input="updateTime($event)"
        >
      </div>

      <div class="metadata-field">
        <TimerReset :size="14" />
        <span class="field-label">Duration</span>
        <input
          v-model.number="modelValue.estimatedDuration"
          type="number"
          class="inline-input duration-input"
          placeholder="60"
          min="1"
        >
        <span class="unit">min</span>
      </div>
    </div>

    <!-- Properties -->
    <div class="metadata-box">
      <span class="metadata-label">PROPERTIES</span>
      
      <!-- Priority -->
      <div class="metadata-field metadata-field--dropdown">
        <component 
          :is="priorityIcon" 
          :size="14" 
          :class="priorityIconClass" 
        />
        <span class="field-label">Priority</span>
        <CustomSelect
          :model-value="modelValue.priority"
          :options="priorityOptions"
          class="inline-custom-select"
          @update:model-value="updatePriority"
        />
      </div>

      <!-- Status -->
      <div class="metadata-field metadata-field--dropdown">
        <component 
          :is="statusIcon" 
          :size="14" 
          :class="statusIconClass" 
        />
        <span class="field-label">Status</span>
        <CustomSelect
          :model-value="modelValue.status"
          :options="statusOptions"
          class="inline-custom-select"
          @update:model-value="updateStatus"
        />
      </div>

      <!-- Section / Project -->
      <div class="metadata-field metadata-field--dropdown">
        <component :is="Layers" :size="14" />
        <span class="field-label">Section</span>
        <SectionSelector
          :model-value="currentSectionId"
          class="inline-custom-select"
          @update:model-value="$emit('section-change', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { 
  Calendar, Clock, TimerReset, Flag, Zap, Circle, 
  PlayCircle, CheckCircle, Archive, AlertCircle, Layers 
} from 'lucide-vue-next'
import { type Task } from '@/stores/tasks'
import CustomSelect from '@/components/common/CustomSelect.vue'
import SectionSelector from '@/components/canvas/SectionSelector.vue'

const props = defineProps<{
  modelValue: Task
  currentSectionId: string | null
  priorityOptions: { label: string; value: string }[]
  statusOptions: { label: string; value: string }[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: Task): void
  (e: 'section-change', id: string | null): void
  (e: 'schedule-change'): void
}>()

// --- Update Helpers ---

const updateDate = (field: 'dueDate' | 'scheduledDate', event: Event) => {
  const target = event.target as HTMLInputElement
  const newTask = { ...props.modelValue, [field]: target.value }
  emit('update:modelValue', newTask)
  if (field === 'scheduledDate') emit('schedule-change')
}

const updateTime = (event: Event) => {
  const target = event.target as HTMLInputElement
  const newTask = { ...props.modelValue, scheduledTime: target.value }
  emit('update:modelValue', newTask)
}

const updatePriority = (value: string | number) => {
  const newTask = { ...props.modelValue, priority: value as 'low' | 'medium' | 'high' }
  emit('update:modelValue', newTask)
}

const updateStatus = (value: string | number) => {
  const newTask = { ...props.modelValue, status: value as 'planned' | 'in_progress' | 'done' | 'backlog' }
  emit('update:modelValue', newTask)
}

// --- Icons & Classes ---

const priorityIcon = computed(() => {
  switch (props.modelValue.priority) {
    case 'low': return Flag
    case 'high': return Zap
    default: return Circle
  }
})

const priorityIconClass = computed(() => {
  switch (props.modelValue.priority) {
    case 'low': return 'priority-low'
    case 'high': return 'priority-high'
    default: return 'priority-medium'
  }
})

const statusIcon = computed(() => {
  switch (props.modelValue.status) {
    case 'planned': return Circle
    case 'in_progress': return PlayCircle
    case 'done': return CheckCircle
    case 'backlog': return Archive
    default: return AlertCircle
  }
})

const statusIconClass = computed(() => {
  switch (props.modelValue.status) {
    case 'planned': return 'status-planned'
    case 'in_progress': return 'status-progress'
    case 'done': return 'status-done'
    case 'backlog': return 'status-backlog'
    default: return 'status-planned'
  }
})
</script>

<style scoped>
.metadata-bar {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
  padding: var(--space-3);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
}

.metadata-box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  padding-bottom: var(--space-2);
}

.metadata-box:not(:last-child) {
  border-bottom: 1px dashed var(--glass-border);
  padding-bottom: var(--space-3);
}

.metadata-label {
  font-size: 10px;
  font-weight: var(--font-bold);
  color: var(--text-muted);
  width: 100%;
  margin-bottom: var(--space-1);
  letter-spacing: 0.05em;
}

.metadata-field {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--glass-bg-base);
  border: 1px solid var(--glass-border);
  padding: 4px 10px;
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  transition: all var(--duration-fast);
  min-height: 28px;
  height: auto;
}

/* Dropdown fields need slightly more padding for click target */
.metadata-field--dropdown {
  padding: 6px 10px;
  cursor: pointer;
}

.metadata-field:hover {
  background: var(--glass-bg-soft);
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.field-label {
  font-weight: var(--font-medium);
  color: var(--text-muted);
  margin-right: 4px;
}

.inline-input {
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-xs);
  font-family: inherit;
  padding: 0;
  width: auto;
  cursor: pointer;
}

.inline-input:focus {
  outline: none;
  text-decoration: underline;
}

.priority-low { color: var(--color-priority-low); } 
.priority-medium { color: var(--color-priority-medium); }
.priority-high { color: var(--color-priority-high); }

.status-planned { color: var(--text-muted); }
.status-progress { color: var(--color-active); }
.status-done { color: var(--color-success); }
.status-backlog { color: var(--text-tertiary); }

/* Remove calendar icon from date inputs */
input[type="date"]::-webkit-calendar-picker-indicator {
  display: none;
  -webkit-appearance: none;
}
</style>
