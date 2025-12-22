
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
        if (priority === 'high') {
            // High priority updates run immediately
            update()
            return
        }

        this.batchQueue.push(update)

        // Start batch processing if not already running
        if (!this.isProcessing) {
            this.startBatchProcessing()
        }
    }

    private startBatchProcessing() {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout)
        }

        this.batchTimeout = window.setTimeout(() => {
            this.processBatch()
        }, this.BATCH_DELAY)
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
