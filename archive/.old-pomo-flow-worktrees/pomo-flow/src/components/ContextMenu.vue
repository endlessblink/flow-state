<template>
  <Teleport to="body">
    <div
      v-if="isVisible"
      class="context-menu-overlay"
      @click="close"
      @contextmenu.prevent
    >
      <div
        ref="menuRef"
        class="context-menu"
        :style="menuStyle"
        @click.stop
      >
        <button
          v-for="item in menuItems"
          :key="item.id"
          class="context-menu-item"
          :class="{ danger: item.danger, disabled: item.disabled }"
          @click="handleItemClick(item)"
          :disabled="item.disabled"
        >
          <component
            v-if="item.icon"
            :is="item.icon"
            :size="16"
            :stroke-width="1.5"
            class="menu-icon"
          />
          <span class="menu-text">{{ item.label }}</span>
          <span v-if="item.shortcut" class="menu-shortcut">{{ item.shortcut }}</span>
        </button>

        <div v-if="hasSeparator" class="context-menu-separator" />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { Component } from 'vue'

export interface ContextMenuItem {
  id: string
  label: string
  icon?: Component
  shortcut?: string
  action: () => void
  danger?: boolean
  disabled?: boolean
  separator?: boolean
}

interface Props {
  isVisible: boolean
  x: number
  y: number
  items: ContextMenuItem[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

const menuRef = ref<HTMLElement>()

const menuItems = computed(() => props.items.filter(item => !item.separator))
const hasSeparator = computed(() => props.items.some(item => item.separator))

const menuStyle = ref({
  left: '0px',
  top: '0px'
})

const calculatePosition = () => {
  if (!menuRef.value) return

  const menu = menuRef.value
  const menuRect = menu.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  let x = props.x
  let y = props.y

  // Adjust horizontal position if menu would overflow
  if (x + menuRect.width > viewportWidth) {
    x = viewportWidth - menuRect.width - 16
  }

  // Adjust vertical position if menu would overflow
  if (y + menuRect.height > viewportHeight) {
    y = viewportHeight - menuRect.height - 16
  }

  // Ensure minimum padding from edges
  x = Math.max(16, x)
  y = Math.max(16, y)

  menuStyle.value = {
    left: `${x}px`,
    top: `${y}px`
  }
}

const handleItemClick = (item: ContextMenuItem) => {
  if (item.disabled) return
  item.action()
  close()
}

const close = () => {
  emit('close')
}

const handleEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isVisible) {
    close()
  }
}

watch(() => props.isVisible, async (visible) => {
  if (visible) {
    await nextTick()
    calculatePosition()
  }
})

onMounted(() => {
  window.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscape)
})
</script>

<style scoped>
.context-menu-overlay {
  position: fixed;
  inset: 0; /* RTL: full screen overlay */
  z-index: 3000;
  /* Transparent overlay to capture clicks */
}

.context-menu {
  position: fixed;
  min-width: 200px;
  background: linear-gradient(
    135deg,
    var(--glass-bg-medium) 0%,
    var(--glass-bg-heavy) 100%
  );
  backdrop-filter: blur(32px) saturate(200%);
  border: 1px solid var(--glass-border-strong);
  border-radius: var(--radius-xl);
  box-shadow:
    0 16px 32px var(--shadow-strong),
    0 8px 16px var(--shadow-md),
    inset 0 1px 0 var(--glass-border-soft);
  padding: var(--space-2);
  animation: menuSlideIn var(--duration-fast) var(--spring-bounce);
  z-index: 3001;
}

@keyframes menuSlideIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  text-align: left;
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.context-menu-item:hover:not(:disabled) {
  background: var(--glass-bg-soft);
  border-color: var(--glass-border);
  transform: translateX(2px);
}

.context-menu-item:active:not(:disabled) {
  transform: translateX(0) scale(0.98);
}

.context-menu-item.danger {
  color: var(--red-500);
}

.context-menu-item.danger:hover:not(:disabled) {
  background: var(--red-50);
  border-color: var(--red-200);
  color: var(--red-600);
}

.context-menu-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.menu-icon {
  flex-shrink: 0;
  color: currentColor;
}

.menu-text {
  flex: 1;
}

.menu-shortcut {
  flex-shrink: 0;
  font-size: var(--text-xs);
  color: var(--text-muted);
  padding: var(--space-1) var(--space-2);
  background: var(--glass-bg-soft);
  border-radius: var(--radius-sm);
}

.context-menu-separator {
  height: 1px;
  background: var(--glass-border);
  margin: var(--space-2) var(--space-2);
}
</style>
