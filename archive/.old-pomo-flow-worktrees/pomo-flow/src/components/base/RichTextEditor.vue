<template>
  <div class="rich-text-editor" :class="{ 'is-focused': isFocused, 'is-mobile': isMobile }">
    <!-- Toolbar -->
    <div v-if="editor" class="editor-toolbar">
      <div class="toolbar-group">
        <!-- Text Formatting -->
        <button
          @click="editor.chain().focus().toggleBold().run()"
          :class="{ 'is-active': editor.isActive('bold') }"
          class="toolbar-btn"
          title="Bold (Ctrl+B)"
          type="button"
        >
          <span class="icon">B</span>
        </button>
        <button
          @click="editor.chain().focus().toggleItalic().run()"
          :class="{ 'is-active': editor.isActive('italic') }"
          class="toolbar-btn"
          title="Italic (Ctrl+I)"
          type="button"
        >
          <span class="icon italic">I</span>
        </button>
        <button
          @click="editor.chain().focus().toggleStrike().run()"
          :class="{ 'is-active': editor.isActive('strike') }"
          class="toolbar-btn"
          title="Strikethrough"
          type="button"
        >
          <span class="icon">S̶</span>
        </button>
        <button
          @click="editor.chain().focus().toggleCode().run()"
          :class="{ 'is-active': editor.isActive('code') }"
          class="toolbar-btn"
          title="Inline Code"
          type="button"
        >
          <span class="icon code">&lt;/&gt;</span>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <!-- Headings -->
        <button
          @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
          :class="{ 'is-active': editor.isActive('heading', { level: 1 }) }"
          class="toolbar-btn"
          title="Heading 1"
          type="button"
        >
          H1
        </button>
        <button
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
          :class="{ 'is-active': editor.isActive('heading', { level: 2 }) }"
          class="toolbar-btn"
          title="Heading 2"
          type="button"
        >
          H2
        </button>
        <button
          @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
          :class="{ 'is-active': editor.isActive('heading', { level: 3 }) }"
          class="toolbar-btn"
          title="Heading 3"
          type="button"
        >
          H3
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <!-- Lists -->
        <button
          @click="editor.chain().focus().toggleBulletList().run()"
          :class="{ 'is-active': editor.isActive('bulletList') }"
          class="toolbar-btn"
          title="Bullet List"
          type="button"
        >
          ☰
        </button>
        <button
          @click="editor.chain().focus().toggleOrderedList().run()"
          :class="{ 'is-active': editor.isActive('orderedList') }"
          class="toolbar-btn"
          title="Numbered List"
          type="button"
        >
          1.
        </button>
        <button
          @click="editor.chain().focus().toggleTaskList().run()"
          :class="{ 'is-active': editor.isActive('taskList') }"
          class="toolbar-btn"
          title="Task List"
          type="button"
        >
          ☑
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <!-- Blocks -->
        <button
          @click="editor.chain().focus().toggleCodeBlock().run()"
          :class="{ 'is-active': editor.isActive('codeBlock') }"
          class="toolbar-btn"
          title="Code Block"
          type="button"
        >
          { }
        </button>
        <button
          @click="editor.chain().focus().toggleBlockquote().run()"
          :class="{ 'is-active': editor.isActive('blockquote') }"
          class="toolbar-btn"
          title="Quote"
          type="button"
        >
          "
        </button>
        <button
          @click="addTable"
          class="toolbar-btn"
          title="Insert Table"
          type="button"
        >
          ⊞
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <!-- Actions -->
        <button
          @click="editor.chain().focus().setHorizontalRule().run()"
          class="toolbar-btn"
          title="Horizontal Rule"
          type="button"
        >
          ―
        </button>
        <button
          @click="editor.chain().focus().undo().run()"
          :disabled="!editor.can().undo()"
          class="toolbar-btn"
          title="Undo (Ctrl+Z)"
          type="button"
        >
          ↶
        </button>
        <button
          @click="editor.chain().focus().redo().run()"
          :disabled="!editor.can().redo()"
          class="toolbar-btn"
          title="Redo (Ctrl+Shift+Z)"
          type="button"
        >
          ↷
        </button>
      </div>
    </div>

    <!-- Editor Content -->
    <editor-content :editor="editor" class="editor-content" />

    <!-- Character/Word Count -->
    <div v-if="showStats && editor" class="editor-stats">
      <span class="stat">{{ characterCount }} characters</span>
      <span class="stat-divider">•</span>
      <span class="stat">{{ wordCount }} words</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'

interface Props {
  modelValue?: string | object // Support both JSON and HTML
  placeholder?: string
  editable?: boolean
  showStats?: boolean
  autofocus?: boolean
  minHeight?: string
  maxHeight?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: 'Start typing...',
  editable: true,
  showStats: false,
  autofocus: false,
  minHeight: '120px',
  maxHeight: '500px'
})

