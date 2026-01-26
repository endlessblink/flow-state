
import type { useVueFlow } from '@vue-flow/core';
import { type VueFlow } from '@vue-flow/core'

export interface NodeBatcher {
    flush: () => void
    clear: () => void
}

class CanvasResourceManager {
    private static instance: CanvasResourceManager

    // Store all active watchers for cleanup
    private watchers: Array<() => void> = []
    // Store all event listeners for cleanup
    private eventListeners: Array<{ element: EventTarget; event: string; handler: EventListener; options?: AddEventListenerOptions | boolean }> = []
    // Store all timers for cleanup
    private timers: Array<number> = []
    // Store all intervals for cleanup
    private intervals: Array<number> = []
    // Store all cleanup callbacks for cleanup
    private cleanupCallbacks: Array<() => void> = []
    // Store Vue Flow instance for cleanup
    private vueFlowInstance: ReturnType<typeof useVueFlow> | null = null
    // Store Vue Flow ref for cleanup
    private vueFlowRef: InstanceType<typeof VueFlow> | null = null
    // Store node update batcher for cleanup
    private nodeBatcher: NodeBatcher | null = null

    private constructor() { }

    public static getInstance(): CanvasResourceManager {
        if (!CanvasResourceManager.instance) {
            CanvasResourceManager.instance = new CanvasResourceManager()
        }
        return CanvasResourceManager.instance
    }

    addWatcher(unwatch: () => void) {
        this.watchers.push(unwatch)
    }

    // Add cleanup callback to be called during cleanup
    addCleanupCallback(callback: () => void) {
        this.cleanupCallbacks.push(callback)
    }

    // Add event listener to cleanup list
    addEventListener(element: EventTarget | null | undefined, event: string, handler: EventListener, options?: AddEventListenerOptions | boolean) {
        // Add null check to prevent errors when element is not available
        if (!element) return

        // Check if element has addEventListener method
        if (typeof element.addEventListener !== 'function') return

        element.addEventListener(event, handler, options)
        this.eventListeners.push({ element, event, handler, options })
    }

    // Add timer to cleanup list
    addTimer(timerId: number) {
        this.timers.push(timerId)
        return timerId
    }

    // Add interval to cleanup list
    addInterval(intervalId: number) {
        this.intervals.push(intervalId)
        return intervalId
    }

    // Clean up all resources
    cleanup() {
        // Clean up watchers
        this.watchers.forEach(unwatch => {
            try {
                unwatch()
            } catch (_error) {
                // Ignore errors during cleanup
            }
        })
        this.watchers = []

        // Clean up event listeners
        this.eventListeners.forEach(({ element, event, handler, options }) => {
            try {
                if (element && typeof element.removeEventListener === 'function') {
                    element.removeEventListener(event, handler, options)
                }
            } catch (_error) {
                // Ignore
            }
        })
        this.eventListeners = []

        // Clean up timers
        this.timers.forEach(timerId => {
            try {
                clearTimeout(timerId)
            } catch (_error) {
                // Ignore
            }
        })
        this.timers = []

        // Clean up intervals
        this.intervals.forEach(intervalId => {
            try {
                clearInterval(intervalId)
            } catch (_error) {
                // Ignore
            }
        })
        this.intervals = []

        // Clean up cleanup callbacks
        this.cleanupCallbacks.forEach(callback => {
            try {
                callback()
            } catch (_error) {
                // Ignore
            }
        })
        this.cleanupCallbacks = []

        // Enhanced Vue Flow cleanup
        this.cleanupVueFlow()

        // Clean up node update batcher
        if (this.nodeBatcher) {
            try {
                this.nodeBatcher.clear()
            } catch (_error) {
                // Ignore
            }
            this.nodeBatcher = null
        }
    }

    // Enhanced Vue Flow specific cleanup
    cleanupVueFlow() {
        try {
            // Clear Vue Flow instance
            if (this.vueFlowInstance) {
                const instance = this.vueFlowInstance as { destroy?: () => void; clearNodes?: () => void; clearEdges?: () => void }
                if (typeof instance.destroy === 'function') {
                    instance.destroy()
                }

                // Clear internal maps if exposed methods exist
                if (typeof instance.clearNodes === 'function') instance.clearNodes()
                if (typeof instance.clearEdges === 'function') instance.clearEdges()

                this.vueFlowInstance = null
            }

            // Clean up any remaining DOM elements
            // Use specific selectors if needed, but generally Vue handles DOM removal.
            // Explicit DOM removal is risky if Vue is still managing it.
            // We'll rely on Vue unmount unless specifically orphaned.

            // Clear any global Vue Flow references
            if (typeof window !== 'undefined') {
                const windowExt = window as unknown as Record<string, unknown>
                delete windowExt.__vueFlow
                delete windowExt.__vueFlowInstances
            }

        } catch (_error) {
            // Ignore
        }
    }

    // Set Vue Flow ref for cleanup
    setVueFlowRef(ref: InstanceType<typeof VueFlow> | null) {
        this.vueFlowRef = ref
    }

    // Set node update batcher for cleanup
    setNodeBatcher(batcher: NodeBatcher | null) {
        this.nodeBatcher = batcher
    }
}

export default CanvasResourceManager.getInstance()
