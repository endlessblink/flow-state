import type { Meta, StoryObj } from '@storybook/vue3'

const S = {
  wrap: 'padding: var(--space-6); background: var(--app-background-gradient); border-radius: var(--radius-lg); min-width: 400px;',
  greeting: 'font-size: 1.5rem; font-weight: 600; color: var(--text-primary); margin: 0 0 var(--space-2) 0; line-height: 1.2;',
  date: 'font-size: 0.875rem; color: var(--text-secondary); margin: 0 0 var(--space-2) 0;',
  quote: 'font-size: 0.8rem; font-style: italic; color: var(--text-muted); margin: 0;',
}

const meta: Meta = {
  title: '☀️ Morning Dashboard/MorningGreeting',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Greeting header with time-based message, formatted date, and daily motivational quote. Fades in on mount.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Morning: Story = {
  render: () => ({
    template: `
      <div style="${S.wrap}">
        <h1 style="${S.greeting}">Good morning!</h1>
        <p style="${S.date}">Friday, March 7, 2026</p>
        <p style="${S.quote}">"The secret of getting ahead is getting started." — Mark Twain</p>
      </div>
    `,
  }),
}

export const Afternoon: Story = {
  render: () => ({
    template: `
      <div style="${S.wrap}">
        <h1 style="${S.greeting}">Good afternoon!</h1>
        <p style="${S.date}">Friday, March 7, 2026</p>
        <p style="${S.quote}">"Focus on being productive instead of busy." — Tim Ferriss</p>
      </div>
    `,
  }),
}

export const Evening: Story = {
  render: () => ({
    template: `
      <div style="${S.wrap}">
        <h1 style="${S.greeting}">Good evening!</h1>
        <p style="${S.date}">Friday, March 7, 2026</p>
        <p style="${S.quote}">"Well done is better than well said." — Benjamin Franklin</p>
      </div>
    `,
  }),
}
