import type { Meta, StoryObj } from '@storybook/vue3'
import WelcomeModal from '@/components/ui/WelcomeModal.vue'
import mockUseLocalAuthStore from '../helpers/mockUseLocalAuthStore'

// Mock the store for the component
// Since the component uses the real store import, we might need a decorator 
// or hope that Provide/Inject or manual override works if the component allows it.
// However, in this Storybook setup, we usually mock the module in vite.config or
// use a decorator that overrides the store.

const meta = {
    component: WelcomeModal,
    title: '🪟 Modals & Dialogs/WelcomeModal',
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
    }
} satisfies Meta<typeof WelcomeModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
    args: {
        isOpen: true
    },
    render: (args: any) => ({
        components: { WelcomeModal },
        setup() {
            return { args }
        },
        template: '<WelcomeModal v-bind="args" />'
    })
}
