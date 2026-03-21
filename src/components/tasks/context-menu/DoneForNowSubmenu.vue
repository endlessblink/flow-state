<template>
  <Teleport to="body">
    <!-- TASK-1445: Outer wrapper has no overflow so ::before bridge isn't clipped -->
    <div
      v-if="isVisible && parentVisible"
      class="submenu"
      :style="style"
      @mouseenter="$emit('mouseenter')"
      @mouseleave="onMouseleave"
      @wheel.stop
    >
      <div class="submenu-scroll">
        <!-- Tomorrow — always shown -->
        <button class="menu-item menu-item--sm" @click.stop="$emit('selectTomorrow')">
          <Clock :size="13" class="date-icon" />
          <span class="menu-text">Tomorrow</span>
        </button>

        <!-- Next occurrence — only for recurring tasks -->
        <button v-if="isRecurring" class="menu-item menu-item--sm" @click.stop="$emit('selectNextOccurrence')">
          <RefreshCw :size="13" class="date-icon" />
          <span class="menu-text">Next occurrence</span>
        </button>

        <div class="submenu-divider" />

        <!-- Pick a date -->
        <NPopover
          v-model:show="showDatePicker"
          trigger="manual"
          placement="right-start"
          :z-index="10003"
          :show-arrow="false"
          raw
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
              type="date"
              :actions="[]"
              @update:value="handleDatePickerSelect"
            />
          </div>
        </NPopover>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { CSSProperties } from 'vue'
import { Clock, RefreshCw, CalendarPlus } from 'lucide-vue-next'
import { NPopover, NDatePicker } from 'naive-ui'

const props = defineProps<{
  isVisible: boolean
  parentVisible?: boolean
  style: CSSProperties
  isRecurring?: boolean
}>()

const emit = defineEmits<{
  selectTomorrow: []
  selectNextOccurrence: []
  pickDate: [timestamp: number]
  mouseenter: []
  mouseleave: []
}>()

const showDatePicker = ref(false)

// Reset date picker when submenu hides
watch(() => props.isVisible, (v) => { if (!v) showDatePicker.value = false })

const handleDatePickerSelect = (timestamp: number | null) => {
  if (!timestamp) return
  showDatePicker.value = false
  emit('pickDate', timestamp)
}

// Suppress mouseleave when the date picker popover is open —
// NPopover renders outside the submenu div so cursor movement to it triggers mouseleave
const onMouseleave = () => {
  if (!showDatePicker.value) {
    emit('mouseleave')
  }
}
</script>

<style scoped>
/* TASK-1445: Outer wrapper — no overflow so ::before bridge isn't clipped */
.submenu {
  position: fixed;
  background: var(--overlay-component-bg);
  backdrop-filter: var(--overlay-component-backdrop);
  border: var(--overlay-component-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--overlay-component-shadow);
  min-width: 160px;
  z-index: var(--z-submenu, 10001);
  animation: menuSlideIn var(--duration-fast) var(--ease-out);
}

/* TASK-1445: Invisible hover bridge on both sides (submenu can flip) */
.submenu::before,
.submenu::after {
  content: '';
  position: absolute;
  top: -8px;
  bottom: -8px;
  width: 16px;
}
.submenu::before { left: -16px; }
.submenu::after { right: -16px; }

/* Inner scroll wrapper handles overflow */
.submenu-scroll {
  padding: var(--space-1) 0;
  max-height: calc(100vh - 16px);
  overflow-y: auto;
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

.submenu-divider {
  height: 1px;
  background: var(--glass-bg-heavy);
  margin: var(--space-1) 0;
}

.date-picker-wrapper {
  padding: var(--space-1);
}
</style>
