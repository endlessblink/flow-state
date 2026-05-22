<script setup lang="ts">
import { computed } from 'vue'
import type { Big3Slot, TimeBlock } from '@/composables/useMorningDashboard'
import { ChevronLeft } from 'lucide-vue-next'

const props = defineProps<{
  slots: Big3Slot[]
  timeBlocks: TimeBlock[]
}>()

const emit = defineEmits<{
  'update:timeBlock': [index: number, block: TimeBlock]
  back: []
  start: []
}>()

// Generate hour options from 6:00 to 22:00 in 15-min increments
const timeOptions = computed(() => {
  const options: { label: string; value: string }[] = []
  for (let h = 6; h <= 22; h++) {
    for (const m of [0, 15, 30, 45]) {
      const hh = h.toString().padStart(2, '0')
      const mm = m.toString().padStart(2, '0')
      const ampm = h < 12 ? 'AM' : 'PM'
      const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
      options.push({
        label: `${displayH}:${mm} ${ampm}`,
        value: `${hh}:${mm}`,
      })
    }
  }
  return options
})

const durationOptions = [
  { label: '25 min', value: 25 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 hour', value: 60 },
  { label: '1.5 hours', value: 90 },
  { label: '2 hours', value: 120 },
]

function updateStartTime(index: number, value: string) {
  emit('update:timeBlock', index, { ...props.timeBlocks[index], startTime: value })
}

function updateDuration(index: number, value: number) {
  emit('update:timeBlock', index, { ...props.timeBlocks[index], duration: value })
}

function endTime(block: TimeBlock): string {
  const [h, m] = block.startTime.split(':').map(Number)
  const totalMin = h * 60 + m + block.duration
  const endH = Math.floor(totalMin / 60) % 24
  const endM = totalMin % 60
  const ampm = endH < 12 ? 'AM' : 'PM'
  const displayH = endH === 0 ? 12 : endH > 12 ? endH - 12 : endH
  return `${displayH}:${endM.toString().padStart(2, '0')} ${ampm}`
}

// Check for overlaps
const hasOverlap = computed(() => {
  const ranges = props.timeBlocks.map((b) => {
    const [h, m] = b.startTime.split(':').map(Number)
    const start = h * 60 + m
    return { start, end: start + b.duration }
  })
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      if (ranges[i].start < ranges[j].end && ranges[j].start < ranges[i].end) {
        return true
      }
    }
  }
  return false
})

const slotLabels = ['Top priority', 'Second focus', 'One more thing']
</script>

<template>
  <div class="timeblock-picker">
    <div class="tb-header">
      <button class="tb-back" type="button" @click="emit('back')">
        <ChevronLeft :size="16" />
        <span>Back</span>
      </button>
      <h3 class="tb-title">Time Block Your Big 3</h3>
      <span class="tb-subtitle">When will you work on each task?</span>
    </div>

    <div class="tb-tasks">
      <div
        v-for="(slot, i) in slots"
        :key="i"
        class="tb-row"
      >
        <div class="tb-task-info">
          <span class="tb-slot-number">{{ i + 1 }}.</span>
          <div class="tb-task-details">
            <span class="tb-task-title">{{ slot.title }}</span>
            <span class="tb-slot-label">{{ slotLabels[i] }}</span>
          </div>
        </div>

        <div class="tb-controls">
          <select
            class="tb-select"
            :value="timeBlocks[i].startTime"
            @change="updateStartTime(i, ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="opt in timeOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>

          <select
            class="tb-select tb-select--duration"
            :value="timeBlocks[i].duration"
            @change="updateDuration(i, Number(($event.target as HTMLSelectElement).value))"
          >
            <option v-for="opt in durationOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>

          <span class="tb-end-time">until {{ endTime(timeBlocks[i]) }}</span>
        </div>
      </div>
    </div>

    <div v-if="hasOverlap" class="tb-warning">
      Time blocks overlap — consider adjusting
    </div>

    <!-- Mini timeline preview -->
    <div class="tb-timeline">
      <div class="tb-timeline-track">
        <div
          v-for="(block, i) in timeBlocks"
          :key="i"
          class="tb-timeline-block"
          :class="`tb-timeline-block--${i}`"
          :style="{
            left: `${((parseInt(block.startTime.split(':')[0]) * 60 + parseInt(block.startTime.split(':')[1])) - 360) / (960 - 360) * 100}%`,
            width: `${block.duration / (960 - 360) * 100}%`,
          }"
        >
          <span class="tb-timeline-label">{{ i + 1 }}</span>
        </div>
      </div>
      <div class="tb-timeline-hours">
        <span v-for="h in [6, 8, 10, 12, 14, 16, 18, 20, 22]" :key="h" class="tb-hour-mark">
          {{ h > 12 ? h - 12 : h }}{{ h < 12 ? 'a' : 'p' }}
        </span>
      </div>
    </div>

    <button
      class="tb-start-button"
      type="button"
      @click="emit('start')"
    >
      Start My Day
    </button>
  </div>
