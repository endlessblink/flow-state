import DiffViewer from '@/components/sync/DiffViewer.vue'

const meta = {
    component: DiffViewer,
    title: '🔄 Sync & Reliability/DiffViewer',
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            story: {
                inline: true,
            }
        }
    },
    argTypes: {
        mode: { control: 'select', options: ['local', 'remote'] },
        fieldType: { control: 'select', options: ['text', 'array', 'object', 'datetime', 'boolean'] }
    },
    decorators: [
        (story: any) => ({
            components: { story },
            template: `
        <div style="min-height: 1000px; width: 100%; padding: 40px; background: radial-gradient(circle at center, #3c2b5a 0%, #1a1a2e 100%); transform: scale(1); border-radius: var(--radius-xl);">
          <div style="position: relative; height: 100%; max-width: 1000px; margin: 0 auto;">
            <story />
          </div>
        </div>
      `
        })
    ]
}

export default meta

export const TextDiff = {
    args: {
        fieldType: 'text',
        value: 'The quick brown fox jumps over the lazy dog',
        compareValue: 'The quick brown fox leaps over the energetic dog',
        mode: 'local'
    }
}

export const ArrayDiff = {
    args: {
        fieldType: 'array',
        value: ['Task 1', 'Task 2', 'Task 3'],
        compareValue: ['Task 1', 'Task 2 Modified', 'Task 4'],
        mode: 'local'
    }
}

export const ObjectDiff = {
    args: {
        fieldType: 'object',
        value: { title: 'Old Title', priority: 'low' },
        compareValue: { title: 'New Title', priority: 'high', tags: ['new'] },
        mode: 'local'
    }
}

export const DateTimeDiff = {
    args: {
        fieldType: 'datetime',
        value: '2025-12-23T10:00:00Z',
        compareValue: '2025-12-24T12:00:00Z',
        mode: 'local'
    }
}

export const BooleanDiff = {
    args: {
        fieldType: 'boolean',
        value: true,
        compareValue: false,
        mode: 'local'
    }
}
