<template>
  <div class="tiptap-editor-container">
    <div class="editor-toolbar">
      <!-- Undo/Redo -->
      <button
        class="toolbar-btn"
        title="Undo (Ctrl+Z)"
        :disabled="!editor?.can().undo()"
        @click="editor?.chain().focus().undo().run()"
      >
        <Undo :size="14" />
      </button>
      <button
        class="toolbar-btn"
        title="Redo (Ctrl+Y)"
        :disabled="!editor?.can().redo()"
        @click="editor?.chain().focus().redo().run()"
      >
        <Redo :size="14" />
      </button>
      <div class="toolbar-divider" />
      <!-- Text Formatting -->
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('bold') }"
        title="Bold (Ctrl+B)"
        @click="editor?.chain().focus().toggleBold().run()"
      >
        <BoldIcon :size="14" />
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('italic') }"
        title="Italic (Ctrl+I)"
        @click="editor?.chain().focus().toggleItalic().run()"
      >
        <ItalicIcon :size="14" />
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('underline') }"
        title="Underline (Ctrl+U)"
        @click="editor?.chain().focus().toggleUnderline().run()"
      >
        <UnderlineIcon :size="14" />
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('strike') }"
        title="Strikethrough"
        @click="editor?.chain().focus().toggleStrike().run()"
      >
        <StrikethroughIcon :size="14" />
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('highlight') }"
        title="Highlight"
        @click="editor?.chain().focus().toggleHighlight().run()"
      >
        <HighlightIcon :size="14" />
      </button>
      <div class="toolbar-divider" />
      <!-- Lists -->
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('bulletList') }"
        title="Bullet List"
        @click="editor?.chain().focus().toggleBulletList().run()"
      >
        <List :size="14" />
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('orderedList') }"
        title="Numbered List"
        @click="editor?.chain().focus().toggleOrderedList().run()"
      >
        <ListOrdered :size="14" />
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('taskList') }"
        title="Task List"
        @click="editor?.chain().focus().toggleTaskList().run()"
      >
        <CheckSquare :size="14" />
      </button>
      <div class="toolbar-divider" />
      <!-- Blocks & Links -->
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('blockquote') }"
        title="Quote"
        @click="editor?.chain().focus().toggleBlockquote().run()"
      >
        <Quote :size="14" />
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('codeBlock') }"
        title="Code Block"
        @click="editor?.chain().focus().toggleCodeBlock().run()"
      >
        <Code :size="14" />
      </button>
      <button
        class="toolbar-btn"
        title="Horizontal Rule"
        @click="editor?.chain().focus().setHorizontalRule().run()"
      >
        <HorizontalRuleIcon :size="14" />
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('link') }"
        title="Link (Ctrl+K)"
        @click="setLink"
      >
        <LinkIcon :size="14" />
      </button>
    </div>
    <div class="tiptap-surface" :dir="textDirection">
      <EditorContent :editor="editor" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import Underline from '@tiptap/extension-underline'
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Strikethrough as StrikethroughIcon,
  Highlighter as HighlightIcon,
  List,
  ListOrdered,
  CheckSquare,
  Link as LinkIcon,
  Quote,
  Code,
  Minus as HorizontalRuleIcon,
  Undo,
  Redo
} from 'lucide-vue-next'
// BUG-013/BUG-014 FIX: Import markdown utilities for HTML<->Markdown conversion and URL sanitization
import { parseMarkdown, htmlToMarkdown, sanitizeUrl } from '@/utils/markdown'

interface Props {
  modelValue: string
  textDirection: 'ltr' | 'rtl'
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// Create editor with NO auto-conversion input rules
// StarterKit includes input rules by default, so we disable them
// BUG-013 FIX: Convert markdown to HTML for Tiptap, then HTML back to markdown on emit
const editor = useEditor({
  // Convert incoming markdown to HTML for Tiptap display
  content: parseMarkdown(props.modelValue),
  extensions: [
    StarterKit.configure({
      // Disable automatic input rules (no auto-conversion when typing)
      bulletList: {
        // Keep the node type but without input rules
      },
      orderedList: {
        // Keep the node type but without input rules
      },
      // Keep other extensions with their defaults
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'editor-link',
      },
    }),
    Placeholder.configure({
      placeholder: 'Add a description... Use the toolbar for formatting.',
    }),
    Highlight.configure({
      multicolor: false, // Single yellow highlight
    }),
    Underline,
  ],
  // Disable input rules globally - no auto-conversion on typing
  enableInputRules: false,
  // Keep paste rules for pasting formatted content
  enablePasteRules: true,
  onUpdate: ({ editor }) => {
    // BUG-013 FIX: Convert HTML output to markdown before emitting
    // The app stores task descriptions as markdown, not HTML
    const html = editor.getHTML()
    const markdown = htmlToMarkdown(html)
    emit('update:modelValue', markdown)
  },
})

