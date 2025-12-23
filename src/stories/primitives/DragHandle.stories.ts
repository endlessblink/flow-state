import DragHandle from '@/components/DragHandle.vue'

const meta = {
  title: '🧩 Primitives/DragHandle',
  component: DragHandle,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  }
}

export default meta

export const Default = {
  args: {
    active: false
  }
}

export const Active = {
  args: {
    active: true
  }
}
