import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import BaseNavItem from '@/components/base/BaseNavItem.vue'

const meta = {
  component: BaseNavItem,
  title: '🧩 Components/🔘 Base/BaseNavItem',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
  },

  argTypes: {
    nested: {
      control: 'boolean',
      description: 'Whether the item is nested (indented)',
    },
    hasChildren: {
      control: 'boolean',
      description: 'Whether the item has child items (shows expand chevron)',
    },
    expanded: {
      control: 'boolean',
      description: 'Whether the item is currently expanded (if has children)',
    },
    colorDot: {
      control: 'text',
      description: 'Color for the project dot (hex color)',
    },
    colorType: {
      control: 'select',
      options: ['hex', 'emoji'],
      description: 'Type of color indicator',
    },
    emoji: {
      control: 'text',
      description: 'Emoji for the project (if colorType is emoji)',
    },
    count: {
      control: 'number',
      description: 'Count to display in badge',
    },
  },
} satisfies Meta<typeof BaseNavItem>

export default meta
type Story = StoryObj<typeof meta>

// Basic Navigation Items
export const Default: Story = {
  render: () => ({
    components: { BaseNavItem },
    template: '<BaseNavItem>Inbox</BaseNavItem>',
  })
}

export const Active: Story = {
  render: () => ({
    components: { BaseNavItem },
    template: '<BaseNavItem :active="true">Today</BaseNavItem>',
  })
}

export const WithCount: Story = {
  render: () => ({
    components: { BaseNavItem },
    template: '<BaseNavItem :count="5">Inbox</BaseNavItem>',
  })
}

// With Icons
export const WithIcon: Story = {
  render: () => ({
    components: { BaseNavItem },
    template: `
      <BaseNavItem>
        <template #icon>
          <span style="font-size: 16px;">📥</span>
        </template>
        Inbox
      </BaseNavItem>
    `,
  })
}

export const ActiveWithIcon: Story = {
  render: () => ({
    components: { BaseNavItem },
    template: `
      <BaseNavItem :active="true" :count="12">
        <template #icon>
          <span style="font-size: 16px;">📅</span>
        </template>
        Today
      </BaseNavItem>
    `,
  })
}

// Project Items with Color Dots
export const ProjectWithColorDot: Story = {
  render: () => ({
    components: { BaseNavItem },
    template: `
      <BaseNavItem color-dot="#3b82f6" :count="8">
        Work Projects
      </BaseNavItem>
    `,
  })
}

export const MultipleProjects: Story = {
  render: () => ({
    components: { BaseNavItem },
    template: `
      <div style="display: flex; flex-direction: column; gap: 4px; min-width: 250px;">
        <BaseNavItem color-dot="#3b82f6" :count="8">
          Work Projects
        </BaseNavItem>
        <BaseNavItem color-dot="#10b981" :count="3">
          Personal Tasks
        </BaseNavItem>
        <BaseNavItem color-dot="#f59e0b" :count="15">
          Learning
        </BaseNavItem>
        <BaseNavItem color-dot="#ef4444" :count="2">
          Urgent
        </BaseNavItem>
      </div>
    `,
  })
}

// Project with Emoji
export const ProjectWithEmoji: Story = {
  render: () => ({
    components: { BaseNavItem },
    template: `
      <BaseNavItem color-type="emoji" emoji="💼" :count="5">
        Career Development
      </BaseNavItem>
    `,
  })
}

export const MultipleEmojiProjects: Story = {
  render: () => ({
    components: { BaseNavItem },
    template: `
      <div style="display: flex; flex-direction: column; gap: 4px; min-width: 250px;">
        <BaseNavItem color-type="emoji" emoji="💼" :count="5">
          Career Development
        </BaseNavItem>
        <BaseNavItem color-type="emoji" emoji="🏠" :count="12">
          Home Projects
        </BaseNavItem>
        <BaseNavItem color-type="emoji" emoji="📚" :count="8">
          Study Goals
        </BaseNavItem>
        <BaseNavItem color-type="emoji" emoji="💪" :count="3">
          Fitness Plans
        </BaseNavItem>
      </div>
    `,
  })
}

