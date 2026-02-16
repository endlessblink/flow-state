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

// Shared inline style constants (design-token based)
const popoverStyle = 'width: 280px; position: relative; background: var(--overlay-component-bg); border: 1px solid var(--glass-border); border-radius: var(--radius-xl); padding: var(--space-2); box-shadow: var(--shadow-2xl); backdrop-filter: blur(16px);'

const tipsBannerStyle = 'background: rgba(245, 158, 11, 0.08); border-bottom: 1px solid rgba(245, 158, 11, 0.15); padding: var(--space-2) var(--space-3); border-radius: var(--radius-xl) var(--radius-xl) 0 0; margin: calc(-1 * var(--space-2)) calc(-1 * var(--space-2)) 0;'

const tipItemStyle = 'display: flex; align-items: flex-start; gap: var(--space-1); font-size: var(--text-xs); color: rgba(245, 158, 11, 0.9); line-height: 1.4;'

const titleRowStyle = 'font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--text-primary); line-height: 1.4; padding: var(--space-2) var(--space-1); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word;'

const dividerStyle = 'height: 1px; background: var(--border-subtle); margin: var(--space-1) 0;'

const fieldRowStyle = 'display: flex; align-items: center; gap: var(--space-2); padding: var(--space-1) 0;'

const fieldLabelStyle = 'font-size: var(--text-xs); font-weight: var(--font-medium); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; width: 52px; flex-shrink: 0;'

const priorityDotsStyle = 'display: flex; gap: var(--space-1);'

const priorityDotBtnStyle = 'display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: 2px solid transparent; border-radius: var(--radius-full); background: transparent; cursor: pointer; padding: 0;'

const priorityDotBtnActiveStyle = 'display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: 2px solid rgba(255, 255, 255, 0.4); border-radius: var(--radius-full); background: transparent; cursor: pointer; padding: 0;'

const priorityDotStyle = 'width: 12px; height: 12px; border-radius: var(--radius-full);'

const statusBadgesStyle = 'display: flex; gap: var(--space-1); flex-wrap: wrap;'

// Status badge styles using design tokens
const statusPlannedStyle = 'font-size: var(--text-xs); font-weight: var(--font-medium); padding: var(--space-0_5) var(--space-2); border-radius: var(--radius-sm); border: 1px solid transparent; cursor: pointer; text-transform: uppercase; letter-spacing: 0.03em; background: var(--status-planned-bg); color: var(--status-planned-text); opacity: 0.6;'

const statusPlannedActiveStyle = 'font-size: var(--text-xs); font-weight: var(--font-medium); padding: var(--space-0_5) var(--space-2); border-radius: var(--radius-sm); cursor: pointer; text-transform: uppercase; letter-spacing: 0.03em; background: var(--status-planned-bg); color: var(--status-planned-text); border: 1px solid var(--status-planned-border);'

const statusInProgressStyle = 'font-size: var(--text-xs); font-weight: var(--font-medium); padding: var(--space-0_5) var(--space-2); border-radius: var(--radius-sm); border: 1px solid transparent; cursor: pointer; text-transform: uppercase; letter-spacing: 0.03em; background: var(--status-in-progress-bg); color: var(--status-in-progress-text); opacity: 0.6;'

const statusInProgressActiveStyle = 'font-size: var(--text-xs); font-weight: var(--font-medium); padding: var(--space-0_5) var(--space-2); border-radius: var(--radius-sm); cursor: pointer; text-transform: uppercase; letter-spacing: 0.03em; background: var(--status-in-progress-bg); color: var(--status-in-progress-text); border: 1px solid var(--status-in-progress-border);'

const statusDoneStyle = 'font-size: var(--text-xs); font-weight: var(--font-medium); padding: var(--space-0_5) var(--space-2); border-radius: var(--radius-sm); border: 1px solid transparent; cursor: pointer; text-transform: uppercase; letter-spacing: 0.03em; background: var(--status-done-bg); color: var(--status-done-text); opacity: 0.6;'

const statusDoneActiveStyle = 'font-size: var(--text-xs); font-weight: var(--font-medium); padding: var(--space-0_5) var(--space-2); border-radius: var(--radius-sm); cursor: pointer; text-transform: uppercase; letter-spacing: 0.03em; background: var(--status-done-bg); color: var(--status-done-text); border: 1px solid var(--status-done-border);'

const statusBacklogStyle = 'font-size: var(--text-xs); font-weight: var(--font-medium); padding: var(--space-0_5) var(--space-2); border-radius: var(--radius-sm); border: 1px solid transparent; cursor: pointer; text-transform: uppercase; letter-spacing: 0.03em; background: var(--status-backlog-bg); color: var(--status-backlog-text); opacity: 0.6;'

const statusBacklogActiveStyle = 'font-size: var(--text-xs); font-weight: var(--font-medium); padding: var(--space-0_5) var(--space-2); border-radius: var(--radius-sm); cursor: pointer; text-transform: uppercase; letter-spacing: 0.03em; background: var(--status-backlog-bg); color: var(--status-backlog-text); border: 1px solid var(--status-backlog-border);'

const dateInputStyle = 'flex: 1; font-size: var(--text-xs); padding: var(--space-1) var(--space-2); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--glass-bg-weak); color: var(--text-primary); color-scheme: dark; min-width: 0;'

const actionsRowStyle = 'display: flex; gap: var(--space-2); padding: var(--space-2) 0;'

