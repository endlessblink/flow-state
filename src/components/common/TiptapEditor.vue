<template>
  <div class="tiptap-editor-container">
    <!-- Main Toolbar Row -->
    <div class="editor-toolbar">
      <!-- Undo/Redo -->
      <button
        class="toolbar-btn"
        title="Undo (Ctrl+Z)"
        aria-label="Undo (Ctrl+Z)"
        :disabled="!editor?.can().undo()"
        @click="editor?.chain().focus().undo().run()"
      >
        <Undo :size="14" />
      </button>
      <button
        class="toolbar-btn"
        title="Redo (Ctrl+Y)"
        aria-label="Redo (Ctrl+Y)"
        :disabled="!editor?.can().redo()"
        @click="editor?.chain().focus().redo().run()"
      >
        <Redo :size="14" />
      </button>
      <div class="toolbar-divider" />

      <!-- Headings -->
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('heading', { level: 1 }) }"
        title="Heading 1"
        aria-label="Heading 1"
        @click="editor?.chain().focus().toggleHeading({ level: 1 }).run()"
      >
        <Heading1 :size="14" />
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('heading', { level: 2 }) }"
        title="Heading 2"
        aria-label="Heading 2"
        @click="editor?.chain().focus().toggleHeading({ level: 2 }).run()"
      >
        <Heading2 :size="14" />
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('heading', { level: 3 }) }"
        title="Heading 3"
        aria-label="Heading 3"
        @click="editor?.chain().focus().toggleHeading({ level: 3 }).run()"
      >
        <Heading3 :size="14" />
      </button>
      <div class="toolbar-divider" />

      <!-- Text Formatting -->
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('bold') }"
        title="Bold (Ctrl+B)"
        aria-label="Bold (Ctrl+B)"
        @click="editor?.chain().focus().toggleBold().run()"
      >
        <BoldIcon :size="14" />
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('italic') }"
        title="Italic (Ctrl+I)"
        aria-label="Italic (Ctrl+I)"
        @click="editor?.chain().focus().toggleItalic().run()"
      >
        <ItalicIcon :size="14" />
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('underline') }"
        title="Underline (Ctrl+U)"
        aria-label="Underline (Ctrl+U)"
        @click="editor?.chain().focus().toggleUnderline().run()"
      >
        <UnderlineIcon :size="14" />
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('strike') }"
        title="Strikethrough"
        aria-label="Strikethrough"
        @click="editor?.chain().focus().toggleStrike().run()"
      >
        <StrikethroughIcon :size="14" />
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('highlight') }"
        title="Highlight"
        aria-label="Highlight"
        @click="editor?.chain().focus().toggleHighlight().run()"
      >
        <HighlightIcon :size="14" />
      </button>

      <!-- Text Color Dropdown -->
      <div class="toolbar-dropdown">
        <button
          class="toolbar-btn"
          title="Text Color"
          aria-label="Text Color"
          @click="showColorPicker = !showColorPicker"
        >
          <Palette :size="14" />
          <ChevronDown :size="10" class="dropdown-arrow" />
        </button>
        <div v-if="showColorPicker" class="color-picker-dropdown">
          <button
            v-for="color in textColors"
            :key="color.value"
            class="color-swatch"
            :style="{ backgroundColor: color.value }"
            :title="color.name"
            @click="setTextColor(color.value)"
          />
          <button
            class="color-swatch reset-color"
            title="Reset Color"
            @click="setTextColor('')"
          >
            ✕
          </button>
        </div>
      </div>
      <div class="toolbar-divider" />

      <!-- Text Align -->
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive({ textAlign: 'left' }) }"
        title="Align Left"
        aria-label="Align Left"
        @click="editor?.chain().focus().setTextAlign('left').run()"
      >
        <AlignLeft :size="14" />
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive({ textAlign: 'center' }) }"
        title="Align Center"
        aria-label="Align Center"
        @click="editor?.chain().focus().setTextAlign('center').run()"
      >
        <AlignCenter :size="14" />
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive({ textAlign: 'right' }) }"
        title="Align Right"
        aria-label="Align Right"
        @click="editor?.chain().focus().setTextAlign('right').run()"
      >
        <AlignRight :size="14" />
      </button>
      <div class="toolbar-divider" />

      <!-- Lists -->
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('bulletList') }"
        title="Bullet List"
        aria-label="Bullet List"
        @click="editor?.chain().focus().toggleBulletList().run()"
      >
        <List :size="14" />
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('orderedList') }"
        title="Numbered List"
        aria-label="Numbered List"
        @click="editor?.chain().focus().toggleOrderedList().run()"
      >
        <ListOrdered :size="14" />
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('taskList') }"
        title="Task List"
        aria-label="Task List"
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
        aria-label="Quote"
        @click="editor?.chain().focus().toggleBlockquote().run()"
      >
        <Quote :size="14" />
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('codeBlock') }"
        title="Code Block"
        aria-label="Code Block"
        @click="editor?.chain().focus().toggleCodeBlock().run()"
      >
        <Code :size="14" />
      </button>
      <button
        class="toolbar-btn"
        title="Horizontal Rule"
        aria-label="Horizontal Rule"
        @click="editor?.chain().focus().setHorizontalRule().run()"
      >
        <HorizontalRuleIcon :size="14" />
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: editor?.isActive('link') }"
        title="Link (Ctrl+K)"
        aria-label="Link (Ctrl+K)"
        @click="setLink"
      >
        <LinkIcon :size="14" />
      </button>
      <div class="toolbar-divider" />

      <!-- Table -->
      <div class="toolbar-dropdown">
        <button
          class="toolbar-btn"
          :class="{ active: editor?.isActive('table') }"
          title="Table"
          aria-label="Table"
          @click="showTableMenu = !showTableMenu"
        >
          <TableIcon :size="14" />
          <ChevronDown :size="10" class="dropdown-arrow" />
        </button>
        <div v-if="showTableMenu" class="table-menu-dropdown">
          <button class="dropdown-item" @click="insertTable">
            Insert Table (3×3)
          </button>
          <button class="dropdown-item" :disabled="!editor?.can().addColumnBefore()" @click="editor?.chain().focus().addColumnBefore().run()">
            Add Column Before
          </button>
          <button class="dropdown-item" :disabled="!editor?.can().addColumnAfter()" @click="editor?.chain().focus().addColumnAfter().run()">
            Add Column After
          </button>
          <button class="dropdown-item" :disabled="!editor?.can().deleteColumn()" @click="editor?.chain().focus().deleteColumn().run()">
            Delete Column
          </button>
          <div class="dropdown-divider" />
          <button class="dropdown-item" :disabled="!editor?.can().addRowBefore()" @click="editor?.chain().focus().addRowBefore().run()">
            Add Row Before
          </button>
          <button class="dropdown-item" :disabled="!editor?.can().addRowAfter()" @click="editor?.chain().focus().addRowAfter().run()">
            Add Row After
          </button>
          <button class="dropdown-item" :disabled="!editor?.can().deleteRow()" @click="editor?.chain().focus().deleteRow().run()">
            Delete Row
          </button>
          <div class="dropdown-divider" />
          <button class="dropdown-item danger" :disabled="!editor?.can().deleteTable()" @click="editor?.chain().focus().deleteTable().run()">
            Delete Table
          </button>
        </div>
      </div>
    </div>

    <div class="tiptap-surface" :dir="textDirection">
      <EditorContent :editor="editor" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount, nextTick } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
