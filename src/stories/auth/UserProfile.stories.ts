import UserProfile from '@/components/auth/UserProfile.vue'

const meta = {
  title: '🔐 Auth/UserProfile',
  component: UserProfile,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  }
}

export default meta

export const Default = {
  args: {
    user: {
      name: 'John Doe',
      email: 'john@example.com',
      avatar: ''
    }
  }
}
