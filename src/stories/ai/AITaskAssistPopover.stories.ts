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

// Shared inline style constants (design-token based)
const popoverStyle = 'width: 320px; max-height: 400px; overflow-y: auto; background: var(--overlay-component-bg); border: 1px solid var(--glass-border); border-radius: var(--radius-xl); padding: var(--space-2); box-shadow: var(--shadow-2xl); backdrop-filter: blur(16px);'

const headerStyle = 'display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--glass-border);'

const headerIconStyle = 'color: var(--brand-primary); flex-shrink: 0;'

const headerTitleStyle = 'font-weight: var(--font-semibold); font-size: var(--text-sm); color: var(--text-primary);'

const headerTaskStyle = 'font-size: var(--text-xs); color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; margin-left: auto;'

const actionsStyle = 'padding: var(--space-1) 0;'

const actionBtnStyle = 'width: 100%; display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: transparent; border: none; color: var(--text-primary); font-size: var(--text-sm); cursor: pointer; border-radius: var(--radius-md); text-align: left;'

const loadingStyle = 'display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3); color: var(--text-secondary); font-size: var(--text-sm);'

const abortBtnStyle = 'margin-left: auto; padding: var(--space-1) var(--space-2); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); color: var(--text-muted); font-size: var(--text-xs); border-radius: var(--radius-sm); cursor: pointer; backdrop-filter: blur(8px);'

const resultLabelStyle = 'font-size: var(--text-xs); font-weight: var(--font-semibold); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: var(--space-2);'

const subtaskItemStyle = 'padding: var(--space-1_5) var(--space-2); border-radius: var(--radius-sm); background: var(--glass-bg-light); margin-bottom: var(--space-1);'

const subtaskTextStyle = 'font-size: var(--text-sm); color: var(--text-primary);'

const acceptBtnStyle = 'padding: var(--space-1_5) var(--space-3); background: var(--glass-bg-soft); color: var(--brand-primary); border: 1px solid var(--brand-primary); border-radius: var(--radius-md); font-size: var(--text-xs); font-weight: var(--font-semibold); cursor: pointer; backdrop-filter: blur(8px);'

const dismissBtnStyle = 'padding: var(--space-1_5) var(--space-3); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); color: var(--text-secondary); border-radius: var(--radius-md); font-size: var(--text-xs); cursor: pointer; backdrop-filter: blur(8px);'

const sparkleIcon = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v3m0 12v3m-7-7h3m12 0h3m-3.05-7.95L17.5 6.5m-11 11-2.45 2.45m13.9 0L17.5 17.5M6.5 6.5l-2.45-2.45"></path></svg>'

/**
 * Context menu variant - shows all 5 task-specific AI actions
 */
export const ContextMenu: Story = {
  render: () => defineComponent({
    template: `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 500px; background: var(--bg-primary); padding: var(--space-6);">
        <div style="${popoverStyle}">
          <div style="${headerStyle}">
            ${sparkleIcon.replace('style="', 'style="' + headerIconStyle)}
            <span style="${headerTitleStyle}">AI Assist</span>
            <span style="${headerTaskStyle}" dir="auto">Implement AI task suggestions</span>
          </div>
          <div style="${actionsStyle}">
            <button style="${actionBtnStyle}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
              Suggest priority &amp; duration
            </button>
            <button style="${actionBtnStyle}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path></svg>
              Break into tasks
            </button>
            <button style="${actionBtnStyle}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path><path d="M12 14v4m-2-2h4"></path></svg>
              When should I do this?
            </button>
            <button style="${actionBtnStyle}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 5l6 6-6 6M7 5l6 6-6 6"></path></svg>
              Find related tasks
            </button>
            <button style="${actionBtnStyle}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
              Summarize selected
            </button>
          </div>
        </div>
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
        <div style="${popoverStyle}">
          <div style="${headerStyle}">
            <span style="${headerIconStyle}">${sparkleIcon}</span>
            <span style="${headerTitleStyle}">AI Assist</span>
            <span style="${headerTaskStyle}" dir="auto">Implement AI task suggestions</span>
          </div>
          <div style="${actionsStyle}">
            <button style="${actionBtnStyle}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
              Suggest subtasks
            </button>
            <button style="${actionBtnStyle}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
              Suggest priority &amp; duration
            </button>
            <button style="${actionBtnStyle}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path><path d="M12 14v4m-2-2h4"></path></svg>
              When should I do this?
            </button>
            <button style="${actionBtnStyle}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              Improve title
            </button>
          </div>
        </div>
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
        <div style="${popoverStyle}">
          <div style="${headerStyle}">
            <span style="${headerIconStyle}">${sparkleIcon}</span>
            <span style="${headerTitleStyle}">AI Assist</span>
            <span style="${headerTaskStyle}" dir="auto">New task from quick create</span>
          </div>
          <div style="${actionsStyle}">
            <button style="${actionBtnStyle}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
              Suggest priority &amp; duration
            </button>
            <button style="${actionBtnStyle}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path><path d="M12 14v4m-2-2h4"></path></svg>
              When should I do this?
            </button>
            <button style="${actionBtnStyle}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              Improve title
            </button>
          </div>
        </div>
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
        <div style="${popoverStyle}">
          <div style="${headerStyle}">
            <span style="${headerIconStyle}">${sparkleIcon}</span>
            <span style="${headerTitleStyle}">AI Assist</span>
            <span style="${headerTaskStyle}" dir="auto">Implement AI task suggestions</span>
          </div>
          <div style="${loadingStyle}">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0; animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
            <span>Suggesting subtasks...</span>
            <button style="${abortBtnStyle}">Cancel</button>
          </div>
        </div>
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
        <div style="${popoverStyle}">
          <div style="${headerStyle}">
            <span style="${headerIconStyle}">${sparkleIcon}</span>
            <span style="${headerTitleStyle}">AI Assist</span>
            <span style="${headerTaskStyle}" dir="auto">Implement AI task suggestions</span>
          </div>
          <div style="padding: var(--space-2) var(--space-3);">
            <div style="${resultLabelStyle}">Suggested subtasks</div>
            <div style="${subtaskItemStyle}"><span style="${subtaskTextStyle}" dir="auto">Research existing AI suggestion patterns</span></div>
            <div style="${subtaskItemStyle}"><span style="${subtaskTextStyle}" dir="auto">Design API for AI task breakdown</span></div>
            <div style="${subtaskItemStyle}"><span style="${subtaskTextStyle}" dir="auto">Implement subtask suggestion logic</span></div>
            <div style="${subtaskItemStyle}"><span style="${subtaskTextStyle}" dir="auto">Add UI for accepting suggestions</span></div>
            <div style="display: flex; gap: var(--space-2); margin-top: var(--space-3);">
              <button style="${acceptBtnStyle}">Add all</button>
              <button style="${dismissBtnStyle}">Dismiss</button>
            </div>
          </div>
        </div>
      </div>
    `
  })
}
