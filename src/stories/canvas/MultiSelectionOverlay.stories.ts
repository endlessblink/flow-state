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
  { id: '1', position: { x: 400, y: 250 }, data: { label: 'Task 1' }, type: 'task' },
  { id: '2', position: { x: 650, y: 250 }, data: { label: 'Task 2' }, type: 'task' },
  { id: '3', position: { x: 400, y: 400 }, data: { label: 'Task 3' }, type: 'task' },
]

export const SelectionActive = {
  render: () => ({
    components: { MultiSelectionOverlay },
    setup() {
      const canvasStore = useCanvasStore()
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

export const BulkMenuOpen = {
  render: () => ({
    components: { MultiSelectionOverlay },
    setup() {
      const canvasStore = useCanvasStore()
      canvasStore.multiSelectMode = true
      return { mockNodes }
    },
    template: `
      <div style="position: relative; width: 100%; height: 600px; background: var(--app-background-gradient);">
        <MultiSelectionOverlay
          ref="overlay"
          :nodes="mockNodes"
          :selectedNodeIds="['1', '2', '3']"
        />
        <p style="position: absolute; bottom: var(--space-4); right: var(--space-4); color: var(--text-muted); font-size: var(--text-xs);">
          Bulk actions menu open — click Bulk Actions button to toggle
        </p>
      </div>
    `,
  }),
}

export const NoSelection = {
  render: () => ({
    components: { MultiSelectionOverlay },
    setup() {
      const canvasStore = useCanvasStore()
      canvasStore.multiSelectMode = true
      return { mockNodes }
    },
    template: `
      <div style="position: relative; width: 100%; height: 500px; background: var(--app-background-gradient);">
        <MultiSelectionOverlay
          :nodes="mockNodes"
          :selectedNodeIds="[]"
        />
        <p style="position: absolute; bottom: var(--space-4); right: var(--space-4); color: var(--text-muted); font-size: var(--text-xs);">
          Selection mode active with no nodes selected — controls panel shows mode and actions only
        </p>
      </div>
    `,
  }),
}
