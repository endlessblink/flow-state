import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import ProjectDropZone from '@/components/projects/ProjectDropZone.vue'

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

      const handleDrop = (event: Record<string, unknown>) => {
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
      <div style="padding: var(--space-10); min-height: 400px; background: var(--app-background-gradient);">
        <h3 style="margin: 0 0 var(--space-4) 0; font-size: var(--text-lg); color: var(--text-primary);">Project Drop Zone</h3>
        <p style="margin: 0 0 var(--space-6) 0; color: var(--text-secondary);">Drag and drop zone for task organization</p>

        <div style="width: 300px; margin: 0 auto var(--space-6);">
          <ProjectDropZone
            :project-id="projectId"
            @drop="handleDrop"
          />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-5);">
          <div style="padding: var(--space-4); background: var(--glass-bg-subtle); border-radius: var(--radius-xl); border: 1px solid var(--glass-border);">
            <h4 style="margin: 0 0 var(--space-3) 0; font-size: var(--text-base); color: var(--text-primary);">Drop Statistics</h4>
            <div style="font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.6;">
              <div><strong>Total Drops:</strong> {{ dropCount }}</div>
              <div><strong>Project ID:</strong> {{ projectId }}</div>
              <div><strong>Last Action:</strong> {{ dropCount > 0 ? 'Tasks dropped' : 'None' }}</div>
            </div>
          </div>

          <div style="padding: var(--space-4); background: var(--glass-bg-subtle); border-radius: var(--radius-xl); border: 1px solid var(--glass-border);">
            <h4 style="margin: 0 0 var(--space-3) 0; font-size: var(--text-base); color: var(--text-primary);">Features</h4>
            <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.6;">
              <li><strong>Drag & Drop</strong> - Native HTML5 drag API</li>
              <li><strong>Visual Feedback</strong> - Hover and active states</li>
              <li><strong>Multi-task</strong> - Drop multiple tasks</li>
              <li><strong>Project Target</strong> - Specific project assignment</li>
              <li><strong>Validation</strong> - Prevent invalid drops</li>
            </ul>
          </div>
        </div>

        <div v-if="lastDrop" style="margin-top: var(--space-5); padding: var(--space-3); background: var(--glass-bg-subtle); border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 var(--space-2) 0; font-size: var(--text-sm); color: var(--text-primary); font-weight: bold;">Last Drop Event:</h4>
          <pre style="margin: 0; font-size: var(--text-xs); color: var(--text-muted); white-space: pre-wrap;">{{ lastDrop }}</pre>
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

      const handleDrop = (event: unknown, zoneId: string) => {
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
      <div style="padding: var(--space-10); min-height: 600px; background: var(--app-background-gradient);">
        <h3 style="margin: 0 0 var(--space-4) 0; font-size: var(--text-lg); color: var(--text-primary);">Interactive Drop Zone Demo</h3>
        <p style="margin: 0 0 var(--space-6) 0; color: var(--text-secondary);">Drag tasks to different project drop zones</p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-8);">
          <!-- Draggable Tasks -->
          <div>
            <h4 style="margin: 0 0 var(--space-4) 0; font-size: var(--text-base); color: var(--text-primary);">Tasks (Drag these)</h4>
            <div style="display: flex; flex-direction: column; gap: var(--space-3);">
              <div
                v-for="task in tasks"
                :key="task.id"
                draggable="true"
                @dragstart="(e) => handleDragStart(e, task.id)"
                style="padding: var(--space-3); background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); cursor: move; display: flex; justify-content: space-between; align-items: center;"
              >
                <span style="font-size: var(--text-sm); color: var(--text-primary);">{{ task.title }}</span>
                <span
                  :style="{
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'bold',
                    background: task.priority === 'high' ? 'var(--priority-high-bg)' : task.priority === 'medium' ? 'var(--priority-medium-bg)' : 'var(--priority-low-bg)',
                    color: task.priority === 'high' ? 'var(--color-priority-high)' : task.priority === 'medium' ? 'var(--color-priority-medium)' : 'var(--color-priority-low)',
                    border: task.priority === 'high' ? '1px solid var(--priority-high-border)' : task.priority === 'medium' ? '1px solid var(--priority-medium-border)' : '1px solid var(--priority-low-border)',
                  }"
                >
                  {{ task.priority }}
                </span>
              </div>
            </div>
          </div>

          <!-- Drop Zones -->
          <div>
            <h4 style="margin: 0 0 var(--space-4) 0; font-size: var(--text-base); color: var(--text-primary);">Project Drop Zones</h4>
            <div style="display: flex; flex-direction: column; gap: var(--space-4);">
              <div
                @dragover="handleDragOver"
                @dragenter="() => handleDragEnter('frontend')"
                @dragleave="handleDragLeave"
                @drop="(e) => handleDrop(e, 'frontend')"
                style="padding: var(--space-5); border: 2px dashed var(--glass-border); border-radius: var(--radius-xl); text-align: center; transition: all 0.2s ease;"
                :style="{
                  borderColor: dropZoneActive === 'frontend' ? 'var(--state-active-border)' : 'var(--glass-border)',
                  background: dropZoneActive === 'frontend' ? 'var(--brand-primary-subtle)' : 'transparent',
                }"
              >
                <div style="font-size: var(--text-base); font-weight: bold; color: var(--text-primary); margin-bottom: var(--space-1);">🎨 Frontend Project</div>
                <div style="font-size: var(--text-sm); color: var(--text-secondary);">Drop tasks here</div>
              </div>

              <div
                @dragover="handleDragOver"
                @dragenter="() => handleDragEnter('backend')"
                @dragleave="handleDragLeave"
                @drop="(e) => handleDrop(e, 'backend')"
                style="padding: var(--space-5); border: 2px dashed var(--glass-border); border-radius: var(--radius-xl); text-align: center; transition: all 0.2s ease;"
                :style="{
                  borderColor: dropZoneActive === 'backend' ? 'var(--state-active-border)' : 'var(--glass-border)',
                  background: dropZoneActive === 'backend' ? 'var(--brand-primary-subtle)' : 'transparent',
                }"
              >
                <div style="font-size: var(--text-base); font-weight: bold; color: var(--text-primary); margin-bottom: var(--space-1);">⚙️ Backend Project</div>
                <div style="font-size: var(--text-sm); color: var(--text-secondary);">Drop tasks here</div>
              </div>

              <div
                @dragover="handleDragOver"
                @dragenter="() => handleDragEnter('design')"
                @dragleave="handleDragLeave"
                @drop="(e) => handleDrop(e, 'design')"
                style="padding: var(--space-5); border: 2px dashed var(--glass-border); border-radius: var(--radius-xl); text-align: center; transition: all 0.2s ease;"
                :style="{
                  borderColor: dropZoneActive === 'design' ? 'var(--state-active-border)' : 'var(--glass-border)',
                  background: dropZoneActive === 'design' ? 'var(--brand-primary-subtle)' : 'transparent',
                }"
              >
                <div style="font-size: var(--text-base); font-weight: bold; color: var(--text-primary); margin-bottom: var(--space-1);">🎯 Design Project</div>
                <div style="font-size: var(--text-sm); color: var(--text-secondary);">Drop tasks here</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Statistics -->
        <div style="margin-top: var(--space-8); padding: var(--space-5); background: var(--glass-bg-subtle); border-radius: var(--radius-xl); border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 var(--space-3) 0; font-size: var(--text-base); color: var(--text-primary);">Drop Statistics</h4>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4);">
            <div style="text-align: center;">
              <div style="font-size: var(--text-2xl); font-weight: bold; color: var(--brand-primary);">{{ dropCount }}</div>
              <div style="font-size: var(--text-sm); color: var(--text-secondary);">Total Drops</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: var(--text-2xl); font-weight: bold; color: var(--brand-primary);">{{ tasks.length - droppedTasks.length }}</div>
              <div style="font-size: var(--text-sm); color: var(--text-secondary);">Remaining Tasks</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: var(--text-2xl); font-weight: bold; color: var(--brand-primary);">{{ droppedTasks.length }}</div>
              <div style="font-size: var(--text-sm); color: var(--text-secondary);">Dropped Tasks</div>
            </div>
          </div>

          <div v-if="droppedTasks.length > 0" style="margin-top: var(--space-4); padding: var(--space-3); background: var(--glass-bg-subtle); border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
            <div style="font-size: var(--text-sm); color: var(--text-primary); font-weight: bold; margin-bottom: var(--space-2);">Dropped Task IDs:</div>
            <div style="font-size: var(--text-sm); color: var(--text-muted); font-family: monospace;">{{ droppedTasks.join(', ') }}</div>
          </div>
        </div>
      </div>
    `,
  })
}
