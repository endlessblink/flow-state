<template>
  <div class="note-node" dir="rtl">
    <Handle type="target" :position="Position.Top" id="top" />
    <Handle type="target" :position="Position.Right" id="right" />
    <Handle type="target" :position="Position.Bottom" id="bottom" />
    <Handle type="target" :position="Position.Left" id="left" />
    <Handle type="source" :position="Position.Top" id="source-top" />
    <Handle type="source" :position="Position.Right" id="source-right" />
    <Handle type="source" :position="Position.Bottom" id="source-bottom" />
    <Handle type="source" :position="Position.Left" id="source-left" />

    <div class="note-color-bar" :style="colorBarStyle" />

    <img
      v-if="data.imageUrl"
      :src="data.imageUrl"
      class="note-image"
      alt="Pasted image"
      @click.stop="showLightbox = true"
    />

    <input
      class="note-title"
      :value="data.title"
      dir="auto"
      placeholder="Note title..."
      @input="handleTitleInput"
      @blur="handleTitleBlur"
      @keydown.enter="($event.target as HTMLInputElement).blur()"
    />

    <textarea
      class="note-content"
      :value="data.description"
      dir="auto"
      placeholder="Write your thoughts..."
      rows="2"
      @input="handleDescriptionInput"
      @blur="handleDescriptionBlur"
    />
  </div>

  <Teleport to="body">
    <div v-if="showLightbox" class="image-lightbox" @click="showLightbox = false">
      <img :src="data.imageUrl" class="lightbox-img" alt="Full image" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'

interface Props {
  data: {
    title: string
    description: string
    color?: string
    noteId: string
    imageUrl?: string
  }
}

const props = defineProps<Props>()
const showLightbox = ref(false)
const AUTOSAVE_DELAY_MS = 250
const lastSavedTitle = ref(props.data.title)
const lastSavedDescription = ref(props.data.description)
let pendingTitle: string | null = null
let pendingDescription: string | null = null
let titleSaveTimer: ReturnType<typeof setTimeout> | null = null
let descriptionSaveTimer: ReturnType<typeof setTimeout> | null = null
const emit = defineEmits<{
  'update-title': [noteId: string, title: string]
  'update-description': [noteId: string, description: string]
}>()

const colorBarStyle = computed(() => ({
  background: props.data.color || 'var(--brand-primary)',
}))

watch(() => props.data.title, value => {
  lastSavedTitle.value = value
})

watch(() => props.data.description, value => {
  lastSavedDescription.value = value
})

const saveTitle = (value: string) => {
  if (value !== lastSavedTitle.value) {
    lastSavedTitle.value = value
    emit('update-title', props.data.noteId, value)
  }
}

const saveDescription = (value: string) => {
  if (value !== lastSavedDescription.value) {
    lastSavedDescription.value = value
    emit('update-description', props.data.noteId, value)
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
  scheduleTitleAutosave((e.target as HTMLInputElement).value.trim())
}

const handleDescriptionInput = (e: Event) => {
  scheduleDescriptionAutosave((e.target as HTMLTextAreaElement).value)
}

const handleTitleBlur = (e: FocusEvent) => {
  const value = (e.target as HTMLInputElement).value.trim()
  pendingTitle = value
  flushTitleAutosave()
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
.note-node {
  background: var(--glass-bg-soft);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  padding-top: var(--space-2);
  min-width: 200px;
  max-width: 300px;
  transition: all var(--duration-normal) var(--ease-out);
  cursor: grab;
  overflow: hidden;
}

.note-node:hover {
  border-color: var(--glass-border-hover);
  box-shadow: 0 0 12px var(--brand-primary-alpha-10);
}

.note-color-bar {
  height: 3px;
  border-radius: 2px;
  margin-bottom: var(--space-2);
  opacity: 0.8;
}

.note-title {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  line-height: 1.4;
  padding: var(--space-1) 0;
  text-align: start;
}

.note-title::placeholder {
  color: var(--text-muted);
}

.note-content {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-secondary);
  font-size: var(--text-xs);
  line-height: 1.5;
  resize: vertical;
  min-height: 40px;
  padding: 0;
  font-family: inherit;
  text-align: start;
}

.note-content::placeholder {
  color: var(--text-muted);
  opacity: 0.6;
}

.note-image {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  border-radius: var(--radius-md);
  margin-bottom: var(--space-2);
  cursor: zoom-in;
  display: block;
}
</style>

<style>
.image-lightbox {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
}

.lightbox-img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: var(--radius-lg);
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.5);
}
</style>
