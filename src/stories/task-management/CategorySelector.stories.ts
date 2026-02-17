import type { Meta, StoryObj } from '@storybook/vue3'
import CategorySelector from '@/components/layout/CategorySelector.vue'

const meta = {
  component: CategorySelector,
  title: '📝 Task Management/CategorySelector',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0f172a' },
      ],
    },
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="padding: 100px; background: var(--app-background-gradient); min-height: 300px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-xl);">
          <story />
        </div>
      `
    })
  ],
} satisfies Meta<typeof CategorySelector>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { CategorySelector },
    template: `
        <CategorySelector />
      `
  })
}
