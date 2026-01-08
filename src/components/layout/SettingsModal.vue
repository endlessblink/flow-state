<template>
  <div v-if="isOpen" class="settings-overlay" @click="$emit('close')">
    <div class="settings-modal" @click.stop>
      <div class="settings-header">
        <h2 class="settings-title">
          Settings
        </h2>
        <button class="close-btn" @click="$emit('close')">
          <X :size="16" />
        </button>
      </div>

      <div class="settings-layout">
        <aside class="settings-sidebar">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="tab-btn"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <component :is="tab.icon" :size="18" />
            <span>{{ tab.label }}</span>
          </button>
        </aside>

        <div class="settings-content">
          <Transition name="tab-fade" mode="out-in">
            <!-- Timer Tab -->
            <div v-if="activeTab === 'timer'" key="timer" class="tab-pane">
              <section class="settings-section">
                <h3 class="section-title">
                  🍅 Pomodoro Settings
                </h3>

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
                      @change="updateSetting('autoStartBreaks', ($event.target as HTMLInputElement).checked)"
                    >
                    <span class="toggle-slider" />
                    Auto-start breaks
                  </label>
                </div>

                <div class="setting-toggle">
                  <label class="toggle-label">
                    <input
                      type="checkbox"
                      :checked="timerStore.settings.autoStartPomodoros"
                      @change="updateSetting('autoStartPomodoros', ($event.target as HTMLInputElement).checked)"
                    >
                    <span class="toggle-slider" />
                    Auto-start work sessions
                  </label>
                </div>
              </section>
            </div>

            <!-- Appearance Tab -->
            <div v-else-if="activeTab === 'appearance'" key="appearance" class="tab-pane">
              <section class="settings-section">
                <h3 class="section-title">
                  🎨 Interface Settings
                </h3>

                <div class="setting-toggle">
                  <label class="toggle-label">
                    <input
                      type="checkbox"
                      :checked="timerStore.settings.playNotificationSounds"
                      @change="updateSetting('playNotificationSounds', ($event.target as HTMLInputElement).checked)"
                    >
                    <span class="toggle-slider" />
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

              <section class="settings-section">
                <LanguageSettings />
              </section>
            </div>

            <!-- Workflow Tab -->
            <div v-else-if="activeTab === 'workflow'" key="workflow" class="tab-pane">
              <section class="settings-section">
                <h3 class="section-title">
                  📋 Kanban Settings
                </h3>

                <div class="setting-toggle">
                  <label class="toggle-label">
                    <input
                      type="checkbox"
                      :checked="showDoneColumn"
                      @change="updateShowDoneColumn(($event.target as HTMLInputElement).checked)"
                    >
                    <span class="toggle-slider" />
                    Show "Done" column
                  </label>
                </div>
                <p class="setting-description">
                  Hide the done column to reduce visual clutter and focus on active tasks.
                </p>
              </section>

              <section class="settings-section">
                <h3 class="section-title">
                  🎨 Canvas Settings
                </h3>

                <div class="setting-group">
                  <label class="setting-label">Power Group Behavior</label>
                  <p class="setting-description" style="margin-bottom: var(--space-2)">
                    When dropping tasks on power groups (Today, High Priority, etc.)
                  </p>
                  <div class="duration-options">
                    <button
                      class="duration-btn"
                      :class="{ active: uiStore.powerGroupOverrideMode === 'always' }"
                      @click="uiStore.setPowerGroupOverrideMode('always')"
                    >
                      Always update
                    </button>
                    <button
                      class="duration-btn"
                      :class="{ active: uiStore.powerGroupOverrideMode === 'only_empty' }"
                      @click="uiStore.setPowerGroupOverrideMode('only_empty')"
                    >
                      Only if empty
                    </button>
                    <button
                      class="duration-btn"
                      :class="{ active: uiStore.powerGroupOverrideMode === 'ask' }"
                      @click="uiStore.setPowerGroupOverrideMode('ask')"
                    >
                      Ask each time
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <!-- Sync Tab -->
            <div v-else-if="activeTab === 'sync'" key="sync" class="tab-pane">
              <section class="settings-section">
                <CloudSyncSettings />
              </section>

              <section class="settings-section">
                <BackupSettings />
              </section>
            </div>

            <!-- Account Tab -->
            <div v-else-if="activeTab === 'account'" key="account" class="tab-pane">
              <section class="settings-section">
                <h3 class="section-title">
                  👤 Account Settings
                </h3>

                <div v-if="authStore.isAuthenticated" class="account-info">
                  <div class="user-details">
                    <div class="user-email">
                      {{ authStore.user?.email }}
                    </div>
                    <div class="user-status">
                      Logged in via Supabase
                    </div>
                  </div>
                  
                  <button class="logout-btn" @click="handleSignOut">
                    <LogOut :size="16" />
                    <span>Log Out</span>
                  </button>
                </div>

                <div v-else class="guest-info">
                  <div class="guest-status">
                    <div class="status-badge">
                      Guest Mode
                    </div>
                    <p class="setting-description">
                      You are currently using local storage. Create an account to sync your tasks across devices.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useTimerStore } from '@/stores/timer'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { 
  X, 
  Timer, 
  Palette, 
  Layout, 
  RefreshCw, 
  User,
  LogOut
} from 'lucide-vue-next'
import CloudSyncSettings from '@/components/sync/CloudSyncSettings.vue'
import BackupSettings from '@/components/sync/BackupSettings.vue'
import LanguageSettings from '@/components/settings/LanguageSettings.vue'

