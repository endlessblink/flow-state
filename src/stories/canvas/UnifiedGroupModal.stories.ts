import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent } from 'vue'

/**
 * ## UnifiedGroupModal
 *
 * Create/Edit modal for canvas groups (sections). Provides name input,
 * color presets grid, custom color picker, keyword detection, and
 * collapsible Smart Settings for auto-assigning task properties on drop.
 *
 * **Features:**
 * - 20 color presets in a 10-column grid
 * - Custom color input with native picker
 * - Power keyword detection (e.g. "In Progress" auto-detected as status)
 * - Smart Settings: Priority, Status, Due Date, Project, Duration
 * - Settings preview badge
 * - Glass morphism design throughout
 *
 * **Dependencies:** Canvas store, BaseInput, CustomSelect
 *
 * **Location:** `src/components/canvas/UnifiedGroupModal.vue`
 */

// ========================================
// Style Constants (Design System)
// ========================================

const modalStyle = 'width: 520px; background: var(--overlay-component-bg); backdrop-filter: var(--overlay-component-backdrop); -webkit-backdrop-filter: var(--overlay-component-backdrop); border: var(--overlay-component-border); border-radius: var(--radius-lg); box-shadow: var(--overlay-component-shadow); overflow: hidden;'

const headerStyle = 'display: flex; align-items: center; justify-content: space-between; padding: var(--space-5); border-bottom: 1px solid var(--glass-border);'

const titleStyle = 'display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-lg); font-weight: var(--font-semibold); color: var(--text-primary); margin: 0;'

const closeBtnStyle = 'background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: var(--space-2); border-radius: var(--radius-md); transition: all var(--duration-fast);'

const bodyStyle = 'padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-5);'

const labelStyle = 'display: block; font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--text-primary); margin-bottom: var(--space-2);'

const inputStyle = 'width: 100%; padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-sm); box-sizing: border-box; outline: none;'

const keywordHintStyle = 'display: flex; align-items: center; gap: var(--space-1); margin-top: var(--space-2); padding: var(--space-2); background: var(--yellow-bg-subtle); color: var(--yellow-text); border-radius: var(--radius-sm); font-size: var(--text-xs); font-weight: var(--font-medium);'

const colorPresetsContainerStyle = 'display: grid; grid-template-columns: repeat(10, 1fr); gap: var(--space-2); padding: var(--space-3); background: var(--glass-bg-light); border-radius: var(--radius-md); border: 1px solid var(--glass-border);'

const customColorSectionStyle = 'display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-3); background: var(--glass-bg-light); border-radius: var(--radius-md); border: 1px solid var(--glass-border); margin-top: var(--space-3);'

const colorLabelStyle = 'color: var(--text-secondary); font-size: var(--text-xs); font-weight: var(--font-medium);'

const colorInputWrapperStyle = 'display: flex; gap: var(--space-2); align-items: center;'

const colorTextInputStyle = 'flex: 1; padding: var(--space-2); background: var(--surface-primary); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-sm); font-family: var(--font-mono);'

const colorPickerInputStyle = 'width: 36px; height: 32px; border: none; border-radius: var(--radius-md); cursor: pointer; background: transparent;'

const colorPreviewStyle = 'display: flex; align-items: center; gap: var(--space-2);'

const colorValueStyle = 'font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-muted);'

// Smart Settings styles
const smartSectionStyle = 'margin-top: 0; border: 1px solid var(--glass-border); border-radius: var(--radius-md); overflow: hidden;'

const sectionToggleStyle = 'display: flex; align-items: center; gap: var(--space-2); width: 100%; padding: var(--space-3) var(--space-4); background: var(--glass-bg-light); border: none; cursor: pointer; color: var(--text-primary); font-size: var(--text-sm); font-weight: var(--font-medium); transition: all var(--duration-fast); text-align: left;'

const sectionTitleStyle = 'display: flex; align-items: center; gap: var(--space-2); flex: 1;'

const settingsBadgeStyle = 'padding: var(--space-1) var(--space-2); background: var(--brand-primary); color: white; border-radius: var(--radius-sm); font-size: var(--text-xs); font-weight: var(--font-semibold);'

