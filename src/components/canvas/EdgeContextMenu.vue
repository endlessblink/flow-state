<template>
  <div
    v-if="isVisible"
    ref="menuRef"
    class="context-menu"
    :style="menuPosition"
  >
    <!-- Delete/Disconnect -->
    <button class="menu-item disconnect-item" @click="$emit('disconnect')">
      <Unlink :size="16" :stroke-width="1.5" class="menu-icon" />
      <span class="menu-text">{{ menuText }}</span>
      <span class="menu-shortcut">Del</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, type CSSProperties } from 'vue'
import { Unlink } from 'lucide-vue-next'

interface Props {
  isVisible: boolean
  x: number
  y: number
  menuText?: string
}

const props = withDefaults(defineProps<Props>(), {
  menuText: 'Disconnect'
})

const emit = defineEmits<{
  close: []
  disconnect: []
}>()

const menuRef = ref<HTMLElement | null>(null)

const menuPosition = computed((): CSSProperties => ({
  position: 'fixed' as const,
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
  /* Glass morphism styling - semi-transparent with blur */
  background: rgba(30, 30, 40, 0.65);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-xl);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.08) inset;
  padding: var(--space-2);
  min-width: 180px;
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
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-normal);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  text-align: left;
  min-height: 40px;
}

.menu-item:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: var(--color-danger);
}

.menu-icon {
  color: var(--text-muted);
  transition: color var(--duration-fast);
}

.menu-item:hover .menu-icon {
  color: var(--color-danger);
}

.menu-text {
  flex: 1;
}

.menu-shortcut {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: var(--space-1) var(--space-2);
  background: var(--glass-bg-light);
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
}
</style>
