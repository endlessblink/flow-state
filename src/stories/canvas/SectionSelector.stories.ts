import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent } from 'vue'

/**
 * ## SectionSelector
 *
 * Dropdown selector for choosing a canvas section/group.
 * Shows categorized sections with color dots and a "None (Move to Inbox)" option.
 *
 * **Features:**
 * - Categorized groups: Custom Groups, Status Columns, Priority Areas, etc.
 * - Glass morphism design with backdrop blur
 * - Color dots for visual section identification
 * - Compact variant for inline usage
 * - Empty state when no sections exist
 *
 * **Dependencies:** Canvas store for section list
 *
 * **Location:** `src/components/canvas/SectionSelector.vue`
 */

// ========================================
// Style Constants (Design System)
// ========================================

const containerStyle = 'position: relative; width: 260px;'

const triggerStyle = 'width: 100%; display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: var(--glass-bg-medium); backdrop-filter: var(--overlay-component-backdrop); -webkit-backdrop-filter: var(--overlay-component-backdrop); border: 1px solid var(--glass-border-hover); border-radius: var(--radius-lg); color: var(--text-primary); font-size: var(--text-sm); cursor: pointer; transition: all var(--duration-normal) var(--ease-out); min-height: var(--space-10); outline: none;'

const selectedInfoStyle = 'display: flex; align-items: center; gap: var(--space-2); flex: 1;'

const colorDotStyle = 'width: var(--space-2_5); height: var(--space-2_5); border-radius: 50%; flex-shrink: 0;'

const placeholderStyle = 'flex: 1; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'

const iconStyle = 'color: var(--text-muted); transition: transform var(--duration-normal) var(--ease-out);'

const iconOpenStyle = 'transform: rotate(180deg);'

const dropdownStyle = 'position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 1000; background: var(--overlay-component-bg); backdrop-filter: var(--overlay-component-backdrop); -webkit-backdrop-filter: var(--overlay-component-backdrop); border: var(--overlay-component-border); box-shadow: var(--overlay-component-shadow); border-radius: var(--radius-xl); max-height: 350px; overflow-y: auto; padding: var(--space-2); min-width: 200px; isolation: isolate; transform: translateZ(0);'

const noneOptionStyle = 'display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2_5) var(--space-3); border-radius: var(--radius-md); color: var(--text-muted); font-size: var(--text-sm); cursor: pointer; transition: all var(--duration-normal) var(--ease-out); white-space: nowrap; border-bottom: 1px solid var(--glass-border); margin-bottom: var(--space-2);'

const groupHeaderStyle = 'padding: var(--space-2) var(--space-3) var(--space-1); font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); font-weight: var(--font-bold);'

const optionStyle = 'display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2_5) var(--space-3); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-sm); cursor: pointer; transition: all var(--duration-normal) var(--ease-out); white-space: nowrap;'

const optionSelectedStyle = 'background: var(--brand-primary-bg-medium); color: var(--brand-primary);'

const emptyStateStyle = 'padding: var(--space-4); text-align: center; color: var(--text-muted); font-size: var(--text-sm);'

// Compact variant styles
const compactContainerStyle = 'position: relative; width: auto;'

const compactTriggerStyle = 'display: flex; align-items: center; gap: var(--space-2); padding: 0; background: transparent; backdrop-filter: none; border: none; color: var(--text-primary); font-size: var(--text-xs); cursor: pointer; transition: all var(--duration-normal) var(--ease-out); outline: none; height: auto; width: auto;'

const compactColorDotStyle = 'width: var(--space-2); height: var(--space-2); border-radius: 50%; flex-shrink: 0;'

const compactValueStyle = 'font-size: var(--text-xs); font-weight: var(--font-medium);'

const compactIconStyle = 'color: var(--text-tertiary);'

// ========================================
// SVG Icons
// ========================================

const chevronDownIcon = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>'

const inboxIcon = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>'

// ========================================
// Section Data
// ========================================

interface Section {
  id: string
  name: string
  color: string
  type: string
}

const sections: Section[] = [
  // Custom Groups
  { id: 'g1', name: 'Sprint Goals', color: '#8b5cf6', type: 'custom' },
  { id: 'g2', name: 'Technical Debt', color: '#ec4899', type: 'custom' },
  // Status Columns
  { id: 's1', name: 'To Do', color: '#3b82f6', type: 'status' },
  { id: 's2', name: 'In Progress', color: '#f59e0b', type: 'status' },
  { id: 's3', name: 'Done', color: '#10b981', type: 'status' },
  { id: 's4', name: 'Backlog', color: '#6b7280', type: 'status' },
  // Priority Areas
  { id: 'p1', name: 'Urgent', color: '#ef4444', type: 'priority' },
  { id: 'p2', name: 'Low Priority', color: '#94a3b8', type: 'priority' }
]

interface CategoryGroup {
  label: string
  sections: Section[]
}

const categorizedSections: CategoryGroup[] = [
  {
    label: 'Custom Groups',
    sections: sections.filter(s => s.type === 'custom')
  },
  {
    label: 'Status Columns',
    sections: sections.filter(s => s.type === 'status')
  },
  {
    label: 'Priority Areas',
    sections: sections.filter(s => s.type === 'priority')
  }
]

