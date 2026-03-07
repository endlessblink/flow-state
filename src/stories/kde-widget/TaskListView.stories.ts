import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, h } from 'vue'

const bgColor = '#232034'
const textColor = '#E2E8F0'
const mutedColor = '#7E7590'
const workColor = '#4ECDC4'
const breakColor = '#F59E0B'

const defaultTasks = [
  { id: '1', title: 'Design the landing page', status: 'in_progress', priority: 'high', isHeader: false },
  { id: '2', title: 'Fix authentication bug', status: 'todo', priority: 'medium', isHeader: false },
  { id: '3', title: 'Write unit tests', status: 'planned', priority: 'low', isHeader: false },
  { id: '4', title: 'לארגן משימות / טאבים', status: 'todo', priority: 'medium', isHeader: false },
]

const projectSortedTasks = [
  { isHeader: true, projectName: 'Work', projectColor: '#FF6B6B' },
  { id: '1', title: 'Design the landing page', isHeader: false },
  { id: '2', title: 'Fix authentication bug', isHeader: false },
  { isHeader: true, projectName: 'Personal', projectColor: '#A78BFA' },
  { id: '3', title: 'Write unit tests', isHeader: false },
  { id: '4', title: 'לארגן משימות / טאבים', isHeader: false },
]

const TaskListView = defineComponent({
  name: 'TaskListView',
  props: {
    tasks: { type: Array, default: () => defaultTasks },
    activeTaskId: { type: String, default: '' },
    sortMode: { type: String, default: 'newest' },
    showEmpty: { type: Boolean, default: false },
  },
  render() {
    const p = this.$props as any
    const tasks = p.tasks as any[]

    // Pulse keyframe injected once via a style tag in the container
    const pulseStyle = `
      @keyframes kdeTaskPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
        50%       { box-shadow: 0 0 8px 4px rgba(245, 158, 11, 0.15); }
      }
    `

    const renderHeader = (item: any) =>
      h('div', {
        key: `header-${item.projectName}`,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          paddingLeft: '8px',
          height: '28px',
          flexShrink: '0',
        },
      }, [
        h('div', {
          style: {
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: item.projectColor || mutedColor,
            flexShrink: '0',
          },
        }),
        h('span', {
          style: { fontSize: '11px', fontWeight: 'bold', color: textColor, flexShrink: '0', whiteSpace: 'nowrap' },
        }, item.projectName),
        h('div', {
          style: { flex: '1', height: '1px', background: 'rgba(255,255,255,0.08)', marginLeft: '4px' },
        }),
      ])

    const renderTaskRow = (item: any) => {
      const isActive = p.activeTaskId && p.activeTaskId === item.id
      return h('div', {
        key: item.id,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '0 10px',
          minHeight: '44px',
          maxHeight: '64px',
          borderRadius: '6px',
          background: isActive ? 'rgba(245, 158, 11, 0.15)' : 'rgba(46, 41, 69, 0.3)',
          border: isActive ? `2px solid ${breakColor}` : '2px solid transparent',
          flexShrink: '0',
          boxSizing: 'border-box',
          animation: isActive ? 'kdeTaskPulse 2s ease-in-out infinite' : 'none',
        },
      }, [
        // Done toggle
        h('div', {
          style: {
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            border: `1.5px solid ${mutedColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            color: mutedColor,
            flexShrink: '0',
            cursor: 'pointer',
          },
        }, '✓'),

        // Play button
        h('div', {
          style: {
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            border: `1.5px solid ${workColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            color: workColor,
            flexShrink: '0',
            cursor: 'pointer',
          },
        }, '▶'),

        // Pin button
        h('div', {
          style: {
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            border: `1.5px solid ${mutedColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            flexShrink: '0',
            cursor: 'pointer',
          },
        }, '📌'),

        // Title
        h('div', {
          style: {
            flex: '1',
            fontSize: '13px',
            color: textColor,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: '2',
            WebkitBoxOrient: 'vertical',
            textOverflow: 'ellipsis',
            lineHeight: '1.4',
            wordBreak: 'break-word',
          },
        }, item.title),
      ])
    }

    const renderEmpty = () =>
      h('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '80px',
          fontSize: '12px',
          color: mutedColor,
        },
      }, 'No tasks found')

    const rows = p.showEmpty || tasks.length === 0
      ? [renderEmpty()]
      : tasks.map((item: any) => item.isHeader ? renderHeader(item) : renderTaskRow(item))

    return h('div', {
      style: {
        width: '440px',
        maxHeight: '400px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '4px',
        boxSizing: 'border-box',
        fontFamily: 'Noto Sans, Noto Sans Hebrew, sans-serif',
      },
    }, [
      h('style', {}, pulseStyle),
      ...rows,
    ])
  },
})

const meta: Meta<typeof TaskListView> = {
  title: 'KDE Widget/TaskListView',
  component: TaskListView,
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
    activeTaskId: { control: 'text' },
    sortMode: { control: 'select', options: ['newest', 'priority', 'project', 'alphabetical'] },
    showEmpty: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof TaskListView>

export const Default: Story = {
  args: {
    tasks: defaultTasks,
    activeTaskId: '',
    sortMode: 'newest',
    showEmpty: false,
  },
}

export const WithActiveTask: Story = {
  args: {
    tasks: defaultTasks,
    activeTaskId: '1',
    sortMode: 'newest',
    showEmpty: false,
  },
}

export const ProjectGrouped: Story = {
  args: {
    tasks: projectSortedTasks,
    activeTaskId: '',
    sortMode: 'project',
    showEmpty: false,
  },
}

export const EmptyState: Story = {
  args: {
    tasks: [],
    activeTaskId: '',
    sortMode: 'newest',
    showEmpty: true,
  },
}

export const SingleTask: Story = {
  args: {
    tasks: [defaultTasks[0]],
    activeTaskId: '',
    sortMode: 'newest',
    showEmpty: false,
  },
}
