<template>
  <div
    class="subtask-node"
    :class="{ completed: data.isCompleted }"
    dir="rtl"
  >
    <Handle type="target" :position="Position.Top" id="top" />
    <Handle type="target" :position="Position.Right" id="right" />
    <Handle type="target" :position="Position.Bottom" id="bottom" />
    <Handle type="target" :position="Position.Left" id="left" />
    <Handle type="source" :position="Position.Top" id="source-top" />
    <Handle type="source" :position="Position.Right" id="source-right" />
    <Handle type="source" :position="Position.Bottom" id="source-bottom" />
    <Handle type="source" :position="Position.Left" id="source-left" />

    <div class="subtask-header">
      <button
        class="subtask-checkbox"
        :class="{ checked: data.isCompleted }"
        @click.stop="$emit('toggle-complete', data.subtaskId)"
      >
        <Check v-if="data.isCompleted" :size="12" />
      </button>

      <textarea
        ref="titleInput"
        class="subtask-title"
        :class="{ completed: data.isCompleted }"
        :value="data.title"
        dir="auto"
        placeholder="New subtask"
        rows="1"
        @input="handleTitleInput"
        @blur="handleTitleBlur"
        @keydown.enter.prevent="($event.target as HTMLTextAreaElement).blur()"
        @keydown.shift.enter.prevent="handleTitleShiftEnter"
      />
    </div>

    <textarea
      ref="descInput"
      class="subtask-description"
      :value="data.description"
      dir="auto"
      placeholder="Add description..."
      rows="1"
      @input="handleDescriptionInput"
      @blur="handleDescriptionBlur"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { Check } from 'lucide-vue-next'

interface Props {
  data: {
    title: string
    description: string
    isCompleted: boolean
    subtaskId: string
  }
  autoFocus?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  autoFocus: false,
})
const emit = defineEmits<{
  'toggle-complete': [subtaskId: string]
  'update-title': [subtaskId: string, title: string]
  'update-description': [subtaskId: string, description: string]
  'auto-focused': []
}>()

const titleInput = ref<HTMLTextAreaElement | null>(null)
const descInput = ref<HTMLTextAreaElement | null>(null)
const AUTOSAVE_DELAY_MS = 250
const lastSavedTitle = ref(props.data.title)
const lastSavedDescription = ref(props.data.description)
let pendingTitle: string | null = null
let pendingDescription: string | null = null
let titleSaveTimer: ReturnType<typeof setTimeout> | null = null
let descriptionSaveTimer: ReturnType<typeof setTimeout> | null = null

