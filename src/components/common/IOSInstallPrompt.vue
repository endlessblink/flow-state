<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Share, PlusSquare, X } from 'lucide-vue-next'
import { NButton, NCard, NText } from 'naive-ui'

const isIOS = ref(false)
const isStandalone = ref(false)
const showTooltip = ref(false)

onMounted(() => {
  // Check if iOS
  isIOS.value = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
  
  // Check if already installed
  isStandalone.value = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone
  
  // Show tooltip only for iOS users not in standalone mode
  if (isIOS.value && !isStandalone.value) {
    // Check if dismissed before
    const dismissed = localStorage.getItem('ios-install-prompt-dismissed')
    if (!dismissed) {
      showTooltip.value = true
    }
  }
})

const dismiss = () => {
  showTooltip.value = false
  localStorage.setItem('ios-install-prompt-dismissed', 'true')
}
</script>

<template>
  <Transition name="slide-up">
    <div v-if="showTooltip" class="ios-install-tooltip">
      <NCard class="tooltip-card" size="small" :bordered="false">
        <div class="tooltip-header">
          <NText strong>Install FlowState</NText>
          <NButton quaternary circle size="tiny" @click="dismiss">
            <template #icon><X :size="14" /></template>
          </NButton>
        </div>
        
        <div class="tooltip-body">
          <NText depth="3">To install FlowState on your iPhone:</NText>
          <div class="instruction-steps">
            <div class="step">
              <span class="step-icon"><Share :size="16" /></span>
              <span>Tap the <strong>Share</strong> button below</span>
            </div>
            <div class="step">
              <span class="step-icon"><PlusSquare :size="16" /></span>
              <span>Select <strong>Add to Home Screen</strong></span>
            </div>
          </div>
        </div>
      </NCard>
      <div class="tooltip-arrow"></div>
    </div>
  </Transition>
</template>

<style scoped>
.ios-install-tooltip {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10000;
  width: calc(100% - 32px);
  max-width: 300px;
}

.tooltip-card {
  background: var(--bg-secondary) !important;
  border: 1px solid var(--border-default) !important;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4) !important;
  border-radius: 16px !important;
}

.tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.tooltip-body {
  font-size: 13px;
  line-height: 1.4;
}

.instruction-steps {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.step {
  display: flex;
  align-items: center;
  gap: 10px;
}

.step-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--brand-primary);
}

.tooltip-arrow {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 16px;
  height: 16px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-default);
  border-bottom: 1px solid var(--border-default);
  rotate: 45deg;
}

/* Transitions */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translate(-50%, 40px) scale(0.9);
}
</style>
