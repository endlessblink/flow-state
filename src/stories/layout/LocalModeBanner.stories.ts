import type { Meta, StoryObj } from '@storybook/vue3'
import LocalModeBanner from '@/components/ui/LocalModeBanner.vue'

const meta = {
    component: LocalModeBanner,
    title: '🏢 Layout/LocalModeBanner',
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
    }
} satisfies Meta<typeof LocalModeBanner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
    render: () => ({
        components: { LocalModeBanner },
        template: '<div style="width: 100vw; height: 100vh; background: var(--app-background-gradient);"><LocalModeBanner /></div>'
    })
}