const emit = defineEmits<{
  'update:modelValue': [value: object]
  'blur': []
  'focus': []
}>()

// Mobile detection
const isMobile = ref(false)
const isFocused = ref(false)

// Initialize lowlight for code syntax highlighting
const lowlight = createLowlight(common)

// Initialize Tiptap editor
const editor = useEditor({
  extensions: [
    StarterKit.configure({
      codeBlock: false // Disable default code block to use lowlight version
    }),
    TaskList,
    TaskItem.configure({
      nested: true
    }),
    Table.configure({
      resizable: true
    }),
    TableRow,
    TableCell,
    TableHeader,
    CodeBlockLowlight.configure({
      lowlight
    })
  ],
  content: getInitialContent(),
  editable: props.editable,
  autofocus: props.autofocus,
  editorProps: {
    attributes: {
      class: 'prose prose-sm max-w-none',
      style: `min-height: ${props.minHeight}; max-height: ${props.maxHeight};`
    }
  },
  onUpdate: ({ editor }) => {
    // Emit ProseMirror JSON for IndexedDB storage
    const json = editor.getJSON()
    emit('update:modelValue', json)
  },
  onFocus: () => {
    isFocused.value = true
    emit('focus')
  },
  onBlur: () => {
    isFocused.value = false
    emit('blur')
  }
})

// Get initial content - support both JSON and HTML
function getInitialContent() {
  if (!props.modelValue) return ''

  // If it's already a ProseMirror JSON object
  if (typeof props.modelValue === 'object') {
    return props.modelValue
  }

  // If it's HTML or plain text
  return props.modelValue
}

// Watch for external changes to modelValue
watch(() => props.modelValue, (newValue) => {
  if (!editor.value) return

  const currentContent = editor.value.getJSON()
  const isSame = JSON.stringify(currentContent) === JSON.stringify(newValue)

  if (!isSame && newValue) {
    editor.value.commands.setContent(newValue, false)
  }
})

// Watch editable prop
watch(() => props.editable, (newValue) => {
  if (editor.value) {
    editor.value.setEditable(newValue)
  }
})

// Character and word count
const characterCount = computed(() => {
  if (!editor.value) return 0
  return editor.value.state.doc.textContent.length
})

const wordCount = computed(() => {
  if (!editor.value) return 0
  const text = editor.value.state.doc.textContent
  return text.trim().split(/\s+/).filter(word => word.length > 0).length
})

// Helper function to add table
const addTable = () => {
  if (editor.value) {
    editor.value
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run()
  }
}

// Detect mobile device
onMounted(() => {
  isMobile.value = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
})

// Cleanup
onBeforeUnmount(() => {
  if (editor.value) {
    editor.value.destroy()
  }
})

// Expose editor instance for parent component access
defineExpose({
  editor,
  getJSON: () => editor.value?.getJSON(),
  getHTML: () => editor.value?.getHTML(),
  getText: () => editor.value?.getText(),
  setContent: (content: any) => editor.value?.commands.setContent(content),
  focus: () => editor.value?.commands.focus(),
  clear: () => editor.value?.commands.clearContent()
})
</script>

<style scoped>
.rich-text-editor {
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.rich-text-editor.is-focused {
  border-color: var(--calendar-creating-border);
  background: linear-gradient(
    135deg,
    var(--glass-bg-heavy) 0%,
    var(--glass-bg-tint) 100%
  );
  box-shadow:
    0 0 0 3px var(--calendar-creating-bg),
    inset var(--shadow-sm);
}

/* Toolbar */
.editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--glass-bg-subtle);
  border-bottom: 1px solid var(--glass-bg-heavy);
}

.is-mobile .editor-toolbar {
  gap: var(--space-1);
  padding: var(--space-2);
}

.toolbar-group {
  display: flex;
  gap: var(--space-1);
  align-items: center;
}

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: var(--glass-bg-heavy);
  margin: 0 var(--space-1);
}

.is-mobile .toolbar-divider {
  display: none;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: var(--space-2);
  background: var(--glass-bg-tint);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  user-select: none;
}

.is-mobile .toolbar-btn {
  min-width: 44px; /* iOS minimum tap target */
  height: 44px;
  font-size: var(--text-base);
}

