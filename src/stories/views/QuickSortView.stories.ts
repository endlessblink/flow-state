import type { Meta, StoryObj } from '@storybook/vue3'
import { ref, computed } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { Zap, X, CheckCircle } from 'lucide-vue-next'

// Import actual components
import QuickSortCard from '@/components/QuickSortCard.vue'
import CategorySelector from '@/components/layout/CategorySelector.vue'
import SortProgress from '@/components/tasks/SortProgress.vue'

// Import stores for mocking
import { useTaskStore, type Task, type Project } from '@/stores/tasks'

/**
 * QuickSortView - Rapid task categorization interface
 *
 * A full-screen triage interface for quickly categorizing uncategorized tasks.
 * Uses swipe gestures and keyboard shortcuts for speed.
 *
 * **When to use:**
 * - Process inbox overflow
 * - Weekly task review
 * - Rapid triage sessions
 *
 * **Components used:**
 * - QuickSortCard: Displays task details with priority/date editing
 * - CategorySelector: Project selection buttons
 * - SortProgress: Progress indicator
 */
const meta: Meta = {
  title: '✨ Views/QuickSortView',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `Full-screen task triage interface with glass morphism styling.

**Features:**
- Card-based task display with priority and due date quick-edit
- Keyboard shortcuts (D=Done, E=Edit, Del=Done+Delete, Space=Skip)
- Progress tracking with motivational messages
- Session statistics on completion
- Project category selector with nested projects support`
      }
    }
  }
}

export default meta
type Story = StoryObj

// Mock task data matching the actual Task interface
const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 't1',
  title: 'Review Q4 marketing proposal',
  description: 'Analyze the proposed budget allocation and timeline for approval.',
  priority: 'high',
  status: 'planned',
  dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
  completedPomodoros: 2,
  estimatedPomodoros: 4,
  subtasks: [
    { id: 's1', title: 'Read proposal document', isCompleted: true },
    { id: 's2', title: 'Check budget numbers', isCompleted: false },
    { id: 's3', title: 'Discuss with team', isCompleted: false }
  ],
  projectId: 'p1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
})

// Mock projects data
const mockProjects: Project[] = [
  { id: 'p1', name: 'Work', color: '#3b82f6', colorType: 'hex', userId: 'user1' },
  { id: 'p2', name: 'My Projects', color: '#22c55e', colorType: 'hex', userId: 'user1' },
  { id: 'p3', name: 'Home', color: '#f59e0b', colorType: 'hex', userId: 'user1' }
]

// Setup fresh Pinia with mock data
function setupMockStore() {
  const pinia = createPinia()
  setActivePinia(pinia)

  const taskStore = useTaskStore()

  // Initialize with mock projects
  taskStore.$patch({
    projects: mockProjects
  })

  return taskStore
}

