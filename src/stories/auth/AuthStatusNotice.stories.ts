import type { Meta, StoryObj } from '@storybook/vue3'
import AuthStatusNotice from '@/components/ui/AuthStatusNotice.vue'

const meta = {
    component: AuthStatusNotice,
    title: '🔐 Auth/AuthStatusNotice',
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
    }
} satisfies Meta<typeof AuthStatusNotice>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
    render: () => ({
        components: { AuthStatusNotice },
        template: '<AuthStatusNotice />'
    })
}
