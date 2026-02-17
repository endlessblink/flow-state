import type { Meta, StoryObj } from '@storybook/vue3'
import SignupForm from '@/components/auth/SignupForm.vue'

const meta: Meta<typeof SignupForm> = {
  title: '🔐 Auth/SignupForm',
  component: SignupForm,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (story) => ({
      components: { story },
      template: `
        <div style="padding: var(--space-10); background: var(--app-background-gradient); border-radius: var(--radius-xl); min-width: 25rem;">
          <story />
        </div>
      `
    })
  ],
}

export default meta
type Story = StoryObj<typeof SignupForm>

export const Default: Story = {
  args: {
    loading: false
  }
}

export const Loading: Story = {
  args: {
    loading: true
  }
}
