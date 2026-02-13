import type { Meta, StoryObj } from '@storybook/vue3'
import TiptapEditor from '@/components/common/TiptapEditor.vue'
import { ref } from 'vue'

const meta: Meta<typeof TiptapEditor> = {
  title: '🧩 Primitives/TiptapEditor',
  component: TiptapEditor,
  tags: ['autodocs', 'new'],
  parameters: {
    docs: {
      description: {
        component: 'Core Tiptap WYSIWYG editor with full toolbar. Handles HTML-to-markdown conversion, text formatting, tables, task lists, and color picker.'
      }
    }
  },
  argTypes: {
    textDirection: {
      control: 'radio',
      options: ['ltr', 'rtl']
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default LTR editor with toolbar
 */
export const Default: Story = {
  render: () => ({
    components: { TiptapEditor },
    setup() {
      const content = ref('')
      return { content }
    },
    template: `
      <div style="padding: var(--space-6); height: 500px;">
        <TiptapEditor v-model="content" text-direction="ltr" />
      </div>
    `
  })
}

/**
 * RTL editor for Arabic/Hebrew
 */
export const RTL: Story = {
  render: () => ({
    components: { TiptapEditor },
    setup() {
      const content = ref('')
      return { content }
    },
    template: `
      <div style="padding: var(--space-6); height: 500px;">
        <TiptapEditor v-model="content" text-direction="rtl" />
      </div>
    `
  })
}

/**
 * Toolbar features documentation
 */
export const ToolbarFeatures: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-6); max-width: 800px; color: var(--text-primary);">
        <h1 style="margin-bottom: var(--space-4);">Tiptap Editor Toolbar</h1>

        <section style="margin-bottom: var(--space-4);">
          <h3 style="margin-bottom: var(--space-2);">History</h3>
          <p style="color: var(--text-secondary);">Undo (Ctrl+Z), Redo (Ctrl+Y)</p>
        </section>

        <section style="margin-bottom: var(--space-4);">
          <h3 style="margin-bottom: var(--space-2);">Headings</h3>
          <p style="color: var(--text-secondary);">H1, H2, H3</p>
        </section>

        <section style="margin-bottom: var(--space-4);">
          <h3 style="margin-bottom: var(--space-2);">Text Formatting</h3>
          <p style="color: var(--text-secondary);">Bold (Ctrl+B), Italic (Ctrl+I), Underline (Ctrl+U), Strikethrough, Highlight</p>
        </section>

        <section style="margin-bottom: var(--space-4);">
          <h3 style="margin-bottom: var(--space-2);">Text Color</h3>
          <p style="color: var(--text-secondary);">Color picker dropdown with 8 preset colors</p>
        </section>

        <section style="margin-bottom: var(--space-4);">
          <h3 style="margin-bottom: var(--space-2);">Alignment</h3>
          <p style="color: var(--text-secondary);">Left, Center, Right</p>
        </section>

        <section style="margin-bottom: var(--space-4);">
          <h3 style="margin-bottom: var(--space-2);">Lists</h3>
          <p style="color: var(--text-secondary);">Bullet list, Numbered list, Task list (with checkboxes)</p>
        </section>

        <section style="margin-bottom: var(--space-4);">
          <h3 style="margin-bottom: var(--space-2);">Blocks</h3>
          <p style="color: var(--text-secondary);">Blockquote, Code block, Horizontal rule, Link (Ctrl+K)</p>
        </section>

        <section>
          <h3 style="margin-bottom: var(--space-2);">Tables</h3>
          <p style="color: var(--text-secondary);">Insert 3×3 table, Add/delete rows/columns</p>
        </section>
      </div>
    `
  })
}