/**
 * Default - Active Sorting State
 *
 * Shows the main interface with a task card ready for categorization.
 * This renders the ACTUAL components used in the app:
 * - QuickSortCard with priority buttons, due date shortcuts, and action icons
 * - CategorySelector with project buttons
 * - SortProgress indicator
 */
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: `Main sorting interface showing the actual QuickSortCard component with:
- Task title and description
- Project, date, and priority badges
- **PRIORITY** section with Low/Medium/High buttons
- **DUE DATE** section with Today/Tomorrow/Weekend/Next Week/Clear shortcuts
- **ACTIONS** section with Done (✓), Edit (✏), Delete (🗑) icons

Below the card is the CategorySelector with project buttons.`
      }
    }
  },
  render: () => ({
    components: { Zap, X, QuickSortCard, CategorySelector, SortProgress },
    setup() {
      // Setup mock store
      setupMockStore()

      const mockTask = ref(createMockTask())
      const currentIndex = ref(3)
      const totalTasks = ref(8)
      const motivationalMessage = ref('Keep going!')
      const currentStreak = ref(5)

      const handleUpdateTask = (updates: Partial<Task>) => {
        console.log('Task updated:', updates)
        // Update the mock task to show the change
        mockTask.value = { ...mockTask.value, ...updates }
      }

      const handleMarkDone = () => {
        console.log('Task marked done')
      }

      const handleEditTask = () => {
        console.log('Edit task clicked')
      }

      const handleMarkDoneAndDelete = () => {
        console.log('Task marked done and deleted')
      }

      const handleCategorize = (projectId: string) => {
        console.log('Categorized to project:', projectId)
      }

      const handleSkip = () => {
        console.log('Task skipped')
      }

      const handleCreateNew = () => {
        console.log('Create new project')
      }

      const handleExit = () => {
        console.log('Exit Quick Sort')
      }

      return {
        mockTask,
        currentIndex,
        totalTasks,
        motivationalMessage,
        currentStreak,
        handleUpdateTask,
        handleMarkDone,
        handleEditTask,
        handleMarkDoneAndDelete,
        handleCategorize,
        handleSkip,
        handleCreateNew,
        handleExit
      }
    },
    template: `
      <div style="
        min-height: 100vh;
        background: var(--app-background-gradient);
        padding: var(--space-8, 2rem);
        display: flex;
        flex-direction: column;
        gap: var(--space-8, 2rem);
      ">
        <!-- Header -->
        <header style="
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--space-6, 1.5rem);
        ">
          <div style="flex: 1;">
            <h1 style="
              display: flex;
              align-items: center;
              gap: var(--space-3, 0.75rem);
              font-size: var(--text-4xl, 2rem);
              font-weight: var(--font-bold, 700);
              color: var(--text-primary, #fff);
              margin: 0 0 var(--space-2, 0.5rem) 0;
            ">
              <Zap :size="32" />
              Quick Sort
            </h1>
            <p style="
              font-size: var(--text-base, 1rem);
              color: var(--text-secondary, rgba(255,255,255,0.6));
              margin: 0;
            ">
              Rapidly categorize your uncategorized tasks
            </p>
          </div>

          <button style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 48px;
            height: 48px;
            background: var(--glass-bg-medium, rgba(255,255,255,0.05));
            border: 1px solid var(--glass-border, rgba(255,255,255,0.08));
            border-radius: var(--radius-xl);
            color: var(--text-primary, #fff);
            cursor: pointer;
          " @click="handleExit">
            <X :size="24" />
          </button>
        </header>

        <!-- Main Content -->
        <div style="
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-8, 2rem);
          max-width: 800px;
          margin: 0 auto;
          width: 100%;
        ">
          <!-- Progress Indicator -->
          <SortProgress
            :current="currentIndex"
            :total="totalTasks"
            :message="motivationalMessage"
            :streak="currentStreak"
          />

          <!-- Task Card - ACTUAL COMPONENT -->
          <div style="width: 100%; display: flex; justify-content: center;">
            <QuickSortCard
              :task="mockTask"
              @update-task="handleUpdateTask"
              @mark-done="handleMarkDone"
              @edit-task="handleEditTask"
              @mark-done-and-delete="handleMarkDoneAndDelete"
            />
          </div>

          <!-- Category Selector - ACTUAL COMPONENT -->
          <CategorySelector
            @select="handleCategorize"
            @skip="handleSkip"
            @create-new="handleCreateNew"
          />
        </div>
      </div>
    `
  })
}

/**
 * Card Only - QuickSortCard Component
 *
 * Shows just the QuickSortCard component isolated for testing.
 */
export const CardOnly: Story = {
  parameters: {
    docs: {
      description: {
        story: `The QuickSortCard component in isolation showing:
- Task metadata (project badge, date, priority, subtasks, pomodoros)
- Priority quick-edit buttons
- Due date shortcuts with active state highlighting
- Action buttons (Done, Edit, Delete) with keyboard shortcuts`
      }
    }
  },
  render: () => ({
    components: { QuickSortCard },
    setup() {
      setupMockStore()

      const mockTask = ref(createMockTask({
        title: 'Prepare presentation slides',
        description: 'Create slides for the quarterly review meeting with stakeholders.',
        priority: 'medium',
        dueDate: new Date().toISOString() // Today - will highlight "Today" button
      }))

      const handleUpdateTask = (updates: Partial<Task>) => {
        console.log('Task updated:', updates)
        mockTask.value = { ...mockTask.value, ...updates }
      }

      return {
        mockTask,
        handleUpdateTask,
        handleMarkDone: () => console.log('Done'),
        handleEditTask: () => console.log('Edit'),
        handleMarkDoneAndDelete: () => console.log('Delete')
      }
    },
    template: `
      <div style="
        min-height: 100vh;
        background: var(--app-background-gradient);
        padding: var(--space-8);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <QuickSortCard
          :task="mockTask"
          @update-task="handleUpdateTask"
          @mark-done="handleMarkDone"
          @edit-task="handleEditTask"
          @mark-done-and-delete="handleMarkDoneAndDelete"
        />
      </div>
    `
  })
}

