import ConflictResolutionDialog from '@/components/sync/ConflictResolutionDialog.vue'

const meta = {
    title: 'PLACEHOLDER',
  component: ConflictResolutionDialog,
    title: '🔄 Sync & Reliability/ConflictResolutionDialog',
    tags: ['autodocs'],
    parameters: {
        layout: 'padded',
    }
}

export default meta

const mockTaskConflict = {
    localTask: {
        id: 't1',
        title: 'Update Project Layout (Local)',
        description: 'Updated description on mobile device.',
        priority: 'high',
        updatedAt: Date.now()
    },
    remoteTask: {
        id: 't1',
        title: 'Update Project Layout (Remote)',
        description: 'Cloud version of the description.',
        priority: 'medium',
        updatedAt: Date.now() - 3600000
    },
    priority: 'high',
    conflicts: [
        {
            field: 'title',
            localValue: 'Update Project Layout (Local)',
            remoteValue: 'Update Project Layout (Remote)',
            severity: 'medium',
            autoResolvable: false
        },
        {
            field: 'description',
            localValue: 'Updated description on mobile device.',
            remoteValue: 'Cloud version of the description.',
            severity: 'low',
            autoResolvable: true,
            suggestedResolution: 'Updated description on mobile device (merged with cloud context)'
        }
    ]
}

export const Default = {
    args: {
        taskConflict: mockTaskConflict as any,
        onResolve: (res: any) => console.log('Resolved with:', res),
        onCancel: () => console.log('Cancelled')
    }
}

export const SingleConflict = {
    args: {
        taskConflict: {
            ...mockTaskConflict,
            conflicts: [mockTaskConflict.conflicts[0]]
        } as any
    }
}
