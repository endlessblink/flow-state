import type { Meta, StoryObj } from '@storybook/vue3'
import UserProfile from '@/components/auth/UserProfile.vue'

const meta: Meta<typeof UserProfile> = {
  title: '🔐 Auth/UserProfile',
  component: UserProfile,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    () => ({
      template: `
        <div style="background: var(--glass-bg-solid); min-height: 400px; display: flex; align-items: center; justify-content: center; padding: var(--space-8); border-radius: var(--radius-lg);">
          <story />
        </div>
      `
    })
  ]
}

export default meta
type Story = StoryObj<typeof UserProfile>

export const Default: Story = {
  args: {
    user: {
      name: 'John Doe',
      email: 'john@example.com',
      avatar: ''
    }
  }
}
