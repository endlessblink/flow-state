import SignupForm from '@/components/auth/SignupForm.vue'

const meta = {
  title: '🔐 Auth/SignupForm',
  component: SignupForm,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="padding: 40px; background: var(--app-background-gradient); border-radius: 12px; min-width: 400px;">
          <story />
        </div>
      `
    })
  ],
}

export default meta

export const Default = {
  args: {
    loading: false
  }
}

export const Loading = {
  args: {
    loading: true
  }
}
