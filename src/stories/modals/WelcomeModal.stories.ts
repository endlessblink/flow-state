import WelcomeModal from '@/components/ui/WelcomeModal.vue'

const meta = {
    title: 'Modals/WelcomeModal',
    component: WelcomeModal,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
    },
    decorators: [
        (story: any) => ({
            components: { story },
            template: `
        <div style="min-height: 100vh; width: 100%; display: flex; align-items: center; justify-content: center; background: var(--app-background-gradient);">
          <story />
        </div>
      `
        })
    ],
}

export default meta

export const Default = {
    render: () => ({
        components: { WelcomeModal },
        template: '<WelcomeModal />'
    })
}
