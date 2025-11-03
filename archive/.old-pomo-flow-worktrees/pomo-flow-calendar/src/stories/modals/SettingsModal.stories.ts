import type { Meta, StoryObj } from '@storybook/vue3'
import { ref, reactive } from 'vue'
import SettingsModal from '@/components/SettingsModal.vue'

// Mock CloudSyncSettings component
const MockCloudSyncSettings = {
  template: `
    <div class="mock-cloud-sync">
      <h3 style="margin: 0 0 16px 0; color: var(--text-secondary); font-size: 16px; font-weight: 600;">☁️ Cloud Sync Settings</h3>
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="padding: 16px; background: var(--surface-hover); border-radius: 8px;">
          <p style="margin: 0; font-size: 14px; color: var(--text-secondary);">Connected to cloud service</p>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px;">
            <span style="font-size: 13px;">Last sync: 2 minutes ago</span>
            <button style="padding: 6px 12px; background: var(--brand-primary); color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">Sync Now</button>
          </div>
        </div>
        <div style="padding: 16px; background: var(--surface-tertiary); border-radius: 8px; border: 1px solid var(--border-medium);">
          <p style="margin: 0; font-size: 14px; color: var(--text-muted);">Auto-sync enabled</p>
        </div>
      </div>
    </div>
  `,
}

// Mock timer store
const createMockTimerStore = (overrides = {}) => ({
  settings: {
    workDuration: 25 * 60,
    shortBreakDuration: 5 * 60,
    longBreakDuration: 15 * 60,
    autoStartBreaks: true,
    autoStartPomodoros: false,
    playNotificationSounds: true,
    ...overrides
  },
  playStartSound: () => console.log('Playing start sound'),
  playEndSound: () => console.log('Playing end sound'),
  updateSetting: (key: string, value: any) => {
    console.log('Updated setting:', key, value)
  }
})