// Link and Underline imports removed to fix duplicate extension warnings
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
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
  Redo,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Table as TableIcon,
  Palette,
  ChevronDown
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

// UI state for dropdowns
const showColorPicker = ref(false)
const showTableMenu = ref(false)

// Color palette for text color
const textColors = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Gray', value: '#6b7280' },
]

// BUG-276 FIX: Track internal updates to prevent watcher from re-setting content during typing
const isInternalUpdate = ref(false)

// FIX: Track the last markdown TipTap emitted, so the modelValue watcher can compare
// markdown-to-markdown instead of HTML-to-HTML. The HTML comparison was unreliable because
// parseMarkdown() (marked.js) and editor.getHTML() (TipTap serializer) produce structurally
// different HTML for the same content, causing setContent to fire on every prop update.
const lastEmittedMarkdown = ref(props.modelValue)

// BUG-276 FIX: Debounced emit to prevent rapid-fire conversions during typing
const debouncedEmit = useDebounceFn((markdown: string) => {
  isInternalUpdate.value = true
  lastEmittedMarkdown.value = markdown
  emit('update:modelValue', markdown)
  nextTick(() => {
    isInternalUpdate.value = false
  })
}, 150)

// BUG-1506: Shift+Enter exits list → plain paragraph. Only acts inside lists.
// Falls through to default HardBreak (soft line break) outside lists.
const ShiftEnterExitList = Extension.create({
  name: 'shiftEnterExitList',
  priority: 1000, // Higher than HardBreak to intercept first
  addKeyboardShortcuts() {
    return {
      'Shift-Enter': ({ editor }) => {
        const isInList = editor.isActive('bulletList') || editor.isActive('orderedList') || editor.isActive('taskList')
        if (!isInList) return false // Let HardBreak handle it

        // Split at cursor, then clear the new node's list formatting → becomes paragraph
        const isTask = editor.isActive('taskItem')
        const itemType = isTask ? 'taskItem' : 'listItem'

        const didSplit = editor.chain().splitListItem(itemType).run()
        if (didSplit) {
          // Now cursor is in the new empty list item — clear it to paragraph
          editor.chain().clearNodes().run()
          return true
        }
        return false
      },
    }
  },
})

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
    // Link and Underline removed to fix duplicate extension warning
    Placeholder.configure({
      placeholder: 'Add a description... Use the toolbar for formatting.',
    }),
    Highlight.configure({
      multicolor: false, // Single yellow highlight
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    TextStyle,
    Color,
    Table.configure({
      resizable: true,
      HTMLAttributes: {
        class: 'editor-table',
      },
    }),
    TableRow,
    TableCell,
    TableHeader,
    ShiftEnterExitList,
  ],
  // Disable input rules globally - no auto-conversion on typing
  enableInputRules: false,
  // Keep paste rules for pasting formatted content
  enablePasteRules: true,
  onUpdate: ({ editor }) => {
    // BUG-013 FIX: Convert HTML output to markdown before emitting
    // The app stores task descriptions as markdown, not HTML
    // BUG-276 FIX: Use debounced emit to prevent rapid-fire conversions
    const html = editor.getHTML()
    const markdown = htmlToMarkdown(html)
    debouncedEmit(markdown)
  },
})

