<template>
  <div
    class="quick-sort-card"
    :class="{ 'is-swiping': isSwiping }"
    @mousedown="handleMouseDown"
    @touchstart="handleTouchStart"
  >
    <div class="card-content">
      <!-- Delete button (top-right corner) -->
      <button
        class="card-delete-btn"
        aria-label="Delete task"
        @click.stop="emit('swipeDelete')"
        @mousedown.stop
        @touchstart.stop
      >
        <Trash2 :size="16" />
      </button>

      <!-- Task Title -->
      <h2 class="task-title" dir="auto">
        {{ task.title }}
      </h2>

      <!-- Task Description -->
      <MarkdownRenderer
        v-if="task.description"
        :content="task.description"
        class="task-description"
      />

      <!-- Combined Priority + Date Controls (single row) -->
      <div class="quick-controls-row" @mousedown.stop @touchstart.stop>
        <div class="priority-buttons">
          <button
            class="priority-btn"
            :class="{ active: task.priority === 'low' }"
            @click="updatePriority('low')"
          >
            {{ $t('task.priority_low') }}
          </button>
          <button
            class="priority-btn"
            :class="{ active: task.priority === 'medium' }"
            @click="updatePriority('medium')"
          >
            {{ $t('task.priority_med_abbr') }}
          </button>
          <button
            class="priority-btn"
            :class="{ active: task.priority === 'high' }"
            @click="updatePriority('high')"
          >
            {{ $t('task.priority_high') }}
          </button>
        </div>

        <div class="date-shortcuts">
          <button
            class="quick-date-btn"
            :class="{ active: isToday }"
            @click.stop="setToday"
          >
            ☀️ {{ $t('quick_sort.today') }}
          </button>
          <button
            class="quick-date-btn"
            :class="{ active: isTomorrow }"
            @click.stop="setTomorrow"
          >
            🌅 +1
          </button>
          <button
            class="quick-date-btn"
            :class="{ active: isNextWeek }"
            @click.stop="setNextWeek"
          >
            📆 +7
          </button>
          <button
            class="quick-date-btn clear-btn"
            :class="{ active: hasNoDate }"
            @click.stop="clearDate"
          >
            {{ $t('quick_sort.clear') }}
          </button>
          <NPopover
            trigger="click"
            placement="top"
            raw
            :show="showDatePicker"
            @update:show="showDatePicker = $event"
          >
            <template #trigger>
              <button
                class="quick-date-btn pick-btn"
                title="Pick date"
                @click.stop
                @mousedown.stop
                @touchstart.stop
              >
                <CalendarDays :size="14" />
              </button>
            </template>
            <div @click.stop>
              <NDatePicker
                panel
                type="date"
                :value="currentDueDateTimestamp"
                :actions="null"
                @update:value="handleDatePickerSelect"
              />
            </div>
          </NPopover>
        </div>
      </div>

      <!-- Swipe Indicator (visible during drag) -->
      <div v-if="isSwiping && swipeDirection" class="swipe-indicator" :class="swipeDirection">
        <template v-if="swipeDirection === 'right'">
          <Save :size="28" />
          <span class="swipe-label">{{ $t('quick_sort.save') }}</span>
        </template>
        <template v-if="swipeDirection === 'left'">
          <Trash2 :size="28" />
          <span class="swipe-label">{{ $t('quick_sort.del') }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { type Task } from '@/stores/tasks'
import { CalendarDays, Save, Trash2 } from 'lucide-vue-next'
import { NPopover, NDatePicker } from 'naive-ui'
import MarkdownRenderer from '@/components/common/MarkdownRenderer.vue'

interface Props {
  task: Task
}

const { t } = useI18n()
const props = defineProps<Props>()
const emit = defineEmits<{
  updateTask: [updates: Partial<Task>]
  swipeSave: []
  swipeDelete: []
}>()

// Date picker state
const showDatePicker = ref(false)

// Swipe handling
const isSwiping = ref(false)
const swipeStartX = ref(0)
const swipeCurrentX = ref(0)

const _SWIPE_THRESHOLD = 120 // pixels

const swipeDirection = computed(() => {
  const delta = swipeCurrentX.value - swipeStartX.value
  if (Math.abs(delta) < 30) return null
  return delta > 0 ? 'right' : 'left'
})

// Date detection computed properties for active states
const isToday = computed(() => {
  if (!props.task.dueDate) return false
  const taskDate = new Date(props.task.dueDate)
  if (isNaN(taskDate.getTime())) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  taskDate.setHours(0, 0, 0, 0)

  return taskDate.getTime() === today.getTime()
})

const isTomorrow = computed(() => {
  if (!props.task.dueDate) return false
  const taskDate = new Date(props.task.dueDate)
  if (isNaN(taskDate.getTime())) return false

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  taskDate.setHours(0, 0, 0, 0)

  return taskDate.getTime() === tomorrow.getTime()
})

const isNextWeek = computed(() => {
  if (!props.task.dueDate) return false
  const taskDate = new Date(props.task.dueDate)
  if (isNaN(taskDate.getTime())) return false

  const nextMonday = new Date()
  const dayOfWeek = nextMonday.getDay()
  const daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  nextMonday.setDate(nextMonday.getDate() + daysUntilNextMonday)
  nextMonday.setHours(0, 0, 0, 0)
  taskDate.setHours(0, 0, 0, 0)

  return taskDate.getTime() === nextMonday.getTime()
})

const hasNoDate = computed(() => {
  return !props.task.dueDate || props.task.dueDate === ''
})

// Date picker value (timestamp in milliseconds for Naive UI)
const currentDueDateTimestamp = computed(() => {
  if (!props.task.dueDate) return null
  const d = new Date(props.task.dueDate)
  return isNaN(d.getTime()) ? null : d.getTime()
})

// Task editing functions
function updatePriority(priority: 'low' | 'medium' | 'high') {
  emit('updateTask', { priority })
}

// Quick date shortcuts
function setToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  emit('updateTask', { dueDate: today.toISOString() })
}