.toolbar-btn:hover:not(:disabled) {
  background: var(--glass-bg-soft);
  border-color: var(--purple-border-light);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.toolbar-btn:active:not(:disabled) {
  transform: translateY(0);
}

.toolbar-btn.is-active {
  background: linear-gradient(
    135deg,
    var(--purple-bg-start) 0%,
    var(--purple-bg-end) 100%
  );
  border-color: var(--purple-border-medium);
  color: var(--text-primary);
  box-shadow: var(--purple-glow-subtle);
}

.toolbar-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toolbar-btn .icon {
  font-family: inherit;
}

.toolbar-btn .icon.italic {
  font-style: italic;
}

.toolbar-btn .icon.code {
  font-family: monospace;
}

/* Editor Content */
.editor-content {
  padding: var(--space-4);
  overflow-y: auto;
}

.is-mobile .editor-content {
  padding: var(--space-3);
}

/* ProseMirror styles */
:deep(.ProseMirror) {
  outline: none;
  color: var(--text-primary);
  font-size: var(--text-sm);
  line-height: 1.6;
}

:deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: var(--text-muted);
  pointer-events: none;
  height: 0;
  float: left;
}

/* Headings */
:deep(.ProseMirror h1) {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  margin-top: var(--space-4);
  margin-bottom: var(--space-3);
  color: var(--text-primary);
}

:deep(.ProseMirror h2) {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  margin-top: var(--space-3);
  margin-bottom: var(--space-2);
  color: var(--text-primary);
}

:deep(.ProseMirror h3) {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  margin-top: var(--space-3);
  margin-bottom: var(--space-2);
  color: var(--text-secondary);
}

/* Lists */
:deep(.ProseMirror ul),
:deep(.ProseMirror ol) {
  padding-left: var(--space-6);
  margin: var(--space-2) 0;
}

:deep(.ProseMirror li) {
  margin: var(--space-1) 0;
}

/* Task Lists */
:deep(.ProseMirror ul[data-type="taskList"]) {
  list-style: none;
  padding-left: 0;
}

:deep(.ProseMirror ul[data-type="taskList"] li) {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

:deep(.ProseMirror ul[data-type="taskList"] li > label) {
  flex: 0 0 auto;
  margin-top: 2px;
  user-select: none;
}

:deep(.ProseMirror ul[data-type="taskList"] li > div) {
  flex: 1 1 auto;
}

:deep(.ProseMirror ul[data-type="taskList"] input[type="checkbox"]) {
  cursor: pointer;
  width: 16px;
  height: 16px;
}

/* Code */
:deep(.ProseMirror code) {
  background: var(--glass-bg-heavy);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
  color: var(--brand-primary);
}

/* Code Block */
:deep(.ProseMirror pre) {
  background: var(--glass-bg-heavy);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  margin: var(--space-3) 0;
  overflow-x: auto;
  font-family: 'Courier New', monospace;
  font-size: var(--text-sm);
  line-height: 1.5;
}

:deep(.ProseMirror pre code) {
  background: transparent;
  border: none;
  padding: 0;
  color: var(--text-primary);
}

/* Blockquote */
:deep(.ProseMirror blockquote) {
  border-left: 3px solid var(--purple-border-medium);
  padding-left: var(--space-4);
  margin: var(--space-3) 0;
  color: var(--text-secondary);
  font-style: italic;
}

/* Horizontal Rule */
:deep(.ProseMirror hr) {
  border: none;
  border-top: 2px solid var(--glass-bg-heavy);
  margin: var(--space-4) 0;
}

/* Table */
:deep(.ProseMirror table) {
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
  margin: var(--space-3) 0;
  overflow: hidden;
}

:deep(.ProseMirror td),
:deep(.ProseMirror th) {
  border: 1px solid var(--glass-border);
  padding: var(--space-2) var(--space-3);
  vertical-align: top;
  box-sizing: border-box;
  position: relative;
  min-width: 100px;
}

:deep(.ProseMirror th) {
  background: var(--glass-bg-soft);
  font-weight: var(--font-semibold);
  text-align: left;
}

:deep(.ProseMirror .selectedCell) {
  background: var(--purple-bg-subtle);
}

/* Editor Stats */
.editor-stats {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--glass-bg-weak);
  border-top: 1px solid var(--glass-bg-heavy);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.stat-divider {
  color: var(--glass-border);
}

/* Dark theme */
:root.dark-theme .rich-text-editor {
  background: var(--surface-tertiary);
  border-color: var(--border-medium);
}

:root.dark-theme .editor-toolbar {
  background: var(--surface-secondary);
  border-bottom-color: var(--border-medium);
}

:root.dark-theme .toolbar-btn {
  background: var(--surface-tertiary);
  border-color: var(--border-medium);
  color: var(--text-muted);
}

:root.dark-theme .toolbar-btn:hover:not(:disabled) {
  background: var(--surface-primary);
  border-color: var(--brand-primary);
  color: var(--text-primary);
}

:root.dark-theme :deep(.ProseMirror code) {
  background: var(--surface-secondary);
  border-color: var(--border-medium);
}

:root.dark-theme :deep(.ProseMirror pre) {
  background: var(--surface-secondary);
  border-color: var(--border-medium);
}
</style>
