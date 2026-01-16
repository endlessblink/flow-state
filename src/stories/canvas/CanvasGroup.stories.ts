import CanvasGroup from '@/components/canvas/CanvasGroup.vue'

const meta = {
    title: '🎨 Canvas/CanvasGroup',
    component: CanvasGroup,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
    },
    decorators: [
        (story: any) => ({
            components: { story },
            template: `
        <div style="min-height: 500px; width: 100%; padding: 40px; background: var(--app-background-gradient); display: flex; align-items: center; justify-content: center;">
          <div style="position: relative; width: 400px; height: 300px;">
            <story />
          </div>
        </div>
      `
        })
    ],
}

export default meta

export const Default = {
    args: {
        section: {
            id: '1',
            name: 'Test Group',
            type: 'custom',
            position: { x: 0, y: 0, width: 400, height: 300 },
            color: '#4ecdc4',  // Brand teal color - matches design system
            layout: 'grid',
            isVisible: true,
            isCollapsed: false,
            isPowerMode: false
        },
        tasks: [],
        isActive: false
    }
}
