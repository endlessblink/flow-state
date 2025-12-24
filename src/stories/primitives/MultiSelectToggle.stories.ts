import MultiSelectToggle from '@/components/common/MultiSelectToggle.vue'

const meta = {
  title: '🧩 Primitives/MultiSelectToggle',
  component: MultiSelectToggle,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  }
}

export default meta

export const Default = {
  args: {
    active: false,
    count: 0
  }
}

export const Active = {
  args: {
    active: true,
    count: 5
  }
}
