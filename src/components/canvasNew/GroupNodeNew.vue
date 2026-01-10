<!--
  GroupNodeNew.vue - Clean group/section node component

  TASK-184: Canvas System Rebuild - Phase 2

  Features:
  - Displays group with header and resize handles
  - Handles collapse/expand
  - Shows task count
  - Supports drag-to-resize (Phase 6)

  Target: ~250 lines
-->
<template>
  <div
    class="group-node"
    :class="{
      'group-node--collapsed': data.isCollapsed,
      'group-node--selected': selected
    }"
    :style="groupStyle"
  >
    <!-- Header -->
    <div class="group-header" :style="headerStyle">
      <div class="group-header__left">
        <button
          class="collapse-btn"
          @click.stop="toggleCollapse"
          :title="data.isCollapsed ? 'Expand' : 'Collapse'"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            :class="{ 'rotate-180': data.isCollapsed }"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <span class="group-name">{{ data.name }}</span>
      </div>
      <div class="group-header__right">
        <span class="task-count" :title="`${taskCount} tasks`">
          {{ taskCount }}
        </span>
      </div>
    </div>

    <!-- Content area (children render here via Vue Flow) -->
    <div v-if="!data.isCollapsed" class="group-content">
      <!-- Vue Flow renders child nodes here automatically -->
    </div>

    <!-- Resize handles (Phase 6) -->
    <div v-if="!data.isCollapsed" class="resize-handle resize-handle--se" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { NodeProps } from '@vue-flow/core'
import type { CanvasGroupNew } from '@/stores/canvasNew'

interface GroupNodeData extends CanvasGroupNew {
  taskCount?: number
}

const props = defineProps<NodeProps<GroupNodeData>>()

// Computed
const taskCount = computed(() => props.data?.taskCount ?? 0)

const groupStyle = computed(() => ({
  width: `${props.data?.dimensions?.width ?? 300}px`,
  height: props.data?.isCollapsed
    ? '48px'
    : `${props.data?.dimensions?.height ?? 200}px`,
  '--group-color': props.data?.color ?? '#6366f1',
  // Set depth for z-index CSS variable (used by parent wrapper)
  '--group-depth': props.data?.depth ?? 0
}))

const headerStyle = computed(() => ({
  backgroundColor: props.data?.color ?? '#6366f1'
}))

// Methods
function toggleCollapse() {
  // Emit to parent to handle collapse state change
  // This will be wired up in Phase 6 for full interaction
  console.log('[GroupNodeNew] Toggle collapse:', props.id)
}
</script>

<style scoped>
.group-node {
  background: var(--color-surface, #252538);
  border: 2px solid var(--group-color, #6366f1);
  border-radius: 12px;
  overflow: hidden;
  transition: box-shadow 0.2s ease;
  display: flex;
  flex-direction: column;
}

.group-node--selected {
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.4);
}

.group-node--collapsed {
  height: 48px !important;
}

/* Header */
.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  color: white;
  font-weight: 600;
  font-size: 14px;
  cursor: grab;
  user-select: none;
  min-height: 32px;
}

.group-header__left {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.group-header__right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.group-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  transition: background 0.2s ease;
  flex-shrink: 0;
}

.collapse-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.collapse-btn svg {
  transition: transform 0.2s ease;
}

.collapse-btn svg.rotate-180 {
  transform: rotate(180deg);
}

.task-count {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

/* Content */
.group-content {
  flex: 1;
  padding: 12px;
  min-height: 100px;
  background: rgba(0, 0, 0, 0.1);
}

/* Resize handles */
.resize-handle {
  position: absolute;
  background: transparent;
}

.resize-handle--se {
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: se-resize;
  background: linear-gradient(
    135deg,
    transparent 50%,
    var(--group-color, #6366f1) 50%
  );
  border-radius: 0 0 10px 0;
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.resize-handle--se:hover {
  opacity: 1;
}
</style>
