import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, ref } from 'vue'

/**
 * ## AppearanceSettingsTab
 *
 * Interface settings panel combining sound controls and language/direction settings.
 *
 * **Features:**
 * - Sound effects toggle with test buttons
 * - Language switcher (English / Hebrew)
 * - Text direction control (Auto / LTR / RTL)
 *
 * **Dependencies:** `useSettingsStore`, `useTimerStore`, `LanguageSettings`, `vue-i18n`
 *
 * > **Note:** This component imports `LanguageSettings.vue` which uses
 * > `useI18n({ useScope: 'global' })`. It cannot render in Storybook isolation.
 * > View this component in the app via Settings modal.
 *
 * **Location:** `src/components/settings/tabs/AppearanceSettingsTab.vue`
 */

const AppearanceSettingsTabMock = defineComponent({
  name: 'AppearanceSettingsTabMock',
  setup() {
    const soundEnabled = ref(true)
    const toggleSound = () => { soundEnabled.value = !soundEnabled.value }
    return { soundEnabled, toggleSound }
  },
  template: `
    <div style="display: flex; flex-direction: column;">
      <!-- Interface Settings Section -->
      <div style="margin-bottom: var(--space-6);">
        <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-4);">
          <span style="font-size: var(--text-lg); font-weight: 600; color: var(--text-primary);">🎨 Interface Settings</span>
        </div>

        <!-- Sound Toggle -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-3) 0; border-bottom: 1px solid var(--border-subtle);">
          <span style="font-size: var(--text-base); color: var(--text-primary);">Sound effects</span>
          <button
            @click="toggleSound"
            :style="soundEnabled
              ? 'width: 44px; height: 24px; border-radius: 12px; background: var(--brand-primary); border: none; cursor: pointer; position: relative;'
              : 'width: 44px; height: 24px; border-radius: 12px; background: var(--surface-tertiary); border: none; cursor: pointer; position: relative;'"
          >
            <span :style="soundEnabled
              ? 'position: absolute; top: 2px; left: 22px; width: 20px; height: 20px; border-radius: 50%; background: white; transition: left 0.2s;'
              : 'position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: white; transition: left 0.2s;'"
            />
          </button>
        </div>

        <!-- Test Sound Buttons -->
        <div style="display: flex; gap: var(--space-2); margin-top: var(--space-2);">
          <button style="flex: 1; background: var(--glass-bg-soft); border: 1px solid var(--glass-border); color: var(--text-secondary); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); cursor: pointer; font-size: var(--text-sm);">
            🔊 Test start sound
          </button>
          <button style="flex: 1; background: var(--glass-bg-soft); border: 1px solid var(--glass-border); color: var(--text-secondary); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); cursor: pointer; font-size: var(--text-sm);">
            🔔 Test end sound
          </button>
        </div>
      </div>

      <!-- Language & Region Section -->
      <div>
        <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-4);">
          <span style="font-size: var(--text-lg); font-weight: 600; color: var(--text-primary);">🌍 Language & Region</span>
        </div>

        <!-- Language Selection -->
        <div style="display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-6);">
          <h3 style="font-size: var(--text-lg); font-weight: 600; color: var(--text-primary); margin: 0;">Language</h3>
          <div style="display: flex; flex-direction: column; gap: var(--space-2);">
            <button style="display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-1); padding: var(--space-3) var(--space-4); border: 1px solid var(--brand-primary); border-radius: var(--radius-lg); background: rgba(78, 205, 196, 0.08); box-shadow: 0 0 0 1px var(--brand-primary) inset; cursor: pointer; text-align: start;">
              <span style="font-size: var(--text-base); font-weight: 500; color: var(--text-primary);">English</span>
              <span style="font-size: var(--text-sm); color: var(--text-secondary);">English</span>
            </button>
            <button style="display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-1); padding: var(--space-3) var(--space-4); border: 1px solid var(--border-medium); border-radius: var(--radius-lg); background: var(--glass-bg-light); cursor: pointer; text-align: start;">
              <span style="font-size: var(--text-base); font-weight: 500; color: var(--text-primary);">עברית</span>
              <span style="font-size: var(--text-sm); color: var(--text-secondary);">Hebrew</span>
            </button>
          </div>
        </div>

        <!-- Text Direction -->
        <div style="display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-6);">
          <h3 style="font-size: var(--text-lg); font-weight: 600; color: var(--text-primary); margin: 0;">Text Direction</h3>
          <div style="display: flex; flex-direction: column; gap: var(--space-2);">
            <button style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); border: 1px solid var(--brand-primary); border-radius: var(--radius-lg); background: rgba(78, 205, 196, 0.08); box-shadow: 0 0 0 1px var(--brand-primary) inset; cursor: pointer; text-align: start;">
              <div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: var(--radius-md); background: var(--surface-primary); color: var(--text-secondary); flex-shrink: 0;">⟷</div>
              <div style="flex: 1;"><span style="font-size: var(--text-base); font-weight: 500; color: var(--text-primary); display: block;">Auto</span><span style="font-size: var(--text-sm); color: var(--text-secondary); display: block; margin-top: var(--space-1);">Automatically detect from language</span></div>
            </button>
            <button style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); border: 1px solid var(--border-medium); border-radius: var(--radius-lg); background: var(--glass-bg-light); cursor: pointer; text-align: start;">
              <div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: var(--radius-md); background: var(--surface-primary); color: var(--text-secondary); flex-shrink: 0;">→</div>
              <div style="flex: 1;"><span style="font-size: var(--text-base); font-weight: 500; color: var(--text-primary); display: block;">LTR</span><span style="font-size: var(--text-sm); color: var(--text-secondary); display: block; margin-top: var(--space-1);">Left to right text direction</span></div>
            </button>
            <button style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); border: 1px solid var(--border-medium); border-radius: var(--radius-lg); background: var(--glass-bg-light); cursor: pointer; text-align: start;">
              <div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: var(--radius-md); background: var(--surface-primary); color: var(--text-secondary); flex-shrink: 0;">←</div>
              <div style="flex: 1;"><span style="font-size: var(--text-base); font-weight: 500; color: var(--text-primary); display: block;">RTL</span><span style="font-size: var(--text-sm); color: var(--text-secondary); display: block; margin-top: var(--space-1);">Right to left text direction</span></div>
            </button>
          </div>
        </div>

        <!-- Status -->
        <div style="display: flex; flex-direction: column; gap: var(--space-3);">
          <h3 style="font-size: var(--text-lg); font-weight: 600; color: var(--text-primary); margin: 0;">General Settings</h3>
          <div style="display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-4); background: var(--glass-bg-light); border-radius: var(--radius-lg); border: 1px solid var(--border-medium);">
            <div style="display: flex; justify-content: space-between;"><span style="font-size: var(--text-sm); color: var(--text-secondary);">Language:</span><span style="font-size: var(--text-sm); color: var(--text-primary); font-weight: 500;">English</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="font-size: var(--text-sm); color: var(--text-secondary);">Text Direction:</span><span style="font-size: var(--text-sm); color: var(--text-primary); font-weight: 500;">Auto</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="font-size: var(--text-sm); color: var(--text-secondary);">Auto-detected:</span><span style="font-size: var(--text-sm); color: var(--text-primary); font-weight: 500;">Yes</span></div>
          </div>
        </div>
      </div>
    </div>
  `,
})

const meta = {
  component: AppearanceSettingsTabMock,
  title: '⚙️ Settings/Tabs/AppearanceSettingsTab',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="width: 600px; padding: var(--space-6); background: var(--glass-bg-soft); border-radius: var(--radius-xl); border: 1px solid var(--glass-border);">
          <story />
        </div>
      `,
    })
  ],
} satisfies Meta<typeof AppearanceSettingsTabMock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