function setTomorrow() {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  emit('updateTask', { dueDate: tomorrow.toISOString() })
}

function setNextWeek() {
  const nextMonday = new Date()
  const dayOfWeek = nextMonday.getDay()
  const daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  nextMonday.setDate(nextMonday.getDate() + daysUntilNextMonday)
  nextMonday.setHours(0, 0, 0, 0)
  emit('updateTask', { dueDate: nextMonday.toISOString() })
}

function clearDate() {
  emit('updateTask', { dueDate: '' })
}

// Handle date selection from date picker
function handleDatePickerSelect(timestamp: number | null) {
  if (timestamp) {
    const date = new Date(timestamp)
    date.setHours(0, 0, 0, 0)
    emit('updateTask', { dueDate: date.toISOString() })
  } else {
    emit('updateTask', { dueDate: '' })
  }
  showDatePicker.value = false
}

// Mouse/Touch handling
function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  const tag = target.tagName?.toLowerCase()
  if (tag === 'button' || tag === 'input' || tag === 'select' || tag === 'a') return true
  return !!target.closest('button, input, select, a, .n-date-picker, .n-popover')
}

function handleMouseDown(event: MouseEvent) {
  // Don't start swipe from interactive elements (buttons, date picker, etc.)
  if (isInteractiveTarget(event.target)) return

  isSwiping.value = true
  swipeStartX.value = event.clientX
  swipeCurrentX.value = event.clientX

  const handleMouseMove = (e: MouseEvent) => {
    swipeCurrentX.value = e.clientX
  }

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    handleSwipeEnd()
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

function handleTouchStart(event: TouchEvent) {
  // Don't start swipe from interactive elements
  if (isInteractiveTarget(event.target)) return

  isSwiping.value = true
  swipeStartX.value = event.touches[0].clientX
  swipeCurrentX.value = event.touches[0].clientX

  const handleTouchMove = (e: TouchEvent) => {
    swipeCurrentX.value = e.touches[0].clientX
  }

  const handleTouchEnd = () => {
    document.removeEventListener('touchmove', handleTouchMove)
    document.removeEventListener('touchend', handleTouchEnd)
    handleSwipeEnd()
  }

  document.addEventListener('touchmove', handleTouchMove)
  document.addEventListener('touchend', handleTouchEnd)
}

function handleSwipeEnd() {
  const delta = swipeCurrentX.value - swipeStartX.value

  if (Math.abs(delta) >= _SWIPE_THRESHOLD) {
    if (delta > 0) {
      emit('swipeSave')
    } else {
      emit('swipeDelete')
    }
  }

  isSwiping.value = false
  swipeStartX.value = 0
  swipeCurrentX.value = 0
}
</script>

<style scoped>
.quick-sort-card {
  position: relative;
  width: 100%;
  background: var(--glass-bg-medium);
  backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: var(--space-8);
  box-shadow: var(--shadow-xl);
  transition: transform var(--duration-normal) var(--ease-out), box-shadow var(--duration-normal);
  cursor: grab;
  user-select: none;
  overflow: hidden; /* Prevent any content from escaping card bounds */
}

.quick-sort-card:hover {
  box-shadow: var(--shadow-2xl);
}

.quick-sort-card.is-swiping {
  cursor: grabbing;
  transition: none;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  position: relative;
}

.card-delete-btn {
  position: absolute;
  bottom: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: all var(--duration-normal);
}

.quick-sort-card:hover .card-delete-btn {
  opacity: 1;
}

.card-delete-btn:hover {
  background: var(--danger-bg);
  border-color: var(--danger-muted);
  color: var(--danger);
}

.task-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
  line-height: var(--leading-tight);
  overflow-wrap: anywhere; /* Break long URLs/strings that have no spaces */
  word-break: break-word;
  /* Hard height cap + line-clamp for long URLs */
  max-height: 5.2em; /* ~3 lines */
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

/* RTL support for Hebrew/Arabic text */
.task-title:dir(rtl) {
  text-align: right;
}

.task-description {
  font-size: var(--text-base);
  color: var(--text-secondary);
  line-height: var(--leading-relaxed);
  margin: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
  max-height: 80px;
  overflow-y: auto;
}

/* Combined Priority + Date Controls Row */
.quick-controls-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-subtle);
}

