import type { Meta, StoryObj } from '@storybook/vue3'
import CalendarHeader from '@/components/calendar/CalendarHeader.vue'

const meta: Meta<typeof CalendarHeader> = {
  title: '📅 Calendar/CalendarHeader',
  component: CalendarHeader,
  tags: ['autodocs', 'new'],
  argTypes: {
    viewMode: {
      control: 'select',
      options: ['day', 'week', 'month']
    },
    hideCalendarDoneTasks: {
      control: 'boolean'
    }
  }
}

export default meta
type Story = StoryObj<typeof CalendarHeader>

export const DayView: Story = {
  args: {
    formatCurrentDate: 'Monday, February 13, 2026',
    hideCalendarDoneTasks: false,
    viewMode: 'day'
  }
}

export const WeekView: Story = {
  args: {
    formatCurrentDate: 'Week of Feb 10 - Feb 16, 2026',
    hideCalendarDoneTasks: false,
    viewMode: 'week'
  }
}

export const MonthView: Story = {
  args: {
    formatCurrentDate: 'February 2026',
    hideCalendarDoneTasks: false,
    viewMode: 'month'
  }
}

export const WithDoneHidden: Story = {
  args: {
    formatCurrentDate: 'Monday, February 13, 2026',
    hideCalendarDoneTasks: true,
    viewMode: 'day'
  }
}
