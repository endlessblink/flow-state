<template>
  <Teleport to="body">
    <div
      v-if="isVisible && parentVisible"
      class="submenu"
      :style="style"
      @mouseenter="$emit('mouseenter')"
      @mouseleave="$emit('mouseleave')"
      @wheel.stop
    >
      <button
        class="menu-item menu-item--sm"
        :class="{ active: activeDatePill === 'today' }"
        @click.stop="$emit('select', 'today')"
      >
        <Calendar :size="13" class="date-icon" />
        <span class="menu-text">Today</span>
        <Check v-if="activeDatePill === 'today'" :size="12" class="check-icon" />
      </button>

      <button
        class="menu-item menu-item--sm"
        :class="{ active: activeDatePill === 'tomorrow' }"
        @click.stop="$emit('select', 'tomorrow')"
      >
        <Calendar :size="13" class="date-icon" />
        <span class="menu-text">Tomorrow</span>
        <Check v-if="activeDatePill === 'tomorrow'" :size="12" class="check-icon" />
      </button>

      <button
        class="menu-item menu-item--sm"
        :class="{ active: activeDatePill === 'weekend' }"
        @click.stop="$emit('select', 'weekend')"
      >
        <Calendar :size="13" class="date-icon" />
        <span class="menu-text">This Weekend</span>
        <Check v-if="activeDatePill === 'weekend'" :size="12" class="check-icon" />
      </button>

      <button
        class="menu-item menu-item--sm"
        :class="{ active: activeDatePill === 'nextweek' }"
        @click.stop="$emit('select', 'nextweek')"
      >
        <Calendar :size="13" class="date-icon" />
        <span class="menu-text">Next Week</span>
        <Check v-if="activeDatePill === 'nextweek'" :size="12" class="check-icon" />
      </button>

      <div class="submenu-divider" />

      <NPopover
        v-model:show="showDatePicker"
        trigger="click"
        placement="right-start"
        :z-index="10003"
        :show-arrow="false"
        raw
        @click.stop
      >
        <template #trigger>
          <button
            class="menu-item menu-item--sm"
            @click.stop="showDatePicker = !showDatePicker"
          >
            <CalendarPlus :size="13" class="date-icon" />
            <span class="menu-text">Pick a date...</span>
          </button>
        </template>
        <div class="date-picker-wrapper" @click.stop>
          <NDatePicker
            panel
            :value="currentDueDateTimestamp"
            type="date"
            :actions="[]"
            @update:value="handleDatePickerSelect"
          />
        </div>
      </NPopover>

      <div class="submenu-divider" />

      <div class="date-footer" @click.stop>
        <button class="date-footer-btn" @click.stop="emitMonthOffset(1)">+1mo</button>
        <button class="date-footer-btn" @click.stop="emitMonthOffset(2)">+2mo</button>
        <button class="date-footer-btn" @click.stop="emitMonthOffset(3)">+3mo</button>
        <button class="date-footer-btn" @click.stop="emitMonthOffset(6)">+6mo</button>
      </div>

      <template v-if="currentDueDate">
        <div class="submenu-divider" />
        <button
          class="menu-item menu-item--sm menu-item--clear"
          @click.stop="$emit('clearDate')"
        >
          <X :size="12" class="check-icon" />
          <span class="menu-text">Clear date</span>
        </button>
      </template>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { CSSProperties } from 'vue'
import { Calendar, CalendarPlus, Check, X } from 'lucide-vue-next'
import { NPopover, NDatePicker } from 'naive-ui'

const props = defineProps<{
  isVisible: boolean
  parentVisible?: boolean // BUG-1095: Track parent menu visibility
  style: CSSProperties
  currentDueDate?: string | null
}>()

const emit = defineEmits<{
  select: [dateType: 'today' | 'tomorrow' | 'weekend' | 'nextweek']
  pickDate: [timestamp: number]
  clearDate: []
  mouseenter: []
  mouseleave: []
}>()

const showDatePicker = ref(false)

const activeDatePill = computed(() => {
  if (!props.currentDueDate) return null
  const due = new Date(props.currentDueDate)
  const today = new Date()
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (isSameDay(due, today)) return 'today'
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (isSameDay(due, tomorrow)) return 'tomorrow'
  const dayOfWeek = today.getDay()
  const daysUntilSat = (6 - dayOfWeek + 7) % 7 || 7
  const weekend = new Date(today)
  weekend.setDate(today.getDate() + daysUntilSat)
  if (isSameDay(due, weekend)) return 'weekend'
  const daysUntilMon = (1 - dayOfWeek + 7) % 7 || 7
  const nextWeek = new Date(today)
  nextWeek.setDate(today.getDate() + daysUntilMon)
  if (isSameDay(due, nextWeek)) return 'nextweek'
  return null
})

const currentDueDateTimestamp = computed(() => {
  if (!props.currentDueDate) return null
  const date = new Date(props.currentDueDate)
  return isNaN(date.getTime()) ? null : date.getTime()
})

const handleDatePickerSelect = (timestamp: number | null) => {
  if (!timestamp) return
  showDatePicker.value = false
  emit('pickDate', timestamp)
}

const emitMonthOffset = (months: number) => {
  const date = new Date()
  date.setMonth(date.getMonth() + months)
  showDatePicker.value = false
  emit('pickDate', date.getTime())
}
</script>

<style scoped>
.submenu {
  position: fixed;
  background: var(--overlay-component-bg);
  backdrop-filter: var(--overlay-component-backdrop);
  border: var(--overlay-component-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--overlay-component-shadow);
  padding: var(--space-1) 0;
  min-width: 160px;
  max-height: calc(100vh - 16px);
  overflow-y: auto;
  z-index: var(--z-submenu, 10001);
  animation: menuSlideIn var(--duration-fast) var(--ease-out);
}

@keyframes menuSlideIn {
  from { opacity: 0; transform: scale(0.96) translateY(-4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.menu-item {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-primary);
  padding: var(--space-1_5) var(--space-2_5);
  font-size: var(--text-xs);
  text-align: start;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  transition: background var(--duration-fast);
}

.menu-item:hover { background: var(--glass-bg-heavy); }
.menu-item.active { color: var(--brand-primary); }

.menu-text { flex: 1; }

.date-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.menu-item.active .date-icon { opacity: 1; }

.check-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.submenu-divider {
  height: 1px;
  background: var(--glass-bg-heavy);
  margin: var(--space-1) 0;
}

.menu-item--clear {
  color: var(--text-muted);
}

.date-footer {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2_5);
}

.date-footer-btn {
  flex: 1;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  padding: var(--space-1) 0;
  cursor: pointer;
  text-align: center;
  transition: background var(--duration-fast), border-color var(--duration-fast), color var(--duration-fast);
  backdrop-filter: blur(8px);
}

.date-footer-btn:hover {
  background: var(--glass-bg-heavy);
  border-color: var(--glass-border-hover);
  color: var(--brand-primary);
}

.date-picker-wrapper {
  padding: var(--space-1);
}
</style>
