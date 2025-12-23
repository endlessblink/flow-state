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
    template: '<div style="padding: 40px; background: var(--app-background-gradient); min-height: 200px;"><ErrorBoundary><div>Content</div></ErrorBoundary></div>'
  })
}
