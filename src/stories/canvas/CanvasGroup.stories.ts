import CanvasGroup from '@/components/canvas/CanvasGroup.vue'

const meta = {
    title: '🎨 Canvas/CanvasGroup',
    component: CanvasGroup,
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
    }
}

export default meta

export const Default = {
    args: {
        section: {
            id: '1',
            name: 'Test Group',
            type: 'custom',
            position: { x: 0, y: 0, width: 400, height: 300 },
            color: '#3b82f6',
            layout: 'grid',
            isVisible: true,
            isCollapsed: false,
            isPowerMode: false
        },
        tasks: [],
        isActive: false
    }
}
