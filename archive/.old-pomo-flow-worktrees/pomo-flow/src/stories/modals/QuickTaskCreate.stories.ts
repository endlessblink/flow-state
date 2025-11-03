import type { Meta, StoryObj } from '@storybook/vue3'
import { ref, reactive } from 'vue'
import QuickTaskCreate from '@/components/QuickTaskCreate.vue'

const meta = {
  component: QuickTaskCreate,
  title: '🎭 Overlays/🪟 Modals/QuickTaskCreate',
  tags: ['autodocs'],

  parameters: {
    layout: 'fullscreen',
    docs: {
      story: {
        height: '800px', // Explicit height for complex modal stories
        inline: true,
      },
    },
  },

  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Whether the modal is visible',
    },
    startTime: {
      control: 'date',
      description: 'Start time for the task',
    },
    endTime: {
      control: 'date',
      description: 'End time for the task',
    },
    duration: {
      control: 'number',
      description: 'Default duration in minutes',
    },
  },
} satisfies Meta<typeof QuickTaskCreate>

export default meta
type Story = StoryObj<typeof meta>

// Basic Modal
export const Default: Story = {
  args: {
    isOpen: true,
    startTime: new Date(2024, 11, 25, 14, 0), // 2:00 PM
    endTime: new Date(2024, 11, 25, 15, 0), // 3:00 PM
    duration: 60,
  },
  render: (args) => ({
    components: { QuickTaskCreate },
    setup() {
      const isOpen = ref(args.isOpen)

      const handleClose = () => {
        isOpen.value = false
      }

      const handleCreated = (task: any) => {
        console.log('Task created:', task)
        isOpen.value = false
      }

      return { ...args, isOpen, handleClose, handleCreated }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Quick Task Create Modal</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Fast task creation with time scheduling</p>

        <button
          @click="isOpen = !isOpen"
          style="padding: 12px 24px; background: transparent; color: var(--brand-primary); border: 1px solid var(--brand-primary); border-radius: 8px; cursor: pointer; box-shadow: 0 0 0 1px var(--brand-primary) inset;"
        >
          {{ isOpen ? 'Close Modal' : 'Open Quick Create' }}
        </button>

        <QuickTaskCreate
          :is-open="isOpen"
          :start-time="startTime"
          :end-time="endTime"
          :duration="duration"
          @close="handleClose"
          @created="handleCreated"
        />
      </div>
    `,
  })
}

// Morning Task
export const MorningTask: Story = {
  args: {
    isOpen: true,
    startTime: new Date(2024, 11, 25, 9, 0), // 9:00 AM
    endTime: new Date(2024, 11, 25, 9, 30), // 9:30 AM
    duration: 30,
  },
  render: (args) => ({
    components: { QuickTaskCreate },
    setup() {
      const isOpen = ref(args.isOpen)

      const handleClose = () => {
        isOpen.value = false
      }

      const handleCreated = (task: any) => {
        console.log('Morning task created:', task)
        isOpen.value = false
      }

      return { ...args, isOpen, handleClose, handleCreated }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Morning Task Creation</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Quick task for 9:00 AM - 9:30 AM slot</p>

        <QuickTaskCreate
          :is-open="isOpen"
          :start-time="startTime"
          :end-time="endTime"
          :duration="duration"
          @close="handleClose"
          @created="handleCreated"
        />
      </div>
    `,
  })
}

// Afternoon Meeting
export const AfternoonMeeting: Story = {
  args: {
    isOpen: true,
    startTime: new Date(2024, 11, 25, 14, 30), // 2:30 PM
    endTime: new Date(2024, 11, 25, 16, 0), // 4:00 PM
    duration: 90,
  },
  render: (args) => ({
    components: { QuickTaskCreate },
    setup() {
      const isOpen = ref(args.isOpen)

      const handleClose = () => {
        isOpen.value = false
      }

      const handleCreated = (task: any) => {
        console.log('Meeting created:', task)
        isOpen.value = false
      }

      return { ...args, isOpen, handleClose, handleCreated }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Afternoon Meeting</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Schedule a meeting from 2:30 PM to 4:00 PM</p>

        <QuickTaskCreate
          :is-open="isOpen"
          :start-time="startTime"
          :end-time="endTime"
          :duration="duration"
          @close="handleClose"
          @created="handleCreated"
        />
      </div>
    `,
  })
}

// Short Task (15 minutes)
export const ShortTask: Story = {
  args: {
    isOpen: true,
    startTime: new Date(2024, 11, 25, 11, 0), // 11:00 AM
    endTime: new Date(2024, 11, 25, 11, 15), // 11:15 AM
    duration: 15,
  },
  render: (args) => ({
    components: { QuickTaskCreate },
    setup() {
      const isOpen = ref(args.isOpen)

      const handleClose = () => {
        isOpen.value = false
      }

      const handleCreated = (task: any) => {
        console.log('Short task created:', task)
        isOpen.value = false
      }

      return { ...args, isOpen, handleClose, handleCreated }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Quick 15-Minute Task</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">Perfect for quick actions and micro-tasks</p>

        <QuickTaskCreate
          :is-open="isOpen"
          :start-time="startTime"
          :end-time="endTime"
          :duration="duration"
          @close="handleClose"
          @created="handleCreated"
        />
      </div>
    `,
  })
}

// Long Task (2 hours)
export const LongTask: Story = {
  args: {
    isOpen: true,
    startTime: new Date(2024, 11, 25, 10, 0), // 10:00 AM
    endTime: new Date(2024, 11, 25, 12, 0), // 12:00 PM
    duration: 120,
  },
  render: (args) => ({
    components: { QuickTaskCreate },
    setup() {
      const isOpen = ref(args.isOpen)

      const handleClose = () => {
        isOpen.value = false
      }

      const handleCreated = (task: any) => {
        console.log('Long task created:', task)
        isOpen.value = false
      }

      return { ...args, isOpen, handleClose, handleCreated }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">Extended Work Session</h3>
        <p style="margin: 0 0 24px 0; color: var(--text-secondary);">2-hour deep work session from 10:00 AM to 12:00 PM</p>

        <QuickTaskCreate
          :is-open="isOpen"
          :start-time="startTime"
          :end-time="endTime"
          :duration="duration"
          @close="handleClose"
          @created="handleCreated"
        />
      </div>
    `,
  })
}

// Interactive Demo
export const InteractiveDemo: Story = {
  parameters: {
    docs: {
      story: {
        height: '1000px', // Extra height for the complex interactive demo
      },
    },
  },
  render: () => ({
    components: { QuickTaskCreate },
    setup() {
      const modalState = reactive({
        isOpen: false,
        startTime: new Date(),
        endTime: new Date(),
        duration: 30,
      })

      const lastCreatedTask = ref<any>(null)

      const openQuickCreate = (startTime: Date, endTime: Date, duration: number) => {
        modalState.startTime = startTime
        modalState.endTime = endTime
        modalState.duration = duration
        modalState.isOpen = true
      }

      const handleClose = () => {
        modalState.isOpen = false
      }

      const handleCreated = (task: any) => {
        lastCreatedTask.value = task
        console.log('Task created:', task)
        modalState.isOpen = false
      }

      // Predefined time slots
      const now = new Date()
      const timeSlots = [
        {
          label: 'Quick Task (15 min)',
          startTime: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour from now
          duration: 15,
        },
        {
          label: 'Focus Session (45 min)',
          startTime: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2 hours from now
          duration: 45,
        },
        {
          label: 'Meeting (60 min)',
          startTime: new Date(now.getTime() + 4 * 60 * 60 * 1000), // 4 hours from now
          duration: 60,
        },
        {
          label: 'Deep Work (90 min)',
          startTime: new Date(now.getTime() + 24 * 60 * 60 * 1000), // tomorrow
          duration: 90,
        },
      ]

      return {
        modalState,
        lastCreatedTask,
        openQuickCreate,
        handleClose,
        handleCreated,
        timeSlots
      }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary);">
        <h2 style="margin: 0 0 16px 0; font-size: 20px; color: var(--text-primary);">Interactive QuickTaskCreate Demo</h2>
        <p style="margin: 0 0 32px 0; color: var(--text-secondary);">Click any time slot below to open the quick create modal</p>

        <!-- Last Created Task Display -->
        <div v-if="lastCreatedTask" style="margin-bottom: 32px; padding: 16px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 8px 0; font-size: 16px; color: var(--text-primary);">✅ Recently Created Task</h4>
          <div style="font-size: 14px; color: var(--text-secondary);">
            <strong>{{ lastCreatedTask.title }}</strong>
            <span v-if="lastCreatedTask.description"> - {{ lastCreatedTask.description }}</span>
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            Priority: {{ lastCreatedTask.priority }} • Duration: {{ lastCreatedTask.estimatedDuration }} mins
          </div>
        </div>

        <!-- Time Slots Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 32px;">
          <div
            v-for="slot in timeSlots"
            :key="slot.label"
            style="padding: 24px; background: var(--surface-primary); border-radius: 12px; border: 1px solid var(--border-medium); cursor: pointer; transition: all var(--duration-fast) ease;"
            @click="openQuickCreate(slot.startTime, new Date(slot.startTime.getTime() + slot.duration * 60 * 1000), slot.duration)"
            @mouseenter="$event.target.style.transform = 'translateY(-2px)'"
            @mouseleave="$event.target.style.transform = 'translateY(0)'"
          >
            <h4 style="margin: 0 0 8px 0; font-size: 16px; color: var(--text-primary);">{{ slot.label }}</h4>
            <p style="margin: 0; font-size: 14px; color: var(--text-secondary);">
              {{ slot.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) }}
              -
              {{ new Date(slot.startTime.getTime() + slot.duration * 60 * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) }}
            </p>
          </div>
        </div>

        <!-- Instructions -->
        <div style="padding: 20px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Features</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            <li><strong>Auto-focus</strong> - Title input gets focus automatically</li>
            <li><strong>Keyboard shortcuts</strong> - Enter to create, Escape to cancel</li>
            <li><strong>Priority cycling</strong> - Click priority chip to cycle through levels</li>
            <li><strong>Duration editing</strong> - Click duration to change time allocation</li>
            <li><strong>Project selection</strong> - Assign tasks to specific projects</li>
            <li><strong>Smart scheduling</strong> - Automatically creates calendar instances</li>
          </ul>
        </div>

        <!-- QuickTaskCreate Modal -->
        <QuickTaskCreate
          :is-open="modalState.isOpen"
          :start-time="modalState.startTime"
          :end-time="modalState.endTime"
          :duration="modalState.duration"
          @close="handleClose"
          @created="handleCreated"
        />
      </div>
    `,
  })
}

// All Variants Showcase
export const AllVariants: Story = {
  parameters: {
    docs: {
      story: {
        height: '1200px', // Maximum height for the comprehensive variants showcase
      },
    },
  },
  render: () => ({
    components: { QuickTaskCreate },
    setup() {
      const modals = reactive([
        {
          id: 'short',
          isOpen: true,
          label: 'Short Task (15 min)',
          startTime: new Date(2024, 11, 25, 9, 0),
          endTime: new Date(2024, 11, 25, 9, 15),
          duration: 15,
          description: 'Quick emails, calls, micro-tasks'
        },
        {
          id: 'standard',
          isOpen: false,
          label: 'Standard Task (30 min)',
          startTime: new Date(2024, 11, 25, 10, 0),
          endTime: new Date(2024, 11, 25, 10, 30),
          duration: 30,
          description: 'Regular work items, reviews'
        },
        {
          id: 'focus',
          isOpen: false,
          label: 'Focus Session (60 min)',
          startTime: new Date(2024, 11, 25, 14, 0),
          endTime: new Date(2024, 11, 25, 15, 0),
          duration: 60,
          description: 'Deep work, creative tasks'
        },
        {
          id: 'extended',
          isOpen: false,
          label: 'Extended Session (120 min)',
          startTime: new Date(2024, 11, 25, 16, 0),
          endTime: new Date(2024, 11, 25, 18, 0),
          duration: 120,
          description: 'Major projects, learning, research'
        },
      ])

      const openModal = (modalId: string) => {
        modals.forEach(modal => {
          modal.isOpen = modal.id === modalId
        })
      }

      const closeModal = (modalId: string) => {
        const modal = modals.find(m => m.id === modalId)
        if (modal) modal.isOpen = false
      }

      const handleCreated = (modalId: string, task: any) => {
        console.log(`Task created for ${modalId}:`, task)
        closeModal(modalId)
      }

      return { modals, openModal, closeModal, handleCreated }
    },
    template: `
      <div style="padding: 40px; min-height: 100vh; background: var(--surface-secondary);">
        <h2 style="margin: 0 0 24px 0; font-size: 20px; text-align: center; color: var(--text-primary);">QuickTaskCreate Duration Variants</h2>

        <!-- Task Type Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; margin-bottom: 40px;">
          <div
            v-for="modal in modals"
            :key="modal.id"
            style="padding: 24px; background: var(--surface-primary); border-radius: 12px; border: 1px solid var(--border-medium); cursor: pointer; transition: all var(--duration-fast) ease;"
            @click="openModal(modal.id)"
            @mouseenter="$event.target.style.transform = 'translateY(-2px)'; $event.target.style.borderColor = 'var(--brand-primary)'"
            @mouseleave="$event.target.style.transform = 'translateY(0)'; $event.target.style.borderColor = 'var(--border-medium)'"
          >
            <h3 style="margin: 0 0 8px 0; font-size: 18px; color: var(--text-primary);">{{ modal.label }}</h3>
            <p style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-secondary);">{{ modal.description }}</p>
            <div style="font-size: 13px; color: var(--text-muted);">
              {{ modal.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) }}
              -
              {{ modal.endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) }}
            </div>
          </div>
        </div>

        <!-- Features Overview -->
        <div style="padding: 24px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h3 style="margin: 0 0 16px 0; font-size: 18px; color: var(--text-primary);">QuickTaskCreate Features</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; font-size: 14px;">
            <div style="display: flex; align-items: start; gap: 8px;">
              <span style="font-size: 16px;">⚡</span>
              <div style="color: var(--text-secondary);">
                <strong>Lightning Fast</strong> - Create tasks in seconds
              </div>
            </div>
            <div style="display: flex; align-items: start; gap: 8px;">
              <span style="font-size: 16px;">📅</span>
              <div style="color: var(--text-secondary);">
                <strong>Smart Scheduling</strong> - Auto calendar integration
              </div>
            </div>
            <div style="display: flex; align-items: start; gap: 8px;">
              <span style="font-size: 16px;">🎯</span>
              <div style="color: var(--text-secondary);">
                <strong>Priority Control</strong> - Click to cycle levels
              </div>
            </div>
            <div style="display: flex; align-items: start; gap: 8px;">
              <span style="font-size: 16px;">⏱️</span>
              <div style="color: var(--text-secondary);">
                <strong>Flexible Duration</strong> - Edit time on the fly
              </div>
            </div>
            <div style="display: flex; align-items: start; gap: 8px;">
              <span style="font-size: 16px;">📁</span>
              <div style="color: var(--text-secondary);">
                <strong>Project Assignment</strong> - Organize by project
              </div>
            </div>
            <div style="display: flex; align-items: start; gap: 8px;">
              <span style="font-size: 16px;">⌨️</span>
              <div style="color: var(--text-secondary);">
                <strong>Keyboard Friendly</strong> - Enter/Escape shortcuts
              </div>
            </div>
          </div>
        </div>

        <!-- Modals -->
        <QuickTaskCreate
          v-for="modal in modals"
          :key="modal.id"
          :is-open="modal.isOpen"
          :start-time="modal.startTime"
          :end-time="modal.endTime"
          :duration="modal.duration"
          @close="() => closeModal(modal.id)"
          @created="(task) => handleCreated(modal.id, task)"
        />
      </div>
    `,
  })
}