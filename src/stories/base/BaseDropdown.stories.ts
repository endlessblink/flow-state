import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import BaseDropdown from '@/components/base/BaseDropdown.vue'
import type { DropdownOption } from '@/components/base/BaseDropdown.vue'
import { Folder, Tag, Calendar, Inbox } from 'lucide-vue-next'

const meta = {
  component: BaseDropdown,
  title: '🧩 Components/🔘 Base/BaseDropdown',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A unified dropdown/select component built on BasePopover with keyboard navigation, single/multi-select, and glass morphism styling.'
      }
    }
  },
} satisfies Meta<typeof BaseDropdown>

export default meta
type Story = StoryObj<typeof meta>

// Basic options
const basicOptions: DropdownOption[] = [
  { label: 'Option 1', value: '1' },
  { label: 'Option 2', value: '2' },
  { label: 'Option 3', value: '3' },
  { label: 'Disabled Option', value: '4', disabled: true },
  { label: 'Option 5', value: '5' },
]

// Options with icons
const iconOptions: DropdownOption[] = [
  { label: 'Inbox', value: 'inbox', icon: Inbox },
  { label: 'Projects', value: 'projects', icon: Folder },
  { label: 'Tags', value: 'tags', icon: Tag },
  { label: 'Calendar', value: 'calendar', icon: Calendar },
]

// Single Select - Basic
export const SingleSelect: Story = {
  render: () => ({
    components: { BaseDropdown },
    setup() {
      const selected = ref('2')
      const options = basicOptions

      return { selected, options }
    },
    template: `
      <div style="width: 300px;">
        <label style="display: block; margin-bottom: 8px; color: var(--text-primary); font-size: 14px; font-weight: 600;">
          Select an option
        </label>
        <BaseDropdown
          v-model="selected"
          :options="options"
          placeholder="Choose one..."
        />
        <div style="margin-top: 16px; padding: 12px; background: var(--glass-bg-soft); border-radius: 8px; font-size: 14px; color: var(--text-secondary);">
          Selected: <strong style="color: var(--text-primary);">{{ selected }}</strong>
        </div>
      </div>
    `,
  })
}

// With Icons
export const WithIcons: Story = {
  render: () => ({
    components: { BaseDropdown },
    setup() {
      const selected = ref('inbox')
      const options = iconOptions

      return { selected, options }
    },
    template: `
      <div style="width: 300px;">
        <label style="display: block; margin-bottom: 8px; color: var(--text-primary); font-size: 14px; font-weight: 600;">
          Select a view
        </label>
        <BaseDropdown
          v-model="selected"
          :options="options"
          placeholder="Choose view..."
        />
        <div style="margin-top: 16px; padding: 12px; background: var(--glass-bg-soft); border-radius: 8px; font-size: 14px; color: var(--text-secondary);">
          Selected view: <strong style="color: var(--text-primary);">{{ selected }}</strong>
        </div>
      </div>
    `,
  })
}

// Multi-select
export const MultiSelect: Story = {
  render: () => ({
    components: { BaseDropdown },
    setup() {
      const selected = ref(['1', '3'])
      const options = basicOptions

      return { selected, options }
    },
    template: `
      <div style="width: 300px;">
        <label style="display: block; margin-bottom: 8px; color: var(--text-primary); font-size: 14px; font-weight: 600;">
          Select multiple options
        </label>
        <BaseDropdown
          v-model="selected"
          :options="options"
          :multiple="true"
          placeholder="Choose multiple..."
        />
        <div style="margin-top: 16px; padding: 12px; background: var(--glass-bg-soft); border-radius: 8px; font-size: 14px; color: var(--text-secondary);">
          Selected: <strong style="color: var(--text-primary);">{{ selected.join(', ') }}</strong>
        </div>
      </div>
    `,
  })
}

// Disabled State
export const Disabled: Story = {
  render: () => ({
    components: { BaseDropdown },
    setup() {
      const selected = ref('2')
      const options = basicOptions

      return { selected, options }
    },
    template: `
      <div style="width: 300px;">
        <label style="display: block; margin-bottom: 8px; color: var(--text-primary); font-size: 14px; font-weight: 600; opacity: 0.5;">
          Disabled dropdown
        </label>
        <BaseDropdown
          v-model="selected"
          :options="options"
          :disabled="true"
          placeholder="Cannot interact..."
        />
        <div style="margin-top: 16px; padding: 12px; background: var(--glass-bg-soft); border-radius: 8px; font-size: 14px; color: var(--text-secondary);">
          Dropdown is disabled
        </div>
      </div>
    `,
  })
}