.priority-buttons {
  display: flex;
  gap: var(--space-2);
}

.priority-btn {
  padding: var(--space-1_5) var(--space-2_5);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.priority-btn:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
}

.priority-btn.active {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  font-weight: var(--font-semibold);
}

.date-shortcuts {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.quick-date-btn {
  padding: var(--space-1_5) var(--space-2_5);
  min-height: 36px;
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal);
  white-space: nowrap;
}

.quick-date-btn:hover {
  background: var(--glass-bg-medium);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.quick-date-btn.active {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  font-weight: var(--font-semibold);
}

.quick-date-btn.clear-btn {
  border-color: var(--danger-muted);
  color: var(--danger);
}

.quick-date-btn.clear-btn:hover {
  background: var(--danger-bg);
  border-color: var(--danger);
  color: var(--danger);
}

.quick-date-btn.clear-btn.active {
  background: transparent;
  border-color: var(--danger);
  color: var(--danger);
  font-weight: var(--font-semibold);
}

.pick-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2) !important;
  min-width: 40px;
}

.swipe-indicator {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  opacity: 0.5;
  transition: opacity var(--duration-normal);
}

.swipe-indicator.right {
  right: var(--space-5);
  color: var(--brand-primary);
}

.swipe-indicator.left {
  left: var(--space-5);
  color: var(--danger);
}

.swipe-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Responsive: stack controls vertically on narrow screens */
@media (max-width: 520px) {
  .quick-controls-row {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2_5);
  }

  .priority-buttons {
    justify-content: stretch;
  }

  .priority-btn {
    flex: 1;
    text-align: center;
  }

  .date-shortcuts {
    justify-content: flex-start;
  }

  .quick-date-btn {
    padding: var(--space-1_5) var(--space-2);
    font-size: var(--text-xs);
    min-height: 32px;
  }

  .pick-btn {
    min-width: 32px;
    padding: var(--space-1_5) !important;
  }
}

/* Reduce motion for accessibility */
@media (prefers-reduced-motion: reduce) {
  .quick-sort-card {
    transition: none !important;
  }

  .swipe-indicator {
    transition: none !important;
  }
}
</style>