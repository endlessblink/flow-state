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

// Component with async error
const AsyncErrorComponent = {
  template: '<div @click="triggerError">Click to trigger async error</div>',
  setup() {
    const triggerError = () => {
      setTimeout(() => {
        throw new Error('Async error triggered')
      }, 100)
    }
    return { triggerError }
  }
}

// Normal component
const NormalComponent = {
  template: '<div style="padding: 20px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; color: var(--text-primary);">✅ This component works fine</div>'
}

const meta = {
  component: ErrorBoundary,
  title: '🧩 Components/📝 Form Controls/ErrorBoundary',
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

// Normal operation
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
            <li><strong style="color: var(--text-primary);">User feedback</strong> - Shows helpful error messages</li>
            <li><strong style="color: var(--text-primary);">Development tools</strong> - Detailed error info in development</li>
            <li><strong style="color: var(--text-primary);">Recovery options</strong> - Retry mechanisms and fallbacks</li>
          </ul>
        </div>
      </div>
    `,
  })
}

// Synchronous error
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
          @error="(error) => console.error('Caught error:', error)"
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

        <div style="margin-top: 24px; padding: 16px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Error Handling Features</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            <li><strong style="color: var(--text-primary);">Error capture</strong> - Catches both sync and async errors</li>
            <li><strong style="color: var(--text-primary);">Fallback UI</strong> - Shows user-friendly error state</li>
            <li><strong style="color: var(--text-primary);">Error logging</strong> - Emits error events for debugging</li>
            <li><strong style="color: var(--text-primary);">Retry mechanism</strong> - Allows error recovery attempts</li>
            <li><strong style="color: var(--text-primary);">Component isolation</strong> - Prevents app crashes</li>
          </ul>
        </div>
      </div>
    `,
  })
}

// Custom fallback
export const CustomFallback: Story = {
  args: {
    fallbackMessage: 'Something went wrong with this component. Please try refreshing the page.',
  },
  render: (args) => ({
    components: { ErrorBoundary, ErrorComponent },
    setup() {
      const customFallback = ref(args.fallbackMessage)
      return { customFallback }
    },
    template: `
      <div style="padding: 40px; min-width: 600px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Error Boundary - Custom Fallback</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Custom error messages and recovery options</p>

        <ErrorBoundary :fallback-message="customFallback" contained>
          <ErrorComponent />
        </ErrorBoundary>

        <div style="margin-top: 24px; padding: 16px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Customization Options</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            <li><strong style="color: var(--text-primary);">Custom messages</strong> - Tailored error text</li>
            <li><strong style="color: var(--text-primary);">Branding consistency</strong> - Match app design</li>
            <li><strong style="color: var(--text-primary);">Action buttons</strong> - Retry, report, dismiss options</li>
            <li><strong style="color: var(--text-primary);">Context awareness</strong> - Location-specific errors</li>
            <li><strong style="color: var(--text-primary);">Recovery guidance</strong> - Help users fix issues</li>
          </ul>
        </div>
      </div>
    `,
  })
}

// Multiple error boundaries
export const MultipleBoundaries: Story = {
  render: () => ({
    components: { ErrorBoundary, ErrorComponent, NormalComponent },
    setup() {
      const sections = [
        { id: 1, title: 'Working Component', hasError: false },
        { id: 2, title: 'Error Component', hasError: true },
        { id: 3, title: 'Another Working', hasError: false },
        { id: 4, title: 'Error Component 2', hasError: true },
      ]

      return { sections }
    },
    template: `
      <div style="padding: 40px; min-width: 700px; background: rgba(0, 0, 0, 0.95);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Multiple Error Boundaries</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Isolated error handling for different sections</p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div
            v-for="section in sections"
            :key="section.id"
            style="display: flex; flex-direction: column; gap: 8px;"
          >
            <h4 style="margin: 0; font-size: 14px; color: var(--text-primary);">{{ section.title }}</h4>
            <ErrorBoundary contained>
              <ErrorComponent v-if="section.hasError" />
              <NormalComponent v-else />
            </ErrorBoundary>
          </div>
        </div>

        <div style="margin-top: 32px; padding: 20px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Error Isolation Benefits</h4>
          <div style="font-size: 14px; color: var(--text-secondary); line-height: 1.6;">
            <p><strong style="color: var(--text-primary);">Partial failures don't crash the entire app</strong></p>
            <p>Each section is wrapped in its own error boundary, so when one component fails:</p>
            <ul style="margin: 12px 0 0 20px; padding-left: 20px;">
              <li>Only that section shows an error</li>
              <li>Other sections continue working normally</li>
              <li>User can still interact with functional parts</li>
              <li>Error recovery can be attempted per-section</li>
            </ul>
          </div>
        </div>
      </div>
    `,
  })
}