import type { Meta, StoryObj } from '@storybook/vue3'

/**
 * FocusView - Minimalist Focus Mode
 *
 * Distraction-free focus mode for single-task concentration.
 * Accessible via the Eye icon on task cards/rows, or `/focus/:taskId`.
 *
 * **Features:**
 * - Large timer display (accent color, green for breaks)
 * - Task title + description
 * - Interactive subtask checklist
 * - Start/Pause/Resume/Complete/Skip controls
 * - Keyboard shortcuts: Space (timer), C (complete), Esc (back)
 * - Auto-start timer on mount
 * - Responsive layout
 *
 * **Store Dependencies:**
 * - taskStore: Current task data, subtask toggling
 * - timerStore: Timer control (start/pause/resume/stop)
 */
const meta: Meta = {
  title: '✨ Views/FocusView',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `Minimalist focus mode for single-task concentration.

**Purpose:**
Distraction-free environment for deep work on a single task.

**Features:**
- Large task title display with description
- Integrated Pomodoro timer (accent color, green during breaks)
- Interactive subtask checklist (click to toggle)
- Minimal controls: Start/Pause/Resume, Complete, Skip
- Keyboard shortcuts: Space (timer toggle), C (complete), Esc (skip/back)
- Dark ambient background with radial gradient
- Responsive layout (stacked buttons on mobile)

**Route:** \`/focus/:taskId\` (requires auth)
**Entry points:** Eye icon on task cards (kanban) and task rows (table view)`
      }
    }
  }
}

export default meta
type Story = StoryObj

// Shared CSS that mirrors the actual FocusView.vue scoped styles using design tokens
const focusStyles = `
  <style>
    .focus-view {
      min-height: 100vh;
      background: radial-gradient(circle at center, rgba(var(--color-slate-900), 1) 0%, rgba(var(--color-slate-950), 1) 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-8);
      text-align: center;
    }
    .focus-timer {
      font-size: 5rem;
      font-weight: 700;
      color: var(--color-accent);
      margin-bottom: var(--space-8);
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
    }
    .focus-timer--break {
      color: var(--color-success);
    }
    .focus-title {
      font-size: var(--text-4xl);
      font-weight: var(--font-bold);
      color: var(--text-primary);
      margin-bottom: var(--space-4);
      max-width: 800px;
      line-height: 1.3;
    }
    .focus-description {
      font-size: var(--text-lg);
      color: var(--text-secondary);
      margin-bottom: var(--space-8);
      max-width: 600px;
      line-height: 1.6;
    }
    .focus-subtasks {
      margin-bottom: var(--space-8);
      text-align: left;
    }
    .focus-subtask {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-bottom: var(--space-3);
      font-size: var(--text-base);
      color: var(--text-primary);
      cursor: pointer;
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-sm);
      transition: background var(--duration-fast);
    }
    .focus-subtask:hover {
      background: var(--glass-bg-subtle);
    }
    .focus-subtask-check {
      width: 20px;
      height: 20px;
      border-radius: var(--radius-sm);
      border: 2px solid var(--glass-border-hover);
      flex-shrink: 0;
      transition: all var(--duration-fast);
    }
    .focus-subtask-check--done {
      background: var(--color-accent);
      border-color: var(--color-accent);
    }
    .focus-subtask-text--done {
      text-decoration: line-through;
      color: var(--text-muted);
    }
    .focus-controls {
      display: flex;
      gap: var(--space-3);
    }
    .focus-btn {
      padding: var(--space-3) var(--space-6);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      font-size: var(--text-base);
      font-weight: var(--font-semibold);
      cursor: pointer;
      transition: all var(--duration-fast);
    }
    .focus-btn--start {
      background: var(--color-accent);
      border-color: var(--color-accent);
      color: var(--color-slate-950);
    }
    .focus-btn--start:hover {
      filter: brightness(1.1);
    }
    .focus-btn--pause {
      background: var(--glass-bg-medium);
      color: var(--text-primary);
    }
    .focus-btn--pause:hover {
      background: var(--glass-bg-base);
    }
    .focus-btn--complete {
      background: var(--color-success);
      border-color: var(--color-success);
      color: white;
    }
    .focus-btn--complete:hover {
      filter: brightness(1.1);
    }
    .focus-btn--skip {
      background: var(--glass-bg-medium);
      border-color: var(--glass-border);
      color: var(--text-secondary);
    }
    .focus-btn--skip:hover {
      background: var(--glass-bg-base);
      color: var(--text-primary);
    }
    .focus-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-4);
    }
    .focus-empty-text {
      font-size: var(--text-xl);
      color: var(--text-secondary);
    }
  </style>
`

