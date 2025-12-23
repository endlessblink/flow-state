import WelcomeModal from '@/components/ui/WelcomeModal.vue'

const meta = {
    title: 'Modals/WelcomeModal',
    component: WelcomeModal,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
    }
}

export default meta

export const Default = {
    render: () => ({
        components: { WelcomeModal },
        template: '<WelcomeModal />'
    })
}