/**
 * Empty State - All Caught Up
 *
 * Shows when there are no uncategorized tasks to process.
 */
export const EmptyState: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Displayed when user has no uncategorized tasks remaining.'
      }
    }
  },
  render: () => ({
    components: { Zap, X, CheckCircle },
    setup() {
      const handleExit = () => console.log('Exit')
      return { handleExit }
    },
    template: `
      <div style="
        min-height: 100vh;
        background: var(--app-background-gradient);
        padding: var(--space-8, 2rem);
        display: flex;
        flex-direction: column;
        gap: var(--space-8, 2rem);
      ">
        <!-- Header -->
        <header style="
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        ">
          <div>
            <h1 style="
              display: flex;
              align-items: center;
              gap: var(--space-3);
              font-size: var(--text-4xl);
              font-weight: 700;
              color: var(--text-primary, #fff);
              margin: 0 0 var(--space-2) 0;
            ">
              <Zap :size="32" />
              Quick Sort
            </h1>
            <p style="color: var(--text-secondary, rgba(255,255,255,0.6)); margin: 0;">
              Rapidly categorize your uncategorized tasks
            </p>
          </div>
          <button style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 48px;
            height: 48px;
            background: var(--glass-bg-medium, rgba(255,255,255,0.05));
            border: 1px solid var(--glass-border, rgba(255,255,255,0.08));
            border-radius: var(--radius-xl);
            color: var(--text-primary, #fff);
            cursor: pointer;
          " @click="handleExit">
            <X :size="24" />
          </button>
        </header>

        <!-- Empty State -->
        <div style="
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-6);
          text-align: center;
          padding: var(--space-10);
        ">
          <CheckCircle :size="64" style="color: var(--color-success, #22c55e);" />
          <h2 style="
            font-size: var(--text-3xl);
            font-weight: 700;
            color: var(--text-primary, #fff);
            margin: 0;
          ">All Caught Up!</h2>
          <p style="
            font-size: var(--text-base);
            color: var(--text-secondary, rgba(255,255,255,0.6));
            margin: 0;
          ">You have no uncategorized tasks.</p>
          <button style="
            padding: var(--space-3) var(--space-6);
            background: transparent;
            border: 1px solid var(--brand-primary);
            border-radius: var(--radius-lg);
            color: var(--brand-primary);
            font-size: var(--text-base);
            font-weight: 600;
            cursor: pointer;
          " @click="handleExit">Return to Tasks</button>
        </div>
      </div>
    `
  })
}

/**
 * Completion State - Session Summary
 *
 * Shows statistics after completing a sorting session.
 */
