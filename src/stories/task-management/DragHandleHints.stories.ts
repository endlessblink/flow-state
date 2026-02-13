import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import DragHandleHints from '@/components/tasks/drag-handle/DragHandleHints.vue'

const meta = {
  title: '📝 Task Management/DragHandleHints',
  component: DragHandleHints,
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    showDragHints: { control: 'boolean' },
    isHovered: { control: 'boolean' },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg']
    }
  }
} satisfies Meta<typeof DragHandleHints>

export default meta
type Story = StoryObj<typeof meta>

export const Visible: Story = {
  args: {
    showDragHints: true,
    isHovered: true,
    size: 'md'
  },
  render: (args) => ({
    components: { DragHandleHints },
    setup() {
      return { args }
    },
    template: `
      <div style="
        padding: var(--space-20);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        min-height: 300px;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        position: relative;
      ">
        <div style="
          width: var(--space-12);
          height: var(--space-12);
          background: var(--glass-bg-medium);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-md);
          position: relative;
        ">
          <DragHandleHints v-bind="args" />
        </div>
      </div>
    `
  })
}

export const Hidden: Story = {
  args: {
    showDragHints: true,
    isHovered: false,
    size: 'md'
  },
  render: (args) => ({
    components: { DragHandleHints },
    setup() {
      return { args }
    },
    template: `
      <div style="
        padding: var(--space-20);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        min-height: 300px;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        position: relative;
      ">
        <div style="
          width: var(--space-12);
          height: var(--space-12);
          background: var(--glass-bg-medium);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-md);
          position: relative;
        ">
          <DragHandleHints v-bind="args" />
        </div>
        <div style="
          margin-top: var(--space-20);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
          text-align: center;
        ">
          Hints are hidden when not hovered
        </div>
      </div>
    `
  })
}

export const Interactive: Story = {
  args: {
    showDragHints: true,
    isHovered: false,
    size: 'md'
  },
  render: (args) => ({
    components: { DragHandleHints },
    setup() {
      const isHovered = ref(args.isHovered)

      return { args, isHovered }
    },
    template: `
      <div style="
        padding: var(--space-20);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        min-height: 300px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        gap: var(--space-8);
        position: relative;
      ">
        <div
          @mouseenter="isHovered = true"
          @mouseleave="isHovered = false"
          style="
            width: var(--space-12);
            height: var(--space-12);
            background: var(--glass-bg-medium);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            position: relative;
            cursor: pointer;
            transition: all var(--duration-fast);
          "
          :style="{
            transform: isHovered ? 'scale(1.05)' : 'scale(1)',
            borderColor: isHovered ? 'var(--brand-primary)' : 'var(--glass-border)'
          }"
        >
          <DragHandleHints
            :show-drag-hints="args.showDragHints"
            :is-hovered="isHovered"
            :size="args.size"
          />
        </div>
        <div style="
          font-size: var(--text-sm);
          color: var(--text-tertiary);
          text-align: center;
        ">
          Hover over the box to see hints
        </div>
      </div>
    `
  })
}

export const AllSizes: Story = {
  render: () => ({
    components: { DragHandleHints },
    setup() {
      const sizes = ['sm', 'md', 'lg']
      const hoveredStates = ref([false, false, false])

      return { sizes, hoveredStates }
    },
    template: `
      <div style="
        padding: var(--space-20);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        min-height: 400px;
        display: flex;
        gap: var(--space-12);
        align-items: flex-start;
        justify-content: center;
      ">
        <div
          v-for="(size, index) in sizes"
          :key="size"
          style="display: flex; flex-direction: column; gap: var(--space-2); align-items: center;"
        >
          <div
            @mouseenter="hoveredStates[index] = true"
            @mouseleave="hoveredStates[index] = false"
            :style="{
              width: size === 'sm' ? 'var(--space-8)' : size === 'lg' ? 'var(--space-16)' : 'var(--space-12)',
              height: size === 'sm' ? 'var(--space-8)' : size === 'lg' ? 'var(--space-16)' : 'var(--space-12)',
              background: 'var(--glass-bg-medium)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-md)',
              position: 'relative',
              cursor: 'pointer',
              transition: 'all var(--duration-fast)',
              transform: hoveredStates[index] ? 'scale(1.05)' : 'scale(1)'
            }"
          >
            <DragHandleHints
              :show-drag-hints="true"
              :is-hovered="hoveredStates[index]"
              :size="size"
            />
          </div>
          <span style="font-size: var(--text-xs); color: var(--text-tertiary);">
            {{ size.toUpperCase() }}
          </span>
        </div>
      </div>
    `
  })
}

export const WithCustomPosition: Story = {
  args: {
    showDragHints: true,
    isHovered: true,
    size: 'md'
  },
  render: (args) => ({
    components: { DragHandleHints },
    setup() {
      return { args }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        min-height: 400px;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--space-8);
        align-items: start;
        justify-items: center;
      ">
        <div style="position: relative;">
          <div style="
            width: var(--space-12);
            height: var(--space-12);
            background: var(--glass-bg-medium);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            position: relative;
          ">
            <DragHandleHints v-bind="args" />
          </div>
          <div style="
            margin-top: var(--space-16);
            font-size: var(--text-xs);
            color: var(--text-tertiary);
            text-align: center;
          ">
            Top Left
          </div>
        </div>

        <div style="position: relative;">
          <div style="
            width: var(--space-12);
            height: var(--space-12);
            background: var(--glass-bg-medium);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            position: relative;
          ">
            <DragHandleHints v-bind="args" />
          </div>
          <div style="
            margin-top: var(--space-16);
            font-size: var(--text-xs);
            color: var(--text-tertiary);
            text-align: center;
          ">
            Top Center
          </div>
        </div>

        <div style="position: relative;">
          <div style="
            width: var(--space-12);
            height: var(--space-12);
            background: var(--glass-bg-medium);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            position: relative;
          ">
            <DragHandleHints v-bind="args" />
          </div>
          <div style="
            margin-top: var(--space-16);
            font-size: var(--text-xs);
            color: var(--text-tertiary);
            text-align: center;
          ">
            Top Right
          </div>
        </div>
      </div>
    `
  })
}
