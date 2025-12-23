import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'

// Component that intentionally throws an error
const ErrorComponent = {
  template: '<div>This component will throw an error</div>',
  mounted() {
    throw new Error('Intentional test error')
  }
}

// Normal component
const NormalComponent = {
  template: '<div style="padding: 20px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; color: var(--text-primary);">✅ This component works fine</div>'
}

const meta = {
  component: ErrorBoundary,
  title: '🏢 Layout/ErrorBoundary',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      story: {
        height: '500px',
      },
    },
  },
  argTypes: {
    fallbackMessage: {
      control: 'text',
      description: 'Custom fallback message to display when an error occurs',
    },
    contained: {
      control: 'boolean',
      description: 'When true, renders inline with glass morphism instead of fixed overlay',
    },
  },
} satisfies Meta<typeof ErrorBoundary>

export default meta
type Story = StoryObj<typeof meta>

export const NormalOperation: Story = {
  render: () => ({
    components: { ErrorBoundary, NormalComponent },
    template: `
      <div style="padding: 40px; min-height: 400px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Error Boundary - Normal Operation</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">When no errors occur</p>

        <ErrorBoundary>
          <NormalComponent />
        </ErrorBoundary>

        <div style="margin-top: 24px; padding: 16px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Error Boundary Benefits</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            <li><strong style="color: var(--text-primary);">Graceful degradation</strong> - App continues working</li>
            <li><strong style="color: var(--text-primary);">Error isolation</strong> - Contains failures to component boundaries</li>
          </ul>
        </div>
      </div>
    `,
  })
}

export const SynchronousError: Story = {
  render: () => ({
    components: { ErrorBoundary, ErrorComponent },
    setup() {
      const hasError = ref(true)
      const retryKey = ref(0)

      const retry = () => {
        retryKey.value++
        hasError.value = false
        setTimeout(() => {
          hasError.value = true
        }, 100)
      }

      return { hasError, retryKey, retry }
    },
    template: `
      <div style="padding: 40px; min-width: 600px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Error Boundary - Synchronous Error</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Handling component mounting errors</p>

        <ErrorBoundary
          :key="retryKey"
          contained
          @error="(error: any) => console.error('Caught error:', error)"
        >
          <ErrorComponent v-if="hasError" />
          <div v-else style="padding: 20px; background: rgba(78, 205, 196, 0.1); border: 1px solid rgba(78, 205, 196, 0.5); border-radius: 12px; color: rgba(78, 205, 196, 1); text-align: center;">
            ✅ Component loaded successfully
          </div>
        </ErrorBoundary>

        <div style="margin-top: 24px; text-align: center;">
          <button
            @click="retry"
            style="padding: 12px 24px; background: transparent; border: 1px solid rgba(78, 205, 196, 0.5); color: rgba(78, 205, 196, 1); border-radius: 8px; cursor: pointer; transition: all 0.2s ease;"
          >
            Retry Error
          </button>
        </div>
      </div>
    `,
  })
}
