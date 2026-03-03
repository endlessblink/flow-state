<template>
  <Teleport to="body">
    <div
      v-if="isVisible && parentVisible"
      class="submenu"
      :style="style"
      @mouseenter="$emit('mouseenter')"
      @mouseleave="$emit('mouseleave')"
    >
      <button
        class="menu-item menu-item--sm"
        :class="{ active: currentPriority === 'high' }"
        @click.stop="$emit('select', 'high')"
      >
        <span class="priority-dot high" />
        <span class="menu-text">High</span>
        <Check v-if="currentPriority === 'high'" :size="12" class="check-icon" />
      </button>

      <button
        class="menu-item menu-item--sm"
        :class="{ active: currentPriority === 'medium' }"
        @click.stop="$emit('select', 'medium')"
      >
        <span class="priority-dot medium" />
        <span class="menu-text">Medium</span>
        <Check v-if="currentPriority === 'medium'" :size="12" class="check-icon" />
      </button>

      <button
        class="menu-item menu-item--sm"
        :class="{ active: currentPriority === 'low' }"
        @click.stop="$emit('select', 'low')"
      >
        <span class="priority-dot low" />
        <span class="menu-text">Low</span>
        <Check v-if="currentPriority === 'low'" :size="12" class="check-icon" />
      </button>

      <template v-if="currentPriority">
        <div class="submenu-divider" />
        <button
          class="menu-item menu-item--sm menu-item--clear"
          @click.stop="$emit('clearPriority')"
        >
          <X :size="12" class="check-icon" />
          <span class="menu-text">Clear priority</span>
        </button>
      </template>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { Check, X } from 'lucide-vue-next'

defineProps<{
  isVisible: boolean
  parentVisible?: boolean // BUG-1095: Track parent menu visibility
  style: CSSProperties
  currentPriority?: string | null
}>()

defineEmits<{
  select: [priority: 'high' | 'medium' | 'low']
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
  z-index: 10001;
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

.priority-dot {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.priority-dot.high { background-color: var(--color-priority-high); }
.priority-dot.medium { background-color: var(--color-priority-medium); }
.priority-dot.low { background-color: var(--color-priority-low); }

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
</style>
