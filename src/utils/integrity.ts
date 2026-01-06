import CryptoJS from 'crypto-js'
import type { Task } from '@/types/tasks'
import type { UnifiedTask } from '@/types/unified-task'

/**
 * Unified Integrity & Cryptography Service
 * Provides deterministic hashing, fingerprinting, and checksums for all app data.
 */

export type HashableTask = Task | UnifiedTask

export class IntegrityService {
    /**
     * Compute SHA-256 hash of task data (includes timestamps)
     * Used for detecting ANY change.
     */
    static computeTaskHash(tasks: HashableTask[]): string {
        if (!tasks || tasks.length === 0) return ''

        const normalized = [...tasks]
            .sort((a, b) => a.id.localeCompare(b.id))
            .map(task => {
                // Handle UnifiedTask vs Task differences
                const status = 'status' in task ? task.status : (task as any).stage
                const priority = 'priority' in task ? task.priority : (task as any).metadata?.priority
                const projectId = 'projectId' in task ? (task as any).projectId : (task as any).metadata?.source

                return {
                    id: task.id,
                    title: task.title,
                    description: task.description,
                    status,
                    priority,
                    projectId,
                    createdAt: task.createdAt instanceof Date ? task.createdAt.toISOString() : task.createdAt,
                    updatedAt: task.updatedAt instanceof Date ? task.updatedAt.toISOString() : task.updatedAt
                }
            })

        return CryptoJS.SHA256(JSON.stringify(normalized)).toString()
    }

    /**
     * Create deterministic fingerprint (ignores timestamps)
     * Used for detecting functional changes vs metadata changes.
     */
    static createTaskFingerprint(tasks: HashableTask[]): string {
        if (!tasks || tasks.length === 0) return ''

        const normalized = [...tasks]
            .sort((a, b) => a.id.localeCompare(b.id))
            .map(task => {
                // Handle UnifiedTask vs Task differences
                const status = 'status' in task ? task.status : (task as any).stage
                const priority = 'priority' in task ? task.priority : (task as any).metadata?.priority
                const projectId = 'projectId' in task ? (task as any).projectId : (task as any).metadata?.source

                return {
                    id: task.id,
                    title: task.title,
                    description: task.description,
                    status,
                    priority,
                    projectId
                }
            })

        return CryptoJS.SHA256(JSON.stringify(normalized)).toString()
    }

    /**
     * Calculate simple checksum for non-critical integrity checks
     */
    static calculateChecksum(data: unknown): string {
        const str = JSON.stringify(data)
        let hash = 0
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i)
            hash = ((hash << 5) - hash) + char
            hash = hash & hash
        }
        return hash.toString(16)
    }

    /**
     * Calculate a secure SHA-256 hash of any JSON-serializable object
     */
    static calculateSecureHash(data: unknown): string {
        return CryptoJS.SHA256(JSON.stringify(data)).toString()
    }
}

export default IntegrityService
