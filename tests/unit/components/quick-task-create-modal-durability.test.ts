import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => ({ projects: [], activeProjectId: null })
}))
vi.mock('@/composables/useHebrewAlignment', () => ({
  useHebrewAlignment: () => ({
    getAlignmentClasses: () => [],
    applyInputAlignment: () => ({})
  })
}))
vi.mock('@/composables/useWhisperSpeech', () => ({
  useWhisperSpeech: () => ({
    isRecording: { value: false },
    isProcessing: { value: false },
    isSupported: { value: false },
    hasApiKey: { value: false },
    transcript: { value: '' },
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn()
  })
}))
vi.mock('@/composables/useUrlScraping', () => ({
  useUrlScraping: () => ({
    isScraping: { value: false },
    scrapeIfUrl: vi.fn(),
    cancel: vi.fn()
  })
}))

import QuickTaskCreateModal from '@/components/tasks/QuickTaskCreateModal.vue'

describe('QuickTaskCreateModal durable submit contract', () => {
  it('preserves the draft and blocks duplicate submits until persistence settles', async () => {
    const wrapper = mount(QuickTaskCreateModal, {
      props: { isOpen: true },
      global: {
        stubs: {
          BaseModal: { template: '<div><slot /></div>' },
          CustomSelect: true,
          MarkdownEditor: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: '<textarea class="markdown-stub" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
          },
          TaskAttachments: {
            emits: ['add'],
            template: '<button class="attachment-stub" @click="$emit(\'add\', { id: \'attachment-1\', name: \'proof.png\' })" />'
          },
          Calendar: true,
          Flag: true,
          Inbox: true,
          CheckCircle: true,
          Mic: true,
          MicOff: true,
          X: true,
          Loader2: true,
          Globe: true
        }
      }
    })
    const title = wrapper.get('input[aria-label="Task name"]')
    const description = wrapper.get('textarea.markdown-stub')
    const submit = wrapper.get('button.create-btn')
    await title.setValue('Draft that must survive')
    await description.setValue('Details must survive too')
    await wrapper.get('button.attachment-stub').trigger('click')
    await submit.trigger('click')
    await submit.trigger('click')

    expect(wrapper.emitted('create')).toHaveLength(1)
    expect((title.element as HTMLInputElement).value).toBe('Draft that must survive')
    expect((description.element as HTMLTextAreaElement).value).toBe('Details must survive too')
    expect((submit.element as HTMLButtonElement).disabled).toBe(true)
    const cancel = wrapper.get('button.cancel-btn')
    expect((cancel.element as HTMLButtonElement).disabled).toBe(true)
    await cancel.trigger('click')
    expect(wrapper.emitted('cancel')).toBeUndefined()

    const request = wrapper.emitted('create')![0][0] as {
      description: string
      attachments: Array<{ id: string; name: string }>
      onSettled: (saved: boolean) => void
    }
    expect(request.description).toBe('Details must survive too')
    expect(request.attachments).toEqual([expect.objectContaining({ id: 'attachment-1' })])
    request.onSettled(false)
    await nextTick()

    expect((title.element as HTMLInputElement).value).toBe('Draft that must survive')
    expect((description.element as HTMLTextAreaElement).value).toBe('Details must survive too')
    expect((submit.element as HTMLButtonElement).disabled).toBe(false)
  })
})
