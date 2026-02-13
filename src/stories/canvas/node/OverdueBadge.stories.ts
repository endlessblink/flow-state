import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import OverdueBadge from '@/components/canvas/node/OverdueBadge.vue'

const meta: Meta<typeof OverdueBadge> = {
  title: '🎨 Canvas/Node/OverdueBadge',
  component: OverdueBadge,
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered'
  }
}

export default meta
type Story = StoryObj<typeof OverdueBadge>

export const Default: Story = {
  args: {
    currentDueDate: null
  }
}

export const WithDueDate: Story = {
  args: {
    currentDueDate: new Date(Date.now() - 86400000).toISOString() // Yesterday
  }
}

export const Interactive: Story = {
  render: () => ({
    components: { OverdueBadge },
    setup() {
      const currentDueDate = ref(new Date(Date.now() - 86400000).toISOString())
      const rescheduleLog = ref<string[]>([])

      const handleReschedule = (dateType: string) => {
        rescheduleLog.value.push(`Rescheduled to: ${dateType}`)

        // Update due date based on selection for demo purposes
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        switch (dateType) {
          case 'today':
            currentDueDate.value = today.toISOString()
            break
          case 'tomorrow':
            const tomorrow = new Date(today)
            tomorrow.setDate(tomorrow.getDate() + 1)
            currentDueDate.value = tomorrow.toISOString()
            break
          case 'this_weekend':
            const saturday = new Date(today)
            const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7
            saturday.setDate(today.getDate() + daysUntilSaturday)
            currentDueDate.value = saturday.toISOString()
            break
          case 'next_week':
            const monday = new Date(today)
            const daysUntilMonday = today.getDay() === 0 ? 1 : 8 - today.getDay()
            monday.setDate(today.getDate() + daysUntilMonday)
            currentDueDate.value = monday.toISOString()
            break
        }
      }

      return { currentDueDate, rescheduleLog, handleReschedule }
    },
    template: `
      <div style="padding: var(--space-6);">
        <div style="margin-bottom: var(--space-4);">
          <OverdueBadge
            :current-due-date="currentDueDate"
            @reschedule="handleReschedule"
          />
        </div>
        <div style="padding: var(--space-4); background: var(--surface-secondary); border-radius: var(--radius-lg);">
          <h4 style="color: var(--text-primary); margin: 0 0 var(--space-2) 0;">Reschedule Log</h4>
          <div v-for="(log, i) in rescheduleLog" :key="i" style="color: var(--text-secondary); font-size: var(--text-sm); padding: var(--space-1) 0;">
            {{ log }}
          </div>
          <div v-if="rescheduleLog.length === 0" style="color: var(--text-muted); font-size: var(--text-sm); font-style: italic;">
            Click the badge to reschedule
          </div>
        </div>
      </div>
    `
  })
}
