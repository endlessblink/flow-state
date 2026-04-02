import type { Meta, StoryObj } from '@storybook/vue3'
import { Settings } from 'lucide-vue-next'

const S = {
  sidebar: 'width: 260px; background: var(--glass-bg-medium); border-radius: var(--radius-lg); display: flex; flex-direction: column; min-height: 200px;',
  footer: 'margin-top: auto; padding: var(--space-4); border-top: 1px solid var(--glass-border); background: var(--glass-bg-soft);',
  loginBtn: 'width: 100%; padding: var(--space-2_5); background: var(--glass-bg-soft); color: var(--brand-primary); border: 1px solid var(--state-hover-border); border-radius: var(--radius-md); cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: var(--text-sm);',
  profileRow: 'display: flex; align-items: center; gap: var(--space-2_5); padding: var(--space-1);',
  avatar: 'width: 32px; height: 32px; background: var(--brand-primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--text-primary); font-weight: bold; font-size: var(--text-sm); flex-shrink: 0;',
  infoCol: 'flex: 1; display: flex; flex-direction: column; overflow: hidden;',
  email: 'font-size: var(--text-sm); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary);',
  status: 'font-size: var(--text-xs); color: var(--color-success);',
  settingsBtn: 'background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: var(--space-1); border-radius: var(--radius-sm);',
}

const meta: Meta = {
  title: '🏢 Layout/Sidebar/SidebarUserFooter',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Bottom section of the sidebar showing sign-in button (logged out) or user avatar, email, online status, and settings icon (logged in).',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const LoggedIn: Story = {
  render: () => ({
    components: { Settings },
    template: `
      <div style="${S.sidebar}">
        <div style="${S.footer}">
          <div style="${S.profileRow}">
            <div style="${S.avatar}">J</div>
            <div style="${S.infoCol}">
              <span style="${S.email}">john@example.com</span>
              <span style="${S.status}">Online</span>
            </div>
            <button style="${S.settingsBtn}"><Settings :size="16" /></button>
          </div>
        </div>
      </div>
    `,
  }),
}

export const LoggedOut: Story = {
  render: () => ({
    template: `
      <div style="${S.sidebar}">
        <div style="${S.footer}">
          <button style="${S.loginBtn}">Sign In</button>
        </div>
      </div>
    `,
  }),
}
