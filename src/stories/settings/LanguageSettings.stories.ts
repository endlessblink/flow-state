import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent } from 'vue'

/**
 * ## LanguageSettings
 *
 * Language and text direction settings panel.
 *
 * **Features:**
 * - Language switcher (English / Hebrew)
 * - Text direction control (Auto / LTR / RTL)
 * - Current status display
 *
 * **Dependencies:** `useUIStore`, `useDirection`, `vue-i18n`
 *
 * > **Note:** This component uses `useI18n({ useScope: 'global' })` which
 * > requires the full app i18n context. It cannot render in Storybook isolation.
 * > View this component in the app via Settings modal.
 *
 * **Location:** `src/components/settings/LanguageSettings.vue`
 */

// Lightweight visual mockup of the component
const LanguageSettingsMock = defineComponent({
  name: 'LanguageSettingsMock',
  template: `
    <div style="display: flex; flex-direction: column; gap: var(--space-6);">
      <!-- Language Selection -->
      <div style="display: flex; flex-direction: column; gap: var(--space-3);">
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
      <div style="display: flex; flex-direction: column; gap: var(--space-3);">
        <h3 style="font-size: var(--text-lg); font-weight: 600; color: var(--text-primary); margin: 0;">Text Direction</h3>
        <div style="display: flex; flex-direction: column; gap: var(--space-2);">
          <button v-for="opt in options" :key="opt.value" :style="opt.value === 'auto' ? activeStyle : normalStyle" style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); cursor: pointer; text-align: start;">
            <div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: var(--radius-md); background: var(--surface-primary); color: var(--text-secondary); flex-shrink: 0;">
              {{ opt.icon }}
            </div>
            <div style="flex: 1;">
              <span style="font-size: var(--text-base); font-weight: 500; color: var(--text-primary); display: block;">{{ opt.label }}</span>
              <span style="font-size: var(--text-sm); color: var(--text-secondary); display: block; margin-top: var(--space-1);">{{ opt.desc }}</span>
            </div>
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
  `,
  setup() {
    const options = [
      { value: 'auto', label: 'Auto', desc: 'Automatically detect from language', icon: '⟷' },
      { value: 'ltr', label: 'LTR', desc: 'Left to right text direction', icon: '→' },
      { value: 'rtl', label: 'RTL', desc: 'Right to left text direction', icon: '←' },
    ]
    const activeStyle = 'border: 1px solid var(--brand-primary); background: rgba(78, 205, 196, 0.08); box-shadow: 0 0 0 1px var(--brand-primary) inset;'
    const normalStyle = 'border: 1px solid var(--border-medium); background: var(--glass-bg-light);'
    return { options, activeStyle, normalStyle }
  },
})

const meta = {
  component: LanguageSettingsMock,
  title: '⚙️ Settings/LanguageSettings',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="width: 500px; padding: var(--space-6); background: var(--glass-bg-soft); border-radius: var(--radius-xl); border: 1px solid var(--glass-border);">
          <story />
        </div>
      `,
    })
  ],
} satisfies Meta<typeof LanguageSettingsMock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
