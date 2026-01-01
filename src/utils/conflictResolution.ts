export interface ConflictDiff {
    field: string
    localValue: unknown
    remoteValue: unknown
    baseValue: unknown
    conflictType: 'value' | 'deletion'
    severity: 'low' | 'medium' | 'high'
    autoResolvable: boolean
    suggestedResolution?: unknown
}

export type ConflictResolution = 'ask' | 'merge' | 'local' | 'remote'

export interface UserResolutionRule {
    name: string
    field: string
    condition: 'always' | 'when-empty' | 'when-newer' | 'when-contains' | 'when-longer' | string
    value?: unknown
    action: 'prefer-local' | 'prefer-remote' | 'prefer-non-empty' | 'prefer-true' | 'prefer-false' | 'prefer-longer' | 'prefer-newer' | 'prefer-earlier' | 'prefer-higher' | 'merge' | 'union' | 'merge-deep' | 'ask' | string
    priority: number
}

// Minimal Task interface to avoid circular deps if needed, or use any
export interface TaskConflict {
    taskId: string
    baseTask?: unknown
    localTask: any
    remoteTask: any
    conflicts: ConflictDiff[]
    priority: 'low' | 'medium' | 'high'
    timestamp: number
}
