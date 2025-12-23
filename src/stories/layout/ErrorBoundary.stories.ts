import ErrorBoundary from '@/components/ErrorBoundary.vue'

const meta = {
  title: 'Layout/ErrorBoundary',
  component: ErrorBoundary,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  }
}

export default meta

export const Default = {
  render: () => ({
    components: { ErrorBoundary },
    template: '<ErrorBoundary><div>Content</div></ErrorBoundary>'
  })
}