const sectionContentStyle = 'padding: var(--space-4); background: var(--surface-primary); border-top: 1px solid var(--glass-border);'

const settingsHintStyle = 'font-size: var(--text-xs); color: var(--text-muted); margin: 0 0 var(--space-4) 0;'

const formGroupCompactStyle = 'margin-bottom: var(--space-3);'

const selectStyle = 'width: 100%; padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-sm); cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23888\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right var(--space-3) center;'

const settingsPreviewStyle = 'display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3); background: var(--purple-bg-subtle); border: 1px solid var(--brand-primary); border-radius: var(--radius-md); margin-top: var(--space-3);'

const previewLabelStyle = 'font-size: var(--text-xs); font-weight: var(--font-semibold); color: var(--brand-primary);'

const previewTextStyle = 'font-size: var(--text-sm); color: var(--text-primary);'

// Footer / Button styles
const footerStyle = 'display: flex; gap: var(--space-3); justify-content: flex-end; padding: var(--space-5); border-top: 1px solid var(--glass-border);'

const btnSecondaryStyle = 'display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: var(--font-medium); cursor: pointer; transition: all var(--duration-fast); background: var(--glass-bg-light); border: 1px solid var(--glass-border); color: var(--text-primary);'

const btnPrimaryStyle = 'display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: var(--font-medium); cursor: pointer; transition: all var(--duration-fast); background: transparent; border: 1px solid var(--brand-primary); color: var(--brand-primary);'

const btnPrimaryDisabledStyle = 'display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: var(--font-medium); cursor: not-allowed; background: var(--glass-bg-medium); border: 1px solid var(--glass-border); color: var(--text-muted); opacity: 0.5;'

// SVG Icons
const groupIcon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>'

const closeIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'

const zapIcon = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>'

const zapIcon14 = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>'

const chevronDownIcon = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>'

const chevronUpIcon = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>'

// ========================================
// Data
// ========================================

const colorPresets = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#64748b', '#475569', '#71717a'
]

// ========================================
// Render Helpers
// ========================================

function renderColorPreset(color: string, isActive: boolean) {
  const activeStyles = isActive
    ? `border: var(--space-0_5) solid var(--text-primary); box-shadow: 0 0 0 2px var(--glass-bg-light); transform: scale(1.1);`
    : `border: var(--space-0_5) solid transparent;`
  return `<div style="width: var(--space-7); height: var(--space-7); border-radius: var(--radius-sm); background-color: ${color}; ${activeStyles} cursor: pointer; transition: all var(--duration-fast);"></div>`
}

function renderColorGrid(selectedColor: string) {
  return `<div style="${colorPresetsContainerStyle}">${colorPresets.map(c => renderColorPreset(c, c === selectedColor)).join('')}</div>`
}

function renderCustomColorSection(color: string) {
  return `
    <div style="${customColorSectionStyle}">
      <div style="display: flex; flex-direction: column; gap: var(--space-1);">
        <span style="${colorLabelStyle}">Custom Color</span>
        <div style="${colorInputWrapperStyle}">
          <input type="text" value="${color}" style="${colorTextInputStyle}" />
          <input type="color" value="${color}" style="${colorPickerInputStyle}" />
        </div>
      </div>
      <div style="${colorPreviewStyle}">
        <div style="width: 20px; height: 20px; border-radius: var(--radius-sm); background-color: ${color}; border: 1px solid var(--glass-border);"></div>
        <span style="${colorValueStyle}">${color}</span>
      </div>
    </div>
  `
}

