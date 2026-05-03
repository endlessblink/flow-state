/**
 * TASK-1773 (slice 2): floating toolbar on selected mini-canvas node.
 * Validates conditional render, button counts per node type, and emit wiring.
 *
 * NodeToolbar from @vue-flow/node-toolbar requires VueFlowProvider context to
 * mount, which is brittle in unit tests. We stub it with a transparent passthrough
 * so the inner toolbar UI is testable in isolation.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, defineComponent } from 'vue'
import MiniCanvasFloatingToolbar from '@/components/mini-canvas/MiniCanvasFloatingToolbar.vue'

const NodeToolbarStub = defineComponent({
  name: 'NodeToolbar',
  props: ['nodeId', 'isVisible', 'position', 'offset'],
  setup(_, { slots }) {
    return () => h('div', { 'data-stub': 'node-toolbar' }, slots.default ? slots.default() : [])
  },
})

const mountToolbar = (props: Record<string, unknown>) => mount(MiniCanvasFloatingToolbar, {
  props,
  global: {
    stubs: { NodeToolbar: NodeToolbarStub },
  },
})

describe('MiniCanvasFloatingToolbar', () => {
  it('renders nothing when nodeId is null', () => {
    const wrapper = mountToolbar({ nodeId: null, nodeType: null })
    expect(wrapper.find('[role="toolbar"]').exists()).toBe(false)
  })

  it('renders 4 buttons for subtaskNode (toggle, edit, add, delete)', () => {
    const wrapper = mountToolbar({ nodeId: 'subtask-1', nodeType: 'subtaskNode' })
    const toolbar = wrapper.find('[role="toolbar"]')
    expect(toolbar.exists()).toBe(true)
    expect(toolbar.attributes('aria-label')).toBe('Selected node actions')
    expect(wrapper.findAll('button').length).toBe(4)
  })

  it('renders 3 buttons for noteNode (edit, add, delete — no toggle)', () => {
    const wrapper = mountToolbar({ nodeId: 'note-1', nodeType: 'noteNode' })
    expect(wrapper.findAll('button').length).toBe(3)
  })

  it('emits the right event for each button click on a subtaskNode', async () => {
    const wrapper = mountToolbar({ nodeId: 'subtask-1', nodeType: 'subtaskNode' })
    const buttons = wrapper.findAll('button')
    await buttons[0].trigger('click') // toggle-complete
    await buttons[1].trigger('click') // edit
    await buttons[2].trigger('click') // add-child
    await buttons[3].trigger('click') // delete

    expect(wrapper.emitted('toggle-complete')).toHaveLength(1)
    expect(wrapper.emitted('edit')).toHaveLength(1)
    expect(wrapper.emitted('add-child')).toHaveLength(1)
    expect(wrapper.emitted('delete')).toHaveLength(1)
  })

  it('emits edit/add-child/delete for a noteNode (no toggle button rendered)', async () => {
    const wrapper = mountToolbar({ nodeId: 'note-1', nodeType: 'noteNode' })
    const buttons = wrapper.findAll('button')
    await buttons[0].trigger('click') // edit
    await buttons[1].trigger('click') // add-child
    await buttons[2].trigger('click') // delete

    expect(wrapper.emitted('toggle-complete')).toBeUndefined()
    expect(wrapper.emitted('edit')).toHaveLength(1)
    expect(wrapper.emitted('add-child')).toHaveLength(1)
    expect(wrapper.emitted('delete')).toHaveLength(1)
  })

  it('marks toggle button active when isCompleted is true', () => {
    const wrapper = mountToolbar({
      nodeId: 'subtask-1',
      nodeType: 'subtaskNode',
      isCompleted: true,
    })
    const toggleBtn = wrapper.findAll('button')[0]
    // BaseIconButton applies an `is-active` class when active prop is true
    expect(toggleBtn.classes()).toContain('is-active')
  })
})
