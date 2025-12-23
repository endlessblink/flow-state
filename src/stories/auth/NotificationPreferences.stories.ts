import NotificationPreferences from '@/components/notifications/NotificationPreferences.vue'

const meta = {
    title: '🔐 Auth/NotificationPreferences',
    component: NotificationPreferences,
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
    }
}

export default meta

export const Default = {
    args: {
        taskId: 'mock-task-1'
    }
}
