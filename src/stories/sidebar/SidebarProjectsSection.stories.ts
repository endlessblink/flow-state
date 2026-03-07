import type { Meta, StoryObj } from '@storybook/vue3'
import { FolderOpen, Plus, Layers, ChevronRight } from 'lucide-vue-next'

const S = {
  sidebar: 'width: 260px; background: var(--glass-bg-medium); border-radius: var(--radius-lg); padding: var(--space-4);',
  divider: 'height: 1px; background: linear-gradient(90deg, rgba(255,255,255,0) 0%, var(--glass-bg-heavy) 50%, rgba(255,255,255,0) 100%); margin-bottom: var(--space-4);',
  sectionHeader: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);',
  sectionTitle: 'display: flex; align-items: center; gap: var(--space-2); color: var(--text-muted); font-size: var(--text-xs); font-weight: var(--font-semibold); letter-spacing: 0.05em; text-transform: uppercase;',
  addBtn: 'background: transparent; border: 1px solid var(--border-medium); color: var(--text-muted); padding: var(--space-1); border-radius: var(--radius-sm); cursor: pointer; display: flex; align-items: center;',
  navItem: 'display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--text-sm); color: var(--text-secondary); cursor: pointer; transition: all 0.15s ease;',
  navItemActive: 'display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--text-sm); color: var(--brand-primary); cursor: pointer; background: rgba(78, 205, 196, 0.06); border: 1px solid rgba(78, 205, 196, 0.2);',
  projectIcon: 'font-size: 1rem; flex-shrink: 0;',
  chevron: 'margin-inline-start: auto; opacity: 0.5;',
  list: 'display: flex; flex-direction: column; gap: var(--space-1);',
  nested: 'padding-inline-start: var(--space-6);',
  count: 'margin-inline-start: auto; font-size: var(--text-xs); color: var(--text-muted);',
}

const meta: Meta = {
  title: '🏢 Layout/Sidebar/SidebarProjectsSection',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Project tree with "All Projects" option, expandable project items with emoji icons, multi-select support (Ctrl/Shift+click), and keyboard navigation.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { FolderOpen, Plus, Layers, ChevronRight },
    template: `
      <div style="${S.sidebar}">
        <div style="${S.divider}" />
        <div style="${S.sectionHeader}">
          <h3 style="${S.sectionTitle}">
            <FolderOpen :size="16" />
            Projects
          </h3>
          <button style="${S.addBtn}"><Plus :size="14" /></button>
        </div>
        <div style="${S.list}">
          <div style="${S.navItemActive}">
            <Layers :size="16" />
            All Projects
          </div>
          <div style="${S.navItem}">
            <span style="${S.projectIcon}">🚀</span>
            FlowState
            <span style="${S.count}">12</span>
            <ChevronRight :size="14" style="${S.chevron}" />
          </div>
          <div style="${S.navItem}">
            <span style="${S.projectIcon}">📚</span>
            Learning
            <span style="${S.count}">5</span>
          </div>
          <div style="${S.navItem}">
            <span style="${S.projectIcon}">🏠</span>
            Personal
            <span style="${S.count}">8</span>
          </div>
        </div>
      </div>
    `,
  }),
}

export const WithNestedProjects: Story = {
  render: () => ({
    components: { FolderOpen, Plus, Layers, ChevronRight },
    template: `
      <div style="${S.sidebar}">
        <div style="${S.divider}" />
        <div style="${S.sectionHeader}">
          <h3 style="${S.sectionTitle}">
            <FolderOpen :size="16" />
            Projects
          </h3>
          <button style="${S.addBtn}"><Plus :size="14" /></button>
        </div>
        <div style="${S.list}">
          <div style="${S.navItem}">
            <Layers :size="16" />
            All Projects
          </div>
          <div style="${S.navItemActive}">
            <span style="${S.projectIcon}">🚀</span>
            FlowState
            <span style="${S.count}">12</span>
            <ChevronRight :size="14" style="${S.chevron} transform: rotate(90deg);" />
          </div>
          <div style="${S.nested}">
            <div style="${S.list}">
              <div style="${S.navItem}">
                <span style="${S.projectIcon}">🎨</span>
                Frontend
                <span style="${S.count}">7</span>
              </div>
              <div style="${S.navItem}">
                <span style="${S.projectIcon}">⚙️</span>
                Backend
                <span style="${S.count}">5</span>
              </div>
            </div>
          </div>
          <div style="${S.navItem}">
            <span style="${S.projectIcon}">📚</span>
            Learning
            <span style="${S.count}">5</span>
          </div>
        </div>
      </div>
    `,
  }),
}
