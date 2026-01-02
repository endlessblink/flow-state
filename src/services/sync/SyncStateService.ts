
import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type { ConflictInfo, ResolutionResult } from '@/types/conflicts'
import type { SyncValidationResult } from '@/utils/syncValidator'

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'complete' | 'resolving_conflicts' | 'validating' | 'offline' | 'paused'

export interface SyncHealth {
    syncStatus: SyncStatus
    conflictCount: number
    hasErrors: boolean
    queueStatus: { length: number; processing: boolean; isOnline: boolean }
    lastValidation?: SyncValidationResult
    isOnline: boolean
    deviceId: string
    uptime: number
}

export interface SyncMetrics {
    totalSyncs: number
    successfulSyncs: number
    failedSyncs: number
    conflictsDetected: number
    conflictsResolved: number
    averageSyncTime: number
    lastSyncTime?: Date
    uptime: number
    successRate?: number
    conflictsRate?: number
}


export class SyncStateService {
    // Reactive State
    public readonly syncStatus: Ref<SyncStatus> = ref('idle')
    public readonly error: Ref<string | null> = ref(null)
    public readonly isOnline: Ref<boolean> = ref(navigator.onLine)
    public readonly lastSyncTime: Ref<Date | null>
    public readonly pendingChanges: Ref<number> = ref(0)
    public readonly remoteConnected: Ref<boolean> = ref(false)
    public readonly hasConnectedEver: Ref<boolean>

    // Conflict State
    public readonly conflicts: Ref<ConflictInfo[]> = ref([])
    public readonly resolutions: Ref<ResolutionResult[]> = ref([])
    public readonly lastValidation: Ref<SyncValidationResult | null> = ref(null)

    // Metrics
    public readonly metrics: Ref<SyncMetrics> = ref({
        totalSyncs: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        conflictsDetected: 0,
        conflictsResolved: 0,
        averageSyncTime: 0,
        uptime: Date.now()
    })

    // Computed
    public readonly isSyncing: ComputedRef<boolean>
    public readonly hasErrors: ComputedRef<boolean>

    constructor() {
        // Initialize persistence
        const storedLastSync = localStorage.getItem('pomoflow_lastSyncTime')
        this.lastSyncTime = ref(storedLastSync ? new Date(storedLastSync) : null)

        this.hasConnectedEver = ref(localStorage.getItem('pomoflow_hasConnectedEver') === 'true')

        this.isSyncing = computed(() =>
            this.syncStatus.value === 'syncing' ||
            this.syncStatus.value === 'resolving_conflicts' ||
            this.syncStatus.value === 'validating'
        )

        this.hasErrors = computed(() => this.error.value !== null)
    }

    public updateStatus(status: SyncStatus) {
        this.syncStatus.value = status
    }

    public setError(msg: string | null) {
        this.error.value = msg
        if (msg) {
            this.syncStatus.value = 'error'
        }
    }

    public setOnline(status: boolean) {
        this.isOnline.value = status
    }

    public updateLastSync(date: Date) {
        this.lastSyncTime.value = date
        localStorage.setItem('pomoflow_lastSyncTime', date.toISOString())
    }

    public markConnected() {
        this.remoteConnected.value = true
        if (!this.hasConnectedEver.value) {
            this.hasConnectedEver.value = true
            localStorage.setItem('pomoflow_hasConnectedEver', 'true')
        }
    }

    public recordMetric(type: 'success' | 'failure' | 'conflict_detected' | 'conflict_resolved', duration?: number) {
        switch (type) {
            case 'success':
                this.metrics.value.successfulSyncs++
                this.metrics.value.totalSyncs++
                if (duration) {
                    this.updateAverageTime(duration)
                }
                break
            case 'failure':
                this.metrics.value.failedSyncs++
                this.metrics.value.totalSyncs++
                break
            case 'conflict_detected':
                this.metrics.value.conflictsDetected++
                break
            case 'conflict_resolved':
                this.metrics.value.conflictsResolved++
                break
        }
    }

    private updateAverageTime(duration: number) {
        const currentAvg = this.metrics.value.averageSyncTime
        const count = this.metrics.value.successfulSyncs
        // weighted average
        this.metrics.value.averageSyncTime = Math.round(((currentAvg * (count - 1)) + duration) / count)
    }

    public getHealth(): SyncHealth {
        return {
            syncStatus: this.syncStatus.value,
            conflictCount: this.conflicts.value.length,
            hasErrors: this.hasErrors.value,
            queueStatus: {
                length: 0, // Pending integration
                processing: false,
                isOnline: this.isOnline.value
            },
            lastValidation: this.lastValidation.value || undefined,
            isOnline: this.isOnline.value,
            deviceId: 'unknown', // Set externally
            uptime: Math.floor((Date.now() - this.metrics.value.uptime) / 1000)
        }
    }
}

// Singleton for global state sharing if needed, 
// though Composition API usually prefers `useSyncState` which returns a singleton instance.
export const syncState = new SyncStateService()
