import type { Meta, StoryObj } from '@storybook/vue3'
import { Plus } from 'lucide-vue-next'

const S = {
  capture: 'display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); backdrop-filter: blur(12px); width: 400px;',
  icon: 'color: var(--text-muted); flex-shrink: 0;',
  iconActive: 'color: var(--brand-primary); flex-shrink: 0;',
  input: 'flex: 1; background: transparent; border: none; outline: none; color: var(--text-primary); font-size: 0.875rem;',
  placeholder: 'flex: 1; font-size: 0.875rem; color: var(--text-muted);',
}

const meta: Meta = {
  title: '☀️ Morning Dashboard/MorningQuickCapture',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Quick capture input at the bottom of the Morning Dashboard. Plus icon turns teal on focus. Enter submits.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { Plus },
    template: `
      <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <div style="${S.capture}">
          <Plus :size="16" style="${S.icon}" />
          <span style="${S.placeholder}">Quick capture a task...</span>
        </div>
      </div>
    `,
  }),
}

export const Focused: Story = {
  render: () => ({
    components: { Plus },
    template: `
      <div style="padding: var(--space-6); background: var(--overlay-component-bg); border-radius: var(--radius-lg);">
        <div style="${S.capture} border-color: var(--brand-primary);">
          <Plus :size="16" style="${S.iconActive}" />
          <input style="${S.input}" value="Finish the quarterly report" autofocus />
        </div>
      </div>
    `,
  }),
}
