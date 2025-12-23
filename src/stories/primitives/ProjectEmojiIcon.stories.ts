import type { Meta, StoryObj } from '@storybook/vue3'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'

const meta = {
    component: ProjectEmojiIcon,
    title: '🧩 Primitives/ProjectEmojiIcon',
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
    },
    argTypes: {
        size: { control: 'select', options: ['xs', 'sm', 'md', 'lg'] },
        variant: { control: 'select', options: ['default', 'plain'] },
        emoji: { control: 'text' },
        clickable: { control: 'boolean' }
    }
} satisfies Meta<typeof ProjectEmojiIcon>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
    args: {
        emoji: '🚀',
        size: 'md',
        variant: 'default'
    }
}

export const Plain: Story = {
    args: {
        emoji: '📂',
        size: 'md',
        variant: 'plain'
    }
}

export const Sizes: Story = {
    render: (args) => ({
        components: { ProjectEmojiIcon },
        setup() { return { args } },
        template: `
      <div style="display: flex; gap: 16px; align-items: center;">
        <ProjectEmojiIcon v-bind="args" size="xs" emoji="🍎" />
        <ProjectEmojiIcon v-bind="args" size="sm" emoji="🍎" />
        <ProjectEmojiIcon v-bind="args" size="md" emoji="🍎" />
        <ProjectEmojiIcon v-bind="args" size="lg" emoji="🍎" />
      </div>
    `
    })
}

export const Clickable: Story = {
    args: {
        emoji: '✨',
        size: 'lg',
        variant: 'default',
        clickable: true,
        title: 'Click me!'
    }
}
