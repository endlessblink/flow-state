import SignupForm from '@/components/auth/SignupForm.vue'

const meta = {
  title: '🔐 Auth/SignupForm',
  component: SignupForm,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  }
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
