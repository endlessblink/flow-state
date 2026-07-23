import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Node } from '@vue-flow/core'
import { useCanvasStore } from '@/stores/canvas'
import { useCanvasSelection } from '@/composables/canvas/useCanvasSelection'

vi.mock('@/composables/canvas/useCanvasCore', () => ({
  useCanvasCore: () => ({ getNodes: ref([]) }),
}))

const node = (id: string) => ({
  id,
  position: { x: 0, y: 0 },
  data: {},
}) as Node

describe('Canvas hidden selection safety', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('removes selected ids when their rendered nodes disappear', async () => {
    const nodes = ref<Node[]>([node('visible'), node('becomes-hidden')])
    const canvasStore = useCanvasStore()
    const Harness = defineComponent({
      setup() {
        useCanvasSelection({ nodes, applyNodeChanges: vi.fn() })
        return () => h('div')
      },
    })
    const wrapper = mount(Harness)
    canvasStore.setSelectedNodes(['visible', 'becomes-hidden'])

    nodes.value = [node('visible')]
    await nextTick()

    expect(canvasStore.selectedNodeIds).toEqual(['visible'])
    wrapper.unmount()
  })
})
