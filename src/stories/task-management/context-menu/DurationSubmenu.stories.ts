import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import DurationSubmenu from '@/components/tasks/context-menu/DurationSubmenu.vue'

const meta = {
  title: '📝 Task Management/Context Menu/DurationSubmenu',
  component: DurationSubmenu,
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    isVisible: { control: 'boolean' },
    parentVisible: { control: 'boolean' },
    currentDuration: {
      control: 'select',
      options: [null, 15, 25, 30, 45, 60, 90, 120]
    }
  }
} satisfies Meta<typeof DurationSubmenu>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    isVisible: true,
    parentVisible: true,
    currentDuration: null
  },
  render: (args) => ({
    components: { DurationSubmenu },
    setup() {
      const duration = ref(args.currentDuration)
      const style = ref({
        top: '250px',
        left: '300px'
      })

      const handleSelect = (value: number | null) => {
        duration.value = value
        console.log('Duration selected:', value)
      }

      return { args, style, duration, handleSelect }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        min-height: 500px;
        min-width: 400px;
        position: relative;
      ">
        <DurationSubmenu
          :is-visible="args.isVisible"
          :parent-visible="args.parentVisible"
          :style="style"
          :current-duration="duration"
          @select="handleSelect"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Selected duration: {{ duration ? duration + ' min' : 'None' }}
        </div>
        <div style="
          margin-top: var(--space-2);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Click an option to select duration
        </div>
      </div>
    `
  })
}

export const WithSelection: Story = {
  args: {
    isVisible: true,
    parentVisible: true,
    currentDuration: 25
  },
  render: (args) => ({
    components: { DurationSubmenu },
    setup() {
      const duration = ref(args.currentDuration)
      const style = ref({
        top: '250px',
        left: '300px'
      })

      const handleSelect = (value: number | null) => {
        duration.value = value
      }

      return { args, style, duration, handleSelect }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        min-height: 500px;
        min-width: 400px;
        position: relative;
      ">
        <DurationSubmenu
          :is-visible="args.isVisible"
          :parent-visible="args.parentVisible"
          :style="style"
          :current-duration="duration"
          @select="handleSelect"
        />
        <div style="
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Currently selected: 25 min (Pomodoro)
        </div>
      </div>
    `
  })
}

export const AllDurations: Story = {
  args: {
    isVisible: true,
    parentVisible: true,
    currentDuration: null
  },
  render: (args) => ({
    components: { DurationSubmenu },
    setup() {
      const duration = ref(args.currentDuration)
      const style = ref({
        top: '250px',
        left: '300px'
      })

      const handleSelect = (value: number | null) => {
        duration.value = value
      }

      return { args, style, duration, handleSelect }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        min-height: 500px;
        min-width: 400px;
        position: relative;
      ">
        <DurationSubmenu
          :is-visible="args.isVisible"
          :parent-visible="args.parentVisible"
          :style="style"
          :current-duration="duration"
          @select="handleSelect"
        />
        <div style="
          position: absolute;
          top: var(--space-4);
          left: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Available durations:
          <ul style="margin-top: var(--space-2); padding-left: var(--space-4);">
            <li>15 min - Quick task</li>
            <li>25 min - Pomodoro</li>
            <li>30 min - Short session</li>
            <li>45 min - Medium session</li>
            <li>60 min - Hour</li>
            <li>90 min - Long session</li>
            <li>120 min - Extended session</li>
            <li>No duration</li>
          </ul>
        </div>
        <div style="
          position: absolute;
          bottom: var(--space-4);
          left: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">
          Selected: {{ duration ? duration + ' min' : 'None' }}
        </div>
      </div>
    `
  })
}

export const Hidden: Story = {
  args: {
    isVisible: false,
    parentVisible: true,
    currentDuration: null
  },
  render: (args) => ({
    components: { DurationSubmenu },
    setup() {
      const duration = ref(args.currentDuration)
      const isVisible = ref(args.isVisible)
      const style = ref({
        top: '250px',
        left: '300px'
      })

      const handleSelect = (value: number | null) => {
        duration.value = value
      }

      const toggleVisibility = () => {
        isVisible.value = !isVisible.value
      }

      return { args, style, duration, isVisible, handleSelect, toggleVisibility }
    },
    template: `
      <div style="
        padding: var(--space-8);
        background: var(--glass-bg-soft);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        min-height: 500px;
        min-width: 400px;
        position: relative;
      ">
        <button
          @click="toggleVisibility"
          style="
            padding: var(--space-2) var(--space-4);
            background: var(--glass-bg-soft);
            color: var(--brand-primary);
            border: 1px solid var(--brand-primary);
            border-radius: var(--radius-md);
            cursor: pointer;
            font-size: var(--text-sm);
            backdrop-filter: blur(8px);
          "
        >
          {{ isVisible ? 'Hide' : 'Show' }} Submenu
        </button>
        <DurationSubmenu
          :is-visible="isVisible"
          :parent-visible="args.parentVisible"
          :style="style"
          :current-duration="duration"
          @select="handleSelect"
        />
      </div>
    `
  })
}
