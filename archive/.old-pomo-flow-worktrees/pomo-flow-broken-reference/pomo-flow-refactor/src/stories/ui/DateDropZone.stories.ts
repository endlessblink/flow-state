import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import DateDropZone from '@/components/DateDropZone.vue'
import { Calendar, CalendarDays, Clock } from 'lucide-vue-next'

const meta = {
  component: DateDropZone,
  title: '🧩 Components/🔧 UI/DateDropZone',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Interactive drop zone for scheduling tasks to specific dates. Supports drag-and-drop functionality with visual feedback and date calculation.'
      }
    }
  },

  argTypes: {
    active: {
      control: 'boolean',
      description: 'Whether the drop zone is in active state',
    },
    count: {
      control: 'number',
      description: 'Number of tasks scheduled for this date',
    },
    targetType: {
      control: 'select',
      options: ['today', 'tomorrow', 'weekend', 'nodate'],
      description: 'Target date type for scheduling',
    },
  },
} satisfies Meta<typeof DateDropZone>

export default meta
type Story = StoryObj<typeof meta>

// Default today drop zone
export const Default: Story = {
  args: {
    active: false,
    count: 3,
    targetType: 'today',
  },
  render: (args) => ({
    components: { DateDropZone, Calendar },
    setup() {
      const handleClick = (event: MouseEvent) => {
        console.log('DateDropZone clicked:', event)
      }

      return {
        handleClick,
        ...args,
      }
    },
    template: `
      <div style="width: 300px; padding: 40px; background: var(--surface-secondary);">
        <DateDropZone
          :active="active"
          :count="count"
          :target-type="targetType"
          @click="handleClick"
        >
          <template #icon>
            <Calendar :size="16" />
          </template>
          Today
        </DateDropZone>
      </div>
    `,
  }),
}

// All target types
export const AllTargetTypes: Story = {
  render: () => ({
    components: { DateDropZone, Calendar, CalendarDays, Clock },
    setup() {
      const dropZones = ref([
        {
          type: 'today',
          label: 'Today',
          icon: 'Calendar',
          count: 5,
          active: false,
        },
        {
          type: 'tomorrow',
          label: 'Tomorrow',
          icon: 'CalendarDays',
          count: 2,
          active: false,
        },
        {
          type: 'weekend',
          label: 'This Weekend',
          icon: 'CalendarDays',
          count: 8,
          active: false,
        },
        {
          type: 'nodate',
          label: 'No Date',
          icon: 'Clock',
          count: 12,
          active: false,
        },
      ])

      const handleClick = (event: MouseEvent, type: string) => {
        console.log(`${type} drop zone clicked:`, event)
      }

      const handleIconClick = (event: MouseEvent, type: string) => {
        event.stopPropagation()
        console.log(`${type} icon clicked:`, event)
      }

      return {
        dropZones,
        handleClick,
        handleIconClick,
      }
    },
    template: `
      <div style="padding: 40px; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 24px 0; font-size: 18px; color: var(--text-primary);">Date Drop Zones</h3>
        <p style="margin: 0 0 32px 0; color: var(--text-secondary);">Drag tasks to schedule them for specific dates</p>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
          <div
            v-for="zone in dropZones"
            :key="zone.type"
            style="padding: 20px; background: var(--surface-primary); border-radius: 12px; border: 1px solid var(--border-subtle);"
          >
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h4 style="margin: 0; font-size: 16px; color: var(--text-primary);">{{ zone.label }}</h4>
              <span style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">{{ zone.type }}</span>
            </div>

            <DateDropZone
              :active="zone.active"
              :count="zone.count"
              :target-type="zone.type"
              @click="(event) => handleClick(event, zone.type)"
            >
              <template #icon>
                <component :is="zone.icon" :size="16" />
              </template>
              {{ zone.label }}
            </DateDropZone>

            <div style="margin-top: 12px; font-size: 13px; color: var(--text-secondary);">
              <div>{{ zone.count }} tasks scheduled</div>
            </div>
          </div>
        </div>

        <div style="margin-top: 32px; padding: 20px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Target Types</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            <li><strong>Today</strong> - Schedule for current date</li>
            <li><strong>Tomorrow</strong> - Schedule for next day</li>
            <li><strong>Weekend</strong> - Schedule for upcoming weekend</li>
            <li><strong>No Date</strong> - Remove date from task</li>
          </ul>
        </div>
      </div>
    `,
  }),
}

