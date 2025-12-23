import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'

const meta = {
    title: '🧩 Primitives/ProjectEmojiIcon',
    component: ProjectEmojiIcon,
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
}

export default meta

export const Default = {
    args: {
        emoji: '🚀',
        size: 'md',
        variant: 'default'
    }
}

export const Plain = {
    args: {
        emoji: '📂',
        size: 'md',
        variant: 'plain'
    }
}

export const Clickable = {
    args: {
        emoji: '✨',
        size: 'lg',
        variant: 'default',
        clickable: true,
        title: 'Click me!'
    }
}
