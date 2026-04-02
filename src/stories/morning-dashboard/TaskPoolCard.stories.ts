import type { Meta, StoryObj } from '@storybook/vue3'

const S = {
  wrap: 'width: 340px; padding: var(--space-4); background: var(--surface-primary); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); display: flex; flex-direction: column; gap: var(--space-1);',
  card: 'display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: var(--surface-primary); border: 1px solid var(--glass-border); border-radius: var(--radius-md); cursor: grab; min-height: 40px; max-height: 48px;',
  dot: 'width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;',
  title: 'flex: 1; font-size: 0.8rem; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.3;',
  due: 'font-size: 0.65rem; color: var(--text-muted); white-space: nowrap; padding: 1px var(--space-1); background: var(--glass-bg-soft); border-radius: var(--radius-sm);',
  dueOverdue: 'font-size: 0.65rem; color: var(--color-danger); white-space: nowrap; padding: 1px var(--space-1); background: var(--danger-bg-subtle); border-radius: var(--radius-sm);',
  project: 'font-size: 0.65rem; color: var(--text-muted); max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0;',
}

const meta: Meta = {
  title: '☀️ Morning Dashboard/TaskPoolCard',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Draggable task card for the Big Three task pool. Shows priority dot, title, due date badge, and project tag.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const AllPriorities: Story = {
  render: () => ({
    template: `
      <div style="${S.wrap}">
        <div style="${S.card}">
          <span style="${S.dot} background-color: var(--color-danger);" />
          <span style="${S.title}">Fix critical production bug</span>
          <span style="${S.dueOverdue}">Yesterday</span>
          <span style="${S.project}">Backend</span>
        </div>
        <div style="${S.card}">
          <span style="${S.dot} background-color: var(--color-warning);" />
          <span style="${S.title}">Review quarterly metrics report</span>
          <span style="${S.due}">Today</span>
        </div>
        <div style="${S.card}">
          <span style="${S.dot} background-color: var(--brand-primary);" />
          <span style="${S.title}">Update team documentation</span>
          <span style="${S.due}">Tomorrow</span>
          <span style="${S.project}">Docs</span>
        </div>
        <div style="${S.card}">
          <span style="${S.dot} background-color: var(--text-muted);" />
          <span style="${S.title}">Organize bookmarks and reading list for the new project research phase</span>
        </div>
      </div>
    `,
  }),
}

export const SingleCard: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-4); background: var(--overlay-component-bg); border-radius: var(--radius-lg); width: 340px;">
        <div style="${S.card}">
          <span style="${S.dot} background-color: var(--color-danger);" />
          <span style="${S.title}">Deploy v2.1 hotfix</span>
          <span style="${S.due}">Today</span>
          <span style="${S.project}">FlowState</span>
        </div>
      </div>
    `,
  }),
}
