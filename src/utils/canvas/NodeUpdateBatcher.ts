
import { nextTick, type Ref } from 'vue'

// 🚀 CPU Optimization: Efficient Node Update Batching System
export class NodeUpdateBatcher {
    private batchQueue: Array<() => void> = []
    private isProcessing = false
    private batchTimeout: number | null = null
    private readonly BATCH_DELAY = 16 // ~60fps
    private readonly MAX_BATCH_SIZE = 50
    private vueFlowRef: Ref<any> | null = null

    constructor(vueFlowRef?: Ref<any>) {
        this.vueFlowRef = vueFlowRef || null
    }

    setVueFlowRef(ref: Ref<any>) {
        this.vueFlowRef = ref
    }

    schedule(update: () => void, priority: 'high' | 'normal' | 'low' = 'normal') {
        // All priorities go through batching to prevent cascading syncs
        // High priority uses shorter delay (8ms), normal is 16ms (~60fps), low is 32ms
        const priorityDelay = {
            high: 8,
            normal: this.BATCH_DELAY,
            low: 32
        }

        this.batchQueue.push(update)

        // Always restart with appropriate delay when high priority comes in
        if (priority === 'high') {
            if (this.batchTimeout) {
                clearTimeout(this.batchTimeout)
            }
            this.batchTimeout = window.setTimeout(() => {
                this.processBatch()
            }, priorityDelay.high)
            return
        }

        // Start batch processing if not already running
        if (!this.isProcessing && !this.batchTimeout) {
            this.startBatchProcessing(priorityDelay[priority])
        }
    }

    private startBatchProcessing(delay: number = this.BATCH_DELAY) {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout)
        }

        this.batchTimeout = window.setTimeout(() => {
            this.processBatch()
        }, delay)
    }

    private processBatch() {
        if (this.isProcessing || this.batchQueue.length === 0) return

        this.isProcessing = true

        try {
            // Process updates in chunks to avoid blocking the main thread
            const chunk = this.batchQueue.splice(0, Math.min(this.MAX_BATCH_SIZE, this.batchQueue.length))

            // Batch all DOM updates together
            chunk.forEach(update => {
                try {
                    update()
                } catch (error) {
                    console.warn('⚠️ [BATCH] Error in batched update:', error)
                }
            })

            // Update Vue Flow internals once after all updates
            nextTick(() => {
                const vueFlowInstance = this.vueFlowRef?.value as { updateNodeInternals?: () => void } | null
                vueFlowInstance?.updateNodeInternals?.()
            })

        } catch (error) {
            console.warn('⚠️ [BATCH] Error processing batch:', error)
        } finally {
            this.isProcessing = false

            // Continue processing if more items in queue
            if (this.batchQueue.length > 0) {
                this.startBatchProcessing()
            } else {
                this.batchTimeout = null
            }
        }
    }

    flush() {
        // Immediately process all pending updates
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout)
            this.batchTimeout = null
        }
        this.processBatch()
    }

    clear() {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout)
            this.batchTimeout = null
        }
        this.batchQueue.length = 0
        this.isProcessing = false
    }

    getQueueSize(): number {
        return this.batchQueue.length
    }
}
