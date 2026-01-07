<template>
  <div class="milkdown-surface-container">
    <div class="editor-toolbar">
      <button class="toolbar-btn" title="Undo (Ctrl+Z)" @click="handleToolbar('Undo')">
        <Undo :size="14" />
      </button>
      <button class="toolbar-btn" title="Redo (Ctrl+Y)" @click="handleToolbar('Redo')">
        <Redo :size="14" />
      </button>
      <div class="toolbar-divider" />
      <button class="toolbar-btn" title="Bold (Ctrl+B)" @click="handleToolbar('Bold')">
        <BoldIcon :size="14" />
      </button>
      <button class="toolbar-btn" title="Italic (Ctrl+I)" @click="handleToolbar('Italic')">
        <ItalicIcon :size="14" />
      </button>
      <button class="toolbar-btn" title="Bullet List" @click="handleToolbar('BulletList')">
        <List :size="14" />
      </button>
      <button class="toolbar-btn" title="Task List" @click="handleToolbar('TaskList')">
        <CheckSquare :size="14" />
      </button>
      <button class="toolbar-btn" title="Link (Ctrl+K)" @click="handleToolbar('Link')">
        <LinkIcon :size="14" />
      </button>
    </div>
    <div class="milkdown-surface" :dir="textDirection">
      <Milkdown />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Milkdown, useEditor } from '@milkdown/vue'
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, commandsCtx } from '@milkdown/core'
import { nord } from '@milkdown/theme-nord'
import { commonmark, toggleStrongCommand, toggleEmphasisCommand, wrapInBulletListCommand, toggleLinkCommand } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { history, undoCommand, redoCommand } from '@milkdown/plugin-history'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { listItemBlockComponent } from '@milkdown/components/list-item-block'
import { Bold as BoldIcon, Italic as ItalicIcon, List, CheckSquare, Link as LinkIcon, Undo, Redo } from 'lucide-vue-next'

interface Props {
  modelValue: string
  textDirection: 'ltr' | 'rtl'
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// Milkdown Vue pattern: useEditor handles .create() internally
// Order: theme → listener plugin → config → presets → other plugins
const { get: getEditor } = useEditor((root) =>
  Editor.make()
    // Theme MUST be first (as .use, not .config)
    .use(nord)
    // Listener plugin MUST be registered before config accesses listenerCtx
    .use(listener)
    .config((ctx) => {
      ctx.set(rootCtx, root)
      ctx.set(defaultValueCtx, props.modelValue)

      // Now safe to access listenerCtx since listener is already registered
      const l = ctx.get(listenerCtx)
      l.markdownUpdated((_ctx, markdown) => {
        emit('update:modelValue', markdown)
      })
    })
    // Presets: commonmark first, then gfm (extends commonmark)
    .use(commonmark)
    .use(gfm)
    // Additional plugins
    .use(history)
    .use(listItemBlockComponent)
)

// Toolbar handler - uses getEditor() directly from the same component
// Note: We skip the EditorStatus check as it causes private field access errors in Milkdown Vue
const handleToolbar = (command: string) => {
  const editor = getEditor()
  if (!editor) return

  try {
    editor.action((ctx) => {
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
  } catch (e) {
    console.warn('Toolbar action failed (editor may not be ready):', e)
  }
}
</script>

<style scoped>
.milkdown-surface-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editor-toolbar {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: var(--glass-bg-medium);
  border-bottom: 1px solid var(--glass-border);
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
}

.toolbar-btn:hover {
  background: var(--glass-bg-light);
  color: var(--text-primary);
}

.toolbar-btn:active {
  background: var(--glass-bg-heavy);
  transform: scale(0.95);
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--glass-border);
  margin: 0 var(--space-1);
  align-self: center;
}

.milkdown-surface {
  flex: 1;
  width: 100%;
  padding: var(--space-3);
  overflow-y: auto;
}

:deep(.milkdown .editor) {
  white-space: pre-wrap !important;
}
</style>
