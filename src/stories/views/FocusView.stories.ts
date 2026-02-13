import type { Meta, StoryObj } from '@storybook/vue3'

/**
 * FocusView - Minimalist Focus Mode
 *
 * Distraction-free focus mode for single-task concentration.
 *
 * **Features:**
 * - Single task display
 * - Timer integration
 * - Minimal UI
 * - Keyboard shortcuts
 * - Auto-start timer on mount
 *
 * **Store Dependencies:**
 * - taskStore: Current task data
 * - timerStore: Timer control
 *
 * **Note:** Currently a stub view. Full implementation pending.
 */
const meta: Meta = {
  title: '✨ Views/FocusView',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `Minimalist focus mode for single-task concentration.

**Purpose:**
Distraction-free environment for deep work on a single task.

**Planned Features:**
- Large task title display
- Description/notes area
- Integrated timer
- Subtask checklist
- Minimal controls (complete/skip)
- Dark ambient background

**Current Status:**
Stub implementation. Component exists but is not fully functional.`
      }
    }
  }
}

export default meta
type Story = StoryObj

/**
 * Default - Focus Mode Layout
 *
 * Shows the planned layout structure.
 */
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Minimalist layout for focused work on a single task.'
      }
    }
  },
  render: () => ({
    template: `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background: radial-gradient(circle at center, #1a1a2e 0%, #0a0a0f 100%);
        color: var(--text-primary);
        padding: var(--space-8);
        text-align: center;
      ">
        <!-- Timer Display -->
        <div style="
          font-size: 5rem;
          font-weight: 700;
          color: var(--accent-primary);
          margin-bottom: var(--space-8);
          font-variant-numeric: tabular-nums;
        ">25:00</div>

        <!-- Task Title -->
        <h1 style="
          font-size: var(--text-4xl);
          font-weight: var(--font-bold);
          color: var(--text-primary);
          margin-bottom: var(--space-4);
          max-width: 800px;
        ">Review Q4 Marketing Proposal</h1>

        <!-- Task Description -->
        <p style="
          font-size: var(--text-lg);
          color: var(--text-secondary);
          margin-bottom: var(--space-8);
          max-width: 600px;
          line-height: 1.6;
        ">Analyze the proposed budget allocation and timeline for approval.</p>

        <!-- Subtasks -->
        <div style="
          margin-bottom: var(--space-8);
        ">
          <div style="
            display: flex;
            align-items: center;
            gap: var(--space-2);
            margin-bottom: var(--space-2);
            font-size: var(--text-base);
          ">
            <input type="checkbox" checked style="width: 20px; height: 20px;" />
            <span style="text-decoration: line-through; color: var(--text-muted);">Read proposal document</span>
          </div>
          <div style="
            display: flex;
            align-items: center;
            gap: var(--space-2);
            margin-bottom: var(--space-2);
            font-size: var(--text-base);
          ">
            <input type="checkbox" style="width: 20px; height: 20px;" />
            <span>Check budget numbers</span>
          </div>
          <div style="
            display: flex;
            align-items: center;
            gap: var(--space-2);
            font-size: var(--text-base);
          ">
            <input type="checkbox" style="width: 20px; height: 20px;" />
            <span>Discuss with team</span>
          </div>
        </div>

        <!-- Controls -->
        <div style="
          display: flex;
          gap: var(--space-3);
        ">
          <button style="
            padding: var(--space-3) var(--space-6);
            background: var(--color-success);
            border: none;
            border-radius: var(--radius-lg);
            color: white;
            font-size: var(--text-base);
            font-weight: var(--font-semibold);
            cursor: pointer;
          ">Complete (C)</button>
          <button style="
            padding: var(--space-3) var(--space-6);
            background: var(--glass-bg-medium);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-lg);
            color: var(--text-secondary);
            font-size: var(--text-base);
            cursor: pointer;
          ">Skip (Esc)</button>
        </div>
      </div>
    `
  })
}