// Nested Items
export const NestedItems: Story = {
  render: () => ({
    components: { BaseNavItem },
    template: `
      <div style="display: flex; flex-direction: column; gap: 4px; min-width: 250px;">
        <BaseNavItem color-dot="#3b82f6" :has-children="true" :expanded="true" :count="8">
          Work Projects
        </BaseNavItem>
        <BaseNavItem :nested="true" color-dot="#60a5fa" :count="3">
          Frontend Development
        </BaseNavItem>
        <BaseNavItem :nested="true" color-dot="#93c5fd" :count="5">
          Backend Services
        </BaseNavItem>
        <BaseNavItem color-dot="#10b981" :count="4">
          Personal Tasks
        </BaseNavItem>
      </div>
    `,
  })
}

export const CollapsedNested: Story = {
  render: () => ({
    components: { BaseNavItem },
    template: `
      <div style="display: flex; flex-direction: column; gap: 4px; min-width: 250px;">
        <BaseNavItem color-dot="#3b82f6" :has-children="true" :expanded="false" :count="8">
          Work Projects
        </BaseNavItem>
        <BaseNavItem color-dot="#10b981" :count="4">
          Personal Tasks
        </BaseNavItem>
      </div>
    `,
  })
}

// Active States
export const ActiveStates: Story = {
  render: () => ({
    components: { BaseNavItem },
    template: `
      <div style="display: flex; flex-direction: column; gap: 4px; min-width: 250px;">
        <BaseNavItem :active="true" color-dot="#3b82f6" :count="8">
          Work Projects (Active)
        </BaseNavItem>
        <BaseNavItem color-dot="#10b981" :count="4">
          Personal Tasks
        </BaseNavItem>
        <BaseNavItem color-dot="#f59e0b" :count="12">
          Learning
        </BaseNavItem>
      </div>
    `,
  })
}

// Full Navigation Sidebar
export const SidebarNavigation: Story = {
  render: () => ({
    components: { BaseNavItem },
    template: `
      <div style="display: flex; flex-direction: column; gap: 4px; min-width: 280px; padding: 16px; background: var(--surface-secondary); border-radius: 12px;">
        <div style="margin-bottom: 8px;">
          <h4 style="margin: 0; color: var(--text-muted); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Navigation</h4>
        </div>

        <BaseNavItem :active="true">
          <template #icon>
            <span style="font-size: 16px;">📥</span>
          </template>
          Inbox
          <BaseBadge variant="count" size="sm" rounded>24</BaseBadge>
        </BaseNavItem>

        <BaseNavItem>
          <template #icon>
            <span style="font-size: 16px;">📅</span>
          </template>
          Today
          <BaseBadge variant="count" size="sm" rounded>5</BaseBadge>
        </BaseNavItem>

        <BaseNavItem>
          <template #icon>
            <span style="font-size: 16px;">⏰</span>
          </template>
          Upcoming
        </BaseNavItem>

        <div style="margin: 16px 0 8px 0;">
          <h4 style="margin: 0; color: var(--text-muted); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Projects</h4>
        </div>

        <BaseNavItem color-dot="#3b82f6" :has-children="true" :expanded="true" :count="8">
          Work Projects
        </BaseNavItem>

        <BaseNavItem :nested="true" color-dot="#60a5fa" :count="3">
          Frontend Development
        </BaseNavItem>

        <BaseNavItem :nested="true" color-dot="#93c5fd" :count="5">
          Backend Services
        </BaseNavItem>

        <BaseNavItem color-dot="#10b981" :count="4">
          Personal Tasks
        </BaseNavItem>

        <BaseNavItem color-type="emoji" emoji="📚" :count="12">
          Study Goals
        </BaseNavItem>

        <BaseNavItem color-type="emoji" emoji="💪" :count="3">
          Fitness Plans
        </BaseNavItem>
      </div>
    `,
  })
}

