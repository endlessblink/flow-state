import type { Meta, StoryObj } from '@storybook/vue3'
import UserProfile from '@/components/auth/UserProfile.vue'
import { ref } from 'vue'

const meta: Meta<typeof UserProfile> = {
  title: '🔐 Auth/UserProfile',
  component: UserProfile,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      story: {
        inline: true,
      }
    }
  },
  decorators: [
    () => ({
      template: `
        <div class="story-container" style="
          background: var(--glass-bg-solid);
          height: 800px;
          position: relative;
          overflow-y: auto;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 2rem;
        ">
          <story />
        </div>
      `
    })
  ]
}

export default meta
type Story = StoryObj<typeof UserProfile>

export const Default: Story = {
  args: {
    user: {
      id: '1',
      email: 'user@example.com',
      displayName: 'John Doe',
      photoURL: 'https://picsum.photos/seed/user1/100/100.jpg',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    },
    onEdit: () => console.log('Edit profile'),
    onLogout: () => console.log('Logout'),
    onPasswordChange: () => console.log('Change password')
  }
}

export const WithPhoto: Story = {
  args: {
    user: {
      id: '2',
      email: 'jane@example.com',
      displayName: 'Jane Smith',
      photoURL: 'https://picsum.photos/seed/user2/150/150.jpg',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    },
    onEdit: () => console.log('Edit profile'),
    onLogout: () => console.log('Logout'),
    onPasswordChange: () => console.log('Change password')
  }
}

export const WithoutPhoto: Story = {
  args: {
    user: {
      id: '3',
      email: 'bob@example.com',
      displayName: 'Bob Johnson',
      photoURL: '',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    },
    onEdit: () => console.log('Edit profile'),
    onLogout: () => console.log('Logout'),
    onPasswordChange: () => console.log('Change password')
  }
}

export const LongDisplayName: Story = {
  args: {
    user: {
      id: '4',
      email: 'longname@example.com',
      displayName: 'This is a very long display name that should wrap properly in the profile',
      photoURL: 'https://picsum.photos/seed/user4/100/100.jpg',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    },
    onEdit: () => console.log('Edit profile'),
    onLogout: () => console.log('Logout'),
    onPasswordChange: () => console.log('Change password')
  }
}

export const Loading: Story = {
  args: {
    user: null,
    onEdit: () => console.log('Edit profile'),
    onLogout: () => console.log('Logout'),
    onPasswordChange: () => console.log('Change password')
  }
}

export const Interactive: Story = {
  args: {
    user: {
      id: '5',
      email: 'interactive@example.com',
      displayName: 'Interactive User',
      photoURL: 'https://picsum.photos/seed/user5/100/100.jpg',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    },
    onEdit: () => console.log('Edit profile clicked'),
    onLogout: () => console.log('Logout clicked'),
    onPasswordChange: () => console.log('Change password clicked')
  }
}
