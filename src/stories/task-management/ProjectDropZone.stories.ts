import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import ProjectDropZone from '@/components/ProjectDropZone.vue'

const meta = {
  component: ProjectDropZone,
  title: '📝 Task Management/ProjectDropZone',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
    docs: {
      story: {
        height: '500px',
      },
    },
  },

  argTypes: {
    projectId: {
      control: 'text',
      description: 'ID of the project to drop tasks into',
    },
    onDrop: {
      action: 'drop',
      description: 'Callback when tasks are dropped',
    },
  },
} satisfies Meta<typeof ProjectDropZone>

export default meta
type Story = StoryObj<typeof meta>

// Default drop zone
export const Default: Story = {
  args: {
    projectId: 'project-1',
  },
  render: (args) => ({
    components: { ProjectDropZone },
    setup() {
      const projectId = ref(args.projectId)
      const dropCount = ref(0)
      const lastDrop = ref('')

      const handleDrop = (event: any) => {
        dropCount.value++
        lastDrop.value = JSON.stringify(event, null, 2)
      }

      return {
        projectId,
        dropCount,
        lastDrop,
        handleDrop,
      }
    },
    template: `
      <div style="padding: 40px; min-height: 400px;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Project Drop Zone</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Drag and drop zone for task organization</p>

        <div style="width: 300px; margin: 0 auto 24px;">
          <ProjectDropZone
            :project-id="projectId"
            @drop="handleDrop"
          />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div style="padding: 16px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
            <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Drop Statistics</h4>
            <div style="font-size: 14px; color: var(--text-secondary); line-height: 1.6;">
              <div><strong>Total Drops:</strong> {{ dropCount }}</div>
              <div><strong>Project ID:</strong> {{ projectId }}</div>
              <div><strong>Last Action:</strong> {{ dropCount > 0 ? 'Tasks dropped' : 'None' }}</div>
            </div>
          </div>

          <div style="padding: 16px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
            <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Features</h4>
            <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
              <li><strong>Drag & Drop</strong> - Native HTML5 drag API</li>
              <li><strong>Visual Feedback</strong> - Hover and active states</li>
              <li><strong>Multi-task</strong> - Drop multiple tasks</li>
              <li><strong>Project Target</strong> - Specific project assignment</li>
              <li><strong>Validation</strong> - Prevent invalid drops</li>
            </ul>
          </div>
        </div>

        <div v-if="lastDrop" style="margin-top: 20px; padding: 12px; background: rgba(255, 255, 255, 0.03); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);">
          <h4 style="margin: 0 0 8px 0; font-size: 14px; color: var(--text-primary); font-weight: bold;">Last Drop Event:</h4>
          <pre style="margin: 0; font-size: 12px; color: var(--text-muted); white-space: pre-wrap;">{{ lastDrop }}</pre>
        </div>
      </div>
    `,
  })
}

