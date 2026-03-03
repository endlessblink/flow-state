
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

      <div class="submenu-divider" />

      <div
        v-if="!isBatchOperation"
        class="menu-item menu-item--sm has-submenu"
        @mouseenter.stop="$emit('openCanvasGroup', $event)"
        @mouseleave.stop="$emit('closeCanvasGroup')"
      >
        <LayoutGrid :size="14" class="menu-icon" />
        <span class="menu-text">Canvas Group</span>
        <ChevronRight :size="12" class="submenu-arrow" />
      </div>

      <div
        class="menu-item menu-item--sm has-submenu"
        @mouseenter.stop="$emit('openDuration', $event)"
        @mouseleave.stop="$emit('closeDuration')"
      >
        <Timer :size="14" class="menu-icon" />
        <span class="menu-text">Duration</span>
        <ChevronRight :size="12" class="submenu-arrow" />
      </div>

      <button v-if="!isBatchOperation" class="menu-item menu-item--sm" @click.stop="$emit('focusMode')">
        <Eye :size="14" class="menu-icon" />
        <span class="menu-text">Focus Mode</span>
      </button>

      <button v-if="!isBatchOperation" class="menu-item menu-item--sm" @click.stop="$emit('startNow')">
        <Play :size="14" class="menu-icon" />
        <span class="menu-text">Start Now</span>
      </button>

      <div class="submenu-divider" />

      <button v-if="!isBatchOperation" class="menu-item menu-item--sm menu-item--danger" @click.stop="$emit('permanentDelete')">
        <Trash2 :size="14" class="menu-icon" />
        <span class="menu-text">Permanently Delete</span>
      </button>

      <button v-if="isBatchOperation" class="menu-item menu-item--sm" @click.stop="$emit('clearSelection')">
        <X :size="14" class="menu-icon" />
        <span class="menu-text">Clear Selection</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { Copy, Layout, X, Clock, Pin, LayoutGrid, ChevronRight, Eye, Play, Trash2, Timer } from 'lucide-vue-next'
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
  openCanvasGroup: [event: MouseEvent]
  closeCanvasGroup: []
  openDuration: [event: MouseEvent]
  closeDuration: []
  focusMode: []
  startNow: []
  permanentDelete: []
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
  max-height: calc(100vh - 16px);
  overflow-y: auto;
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
.menu-icon { flex-shrink: 0; opacity: 0.8; }

.has-submenu { position: relative; }
.submenu-arrow { color: var(--text-muted); margin-inline-start: auto; }
.submenu-divider { height: 1px; background: var(--glass-bg-heavy); margin: var(--space-1) 0; }
.menu-item--danger { color: var(--danger-text); }
.menu-item--danger:hover { background: var(--danger-bg-subtle); }
</style>
