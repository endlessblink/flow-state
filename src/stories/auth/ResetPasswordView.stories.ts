import type { Meta, StoryObj } from '@storybook/vue3'
import ResetPasswordView from '@/components/auth/ResetPasswordView.vue'
import { ref } from 'vue'

const meta: Meta<typeof ResetPasswordView> = {
  title: 'Auth/ResetPasswordView',
  component: ResetPasswordView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      story: {
        inline: true,
      }
    }
  },
  decorators: [
    () => ({
      template: `
        <div class="reset-password-story-container" style="
          background: var(--glass-bg-solid);
          height: 600px;
          width: 100%;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
        ">
          <!-- Force absolute positioning for the container within this wrapper -->
          <style>
             .reset-password-story-container .auth-container {
               margin: 0 !important;
               max-height: 90% !important;
               overflow-y: auto !important;
             }
          </style>
          <story />
        </div>
      `
    })
  ]
}

export default meta
type Story = StoryObj<typeof ResetPasswordView>

export const Default: Story = {
  name: 'Default View',
  args: {
    email: '',
    isLoading: false,
    errorMessage: null,
    successMessage: null
  }
}

export const Loading: Story = {
  name: 'Loading State',
  args: {
    email: 'test@example.com',
    isLoading: true,
    errorMessage: null,
    successMessage: null
  }
}

export const Success: Story = {
  name: 'Success State',
  args: {
    email: 'test@example.com',
    isLoading: false,
    errorMessage: null,
    successMessage: 'Password reset link sent! Check your inbox.'
  }
}

export const WithError: Story = {
  name: 'Error State',
  args: {
    email: 'invalid-email',
    isLoading: false,
    errorMessage: 'Please enter a valid email address',
    successMessage: null
  }
}