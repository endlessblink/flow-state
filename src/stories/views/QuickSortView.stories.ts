import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import { Zap, X, CheckCircle, Undo2, SkipForward, LayoutGrid, Timer, Flag } from 'lucide-vue-next'

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
 */
const meta: Meta = {
  title: '✨ Features/QuickSortView',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `Full-screen task triage interface with glass morphism styling.

**Features:**
- Card-based task display with swipe gestures
- Keyboard shortcuts (D=Done, Space=Skip, Ctrl+Z=Undo)
- Progress tracking with motivational messages
- Session statistics on completion
- Project category selector`
      }
    }
  }
}

export default meta
type Story = StoryObj

// Mock data
const mockTask = {
  id: 't1',
  title: 'Review Q4 marketing proposal',
  description: 'Analyze the proposed budget allocation and timeline for approval.',
  priority: 'high',
  dueDate: '2025-01-15',
  completedPomodoros: 2,
  subtasks: [
    { id: 's1', title: 'Read proposal document', isCompleted: true },
    { id: 's2', title: 'Check budget numbers', isCompleted: false },
    { id: 's3', title: 'Discuss with team', isCompleted: false }
  ]
}

const mockProjects = [
  { id: 'p1', name: 'Work', color: '#3b82f6' },
  { id: 'p2', name: 'Personal', color: '#22c55e' },
  { id: 'p3', name: 'Side Project', color: '#f59e0b' }
]

