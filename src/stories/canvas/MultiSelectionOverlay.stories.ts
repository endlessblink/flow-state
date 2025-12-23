import MultiSelectionOverlay from '@/components/canvas/MultiSelectionOverlay.vue'

const meta = {
  title: 'Canvas/MultiSelectionOverlay',
  component: MultiSelectionOverlay,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  }
}

export default meta

export const Default = {
  args: {
    selectedTaskIds: ['1', '2']
  }
}