interface Props {
  isOpen: boolean
}

defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const timerStore = useTimerStore()
const uiStore = useUIStore()
const authStore = useAuthStore()

// Tab Management
const activeTab = ref('timer')
const tabs = [
  { id: 'timer', label: 'Timer', icon: Timer },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'workflow', label: 'Workflow', icon: Layout },
  { id: 'sync', label: 'Sync', icon: RefreshCw },
  { id: 'account', label: 'Account', icon: User }
]

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

const updateSetting = <K extends keyof typeof timerStore.settings>(key: K, value: (typeof timerStore.settings)[K]) => {
  timerStore.settings[key] = value
  saveSettings()
}

const updateShowDoneColumn = (value: boolean) => {
  showDoneColumn.value = value
  saveKanbanSettings()
}

const handleSignOut = async () => {
  await authStore.signOut()
  emit('close')
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
  inset: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(8px);
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
  width: 95%;
  max-width: 720px;
  height: 600px; /* Fixed height to prevent resizing on tab switch */
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--glass-border-strong);
  background: var(--glass-bg-tint);
}

.settings-title {
  font-size: var(--text-lg);
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
  color: var(--text-primary);
  transform: scale(1.05);
}

.settings-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.settings-sidebar {
  width: 200px;
  background: var(--glass-bg-soft);
  border-right: 1px solid var(--glass-border-strong);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
  text-align: left;
}

.tab-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

.tab-btn.active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}

.settings-content {
  flex: 1;
  padding: var(--space-6);
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.02);
  position: relative; /* For transition stability */
}

/* Slide-Fade Transition */
.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: all 0.25s var(--spring-smooth);
}

.tab-fade-enter-from {
  opacity: 0;
  transform: translateX(12px);
}

.tab-fade-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}

.tab-pane {
  width: 100%;
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
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.duration-btn:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-medium);
  color: var(--text-primary);
}

.duration-btn.active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  color: var(--text-primary);
}

.setting-toggle {
  margin-bottom: 1rem;
}

.setting-description {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: var(--space-2) 0 0 0;
  line-height: 1.4;
  max-width: 400px;
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
  width: 2.5rem;
  height: 1.25rem;
  background: var(--glass-bg-heavy);
  border-radius: var(--radius-full);
  position: relative;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.toggle-slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 1rem;
  height: 1rem;
  background: var(--text-primary);
  border-radius: var(--radius-full);
  transition: all var(--duration-normal) var(--spring-bounce);
}

.toggle-label input:checked + .toggle-slider {
  background: var(--state-active-bg);
}

.toggle-label input:checked + .toggle-slider::after {
  left: calc(100% - 1.125rem);
}

.setting-action {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

.test-sound-btn {
  flex: 1;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.test-sound-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

/* Account Info Styles */
.account-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4);
  background: var(--glass-bg-soft);
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border);
}

.user-email {
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.user-status {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #ef4444;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal);
}

.logout-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  transform: translateY(-1px);
}

.status-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-3);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

@media (max-width: 640px) {
  .settings-layout {
    flex-direction: column;
  }
  
  .settings-sidebar {
    width: 100%;
    flex-direction: row;
    overflow-x: auto;
    padding: var(--space-2);
    border-right: none;
    border-bottom: 1px solid var(--glass-border-strong);
  }
  
  .tab-btn {
    flex-shrink: 0;
    padding: var(--space-2);
  }
  
  .tab-btn span {
    display: none;
  }
}
</style>