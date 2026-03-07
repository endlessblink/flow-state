import type { Meta, StoryObj } from '@storybook/vue3'
import { ref, defineComponent, h } from 'vue'

const bgColor = '#232034'
const textColor = '#E2E8F0'
const tealColor = '#4ECDC4'

interface PinnedTask {
  id: string
  title: string
}

const defaultMockTasks: PinnedTask[] = [
  { id: '1', title: 'Design landing page' },
  { id: '2', title: 'Fix authentication bug' },
  { id: '3', title: 'Write unit tests for API' },
]

const PinnedTaskChips = defineComponent({
  name: 'PinnedTaskChips',
  props: {
    tasks: { type: Array as () => PinnedTask[], default: () => defaultMockTasks },
  },
  setup() {
    const hoveredId = ref<string | null>(null)
    return { hoveredId }
  },
  render() {
    const p = this.$props as any
    const tasks = p.tasks as PinnedTask[]

    return h('div', {
      style: {
        width: '440px',
        display: 'flex',
        flexWrap: 'wrap' as const,
        gap: '6px',
        fontFamily: 'Noto Sans, sans-serif',
        alignItems: 'flex-start',
      },
    }, tasks.map((task: PinnedTask) =>
      h('div', {
        key: task.id,
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          height: '26px',
          borderRadius: '13px',
          background: 'transparent',
          border: `1px solid ${tealColor}`,
          padding: '0 8px',
          position: 'relative' as const,
          cursor: 'pointer',
          flexShrink: '0',
          gap: '4px',
        },
        onMouseenter: () => { this.hoveredId = task.id },
        onMouseleave: () => { this.hoveredId = null },
      }, [
        // Pin icon
        h('span', {
          style: {
            fontSize: '10px',
            lineHeight: '1',
          },
        }, '📌'),

        // Task title (max 100px, truncated)
        h('span', {
          style: {
            fontSize: '11px',
            color: textColor,
            maxWidth: '100px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap' as const,
          },
        }, task.title),

        // Unpin X button — shown on hover
        this.hoveredId === task.id ? h('div', {
          style: {
            position: 'absolute' as const,
            top: '-4px',
            right: '-4px',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: 'rgba(77, 77, 77, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            color: 'white',
            cursor: 'pointer',
            lineHeight: '1',
            flexShrink: '0',
            transition: 'background 0.15s',
          },
          onMouseenter: (e: MouseEvent) => {
            const el = e.currentTarget as HTMLElement
            el.style.background = '#EF4444'
          },
          onMouseleave: (e: MouseEvent) => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'rgba(77, 77, 77, 0.9)'
          },
          onClick: (e: Event) => {
            e.stopPropagation()
          },
        }, '×') : null,
      ])
    ))
  },
})

const meta: Meta<typeof PinnedTaskChips> = {
  title: 'KDE Widget/PinnedTaskChips',
  component: PinnedTaskChips,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: bgColor },
        { name: 'desktop', value: '#1a1a2e' },
      ],
    },
  },
  argTypes: {
    tasks: { control: 'object' },
  },
}

export default meta
type Story = StoryObj<typeof PinnedTaskChips>

export const Default: Story = {
  args: {
    tasks: defaultMockTasks,
  },
}

export const SingleTask: Story = {
  args: {
    tasks: [{ id: '1', title: 'Design landing page' }],
  },
}

export const ManyTasks: Story = {
  args: {
    tasks: [
      { id: '1', title: 'Design landing page' },
      { id: '2', title: 'Fix auth bug' },
      { id: '3', title: 'Write unit tests' },
      { id: '4', title: 'Review pull requests' },
      { id: '5', title: 'Update dependencies' },
      { id: '6', title: 'Deploy to staging' },
    ],
  },
}

export const LongTitles: Story = {
  args: {
    tasks: [
      { id: '1', title: 'Redesign the entire landing page flow with new brand assets' },
      { id: '2', title: 'Fix the authentication bug affecting all enterprise accounts' },
      { id: '3', title: 'Write comprehensive unit tests for the new payment API integration' },
    ],
  },
}
