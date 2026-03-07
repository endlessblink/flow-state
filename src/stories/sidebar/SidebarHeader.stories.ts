import type { Meta, StoryObj } from '@storybook/vue3'
import { Plus, PanelLeftClose, Settings } from 'lucide-vue-next'

const S = {
  sidebar: 'width: 260px; background: var(--glass-bg-medium); border-radius: var(--radius-lg); overflow: hidden;',
  header: 'padding: var(--space-10) var(--space-6) var(--space-6) var(--space-6); background: var(--glass-bg-medium);',
  brand: 'display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-6);',
  brandIcon: 'width: 28px; height: 28px; background: linear-gradient(135deg, var(--brand-primary), rgba(78, 205, 196, 0.5)); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; color: var(--text-primary);',
  brandText: 'font-size: var(--text-lg); font-weight: var(--font-semibold); color: var(--text-primary);',
  createBtn: 'width: 100%; padding: var(--space-2_5) var(--space-4); background: var(--glass-bg-soft); color: var(--text-secondary); border: 1px solid var(--border-medium); border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: var(--font-medium); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: var(--space-2); backdrop-filter: blur(8px);',
  iconRow: 'display: flex; gap: var(--space-2); margin-top: var(--space-2);',
  iconBtn: 'background: transparent; border: 1px solid var(--border-medium); color: var(--text-secondary); width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md); cursor: pointer;',
}

const meta: Meta = {
  title: '🏢 Layout/Sidebar/SidebarHeader',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Top section of the sidebar with app logo, "Create Project" button, and icon buttons for hide sidebar and settings.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { Plus, PanelLeftClose, Settings },
    template: `
      <div style="${S.sidebar}">
        <div style="${S.header}">
          <div style="${S.brand}">
            <div style="${S.brandIcon}">FS</div>
            <span style="${S.brandText}">FlowState</span>
          </div>
          <button style="${S.createBtn}">
            <Plus :size="14" />
            Create Project
          </button>
          <div style="${S.iconRow}">
            <button style="${S.iconBtn}" title="Hide sidebar">
              <PanelLeftClose :size="18" />
            </button>
            <button style="${S.iconBtn}" title="Settings">
              <Settings :size="18" />
            </button>
          </div>
        </div>
      </div>
    `,
  }),
}
