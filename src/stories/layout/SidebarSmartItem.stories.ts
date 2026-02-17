import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import SidebarSmartItem from '@/components/layout/SidebarSmartItem.vue'
import { Calendar, Inbox, List, Clock, Zap } from 'lucide-vue-next'

const meta = {
  component: SidebarSmartItem,
  title: '🏢 Layout/SidebarSmartItem',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0f172a' }, // Approximates the gradient for docs view
      ],
    },
    docs: {
      description: {
        component: 'A unified smart filter item for the sidebar, supporting glassmorphism, drag-and-drop targets, and various color themes.'
      }
    }
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="padding: 6.25rem; background: var(--app-background-gradient); min-height: 300px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-xl);">
          <story />
        </div>
      `
    })
  ],
  argTypes: {
    active: { control: 'boolean' },
    count: { control: 'number' },
    compact: { control: 'boolean' },
    color: {
      control: 'select',
      options: ['green', 'purple', 'gray', 'orange', 'blue', 'azure', 'azure-dark']
    },
    dropType: {
      control: 'select',
      options: ['date', 'duration', 'status']
    },
    dropValue: { control: 'text' }
  }
} satisfies Meta<typeof SidebarSmartItem>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    active: false,
    count: 5,
    color: 'azure',
    compact: false
  },
  render: (args: any) => ({
    components: { SidebarSmartItem, Calendar },
    setup() { return { args } },
    template: `
      <div style="width: 300px; padding: var(--space-5);">
        <SidebarSmartItem v-bind="args">
          <template #icon><Calendar :size="16" /></template>
          Today
        </SidebarSmartItem>
      </div>
    `
  })
}

export const Active: Story = {
  args: {
    ...Default.args,
    active: true
  },
  render: (args: any) => ({
    components: { SidebarSmartItem, Calendar },
    setup() { return { args } },
    template: `
      <div style="width: 300px; padding: var(--space-5);">
        <SidebarSmartItem v-bind="args">
          <template #icon><Calendar :size="16" /></template>
          Today
        </SidebarSmartItem>
      </div>
    `
  })
}

export const Compact: Story = {
  args: {
    ...Default.args,
    compact: true
  },
  render: (args: any) => ({
    components: { SidebarSmartItem, Calendar },
    setup() { return { args } },
    template: `
      <div style="width: 300px; padding: var(--space-5);">
        <SidebarSmartItem v-bind="args">
          <template #icon><Calendar :size="14" /></template>
          Today
        </SidebarSmartItem>
      </div>
    `
  })
}

export const AllColors: Story = {
  render: () => ({
    components: { SidebarSmartItem, Calendar, Inbox, List, Clock, Zap },
    template: `
      <div style="display: grid; grid-template-columns: repeat(2, 240px); gap: var(--space-4); padding: var(--space-5);">
        <SidebarSmartItem color="azure" :active="true" :count="3">
          <template #icon><Calendar :size="14" /></template>
          Today
        </SidebarSmartItem>
        <SidebarSmartItem color="azure-dark" :active="false" :count="8">
          <template #icon><Calendar :size="14" /></template>
          This Week
        </SidebarSmartItem>
        <SidebarSmartItem color="blue" :active="false" :count="12">
          <template #icon><List :size="14" /></template>
          All Active
        </SidebarSmartItem>
        <SidebarSmartItem color="orange" :active="false" :count="5">
          <template #icon><Inbox :size="14" /></template>
          Inbox
        </SidebarSmartItem>
        <SidebarSmartItem color="purple" :active="true" :count="2">
          <template #icon><Clock :size="14" /></template>
          Medium (15-30m)
        </SidebarSmartItem>
        <SidebarSmartItem color="green" :active="false" :count="1">
          <template #icon><Zap :size="14" /></template>
          Quick (<5m)
        </SidebarSmartItem>
        <SidebarSmartItem color="gray" :active="false" :count="0">
          <template #icon><Clock :size="14" /></template>
          No Estimate
        </SidebarSmartItem>
      </div>
    `
  })
}

export const InteractiveDragging: Story = {
  render: () => ({
    components: { SidebarSmartItem, List },
    setup() {
      const isDragging = ref(false)
      return { isDragging }
    },
    template: `
      <div style="width: 340px; padding: var(--space-10); background: var(--app-background-gradient);">
        <div
          draggable="true"
          @dragstart="isDragging = true"
          @dragend="isDragging = false"
          style="padding: var(--space-2-5); background: var(--glass-bg-medium); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); margin-bottom: var(--space-5); cursor: move; text-align: center; color: var(--text-primary);"
        >
          DRAG ME
        </div>
        
        <SidebarSmartItem 
          color="blue" 
          drop-type="status" 
          drop-value="active"
          :count="10"
        >
          <template #icon><List :size="16" /></template>
          Drop Target
        </SidebarSmartItem>
        
        <p style="margin-top: var(--space-4); font-size: var(--text-xs); color: var(--text-muted); line-height: 1.4;">
          Drag the box over the item to see the glassmorphism "glow" and "pulse" effects that indicate a valid drop target.
        </p>
      </div>
    `
  })
}
