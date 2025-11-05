<template>
  <!-- PROJECT TITLE AND TIMER -->
  <div class="header-section" data-testid="app-header" @keydown="handleTimerKeydown" tabindex="0">
    <!-- USER PROFILE (Left side) -->
    <div class="user-profile-container" data-testid="user-profile-container">
      <UserProfile v-if="isAuthenticated" data-testid="user-profile" />
    </div>

    <h1 class="project-title" data-testid="project-title">{{ pageTitle }}</h1>

    <!-- INTEGRATED CONTROL PANEL: Clock + Timer -->
    <div class="control-panel" data-testid="control-panel">
      <!-- TIME DISPLAY - ADHD Feature #4 -->
      <div class="time-display-container" data-testid="time-display-container">
        <TimeDisplay data-testid="time-display" />
      </div>

      <!-- POMODORO TIMER DISPLAY -->
      <div class="timer-container" data-testid="timer-container">
        <div class="timer-display" :class="timerClasses" data-testid="timer-display">
          <div class="timer-icon" data-testid="timer-icon">
            <!-- Animated emoticons when timer is active -->
            <span v-if="timerIcon" class="timer-emoticon active">{{ timerIcon }}</span>
            <!-- Static icons when timer is inactive -->
            <Timer v-else :size="20" :stroke-width="1.5" class="timer-stroke" />
          </div>
          <div class="timer-info">
            <div class="timer-time" data-testid="timer-time">{{ timerDisplayTime }}</div>
            <!-- Always render task name div to prevent layout shift -->
            <div class="timer-task" data-testid="timer-task">{{ currentTaskName }}</div>
          </div>
          <div class="timer-controls">
            <div v-if="!currentSession" class="timer-start-options">
              <button
                class="timer-btn timer-start"
                data-testid="timer-start-btn"
                @click="startQuickTimer"
                title="Start 25-min work timer"
              >
                <Play :size="16" />
              </button>
              <button
                class="timer-btn timer-break"
                data-testid="timer-short-break-btn"
                @click="startShortBreak"
                title="Start 5-min break"
              >
                <Coffee :size="16" :stroke-width="1.5" class="coffee-stroke" />
              </button>
              <button
                class="timer-btn timer-break"
                data-testid="timer-long-break-btn"
                @click="startLongBreak"
                title="Start 15-min long break"
              >
                <User :size="16" :stroke-width="1.5" class="meditation-stroke" />
              </button>
            </div>

            <button
              v-else-if="isTimerPaused"
              class="timer-btn timer-resume"
              data-testid="timer-resume-btn"
              @click="resumeTimer"
              title="Resume timer"
            >
              <Play :size="16" />
            </button>

            <button
              v-else-if="isTimerActive"
              class="timer-btn timer-pause"
              data-testid="timer-pause-btn"
              @click="pauseTimer"
              title="Pause timer"
            >
              <Pause :size="16" />
            </button>

            <button
              v-if="currentSession"
              class="timer-btn timer-stop"
              data-testid="timer-stop-btn"
              @click="stopTimer"
              title="Stop timer"
            >
              <Square :size="16" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppHeader } from '@/composables/app/useAppHeader'
import UserProfile from '@/components/auth/UserProfile.vue'
import TimeDisplay from '@/components/TimeDisplay.vue'
import {
  Timer, Play, Pause, Square, Coffee, User
} from 'lucide-vue-next'

/**
 * AppHeader Component
 *
 * Extracted header functionality from App.vue including:
 * - User profile integration
 * - Dynamic project title display
 * - Timer display and controls
 * - Time display integration
 * - Glass morphism styling
 *
 * This component handles all header-related UI and state management
 * through the useAppHeader composable.
 */

// Use the header composable for all state and logic
const {
  // State
  pageTitle,
  isAuthenticated,
  isTimerActive,
  isTimerPaused,
  isBreakSession,
  currentTaskName,
  timerDisplayTime,
  currentSession,
  timerIcon,
  timerClasses,

  // Timer Control Methods
  startQuickTimer,
  startShortBreak,
  startLongBreak,
  resumeTimer,
  pauseTimer,
  stopTimer,

  // Event Handlers
  handleTimerKeydown
} = useAppHeader()
</script>

<style scoped>
/* Header styles will be inherited from App.vue */
.header-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-8);
  padding: var(--space-6) 0;
  position: relative;
  z-index: 10;
}

.user-profile-container {
  flex-shrink: 0;
  margin-right: var(--space-6);
}

.project-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0;
  text-align: center;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.control-panel {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  flex-shrink: 0;
}

.time-display-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2) var(--space-3);
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.timer-container {
  display: flex;
  align-items: center;
}

.timer-display {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-md);
  transition: all var(--duration-normal) var(--spring-smooth);
  min-width: 280px;
  max-width: 320px;
}

