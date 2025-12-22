import type { Meta, StoryObj } from '@storybook/vue3'
import { Inbox, Calendar, Hash, Folder, Star, Clock } from 'lucide-vue-next'
import BaseNavItem from './BaseNavItem.vue'

const meta = {
    title: 'Base/BaseNavItem',
    component: BaseNavItem,
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component: 'Navigation item used in sidebars and lists, supporting icons, badges, and nested hierarchy.'
            }
        }
    },
    argTypes: {
        active: {
            control: 'boolean',
            description: 'Whether the item is currently active'
        },
        nested: {
            control: 'boolean',
            description: 'Whether the item is nested under another item'
        },
        hasChildren: {
            control: 'boolean',
            description: 'Whether the item has child items'
        },
        expanded: {
            control: 'boolean',
            description: 'Whether child items are expanded'
        },
        count: {
            control: 'number',
            description: 'Optional count badge'
        },
        colorDot: {
            control: 'color',
            description: 'Optional project color dot'
        }
    },
    args: {
        active: false,
        nested: false,
        hasChildren: false,
        expanded: false
    }
} satisfies Meta<typeof BaseNavItem>

export default meta
type Story = StoryObj<typeof meta>

export const AppNavigation: Story = {
    render: (args) => ({
        components: { BaseNavItem, Inbox, Calendar, Clock },
        setup() {
            return { args }
        },
        template: `
      <div style="width: 240px; display: flex; flex-direction: column; gap: 4px;">
        <BaseNavItem active>
          <template #icon><Inbox :size="18" /></template>
          Inbox
          <template #count>5</template>
        </BaseNavItem>
        <BaseNavItem>
          <template #icon><Calendar :size="18" /></template>
          Upcoming
        </BaseNavItem>
        <BaseNavItem>
          <template #icon><Clock :size="18" /></template>
          Activity
        </BaseNavItem>
      </div>
    `
    })
}

export const Projects: Story = {
    render: (args) => ({
        components: { BaseNavItem, Hash, Folder },
        setup() {
            return { args }
        },
        template: `
      <div style="width: 240px; display: flex; flex-direction: column; gap: 4px;">
        <BaseNavItem hasChildren expanded>
          <template #icon><Hash :size="18" /></template>
          Personal
        </BaseNavItem>
        <BaseNavItem nested colorDot="#10b981">
          Work Project
          <template #count>12</template>
        </BaseNavItem>
        <BaseNavItem nested colorDot="#f59e0b">
          Side Hustle
        </BaseNavItem>
      </div>
    `
    })
}

export const ActiveState: Story = {
    args: {
        active: true
    },
    render: (args) => ({
        components: { BaseNavItem, Star },
        setup() {
            return { args }
        },
        template: `
      <div style="width: 240px;">
        <BaseNavItem v-bind="args">
          <template #icon><Star :size="18" /></template>
          Favorites
        </BaseNavItem>
      </div>
    `
    })
}
