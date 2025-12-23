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
        template: '<div style="width: 100%; min-height: 200px; background: var(--app-background-gradient); transform: scale(1); border-radius: var(--radius-lg); overflow: hidden;"><LocalModeBanner /></div>'
    })
}
