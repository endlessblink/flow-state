import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent } from 'vue'

const meta: Meta = {
  title: '🤖 AI/AITaskAssistPopover',
  tags: ['autodocs', 'new'],
  parameters: {
    docs: {
      description: {
        component: 'Context-aware AI action buttons with inline result display. Shows different actions based on invocation context (context-menu, edit-modal, quick-create).'
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

// Common styles for all stories
const commonStyles = `
<style scoped>
.ai-assist-popover {
  width: 320px;
  max-height: 400px;
  overflow-y: auto;
  background: var(--overlay-component-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: var(--space-2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.ai-assist-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--glass-border);
}

.header-icon {
  color: var(--brand-primary);
  flex-shrink: 0;
}

.header-title {
  font-weight: var(--font-semibold);
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.header-task {
  font-size: var(--text-xs);
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
  margin-left: auto;
}

.ai-assist-actions {
  padding: var(--space-1) 0;
}

.assist-action-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: background var(--duration-fast);
  text-align: left;
}

.assist-action-btn:hover {
  background: var(--glass-bg-heavy);
}

.ai-assist-loading {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.spin {
  animation: spin 1s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.abort-btn {
  margin-left: auto;
  padding: var(--space-1) var(--space-2);
  background: transparent;
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  font-size: var(--text-xs);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color var(--duration-fast), border-color var(--duration-fast);
}

.abort-btn:hover {
  color: var(--text-primary);
  border-color: var(--glass-border-hover);
}

.ai-assist-result {
  padding: var(--space-2) var(--space-3);
}

.result-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: var(--space-2);
}

.result-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.subtask-item {
  padding: var(--space-1_5) var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-light);
  margin-bottom: var(--space-1);
}

.subtask-text {
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.accept-btn {
  padding: var(--space-1_5) var(--space-3);
  background: var(--brand-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: opacity var(--duration-fast);
}

.accept-btn:hover {
  opacity: 0.9;
}

.dismiss-btn {
  padding: var(--space-1_5) var(--space-3);
  background: transparent;
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: border-color var(--duration-fast), color var(--duration-fast);
}

.dismiss-btn:hover {
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}
</style>
`

/**
 * Context menu variant - shows all 5 task-specific AI actions
 */
export const ContextMenu: Story = {
  render: () => defineComponent({
    template: `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 500px; background: var(--bg-primary); padding: var(--space-6);">
        <div class="ai-assist-popover">
          <!-- Header -->
          <div class="ai-assist-header">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" class="header-icon">
              <path d="M12 3v3m0 12v3m-7-7h3m12 0h3m-3.05-7.95L17.5 6.5m-11 11-2.45 2.45m13.9 0L17.5 17.5M6.5 6.5l-2.45-2.45"></path>
            </svg>
            <span class="header-title">AI Assist</span>
            <span class="header-task" dir="auto">Implement AI task suggestions</span>
          </div>

          <!-- Action buttons -->
          <div class="ai-assist-actions">
            <button class="assist-action-btn">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              Suggest priority & duration
            </button>
            <button class="assist-action-btn">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
              </svg>
              Break into tasks
            </button>
            <button class="assist-action-btn">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2"></rect>
                <path d="M16 2v4M8 2v4M3 10h18"></path>
                <path d="M12 14v4m-2-2h4"></path>
              </svg>
              When should I do this?
            </button>
            <button class="assist-action-btn">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M13 5l6 6-6 6M7 5l6 6-6 6"></path>
              </svg>
              Find related tasks
            </button>
            <button class="assist-action-btn">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              Summarize selected
            </button>
          </div>
        </div>
        ${commonStyles}
      </div>
    `
  })
}

/**
 * Edit modal variant - shows 4 actions available during task editing
 */
export const EditModal: Story = {
  render: () => defineComponent({
    template: `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 500px; background: var(--bg-primary); padding: var(--space-6);">
        <div class="ai-assist-popover">
          <div class="ai-assist-header">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" class="header-icon">
              <path d="M12 3v3m0 12v3m-7-7h3m12 0h3m-3.05-7.95L17.5 6.5m-11 11-2.45 2.45m13.9 0L17.5 17.5M6.5 6.5l-2.45-2.45"></path>
            </svg>
            <span class="header-title">AI Assist</span>
            <span class="header-task" dir="auto">Implement AI task suggestions</span>
          </div>

          <div class="ai-assist-actions">
            <button class="assist-action-btn">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              Suggest subtasks
            </button>
            <button class="assist-action-btn">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              Suggest priority & duration
            </button>
            <button class="assist-action-btn">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2"></rect>
                <path d="M16 2v4M8 2v4M3 10h18"></path>
                <path d="M12 14v4m-2-2h4"></path>
              </svg>
              When should I do this?
            </button>
            <button class="assist-action-btn">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
              Improve title
            </button>
          </div>
        </div>
        ${commonStyles}
      </div>
    `
  })
}

/**
 * Quick create variant - minimal 3 actions for new tasks
 */
export const QuickCreate: Story = {
  render: () => defineComponent({
    template: `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 500px; background: var(--bg-primary); padding: var(--space-6);">
        <div class="ai-assist-popover">
          <div class="ai-assist-header">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" class="header-icon">
              <path d="M12 3v3m0 12v3m-7-7h3m12 0h3m-3.05-7.95L17.5 6.5m-11 11-2.45 2.45m13.9 0L17.5 17.5M6.5 6.5l-2.45-2.45"></path>
            </svg>
            <span class="header-title">AI Assist</span>
            <span class="header-task" dir="auto">New task from quick create</span>
          </div>

          <div class="ai-assist-actions">
            <button class="assist-action-btn">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              Suggest priority & duration
            </button>
            <button class="assist-action-btn">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2"></rect>
                <path d="M16 2v4M8 2v4M3 10h18"></path>
                <path d="M12 14v4m-2-2h4"></path>
              </svg>
              When should I do this?
            </button>
            <button class="assist-action-btn">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
              Improve title
            </button>
          </div>
        </div>
        ${commonStyles}
      </div>
    `
  })
}

/**
 * Loading state during AI operation
 */
export const Loading: Story = {
  render: () => defineComponent({
    template: `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 500px; background: var(--bg-primary); padding: var(--space-6);">
        <div class="ai-assist-popover">
          <div class="ai-assist-header">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" class="header-icon">
              <path d="M12 3v3m0 12v3m-7-7h3m12 0h3m-3.05-7.95L17.5 6.5m-11 11-2.45 2.45m13.9 0L17.5 17.5M6.5 6.5l-2.45-2.45"></path>
            </svg>
            <span class="header-title">AI Assist</span>
            <span class="header-task" dir="auto">Implement AI task suggestions</span>
          </div>

          <div class="ai-assist-loading">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" class="spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
            </svg>
            <span>Suggesting subtasks...</span>
            <button class="abort-btn">Cancel</button>
          </div>
        </div>
        ${commonStyles}
      </div>
    `
  })
}

/**
 * With result - suggested subtasks shown with accept/dismiss actions
 */
export const WithResult: Story = {
  render: () => defineComponent({
    template: `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 500px; background: var(--bg-primary); padding: var(--space-6);">
        <div class="ai-assist-popover">
          <div class="ai-assist-header">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" class="header-icon">
              <path d="M12 3v3m0 12v3m-7-7h3m12 0h3m-3.05-7.95L17.5 6.5m-11 11-2.45 2.45m13.9 0L17.5 17.5M6.5 6.5l-2.45-2.45"></path>
            </svg>
            <span class="header-title">AI Assist</span>
            <span class="header-task" dir="auto">Implement AI task suggestions</span>
          </div>

          <div class="ai-assist-result">
            <div class="result-subtasks">
              <div class="result-label">Suggested subtasks</div>
              <div class="subtask-item">
                <span class="subtask-text" dir="auto">Research existing AI suggestion patterns</span>
              </div>
              <div class="subtask-item">
                <span class="subtask-text" dir="auto">Design API for AI task breakdown</span>
              </div>
              <div class="subtask-item">
                <span class="subtask-text" dir="auto">Implement subtask suggestion logic</span>
              </div>
              <div class="subtask-item">
                <span class="subtask-text" dir="auto">Add UI for accepting suggestions</span>
              </div>
              <div class="result-actions">
                <button class="accept-btn">Add all</button>
                <button class="dismiss-btn">Dismiss</button>
              </div>
            </div>
          </div>
        </div>
        ${commonStyles}
      </div>
    `
  })
}
