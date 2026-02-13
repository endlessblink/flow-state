import type { Meta, StoryObj } from '@storybook/vue3'
import MarkdownRenderer from '@/components/common/MarkdownRenderer.vue'

const meta: Meta<typeof MarkdownRenderer> = {
  title: '🧩 Primitives/MarkdownRenderer',
  component: MarkdownRenderer,
  tags: ['autodocs', 'new'],
  parameters: {
    docs: {
      description: {
        component: 'Read-only markdown renderer with GFM task lists, code blocks, and RTL support. Used to display task descriptions.'
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Basic markdown with headings and lists
 */
export const BasicMarkdown: Story = {
  args: {
    content: `# Project Overview

This is a **high-priority** task that needs completion by *end of week*.

## Tasks
- Research options
- Draft proposal
- Get approval`
  }
}

/**
 * GFM task lists with checkboxes
 */
export const TaskLists: Story = {
  args: {
    content: `## Implementation Checklist

- [x] Set up database schema
- [x] Create API endpoints
- [ ] Build frontend components
- [ ] Write unit tests
- [ ] Deploy to staging`
  }
}

/**
 * Code blocks and inline code
 */
export const WithCode: Story = {
  args: {
    content: `## Installation

Run the following command:

\`\`\`bash
npm install flowstate
npm run dev
\`\`\`

Then edit the \`config.ts\` file.`
  }
}

/**
 * RTL content rendering
 */
export const RTLContent: Story = {
  args: {
    content: `# مهمة مهمة

هذه مهمة **عاجلة** يجب إكمالها اليوم.

## الخطوات
- البحث عن الحلول
- كتابة التقرير
- المراجعة النهائية`
  }
}

/**
 * Mixed formatting
 */
export const Complex: Story = {
  args: {
    content: `# Feature Implementation

> **Note:** This task blocks release 2.0

## Description
Implement the new **AI-powered** task breakdown feature. This will allow users to:

1. Select any task
2. Right-click for context menu
3. Choose "AI Assist > Break down"
4. Review suggested subtasks

## Technical Details
- API: \`POST /api/ai/breakdown\`
- Response time: ~2-3 seconds
- Requires \`GROQ_API_KEY\` env variable

## Checklist
- [x] Design API schema
- [ ] Implement backend endpoint
- [ ] Add frontend integration
- [ ] Write tests

---

**Priority:** High | **Due:** 2026-02-20 | **Est:** 4h`
  }
}