const meta = {
  component: SettingsModal,
  title: '🎭 Overlays/🪟 Modals/SettingsModal',
  tags: ['autodocs'],

  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof SettingsModal>

export default meta
type Story = StoryObj<typeof meta>

// Basic Modal States
export const Closed: Story = {
  args: {
    isOpen: false,
  },
  render: (args) => ({
    components: { SettingsModal },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 100vw; height: 100vh; background: var(--surface-secondary); position: relative;">
        <div style="padding: 20px; text-align: center;">
          <h3>Settings Modal (Closed)</h3>
          <p>Click the button below to open the settings</p>
          <button @click="$event => console.log('Open settings')" style="margin-top: 20px; padding: 12px 24px; background: var(--brand-primary); color: white; border: none; border-radius: 6px; cursor: pointer;">
            ⚙️ Open Settings
          </button>
        </div>
        <SettingsModal v-bind="args"
          @close="() => console.log('Settings closed')"
        />
      </div>
    `,
  })
}

export const DefaultSettings: Story = {
  render: () => ({
    components: { SettingsModal, MockCloudSyncSettings },
    setup() {
      const isOpen = ref(true)
      const timerStore = createMockTimerStore()

      // Mock the store
      const useTimerStore = () => timerStore

      return { isOpen, useTimerStore }
    },
    template: `
      <div style="width: 100vw; height: 100vh; background: var(--surface-secondary); position: relative;">
        <div style="position: absolute; top: 20px; right: 20px; z-index: 100; background: var(--surface-primary); padding: 12px; border-radius: 8px; box-shadow: var(--shadow-md);">
          <p style="margin: 0; font-size: 14px; font-weight: 600;">Default Settings</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-muted);">Default Pomodoro and Kanban settings</p>
        </div>

        <SettingsModal :is-open="isOpen"
          @close="isOpen = false"
        />
      </div>
    `,
  })
}

// Pomodoro Configuration Variants
export const ShortPomodoro: Story = {
  render: () => ({
    components: { SettingsModal, MockCloudSyncSettings },
    setup() {
      const isOpen = ref(true)
      const timerStore = createMockTimerStore({
        workDuration: 15 * 60,    // 15 minutes
        shortBreakDuration: 3 * 60,   // 3 minutes
        longBreakDuration: 10 * 60    // 10 minutes
      })

      const useTimerStore = () => timerStore

      return { isOpen, useTimerStore }
    },
    template: `
      <div style="width: 100vw; height: 100vh; background: var(--surface-secondary); position: relative;">
        <div style="position: absolute; top: 20px; right: 20px; z-index: 100; background: var(--surface-primary); padding: 12px; border-radius: 8px; box-shadow: var(--shadow-md);">
          <p style="margin: 0; font-size: 14px; font-weight: 600;">Short Pomodoro</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-muted);">Quick 15-minute work sessions</p>
        </div>

        <SettingsModal :is-open="isOpen"
          @close="isOpen = false"
        />
      </div>
    `,
  })
}

export const LongPomodoro: Story = {
  render: () => ({
    components: { SettingsModal, MockCloudSyncSettings },
    setup() {
      const isOpen = ref(true)
      const timerStore = createMockTimerStore({
        workDuration: 30 * 60,    // 30 minutes
        shortBreakDuration: 10 * 60,  // 10 minutes
        longBreakDuration: 20 * 60   // 20 minutes
      })

      const useTimerStore = () => timerStore

      return { isOpen, useTimerStore }
    },
    template: `
      <div style="width: 100vw; height: 100vh; background: var(--surface-secondary); position: relative;">
        <div style="position: absolute; top: 20px; right: 20px; z-index: 100; background: var(--surface-primary); padding: 12px; border-radius: 8px; box-shadow: var(--shadow-md);">
          <p style="margin: 0; font-size: 14px; font-weight: 600;">Long Pomodoro</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-muted);">Focused 30-minute work sessions</p>
        </div>

        <SettingsModal :is-open="isOpen"
          @close="isOpen = false"
        />
      </div>
    `,
  })
}

// Feature Toggles
export const AllFeaturesEnabled: Story = {
  render: () => ({
    components: { SettingsModal, MockCloudSyncSettings },
    setup() {
      const isOpen = ref(true)
      const timerStore = createMockTimerStore({
        autoStartBreaks: true,
        autoStartPomodoros: true,
        playNotificationSounds: true
      })

      const useTimerStore = () => timerStore

      return { isOpen, useTimerStore }
    },
    template: `
      <div style="width: 100vw; height: 100vh; background: var(--surface-secondary); position: relative;">
        <div style="position: absolute; top: 20px; right: 20px; z-index: 100; background: var(--surface-primary); padding: 12px; border-radius: 8px; box-shadow: var(--shadow-md);">
          <p style="margin: 0; font-size: 14px; font-focus: 600;">All Features Enabled</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-muted);">Auto-starts and sounds enabled</p>
        </div>

        <SettingsModal :is-open="isOpen"
          @close="isOpen = false"
        />
      </div>
    `,
  })
}

export const MinimalFeatures: Story = {
  render: () => ({
    components: { SettingsModal, MockCloudSyncSettings },
    setup() {
      const isOpen = ref(true)
      const timerStore = createMockTimerStore({
        autoStartBreaks: false,
        autoStartPomodoros: false,
        playNotificationSounds: false
      })

      const useTimerStore = () => timerStore

      return { isOpen, useTimerStore }
    },
    template: `
      <div style="width: 100vw; height: 100vh; background: var(--surface-secondary); position: relative;">
        <div style="position: absolute; top: 20px; right: 20px; z-index: 100; background: var(--surface-primary); padding: 12px; border-radius: 8px; box-shadow: var(--shadow-md);">
          <p style="margin: 0; font-size: 14px; font-weight: 600;">Minimal Features</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-muted);">All automation disabled</p>
        </div>

        <SettingsModal :is-open="isOpen"
          @close="isOpen = false"
        />
      </div>
    `,
  })
}

// Kanban Settings
export const DoneColumnVisible: Story = {
  render: () => ({
    components: { SettingsModal, MockCloudSyncSettings },
    setup() {
      const isOpen = ref(true)
      const timerStore = createMockTimerStore()
      const showDoneColumn = ref(true)

      const useTimerStore = () => timerStore

      return { isOpen, useTimerStore, showDoneColumn }
    },
    template: `
      <div style="width: 100vw; height: 100vh; background: var(--surface-secondary); position: relative;">
        <div style="position: absolute; top: 20px; right: 20px; z-index: 100; background: var(--surface-primary); padding: 12px; border-radius: 8px; box-shadow: var(--shadow-md);">
          <p style="margin: 0; font-size: 14px; font-weight: 600;">Done Column Visible</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-muted);">Done column is shown in Kanban board</p>
        </div>

        <SettingsModal :is-open="isOpen"
          @close="isOpen = false"
        />
      </div>
    `,
  })
}

export const DoneColumnHidden: Story = {
  render: () => ({
    components: { SettingsModal, MockCloudSyncSettings },
    setup() {
      const isOpen = ref(true)
      const timerStore = createMockTimerStore()
      const showDoneColumn = ref(false)

      const useTimerStore = () => timerStore

      return { isOpen, useTimerStore, showDoneColumn }
    },
    template: `
      <div style="width: 100vw; height: 100vh; background: var(--surface-secondary); position: relative;">
        <div style="position: absolute; top: 20px; right: 20px; z-index: 100; background: var(--surface-primary); padding: 12px; border-radius: 8px; box-shadow: var(--shadow-md);">
          <p style="margin: 0; font-size: 14px; font-weight: 600;">Done Column Hidden</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-muted);">Done column is hidden for focus</p>
        </div>

        <SettingsModal :is-open="isOpen"
          @close="isOpen = false"
        />
      </div>
    `,
  })
}

// Interactive Demo
export const InteractiveDemo: Story = {
  render: () => ({
    components: { SettingsModal, MockCloudSyncSettings },
    setup() {
      const isOpen = ref(false)
      const currentSettings = ref({
        workDuration: 25 * 60,
        shortBreakDuration: 5 * 60,
        longBreakDuration: 15 * 60,
        autoStartBreaks: true,
        autoStartPomodoros: false,
        playNotificationSounds: true
      })

      const showDoneColumn = ref(false)
      const syncStatus = ref('connected')

      // Mock timer store
      const timerStore = reactive({
        settings: currentSettings.value,
        playStartSound: () => {
          console.log('🔊 Playing start sound effect')
          // In real app, this would play an actual sound
        },
        playEndSound: () => {
          console.log('🔔 Playing end sound effect')
          // In real app, this would play an actual sound
        },
        updateSetting: (key: string, value: any) => {
          currentSettings.value[key] = value
          console.log(`✅ Updated ${key}:`, value)
          // In real app, this would save to localStorage
        }
      })

      const useTimerStore = () => timerStore

      const openSettings = () => {
        isOpen.value = true
        console.log('Opening settings modal with current settings:', currentSettings.value)
      }

      const handleSettingChange = (key: string, value: any) => {
        currentSettings.value[key] = value
        console.log(`Changed ${key} to:`, value)
        console.log('Current settings:', currentSettings.value)
      }

      const handleShowDoneColumnChange = (value: boolean) => {
        showDoneColumn.value = value
        console.log('Changed showDoneColumn to:', value)
      }

      const testStartSound = () => {
        timerStore.playStartSound()
      }

      const testEndSound = () => {
        timerStore.playEndSound()
      }

      const syncNow = () => {
        syncStatus.value = 'syncing'
        setTimeout(() => {
          syncStatus.value = 'connected'
          console.log('✅ Cloud sync completed')
        }, 2000)
      }

      const resetToDefaults = () => {
        currentSettings.value = {
          workDuration: 25 * 60,
          shortBreakDuration: 5 * 60,
          longBreakDuration: 15 * 60,
          autoStartBreaks: true,
          autoStartPomodoros: false,
          playNotificationSounds: true
        }
        showDoneColumn.value = false
        console.log('✅ Reset to default settings')
      }

      return {
        isOpen,
        currentSettings,
        showDoneColumn,
        syncStatus,
        useTimerStore,
        openSettings,
        handleSettingChange,
        handleShowDoneColumnChange,
        testStartSound,
        testEndSound,
        syncNow,
        resetToDefaults
      }
    },
    template: `
      <div style="width: 100vw; height: 100vh; background: var(--surface-secondary); position: relative; overflow: hidden;">
        <!-- Main Content -->
        <div style="padding: 20px; display: flex; flex-direction: column; gap: 24px;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h1 style="margin: 0;">Interactive Settings Demo</h1>
            <button
              @click="openSettings"
              style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: var(--brand-primary); color: white; border: none; border-radius: 6px; cursor: pointer;"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M12 1v6m0 0v6m0 6v6m0-6h.01M6 13h12m-6-7h6"></path>
                <path d="m21 21-2.2-2.1-2.5-4-2.5H3"></path>
                <path d="M12 8v4l0 4"></path>
                <path d="m16 12h8"></path>
                <path d="m-21 4-4 4h-2.5m-7.5-2.5H3"></path>
              </svg>
              ⚙️ Settings
            </button>
          </div>

          <!-- Current Settings Display -->
          <div style="background: var(--surface-primary); padding: 20px; border-radius: 12px; border: 1px solid var(--border-medium);">
            <h2 style="margin: 0 0 16px 0;">Current Configuration</h2>

            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
              <div>
                <h3 style="margin: 0 0 8px 0; font-size: 14px; color: var(--text-secondary);">Pomodoro Timer</h3>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-subtle);">
                    <span>Work Duration:</span>
                    <span style="font-weight: 500;">{{ Math.round(currentSettings.workDuration / 60) }}min</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-subtle);">
                    <span>Short Break:</span>
                    <span style="font-weight: 500;">{{ Math.round(currentSettings.shortBreakDuration / 60) }}min</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                    <span>Long Break:</span>
                    <span style="font-weight: 500;">{{ Math.round(currentSettings.longBreakDuration / 60) }}min</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 style="margin: 0 0 8px 0; font-size: 14px; color: var(--text-secondary);">Features</h3>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                    <span>Auto-start Breaks:</span>
                    <span :style="{ color: currentSettings.autoStartBreaks ? 'var(--color-work)' : 'var(--text-muted)' }">
                      {{ currentSettings.autoStartBreaks ? '✅' : '❌' }}
                    </span>
                  </div>
                  <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                    <span>Auto-start Pomodoros:</span>
                    <span :style="{ color: currentSettings.autoStartPomodoros ? 'var(--color-work)' : 'var(--text-muted)' }">
                      {{ currentSettings.autoStartPomodoros ? '✅' : '❌' }}
                    </span>
                  </div>
                  <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                    <span>Sound Effects:</span>
                    <span :style="{ color: currentSettings.playNotificationSounds ? 'var(--color-work)' : 'var(--text-muted)' }">
                      {{ currentSettings.playNotificationSounds ? '🔊' : '🔇' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Kanban Settings -->
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-subtle);">
              <h3 style="margin: 0 0 8px 0; font-size: 14px; color: var(--text-secondary);">Kanban Board</h3>
              <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                <span>Show Done Column:</span>
                <span :style="{ color: showDoneColumn ? 'var(--color-work)' : 'var(--text-muted)' }">
                  {{ showDoneColumn ? '👁' : '🚫' }}
                </span>
              </div>
            </div>

            <!-- Cloud Sync Status -->
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-subtle);">
              <h3 style="margin: 0 0 8px 0; font-size: 14px; color: var(--text-secondary);">Cloud Sync</h3>
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--surface-hover); border-radius: 8px;">
                <span :style="{ color: syncStatus === 'connected' ? 'var(--color-work)' : syncStatus === 'syncing' ? 'var(--color-break)' : 'var(--text-muted)' }">
                  {{ syncStatus === 'connected' ? '☁️' : syncStatus === 'syncing' ? '🔄' : '⚠️' }}
                  {{ syncStatus === 'connected' ? 'Connected' : syncStatus === 'syncing' ? 'Syncing...' : 'Disconnected' }}
                </span>
                <button
                  @click="syncNow"
                  style="padding: 6px 12px; background: var(--brand-primary); color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;"
                  :disabled="syncStatus === 'syncing'"
                >
                  {{ syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now' }}
                </button>
              </div>
            </div>

            <!-- Action Buttons -->
            <div style="margin-top: 24px; display: flex; gap: 12px;">
              <button
                @click="testStartSound"
                style="flex: 1; padding: 10px 16px; background: var(--surface-hover); border: 1px solid var(--border-medium); border-radius: 6px; cursor: pointer;"
              >
                🔊 Test Start Sound
              </button>
              <button
                @click="testEndSound"
                style="flex: 1; padding: 10px 16px; background: var(--surface-hover); border: 1px solid var(--border-medium); border-radius: 6px; cursor: pointer;"
              >
                🔔 Test End Sound
              </button>
              <button
                @click="resetToDefaults"
                style="flex: 1; padding: 10px 16px; background: var(--color-break); color: white; border: none; border-radius: 6px; cursor: pointer;"
              >
                🔄 Reset to Defaults
              </button>
            </div>
          </div>
        </div>

        <!-- Settings Modal -->
        <SettingsModal :is-open="isOpen"
          @close="isOpen = false"
        />
      </div>
    `,
  })
}