export const CompletionState: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Session summary shown after all tasks have been categorized.'
      }
    }
  },
  render: () => ({
    components: { Zap, X, CheckCircle },
    setup() {
      const stats = {
        tasksProcessed: 12,
        timeSpent: '3:45',
        efficiency: 3.2,
        streakDays: 5
      }
      const handleExit = () => console.log('Exit')
      return { stats, handleExit }
    },
    template: `
      <div style="
        min-height: 100vh;
        background: var(--app-background-gradient);
        padding: var(--space-8);
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
      ">
        <!-- Header -->
        <header style="
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        ">
          <div>
            <h1 style="
              display: flex;
              align-items: center;
              gap: var(--space-3);
              font-size: var(--text-4xl);
              font-weight: 700;
              color: var(--text-primary, #fff);
              margin: 0 0 var(--space-2) 0;
            ">
              <Zap :size="32" />
              Quick Sort
            </h1>
            <p style="color: var(--text-secondary, rgba(255,255,255,0.6)); margin: 0;">
              Rapidly categorize your uncategorized tasks
            </p>
          </div>
          <button style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 48px;
            height: 48px;
            background: var(--glass-bg-medium, rgba(255,255,255,0.05));
            border: 1px solid var(--glass-border, rgba(255,255,255,0.08));
            border-radius: var(--radius-xl);
            color: var(--text-primary, #fff);
            cursor: pointer;
          " @click="handleExit">
            <X :size="24" />
          </button>
        </header>

        <!-- Completion State -->
        <div style="
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-8);
          text-align: center;
          padding: var(--space-8);
        ">
          <div style="font-size: 64px; animation: bounce 0.6s ease;">🎉</div>
          <h2 style="
            font-size: var(--text-3xl);
            font-weight: 700;
            color: var(--text-primary, #fff);
            margin: 0;
          ">Amazing Work!</h2>
          <p style="
            font-size: var(--text-base);
            color: var(--text-secondary, rgba(255,255,255,0.6));
            margin: 0;
          ">You've sorted all your tasks!</p>

          <!-- Stats Grid -->
          <div style="
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: var(--space-4);
            max-width: 600px;
            width: 100%;
          ">
            <div style="
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: var(--space-2);
              padding: var(--space-5) var(--space-4);
              background: var(--glass-bg-medium, rgba(255,255,255,0.05));
              border: 1px solid var(--glass-border, rgba(255,255,255,0.08));
              border-radius: var(--radius-xl);
            ">
              <span style="font-size: var(--text-3xl); font-weight: 700; color: var(--text-primary, #fff);">
                {{ stats.tasksProcessed }}
              </span>
              <span style="font-size: var(--text-xs); color: var(--text-muted, rgba(255,255,255,0.5)); text-transform: uppercase;">
                Tasks Sorted
              </span>
            </div>
            <div style="
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: var(--space-2);
              padding: var(--space-5) var(--space-4);
              background: var(--glass-bg-medium, rgba(255,255,255,0.05));
              border: 1px solid var(--glass-border, rgba(255,255,255,0.08));
              border-radius: var(--radius-xl);
            ">
              <span style="font-size: var(--text-3xl); font-weight: 700; color: var(--text-primary, #fff);">
                {{ stats.timeSpent }}
              </span>
              <span style="font-size: var(--text-xs); color: var(--text-muted, rgba(255,255,255,0.5)); text-transform: uppercase;">
                Time Taken
              </span>
            </div>
            <div style="
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: var(--space-2);
              padding: var(--space-5) var(--space-4);
              background: var(--glass-bg-medium, rgba(255,255,255,0.05));
              border: 1px solid var(--glass-border, rgba(255,255,255,0.08));
              border-radius: var(--radius-xl);
            ">
              <span style="font-size: var(--text-3xl); font-weight: 700; color: var(--text-primary, #fff);">
                {{ stats.efficiency }}
              </span>
              <span style="font-size: var(--text-xs); color: var(--text-muted, rgba(255,255,255,0.5)); text-transform: uppercase;">
                Tasks/Min
              </span>
            </div>
            <div style="
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: var(--space-2);
              padding: var(--space-5) var(--space-4);
              background: rgba(251, 146, 60, 0.1);
              border: 1px solid rgba(251, 146, 60, 0.3);
              border-radius: var(--radius-xl);
            ">
              <span style="font-size: var(--text-3xl); font-weight: 700; color: var(--text-primary, #fff);">
                🔥 {{ stats.streakDays }}
              </span>
              <span style="font-size: var(--text-xs); color: var(--text-muted, rgba(255,255,255,0.5)); text-transform: uppercase;">
                Day Streak
              </span>
            </div>
          </div>

          <button style="
            display: flex;
            align-items: center;
            gap: var(--space-2);
            padding: var(--space-3) var(--space-6);
            background: transparent;
            border: 1px solid var(--brand-primary);
            border-radius: var(--radius-lg);
            color: var(--brand-primary);
            font-size: var(--text-base);
            font-weight: 600;
            cursor: pointer;
          " @click="handleExit">
            <CheckCircle :size="20" />
            Done
          </button>
        </div>
      </div>
    `
  })
}
