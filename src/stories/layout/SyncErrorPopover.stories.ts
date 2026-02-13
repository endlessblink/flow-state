import type { Meta, StoryObj } from '@storybook/vue3'
import SyncErrorPopover from '@/components/sync/SyncErrorPopover.vue'

const meta: Meta<typeof SyncErrorPopover> = {
  title: '🏢 Layout/SyncErrorPopover',
  component: SyncErrorPopover,
  tags: ['autodocs', 'new'],
  parameters: {
    docs: {
      description: {
        component: 'Detailed sync error overlay. Shows list of failed operations with entity info, retry counts, and actions. Classifies errors as retryable or permanent.'
      }
    }
  },
  argTypes: {
    errors: {
      description: 'Array of WriteOperation objects with failure details'
    },
    lastError: {
      description: 'Most recent error message for summary display'
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

const mockErrors = [
  {
    id: '1',
    entityType: 'task' as const,
    entityId: 'task-123',
    operation: 'update' as const,
    data: {},
    retryCount: 2,
    lastError: 'Network timeout after 30 seconds',
    lastAttemptAt: Date.now() - 120000,
    createdAt: Date.now() - 300000
  },
  {
    id: '2',
    entityType: 'group' as const,
    entityId: 'group-456',
    operation: 'create' as const,
    data: {},
    retryCount: 1,
    lastError: 'duplicate key value violates unique constraint',
    lastAttemptAt: Date.now() - 60000,
    createdAt: Date.now() - 180000
  }
]

/**
 * Popover with multiple failed operations
 */
export const WithErrors: Story = {
  args: {
    errors: mockErrors,
    lastError: 'Network timeout - 2 operations failed'
  }
}

/**
 * Single permanent error (corrupted data)
 */
export const PermanentError: Story = {
  args: {
    errors: [{
      id: '3',
      entityType: 'task' as const,
      entityId: 'task-789',
      operation: 'update' as const,
      data: {},
      retryCount: 5,
      lastError: 'Task data corrupted: missing required field "title"',
      lastAttemptAt: Date.now() - 30000,
      createdAt: Date.now() - 600000
    }],
    lastError: 'Task data corrupted'
  }
}

/**
 * Empty error list (should not render in real usage)
 */
export const Empty: Story = {
  args: {
    errors: [],
    lastError: undefined
  }
}
