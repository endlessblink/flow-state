import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent } from 'vue'

const meta: Meta = {
  title: '🤖 AI/TaskQuickEditPopover',
  tags: ['autodocs', 'new'],
  parameters: {
    docs: {
      description: {
        component: 'Lightweight popover for editing task properties directly from AI chat results. Uses BasePopover for auto-positioning and calls executeTool for updates.'
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

const commonStyles = `
<style scoped>
.quick-edit-popover {
  width: 280px;
  position: relative;
  background: var(--overlay-component-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: var(--space-2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.tips-banner {
  background: rgba(234, 179, 8, 0.08);
  border-bottom: 1px solid rgba(234, 179, 8, 0.15);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  margin: calc(-1 * var(--space-2)) calc(-1 * var(--space-2)) 0;
}

.tip-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: rgba(234, 179, 8, 0.9);
  line-height: 1.4;
}

.tip-icon {
  flex-shrink: 0;
}

.task-title-row {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
  padding: var(--space-2) var(--space-1);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.popover-divider {
  height: 1px;
  background: var(--border-subtle);
  margin: var(--space-1) 0;
}

.field-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) 0;
}

.field-label {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  width: 52px;
  flex-shrink: 0;
}

.priority-dots {
  display: flex;
  gap: 4px;
}

.priority-dot-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 2px solid transparent;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  transition: border-color 0.12s ease, transform 0.12s ease;
  padding: 0;
}

.priority-dot-btn:hover {
  transform: scale(1.15);
}

.priority-dot-btn.active {
  border-color: rgba(255, 255, 255, 0.4);
}

.priority-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.status-badges {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.status-badge-btn {
  font-size: var(--text-xs);
  font-weight: 500;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.12s ease;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.status-badge-btn.status-planned {
  background: rgba(139, 92, 246, 0.08);
  color: rgba(167, 139, 250, 0.6);
}
.status-badge-btn.status-planned.active {
  background: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
  border-color: rgba(139, 92, 246, 0.4);
}

.status-badge-btn.status-in_progress {
  background: rgba(59, 130, 246, 0.08);
  color: rgba(96, 165, 250, 0.6);
}
.status-badge-btn.status-in_progress.active {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border-color: rgba(59, 130, 246, 0.4);
}

.status-badge-btn.status-done {
  background: rgba(34, 197, 94, 0.08);
  color: rgba(74, 222, 128, 0.6);
}
.status-badge-btn.status-done.active {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  border-color: rgba(34, 197, 94, 0.4);
}

.status-badge-btn.status-backlog {
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.35);
}
.status-badge-btn.status-backlog.active {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.6);
  border-color: rgba(255, 255, 255, 0.2);
}

.date-input {
  flex: 1;
  font-size: var(--text-xs);
  padding: 4px 8px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-primary);
  color-scheme: dark;
  min-width: 0;
}

.date-input:focus {
  outline: none;
  border-color: var(--brand-primary);
}

.actions-row {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-2) 0;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.12s ease;
  border: 1px solid transparent;
  flex: 1;
  justify-content: center;
}

.action-done {
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
  border-color: rgba(34, 197, 94, 0.2);
}

.action-done:hover:not(:disabled) {
  background: rgba(34, 197, 94, 0.2);
}

.action-timer {
  background: rgba(139, 92, 246, 0.12);
  color: #a78bfa;
  border-color: rgba(139, 92, 246, 0.2);
}

.action-timer:hover:not(:disabled) {
  background: rgba(139, 92, 246, 0.2);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.full-editor-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  padding: var(--space-1);
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: color 0.12s ease;
}

.full-editor-link:hover {
  color: var(--brand-primary);
}
</style>
`

/**
 * Default popover with medium priority, planned status, a due date
 */
export const Default: Story = {
  render: () => defineComponent({
    template: `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 500px; background: var(--bg-primary); padding: var(--space-6);">
        <div class="quick-edit-popover">
          <div class="task-title-row" dir="auto">
            Implement feature X
          </div>

          <div class="popover-divider" />

          <!-- Priority -->
          <div class="field-row">
            <span class="field-label">Priority</span>
            <div class="priority-dots">
              <button class="priority-dot-btn">
                <span class="priority-dot" style="background: #ef4444;" />
              </button>
              <button class="priority-dot-btn">
                <span class="priority-dot" style="background: #f97316;" />
              </button>
              <button class="priority-dot-btn active">
                <span class="priority-dot" style="background: #eab308;" />
              </button>
              <button class="priority-dot-btn">
                <span class="priority-dot" style="background: #22c55e;" />
              </button>
              <button class="priority-dot-btn">
                <span class="priority-dot" style="background: rgba(255,255,255,0.3);" />
              </button>
            </div>
          </div>

          <!-- Status -->
          <div class="field-row">
            <span class="field-label">Status</span>
            <div class="status-badges">
              <button class="status-badge-btn status-planned active">Planned</button>
              <button class="status-badge-btn status-in_progress">Active</button>
              <button class="status-badge-btn status-done">Done</button>
              <button class="status-badge-btn status-backlog">Backlog</button>
            </div>
          </div>

          <!-- Due Date -->
          <div class="field-row">
            <span class="field-label">Due</span>
            <input type="date" class="date-input" value="2026-02-20" />
          </div>

          <div class="popover-divider" />

          <!-- Action Buttons -->
          <div class="actions-row">
            <button class="action-btn action-done">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span>Mark Done</span>
            </button>
            <button class="action-btn action-timer">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>Start Timer</span>
            </button>
          </div>

          <!-- Open Full Editor -->
          <button class="full-editor-link">
            <span>Open full editor</span>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
        </div>
        ${commonStyles}
      </div>
    `
  })
}

/**
 * High priority task with in-progress status
 */
export const HighPriority: Story = {
  render: () => defineComponent({
    template: `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 500px; background: var(--bg-primary); padding: var(--space-6);">
        <div class="quick-edit-popover">
          <div class="task-title-row" dir="auto">
            Fix critical security vulnerability
          </div>

          <div class="popover-divider" />

          <!-- Priority -->
          <div class="field-row">
            <span class="field-label">Priority</span>
            <div class="priority-dots">
              <button class="priority-dot-btn">
                <span class="priority-dot" style="background: #ef4444;" />
              </button>
              <button class="priority-dot-btn active">
                <span class="priority-dot" style="background: #f97316;" />
              </button>
              <button class="priority-dot-btn">
                <span class="priority-dot" style="background: #eab308;" />
              </button>
              <button class="priority-dot-btn">
                <span class="priority-dot" style="background: #22c55e;" />
              </button>
              <button class="priority-dot-btn">
                <span class="priority-dot" style="background: rgba(255,255,255,0.3);" />
              </button>
            </div>
          </div>

          <!-- Status -->
          <div class="field-row">
            <span class="field-label">Status</span>
            <div class="status-badges">
              <button class="status-badge-btn status-planned">Planned</button>
              <button class="status-badge-btn status-in_progress active">Active</button>
              <button class="status-badge-btn status-done">Done</button>
              <button class="status-badge-btn status-backlog">Backlog</button>
            </div>
          </div>

          <!-- Due Date -->
          <div class="field-row">
            <span class="field-label">Due</span>
            <input type="date" class="date-input" value="2026-02-15" />
          </div>

          <div class="popover-divider" />

          <!-- Action Buttons -->
          <div class="actions-row">
            <button class="action-btn action-done">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span>Mark Done</span>
            </button>
            <button class="action-btn action-timer">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>Start Timer</span>
            </button>
          </div>

          <!-- Open Full Editor -->
          <button class="full-editor-link">
            <span>Open full editor</span>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
        </div>
        ${commonStyles}
      </div>
    `
  })
}

/**
 * Task marked as done
 */
export const DoneTask: Story = {
  render: () => defineComponent({
    template: `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 500px; background: var(--bg-primary); padding: var(--space-6);">
        <div class="quick-edit-popover">
          <div class="task-title-row" dir="auto">
            Implement feature X
          </div>

          <div class="popover-divider" />

          <!-- Priority -->
          <div class="field-row">
            <span class="field-label">Priority</span>
            <div class="priority-dots">
              <button class="priority-dot-btn">
                <span class="priority-dot" style="background: #ef4444;" />
              </button>
              <button class="priority-dot-btn">
                <span class="priority-dot" style="background: #f97316;" />
              </button>
              <button class="priority-dot-btn active">
                <span class="priority-dot" style="background: #eab308;" />
              </button>
              <button class="priority-dot-btn">
                <span class="priority-dot" style="background: #22c55e;" />
              </button>
              <button class="priority-dot-btn">
                <span class="priority-dot" style="background: rgba(255,255,255,0.3);" />
              </button>
            </div>
          </div>

          <!-- Status -->
          <div class="field-row">
            <span class="field-label">Status</span>
            <div class="status-badges">
              <button class="status-badge-btn status-planned">Planned</button>
              <button class="status-badge-btn status-in_progress">Active</button>
              <button class="status-badge-btn status-done active">Done</button>
              <button class="status-badge-btn status-backlog">Backlog</button>
            </div>
          </div>

          <!-- Due Date -->
          <div class="field-row">
            <span class="field-label">Due</span>
            <input type="date" class="date-input" value="2026-02-20" />
          </div>

          <div class="popover-divider" />

          <!-- Action Buttons -->
          <div class="actions-row">
            <button class="action-btn action-done" disabled>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span>Mark Done</span>
            </button>
            <button class="action-btn action-timer">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>Start Timer</span>
            </button>
          </div>

          <!-- Open Full Editor -->
          <button class="full-editor-link">
            <span>Open full editor</span>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
        </div>
        ${commonStyles}
      </div>
    `
  })
}

/**
 * With context tips banner at top
 */
export const WithContextTips: Story = {
  render: () => defineComponent({
    template: `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 500px; background: var(--bg-primary); padding: var(--space-6);">
        <div class="quick-edit-popover">
          <!-- Context Tips -->
          <div class="tips-banner">
            <div class="tip-item">
              <span class="tip-icon">🔥</span>
              <span class="tip-text">Complete this to maintain your 7-day streak!</span>
            </div>
          </div>

          <div class="task-title-row" dir="auto">
            Daily standup meeting preparation
          </div>

          <div class="popover-divider" />

          <!-- Priority -->
          <div class="field-row">
            <span class="field-label">Priority</span>
            <div class="priority-dots">
              <button class="priority-dot-btn">
                <span class="priority-dot" style="background: #ef4444;" />
              </button>
              <button class="priority-dot-btn active">
                <span class="priority-dot" style="background: #f97316;" />
              </button>
              <button class="priority-dot-btn">
                <span class="priority-dot" style="background: #eab308;" />
              </button>
              <button class="priority-dot-btn">
                <span class="priority-dot" style="background: #22c55e;" />
              </button>
              <button class="priority-dot-btn">
                <span class="priority-dot" style="background: rgba(255,255,255,0.3);" />
              </button>
            </div>
          </div>

          <!-- Status -->
          <div class="field-row">
            <span class="field-label">Status</span>
            <div class="status-badges">
              <button class="status-badge-btn status-planned">Planned</button>
              <button class="status-badge-btn status-in_progress active">Active</button>
              <button class="status-badge-btn status-done">Done</button>
              <button class="status-badge-btn status-backlog">Backlog</button>
            </div>
          </div>

          <!-- Due Date -->
          <div class="field-row">
            <span class="field-label">Due</span>
            <input type="date" class="date-input" value="2026-02-13" />
          </div>

          <div class="popover-divider" />

          <!-- Action Buttons -->
          <div class="actions-row">
            <button class="action-btn action-done">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span>Mark Done</span>
            </button>
            <button class="action-btn action-timer">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>Start Timer</span>
            </button>
          </div>

          <!-- Open Full Editor -->
          <button class="full-editor-link">
            <span>Open full editor</span>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
        </div>
        ${commonStyles}
      </div>
    `
  })
}
