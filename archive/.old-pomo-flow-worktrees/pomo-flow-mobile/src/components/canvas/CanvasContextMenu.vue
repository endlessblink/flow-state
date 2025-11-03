<template>
  <div
    v-if="isVisible"
    ref="menuRef"
    class="context-menu"
    :style="menuPosition"
  >
    <!-- Center on Selected Tasks -->
    <button
      class="menu-item"
      @click="$emit('centerOnSelected')"
      :disabled="!hasSelectedTasks"
    >
      <Crosshair :size="16" :stroke-width="1.5" class="menu-icon" />
      <span class="menu-text">Center on Selected</span>
      <span class="menu-shortcut">C</span>
    </button>

    <!-- Fit All Tasks to View -->
    <button class="menu-item" @click="$emit('fitAll')">
      <Maximize2 :size="16" :stroke-width="1.5" class="menu-icon" />
      <span class="menu-text">Fit All Tasks</span>
      <span class="menu-shortcut">F</span>
    </button>

    <div class="menu-divider"></div>

    <!-- Reset Zoom -->
    <button class="menu-item" @click="$emit('resetZoom')">
      <ZoomIn :size="16" :stroke-width="1.5" class="menu-icon" />
      <span class="menu-text">Reset Zoom</span>
      <span class="menu-shortcut">0</span>
    </button>

    <div class="menu-divider"></div>

    <!-- Select All Tasks -->
    <button class="menu-item" @click="$emit('selectAll')">
      <CheckSquare :size="16" :stroke-width="1.5" class="menu-icon" />
      <span class="menu-text">Select All Tasks</span>
      <span class="menu-shortcut">Ctrl+A</span>
    </button>

    <!-- Clear Selection -->
    <button
      class="menu-item"
      @click="$emit('clearSelection')"
      :disabled="!hasSelectedTasks"
    >
      <Square :size="16" :stroke-width="1.5" class="menu-icon" />
      <span class="menu-text">Clear Selection</span>
      <span class="menu-shortcut">Esc</span>
    </button>

    <div class="menu-divider"></div>

    <!-- Alignment Section -->
    <div class="menu-section-header" :class="{ disabled: selectedCount < 2 }">
      <AlignLeft :size="14" :stroke-width="1.5" />
      <span>Alignment</span>
      <span class="requirement-badge" v-if="selectedCount < 2">2+ tasks</span>
    </div>

    <button
      class="menu-item"
      @click="$emit('alignLeft')"
      :disabled="selectedCount < 2"
    >
      <AlignHorizontalJustifyStart :size="16" :stroke-width="1.5" class="menu-icon" />
      <span class="menu-text">Align Left</span>
    </button>

    <button
      class="menu-item"
      @click="$emit('alignRight')"
      :disabled="selectedCount < 2"
    >
      <AlignHorizontalJustifyEnd :size="16" :stroke-width="1.5" class="menu-icon" />
      <span class="menu-text">Align Right</span>
    </button>

    <button
      class="menu-item"
      @click="$emit('alignTop')"
      :disabled="selectedCount < 2"
    >
      <AlignVerticalJustifyStart :size="16" :stroke-width="1.5" class="menu-icon" />
      <span class="menu-text">Align Top</span>
    </button>

    <button
      class="menu-item"
      @click="$emit('alignBottom')"
      :disabled="selectedCount < 2"
    >
      <AlignVerticalJustifyEnd :size="16" :stroke-width="1.5" class="menu-icon" />
      <span class="menu-text">Align Bottom</span>
    </button>

    <button
      class="menu-item"
      @click="$emit('alignCenterHorizontal')"
      :disabled="selectedCount < 2"
    >
      <AlignHorizontalJustifyCenter :size="16" :stroke-width="1.5" class="menu-icon" />
      <span class="menu-text">Align Center (H)</span>
    </button>

    <button
      class="menu-item"
      @click="$emit('alignCenterVertical')"
      :disabled="selectedCount < 2"
    >
      <AlignVerticalJustifyCenter :size="16" :stroke-width="1.5" class="menu-icon" />
      <span class="menu-text">Align Center (V)</span>
    </button>

    <div class="menu-divider"></div>

    <!-- Distribution Section -->
    <div class="menu-section-header" :class="{ disabled: selectedCount < 3 }">
      <Columns :size="14" :stroke-width="1.5" />
      <span>Distribution</span>
      <span class="requirement-badge" v-if="selectedCount < 3">3+ tasks</span>
    </div>

    <button
      class="menu-item"
      @click="$emit('distributeHorizontal')"
      :disabled="selectedCount < 3"
    >
      <ArrowLeftRight :size="16" :stroke-width="1.5" class="menu-icon" />
      <span class="menu-text">Distribute Horizontally</span>
    </button>

    <button
      class="menu-item"
      @click="$emit('distributeVertical')"
      :disabled="selectedCount < 3"
    >
      <ArrowUpDown :size="16" :stroke-width="1.5" class="menu-icon" />
      <span class="menu-text">Distribute Vertically</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import {
  Crosshair, Maximize2, ZoomIn, CheckSquare, Square,
  AlignLeft, AlignHorizontalJustifyStart, AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyCenter, AlignVerticalJustifyStart,
  AlignVerticalJustifyEnd, AlignVerticalJustifyCenter,
  Columns, ArrowLeftRight, ArrowUpDown
} from 'lucide-vue-next'

