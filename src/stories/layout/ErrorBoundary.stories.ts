import ErrorBoundary from '@/components/common/ErrorBoundary.vue'
import { defineComponent, ref } from 'vue'

const meta = {
  title: '🏢 Layout/ErrorBoundary',
  component: ErrorBoundary,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
}

export default meta

// Component that throws an error on demand
const ErrorThrower = defineComponent({
  props: { shouldThrow: { type: Boolean, default: false } },
  setup(props) {
    if (props.shouldThrow) {
      throw new Error('Something went wrong in the child component!\n\nThis is a simulated error to demonstrate the ErrorBoundary UI.')
    }
    return () => null
  },
})

export const ErrorState = {
  render: () => ({
    components: { ErrorBoundary, ErrorThrower },
    template: `
      <div style="width: 700px; min-height: 400px;">
        <ErrorBoundary contained>
          <ErrorThrower :shouldThrow="true" />
        </ErrorBoundary>
      </div>
    `,
  }),
}

export const HealthyState = {
  render: () => ({
    components: { ErrorBoundary },
    template: `
      <div style="width: 400px; padding: var(--space-6); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-lg);">
        <ErrorBoundary>
          <div style="color: var(--text-primary); font-size: var(--text-sm);">
            <p style="margin: 0 0 var(--space-2) 0; font-weight: 500;">Healthy Content</p>
            <p style="margin: 0; color: var(--text-secondary);">This content is wrapped in an ErrorBoundary. When no error occurs, the slot content renders normally.</p>
          </div>
        </ErrorBoundary>
      </div>
    `,
  }),
}