/**
 * Default - Timer Ready
 *
 * Initial state before starting a focus session. Shows the Start button.
 */
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Initial state with timer ready to start. Task has subtasks and description.'
      }
    }
  },
  render: () => ({
    template: `
      ${focusStyles}
      <div class="focus-view">
        <div class="focus-timer">25:00</div>
        <h1 class="focus-title">Review Q4 Marketing Proposal</h1>
        <p class="focus-description">Analyze the proposed budget allocation and timeline for approval.</p>
        <div class="focus-subtasks">
          <div class="focus-subtask">
            <div class="focus-subtask-check focus-subtask-check--done"></div>
            <span class="focus-subtask-text--done">Read proposal document</span>
          </div>
          <div class="focus-subtask">
            <div class="focus-subtask-check"></div>
            <span>Check budget numbers</span>
          </div>
          <div class="focus-subtask">
            <div class="focus-subtask-check"></div>
            <span>Discuss with team</span>
          </div>
        </div>
        <div class="focus-controls">
          <button class="focus-btn focus-btn--start">Start (Space)</button>
          <button class="focus-btn focus-btn--complete">Complete (C)</button>
          <button class="focus-btn focus-btn--skip">Skip (Esc)</button>
        </div>
      </div>
    `
  })
}

/**
 * Timer Running
 *
 * Focus session in progress with the Pause button visible.
 */
export const TimerRunning: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Active focus session with timer counting down. Shows the Pause control.'
      }
    }
  },
  render: () => ({
    template: `
      ${focusStyles}
      <div class="focus-view">
        <div class="focus-timer">18:42</div>
        <h1 class="focus-title">Implement user authentication</h1>
        <p class="focus-description">Set up JWT-based auth flow with refresh tokens and secure session management.</p>
        <div class="focus-subtasks">
          <div class="focus-subtask">
            <div class="focus-subtask-check focus-subtask-check--done"></div>
            <span class="focus-subtask-text--done">Create auth service</span>
          </div>
          <div class="focus-subtask">
            <div class="focus-subtask-check focus-subtask-check--done"></div>
            <span class="focus-subtask-text--done">Add login endpoint</span>
          </div>
          <div class="focus-subtask">
            <div class="focus-subtask-check"></div>
            <span>Add refresh token logic</span>
          </div>
          <div class="focus-subtask">
            <div class="focus-subtask-check"></div>
            <span>Write integration tests</span>
          </div>
        </div>
        <div class="focus-controls">
          <button class="focus-btn focus-btn--pause">Pause (Space)</button>
          <button class="focus-btn focus-btn--complete">Complete (C)</button>
          <button class="focus-btn focus-btn--skip">Skip (Esc)</button>
        </div>
      </div>
    `
  })
}

/**
 * Break Time
 *
 * Timer in break mode (green color indicator).
 */
export const BreakTime: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Break period between focus sessions. Timer turns green to indicate rest.'
      }
    }
  },
  render: () => ({
    template: `
      ${focusStyles}
      <div class="focus-view">
        <div class="focus-timer focus-timer--break">04:23</div>
        <h1 class="focus-title">Break Time</h1>
        <p class="focus-description">Take a moment to rest. Next session starts automatically.</p>
        <div class="focus-controls">
          <button class="focus-btn focus-btn--skip">Skip Break (Esc)</button>
        </div>
      </div>
    `
  })
}

/**
 * Minimal Task
 *
 * Simple task with no description or subtasks.
 */
export const MinimalTask: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Focus mode with a simple task — no description or subtasks. Clean, minimal layout.'
      }
    }
  },
  render: () => ({
    template: `
      ${focusStyles}
      <div class="focus-view">
        <div class="focus-timer">25:00</div>
        <h1 class="focus-title">Deploy v1.3.0 to production</h1>
        <div class="focus-controls">
          <button class="focus-btn focus-btn--start">Start (Space)</button>
          <button class="focus-btn focus-btn--complete">Complete (C)</button>
          <button class="focus-btn focus-btn--skip">Skip (Esc)</button>
        </div>
      </div>
    `
  })
}

/**
 * Task Not Found
 *
 * Empty state when navigating to a non-existent task.
 */
export const TaskNotFound: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Empty state when the task ID in the URL does not match any existing task.'
      }
    }
  },
  render: () => ({
    template: `
      ${focusStyles}
      <div class="focus-view">
        <div class="focus-empty">
          <p class="focus-empty-text">Task not found</p>
          <button class="focus-btn focus-btn--skip">Go Back (Esc)</button>
        </div>
      </div>
    `
  })
}