function renderSmartSettings(opts: {
  expanded: boolean
  hasSettings?: boolean
  priority?: string
  status?: string
  dueDate?: string
  preview?: string
}) {
  const { expanded, hasSettings = false, priority = '', status = '', dueDate = '', preview = '' } = opts

  let content = `
    <div style="${smartSectionStyle}">
      <button type="button" style="${sectionToggleStyle}">
        <span style="transition: transform var(--duration-fast); color: var(--text-muted);${expanded ? ' transform: rotate(180deg);' : ''}">${chevronDownIcon}</span>
        <span style="${sectionTitleStyle}">
          ${zapIcon14}
          Smart Settings
        </span>
        ${hasSettings ? `<span style="${settingsBadgeStyle}">Configured</span>` : ''}
      </button>
  `

  if (expanded) {
    content += `
      <div style="${sectionContentStyle}">
        <p style="${settingsHintStyle}">Tasks dropped into this group will have these properties set automatically</p>

        <div style="${formGroupCompactStyle}">
          <label style="${labelStyle}">Priority</label>
          <select style="${selectStyle}">
            <option value="" ${!priority ? 'selected' : ''}>Don't change</option>
            <option value="high" ${priority === 'high' ? 'selected' : ''}>High</option>
            <option value="medium" ${priority === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="low" ${priority === 'low' ? 'selected' : ''}>Low</option>
          </select>
        </div>

        <div style="${formGroupCompactStyle}">
          <label style="${labelStyle}">Status</label>
          <select style="${selectStyle}">
            <option value="" ${!status ? 'selected' : ''}>Don't change</option>
            <option value="planned" ${status === 'planned' ? 'selected' : ''}>Planned</option>
            <option value="in_progress" ${status === 'in_progress' ? 'selected' : ''}>In Progress</option>
            <option value="done" ${status === 'done' ? 'selected' : ''}>Done</option>
            <option value="backlog" ${status === 'backlog' ? 'selected' : ''}>Backlog</option>
            <option value="on_hold" ${status === 'on_hold' ? 'selected' : ''}>On Hold</option>
          </select>
        </div>

        <div style="${formGroupCompactStyle}">
          <label style="${labelStyle}">Due Date</label>
          <select style="${selectStyle}">
            <option value="" ${!dueDate ? 'selected' : ''}>Don't change</option>
            <option value="today" ${dueDate === 'today' ? 'selected' : ''}>Today</option>
            <option value="tomorrow" ${dueDate === 'tomorrow' ? 'selected' : ''}>Tomorrow</option>
            <option value="this_week" ${dueDate === 'this_week' ? 'selected' : ''}>This Week</option>
            <option value="this_weekend" ${dueDate === 'this_weekend' ? 'selected' : ''}>This Weekend</option>
            <option value="later" ${dueDate === 'later' ? 'selected' : ''}>Later (no specific date)</option>
          </select>
        </div>

        <div style="${formGroupCompactStyle}">
          <label style="${labelStyle}">Project</label>
          <select style="${selectStyle}">
            <option value="">Don't change</option>
            <option>Sprint Goals</option>
            <option>Technical Debt</option>
          </select>
        </div>

        <div style="margin-bottom: 0;">
          <label style="${labelStyle}">Duration</label>
          <select style="${selectStyle}">
            <option value="">Don't change</option>
            <option>Quick (&lt;15m)</option>
            <option>Short (15-30m)</option>
            <option>Medium (30-60m)</option>
            <option>Long (&gt;60m)</option>
            <option>Unestimated</option>
          </select>
        </div>

        ${preview ? `
          <div style="${settingsPreviewStyle}">
            <span style="${previewLabelStyle}">Preview:</span>
            <span style="${previewTextStyle}">${preview}</span>
          </div>
        ` : ''}
      </div>
    `
  }

  content += `</div>`
  return content
}

// ========================================
// Meta Configuration
// ========================================

const meta = {
  title: '🎨 Canvas/UnifiedGroupModal',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Create/Edit modal for canvas groups with color presets, keyword detection, and Smart Settings for auto-assigning task properties.'
      }
    }
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: '<div style="padding: var(--space-8); min-height: 500px;"><story /></div>'
    })
  ]
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

// ========================================
// Stories
// ========================================

/**
 * Create new group - empty form with default indigo color selected
 */
