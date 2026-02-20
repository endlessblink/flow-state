
<template>
  <Teleport to="body">
    <div
      v-if="isVisible && parentVisible"
      class="submenu"
      :style="style"
      @mouseenter="$emit('mouseenter')"
      @mouseleave="$emit('mouseleave')"
    >
      <!-- Done for now - reschedule to tomorrow -->
      <button class="menu-item menu-item--sm" @click.stop="$emit('doneForNow')">
        <Clock :size="14" class="menu-icon" />
        <span class="menu-text">Done for now</span>
      </button>

      <button class="menu-item menu-item--sm" @click.stop="$emit('duplicate')">
        <Copy :size="14" class="menu-icon" />
        <span class="menu-text">Duplicate</span>
      </button>

      <button class="menu-item menu-item--sm" @click.stop="$emit('pinQuickTask')">
        <Pin :size="14" class="menu-icon" />
        <span class="menu-text">Pin as Quick Task</span>
      </button>

      <button
        v-if="!isBatchOperation && taskId"
        class="menu-item menu-item--sm"
        @click.stop="$emit('moveToSection', taskId)"
      >
        <Layout :size="14" class="menu-icon" />
        <span class="menu-text">Move to Section</span>
      </button>

      <button v-if="isBatchOperation" class="menu-item menu-item--sm" @click.stop="$emit('clearSelection')">
        <X :size="14" class="menu-icon" />
        <span class="menu-text">Clear Selection</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { Copy, Layout, X, Clock, Pin } from 'lucide-vue-next'
import type { CSSProperties } from 'vue'

defineProps<{
  isVisible: boolean
  parentVisible?: boolean // BUG-1095: Track parent menu visibility
  style: CSSProperties
  isBatchOperation: boolean
  taskId?: string
}>()

defineEmits<{
  doneForNow: []
  duplicate: []
  pinQuickTask: []
  moveToSection: [taskId: string]
  clearSelection: []
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
.menu-icon { flex-shrink: 0; opacity: 0.8; }
</style>
