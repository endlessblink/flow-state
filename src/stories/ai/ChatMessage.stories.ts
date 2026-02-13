import type { Meta, StoryObj } from '@storybook/vue3'
import ChatMessage from '@/components/ai/ChatMessage.vue'

const meta: Meta<typeof ChatMessage> = {
  title: '🤖 AI/ChatMessage',
  component: ChatMessage,
  tags: ['autodocs', 'new'],
  parameters: {
    docs: {
      description: {
        component: 'Single message in AI chat panel. Supports markdown, tool results, action buttons, and rich task cards. Handles streaming, thinking indicators, and copy functionality.'
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * User message with basic text
 */
export const UserMessage: Story = {
  args: {
    message: {
      id: 'msg-1',
      role: 'user',
      content: 'What tasks are overdue?',
      timestamp: Date.now(),
      isStreaming: false
    }
  }
}

/**
 * Assistant message with markdown formatting
 */
export const AssistantWithMarkdown: Story = {
  args: {
    message: {
      id: 'msg-2',
      role: 'assistant',
      content: `Here are your **overdue tasks**:

- Fix login bug (3 days overdue)
- Update documentation (1 day overdue)
- Review pull request (5 days overdue)

I recommend prioritizing the login bug since it affects users directly.`,
      timestamp: Date.now(),
      isStreaming: false
    }
  }
}

/**
 * Assistant message with tool result - task list
 */
export const WithToolResult: Story = {
  args: {
    message: {
      id: 'msg-3',
      role: 'assistant',
      content: 'I found 2 overdue tasks.',
      timestamp: Date.now(),
      isStreaming: false,
      metadata: {
        toolResults: [{
          tool: 'get_overdue_tasks',
          message: 'Retrieved 2 overdue tasks',
          success: true,
          type: 'read',
          data: [
            {
              id: 'task-1',
              title: 'Fix critical production bug',
              priority: 'urgent',
              dueDate: '2026-02-10',
              daysOverdue: 3,
              status: 'in_progress'
            },
            {
              id: 'task-2',
              title: 'Update API documentation',
              priority: 'medium',
              dueDate: '2026-02-12',
              daysOverdue: 1,
              status: 'planned'
            }
          ]
        }]
      }
    }
  }
}

/**
 * Streaming message with thinking indicator
 */
export const Thinking: Story = {
  args: {
    message: {
      id: 'msg-4',
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true
    }
  }
}

/**
 * Streaming message with content being generated
 */
export const StreamingContent: Story = {
  args: {
    message: {
      id: 'msg-5',
      role: 'assistant',
      content: 'Let me help you with that. I can see that you have several',
      timestamp: Date.now(),
      isStreaming: true
    }
  }
}

/**
 * Message with error state
 */
export const WithError: Story = {
  args: {
    message: {
      id: 'msg-6',
      role: 'assistant',
      content: 'Failed to retrieve tasks.',
      timestamp: Date.now(),
      isStreaming: false,
      error: 'Database connection timeout after 30 seconds'
    }
  }
}

/**
 * Daily summary with stats grid
 */
export const DailySummary: Story = {
  args: {
    message: {
      id: 'msg-7',
      role: 'assistant',
      content: 'Here is your daily summary:',
      timestamp: Date.now(),
      isStreaming: false,
      metadata: {
        toolResults: [{
          tool: 'get_daily_summary',
          message: 'Daily summary for February 13, 2026',
          success: true,
          type: 'read',
          data: {
            totalTasks: 24,
            inProgress: 5,
            completedToday: 3,
            dueToday: 4,
            overdueCount: 2,
            timerSessionsCompleted: 6,
            overdueTasks: [
              {
                id: 'task-1',
                title: 'Review security audit report',
                priority: 'urgent',
                dueDate: '2026-02-10',
                daysOverdue: 3
              }
            ],
            dueTodayTasks: [
              {
                id: 'task-2',
                title: 'Weekly team standup',
                priority: 'medium',
                status: 'planned'
              }
            ]
          }
        }]
      }
    }
  }
}
