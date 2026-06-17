import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reactive, nextTick } from 'vue'
import type { Task } from '@/stores/tasks'

// Minimal store mock — useTaskEditState only reads taskStore.tasks (isOpen watcher).
const tasks: Task[] = []
vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => ({ tasks })
}))

import { useTaskEditState } from '../useTaskEditState'

/**
 * BUG-1872: Task description "keeps resetting" while editing.
 *
 * Root cause: the TipTap markdown converter is not byte-stable, so an echo of the
 * autosave (a new props.task reference whose description differs only by normalization)
 * was overwriting editedTask.description mid-edit, which reset the editor. After autosave
 * calls markCurrentTaskSaved(), isFormDirty is false, so the dirty-guard no longer blocks
 * the overwrite — this is the hole.
 *
 * Fix: while the modal owns this task, the in-editor description is authoritative and an
 * incoming props.task must NOT replace it.
 */
function makeTask(over: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Title',
    description: '- one\n\n- two',
    status: 'todo',
    priority: 'medium',
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: '',
    scheduledDate: '',
    scheduledTime: '09:00',
    estimatedDuration: 60,
    projectId: '',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...over
  } as Task
}

describe('useTaskEditState — description reset guard (BUG-1872)', () => {
  beforeEach(() => { tasks.length = 0; localStorage.clear() })

  it('does not overwrite the in-editor description when an echo arrives normalized', async () => {
    const props = reactive({ isOpen: true, task: makeTask() })
    const { editedTask, markCurrentTaskSaved } = useTaskEditState(props)
    await nextTick()

    // User edits the description in the open modal.
    editedTask.value.description = '- one\n\n- two\n- three'
    // Autosave persisted it and marked the task saved → isFormDirty is now false (the hole).
    markCurrentTaskSaved()

    // Echo of the save arrives: same task id, but description drifted via the lossy converter.
    props.task = makeTask({ description: '- one\n\n\n- two\n\n\n- three', updatedAt: new Date('2026-01-02') })
    await nextTick()

    // The editor's content must survive untouched.
    expect(editedTask.value.description).toBe('- one\n\n- two\n- three')
  })

  it('still applies a fresh task when a different task is opened', async () => {
    const props = reactive({ isOpen: true, task: makeTask({ id: 't1', description: 'A' }) })
    const { editedTask } = useTaskEditState(props)
    await nextTick()
    expect(editedTask.value.id).toBe('t1')

    props.task = makeTask({ id: 't2', description: 'B' })
    await nextTick()
    expect(editedTask.value.id).toBe('t2')
    expect(editedTask.value.description).toBe('B')
  })
})

describe('useTaskEditState — local draft fallback (TASK-1873, "can\'t get lost again")', () => {
  beforeEach(() => { tasks.length = 0; localStorage.clear() })

  it('restores unsaved typed text after a simulated crash/reload', async () => {
    tasks.push(makeTask({ id: 't1', description: 'server value' }))

    // Session 1: open, type, but app dies before any save (no markCurrentTaskSaved).
    const props1 = reactive({ isOpen: false, task: makeTask({ id: 't1', description: 'server value' }) })
    const s1 = useTaskEditState(props1)
    props1.isOpen = true
    await nextTick()
    s1.editedTask.value.description = 'half-typed unsaved text'
    await nextTick() // draft persisted to localStorage

    // Session 2: fresh composable (reload). Store still has the OLD server value.
    const props2 = reactive({ isOpen: false, task: makeTask({ id: 't1', description: 'server value' }) })
    const s2 = useTaskEditState(props2)
    props2.isOpen = true
    await nextTick()

    // The recovered draft wins, AND it reads as dirty so autosave will persist it.
    expect(s2.editedTask.value.description).toBe('half-typed unsaved text')
    expect(s2.isFormDirty.value).toBe(true)
  })

  it('clears the draft once a save confirms (no stale restore later)', async () => {
    tasks.push(makeTask({ id: 't1', description: 'server value' }))
    const props1 = reactive({ isOpen: false, task: makeTask({ id: 't1', description: 'server value' }) })
    const s1 = useTaskEditState(props1)
    props1.isOpen = true
    await nextTick()
    s1.editedTask.value.description = 'saved text'
    await nextTick()
    s1.markCurrentTaskSaved() // save confirmed → draft cleared

    // Update the "server" to match what was saved, then reopen fresh.
    tasks[0].description = 'saved text'
    const props2 = reactive({ isOpen: false, task: makeTask({ id: 't1', description: 'saved text' }) })
    const s2 = useTaskEditState(props2)
    props2.isOpen = true
    await nextTick()

    expect(s2.editedTask.value.description).toBe('saved text')
    expect(localStorage.getItem('flowstate:desc-draft:t1')).toBeNull()
  })
})
