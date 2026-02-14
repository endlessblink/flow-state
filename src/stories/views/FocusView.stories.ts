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
 * - Start/Pause/Resume/Complete/Stop controls
 * - Keyboard shortcuts: Space (timer), C (complete), Esc (stop/back)
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
- Minimal controls: Start/Pause/Resume, Complete, Stop
- Keyboard shortcuts: Space (timer toggle), C (complete), Esc (stop/back)
- Dark ambient background with radial gradient
- Glass-morphism button design (outlined, colored borders)
- Responsive layout (stacked buttons on mobile)

**Route:** \`/focus/:taskId\` (requires auth)
**Entry points:** Eye icon on task cards (kanban) and task rows (table view)`
      }
    }
  }
}

export default meta
type Story = StoryObj

// Inline styles matching FocusView.vue design tokens (glass-morphism button pattern)
const S = {
  view: 'display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; background:radial-gradient(circle at center, rgba(var(--color-slate-900),1) 0%, rgba(var(--color-slate-950),1) 100%); padding:var(--space-8); text-align:center;',
  timer: 'font-size:5rem; font-weight:700; color:var(--color-accent); margin-bottom:var(--space-8); font-variant-numeric:tabular-nums; letter-spacing:0.02em;',
  timerBreak: 'font-size:5rem; font-weight:700; color:var(--color-success); margin-bottom:var(--space-8); font-variant-numeric:tabular-nums; letter-spacing:0.02em;',
  title: 'font-size:var(--text-4xl); font-weight:var(--font-bold); color:var(--text-primary); margin-bottom:var(--space-4); max-width:800px; line-height:1.3;',
  desc: 'font-size:var(--text-lg); color:var(--text-secondary); margin-bottom:var(--space-8); max-width:600px; line-height:1.6;',
  subtasks: 'margin-bottom:var(--space-8); text-align:left;',
  subtask: 'display:flex; align-items:center; gap:var(--space-3); margin-bottom:var(--space-3); font-size:var(--text-base); color:var(--text-primary); cursor:pointer; padding:var(--space-1) var(--space-2); border-radius:var(--radius-sm);',
  checkUndone: 'width:20px; height:20px; border-radius:var(--radius-sm); border:2px solid var(--glass-border-hover); flex-shrink:0;',
  checkDone: 'width:20px; height:20px; border-radius:var(--radius-sm); border:2px solid var(--color-accent); background:var(--color-accent); flex-shrink:0;',
  textDone: 'text-decoration:line-through; color:var(--text-muted);',
  controls: 'display:flex; gap:var(--space-3);',
  // Glass-morphism button base
  btn: 'display:inline-flex; align-items:center; gap:var(--space-2); padding:var(--space-2_5) var(--space-5); background:var(--glass-bg-soft); border:1px solid var(--glass-border-hover); border-radius:var(--radius-lg); font-size:var(--text-base); font-weight:var(--font-medium); cursor:pointer; backdrop-filter:blur(8px); color:var(--text-primary);',
  btnStart: 'display:inline-flex; align-items:center; gap:var(--space-2); padding:var(--space-2_5) var(--space-5); background:var(--glass-bg-soft); border:1px solid var(--color-accent); border-radius:var(--radius-lg); font-size:var(--text-base); font-weight:var(--font-medium); cursor:pointer; backdrop-filter:blur(8px); color:var(--color-accent);',
  btnPause: 'display:inline-flex; align-items:center; gap:var(--space-2); padding:var(--space-2_5) var(--space-5); background:var(--glass-bg-soft); border:1px solid var(--glass-border-hover); border-radius:var(--radius-lg); font-size:var(--text-base); font-weight:var(--font-medium); cursor:pointer; backdrop-filter:blur(8px); color:var(--text-secondary);',
  btnComplete: 'display:inline-flex; align-items:center; gap:var(--space-2); padding:var(--space-2_5) var(--space-5); background:var(--glass-bg-soft); border:1px solid var(--brand-primary); border-radius:var(--radius-lg); font-size:var(--text-base); font-weight:var(--font-medium); cursor:pointer; backdrop-filter:blur(8px); color:var(--brand-primary);',
  btnSkip: 'display:inline-flex; align-items:center; gap:var(--space-2); padding:var(--space-2_5) var(--space-5); background:var(--glass-bg-soft); border:1px solid var(--glass-border-hover); border-radius:var(--radius-lg); font-size:var(--text-base); font-weight:var(--font-medium); cursor:pointer; backdrop-filter:blur(8px); color:var(--text-secondary);',
  kbd: 'padding:var(--space-0_5) var(--space-1_5); background:var(--glass-bg-medium); border:1px solid var(--glass-border); border-radius:var(--radius-sm); font-size:var(--text-xs); font-family:var(--font-mono); color:var(--text-muted); line-height:1;',
  emptyWrap: 'display:flex; flex-direction:column; align-items:center; gap:var(--space-4);',
  emptyText: 'font-size:var(--text-xl); color:var(--text-secondary);'
}

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
      <div style="${S.view}">
        <div style="${S.timer}">25:00</div>
        <h1 style="${S.title}">Review Q4 Marketing Proposal</h1>
        <p style="${S.desc}">Analyze the proposed budget allocation and timeline for approval.</p>
        <div style="${S.subtasks}">
          <div style="${S.subtask}">
            <div style="${S.checkDone}"></div>
            <span style="${S.textDone}">Read proposal document</span>
          </div>
          <div style="${S.subtask}">
            <div style="${S.checkUndone}"></div>
            <span>Check budget numbers</span>
          </div>
          <div style="${S.subtask}">
            <div style="${S.checkUndone}"></div>
            <span>Discuss with team</span>
          </div>
        </div>
        <div style="${S.controls}">
          <button style="${S.btnStart}">Start <kbd style="${S.kbd}">Space</kbd></button>
          <button style="${S.btnComplete}">Complete <kbd style="${S.kbd}">C</kbd></button>
          <button style="${S.btnSkip}">Stop <kbd style="${S.kbd}">Esc</kbd></button>
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
      <div style="${S.view}">
        <div style="${S.timer}">18:42</div>
        <h1 style="${S.title}">Implement user authentication</h1>
        <p style="${S.desc}">Set up JWT-based auth flow with refresh tokens and secure session management.</p>
        <div style="${S.subtasks}">
          <div style="${S.subtask}">
            <div style="${S.checkDone}"></div>
            <span style="${S.textDone}">Create auth service</span>
          </div>
          <div style="${S.subtask}">
            <div style="${S.checkDone}"></div>
            <span style="${S.textDone}">Add login endpoint</span>
          </div>
          <div style="${S.subtask}">
            <div style="${S.checkUndone}"></div>
            <span>Add refresh token logic</span>
          </div>
          <div style="${S.subtask}">
            <div style="${S.checkUndone}"></div>
            <span>Write integration tests</span>
          </div>
        </div>
        <div style="${S.controls}">
          <button style="${S.btnPause}">Pause <kbd style="${S.kbd}">Space</kbd></button>
          <button style="${S.btnComplete}">Complete <kbd style="${S.kbd}">C</kbd></button>
          <button style="${S.btnSkip}">Stop <kbd style="${S.kbd}">Esc</kbd></button>
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
      <div style="${S.view}">
        <div style="${S.timerBreak}">04:23</div>
        <h1 style="${S.title}">Break Time</h1>
        <p style="${S.desc}">Take a moment to rest. Next session starts automatically.</p>
        <div style="${S.controls}">
          <button style="${S.btnSkip}">Skip Break <kbd style="${S.kbd}">Esc</kbd></button>
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
      <div style="${S.view}">
        <div style="${S.timer}">25:00</div>
        <h1 style="${S.title}">Deploy v1.3.0 to production</h1>
        <div style="${S.controls}">
          <button style="${S.btnStart}">Start <kbd style="${S.kbd}">Space</kbd></button>
          <button style="${S.btnComplete}">Complete <kbd style="${S.kbd}">C</kbd></button>
          <button style="${S.btnSkip}">Stop <kbd style="${S.kbd}">Esc</kbd></button>
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
      <div style="${S.view}">
        <div style="${S.emptyWrap}">
          <p style="${S.emptyText}">Task not found</p>
          <button style="${S.btnSkip}">Go Back <kbd style="${S.kbd}">Esc</kbd></button>
        </div>
      </div>
    `
  })
}
