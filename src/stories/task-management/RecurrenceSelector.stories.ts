import type { Meta, StoryObj } from '@storybook/vue3'
import RecurrenceSelector from '@/components/tasks/edit/RecurrenceSelector.vue'
import { RecurrencePattern, EndCondition, Weekday } from '@/types/recurrence'

const meta = {
  component: RecurrenceSelector,
  title: '📝 Task Management/Edit/RecurrenceSelector',
  tags: ['autodocs', 'new'],

  args: {
    modelValue: {
      isEnabled: false,
      rule: { pattern: RecurrencePattern.NONE },
      endCondition: { type: EndCondition.NEVER },
      exceptions: [],
      generatedInstances: [],
    },
    startDate: '2026-02-15',
    taskId: 'task-1',
  },

  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: 'var(--bg-primary)' },
      ],
    },
  },

  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="padding: var(--space-6); background: var(--glass-bg-soft); border-radius: var(--radius-xl); border: 1px solid var(--glass-border); max-width: 700px;">
          <story />
        </div>
      `,
    })
  ],
} satisfies Meta<typeof RecurrenceSelector>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const DailyRecurrence: Story = {
  args: {
    modelValue: {
      isEnabled: true,
      rule: { pattern: RecurrencePattern.DAILY, interval: 1 },
      endCondition: { type: EndCondition.NEVER },
      exceptions: [],
      generatedInstances: [],
    },
  },
}

export const WeeklyRecurrence: Story = {
  args: {
    modelValue: {
      isEnabled: true,
      rule: {
        pattern: RecurrencePattern.WEEKLY,
        interval: 1,
        weekdays: [Weekday.MONDAY, Weekday.WEDNESDAY, Weekday.FRIDAY]
      },
      endCondition: { type: EndCondition.NEVER },
      exceptions: [],
      generatedInstances: [],
    },
  },
}

export const MonthlyRecurrence: Story = {
  args: {
    modelValue: {
      isEnabled: true,
      rule: {
        pattern: RecurrencePattern.MONTHLY,
        interval: 1,
        dayOfMonth: 15
      },
      endCondition: { type: EndCondition.NEVER },
      exceptions: [],
      generatedInstances: [],
    },
  },
}

export const WithEndDate: Story = {
  args: {
    modelValue: {
      isEnabled: true,
      rule: { pattern: RecurrencePattern.DAILY, interval: 2 },
      endCondition: { type: EndCondition.ON_DATE, date: '2026-03-15' },
      exceptions: [],
      generatedInstances: [],
    },
  },
}

export const WithEndCount: Story = {
  args: {
    modelValue: {
      isEnabled: true,
      rule: { pattern: RecurrencePattern.DAILY, interval: 1 },
      endCondition: { type: EndCondition.AFTER_COUNT, count: 10 },
      exceptions: [],
      generatedInstances: [],
    },
  },
}

export const CustomRule: Story = {
  args: {
    modelValue: {
      isEnabled: true,
      rule: {
        pattern: RecurrencePattern.CUSTOM,
        customRule: 'EVERY 2 WEEKS ON MON,FRI'
      },
      endCondition: { type: EndCondition.NEVER },
      exceptions: [],
      generatedInstances: [],
    },
  },
}
