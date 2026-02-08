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
      <div v-if="timerStore.isTimerActive" class="focus-mode-indicator">
        <Smartphone :size="16" />
        <span>Screen Awake</span>
      </div>
    </div>

    <!-- Active Task Info -->
    <div v-if="timerStore.currentTaskName" class="current-task">
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

const toggleTimer = async () => {
    // BUG-1051: AWAIT for timer sync
    if (timerStore.isTimerActive && !timerStore.isPaused) {
        await timerStore.pauseTimer()
    } else if (timerStore.isPaused) {
        timerStore.resumeTimer()
    } else {
        // Start a general focus session if nothing is running
        await timerStore.startTimer('general')
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
  padding: var(--space-5);
  padding-bottom: 100px; /* Space for nav */
  background: var(--app-background-gradient);
}

.timer-display-container {
  margin-bottom: var(--space-10);
  position: relative;
}

.timer-circle {
  width: 280px;
  height: 280px;
  border-radius: var(--radius-full);
  border: var(--space-1) solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--surface-secondary);
  box-shadow: var(--shadow-xl);
  transition: all var(--duration-slow) var(--spring-smooth);
  position: relative;
  overflow: hidden;
}

.timer-circle.is-active {
  border-color: var(--brand-primary);
  box-shadow: var(--timer-active-shadow-hover);
}

.timer-circle.is-break {
  border-color: var(--success-border);
  box-shadow: var(--success-glow);
}

.time-display {
  font-size: var(--text-4xl);
  font-weight: var(--font-bold);
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
  z-index: 2;
}

.status-label {
  font-size: var(--text-base);
  color: var(--text-tertiary);
  margin-top: var(--space-2);
  z-index: 2;
}

.timer-controls-overlay {
  position: absolute;
  inset: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--duration-normal);
  z-index: 3;
}

.timer-circle:active .timer-controls-overlay {
  opacity: 1;
}

.timer-actions {
  display: flex;
  gap: var(--space-5);
  align-items: center;
  margin-bottom: var(--space-8);
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
}

.action-btn.stop {
  color: var(--danger-text);
}

.focus-mode-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  font-size: var(--text-xs);
  color: var(--brand-primary);
  background: var(--brand-bg-subtle);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-xl);
}

.current-task {
  text-align: center;
  background: var(--surface-primary);
  padding: var(--space-4) var(--space-6);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 320px;
}

.current-task h3 {
  font-size: var(--text-xs);
  text-transform: uppercase;
  color: var(--text-tertiary);
  margin: 0 0 var(--space-2) 0;
  letter-spacing: 0.05em;
}

.current-task p {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}
</style>
