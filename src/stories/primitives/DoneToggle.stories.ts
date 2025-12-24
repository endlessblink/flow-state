import DoneToggle from '@/components/DoneToggle.vue'

const meta = {
  title: '🧩 Primitives/DoneToggle',
  component: DoneToggle,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  }
}

export default meta

export const Default = {
  args: {
    modelValue: false,
    size: 'md'
  }
}

export const Completed = {
  args: {
    modelValue: true,
    size: 'md'
  }
}