// ========================================
// Render Helpers
// ========================================

function renderTrigger(opts: {
  selectedSection?: Section | null
  placeholder?: string
  isOpen?: boolean
  compact?: boolean
}) {
  const { selectedSection, placeholder = 'Select a section...', isOpen = false, compact = false } = opts

  const style = compact ? compactTriggerStyle : triggerStyle
  const dotStyle = compact ? compactColorDotStyle : colorDotStyle
  const valueStyle = compact ? compactValueStyle : 'flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
  const iconClass = compact ? compactIconStyle : iconStyle

  if (selectedSection) {
    return `
      <button type="button" style="${style}">
        <div style="${selectedInfoStyle}">
          <div style="${dotStyle} background-color: ${selectedSection.color};"></div>
          <span style="${valueStyle}">${selectedSection.name}</span>
        </div>
        <span style="${iconClass}${isOpen ? ` ${iconOpenStyle}` : ''}">${chevronDownIcon}</span>
      </button>
    `
  }

  return `
    <button type="button" style="${style}">
      <span style="${placeholderStyle}">${placeholder}</span>
      <span style="${iconClass}${isOpen ? ` ${iconOpenStyle}` : ''}">${chevronDownIcon}</span>
    </button>
  `
}

function renderDropdown(opts: {
  selectedId?: string | null
  showEmpty?: boolean
}) {
  const { selectedId = null, showEmpty = false } = opts

  if (showEmpty) {
    return `
      <div style="${dropdownStyle}">
        <div style="${emptyStateStyle}">
          No sections found on canvas
        </div>
      </div>
    `
  }

  let html = `<div style="${dropdownStyle}">`

  // None option
  const noneSelected = !selectedId
  html += `
    <div style="${noneOptionStyle}${noneSelected ? ` ${optionSelectedStyle}` : ''}">
      <span>${inboxIcon}</span>
      <span>None (Move to Inbox)</span>
    </div>
  `

  // Categorized sections
  categorizedSections.forEach(group => {
    html += `<div style="margin-top: var(--space-1);">`
    html += `<div style="${groupHeaderStyle}">${group.label}</div>`

    group.sections.forEach(section => {
      const isSelected = section.id === selectedId
      html += `
        <div style="${optionStyle}${isSelected ? ` ${optionSelectedStyle}` : ''}">
          <div style="${colorDotStyle} background-color: ${section.color};"></div>
          <span>${section.name}</span>
        </div>
      `
    })

    html += `</div>`
  })

  html += `</div>`
  return html
}

// ========================================
// Meta Configuration
// ========================================

const meta = {
  title: '🎨 Canvas/SectionSelector',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Dropdown selector for canvas sections with categorized groups, color dots, and glass morphism design.'
      }
    }
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: '<div style="padding: var(--space-8); min-height: 400px;"><story /></div>'
    })
  ]
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

// ========================================
// Stories
// ========================================

/**
 * Default closed state with no selection
 */
export const Default: Story = {
  render: () => defineComponent({
    template: `
      <div style="${containerStyle}">
        ${renderTrigger({ placeholder: 'Select a section...' })}
      </div>
    `
  })
}

/**
 * Closed state with a section selected
 */
export const WithSelection: Story = {
  render: () => defineComponent({
    template: `
      <div style="${containerStyle}">
        ${renderTrigger({ selectedSection: sections.find(s => s.id === 's2') })}
      </div>
    `
  })
}

/**
 * Open dropdown showing all categorized sections
 */
export const OpenDropdown: Story = {
  render: () => defineComponent({
    template: `
      <div style="${containerStyle}">
        ${renderTrigger({ placeholder: 'Select a section...', isOpen: true })}
        ${renderDropdown({ selectedId: null })}
      </div>
    `
  })
}

/**
 * Open dropdown with a section selected (highlighted)
 */
export const SelectedInDropdown: Story = {
  render: () => defineComponent({
    template: `
      <div style="${containerStyle}">
        ${renderTrigger({ selectedSection: sections.find(s => s.id === 'p1'), isOpen: true })}
        ${renderDropdown({ selectedId: 'p1' })}
      </div>
    `
  })
}

/**
 * Compact variant - used inline in metadata bars
 */
export const Compact: Story = {
  render: () => defineComponent({
    template: `
      <div style="${compactContainerStyle}">
        ${renderTrigger({ selectedSection: sections.find(s => s.id === 's2'), compact: true })}
      </div>
    `
  })
}

/**
 * Compact variant with dropdown open
 */
export const CompactOpen: Story = {
  render: () => defineComponent({
    template: `
      <div style="${compactContainerStyle}">
        ${renderTrigger({ selectedSection: sections.find(s => s.id === 's2'), isOpen: true, compact: true })}
        ${renderDropdown({ selectedId: 's2' })}
      </div>
    `
  })
}

/**
 * Empty state when no sections exist on canvas
 */
export const EmptyState: Story = {
  render: () => defineComponent({
    template: `
      <div style="${containerStyle}">
        ${renderTrigger({ placeholder: 'Select a section...', isOpen: true })}
        ${renderDropdown({ showEmpty: true })}
      </div>
    `
  })
}
