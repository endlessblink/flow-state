
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
        v-for="dur in durationOptions"
        :key="dur.value ?? 'none'"
        class="menu-item menu-item--sm"
        :class="{ active: currentDuration === dur.value }"
        @click.stop="handleSelect(dur.value)"
      >
        <component
          :is="dur.icon"
          :size="14"
          class="duration-icon"
          :class="[dur.class]"
        />
        <span class="menu-text">{{ dur.label }}</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { durationOptions } from './constants'
import type { CSSProperties } from 'vue'

defineProps<{
  isVisible: boolean
  parentVisible?: boolean // BUG-1095: Track parent menu visibility
  style: CSSProperties
  currentDuration?: number | null
}>()

const emit = defineEmits<{
  select: [duration: number | null]
  mouseenter: []
  mouseleave: []
}>()

// BUG-1095: Handle selection with immediate emit
const handleSelect = (duration: number | null) => {
  emit('select', duration)
}
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
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  transition: background var(--duration-fast);
}

.menu-item:hover { background: var(--glass-bg-heavy); }
.menu-item.active { color: var(--brand-primary); }

.menu-text { flex: 1; }

.duration-icon { flex-shrink: 0; }
.duration-icon.quick { color: var(--green-text); }
.duration-icon.short { color: var(--color-work); }
.duration-icon.medium { color: var(--orange-text); }
.duration-icon.long { color: var(--danger-text); }
.duration-icon.none { color: var(--text-muted); }
</style>