export const CreateNew: Story = {
  render: () => defineComponent({
    template: `
      <div style="${modalStyle}">
        <div style="${headerStyle}">
          <h2 style="${titleStyle}">
            <span>${groupIcon}</span>
            Create Group
          </h2>
          <button style="${closeBtnStyle}">${closeIcon}</button>
        </div>

        <div style="${bodyStyle}">
          <div>
            <label style="${labelStyle}">Group Name *</label>
            <input placeholder="Enter group name..." style="${inputStyle}" />
          </div>

          <div>
            <label style="${labelStyle}">Group Color</label>
            ${renderColorGrid('#6366f1')}
            ${renderCustomColorSection('#6366f1')}
          </div>

          ${renderSmartSettings({ expanded: false })}
        </div>

        <div style="${footerStyle}">
          <button style="${btnSecondaryStyle}">Cancel</button>
          <button style="${btnPrimaryDisabledStyle}">Create Group</button>
        </div>
      </div>
    `
  })
}

/**
 * Edit existing group with pre-filled data and active color
 */
export const EditExisting: Story = {
  render: () => defineComponent({
    template: `
      <div style="${modalStyle}">
        <div style="${headerStyle}">
          <h2 style="${titleStyle}">
            <span>${groupIcon}</span>
            Edit Group
          </h2>
          <button style="${closeBtnStyle}">${closeIcon}</button>
        </div>

        <div style="${bodyStyle}">
          <div>
            <label style="${labelStyle}">Group Name *</label>
            <input value="In Progress" style="${inputStyle}" />
            <div style="${keywordHintStyle}">
              ${zapIcon}
              Detected: In Progress
            </div>
          </div>

          <div>
            <label style="${labelStyle}">Group Color</label>
            ${renderColorGrid('#f59e0b')}
            ${renderCustomColorSection('#f59e0b')}
          </div>

          ${renderSmartSettings({ expanded: false, hasSettings: true })}
        </div>

        <div style="${footerStyle}">
          <button style="${btnSecondaryStyle}">Cancel</button>
          <button style="${btnPrimaryStyle}">Save Changes</button>
        </div>
      </div>
    `
  })
}

/**
 * Smart Settings section expanded with configured values and preview
 */
export const SmartSettingsExpanded: Story = {
  render: () => defineComponent({
    template: `
      <div style="${modalStyle}">
        <div style="${headerStyle}">
          <h2 style="${titleStyle}">
            <span>${groupIcon}</span>
            Edit Group
          </h2>
          <button style="${closeBtnStyle}">${closeIcon}</button>
        </div>

        <div style="${bodyStyle}">
          <div>
            <label style="${labelStyle}">Group Name *</label>
            <input value="Sprint Backlog" style="${inputStyle}" />
          </div>

          <div>
            <label style="${labelStyle}">Group Color</label>
            ${renderColorGrid('#3b82f6')}
            ${renderCustomColorSection('#3b82f6')}
          </div>

          ${renderSmartSettings({
            expanded: true,
            hasSettings: true,
            status: 'backlog',
            priority: 'medium',
            preview: 'Status: Backlog, Priority: Medium'
          })}
        </div>

        <div style="${footerStyle}">
          <button style="${btnSecondaryStyle}">Cancel</button>
          <button style="${btnPrimaryStyle}">Save Changes</button>
        </div>
      </div>
    `
  })
}

/**
 * Keyword detection showing auto-detected "In Progress" status
 */
export const KeywordDetected: Story = {
  render: () => defineComponent({
    template: `
      <div style="${modalStyle}">
        <div style="${headerStyle}">
          <h2 style="${titleStyle}">
            <span>${groupIcon}</span>
            Create Group
          </h2>
          <button style="${closeBtnStyle}">${closeIcon}</button>
        </div>

        <div style="${bodyStyle}">
          <div>
            <label style="${labelStyle}">Group Name *</label>
            <input value="In Progress" style="${inputStyle}" />
            <div style="${keywordHintStyle}">
              ${zapIcon}
              Detected: In Progress
            </div>
          </div>

          <div>
            <label style="${labelStyle}">Group Color</label>
            ${renderColorGrid('#f59e0b')}
            ${renderCustomColorSection('#f59e0b')}
          </div>

          ${renderSmartSettings({
            expanded: true,
            hasSettings: true,
            status: 'in_progress',
            preview: 'Status: In Progress'
          })}
        </div>

        <div style="${footerStyle}">
          <button style="${btnSecondaryStyle}">Cancel</button>
          <button style="${btnPrimaryStyle}">Create Group</button>
        </div>
      </div>
    `
  })
}
