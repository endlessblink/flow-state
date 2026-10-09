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
        v-for="option in PRIORITY_OPTIONS"
        :key="option.value"
        class="menu-item menu-item--sm"
        :class="{ active: currentPriority === option.value }"
        @click.stop="$emit('select', option.value)"
      >
        <span class="priority-dot" :class="option.value" />
        <span class="menu-text">{{ option.label }}</span>
        <Check v-if="currentPriority === option.value" :size="12" class="check-icon" />
      </button>

      <div class="submenu-divider" />
      <button
        class="menu-item menu-item--sm menu-item--clear"
        :class="{ active: !currentPriority }"
        @click.stop="$emit('clearPriority')"
      >
        <X :size="12" class="check-icon" />
        <span class="menu-text">No Priority</span>
        <Check v-if="!currentPriority" :size="12" class="check-icon" />
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { Check, X } from 'lucide-vue-next'
import type { TaskPriority } from '@/types/tasks'
import { priorityOptions } from '@/utils/taskPriority'

const PRIORITY_OPTIONS = priorityOptions().map(option => ({ value: option.value as Exclude<TaskPriority, null>, label: option.label }))

defineProps<{
  isVisible: boolean
  parentVisible?: boolean // BUG-1095: Track parent menu visibility
  style: CSSProperties
  currentPriority?: string | null
}>()

defineEmits<{
  select: [priority: Exclude<TaskPriority, null>]
  clearPriority: []
  mouseenter: []
  mouseleave: []
}>()
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
  min-width: 130px;
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

.priority-dot {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.priority-dot.high { background-color: var(--color-priority-high); }
.priority-dot.medium { background-color: var(--color-priority-medium); }
.priority-dot.low { background-color: var(--color-priority-low); }
.priority-dot.immediate { background-color: var(--color-priority-immediate); }
.priority-dot.relaxed { background-color: var(--color-priority-relaxed); }

.check-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.priority-none-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.submenu-divider {
  height: 1px;
  background: var(--glass-bg-heavy);
  margin: var(--space-1) 0;
}

.menu-item--clear {
  color: var(--text-muted);
}
</style>
