import type { Meta, StoryObj } from '@storybook/vue3'
import MarkdownEditor from '@/components/common/MarkdownEditor.vue'
import { ref } from 'vue'

const meta: Meta<typeof MarkdownEditor> = {
  title: '🧩 Primitives/MarkdownEditor',
  component: MarkdownEditor,
  tags: ['autodocs', 'new'],
  parameters: {
    docs: {
      description: {
        component: 'WYSIWYG markdown editor using Tiptap. Supports full toolbar, task lists, tables, text formatting, and RTL auto-detection.'
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Empty editor ready for input
 */
export const Empty: Story = {
  render: () => ({
    components: { MarkdownEditor },
    setup() {
      const content = ref('')
      return { content }
    },
    template: `
      <div style="padding: var(--space-6); max-width: 800px;">
        <MarkdownEditor v-model="content" />
      </div>
    `
  })
}

/**
 * Editor with sample markdown content
 */
export const WithContent: Story = {
  render: () => ({
    components: { MarkdownEditor },
    setup() {
      const content = ref(`# Project Plan

## Objectives
- Complete feature implementation
- Write tests
- Update documentation

## Tasks
- [ ] Design database schema
- [x] Implement API endpoints
- [ ] Create frontend components

**Priority:** High
*Due:* February 20, 2026`)
      return { content }
    },
    template: `
      <div style="padding: var(--space-6); max-width: 800px;">
        <MarkdownEditor v-model="content" />
        <div style="margin-top: var(--space-4); padding: var(--space-3); background: var(--surface-tertiary); border-radius: var(--radius-md);">
          <h3 style="margin: 0 0 var(--space-2); color: var(--text-primary);">Markdown Output:</h3>
          <pre style="margin: 0; color: var(--text-secondary); font-size: var(--text-sm); white-space: pre-wrap;">{{ content }}</pre>
        </div>
      </div>
    `
  })
}

/**
 * RTL content detection
 */
export const RTLContent: Story = {
  render: () => ({
    components: { MarkdownEditor },
    setup() {
      const content = ref('مهمة مهمة جداً - يجب إكمالها اليوم')
      return { content }
    },
    template: `
      <div style="padding: var(--space-6); max-width: 800px;">
        <p style="color: var(--text-primary); margin-bottom: var(--space-2);">
          Editor automatically detects RTL text direction
        </p>
        <MarkdownEditor v-model="content" />
      </div>
    `
  })
}