interface Props {
  isVisible: boolean
  x: number
  y: number
  hasSelectedTasks?: boolean
  selectedCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  hasSelectedTasks: false,
  selectedCount: 0
})

const emit = defineEmits<{
  close: []
  centerOnSelected: []
  fitAll: []
  resetZoom: []
  selectAll: []
  clearSelection: []
  alignLeft: []
  alignRight: []
  alignTop: []
  alignBottom: []
  alignCenterHorizontal: []
  alignCenterVertical: []
  distributeHorizontal: []
  distributeVertical: []
}>()

const menuRef = ref<HTMLElement | null>(null)

const menuPosition = computed(() => ({
  position: 'fixed',
  left: `${props.x}px`,
  top: `${props.y}px`,
  zIndex: 9999
}))

// Close menu on click outside
const handleClickOutside = (event: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    emit('close')
  }
}

// Close menu on Escape key
const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    emit('close')
  }
}

watch(() => props.isVisible, (visible) => {
  if (visible) {
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
  } else {
    document.removeEventListener('click', handleClickOutside)
    document.removeEventListener('keydown', handleEscape)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleEscape)
})
</script>

<style scoped>
.context-menu {
  background: linear-gradient(
    135deg,
    var(--surface-primary) 0%,
    var(--surface-secondary) 100%
  );
  backdrop-filter: blur(32px) saturate(150%);
  -webkit-backdrop-filter: blur(32px) saturate(150%);
  border: 1px solid var(--glass-bg-medium);
  border-radius: var(--radius-xl);
  box-shadow:
    0 24px 48px var(--shadow-xl),
    0 12px 24px var(--shadow-xl),
    0 0 0 1px var(--glass-bg-medium),
    inset 0 1px 0 var(--glass-border);
  padding: var(--space-2);
  min-width: 220px;
  animation: menuSlideIn 150ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes menuSlideIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  text-align: left;
}

.menu-item:hover:not(:disabled) {
  background: linear-gradient(
    135deg,
    var(--purple-bg-subtle) 0%,
    var(--purple-bg-end) 100%
  );
  color: var(--brand-primary);
  transform: translateX(2px);
}

.menu-item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.menu-icon {
  color: var(--text-muted);
  transition: color var(--duration-fast);
}

.menu-item:hover:not(:disabled) .menu-icon {
  color: var(--brand-primary);
}

.menu-text {
  flex: 1;
}

.menu-shortcut {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: var(--space-1) var(--space-2);
  background: var(--glass-bg-tint);
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-bg-heavy);
}

.menu-divider {
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--glass-border) 50%,
    transparent 100%
  );
  margin: var(--space-2) var(--space-3);
}

.menu-section-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: var(--space-2);
}

.menu-section-header.disabled {
  opacity: 0.5;
}

.requirement-badge {
  margin-left: auto;
  padding: var(--space-1) var(--space-2);
  background: var(--glass-bg-soft);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--text-muted);
}
</style>