// Watch for external changes to modelValue
// BUG-013 FIX: Convert incoming markdown to HTML for comparison and setting
// BUG-276 FIX: Skip if this is an internal update from typing to prevent race conditions
watch(() => props.modelValue, (newValue) => {
  if (!editor.value || isInternalUpdate.value) return
  // FIX: Compare markdown-to-markdown instead of HTML-to-HTML.
  // parseMarkdown() and editor.getHTML() produce structurally different HTML for the
  // same content (marked.js vs TipTap serializer), so the old HTML comparison always
  // triggered setContent, resetting the editor and destroying user's in-progress edits.
  if (newValue === lastEmittedMarkdown.value) return
  const newHtml = parseMarkdown(newValue)
  const currentHtml = editor.value.getHTML()
  // Only update if content actually changed (prevents cursor jump)
  if (currentHtml !== newHtml) {
    lastEmittedMarkdown.value = newValue
    editor.value.commands.setContent(newHtml, { emitUpdate: false })
  }
})

// Cleanup
onBeforeUnmount(() => {
  // Flush any pending debounced content before destroying the editor
  // This ensures that fast-typing followed by immediate save/unmount doesn't lose the last 150ms of content
  if (editor.value) {
    const html = editor.value.getHTML()
    const markdown = htmlToMarkdown(html)
    if (markdown !== lastEmittedMarkdown.value) {
      isInternalUpdate.value = true
      lastEmittedMarkdown.value = markdown
      emit('update:modelValue', markdown)
    }
  }
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

// Text color handling
const setTextColor = (color: string) => {
  if (!editor.value) return
  if (color === '') {
    editor.value.chain().focus().unsetColor().run()
  } else {
    editor.value.chain().focus().setColor(color).run()
  }
  showColorPicker.value = false
}

// Table handling
const insertTable = () => {
  if (!editor.value) return
  editor.value.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  showTableMenu.value = false
}

// Close dropdowns when clicking outside

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
  transition: all var(--duration-fast) var(--ease-out);
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

:deep(.tiptap ul) {
  padding-inline-start: 1.5em;
  margin: 0.5em 0;
  list-style-type: disc;
}

:deep(.tiptap ol) {
  padding-inline-start: 1.5em;
  margin: 0.5em 0;
  list-style-type: decimal;
}

:deep(.tiptap li) {
  display: list-item;
}

:deep(.tiptap ul[data-type="taskList"]) {
  list-style: none;
  padding-inline-start: 0;
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
  border-radius: var(--radius-xs);
  padding: 0 var(--space-0_5);
}

:deep(.tiptap blockquote) {
  border-inline-start: 3px solid var(--primary-400);
  padding-inline-start: 1em;
  margin-inline-start: 0;
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
  border-radius: var(--radius-xs);
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
  float: inline-start;
  height: 0;
}

/* Headings */
:deep(.tiptap h1) {
  font-size: 1.75em;
  font-weight: 700;
  margin: 0.5em 0 0.25em 0;
  color: var(--text-primary);
}

:deep(.tiptap h2) {
  font-size: 1.4em;
  font-weight: 600;
  margin: 0.5em 0 0.25em 0;
  color: var(--text-primary);
}

:deep(.tiptap h3) {
  font-size: 1.15em;
  font-weight: 600;
  margin: 0.5em 0 0.25em 0;
  color: var(--text-primary);
}

/* Text Align */
:deep(.tiptap [style*="text-align: center"]) {
  text-align: center;
}

:deep(.tiptap [style*="text-align: end"]) {
  text-align: end;
}

/* Tables - target all tables in TipTap editor */
:deep(.tiptap table),
:deep(.tiptap table.editor-table) {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
  overflow: hidden;
  border: 1px solid var(--glass-border);
}

:deep(.tiptap table th),
:deep(.tiptap table td),
:deep(.tiptap table.editor-table th),
:deep(.tiptap table.editor-table td) {
  border: 1px solid var(--glass-border);
  padding: 0.5em 0.75em;
  min-width: 80px;
  vertical-align: top;
}

:deep(.tiptap table th),
:deep(.tiptap table.editor-table th) {
  background: var(--glass-bg-medium);
  font-weight: 600;
}

:deep(.tiptap table td),
:deep(.tiptap table.editor-table td) {
  background: var(--glass-bg-soft);
}

:deep(.tiptap table .selectedCell),
:deep(.tiptap table.editor-table .selectedCell) {
  background: var(--primary-100);
}

/* Table wrapper from TipTap */
:deep(.tiptap .tableWrapper) {
  overflow-x: auto;
  margin: 1em 0;
}

/* Dropdown containers */
.toolbar-dropdown {
  position: relative;
}

.dropdown-arrow {
  margin-inline-start: var(--space-0_5);
  opacity: 0.7;
}

/* Color picker dropdown */
.color-picker-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 100;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-1);
  padding: var(--space-2);
  background: var(--glass-bg-heavy);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-dark-md);
}

.color-swatch {
  width: 24px;
  height: 24px;
  border: 2px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.color-swatch:hover {
  transform: scale(1.15);
  border-color: white;
}

.reset-color {
  background: var(--glass-bg-medium);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* Table menu dropdown */
.table-menu-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 100;
  min-width: 180px;
  max-width: 220px;
  /* Solid opaque background - purple-tinted */
  background: var(--surface-primary);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-dark-md);
  padding: var(--space-1) 0;
  overflow: hidden;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  text-align: start;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out);
}

.dropdown-item:hover:not(:disabled) {
  background: var(--glass-bg-light);
}

.dropdown-item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dropdown-item.danger {
  color: var(--color-danger);
}

.dropdown-divider {
  height: 1px;
  background: var(--glass-border);
  margin: var(--space-1) 0;
}

/* Toolbar row wrapping for smaller screens */
.editor-toolbar {
  flex-wrap: wrap;
}
</style>
