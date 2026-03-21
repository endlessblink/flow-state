
<template>
  <Teleport to="body">
    <!-- TASK-1445: Outer wrapper has no overflow so ::before bridge isn't clipped -->
    <div
      v-if="isVisible && parentVisible"
      class="submenu"
      :style="style"
      @mouseenter="$emit('mouseenter')"
      @mouseleave="$emit('mouseleave')"
      @wheel.stop
    >
      <div class="submenu-scroll">
        <!-- Done for now - shows for ALL tasks, opens submenu -->
        <div
          class="menu-item menu-item--sm has-submenu"
          @mouseenter.stop="$emit('openDoneForNow', $event)"
          @mouseleave.stop="$emit('closeDoneForNow')"
        >
          <Clock :size="14" class="menu-icon" />
          <span class="menu-text">Done for now</span>
          <ChevronRight :size="12" class="submenu-arrow" />
        </div>

        <!-- Done fully (stop recurring) - recurring tasks only -->
        <button v-if="isRecurring" class="menu-item menu-item--sm" @click.stop="$emit('doneFully')">
          <CheckCircle :size="14" class="menu-icon" />
          <span class="menu-text">Done fully (stop recurring)</span>
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

        <!-- AI Assist (TASK-1485: moved from main menu) -->
        <button v-if="!isBatchOperation" class="menu-item menu-item--sm menu-item--ai" @click.stop="$emit('aiAssist', $event)">
          <Sparkles :size="14" class="menu-icon menu-icon--ai" />
          <span class="menu-text">AI Assist</span>
        </button>

        <div v-if="!isBatchOperation" class="submenu-divider" />

        <button v-if="isBatchOperation" class="menu-item menu-item--sm" @click.stop="$emit('clearSelection')">
          <X :size="14" class="menu-icon" />
          <span class="menu-text">Clear Selection</span>
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { Copy, Layout, X, Clock, Pin, LayoutGrid, ChevronRight, Eye, Play, Timer, Sparkles, CheckCircle } from 'lucide-vue-next'
import type { CSSProperties } from 'vue'

defineProps<{
  isVisible: boolean
  parentVisible?: boolean // BUG-1095: Track parent menu visibility
  style: CSSProperties
  isBatchOperation: boolean
  taskId?: string
  isRecurring?: boolean
}>()

defineEmits<{
  openDoneForNow: [event: MouseEvent]
  closeDoneForNow: []
  doneFully: []
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
  aiAssist: [event: MouseEvent]
}>()
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
.menu-icon { flex-shrink: 0; opacity: 0.8; }

.has-submenu { position: relative; }

.submenu-arrow { color: var(--text-muted); margin-inline-start: auto; }
.submenu-divider { height: 1px; background: var(--glass-bg-heavy); margin: var(--space-1) 0; }
.menu-item--danger { color: var(--danger-text); }
.menu-item--danger:hover { background: var(--danger-bg-subtle); }

/* AI Assist (TASK-1485) */
.menu-item--ai { color: var(--brand-primary); }
.menu-item--ai:hover { background: var(--brand-bg-subtle); }
.menu-icon--ai { color: var(--brand-primary); opacity: 1; }
</style>