.timer-display.timer-active {
  background: linear-gradient(
    135deg,
    var(--brand-primary-bg-subtle) 0%,
    var(--brand-primary-bg-medium) 100%
  );
  border-color: var(--brand-primary-border-medium);
  box-shadow: var(--brand-primary-glow-subtle), var(--shadow-lg);
}

.timer-display.timer-break {
  background: linear-gradient(
    135deg,
    var(--success-bg-subtle) 0%,
    var(--success-bg-medium) 100%
  );
  border-color: var(--success-border-medium);
  box-shadow: var(--success-glow-subtle), var(--shadow-lg);
}

.timer-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.timer-emoticon {
  font-size: var(--text-xl);
  transition: transform var(--duration-normal) var(--spring-bouncy);
}

.timer-emoticon.active {
  animation: bounce 2s infinite;
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-4px);
  }
  60% {
    transform: translateY(-2px);
  }
}

.timer-stroke {
  color: var(--text-muted);
  transition: color var(--duration-normal) var(--spring-smooth);
}

.timer-display.timer-active .timer-stroke {
  color: var(--brand-primary);
}

.timer-display.timer-break .timer-stroke {
  color: var(--success-primary);
}

.timer-info {
  flex: 1;
  min-width: 0;
}

.timer-time {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  font-family: var(--font-mono);
  letter-spacing: 0.05em;
  line-height: 1;
  margin-bottom: 2px;
}

.timer-task {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1;
  min-height: 14px;
}

.timer-controls {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
}

.timer-start-options {
  display: flex;
  gap: var(--space-1);
}

.timer-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  font-weight: var(--font-medium);
  font-size: var(--text-xs);
  position: relative;
  overflow: hidden;
}

.timer-btn:before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    transparent 0%,
    rgba(255, 255, 255, 0.1) 50%,
    transparent 100%
  );
  opacity: 0;
  transition: opacity var(--duration-fast) var(--spring-smooth);
}

.timer-btn:hover:before {
  opacity: 1;
}

.timer-btn.timer-start {
  background: linear-gradient(
    135deg,
    var(--brand-primary-bg-subtle) 0%,
    var(--brand-primary-bg-medium) 100%
  );
  color: var(--brand-primary);
  border: 1px solid var(--brand-primary-border-medium);
}

.timer-btn.timer-start:hover {
  background: linear-gradient(
    135deg,
    var(--brand-primary-bg-medium) 0%,
    var(--brand-primary-bg-heavy) 100%
  );
  transform: translateY(-1px);
  box-shadow: var(--brand-primary-glow-medium);
}

.timer-btn.timer-break {
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
}

.timer-btn.timer-break:hover {
  background: linear-gradient(
    135deg,
    var(--glass-bg-medium) 0%,
    var(--glass-bg-tint) 100%
  );
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.timer-btn.timer-resume {
  background: linear-gradient(
    135deg,
    var(--success-bg-subtle) 0%,
    var(--success-bg-medium) 100%
  );
  color: var(--success-primary);
  border: 1px solid var(--success-border-medium);
}

.timer-btn.timer-resume:hover {
  background: linear-gradient(
    135deg,
    var(--success-bg-medium) 0%,
    var(--success-bg-heavy) 100%
  );
  transform: translateY(-1px);
  box-shadow: var(--success-glow-medium);
}

.timer-btn.timer-pause {
  background: linear-gradient(
    135deg,
    var(--warning-bg-subtle) 0%,
    var(--warning-bg-medium) 100%
  );
  color: var(--warning-primary);
  border: 1px solid var(--warning-border-medium);
}

.timer-btn.timer-pause:hover {
  background: linear-gradient(
    135deg,
    var(--warning-bg-medium) 0%,
    var(--warning-bg-heavy) 100%
  );
  transform: translateY(-1px);
  box-shadow: var(--warning-glow-medium);
}

.timer-btn.timer-stop {
  background: linear-gradient(
    135deg,
    var(--danger-bg-subtle) 0%,
    var(--danger-bg-medium) 100%
  );
  color: var(--danger-primary);
  border: 1px solid var(--danger-border-medium);
}

.timer-btn.timer-stop:hover {
  background: linear-gradient(
    135deg,
    var(--danger-bg-medium) 0%,
    var(--danger-bg-heavy) 100%
  );
  transform: translateY(-1px);
  box-shadow: var(--danger-glow-medium);
}

.timer-btn:active {
  transform: translateY(0);
}

.coffee-stroke,
.meditation-stroke {
  stroke-width: 1.5;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .header-section {
    flex-direction: column;
    gap: var(--space-4);
    align-items: stretch;
  }

  .user-profile-container {
    margin-right: 0;
    text-align: center;
  }

  .project-title {
    text-align: center;
    order: -1;
  }

  .control-panel {
    justify-content: center;
  }

  .timer-display {
    min-width: 260px;
    max-width: 300px;
  }
}
</style>