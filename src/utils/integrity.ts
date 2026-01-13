/**
 * Integrity Service
 * 
 * Provides utilities for data hashing and checksum calculation
 * to ensure data stability and detect corruption.
 */

export class IntegrityService {
    /**
     * Compute SHA-256 hash or similar for tasks
     */
    public computeTaskHash(tasks: unknown[]): string {
        return this.calculateChecksum(tasks)
    }

    /**
     * Create fingerprint for tasks
     */
    public createTaskFingerprint(tasks: unknown[]): string {
        return this.calculateChecksum(tasks)
    }

    /**
     * Calculates a simple hash for any data structure.
     * Ensures consistent results by sorting object keys.
     */
    public calculateChecksum(data: unknown): string {
        if (data === undefined || data === null) return '0'

        // 1. Serialize data with stable key ordering
        const serialized = this.stableStringify(data)

        // 2. Generate a simple hash (DJB2 algorithm)
        let hash = 5381
        for (let i = 0; i < serialized.length; i++) {
            hash = (hash * 33) ^ serialized.charCodeAt(i)
        }

        // Return as unsigned 32-bit hex string
        return (hash >>> 0).toString(16)
    }

    /**
     * Stable JSON.stringify that sorts object keys recursively
     */
    private stableStringify(data: unknown): string {
        if (typeof data !== 'object' || data === null) {
            return JSON.stringify(data)
        }

        if (Array.isArray(data)) {
            return '[' + data.map(item => this.stableStringify(item)).join(',') + ']'
        }

        // Object: Sort keys alphabetically
        const keys = Object.keys(data as object).sort()
        const parts = keys.map(key => {
            const value = (data as Record<string, unknown>)[key]
            return `"${key}":${this.stableStringify(value)}`
        })

        return '{' + parts.join(',') + '}'
    }
}

// Export as singleton for easy usage
export default new IntegrityService()
