import ResetPasswordView from '@/components/auth/ResetPasswordView.vue'

const meta = {
  title: 'Auth/ResetPasswordView',
  component: ResetPasswordView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

export const Default = {
  render: () => ({
    components: { ResetPasswordView },
    template: '<ResetPasswordView />',
  }),
}
