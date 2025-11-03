<template>
  <div v-if="isOpen" class="settings-overlay" @click="$emit('close')">
    <div class="settings-modal" @click.stop>
      <div class="settings-header">
        <h2 class="settings-title">Settings</h2>
        <button class="close-btn" @click="$emit('close')">
          <X :size="16" />
        </button>
      </div>

      <div class="settings-content">
        <!-- Pomodoro Settings -->
        <section class="settings-section">
          <h3 class="section-title">🍅 Pomodoro Settings</h3>

          <div class="setting-group">
            <label class="setting-label">Work Duration</label>
            <div class="duration-options">
              <button
                v-for="duration in [15, 20, 25, 30]"
                :key="duration"
                class="duration-btn"
                :class="{ active: timerStore.settings.workDuration === duration * 60 }"
                @click="updateWorkDuration(duration)"
              >
                {{ duration }}m
              </button>
            </div>
          </div>

          <div class="setting-group">
            <label class="setting-label">Short Break</label>
            <div class="duration-options">
              <button
                v-for="duration in [3, 5, 10]"
                :key="duration"
                class="duration-btn"
                :class="{ active: timerStore.settings.shortBreakDuration === duration * 60 }"
                @click="updateShortBreak(duration)"
              >
                {{ duration }}m
              </button>
            </div>
          </div>

          <div class="setting-group">
            <label class="setting-label">Long Break</label>
            <div class="duration-options">
              <button
                v-for="duration in [10, 15, 20]"
                :key="duration"
                class="duration-btn"
                :class="{ active: timerStore.settings.longBreakDuration === duration * 60 }"
                @click="updateLongBreak(duration)"
              >
                {{ duration }}m
              </button>
            </div>
          </div>

          <div class="setting-toggle">
            <label class="toggle-label">
              <input
                type="checkbox"
                :checked="timerStore.settings.autoStartBreaks"
                @change="updateSetting('autoStartBreaks', $event.target.checked)"
              >
              <span class="toggle-slider"></span>
              Auto-start breaks
            </label>
          </div>

          <div class="setting-toggle">
            <label class="toggle-label">
              <input
                type="checkbox"
                :checked="timerStore.settings.autoStartPomodoros"
                @change="updateSetting('autoStartPomodoros', $event.target.checked)"
              >
              <span class="toggle-slider"></span>
              Auto-start work sessions
            </label>
          </div>
        </section>

        <!-- Kanban Settings -->
        <section class="settings-section">
          <h3 class="section-title">📋 Kanban Settings</h3>

          <div class="setting-toggle">
            <label class="toggle-label">
              <input
                type="checkbox"
                :checked="showDoneColumn"
                @change="updateShowDoneColumn($event.target.checked)"
              >
              <span class="toggle-slider"></span>
              Show "Done" column
            </label>
          </div>
          <p class="setting-description">
            Hide the done column to reduce visual clutter and focus on active tasks.
          </p>
        </section>

        <!-- Interface Settings -->
        <section class="settings-section">
          <h3 class="section-title">🎨 Interface Settings</h3>

          <div class="setting-toggle">
            <label class="toggle-label">
              <input
                type="checkbox"
                :checked="timerStore.settings.playNotificationSounds"
                @change="updateSetting('playNotificationSounds', $event.target.checked)"
              >
              <span class="toggle-slider"></span>
              Sound effects
            </label>
          </div>

          <div class="setting-action">
            <button class="test-sound-btn" @click="timerStore.playStartSound">
              🔊 Test start sound
            </button>
            <button class="test-sound-btn" @click="timerStore.playEndSound">
              🔔 Test end sound
            </button>
          </div>
        </section>

        <!-- Language & Direction Settings -->
        <section class="settings-section">
          <h3 class="section-title">🌐 Language & Direction</h3>

          <div class="setting-group">
            <label class="setting-label">Language</label>
            <div class="duration-options">
              <button
                class="duration-btn"
                :class="{ active: locale === 'en' }"
                @click="changeLocale('en')"
              >
                English
              </button>
              <button
                class="duration-btn"
                :class="{ active: locale === 'he' }"
                @click="changeLocale('he')"
              >
                עברית
              </button>
            </div>
          </div>

          <div class="setting-group">
            <label class="setting-label">Text Direction</label>
            <div class="duration-options">
              <button
                class="duration-btn"
                :class="{ active: directionPreference === 'ltr' }"
                @click="changeDirection('ltr')"
              >
                LTR →
              </button>
              <button
                class="duration-btn"
                :class="{ active: directionPreference === 'rtl' }"
                @click="changeDirection('rtl')"
              >
                ← RTL
              </button>
              <button
                class="duration-btn"
                :class="{ active: directionPreference === 'auto' }"
                @click="changeDirection('auto')"
              >
                Auto
              </button>
            </div>
          </div>

          <p class="setting-description">
            Current direction: <strong>{{ direction.toUpperCase() }}</strong>
            <span v-if="directionPreference === 'auto'"> (auto-detected from language)</span>
          </p>
        </section>

        <!-- Cloud Sync Settings -->
        <section class="settings-section">
          <CloudSyncSettings />
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTimerStore } from '@/stores/timer'
import { useDirection } from '@/i18n/useDirection'
import { useI18n } from 'vue-i18n'
import { X } from 'lucide-vue-next'
import CloudSyncSettings from './CloudSyncSettings.vue'

interface Props {
  isOpen: boolean
}

defineProps<Props>()
defineEmits<{
  close: []
}>()

const timerStore = useTimerStore()

