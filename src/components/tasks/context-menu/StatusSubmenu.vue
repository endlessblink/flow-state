
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
        v-for="status in statusOptions"
        :key="status.value"
        class="menu-item menu-item--sm"
        :class="{ active: currentStatus === status.value }"
        @click.stop="$emit('select', status.value)"
      >
        <component
          :is="status.icon"
          :size="14"
          class="status-icon"
          :class="[status.value]"
        />
        <span class="menu-text">{{ status.label }}</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { statusOptions } from './constants'
import type { CSSProperties } from 'vue'

defineProps<{
  isVisible: boolean
  parentVisible?: boolean // BUG-1095: Track parent menu visibility
  style: CSSProperties
  currentStatus?: string
}>()

defineEmits<{
  select: [status: string]
  mouseenter: []
  mouseleave: []
}>()
</script>

<style scoped>
/* Styles copied from TaskContextMenu.vue */
.submenu {
  position: fixed;
  background: var(--overlay-component-bg);
  backdrop-filter: var(--overlay-component-backdrop);
  border: var(--overlay-component-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--overlay-component-shadow);
  padding: var(--space-1) 0;
  min-width: 130px;
  z-index: calc(var(--z-dropdown) + 1);
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

.status-icon { flex-shrink: 0; }
.status-icon.planned { color: var(--color-info); }
.status-icon.in_progress { color: var(--color-break); }
.status-icon.done { color: var(--color-work); }
.status-icon.backlog { color: var(--text-muted); }
.status-icon.on_hold { color: var(--color-danger); }
</style>