// Active states
export const ActiveStates: Story = {
  render: () => ({
    components: { DateDropZone, Calendar },
    setup() {
      const zones = ref([
        { type: 'today', label: 'Today', active: true },
        { type: 'tomorrow', label: 'Tomorrow', active: false },
        { type: 'weekend', label: 'Weekend', active: false },
      ])

      const handleToggle = (index: number) => {
        zones.value.forEach((zone, i) => {
          zone.active = i === index
        })
      }

      const handleClick = (event: MouseEvent, type: string) => {
        console.log(`${type} zone clicked:`, event)
      }

      return {
        zones,
        handleToggle,
        handleClick,
      }
    },
    template: `
      <div style="padding: 40px; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 24px 0; font-size: 18px; color: var(--text-primary);">Active States</h3>
        <p style="margin: 0 0 32px 0; color: var(--text-secondary);">Click to toggle active state</p>

        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
          <div
            v-for="(zone, index) in zones"
            :key="zone.type"
            style="text-align: center;"
          >
            <DateDropZone
              :active="zone.active"
              :target-type="zone.type"
              @click="(event) => handleClick(event, zone.type)"
              style="margin-bottom: 12px;"
            >
              <template #icon>
                <Calendar :size="16" />
              </template>
              {{ zone.label }}
            </DateDropZone>

            <div style="font-size: 13px; color: var(--text-secondary);">
              {{ zone.active ? 'Active' : 'Inactive' }}
            </div>
          </div>
        </div>

        <div style="margin-top: 32px; padding: 16px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 8px 0; font-size: 16px; color: var(--text-primary);">Active State Features</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            <li><strong>Enhanced styling</strong> - Highlighted appearance</li>
            <li><strong>Better contrast</strong> - Improved visibility</li>
            <li><strong>Visual feedback</strong> - Clear selection state</li>
            <li><strong>Glass morphism</strong> - Modern design effects</li>
          </ul>
        </div>
      </div>
    `,
  }),
}

