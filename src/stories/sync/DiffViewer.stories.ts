import DiffViewer from '@/components/sync/DiffViewer.vue'

const meta = {
    title: 'PLACEHOLDER',
  component: DiffViewer,
    title: '🔄 Sync & Reliability/DiffViewer',
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
    },
    argTypes: {
        mode: { control: 'select', options: ['local', 'remote'] },
        fieldType: { control: 'select', options: ['text', 'array', 'object', 'datetime', 'boolean'] }
    }
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
