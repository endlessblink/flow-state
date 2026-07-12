import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NoteNode from '@/components/mini-canvas/NoteNode.vue'
import SubtaskNode from '@/components/mini-canvas/SubtaskNode.vue'

const global = {
  stubs: {
    Handle: true,
  },
}

describe('mini-canvas node autosave', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('autosaves note content while typing', async () => {
    vi.useFakeTimers()

    const wrapper = mount(NoteNode, {
      global,
      props: {
        data: {
          noteId: 'note-1',
          title: 'Original title',
          description: 'Original description',
        },
      },
    })

    await wrapper.find('.note-content').setValue('Draft that should persist')
    expect(wrapper.emitted('update-description')).toBeUndefined()

    await vi.advanceTimersByTimeAsync(250)

    expect(wrapper.emitted('update-description')).toEqual([
      ['note-1', 'Draft that should persist'],
    ])
  })

  it('flushes pending note edits when unmounted without blur', async () => {
    vi.useFakeTimers()

    const wrapper = mount(NoteNode, {
      global,
      props: {
        data: {
          noteId: 'note-1',
          title: 'Original title',
          description: 'Original description',
        },
      },
    })

    await wrapper.find('.note-title').setValue('Unsaved title')
    wrapper.unmount()

    expect(wrapper.emitted('update-title')).toEqual([
      ['note-1', 'Unsaved title'],
    ])
  })

  it('autosaves subtask fields and allows empty titles', async () => {
    vi.useFakeTimers()

    const wrapper = mount(SubtaskNode, {
      global,
      props: {
        data: {
          subtaskId: 'subtask-1',
          title: 'Original title',
          description: 'Original description',
          isCompleted: false,
        },
      },
    })

    await wrapper.find('.subtask-title').setValue('')
    await wrapper.find('.subtask-description').setValue('Autosaved details')
    await vi.advanceTimersByTimeAsync(250)

    expect(wrapper.emitted('update-title')).toEqual([
      ['subtask-1', ''],
    ])
    expect(wrapper.emitted('update-description')).toEqual([
      ['subtask-1', 'Autosaved details'],
    ])
  })

  it.each([
    ['subtask', SubtaskNode, '.subtask-title', {
      subtaskId: 'subtask-1',
      title: 'Original title',
      description: '',
      isCompleted: false,
    }],
    ['note', NoteNode, '.note-title', {
      noteId: 'note-1',
      title: 'Original title',
      description: '',
    }],
  ])('preserves a trailing space while autosaving a %s title', async (_kind, component, selector, data) => {
    vi.useFakeTimers()

    const wrapper = mount(component, {
      global,
      props: { data },
    })

    await wrapper.find(selector).setValue('Two words ')
    await vi.advanceTimersByTimeAsync(250)

    expect(wrapper.emitted('update-title')).toEqual([
      [data.subtaskId ?? data.noteId, 'Two words '],
    ])
  })
})
