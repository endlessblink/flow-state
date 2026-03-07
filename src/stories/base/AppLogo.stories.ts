import type { Meta, StoryObj } from '@storybook/vue3'
import AppLogo from '@/components/base/AppLogo.vue'

const meta: Meta<typeof AppLogo> = {
  title: '🧩 Primitives/AppLogo',
  component: AppLogo,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
    },
    round: {
      control: 'boolean',
    },
  },
}
export default meta
type Story = StoryObj<typeof AppLogo>

export const Default: Story = {
  args: { size: 'md' },
}

export const AllSizes: Story = {
  render: () => ({
    components: { AppLogo },
    template: `
      <div style="display:flex;align-items:center;gap:16px;padding:16px;background:var(--bg-primary);border-radius:var(--radius-lg)">
        <div style="text-align:center"><AppLogo size="xs" /><div style="font-size:10px;color:var(--text-tertiary);margin-top:4px">xs (16px)</div></div>
        <div style="text-align:center"><AppLogo size="sm" /><div style="font-size:10px;color:var(--text-tertiary);margin-top:4px">sm (24px)</div></div>
        <div style="text-align:center"><AppLogo size="md" /><div style="font-size:10px;color:var(--text-tertiary);margin-top:4px">md (32px)</div></div>
        <div style="text-align:center"><AppLogo size="lg" /><div style="font-size:10px;color:var(--text-tertiary);margin-top:4px">lg (48px)</div></div>
        <div style="text-align:center"><AppLogo size="xl" /><div style="font-size:10px;color:var(--text-tertiary);margin-top:4px">xl (64px)</div></div>
      </div>
    `,
  }),
}

export const Round: Story = {
  args: { size: 'lg', round: true },
}
