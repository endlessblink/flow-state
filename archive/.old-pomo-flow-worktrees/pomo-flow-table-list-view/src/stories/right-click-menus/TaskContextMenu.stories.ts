import type { Meta, StoryObj } from '@storybook/vue3'
import TaskContextMenu from '@/components/TaskContextMenu.vue'
import type { Task } from '@/stores/tasks'

const meta = {
  component: TaskContextMenu,
  title: '🎭 Overlays/💬 Context Menus/TaskContextMenu',
  tags: ['autodocs'],

  args: {
    isVisible: true,
    x: 50,
    y: 80,
    compactMode: false,
  },

  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof TaskContextMenu>

export default meta
type Story = StoryObj<typeof meta>

// Real production task example - exactly matches Task interface
const realTask: Task = {
  id: '1',
  title: 'Complete project documentation',
  description: 'Write comprehensive API documentation for all endpoints',
  status: 'in_progress',
  priority: 'high',
  progress: 25,
  completedPomodoros: 2,
  subtasks: [],
  dueDate: '2024-12-25',
  estimatedDuration: 120,
  projectId: '1',
  parentTaskId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  isInInbox: false,
  canvasPosition: { x: 100, y: 200 },
  instances: [{
    id: 'instance-1',
    scheduledDate: '2024-12-25',
    scheduledTime: '09:00',
    duration: 60
  }]
}

// Default - exactly as rendered in app
export const Default: Story = {
  args: {
    isVisible: true,
    x: 50,
    y: 80,
    task: realTask,
    compactMode: false,
    onClose: () => console.log('close'),
    onEdit: (taskId: any) => console.log('edit', taskId),
    onConfirmDelete: (taskId: any, _instanceId?: any, _isCalendarEvent?: any) => console.log('delete', taskId),
  },
}

// With different status - done
export const StatusDone: Story = {
  args: {
    ...Default.args,
    task: {
      ...realTask,
      status: 'done',
    },
  },
}

// With different status - planned
export const StatusPlanned: Story = {
  args: {
    ...Default.args,
    task: {
      ...realTask,
      status: 'planned',
    },
  },
}

// With low priority
export const PriorityLow: Story = {
  args: {
    ...Default.args,
    task: {
      ...realTask,
      priority: 'low',
    },
  },
}

// With medium priority
export const PriorityMedium: Story = {
  args: {
    ...Default.args,
    task: {
      ...realTask,
      priority: 'medium',
    },
  },
}

// Compact mode (for ultrathin density)
export const CompactMode: Story = {
  args: {
    ...Default.args,
    compactMode: true,
  },
}

// === Inbox Scenarios ===

// Inbox single task with contextTask
export const InboxSingleTask: Story = {
  args: {
    ...Default.args,
    task: null, // No primary task when using contextTask
    contextTask: realTask,
    onClose: () => console.log('close'),
    onEdit: (taskId: any) => console.log('edit', taskId),
    onConfirmDelete: (taskId: any, _instanceId?: any, _isCalendarEvent?: any) => console.log('delete', taskId),
    onSetPriority: (priority: any) => console.log('setPriority', priority),
    onSetStatus: (status: any) => console.log('setStatus', status),
    onSetDueDate: (dateType: any) => console.log('setDueDate', dateType),
    onEnterFocusMode: () => console.log('enterFocusMode'),
    onDeleteSelected: () => console.log('deleteSelected'),
    onClearSelection: () => console.log('clearSelection'),
  },
}

// Inbox batch selection (multiple tasks selected)
export const InboxBatchSelection: Story = {
  args: {
    isVisible: true,
    x: 100,
    y: 100,
    task: null, // No primary task in batch mode
    selectedCount: 5, // Multiple tasks selected
    onClose: () => console.log('close'),
    onSetPriority: (priority: any) => console.log('setPriority', priority),
    onSetStatus: (status: any) => console.log('setStatus', status),
    onSetDueDate: (dateType: any) => console.log('setDueDate', dateType),
    onEnterFocusMode: () => console.log('enterFocusMode'),
    onDeleteSelected: () => console.log('deleteSelected'),
    onClearSelection: () => console.log('clearSelection'),
  },
}

// Inbox single selected task (shows header but not batch)
export const InboxSingleSelected: Story = {
  args: {
    isVisible: true,
    x: 100,
    y: 100,
    task: null,
    selectedCount: 1,
    contextTask: realTask,
    onClose: () => console.log('close'),
    onEdit: (taskId: any) => console.log('edit', taskId),
    onConfirmDelete: (taskId: any, _instanceId?: any, _isCalendarEvent?: any) => console.log('delete', taskId),
    onSetPriority: (priority: any) => console.log('setPriority', priority),
    onSetStatus: (status: any) => console.log('setStatus', status),
    onSetDueDate: (dateType: any) => console.log('setDueDate', dateType),
    onEnterFocusMode: () => console.log('enterFocusMode'),
    onDeleteSelected: () => console.log('deleteSelected'),
    onClearSelection: () => console.log('clearSelection'),
  },
}

// Large batch selection (10 tasks)
export const InboxLargeBatch: Story = {
  args: {
    ...InboxBatchSelection.args,
    selectedCount: 10,
    x: 150,
    y: 150,
  },
}