</template>

<style scoped>
.timeblock-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.tb-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.tb-back {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0;
  align-self: flex-start;
  transition: color 0.15s ease;
}

.tb-back:hover {
  color: var(--text-primary);
}

.tb-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.tb-subtitle {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.tb-tasks {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.tb-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--surface-primary);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
}

.tb-task-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.tb-slot-number {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--brand-primary);
  flex-shrink: 0;
}

.tb-task-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.tb-task-title {
  font-size: 0.8rem;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tb-slot-label {
  font-size: 0.65rem;
  color: var(--text-muted);
}

.tb-controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.tb-select {
  appearance: none;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 0.75rem;
  padding: var(--space-1) var(--space-2);
  cursor: pointer;
  min-width: 80px;
}

.tb-select:focus {
  outline: none;
  border-color: var(--brand-primary);
}

.tb-select--duration {
  min-width: 70px;
}

.tb-end-time {
  font-size: 0.65rem;
  color: var(--text-muted);
  white-space: nowrap;
  min-width: 70px;
}

.tb-warning {
  font-size: 0.7rem;
  color: var(--color-warning);
  padding: var(--space-1) var(--space-2);
  background: rgba(255, 195, 0, 0.06);
  border-radius: var(--radius-sm);
}

/* Mini timeline */
.tb-timeline {
  padding: var(--space-2) 0;
}

.tb-timeline-track {
  position: relative;
  height: 24px;
  background: var(--glass-bg-soft);
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  overflow: hidden;
}

.tb-timeline-block {
  position: absolute;
  top: 2px;
  height: 20px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
}

.tb-timeline-block--0 {
  background: rgba(45, 212, 191, 0.3);
  border: 1px solid var(--brand-primary);
}

.tb-timeline-block--1 {
  background: rgba(255, 195, 0, 0.25);
  border: 1px solid var(--color-warning);
}

.tb-timeline-block--2 {
  background: rgba(147, 130, 220, 0.25);
  border: 1px solid #9382dc;
}

.tb-timeline-label {
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--text-primary);
}

.tb-timeline-hours {
  display: flex;
  justify-content: space-between;
  padding: var(--space-1) 0 0;
}

.tb-hour-mark {
  font-size: 0.55rem;
  color: var(--text-muted);
}

.tb-start-button {
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-soft);
  color: var(--brand-primary);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-md);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: background 0.2s ease, box-shadow 0.2s ease;
  width: 100%;
  animation: pulse-teal 2s ease-in-out infinite;
}

.tb-start-button:hover {
  background: rgba(45, 212, 191, 0.12);
}

@keyframes pulse-teal {
  0%, 100% { box-shadow: 0 0 0 0 rgba(45, 212, 191, 0.4); }
  50% { box-shadow: 0 0 20px 4px rgba(45, 212, 191, 0.2); }
}

@media (prefers-reduced-motion: reduce) {
  .tb-start-button { animation: none; }
}

@media (max-width: 768px) {
  .tb-row {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .tb-controls {
    flex-wrap: wrap;
  }
}
</style>
