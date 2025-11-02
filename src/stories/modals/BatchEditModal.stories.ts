import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import BatchEditModal from '@/components/BatchEditModal.vue'

const meta = {
  component: BatchEditModal,
  title: '🎭 Overlays/🪟 Modals/BatchEditModal',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
    docs: {
      story: {
        height: '600px',
      },
    },
  },

  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Whether the modal is open',
    },
    taskIds: {
      control: 'object',
      description: 'Array of task IDs to edit',
    },
  },
} satisfies Meta<typeof BatchEditModal>

export default meta
type Story = StoryObj<typeof meta>

// Basic batch edit modal
export const Default: Story = {
  args: {
    isOpen: true,
    taskIds: ['1', '2', '3'],
  },
  render: (args) => ({
    components: { BatchEditModal },
    setup() {
      const isOpen = ref(args.isOpen)
      const taskIds = ref(args.taskIds)

      // Mock task data for display
      const selectedTasks = ref([
        { id: '1', title: 'Review project proposal', priority: 'high', status: 'planned' },
        { id: '2', title: 'Update documentation', priority: 'medium', status: 'planned' },
        { id: '3', title: 'Fix critical bug', priority: 'high', status: 'in_progress' },
      ])

      const handleClose = () => {
        isOpen.value = false
      }

      const handleApplied = () => {
        console.log('Batch edit applied to tasks:', taskIds.value)
        isOpen.value = false
      }

      return {
        isOpen,
        taskIds,
        selectedTasks,
        handleClose,
        handleApplied,
      }
    },
    template: `
      <div style="padding: 40px; min-height: 500px; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Batch Edit Modal</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Edit multiple tasks simultaneously</p>

        <div style="display: flex; gap: 16px; margin-bottom: 24px;">
          <button
            @click="isOpen = !isOpen"
            style="padding: 12px 24px; background: var(--brand-primary); color: white; border: none; border-radius: 8px; cursor: pointer;"
          >
            {{ isOpen ? 'Close Modal' : 'Open Modal' }}
          </button>
          <div style="padding: 8px 16px; background: var(--glass-bg-soft); border-radius: 8px; border: 1px solid var(--glass-border); color: var(--text-primary); font-size: 14px;">
            {{ taskIds.length }} tasks selected
          </div>
        </div>

        <!-- Selected tasks preview -->
        <div style="margin-bottom: 24px;">
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Selected Tasks:</h4>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div
              v-for="task in selectedTasks"
              :key="task.id"
              style="padding: 12px; background: var(--surface-primary); border: 1px solid var(--border-subtle); border-radius: 8px; display: flex; justify-content: space-between; align-items: center;"
            >
              <div style="font-size: 14px; color: var(--text-primary);">{{ task.title }}</div>
              <div style="display: flex; gap: 8px;">
                <span
                  :style="{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    background: task.priority === 'high' ? '#fef2f2' : task.priority === 'medium' ? '#fffbeb' : '#eff6ff',
                    color: task.priority === 'high' ? '#dc2626' : task.priority === 'medium' ? '#d97706' : '#2563eb',
                  }"
                >
                  {{ task.priority }}
                </span>
                <span
                  :style="{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    background: task.status === 'in_progress' ? '#dcfce7' : '#f3f4f6',
                    color: task.status === 'in_progress' ? '#166534' : '#374151',
                  }"
                >
                  {{ task.status }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <BatchEditModal
          :is-open="isOpen"
          :task-ids="taskIds"
          @close="handleClose"
          @applied="handleApplied"
        />
      </div>
    `,
  })
}

// With many tasks
export const ManyTasks: Story = {
  render: () => ({
    components: { BatchEditModal },
    setup() {
      const isOpen = ref(true)
      const taskIds = ref(Array.from({ length: 10 }, (_, i) => String(i + 1)))

      // Mock task data for display
      const selectedTasks = ref(Array.from({ length: 10 }, (_, i) => ({
        id: String(i + 1),
        title: `Task ${i + 1}: ${['Review code', 'Write tests', 'Update docs', 'Fix bug', 'Design feature'][i % 5]}`,
        priority: ['high', 'medium', 'low'][i % 3],
        status: ['planned', 'in_progress', 'done'][i % 3],
        project: `Project ${Math.floor(i / 3) + 1}`,
      })))

      const handleClose = () => {
        isOpen.value = false
      }

      const handleApplied = () => {
        console.log('Batch edit applied to tasks:', taskIds.value)
        isOpen.value = false
      }

      return {
        isOpen,
        taskIds,
        selectedTasks,
        handleClose,
        handleApplied,
      }
    },
    template: `
      <div style="padding: 40px; min-height: 500px; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Batch Edit - Many Tasks</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Editing 10 tasks simultaneously</p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
          <div style="padding: 16px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
            <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Batch Operations</h4>
            <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
              <li><strong>Priority Update</strong> - Change all to High/Medium/Low</li>
              <li><strong>Status Update</strong> - Mark all as Planned/In Progress/Done</li>
              <li><strong>Project Assignment</strong> - Move all to specific project</li>
              <li><strong>Due Date</strong> - Set same due date for all</li>
              <li><strong>Tags</strong> - Add or remove tags from all</li>
              <li><strong>Time Estimates</strong> - Update duration for all</li>
            </ul>
          </div>

          <div style="padding: 16px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
            <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Selection Summary</h4>
            <div style="font-size: 14px; color: var(--text-secondary); line-height: 1.6;">
              <div><strong>Total Tasks:</strong> {{ selectedTasks.length }}</div>
              <div><strong>High Priority:</strong> {{ selectedTasks.filter(t => t.priority === 'high').length }}</div>
              <div><strong>In Progress:</strong> {{ selectedTasks.filter(t => t.status === 'in_progress').length }}</div>
              <div><strong>Projects:</strong> 3 different projects</div>
              <div><strong>Estimated Time:</strong> ~{{ selectedTasks.length * 45 }}min total</div>
            </div>
          </div>
        </div>

        <BatchEditModal
          :is-open="isOpen"
          :task-ids="taskIds"
          @close="handleClose"
          @applied="handleApplied"
        />
      </div>
    `,
  })
}