// Project Filter Dropdown (Real-world use case)
export const ProjectFilter: Story = {
  render: () => ({
    components: { BaseDropdown },
    setup() {
      const selected = ref<string | number>('all')
      const projects: DropdownOption[] = [
        { label: 'All Projects', value: 'all', icon: Folder },
        { label: 'Work', value: 'work', icon: Folder },
        { label: 'Personal', value: 'personal', icon: Folder },
        { label: 'Learning', value: 'learning', icon: Folder },
        { label: 'Archived', value: 'archived', icon: Folder, disabled: true },
      ]

      return { selected, projects }
    },
    template: `
      <div style="width: 300px;">
        <label style="display: block; margin-bottom: 8px; color: var(--text-primary); font-size: 14px; font-weight: 600;">
          Filter by project
        </label>
        <BaseDropdown
          v-model="selected"
          :options="projects"
          placeholder="Select project..."
        />
        <div style="margin-top: 16px; padding: 12px; background: var(--glass-bg-soft); border-radius: 8px; font-size: 14px; color: var(--text-secondary);">
          Showing tasks from: <strong style="color: var(--text-primary);">{{ selected }}</strong>
        </div>
      </div>
    `,
  })
}

// Priority Selector (Multi-select with icons)
export const PrioritySelector: Story = {
  render: () => ({
    components: { BaseDropdown },
    setup() {
      const selected = ref(['high', 'medium'])
      const priorities: DropdownOption[] = [
        { label: 'High Priority', value: 'high' },
        { label: 'Medium Priority', value: 'medium' },
        { label: 'Low Priority', value: 'low' },
        { label: 'No Priority', value: 'none' },
      ]

      return { selected, priorities }
    },
    template: `
      <div style="width: 300px;">
        <label style="display: block; margin-bottom: 8px; color: var(--text-primary); font-size: 14px; font-weight: 600;">
          Filter by priority
        </label>
        <BaseDropdown
          v-model="selected"
          :options="priorities"
          :multiple="true"
          placeholder="Select priorities..."
        />
        <div style="margin-top: 16px; padding: 12px; background: var(--glass-bg-soft); border-radius: 8px;">
          <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">
            Showing <strong style="color: var(--text-primary);">{{ selected.length }}</strong> priorities:
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <span
              v-for="priority in selected"
              :key="priority"
              style="padding: 4px 12px; background: var(--brand-primary); color: white; border-radius: 12px; font-size: 12px; font-weight: 600;"
            >
              {{ priority }}
            </span>
          </div>
        </div>
      </div>
    `,
  })
}

// Keyboard Navigation Demo
export const KeyboardNavigation: Story = {
  render: () => ({
    components: { BaseDropdown },
    setup() {
      const selected = ref('2')
      const options = basicOptions

      return { selected, options }
    },
    template: `
      <div style="width: 300px;">
        <div style="margin-bottom: 16px; padding: 12px; background: color-mix(in srgb, var(--brand-primary) 10%, transparent); border: 1px solid var(--brand-primary); border-radius: 8px; font-size: 13px; color: var(--text-primary);">
          <strong style="display: block; margin-bottom: 8px; color: var(--brand-primary);">⌨️ Keyboard Navigation:</strong>
          <ul style="margin: 0; padding-left: 20px; line-height: 1.6;">
            <li><kbd style="padding: 2px 6px; background: var(--glass-bg-medium); border: 1px solid var(--glass-border); border-radius: 4px; font-size: 11px;">↓</kbd> / <kbd style="padding: 2px 6px; background: var(--glass-bg-medium); border: 1px solid var(--glass-border); border-radius: 4px; font-size: 11px;">↑</kbd> Navigate options</li>
            <li><kbd style="padding: 2px 6px; background: var(--glass-bg-medium); border: 1px solid var(--glass-border); border-radius: 4px; font-size: 11px;">Enter</kbd> Select option</li>
            <li><kbd style="padding: 2px 6px; background: var(--glass-bg-medium); border: 1px solid var(--glass-border); border-radius: 4px; font-size: 11px;">Esc</kbd> Close dropdown</li>
          </ul>
        </div>
        <label style="display: block; margin-bottom: 8px; color: var(--text-primary); font-size: 14px; font-weight: 600;">
          Try keyboard controls
        </label>
        <BaseDropdown
          v-model="selected"
          :options="options"
          placeholder="Focus and use arrows..."
        />
        <div style="margin-top: 16px; padding: 12px; background: var(--glass-bg-soft); border-radius: 8px; font-size: 14px; color: var(--text-secondary);">
          Selected: <strong style="color: var(--text-primary);">{{ selected }}</strong>
        </div>
      </div>
    `,
  })
}
