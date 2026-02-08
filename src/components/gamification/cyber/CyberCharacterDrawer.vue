<script setup lang="ts">
/**
 * CyberCharacterDrawer - Slide-out Character Profile Panel
 * FEATURE-1118 Cyberflow RPG Hub
 *
 * Right-side drawer overlay that contains the full CyberCharacterProfile.
 * Slides in from right with backdrop, close on backdrop click or Escape key.
 */
import { onMounted, onUnmounted } from 'vue'
import { X } from 'lucide-vue-next'
import CyberCharacterProfile from './CyberCharacterProfile.vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

// Keyboard escape handler
function handleKeydown(e: KeyboardEvent) {
  if (props.open && e.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

// Close on backdrop click
function handleBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    emit('close')
  }
}
</script>

<template>
  <Transition name="drawer">
    <div
      v-if="open"
      class="drawer-overlay"
      @click="handleBackdropClick"
    >
      <div
        class="drawer-panel"
        data-augmented-ui="tl-clip bl-clip border"
      >
        <!-- Header -->
        <div class="drawer-header">
          <h2 class="drawer-title">OPERATIVE PROFILE</h2>
          <button
            class="drawer-close"
            aria-label="Close"
            @click="emit('close')"
          >
            <X :size="20" />
          </button>
        </div>

        <!-- Body: Scrollable Profile Content -->
        <div class="drawer-body">
          <CyberCharacterProfile />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--overlay-backdrop);
  backdrop-filter: blur(var(--space-1));
  z-index: var(--z-modal, 1300);
  display: flex;
  justify-content: flex-end;
  align-items: stretch;
}

/* Drawer Panel */
.drawer-panel {
  width: 380px;
  max-width: 90vw;
  height: 100%;
  background: var(--cf-dark-1);
  display: flex;
  flex-direction: column;
  overflow: hidden;

  /* augmented-ui frame on left edge */
  --aug-border-all: 2px;
  --aug-border-bg: linear-gradient(180deg, var(--cf-cyan), var(--cf-magenta));
  --aug-tl1: var(--space-6);
  --aug-bl1: var(--space-6);
  box-shadow: calc(var(--space-1) * -1) 0 var(--space-6) rgba(var(--color-slate-900), 0.5);
}

/* Header */
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  background: var(--cf-dark-2);
  border-bottom: 1px solid var(--cf-cyan-20);
  flex-shrink: 0;
}

.drawer-title {
  font-family: var(--font-cyber-title);
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--cf-cyan);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin: 0;
  text-shadow: 0 0 8px rgba(0, 240, 255, 0.4);
}

.drawer-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--space-8);
  height: var(--space-8);
  background: transparent;
  border: 1px solid var(--cf-cyan-20);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.drawer-close:hover {
  background: var(--cf-cyan-20);
  border-color: var(--cf-cyan-50);
  color: var(--cf-cyan);
  box-shadow: 0 0 8px rgba(0, 240, 255, 0.3);
}

/* Body: Scrollable */
.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
  scrollbar-width: thin;
  scrollbar-color: var(--cf-cyan-20) transparent;
}

.drawer-body::-webkit-scrollbar {
  width: var(--space-2);
}

.drawer-body::-webkit-scrollbar-track {
  background: transparent;
}

.drawer-body::-webkit-scrollbar-thumb {
  background: var(--cf-cyan-20);
  border-radius: var(--radius-sm);
}

.drawer-body::-webkit-scrollbar-thumb:hover {
  background: var(--cf-cyan-50);
}

/* ===================================================================
   TRANSITIONS
   =================================================================== */

.drawer-enter-active {
  transition: opacity 0.3s ease;
}

.drawer-leave-active {
  transition: opacity 0.3s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-active .drawer-panel {
  transition: transform 0.3s ease;
}

.drawer-leave-active .drawer-panel {
  transition: transform 0.3s ease;
}

.drawer-enter-from .drawer-panel,
.drawer-leave-to .drawer-panel {
  transform: translateX(100%);
}

/* ===================================================================
   ACCESSIBILITY - Reduced Motion
   =================================================================== */

@media (prefers-reduced-motion: reduce) {
  .drawer-enter-active,
  .drawer-leave-active {
    transition: none;
  }

  .drawer-enter-active .drawer-panel,
  .drawer-leave-active .drawer-panel {
    transition: none;
  }

  .drawer-close {
    transition: none;
  }
}
</style>
