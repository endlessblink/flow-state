import type { Meta, StoryObj } from '@storybook/vue3'
import CalendarStatusOverlays from '@/components/calendar/CalendarStatusOverlays.vue'

const meta: Meta<typeof CalendarStatusOverlays> = {
  title: '📅 Calendar/CalendarStatusOverlays',
  component: CalendarStatusOverlays,
  tags: ['autodocs', 'new']
}

export default meta
type Story = StoryObj<typeof CalendarStatusOverlays>

export const Healthy: Story = {
  args: {
    systemHealthy: true,
    systemHealthMessage: '',
    operationError: null,
    operationLoading: {
      loading: false,
      syncing: false
    }
  }
}

export const DegradedMode: Story = {
  args: {
    systemHealthy: false,
    systemHealthMessage: 'Calendar store failed to initialize. Running in degraded mode.',
    operationError: null,
    operationLoading: {
      loading: false,
      syncing: false
    }
  }
}

export const Loading: Story = {
  args: {
    systemHealthy: true,
    systemHealthMessage: '',
    operationError: null,
    operationLoading: {
      loading: true,
      syncing: false
    }
  }
}

export const Syncing: Story = {
  args: {
    systemHealthy: true,
    systemHealthMessage: '',
    operationError: null,
    operationLoading: {
      loading: false,
      syncing: true
    }
  }
}

export const WithError: Story = {
  args: {
    systemHealthy: true,
    systemHealthMessage: '',
    operationError: {
      type: 'Network Error',
      message: 'Failed to sync calendar events. Check your connection.',
      retryable: true
    },
    operationLoading: {
      loading: false,
      syncing: false
    }
  }
}

export const SystemRestartError: Story = {
  args: {
    systemHealthy: true,
    systemHealthMessage: '',
    operationError: {
      type: 'System Restart',
      message: 'Critical error detected. Please refresh the page.',
      retryable: false
    },
    operationLoading: {
      loading: false,
      syncing: false
    }
  }
}