// Direction and locale management
const { direction, directionPreference, setDirection } = useDirection()
const { locale } = useI18n()

// Show done column setting
const showDoneColumn = ref(false)

// Load settings on mount
onMounted(() => {
  const savedSettings = localStorage.getItem('pomo-flow-kanban-settings')
  if (savedSettings) {
    const settings = JSON.parse(savedSettings)
    showDoneColumn.value = settings.showDoneColumn || false
  }
})

const updateWorkDuration = (minutes: number) => {
  timerStore.settings.workDuration = minutes * 60
  saveSettings()
}

const updateShortBreak = (minutes: number) => {
  timerStore.settings.shortBreakDuration = minutes * 60
  saveSettings()
}

const updateLongBreak = (minutes: number) => {
  timerStore.settings.longBreakDuration = minutes * 60
  saveSettings()
}

const updateSetting = (key: string, value: any) => {
  (timerStore.settings as any)[key] = value
  saveSettings()
}

const updateShowDoneColumn = (value: boolean) => {
  showDoneColumn.value = value
  saveKanbanSettings()
}

// Direction and locale handlers
const changeDirection = (newDirection: 'ltr' | 'rtl' | 'auto') => {
  setDirection(newDirection)
}

const changeLocale = (newLocale: string) => {
  locale.value = newLocale
  localStorage.setItem('app-locale', newLocale)
  // Direction will auto-update via the composable if set to 'auto'
}

const saveSettings = () => {
  localStorage.setItem('pomo-flow-settings', JSON.stringify(timerStore.settings))
}

const saveKanbanSettings = () => {
  const settings = {
    showDoneColumn: showDoneColumn.value
  }
  localStorage.setItem('pomo-flow-kanban-settings', JSON.stringify(settings))

  // Emit custom event to notify BoardView about the change
  window.dispatchEvent(new CustomEvent('kanban-settings-changed', {
    detail: { showDoneColumn: showDoneColumn.value }
  }))
}
</script>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0; /* RTL: full screen overlay */
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.settings-modal {
  background: linear-gradient(
    135deg,
    var(--glass-bg-medium) 0%,
    var(--glass-bg-heavy) 100%
  );
  backdrop-filter: blur(32px) saturate(200%);
  -webkit-backdrop-filter: blur(32px) saturate(200%);
  border: 1px solid var(--glass-border-strong);
  border-radius: var(--radius-2xl);
  box-shadow:
    0 32px 64px var(--shadow-xl),
    0 16px 32px var(--shadow-strong),
    inset 0 2px 0 var(--glass-border-soft);
  width: 90%;
  max-width: 480px;
  max-height: 85vh;
  overflow-y: auto;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-5);
  border-bottom: 1px solid var(--glass-bg-heavy);
  background: linear-gradient(
    180deg,
    var(--glass-bg-tint) 0%,
    transparent 100%
  );
}

.settings-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  transition: all var(--duration-normal) var(--spring-smooth);
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--glass-border);
  border-color: var(--glass-border-medium);
  color: var(--text-primary);
  transform: scale(1.05);
}

.settings-content {
  padding: var(--space-5) var(--space-6);
}

.settings-section {
  margin-bottom: var(--space-8);
}

.section-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  margin: 0 0 var(--space-4) 0;
}

.setting-group {
  margin-bottom: var(--space-4);
}

.setting-label {
  display: block;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-muted);
  margin-bottom: var(--space-2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.duration-options {
  display: flex;
  gap: var(--space-2);
}

.duration-btn {
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: 0 4px 8px var(--shadow-subtle);
}

.duration-btn:hover {
  background: linear-gradient(
    135deg,
    var(--glass-border) 0%,
    var(--glass-bg-medium) 100%
  );
  border-color: var(--glass-border-medium);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.duration-btn.active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  color: var(--text-primary);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.setting-toggle {
  margin-bottom: 1rem;
}

.setting-description {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: var(--space-2) 0 0 0;
  line-height: 1.4;
  max-width: 300px;
}

.toggle-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  width: 100%;
}

.toggle-label input {
  display: none;
}

.toggle-slider {
  width: 2.75rem;
  height: 1.5rem;
  background: var(--glass-bg-heavy);
  border: 1px solid var(--glass-bg-medium);
  border-radius: var(--radius-full);
  position: relative;
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: inset 0 1px 3px var(--shadow-md);
}

.toggle-slider::after {
  content: '';
  position: absolute;
  top: 0.125rem;
  inset-inline-start: 0.125rem; /* RTL: toggle slider knob position */
  width: 1.25rem;
  height: 1.25rem;
  background: linear-gradient(
    135deg,
    var(--text-primary) 0%,
    var(--text-primary) 100%
  );
  border-radius: var(--radius-full);
  transition: all var(--duration-normal) var(--spring-bounce);
  box-shadow: 0 2px 6px var(--shadow-md);
}

.toggle-label input:checked + .toggle-slider {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  box-shadow: inset 0 1px 3px var(--shadow-md), var(--state-hover-glow);
}

.toggle-label input:checked + .toggle-slider::after {
  inset-inline-start: calc(100% - 1.375rem); /* RTL: move toggle knob to end position */
}

.setting-action {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

.test-sound-btn {
  flex: 1;
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: 0 4px 8px var(--shadow-subtle);
}

.test-sound-btn:hover {
  background: linear-gradient(
    135deg,
    var(--glass-border) 0%,
    var(--glass-bg-medium) 100%
  );
  border-color: var(--glass-border-medium);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: 0 6px 12px var(--shadow-lg);
}

/* Remove dark theme overrides - using design tokens for all themes */
</style>