const actionDoneStyle = 'display: inline-flex; align-items: center; gap: var(--space-1); padding: var(--space-1_5) var(--space-2_5); border-radius: var(--radius-md); font-size: var(--text-xs); font-weight: var(--font-medium); cursor: pointer; flex: 1; justify-content: center; background: var(--glass-bg-soft); color: var(--status-done-text); border: 1px solid var(--status-done-border); backdrop-filter: blur(8px);'

const actionTimerStyle = 'display: inline-flex; align-items: center; gap: var(--space-1); padding: var(--space-1_5) var(--space-2_5); border-radius: var(--radius-md); font-size: var(--text-xs); font-weight: var(--font-medium); cursor: pointer; flex: 1; justify-content: center; background: var(--glass-bg-soft); color: var(--color-focus); border: 1px solid rgba(139, 92, 246, 0.3); backdrop-filter: blur(8px);'

const fullEditorStyle = 'display: flex; align-items: center; justify-content: center; gap: var(--space-1); width: 100%; padding: var(--space-1); border: none; background: transparent; color: var(--text-tertiary); font-size: var(--text-xs); cursor: pointer;'

// Priority dot colors (semantic - these are standard Tailwind palette)
const priorityColors = {
  urgent: 'var(--priority-high-text)',
  high: '#f97316',
  medium: '#eab308',
  low: 'var(--priority-low-text)',
  none: 'var(--text-subtle)'
}

const checkIcon = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5" /></svg>'
const playIcon = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>'
const externalIcon = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>'

function renderPopover(opts: { title: string; priorityActive: number; statusActive: string; dueDate: string; tipText?: string; doneDisabled?: boolean }) {
  const priorityDots = [
    { color: priorityColors.urgent, idx: 0 },
    { color: priorityColors.high, idx: 1 },
    { color: priorityColors.medium, idx: 2 },
    { color: priorityColors.low, idx: 3 },
    { color: priorityColors.none, idx: 4 }
  ].map(p => {
    const btnStyle = p.idx === opts.priorityActive ? priorityDotBtnActiveStyle : priorityDotBtnStyle
    return `<button style="${btnStyle}"><span style="${priorityDotStyle} background: ${p.color};"></span></button>`
  }).join('')

  const statuses = [
    { key: 'planned', label: 'Planned', style: statusPlannedStyle, activeStyle: statusPlannedActiveStyle },
    { key: 'in_progress', label: 'Active', style: statusInProgressStyle, activeStyle: statusInProgressActiveStyle },
    { key: 'done', label: 'Done', style: statusDoneStyle, activeStyle: statusDoneActiveStyle },
    { key: 'backlog', label: 'Backlog', style: statusBacklogStyle, activeStyle: statusBacklogActiveStyle }
  ].map(s => {
    const style = s.key === opts.statusActive ? s.activeStyle : s.style
    return `<button style="${style}">${s.label}</button>`
  }).join('')

  const tipSection = opts.tipText ? `
    <div style="${tipsBannerStyle}">
      <div style="${tipItemStyle}">
        <span style="flex-shrink: 0;">🔥</span>
        <span>${opts.tipText}</span>
      </div>
    </div>
  ` : ''

  const doneDisabled = opts.doneDisabled ? ' opacity: 0.4; cursor: not-allowed;' : ''

  return `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 500px; background: var(--bg-primary); padding: var(--space-6);">
      <div style="${popoverStyle}">
        ${tipSection}
        <div style="${titleRowStyle}" dir="auto">${opts.title}</div>
        <div style="${dividerStyle}"></div>
        <div style="${fieldRowStyle}">
          <span style="${fieldLabelStyle}">Priority</span>
          <div style="${priorityDotsStyle}">${priorityDots}</div>
        </div>
        <div style="${fieldRowStyle}">
          <span style="${fieldLabelStyle}">Status</span>
          <div style="${statusBadgesStyle}">${statuses}</div>
        </div>
        <div style="${fieldRowStyle}">
          <span style="${fieldLabelStyle}">Due</span>
          <input type="date" style="${dateInputStyle}" value="${opts.dueDate}" />
        </div>
        <div style="${dividerStyle}"></div>
        <div style="${actionsRowStyle}">
          <button style="${actionDoneStyle}${doneDisabled}">
            ${checkIcon}
            <span>Mark Done</span>
          </button>
          <button style="${actionTimerStyle}">
            ${playIcon}
            <span>Start Timer</span>
          </button>
        </div>
        <button style="${fullEditorStyle}">
          <span>Open full editor</span>
          ${externalIcon}
        </button>
      </div>
    </div>
  `
}

/**
 * Default popover with medium priority, planned status, a due date
 */
export const Default: Story = {
  render: () => defineComponent({
    template: renderPopover({ title: 'Implement feature X', priorityActive: 2, statusActive: 'planned', dueDate: '2026-02-20' })
  })
}

/**
 * High priority task with in-progress status
 */
export const HighPriority: Story = {
  render: () => defineComponent({
    template: renderPopover({ title: 'Fix critical security vulnerability', priorityActive: 1, statusActive: 'in_progress', dueDate: '2026-02-15' })
  })
}

/**
 * Task marked as done
 */
export const DoneTask: Story = {
  render: () => defineComponent({
    template: renderPopover({ title: 'Implement feature X', priorityActive: 2, statusActive: 'done', dueDate: '2026-02-20', doneDisabled: true })
  })
}

/**
 * With context tips banner at top
 */
export const WithContextTips: Story = {
  render: () => defineComponent({
    template: renderPopover({ title: 'Daily standup meeting preparation', priorityActive: 1, statusActive: 'in_progress', dueDate: '2026-02-13', tipText: 'Complete this to maintain your 7-day streak!' })
  })
}