const autoResize = (el: HTMLTextAreaElement) => {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

const resizeAll = () => {
  nextTick(() => {
    if (titleInput.value) autoResize(titleInput.value)
    if (descInput.value) autoResize(descInput.value)
  })
}

const focusTitle = () => {
  nextTick(() => {
    const el = titleInput.value
    if (!el) return
    el.focus()
    el.select()
    emit('auto-focused')
  })
}

onMounted(() => {
  resizeAll()
  if (props.autoFocus) focusTitle()
})

watch(() => props.data.title, resizeAll)
watch(() => props.data.description, resizeAll)
watch(() => props.autoFocus, (shouldFocus) => {
  if (shouldFocus) focusTitle()
})
watch(() => props.data.title, value => {
  lastSavedTitle.value = value
})
watch(() => props.data.description, value => {
  lastSavedDescription.value = value
})

const saveTitle = (value: string) => {
  if (value !== lastSavedTitle.value) {
    lastSavedTitle.value = value
    emit('update-title', props.data.subtaskId, value)
  }
}

const saveDescription = (value: string) => {
  if (value !== lastSavedDescription.value) {
    lastSavedDescription.value = value
    emit('update-description', props.data.subtaskId, value)
  }
}

const flushTitleAutosave = () => {
  if (titleSaveTimer) {
    clearTimeout(titleSaveTimer)
    titleSaveTimer = null
  }
  if (pendingTitle !== null) {
    saveTitle(pendingTitle)
    pendingTitle = null
  }
}

const flushDescriptionAutosave = () => {
  if (descriptionSaveTimer) {
    clearTimeout(descriptionSaveTimer)
    descriptionSaveTimer = null
  }
  if (pendingDescription !== null) {
    saveDescription(pendingDescription)
    pendingDescription = null
  }
}

const scheduleTitleAutosave = (value: string) => {
  pendingTitle = value
  if (titleSaveTimer) clearTimeout(titleSaveTimer)
  titleSaveTimer = setTimeout(flushTitleAutosave, AUTOSAVE_DELAY_MS)
}

const scheduleDescriptionAutosave = (value: string) => {
  pendingDescription = value
  if (descriptionSaveTimer) clearTimeout(descriptionSaveTimer)
  descriptionSaveTimer = setTimeout(flushDescriptionAutosave, AUTOSAVE_DELAY_MS)
}

const handleTitleInput = (e: Event) => {
  const el = e.target as HTMLTextAreaElement
  autoResize(el)
  scheduleTitleAutosave(el.value.trim())
}

const handleDescriptionInput = (e: Event) => {
  const el = e.target as HTMLTextAreaElement
  autoResize(el)
  scheduleDescriptionAutosave(el.value)
}

const handleTitleBlur = (e: FocusEvent) => {
  const value = (e.target as HTMLTextAreaElement).value.trim()
  pendingTitle = value
  flushTitleAutosave()
}

// Allow shift+enter to insert a newline in the title
const handleTitleShiftEnter = (e: KeyboardEvent) => {
  const el = e.target as HTMLTextAreaElement
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? el.value.length
  el.value = el.value.slice(0, start) + '\n' + el.value.slice(end)
  el.selectionStart = el.selectionEnd = start + 1
  autoResize(el)
  scheduleTitleAutosave(el.value.trim())
}

const handleDescriptionBlur = (e: FocusEvent) => {
  const value = (e.target as HTMLTextAreaElement).value
  pendingDescription = value
  flushDescriptionAutosave()
}

onBeforeUnmount(() => {
  flushTitleAutosave()
  flushDescriptionAutosave()
})
</script>

<style scoped>
.subtask-node {
  background: var(--glass-bg-soft);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  min-width: 180px;
  width: max-content;
  max-width: 360px;
  transition: all var(--duration-normal) var(--ease-out);
  cursor: grab;
}

.subtask-node:hover {
  border-color: var(--brand-primary);
  box-shadow: 0 0 12px var(--brand-primary-alpha-20);
}

.subtask-node.completed {
  opacity: 0.6;
}

.subtask-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.subtask-checkbox {
  width: 18px;
  height: 18px;
  border: 1.5px solid var(--glass-border-strong);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-soft);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 3px; /* align with first line of textarea */
  transition: all var(--duration-fast) var(--ease-out);
  color: white;
  padding: 0;
}

.subtask-checkbox:hover {
  border-color: var(--brand-primary);
}

.subtask-checkbox.checked {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
}

.subtask-title {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  line-height: 1.4;
  padding: var(--space-1) 0;
  resize: none;
  overflow: hidden;
  font-family: inherit;
  width: 100%;
  word-break: break-word;
  text-align: start;
}

.subtask-title.completed {
  text-decoration: line-through;
  color: var(--text-muted);
}

.subtask-title::placeholder {
  color: var(--text-muted);
}

.subtask-description {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-secondary);
  font-size: var(--text-xs);
  line-height: 1.5;
  resize: none;
  overflow: hidden;
  font-family: inherit;
  margin-top: var(--space-1);
  padding: 0;
  word-break: break-word;
  text-align: start;
}

.subtask-description::placeholder {
  color: var(--text-muted);
  opacity: 0.6;
}
</style>
