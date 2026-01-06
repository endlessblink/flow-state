<template>
  <MilkdownProvider>
    <div class="markdown-editor" :class="{ 'is-preview': isPreview }">
      <div class="editor-header">
        <div class="header-tabs">
          <button 
            class="tab-btn" 
            :class="{ active: !isPreview }" 
            @click="isPreview = false"
          >
            <Edit2 :size="14" />
            <span>Write</span>
          </button>
          <button 
            class="tab-btn" 
            :class="{ active: isPreview }" 
            @click="isPreview = true"
          >
            <Eye :size="14" />
            <span>Preview</span>
          </button>
        </div>
        
        <div v-if="!isPreview" class="editor-toolbar">
          <button class="toolbar-btn" title="Undo" @click="handleToolbar('Undo')"><Undo :size="14" /></button>
          <button class="toolbar-btn" title="Redo" @click="handleToolbar('Redo')"><Redo :size="14" /></button>
          <div class="toolbar-divider" />
          <button class="toolbar-btn" title="Bold" @click="handleToolbar('Bold')"><BoldIcon :size="14" /></button>
          <button class="toolbar-btn" title="Italic" @click="handleToolbar('Italic')"><ItalicIcon :size="14" /></button>
          <button class="toolbar-btn" title="List" @click="handleToolbar('BulletList')"><List :size="14" /></button>
          <button class="toolbar-btn" title="Checklist" @click="handleToolbar('TaskList')"><CheckSquare :size="14" /></button>
          <button class="toolbar-btn" title="Link" @click="handleToolbar('Link')"><LinkIcon :size="14" /></button>
        </div>
      </div>

      <div class="editor-body">
        <div v-show="!isPreview" class="milkdown-container">
          <MilkdownEditorSurface 
            :modelValue="internalValue" 
            :textDirection="textDirection"
            @update:modelValue="handleInternalUpdate"
            @editor-ready="handleEditorReady"
          />
        </div>
        <div v-if="isPreview" class="preview-area">
          <MarkdownRenderer 
            :content="internalValue" 
            rtl-aware 
            @checkbox-click="handlePreviewCheckboxClick"
          />
        </div>
      </div>
    </div>
  </MilkdownProvider>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Edit2, Eye, Bold as BoldIcon, Italic as ItalicIcon, List, CheckSquare, Link as LinkIcon, Undo, Redo } from 'lucide-vue-next'
import { MilkdownProvider } from '@milkdown/vue'
import { Editor, editorViewCtx, EditorStatus, commandsCtx } from '@milkdown/core'
import { toggleStrongCommand, toggleEmphasisCommand, wrapInBulletListCommand, toggleLinkCommand } from '@milkdown/preset-commonmark'
import { undoCommand, redoCommand } from '@milkdown/plugin-history'
import { replaceAll } from '@milkdown/utils'
import MilkdownEditorSurface from './MilkdownEditorSurface.vue'
import MarkdownRenderer from './MarkdownRenderer.vue'

interface Props {
  modelValue: string
  placeholder?: string
  rows?: number
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: 'Type markdown...',
  rows: 4
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const internalValue = ref(props.modelValue)
const isPreview = ref(false)
let editorInstance: Editor | null = null

const handleEditorReady = (editor: Editor) => {
  editorInstance = editor
}

const handleInternalUpdate = (markdown: string) => {
  if (markdown !== internalValue.value) {
    internalValue.value = markdown
    emit('update:modelValue', markdown)
  }
}

watch(() => props.modelValue, (newVal) => {
  if (newVal !== internalValue.value) {
    internalValue.value = newVal
    if (editorInstance && editorInstance.status === EditorStatus.Created) {
      // Use replaceAll macro directly via editor.action()
      editorInstance.action(replaceAll(newVal))
    }
  }
})

const handleToolbar = (command: string) => {
  if (!editorInstance || editorInstance.status !== EditorStatus.Created) return

  editorInstance.action((ctx) => {
    const commandManager = ctx.get(commandsCtx)
    const view = ctx.get(editorViewCtx)

    switch (command) {
      case 'Bold':
        commandManager.call(toggleStrongCommand.key)
        break
      case 'Italic':
        commandManager.call(toggleEmphasisCommand.key)
        break
      case 'BulletList':
        commandManager.call(wrapInBulletListCommand.key)
        break
      case 'TaskList': {
        // Insert task list item at cursor position
        if (view) {
          const { state, dispatch } = view
          const { tr, selection } = state
          const lineStart = state.doc.resolve(selection.from).start()
          dispatch(tr.insertText('- [ ] ', lineStart))
        }
        break
      }
      case 'Link':
        commandManager.call(toggleLinkCommand.key)
        break
      case 'Undo':
        commandManager.call(undoCommand.key)
        break
      case 'Redo':
        commandManager.call(redoCommand.key)
        break
    }
  })
}

const handlePreviewCheckboxClick = (index: number) => {
  const text = internalValue.value
  const checkboxPattern = /(?:^|\n)\s*(?:-?\s*)\[([ x])\]/g
  const matches = [...text.matchAll(checkboxPattern)]

  if (index >= 0 && index < matches.length) {
    const match = matches[index]
    const matchIndex = match.index!
    const checkboxContentIndex = matchIndex + (match[0].indexOf('[')) + 1

    const newState = match[1] === ' ' ? 'x' : ' '
    const newValue = text.substring(0, checkboxContentIndex) + newState + text.substring(checkboxContentIndex + 1)

    handleInternalUpdate(newValue)

    // Sync back to editor using replaceAll macro
    if (editorInstance && editorInstance.status === EditorStatus.Created) {
      editorInstance.action(replaceAll(newValue))
    }
  }
}

const textDirection = computed(() => {
  if (!internalValue.value.trim()) return 'ltr'
  const sample = internalValue.value.trim().substring(0, 100)
  const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\FB50-\uFDFF\uFE70-\uFEFF]/
  return rtlRegex.test(sample) ? 'rtl' : 'ltr'
})
</script>

