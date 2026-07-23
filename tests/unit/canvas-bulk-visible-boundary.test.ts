import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Node } from '@vue-flow/core'
import MultiSelectionOverlay from '@/components/canvas/MultiSelectionOverlay.vue'
import { useCanvasStore } from '@/stores/canvas'

const node = (id: string) => ({
  id,
  position: { x: 0, y: 0 },
  data: {},
}) as Node

describe('Canvas bulk action visibility boundary', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('never emits ids that are absent from the rendered node set', async () => {
    const canvasStore = useCanvasStore()
    canvasStore.multiSelectMode = true
    const wrapper = mount(MultiSelectionOverlay, {
      props: {
        nodes: [node('visible')],
        selectedNodeIds: ['visible', 'hidden-stale'],
      },
    })

    expect(wrapper.get('.selected-count').text()).toBe('1 selected')
    await wrapper.get('.bulk-menu-btn').trigger('click')
    const done = wrapper.findAll('.bulk-menu-item').find(button => button.text() === 'Done')
    expect(done).toBeDefined()
    await done!.trigger('click')

    expect(wrapper.emitted('bulkAction')).toEqual([
      ['updateStatus', { nodeIds: ['visible'], status: 'done' }],
    ])
  })
})
