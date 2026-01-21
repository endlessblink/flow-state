<template>
  <div class="mobile-timer-view">
    <div class="timer-display-container">
      <div 
        class="timer-circle" 
        :class="{ 
          'is-active': timerStore.isTimerActive,
          'is-break': currentSession?.isBreak
        }"
        @click="toggleTimer"
      >
        <span class="time-display">{{ timerStore.displayTime }}</span>
        <span class="status-label">{{ timerStore.sessionStatusText || 'Ready' }}</span>
        
        <div class="timer-controls-overlay">
          <Play v-if="!timerStore.isTimerActive || timerStore.isPaused" :size="48" fill="currentColor" />
          <Pause v-else :size="48" fill="currentColor" />
        </div>
      </div>
    </div>

    <div class="timer-actions">
        <!-- Stop Button -->
        <button 
          v-if="timerStore.isTimerActive" 
          class="action-btn stop" 
          @click="timerStore.stopTimer"
        >
          <Square :size="24" fill="currentColor" />
          <span>Stop</span>
        </button>

        <!-- Focus Mode Toggle (Keep Screen On) -->
        <div class="focus-mode-indicator" v-if="timerStore.isTimerActive">
           <Smartphone :size="16" />
           <span>Screen Awake</span>
        </div>
    </div>

    <!-- Active Task Info -->
    <div class="current-task" v-if="timerStore.currentTaskName">
        <h3>Current Focus</h3>
        <p>{{ timerStore.currentTaskName }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTimerStore } from '@/stores/timer'
import { Play, Pause, Square, Smartphone } from 'lucide-vue-next'

const timerStore = useTimerStore()
const currentSession = computed(() => timerStore.currentSession)

const toggleTimer = () => {
    if (timerStore.isTimerActive && !timerStore.isPaused) {
        timerStore.pauseTimer()
    } else if (timerStore.isPaused) {
        timerStore.resumeTimer()
    } else {
        // Start a general focus session if nothing is running
        timerStore.startTimer('general')
    }
}
</script>

<style scoped>
.mobile-timer-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  padding: 20px;
  padding-bottom: 100px; /* Space for nav */
  background: var(--app-background-gradient);
}

.timer-display-container {
  margin-bottom: 40px;
  position: relative;
}

.timer-circle {
  width: 280px;
  height: 280px;
  border-radius: 50%;
  border: 4px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--surface-secondary);
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.timer-circle.is-active {
  border-color: var(--primary-brand);
  box-shadow: 0 0 40px rgba(var(--primary-brand-rgb), 0.3);
}

.timer-circle.is-break {
  border-color: var(--success-border);
  box-shadow: 0 0 40px rgba(var(--success-rgb), 0.3);
}

.time-display {
  font-size: 4rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
  z-index: 2;
}

.status-label {
  font-size: 1rem;
  color: var(--text-tertiary);
  margin-top: 8px;
  z-index: 2;
}

.timer-controls-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 3;
}

.timer-circle:active .timer-controls-overlay {
  opacity: 1;
}

.timer-actions {
  display: flex;
  gap: 20px;
  align-items: center;
  margin-bottom: 30px;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
}

.action-btn.stop {
  color: var(--danger-text);
}

.focus-mode-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--primary-brand);
  background: var(--primary-brand-bg-subtle);
  padding: 8px 12px;
  border-radius: 20px;
}

.current-task {
  text-align: center;
  background: var(--surface-primary);
  padding: 16px 24px;
  border-radius: 16px;
  width: 100%;
  max-width: 320px;
}

.current-task h3 {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-tertiary);
  margin: 0 0 8px 0;
  letter-spacing: 0.05em;
}

.current-task p {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 500;
  color: var(--text-primary);
}
</style>