// Interactive demo with draggable tasks
export const InteractiveDemo: Story = {
  render: () => ({
    setup() {
      const tasks = ref([
        { id: '1', title: 'Review pull request', priority: 'high' },
        { id: '2', title: 'Update documentation', priority: 'medium' },
        { id: '3', title: 'Fix navigation bug', priority: 'high' },
        { id: '4', title: 'Write unit tests', priority: 'low' },
      ])

      const dropZoneActive = ref('')
      const dropCount = ref(0)
      const droppedTasks = ref<Array<string>>([])

      const handleDragStart = (event: DragEvent, taskId: string) => {
        event.dataTransfer?.setData('text/plain', taskId)
        event.dataTransfer?.setData('application/json', JSON.stringify({
          taskIds: [taskId],
          source: 'task-list'
        }))
      }

      const handleDragOver = (event: DragEvent) => {
        event.preventDefault()
      }

      const handleDragEnter = (zoneId: string) => {
        dropZoneActive.value = zoneId
      }

      const handleDragLeave = () => {
        dropZoneActive.value = ''
      }

      const handleDrop = (event: any, zoneId: string) => {
        event.preventDefault()
        dropZoneActive.value = ''
        dropCount.value++

        try {
          const data = JSON.parse(event.dataTransfer?.getData('application/json') || '{}')
          droppedTasks.value.push(...(data.taskIds || []))
        } catch (e) {
          const taskId = event.dataTransfer?.getData('text/plain')
          if (taskId) droppedTasks.value.push(taskId)
        }
      }

      return {
        tasks,
        dropZoneActive,
        dropCount,
        droppedTasks,
        handleDragStart,
        handleDragOver,
        handleDragEnter,
        handleDragLeave,
        handleDrop,
      }
    },
    template: `
      <div style="padding: 40px; min-height: 600px;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Interactive Drop Zone Demo</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Drag tasks to different project drop zones</p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px;">
          <!-- Draggable Tasks -->
          <div>
            <h4 style="margin: 0 0 16px 0; font-size: 16px; color: var(--text-primary);">Tasks (Drag these)</h4>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div
                v-for="task in tasks"
                :key="task.id"
                draggable="true"
                @dragstart="(e) => handleDragStart(e, task.id)"
                style="padding: 12px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; cursor: move; display: flex; justify-content: space-between; align-items: center;"
              >
                <span style="font-size: 14px; color: var(--text-primary);">{{ task.title }}</span>
                <span
                  :style="{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    background: task.priority === 'high' ? 'rgba(239, 68, 68, 0.15)' : task.priority === 'medium' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                    color: task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f59e0b' : '#3b82f6',
                    border: task.priority === 'high' ? '1px solid rgba(239, 68, 68, 0.3)' : task.priority === 'medium' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)',
                  }"
                >
                  {{ task.priority }}
                </span>
              </div>
            </div>
          </div>

          <!-- Drop Zones -->
          <div>
            <h4 style="margin: 0 0 16px 0; font-size: 16px; color: var(--text-primary);">Project Drop Zones</h4>
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <div
                @dragover="handleDragOver"
                @dragenter="() => handleDragEnter('frontend')"
                @dragleave="handleDragLeave"
                @drop="(e) => handleDrop(e, 'frontend')"
                style="padding: 20px; border: 2px dashed rgba(255, 255, 255, 0.2); border-radius: 12px; text-align: center; transition: all 0.2s ease;"
                :style="{
                  borderColor: dropZoneActive === 'frontend' ? 'rgba(78, 205, 196, 0.5)' : 'rgba(255, 255, 255, 0.2)',
                  background: dropZoneActive === 'frontend' ? 'rgba(78, 205, 196, 0.1)' : 'transparent',
                }"
              >
                <div style="font-size: 16px; font-weight: bold; color: var(--text-primary); margin-bottom: 4px;">🎨 Frontend Project</div>
                <div style="font-size: 14px; color: var(--text-secondary);">Drop tasks here</div>
              </div>

              <div
                @dragover="handleDragOver"
                @dragenter="() => handleDragEnter('backend')"
                @dragleave="handleDragLeave"
                @drop="(e) => handleDrop(e, 'backend')"
                style="padding: 20px; border: 2px dashed rgba(255, 255, 255, 0.2); border-radius: 12px; text-align: center; transition: all 0.2s ease;"
                :style="{
                  borderColor: dropZoneActive === 'backend' ? 'rgba(78, 205, 196, 0.5)' : 'rgba(255, 255, 255, 0.2)',
                  background: dropZoneActive === 'backend' ? 'rgba(78, 205, 196, 0.1)' : 'transparent',
                }"
              >
                <div style="font-size: 16px; font-weight: bold; color: var(--text-primary); margin-bottom: 4px;">⚙️ Backend Project</div>
                <div style="font-size: 14px; color: var(--text-secondary);">Drop tasks here</div>
              </div>

              <div
                @dragover="handleDragOver"
                @dragenter="() => handleDragEnter('design')"
                @dragleave="handleDragLeave"
                @drop="(e) => handleDrop(e, 'design')"
                style="padding: 20px; border: 2px dashed rgba(255, 255, 255, 0.2); border-radius: 12px; text-align: center; transition: all 0.2s ease;"
                :style="{
                  borderColor: dropZoneActive === 'design' ? 'rgba(78, 205, 196, 0.5)' : 'rgba(255, 255, 255, 0.2)',
                  background: dropZoneActive === 'design' ? 'rgba(78, 205, 196, 0.1)' : 'transparent',
                }"
              >
                <div style="font-size: 16px; font-weight: bold; color: var(--text-primary); margin-bottom: 4px;">🎯 Design Project</div>
                <div style="font-size: 14px; color: var(--text-secondary);">Drop tasks here</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Statistics -->
        <div style="margin-top: 32px; padding: 20px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Drop Statistics</h4>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: rgba(78, 205, 196, 1);">{{ dropCount }}</div>
              <div style="font-size: 14px; color: var(--text-secondary);">Total Drops</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: rgba(78, 205, 196, 1);">{{ tasks.length - droppedTasks.length }}</div>
              <div style="font-size: 14px; color: var(--text-secondary);">Remaining Tasks</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: rgba(78, 205, 196, 1);">{{ droppedTasks.length }}</div>
              <div style="font-size: 14px; color: var(--text-secondary);">Dropped Tasks</div>
            </div>
          </div>

          <div v-if="droppedTasks.length > 0" style="margin-top: 16px; padding: 12px; background: rgba(255, 255, 255, 0.03); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);">
            <div style="font-size: 14px; color: var(--text-primary); font-weight: bold; margin-bottom: 8px;">Dropped Task IDs:</div>
            <div style="font-size: 13px; color: var(--text-muted); font-family: monospace;">{{ droppedTasks.join(', ') }}</div>
          </div>
        </div>
      </div>
    `,
  })
}