/**
 * Default - Active Sorting State
 *
 * Shows the main interface with a task card ready for categorization.
 */
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Main sorting interface with task card, progress bar, and category selector.'
      }
    }
  },
  render: () => ({
    components: { Zap, X, CheckCircle, Undo2, SkipForward, LayoutGrid, Timer, Flag },
    setup() {
      const currentIndex = ref(3)
      const totalTasks = ref(8)

      return { mockTask, mockProjects, currentIndex, totalTasks }
    },
    template: `
      <div style="
        min-height: 100vh;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
        padding: 2rem;
        display: flex;
        flex-direction: column;
        gap: 2rem;
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
              gap: 0.75rem;
              font-size: 2rem;
              font-weight: 700;
              color: var(--text-primary, #fff);
              margin: 0 0 0.5rem 0;
            ">
              <Zap :size="32" style="color: var(--color-work, #3b82f6);" />
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
            border-radius: 12px;
            color: var(--text-primary, #fff);
            cursor: pointer;
          ">
            <X :size="24" />
          </button>
        </header>

        <!-- Main Content -->
        <div style="
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
          max-width: 800px;
          margin: 0 auto;
          width: 100%;
        ">
          <!-- Progress -->
          <div style="
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          ">
            <div style="
              display: flex;
              justify-content: space-between;
              font-size: 0.875rem;
              color: var(--text-secondary, rgba(255,255,255,0.6));
            ">
              <span>{{ currentIndex }} of {{ totalTasks }} tasks</span>
              <span>Keep going! 🔥</span>
            </div>
            <div style="
              height: 6px;
              background: var(--glass-bg-heavy, rgba(255,255,255,0.1));
              border-radius: 3px;
              overflow: hidden;
            ">
              <div style="
                height: 100%;
                width: 37.5%;
                background: var(--color-work, #3b82f6);
                border-radius: 3px;
                transition: width 0.3s ease;
              "></div>
            </div>
          </div>

          <!-- Task Card -->
          <div style="
            width: 100%;
            background: var(--glass-bg-solid, rgba(15,15,20,0.98));
            border: 1px solid var(--glass-border, rgba(255,255,255,0.08));
            border-radius: 16px;
            padding: 1.5rem;
            display: flex;
            flex-direction: column;
            gap: 1rem;
          ">
            <!-- Card Header -->
            <div style="display: flex; justify-content: space-between; align-items: start;">
              <div style="
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.25rem 0.75rem;
                background: rgba(239, 68, 68, 0.15);
                border: 1px solid rgba(239, 68, 68, 0.3);
                border-radius: 6px;
                color: #ef4444;
                font-size: 0.75rem;
                font-weight: 600;
              ">
                <Flag :size="12" />
                HIGH
              </div>
              <span style="
                font-size: 0.8125rem;
                color: var(--text-secondary, rgba(255,255,255,0.6));
              ">Due: Jan 15</span>
            </div>

            <!-- Task Title -->
            <h2 style="
              font-size: 1.25rem;
              font-weight: 600;
              color: var(--text-primary, #fff);
              margin: 0;
            ">{{ mockTask.title }}</h2>

            <!-- Description -->
            <p style="
              font-size: 0.875rem;
              color: var(--text-secondary, rgba(255,255,255,0.7));
              margin: 0;
              line-height: 1.5;
            ">{{ mockTask.description }}</p>

            <!-- Metadata -->
            <div style="
              display: flex;
              gap: 1rem;
              font-size: 0.8125rem;
              color: var(--text-muted, rgba(255,255,255,0.5));
            ">
              <span style="display: flex; align-items: center; gap: 0.375rem;">
                <Timer :size="14" />
                {{ mockTask.completedPomodoros }} pomodoros
              </span>
              <span style="display: flex; align-items: center; gap: 0.375rem;">
                <CheckCircle :size="14" />
                1/3 subtasks
              </span>
            </div>
          </div>

          <!-- Category Selector -->
          <div style="
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          ">
            <span style="
              font-size: 0.8125rem;
              color: var(--text-secondary, rgba(255,255,255,0.6));
              text-align: center;
            ">Assign to project:</span>
            <div style="
              display: flex;
              gap: 0.75rem;
              justify-content: center;
              flex-wrap: wrap;
            ">
              <button
                v-for="project in mockProjects"
                :key="project.id"
                style="
                  display: flex;
                  align-items: center;
                  gap: 0.5rem;
                  padding: 0.625rem 1rem;
                  background: var(--glass-bg-medium, rgba(255,255,255,0.05));
                  border: 1px solid var(--glass-border, rgba(255,255,255,0.08));
                  border-radius: 8px;
                  color: var(--text-primary, #fff);
                  font-size: 0.875rem;
                  cursor: pointer;
                "
              >
                <span :style="{ width: '10px', height: '10px', borderRadius: '50%', border: '2px solid ' + project.color, background: 'transparent' }"></span>
                {{ project.name }}
              </button>
            </div>
          </div>

          <!-- Action Buttons -->
          <div style="
            display: flex;
            gap: 0.75rem;
            justify-content: center;
          ">
            <button style="
              display: flex;
              align-items: center;
              gap: 0.5rem;
              padding: 0.75rem 1.25rem;
              background: var(--glass-bg-medium, rgba(255,255,255,0.05));
              border: 1px solid var(--glass-border, rgba(255,255,255,0.08));
              border-radius: 10px;
              color: var(--text-primary, #fff);
              font-size: 0.875rem;
              cursor: pointer;
            ">
              <Undo2 :size="18" />
              Undo
              <kbd style="
                margin-left: 0.5rem;
                padding: 0.125rem 0.375rem;
                background: var(--glass-bg-heavy, rgba(255,255,255,0.1));
                border-radius: 4px;
                font-size: 0.75rem;
              ">Ctrl+Z</kbd>
            </button>
            <button style="
              display: flex;
              align-items: center;
              gap: 0.5rem;
              padding: 0.75rem 1.25rem;
              background: var(--glass-bg-medium, rgba(255,255,255,0.05));
              border: 1px solid var(--glass-border, rgba(255,255,255,0.08));
              border-radius: 10px;
              color: var(--text-primary, #fff);
              font-size: 0.875rem;
              cursor: pointer;
            ">
              <SkipForward :size="18" />
              Skip
              <kbd style="
                margin-left: 0.5rem;
                padding: 0.125rem 0.375rem;
                background: var(--glass-bg-heavy, rgba(255,255,255,0.1));
                border-radius: 4px;
                font-size: 0.75rem;
              ">Space</kbd>
            </button>
          </div>
        </div>
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
    template: `
      <div style="
        min-height: 100vh;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
        padding: 2rem;
        display: flex;
        flex-direction: column;
        gap: 2rem;
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
              gap: 0.75rem;
              font-size: 2rem;
              font-weight: 700;
              color: var(--text-primary, #fff);
              margin: 0 0 0.5rem 0;
            ">
              <Zap :size="32" style="color: var(--color-work, #3b82f6);" />
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
            border-radius: 12px;
            color: var(--text-primary, #fff);
            cursor: pointer;
          ">
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
          gap: 1.5rem;
          text-align: center;
          padding: 3rem;
        ">
          <CheckCircle :size="64" style="color: var(--color-success, #22c55e);" />
          <h2 style="
            font-size: 1.75rem;
            font-weight: 700;
            color: var(--text-primary, #fff);
            margin: 0;
          ">All Caught Up!</h2>
          <p style="
            font-size: 1rem;
            color: var(--text-secondary, rgba(255,255,255,0.6));
            margin: 0;
          ">You have no uncategorized tasks.</p>
          <button style="
            padding: 0.75rem 1.5rem;
            background: transparent;
            border: 1px solid var(--color-work, #3b82f6);
            border-radius: 10px;
            color: var(--color-work, #3b82f6);
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
          ">Return to Tasks</button>
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
      return { stats }
    },
    template: `
      <div style="
        min-height: 100vh;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
        padding: 2rem;
        display: flex;
        flex-direction: column;
        gap: 2rem;
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
              gap: 0.75rem;
              font-size: 2rem;
              font-weight: 700;
              color: var(--text-primary, #fff);
              margin: 0 0 0.5rem 0;
            ">
              <Zap :size="32" style="color: var(--color-work, #3b82f6);" />
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
            border-radius: 12px;
            color: var(--text-primary, #fff);
            cursor: pointer;
          ">
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
          gap: 2rem;
          text-align: center;
          padding: 2rem;
        ">
          <div style="font-size: 64px; animation: bounce 0.6s ease;">🎉</div>
          <h2 style="
            font-size: 1.75rem;
            font-weight: 700;
            color: var(--text-primary, #fff);
            margin: 0;
          ">Amazing Work!</h2>
          <p style="
            font-size: 1rem;
            color: var(--text-secondary, rgba(255,255,255,0.6));
            margin: 0;
          ">You've sorted all your tasks!</p>

          <!-- Stats Grid -->
          <div style="
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1rem;
            max-width: 600px;
            width: 100%;
          ">
            <div style="
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 0.5rem;
              padding: 1.25rem 1rem;
              background: var(--glass-bg-medium, rgba(255,255,255,0.05));
              border: 1px solid var(--glass-border, rgba(255,255,255,0.08));
              border-radius: 12px;
            ">
              <span style="font-size: 1.75rem; font-weight: 700; color: var(--text-primary, #fff);">
                {{ stats.tasksProcessed }}
              </span>
              <span style="font-size: 0.75rem; color: var(--text-muted, rgba(255,255,255,0.5)); text-transform: uppercase;">
                Tasks Sorted
              </span>
            </div>
            <div style="
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 0.5rem;
              padding: 1.25rem 1rem;
              background: var(--glass-bg-medium, rgba(255,255,255,0.05));
              border: 1px solid var(--glass-border, rgba(255,255,255,0.08));
              border-radius: 12px;
            ">
              <span style="font-size: 1.75rem; font-weight: 700; color: var(--text-primary, #fff);">
                {{ stats.timeSpent }}
              </span>
              <span style="font-size: 0.75rem; color: var(--text-muted, rgba(255,255,255,0.5)); text-transform: uppercase;">
                Time Taken
              </span>
            </div>
            <div style="
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 0.5rem;
              padding: 1.25rem 1rem;
              background: var(--glass-bg-medium, rgba(255,255,255,0.05));
              border: 1px solid var(--glass-border, rgba(255,255,255,0.08));
              border-radius: 12px;
            ">
              <span style="font-size: 1.75rem; font-weight: 700; color: var(--text-primary, #fff);">
                {{ stats.efficiency }}
              </span>
              <span style="font-size: 0.75rem; color: var(--text-muted, rgba(255,255,255,0.5)); text-transform: uppercase;">
                Tasks/Min
              </span>
            </div>
            <div style="
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 0.5rem;
              padding: 1.25rem 1rem;
              background: rgba(251, 146, 60, 0.1);
              border: 1px solid rgba(251, 146, 60, 0.3);
              border-radius: 12px;
            ">
              <span style="font-size: 1.75rem; font-weight: 700; color: var(--text-primary, #fff);">
                🔥 {{ stats.streakDays }}
              </span>
              <span style="font-size: 0.75rem; color: var(--text-muted, rgba(255,255,255,0.5)); text-transform: uppercase;">
                Day Streak
              </span>
            </div>
          </div>

          <button style="
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1.5rem;
            background: transparent;
            border: 1px solid var(--color-work, #3b82f6);
            border-radius: 10px;
            color: var(--color-work, #3b82f6);
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
          ">
            <CheckCircle :size="20" />
            Done
          </button>
        </div>
      </div>
    `
  })
}
