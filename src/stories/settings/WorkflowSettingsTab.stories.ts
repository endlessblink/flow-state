import type { Meta, StoryObj } from '@storybook/vue3'
import WorkflowSettingsTab from '@/components/settings/tabs/WorkflowSettingsTab.vue'
import { createPinia, setActivePinia } from 'pinia'

const pinia = createPinia()
setActivePinia(pinia)

const meta = {
  component: WorkflowSettingsTab,
  title: '⚙️ Settings/Tabs/WorkflowSettingsTab',
  tags: ['autodocs', 'new'],

  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: 'var(--bg-primary)' },
      ],
    },
  },

  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="min-height: 900px; width: 100%; max-width: 900px; padding: var(--space-6); background: var(--glass-bg-soft); border-radius: var(--radius-xl); border: 1px solid var(--glass-border);">
          <story />
        </div>
      `,
    })
  ],
} satisfies Meta<typeof WorkflowSettingsTab>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const KanbanSettings: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Shows Kanban board settings including "Done" column visibility and board density options.',
      },
    },
  },
}

export const CanvasSettings: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Shows Canvas settings for power group behavior (Today, High Priority, etc.).',
      },
    },
  },
}

export const TimeBlockAlerts: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Shows calendar time block alerts configuration with milestones and delivery channels.',
      },
    },
  },
}

export const GamificationIntensity: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Shows gamification settings with intensity level selector (Minimal, Moderate, Intense).',
      },
    },
  },
}