// Interactive Demo
export const InteractiveDemo: Story = {
  render: () => ({
    components: { BaseNavItem },
    setup() {
      const activeItem = ref('inbox')
      const expandedProjects = ref(['work'])

      const handleClick = (itemName: string) => {
        activeItem.value = itemName
      }

      const toggleExpand = (projectName: string) => {
        const index = expandedProjects.value.indexOf(projectName)
        if (index > -1) {
          expandedProjects.value.splice(index, 1)
        } else {
          expandedProjects.value.push(projectName)
        }
      }

      return { activeItem, expandedProjects, handleClick, toggleExpand }
    },
    template: `
      <div style="display: flex; flex-direction: column; gap: 4px; min-width: 280px; padding: 16px; background: var(--surface-secondary); border-radius: 12px;">
        <BaseNavItem
          :active="activeItem === 'inbox'"
          @click="handleClick('inbox')"
          :count="24"
        >
          <template #icon>
            <span style="font-size: 16px;">📥</span>
          </template>
          Inbox
        </BaseNavItem>

        <BaseNavItem
          :active="activeItem === 'today'"
          @click="handleClick('today')"
          :count="5"
        >
          <template #icon>
            <span style="font-size: 16px;">📅</span>
          </template>
          Today
        </BaseNavItem>

        <BaseNavItem
          color-dot="#3b82f6"
          :has-children="true"
          :expanded="expandedProjects.includes('work')"
          @toggle-expand="toggleExpand('work')"
          :count="8"
        >
          Work Projects
        </BaseNavItem>

        <BaseNavItem
          v-if="expandedProjects.includes('work')"
          :nested="true"
          color-dot="#60a5fa"
          :count="3"
          :active="activeItem === 'frontend'"
          @click="handleClick('frontend')"
        >
          Frontend Development
        </BaseNavItem>

        <BaseNavItem
          v-if="expandedProjects.includes('work')"
          :nested="true"
          color-dot="#93c5fd"
          :count="5"
          :active="activeItem === 'backend'"
          @click="handleClick('backend')"
        >
          Backend Services
        </BaseNavItem>

        <BaseNavItem
          color-type="emoji"
          emoji="📚"
          :count="12"
          :active="activeItem === 'study'"
          @click="handleClick('study')"
        >
          Study Goals
        </BaseNavItem>

        <div style="margin-top: 16px; padding: 12px; background: var(--surface-tertiary); border-radius: 8px; font-size: 13px; color: var(--text-muted);">
          <strong>Active:</strong> {{ activeItem }}<br>
          <strong>Expanded:</strong> {{ expandedProjects.join(', ') || 'None' }}
        </div>
      </div>
    `,
  })
}

// All Variants Showcase
export const AllVariants: Story = {
  render: () => ({
    components: { BaseNavItem },
    template: `
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; padding: 20px; min-width: 700px;">
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <h4 style="margin: 0; color: var(--text-secondary); font-size: 14px; font-weight: 600; text-align: center;">BASIC NAVIGATION</h4>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <BaseNavItem>Inbox</BaseNavItem>
            <BaseNavItem :active="true">Today (Active)</BaseNavItem>
            <BaseNavItem :count="5">Upcoming</BaseNavItem>
            <BaseNavItem :count="12" :active="true">Completed (Active)</BaseNavItem>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          <h4 style="margin: 0; color: var(--text-secondary); font-size: 14px; font-weight: 600; text-align: center;">PROJECTS</h4>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <BaseNavItem color-dot="#3b82f6" :count="8">Work Projects</BaseNavItem>
            <BaseNavItem color-dot="#10b981" :count="4">Personal Tasks</BaseNavItem>
            <BaseNavItem color-type="emoji" emoji="📚" :count="12">Study Goals</BaseNavItem>
            <BaseNavItem color-type="emoji" emoji="💪" :count="3" :active="true">Fitness (Active)</BaseNavItem>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          <h4 style="margin: 0; color: var(--text-secondary); font-size: 14px; font-weight: 600; text-align: center;">NESTED ITEMS</h4>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <BaseNavItem color-dot="#3b82f6" :has-children="true" :expanded="true" :count="8">
              Work Projects
            </BaseNavItem>
            <BaseNavItem :nested="true" color-dot="#60a5fa" :count="3">Frontend</BaseNavItem>
            <BaseNavItem :nested="true" color-dot="#93c5fd" :count="5" :active="true">Backend (Active)</BaseNavItem>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          <h4 style="margin: 0; color: var(--text-secondary); font-size: 14px; font-weight: 600; text-align: center;">WITH ICONS</h4>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <BaseNavItem :active="true" :count="24">
              <template #icon>
                <span style="font-size: 16px;">📥</span>
              </template>
              Inbox
            </BaseNavItem>
            <BaseNavItem :count="5">
              <template #icon>
                <span style="font-size: 16px;">📅</span>
              </template>
              Today
            </BaseNavItem>
            <BaseNavItem>
              <template #icon>
                <span style="font-size: 16px;">⏰</span>
              </template>
              Upcoming
            </BaseNavItem>
          </div>
        </div>
      </div>
    `,
  })
}