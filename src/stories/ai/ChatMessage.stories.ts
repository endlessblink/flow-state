import type { Meta, StoryObj } from '@storybook/vue3'
import ChatMessage from '@/components/ai/ChatMessage.vue'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'
import type { Project } from '@/types/tasks'

const BINA_PROJECT_ID = '85accc3c-26ff-4a2c-ba07'

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

const weeklyLaneTasks: Task[] = [
  {
    id: 'task-primary',
    title: 'עבודה עם בינה מעצבת',
    description: '',
    status: 'todo',
    priority: 'high',
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: '2026-06-12',
    projectId: BINA_PROJECT_ID,
    createdAt: new Date('2026-06-01T08:00:00Z'),
    updatedAt: new Date('2026-06-07T08:00:00Z'),
  } as Task,
  {
    id: 'task-related-1',
    title: 'לעדכן את גלית מה צריך לבקש בעבודה שישנו כדי שיספיקו נכון',
    description: '',
    status: 'todo',
    priority: 'medium',
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: '2026-06-14',
    projectId: BINA_PROJECT_ID,
    createdAt: new Date('2026-06-01T08:00:00Z'),
    updatedAt: new Date('2026-06-07T08:00:00Z'),
  } as Task,
  {
    id: 'task-related-2',
    title: 'להכין לפרסם את העדכונים האחרונים של arthouse',
    description: '',
    status: 'todo',
    priority: 'medium',
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: '2026-06-12',
    projectId: 'my-projects',
    createdAt: new Date('2026-06-01T08:00:00Z'),
    updatedAt: new Date('2026-06-07T08:00:00Z'),
  } as Task,
  {
    id: 'task-publish',
    title: 'לפרסם את arthouse',
    description: '',
    status: 'todo',
    priority: 'high',
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: '2026-06-11',
    projectId: 'my-projects',
    createdAt: new Date('2026-06-01T08:00:00Z'),
    updatedAt: new Date('2026-06-07T08:00:00Z'),
  } as Task,
  {
    id: 'task-publish-related',
    title: 'לעבור על תוצאות arthouse ולסגור פעולה קטנה אחת',
    description: '',
    status: 'todo',
    priority: 'medium',
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: '2026-06-12',
    projectId: 'my-projects',
    createdAt: new Date('2026-06-01T08:00:00Z'),
    updatedAt: new Date('2026-06-07T08:00:00Z'),
  } as Task,
]

const weeklyLaneMessage = {
  id: 'msg-weekly-lane-story',
  role: 'assistant' as const,
  content: '',
  timestamp: Date.now(),
  isStreaming: false,
  metadata: {
    weeklyPlan: {
      schemaVersion: 'weekly-plan.v2' as const,
      requestId: 'req-week-lane-story',
      locale: 'he' as const,
      direction: 'rtl' as const,
      headline: 'שלושה נתיבי עבודה לשאר השבוע',
      weekRead: {
        summary: 'בחרתי נתיבים מתוך משימות קשורות, בלי להסתיר את הקשר ביניהן.',
        workloadReality: 'שני נתיבים מספיקים כדי לא להעמיס.',
        mainTradeoff: 'לא להפוך את זה לרשימת משימות שטוחה.',
      },
      presentation: { density: 'compact_after_clarification' as const },
      source: 'quick_draft' as const,
      recommendations: [
        {
          sectionId: 'lane-work',
          rank: 1,
          focusArea: 'מסירת עבודה',
          primaryTaskId: 'task-primary',
          relatedTaskIds: ['task-related-1', 'task-related-2'],
          recommendationType: 'protect' as const,
          title: 'עבודה עם בינה מעצבת',
          whyThisMatters: 'המשימות קשורות לאותו רצף עבודה, אז צריך לראות אותן ביחד.',
          whyThisWeek: 'זה נתיב עבודה אחד עם שלוש פעולות מחוברות, לא שלושה כרטיסים אקראיים.',
          riskIfIgnored: 'העבודה תישאר מפוזרת.',
          nextAction: 'בחר פתיחה של 10 דקות.',
          evidence: [
            { taskId: 'task-primary', field: 'dueIso', value: '2026-06-12', interpretation: 'today' },
            { taskId: 'task-related-1', field: 'status', value: 'todo', interpretation: 'open' },
          ],
          cardPlacement: 'immediately_after_explanation' as const,
        },
        {
          sectionId: 'lane-publish',
          rank: 2,
          focusArea: 'פרסום ותוכן',
          primaryTaskId: 'task-publish',
          relatedTaskIds: ['task-publish-related'],
          recommendationType: 'protect' as const,
          title: 'לפרסם את arthouse',
          whyThisMatters: 'זה רצף תוכן קטן שאפשר לסגור בלי לפתוח עוד חזית.',
          whyThisWeek: 'שני כרטיסים קשורים מספיקים לנתיב פרסום אחד ברור.',
          riskIfIgnored: 'הפרסום יידחה שוב.',
          nextAction: 'סגור פעולה קטנה אחת.',
          evidence: [
            { taskId: 'task-publish', field: 'dueIso', value: '2026-06-11', interpretation: 'overdue' },
            { taskId: 'task-publish-related', field: 'status', value: 'todo', interpretation: 'open' },
          ],
          cardPlacement: 'immediately_after_explanation' as const,
        },
      ],
      deferrals: [],
      openQuestions: [],
      quality: { selectedTaskCount: 2, confidence: 'medium' as const, caveats: [] },
    },
  },
}

function seedWeeklyLaneTasks() {
  const taskStore = useTaskStore()
  const projectStore = useProjectStore()
  projectStore._rawProjects.splice(0, projectStore._rawProjects.length, {
    id: BINA_PROJECT_ID,
    name: 'בינה מעצבת',
    color: '#14b8a6',
    colorType: 'hex',
    viewType: 'status',
    createdAt: new Date('2026-06-01T08:00:00Z'),
    updatedAt: new Date('2026-06-07T08:00:00Z'),
  } as Project)
  taskStore._rawTasks.splice(0, taskStore._rawTasks.length, ...weeklyLaneTasks)
}

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

export const WeeklyLaneBoard: Story = {
  render: () => ({
    components: { ChatMessage },
    setup() {
      seedWeeklyLaneTasks()
      return { message: weeklyLaneMessage }
    },
    template: `
      <div style="display: grid; gap: 24px; padding: 24px; background: #1f1d1a; color: #f5f1e8;">
        <section style="width: 560px; max-width: 100%;">
          <ChatMessage :message="message" />
        </section>
        <section class="message-weekly-plan-wide" style="width: min(1180px, 100%);">
          <ChatMessage :message="message" wide-mode />
        </section>
      </div>
    `,
  }),
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