// Interactive drag and drop simulation
export const InteractiveDragDrop: Story = {
  render: () => ({
    components: { DateDropZone, Calendar },
    setup() {
      const isDragging = ref(false)
      const activeZone = ref<string | null>(null)
      const dragValid = ref(false)

      const tasks = ref([
        { id: 1, title: 'Review pull request', scheduled: null },
        { id: 2, title: 'Write documentation', scheduled: null },
        { id: 3, title: 'Fix navigation bug', scheduled: null },
      ])

      const dropZones = ref([
        { type: 'today', label: 'Today', count: 0, active: false },
        { type: 'tomorrow', label: 'Tomorrow', count: 0, active: false },
        { type: 'weekend', label: 'Weekend', count: 0, active: false },
      ])

      const handleTaskDragStart = (taskId: number) => {
        isDragging.value = true
        console.log('Started dragging task:', taskId)
      }

      const handleTaskDragEnd = () => {
        isDragging.value = false
        activeZone.value = null
        dragValid.value = false
        console.log('Ended dragging')
      }

      const handleZoneDragEnter = (zoneType: string) => {
        if (isDragging.value) {
          activeZone.value = zoneType
          dragValid.value = true
          console.log('Drag entered zone:', zoneType)
        }
      }

      const handleZoneDragLeave = () => {
        activeZone.value = null
        dragValid.value = false
      }

      const handleZoneDrop = (zoneType: string) => {
        activeZone.value = null
        dragValid.value = false

        // Simulate task scheduling
        const unScheduledTask = tasks.value.find(t => !t.scheduled)
        if (unScheduledTask) {
          unScheduledTask.scheduled = zoneType

          // Update zone count
          const zone = dropZones.value.find(z => z.type === zoneType)
          if (zone) {
            zone.count++
          }

          console.log(`Task scheduled for ${zoneType}`)
        }

        isDragging.value = false
      }

      const handleTaskClick = (taskId: number) => {
        const task = tasks.value.find(t => t.id === taskId)
        if (task) {
          // Reset task scheduling
          if (task.scheduled) {
            const zone = dropZones.value.find(z => z.type === task.scheduled)
            if (zone && zone.count > 0) {
              zone.count--
            }
          }
          task.scheduled = null
        }
      }

      return {
        isDragging,
        activeZone,
        dragValid,
        tasks,
        dropZones,
        handleTaskDragStart,
        handleTaskDragEnd,
        handleZoneDragEnter,
        handleZoneDragLeave,
        handleZoneDrop,
        handleTaskClick,
      }
    },
    template: `
      <div style="padding: 40px; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 24px 0; font-size: 20px; color: var(--text-primary);">Interactive Drag & Drop</h3>
        <p style="margin: 0 0 32px 0; color: var(--text-secondary);">Drag tasks to drop zones to schedule them</p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px;">
          <!-- Draggable Tasks -->
          <div>
            <h4 style="margin: 0 0 16px 0; font-size: 16px; color: var(--text-primary);">Tasks (Drag these)</h4>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div
                v-for="task in tasks"
                :key="task.id"
                draggable="true"
                @dragstart="handleTaskDragStart(task.id)"
                @dragend="handleTaskDragEnd"
                @click="handleTaskClick(task.id)"
                style="padding: 12px; background: var(--surface-primary); border: 1px solid var(--border-subtle); border-radius: 8px; cursor: move; display: flex; justify-content: space-between; align-items: center;"
              >
                <span style="font-size: 14px; color: var(--text-primary);">
                  {{ task.title }}
                </span>
                <span style="font-size: 12px; padding: 4px 8px; background: var(--glass-bg-medium); border-radius: 4px; color: var(--text-secondary);">
                  {{ task.scheduled || 'Unscheduled' }}
                </span>
              </div>
            </div>

            <div style="margin-top: 16px; padding: 12px; background: var(--glass-bg-soft); border-radius: 8px; border: 1px solid var(--glass-border);">
              <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">
                <strong>Instructions:</strong><br>
                • Drag tasks to schedule them<br>
                • Click tasks to un-schedule<br>
                • Watch visual feedback
              </p>
            </div>
          </div>

          <!-- Drop Zones -->
          <div>
            <h4 style="margin: 0 0 16px 0; font-size: 16px; color: var(--text-primary);">Drop Zones</h4>
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <div
                v-for="zone in dropZones"
                :key="zone.type"
                @dragenter="handleZoneDragEnter(zone.type)"
                @dragover="$event.preventDefault()"
                @dragleave="handleZoneDragLeave"
                @drop="handleZoneDrop(zone.type)"
                :style="{
                  padding: '16px',
                  border: '2px dashed var(--border-medium)',
                  borderRadius: '12px',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                  borderColor: activeZone === zone.type ? (dragValid ? '#4ECDC4' : '#ff6b6b') : 'var(--border-medium)',
                  background: activeZone === zone.type && dragValid ? 'rgba(78, 205, 196, 0.1)' : 'transparent',
                }"
              >
                <DateDropZone
                  :active="activeZone === zone.type"
                  :count="zone.count"
                  :target-type="zone.type"
                  style="margin: 0 auto; display: inline-block;"
                >
                  <template #icon>
                    <Calendar :size="16" />
                  </template>
                  {{ zone.label }}
                </DateDropZone>

                <div v-if="activeZone === zone.type" style="margin-top: 8px; font-size: 12px; color: var(--text-secondary);">
                  {{ dragValid ? '✅ Valid drop target' : '❌ Invalid drop target' }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Statistics -->
        <div style="margin-top: 32px; padding: 20px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Drop Statistics</h4>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
            <div>
              <div style="font-size: 14px; color: var(--text-secondary);">Total Tasks</div>
              <div style="font-size: 24px; font-weight: bold; color: var(--brand-primary);">{{ tasks.length }}</div>
            </div>
            <div>
              <div style="font-size: 14px; color: var(--text-secondary);">Scheduled Tasks</div>
              <div style="font-size: 24px; font-weight: bold; color: var(--brand-primary);">
                {{ tasks.filter(t => t.scheduled).length }}
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
  }),
}

// Count variations
export const CountVariations: Story = {
  render: () => ({
    components: { DateDropZone, Calendar },
    setup() {
      const todayCounts = [0, 1, 3, 5, 8, 12, 99]

      return {
        todayCounts,
      }
    },
    template: `
      <div style="padding: 40px; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 24px 0; font-size: 18px; color: var(--text-primary);">Count Variations</h3>
        <p style="margin: 0 0 32px 0; color: var(--text-secondary);">Different task counts displayed as badges</p>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
          <div
            v-for="count in todayCounts"
            :key="count"
            style="padding: 16px; background: var(--surface-primary); border-radius: 12px; border: 1px solid var(--border-subtle); text-align: center;"
          >
            <DateDropZone
              :count="count"
              target-type="today"
              style="margin: 0 auto 12px;"
            >
              <template #icon>
                <Calendar :size="16" />
              </template>
              Today
            </DateDropZone>

            <div style="font-size: 13px; color: var(--text-secondary);">
              {{ count }} {{ count === 1 ? 'task' : 'tasks' }}
            </div>
          </div>
        </div>

        <div style="margin-top: 24px; padding: 16px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
          <h4 style="margin: 0 0 8px 0; font-size: 16px; color: var(--text-primary);">Badge Features</h4>
          <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
            <li><strong>Auto-sizing</strong> - Adapts to number width</li>
            <li><strong>Color coding</strong> - Visual hierarchy</li>
            <li><strong>Count display</strong> - Shows task quantity</li>
            <li><strong>Smart truncation</strong> - Handles large numbers</li>
          </ul>
        </div>
      </div>
    `,
  }),
}

// Weekend special case
export const WeekendSpecialCase: Story = {
  render: () => ({
    components: { DateDropZone, CalendarDays },
    setup() {
      const today = new Date()
      const currentDay = today.getDay()
      const isWeekend = currentDay === 0 || currentDay === 6

      const weekendInfo = computed(() => {
        if (isWeekend) {
          return {
            label: 'This Weekend',
            description: 'Weekend is here! Tasks scheduled for Saturday.',
            daysUntil: currentDay === 6 ? 0 : 1
          }
        } else {
          const daysUntilWeekend = (6 - currentDay) || 7
          return {
            label: 'This Weekend',
            description: `${daysUntilWeekend} days until weekend`,
            daysUntil: daysUntilWeekend
          }
        }
      })

      return {
        weekendInfo,
        isWeekend,
      }
    },
    template: `
      <div style="padding: 40px; background: var(--surface-secondary);">
        <h3 style="margin: 0 0 24px 0; font-size: 18px; color: var(--text-primary);">Weekend Drop Zone</h3>
        <p style="margin: 0 0 32px 0; color: var(--text-secondary);">Smart weekend scheduling</p>

        <div style="max-width: 400px; margin: 0 auto;">
          <DateDropZone
            :active="isWeekend"
            count="4"
            target-type="weekend"
            style="margin: 0 auto 20px;"
          >
            <template #icon>
              <CalendarDays :size="16" />
            </template>
            {{ weekendInfo.label }}
          </DateDropZone>

          <div style="padding: 20px; background: var(--glass-bg-soft); border-radius: 12px; border: 1px solid var(--glass-border);">
            <h4 style="margin: 0 0 12px 0; font-size: 16px; color: var(--text-primary);">Weekend Logic</h4>
            <p style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-secondary);">
              {{ weekendInfo.description }}
            </p>
            <div style="font-size: 13px; color: var(--text-muted); padding: 12px; background: var(--surface-tertiary); border-radius: 8px;">
              <strong>Current day:</strong> {{ ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()] }}<br>
              <strong>Days until weekend:</strong> {{ weekendInfo.daysUntil }}
            </div>
          </div>
        </div>
      </div>
    `,
  }),
}