// Watch for external changes to modelValue
// BUG-013 FIX: Convert incoming markdown to HTML for comparison and setting
watch(() => props.modelValue, (newValue) => {
  if (!editor.value) return
  // Convert incoming markdown to HTML for comparison
  const newHtml = parseMarkdown(newValue)
  const currentHtml = editor.value.getHTML()
  // Only update if content actually changed (prevents cursor jump)
  if (currentHtml !== newHtml) {
    editor.value.commands.setContent(newHtml, false)
  }
})

// Cleanup
onBeforeUnmount(() => {
  editor.value?.destroy()
})

// Link handling
// BUG-014 FIX: Sanitize URLs to prevent XSS via javascript:, data: protocols
const setLink = () => {
  if (!editor.value) return

  const previousUrl = editor.value.getAttributes('link').href
  const url = window.prompt('URL', previousUrl)

  if (url === null) return // Cancelled

  if (url === '') {
    editor.value.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }

  // BUG-014 FIX: Validate and sanitize URL before applying
  const safeUrl = sanitizeUrl(url)
  if (!safeUrl) {
    window.alert('Invalid or unsafe URL. Please use http://, https://, or mailto: links only.')
    return
  }

  editor.value.chain().focus().extendMarkRange('link').setLink({ href: safeUrl }).run()
}
</script>

<style scoped>
.tiptap-editor-container {
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

.toolbar-btn:hover:not(:disabled) {
  background: var(--glass-bg-light);
  color: var(--text-primary);
}

.toolbar-btn:active:not(:disabled) {
  background: var(--glass-bg-heavy);
  transform: scale(0.95);
}

.toolbar-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toolbar-btn.active {
  background: var(--glass-bg-heavy);
  color: var(--text-primary);
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--glass-border);
  margin: 0 var(--space-1);
  align-self: center;
}

.tiptap-surface {
  flex: 1;
  width: 100%;
  padding: var(--space-3);
  overflow-y: auto;
}

/* Tiptap editor styles */
:deep(.tiptap) {
  outline: none;
  min-height: 100px;
}

:deep(.tiptap p) {
  margin: 0 0 0.5em 0;
}

:deep(.tiptap ul),
:deep(.tiptap ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}

:deep(.tiptap ul[data-type="taskList"]) {
  list-style: none;
  padding-left: 0;
}

:deep(.tiptap ul[data-type="taskList"] li) {
  display: flex;
  align-items: flex-start;
  gap: 0.5em;
}

:deep(.tiptap ul[data-type="taskList"] li > label) {
  flex-shrink: 0;
  margin-top: 0.2em;
}

:deep(.tiptap ul[data-type="taskList"] li > label input[type="checkbox"]) {
  cursor: pointer;
  width: 16px;
  height: 16px;
  accent-color: var(--primary-500);
}

:deep(.tiptap ul[data-type="taskList"] li > div) {
  flex: 1;
}

:deep(.tiptap a.editor-link) {
  color: var(--primary-400);
  text-decoration: underline;
  cursor: pointer;
}

:deep(.tiptap strong) {
  font-weight: 600;
}

:deep(.tiptap em) {
  font-style: italic;
}

:deep(.tiptap s) {
  text-decoration: line-through;
  color: var(--text-muted);
}

:deep(.tiptap u) {
  text-decoration: underline;
}

:deep(.tiptap mark) {
  background-color: #fef08a;
  border-radius: 2px;
  padding: 0 2px;
}

:deep(.tiptap blockquote) {
  border-left: 3px solid var(--primary-400);
  padding-left: 1em;
  margin-left: 0;
  color: var(--text-muted);
  font-style: italic;
}

:deep(.tiptap pre) {
  background: var(--glass-bg-heavy);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  padding: 0.75em 1em;
  font-family: ui-monospace, monospace;
  font-size: 0.9em;
  overflow-x: auto;
}

:deep(.tiptap code) {
  background: var(--glass-bg-medium);
  border-radius: 3px;
  padding: 0.1em 0.3em;
  font-family: ui-monospace, monospace;
  font-size: 0.9em;
}

:deep(.tiptap pre code) {
  background: transparent;
  padding: 0;
}

:deep(.tiptap hr) {
  border: none;
  border-top: 1px solid var(--glass-border);
  margin: 1em 0;
}

/* Placeholder */
:deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: var(--text-muted);
  opacity: 0.6;
  pointer-events: none;
  float: left;
  height: 0;
}
</style>
