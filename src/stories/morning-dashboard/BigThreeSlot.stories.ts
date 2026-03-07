import type { Meta, StoryObj } from '@storybook/vue3'

const S = {
  wrap: 'width: 360px; padding: var(--space-6); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); backdrop-filter: blur(8px); display: flex; flex-direction: column; gap: var(--space-3);',
  zone: 'display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); min-height: 56px; transition: all 0.2s ease;',
  zoneEmpty: 'border: 2px dashed var(--glass-border);',
  zoneDragover: 'border: 2px solid var(--brand-primary); background: rgba(78, 205, 196, 0.06); transform: scale(1.02); box-shadow: 0 0 16px rgba(78, 205, 196, 0.15);',
  zoneFilled: 'background: var(--surface-primary); border-left: 3px solid var(--brand-primary); border-top: 1px solid var(--glass-border); border-right: 1px solid var(--glass-border); border-bottom: 1px solid var(--glass-border);',
  zoneCompleted: 'background: var(--surface-primary); border-left: 3px solid var(--brand-primary); border-top: 1px solid var(--glass-border); border-right: 1px solid var(--glass-border); border-bottom: 1px solid var(--glass-border); opacity: 0.6;',
  num: 'font-size: 0.75rem; font-weight: 700; color: var(--brand-primary); min-width: 18px; flex-shrink: 0;',
  placeholder: 'font-size: 0.8rem; color: var(--text-muted); flex: 1;',
  dropHint: 'font-size: 0.8rem; color: var(--brand-primary); font-weight: 500; flex: 1;',
  title: 'font-size: 0.85rem; color: var(--text-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
  titleDone: 'font-size: 0.85rem; color: var(--text-muted); flex: 1; text-decoration: line-through;',
  clearBtn: 'background: none; border: none; color: var(--text-muted); font-size: 1.1rem; cursor: pointer; padding: 0 var(--space-1); line-height: 1;',
}

const meta: Meta = {
  title: '☀️ Morning Dashboard/BigThreeSlot',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Drop zone slot for the Big Three card. Shows empty, dragover, filled, and completed states.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const AllStates: Story = {
  render: () => ({
    template: `
      <div style="${S.wrap}">
        <h3 style="margin: 0; font-size: var(--text-base); color: var(--text-primary);">BigThreeSlot States</h3>

        <!-- Empty -->
        <div style="${S.zone} ${S.zoneEmpty}">
          <span style="${S.num}">1.</span>
          <span style="${S.placeholder}">Top priority</span>
        </div>

        <!-- Dragover -->
        <div style="${S.zone} ${S.zoneDragover}">
          <span style="${S.num}">2.</span>
          <span style="${S.dropHint}">Drop here</span>
        </div>

        <!-- Filled -->
        <div style="${S.zone} ${S.zoneFilled}">
          <span style="${S.num}">1.</span>
          <span style="${S.title}">Deploy production hotfix</span>
          <button style="${S.clearBtn}">&times;</button>
        </div>

        <!-- Completed -->
        <div style="${S.zone} ${S.zoneCompleted}">
          <span style="${S.num}">3.</span>
          <span style="${S.titleDone}">Review team PRs</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="var(--brand-primary)" stroke-width="1.5" />
            <path d="M5 8l2 2 4-4" stroke="var(--brand-primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
      </div>
    `,
  }),
}

export const EmptySlots: Story = {
  render: () => ({
    template: `
      <div style="${S.wrap}">
        <div style="${S.zone} ${S.zoneEmpty}">
          <span style="${S.num}">1.</span>
          <span style="${S.placeholder}">Top priority</span>
        </div>
        <div style="${S.zone} ${S.zoneEmpty}">
          <span style="${S.num}">2.</span>
          <span style="${S.placeholder}">Second focus</span>
        </div>
        <div style="${S.zone} ${S.zoneEmpty}">
          <span style="${S.num}">3.</span>
          <span style="${S.placeholder}">One more thing</span>
        </div>
      </div>
    `,
  }),
}
