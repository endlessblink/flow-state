/**
 * BUG-2115: the shared Canvas order sections were a lazy computed that was
 * re-evaluated hundreds of times per task reload (every evaluation re-sorts all
 * date buckets), pinning a CPU core even when FlowState ran hidden. They must be
 * rebuilt once per change, while still following group and task edits.
 */
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '@/types/tasks'

const buildSpy = vi.hoisted(() => ({ calls: 0 }))
vi.mock('@/utils/canvas/canvasSequence', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/canvas/canvasSequence')>()
  return {
    ...actual,
    buildCanvasSequenceSections: (...args: Parameters<typeof actual.buildCanvasSequenceSections>) => {
      buildSpy.calls++
      return actual.buildCanvasSequenceSections(...args)
    },
  }
})

import { useCanvasStore } from '@/stores/canvas'
import { sharedTasksRef } from '@/stores/canvasTaskBridge'
import { getSharedOrderSection, sortTasksBySharedOrder } from '@/utils/taskOrdering'

const today = new Date().toISOString().slice(0, 10)
const makeTasks = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `t${i}`,
    title: `t${i}`,
    order: count - i,
    status: 'planned',
    dueDate: i % 2 ? today : undefined,
    parentId: i % 3 === 0 ? 'later' : undefined,
  })) as unknown as Task[]

describe('BUG-2115: shared order sections rebuild once per change', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sharedTasksRef.value = []
  })

  it('does not rebuild per sort or per comparison after a task reload', async () => {
    const store = useCanvasStore()
    store.setGroups([
      { id: 'today', name: 'Today', position: { x: 0, y: 0, width: 400, height: 900 }, isVisible: true },
      { id: 'later', name: 'Later', position: { x: 500, y: 0, width: 400, height: 900 }, isVisible: true },
    ] as never)
    await nextTick()

    sharedTasksRef.value = makeTasks(300)
    await nextTick()
    buildSpy.calls = 0

    // A reload replaces the task list; many views then sort it in the same tick.
    sharedTasksRef.value = makeTasks(300)
    for (let i = 0; i < 25; i++) sortTasksBySharedOrder(sharedTasksRef.value)
    await nextTick()
    for (let i = 0; i < 25; i++) sortTasksBySharedOrder(sharedTasksRef.value)

    expect(buildSpy.calls).toBeLessThanOrEqual(1)
  })

  it('still follows a task moving into a group', async () => {
    const store = useCanvasStore()
    store.setGroups([
      { id: 'later', name: 'Later', position: { x: 500, y: 0, width: 400, height: 900 }, isVisible: true },
    ] as never)
    sharedTasksRef.value = [{ id: 'a', title: 'a', order: 1, status: 'planned' }] as unknown as Task[]
    await nextTick()
    expect(getSharedOrderSection(sharedTasksRef.value[0])).toBeUndefined()

    sharedTasksRef.value[0].parentId = 'later'
    await nextTick()
    expect(getSharedOrderSection(sharedTasksRef.value[0])?.key).toBe('later')
  })
})