<style scoped>
.markdown-editor {
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg-soft);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 200px;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-1) var(--space-2);
  background: var(--glass-bg-medium);
  border-bottom: 1px solid var(--glass-border);
}

.header-tabs {
  display: flex;
  gap: var(--space-1);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: var(--text-xs);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.2s;
}

.tab-btn:hover {
  background: var(--glass-bg-light);
  color: var(--text-primary);
}

.tab-btn.active {
  background: var(--glass-bg-heavy);
  color: var(--text-primary);
  font-weight: var(--font-semibold);
}

.editor-toolbar {
  display: flex;
  gap: var(--space-1);
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-xs);
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background: var(--glass-bg-light);
  color: var(--text-primary);
}

.toolbar-divider {
  width: 1px;
  height: 16px;
  background: var(--glass-border);
  margin: 0 var(--space-1);
  align-self: center;
}

.editor-body {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.milkdown-container {
  flex: 1;
  padding: var(--space-3);
  overflow-y: auto;
  background: transparent;
  min-height: 200px;
}

/* Milkdown Styling Overrides */
:deep(.milkdown) {
  background: transparent !important;
  color: var(--text-primary) !important;
  box-shadow: none !important;
}

:deep(.milkdown .editor) {
  padding: 0 !important;
  outline: none !important;
  font-size: var(--text-sm);
  font-family: var(--font-sans);
  line-height: 1.6;
  color: var(--text-primary);
}

:deep(.milkdown .editor p) {
  margin-bottom: var(--space-3);
}

:deep(.milkdown .editor h1),
:deep(.milkdown .editor h2),
:deep(.milkdown .editor h3) {
  margin-top: var(--space-4);
  margin-bottom: var(--space-2);
  color: var(--brand-primary);
  font-weight: var(--font-bold);
}

:deep(.milkdown .editor ul),
:deep(.milkdown .editor ol) {
  padding-inline-start: 1.5rem;
  margin-bottom: var(--space-3);
}

/* RTL Support in Editor */
:deep(.editor) {
  text-align: inherit;
  direction: inherit;
}

.milkdown-container[dir="rtl"] :deep(.editor) {
  text-align: right;
  direction: rtl;
}

.milkdown-container[dir="rtl"] :deep(.editor ul),
.milkdown-container[dir="rtl"] :deep(.editor ol) {
  padding-inline-start: 0;
  padding-inline-end: 1.5rem;
}

/* Task List Styling in Editor */
:deep(.milkdown .editor .task-list-item) {
  list-style-type: none;
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin-inline-start: -1.5rem;
}

:deep(.milkdown .editor .task-list-item input[type="checkbox"]) {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--glass-border-heavy);
  border-radius: 4px;
  background: var(--glass-bg-soft);
  cursor: pointer;
  position: relative;
  margin-top: 4px;
  flex-shrink: 0;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

:deep(.milkdown .editor .task-list-item input[type="checkbox"]:checked) {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
}

:deep(.milkdown .editor .task-list-item input[type="checkbox"]:checked::after) {
  content: '';
  position: absolute;
  top: 1px;
  left: 4px;
  width: 5px;
  height: 9px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.preview-area {
  padding: var(--space-3);
  background: transparent;
  max-height: 400px;
  overflow-y: auto;
}
</style>
