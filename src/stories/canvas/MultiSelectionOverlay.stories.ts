/**
 * MultiSelectionOverlay depends heavily on canvasStore state (multiSelectMode, selectionRect)
 * which can't be easily mocked in Storybook. The component only renders when
 * canvasStore.multiSelectMode is true OR canvasStore.selectionRect is set.
 *
 * This story demonstrates the component's selection controls panel in isolation
 * by forcing the store state.
 */
import MultiSelectionOverlay from '@/components/canvas/MultiSelectionOverlay.vue'
import { useCanvasStore } from '@/stores/canvas'

const meta = {
  title: '🎨 Canvas/MultiSelectionOverlay',
  component: MultiSelectionOverlay,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

const mockNodes = [
  { id: '1', position: { x: 50, y: 50 }, data: { label: 'Task 1' }, type: 'task' },
  { id: '2', position: { x: 300, y: 50 }, data: { label: 'Task 2' }, type: 'task' },
  { id: '3', position: { x: 50, y: 200 }, data: { label: 'Task 3' }, type: 'task' },
]

export const SelectionActive = {
  render: () => ({
    components: { MultiSelectionOverlay },
    setup() {
      const canvasStore = useCanvasStore()
      // Force multi-select mode on so the overlay renders
      canvasStore.multiSelectMode = true
      return { mockNodes }
    },
    template: `
      <div style="position: relative; width: 100%; height: 500px; background: var(--app-background-gradient);">
        <MultiSelectionOverlay
          :nodes="mockNodes"
          :selectedNodeIds="['1', '2']"
        />
        <p style="position: absolute; bottom: var(--space-4); right: var(--space-4); color: var(--text-muted); font-size: var(--text-xs);">
          Multi-select mode active — selection controls panel visible top-left
        </p>
      </div>
    `,
  }),
}
