
import { type Ref } from 'vue'
import type { useVueFlow} from '@vue-flow/core';
import { type VueFlow, type Node, type Edge } from '@vue-flow/core'

export interface NodeBatcher {
    flush: () => void
    clear: () => void
}

export function useCanvasResourceManager(
    nodes: Ref<Node[]>,
    edges: Ref<Edge[]>
) {
    const resourceManager = {
        // Store all active watchers for cleanup
        watchers: [] as Array<() => void>,
        // Store all event listeners for cleanup
        eventListeners: [] as Array<{ element: EventTarget; event: string; handler: EventListener; options?: AddEventListenerOptions | boolean }>,
        // Store all timers for cleanup
        timers: [] as Array<number>,
        // Store all intervals for cleanup
        intervals: [] as Array<number>,
        // Store all cleanup callbacks for cleanup
        cleanupCallbacks: [] as Array<() => void>,
        // Store Vue Flow instance for cleanup
        vueFlowInstance: null as ReturnType<typeof useVueFlow> | null,
        // Store Vue Flow ref for cleanup
        vueFlowRef: null as InstanceType<typeof VueFlow> | null,
        // Store node update batcher for cleanup
        nodeBatcher: null as NodeBatcher | null,

        addWatcher(unwatch: () => void) {
            this.watchers.push(unwatch)
        },

        // Add cleanup callback to be called during cleanup
        addCleanupCallback(callback: () => void) {
            this.cleanupCallbacks.push(callback)
        },

        // Add event listener to cleanup list
        addEventListener(element: EventTarget | null | undefined, event: string, handler: EventListener, options?: AddEventListenerOptions | boolean) {
            // Add null check to prevent errors when element is not available
            if (!element) {
                console.warn(`⚠️ [RESOURCE_MANAGER] Cannot add event listener for "${event}" - element is null or undefined`)
                return
            }

            // Check if element has addEventListener method
            if (typeof element.addEventListener !== 'function') {
                console.warn(`⚠️ [RESOURCE_MANAGER] Element does not have addEventListener method for "${event}"`)
                return
            }

            element.addEventListener(event, handler, options)
            this.eventListeners.push({ element, event, handler, options })
        },

        // Add timer to cleanup list
        addTimer(timerId: number) {
            this.timers.push(timerId)
            return timerId
        },

        // Add interval to cleanup list
        addInterval(intervalId: number) {
            this.intervals.push(intervalId)
            return intervalId
        },

        // Clean up all resources
        cleanup() {
            console.log('🧹 [MEMORY] Cleaning up CanvasView resources...')

            // Clean up watchers
            this.watchers.forEach(unwatch => {
                try {
                    unwatch()
                } catch (error) {
                    console.warn('⚠️ [MEMORY] Error cleaning up watcher:', error)
                }
            })
            this.watchers = []

            // Clean up event listeners
            this.eventListeners.forEach(({ element, event, handler, options }) => {
                try {
                    if (element && typeof element.removeEventListener === 'function') {
                        element.removeEventListener(event, handler, options)
                    }
                } catch (error) {
                    console.warn('⚠️ [MEMORY] Error removing event listener:', error)
                }
            })
            this.eventListeners = []

            // Clean up timers
            this.timers.forEach(timerId => {
                try {
                    clearTimeout(timerId)
                } catch (error) {
                    console.warn('⚠️ [MEMORY] Error clearing timer:', error)
                }
            })
            this.timers = []

            // Clean up intervals
            this.intervals.forEach(intervalId => {
                try {
                    clearInterval(intervalId)
                } catch (error) {
                    console.warn('⚠️ [MEMORY] Error clearing interval:', error)
                }
            })
            this.intervals = []

            // Clean up cleanup callbacks
            this.cleanupCallbacks.forEach(callback => {
                try {
                    callback()
                } catch (error) {
                    console.warn('⚠️ [MEMORY] Error executing cleanup callback:', error)
                }
            })
            this.cleanupCallbacks = []

            // Enhanced Vue Flow cleanup
            this.cleanupVueFlow()

            // Clean up node update batcher
            if (this.nodeBatcher) {
                try {
                    this.nodeBatcher.clear()
                    console.log('🧹 [BATCH] Cleared node update batcher')
                } catch (error) {
                    console.warn('⚠️ [BATCH] Error clearing node update batcher:', error)
                }
                this.nodeBatcher = null
            }

            console.log('✅ [MEMORY] CanvasView resource cleanup completed')
        },

        // Enhanced Vue Flow specific cleanup
        cleanupVueFlow() {
            console.log('🧹 [VUE_FLOW] Starting Vue Flow cleanup...')

            try {
                // Clear reactive arrays first
                if (typeof nodes.value !== 'undefined' && nodes.value && Array.isArray(nodes.value)) {
                    nodes.value.length = 0
                    console.log('🧹 [VUE_FLOW] Cleared nodes array')
                }

                if (typeof edges.value !== 'undefined' && edges.value && Array.isArray(edges.value)) {
                    edges.value.length = 0
                    console.log('🧹 [VUE_FLOW] Cleared edges array')
                }

                // Clear Vue Flow instance
                if (this.vueFlowInstance) {
                    // @ts-ignore - destroy method might exist on internal instance
                    if (typeof this.vueFlowInstance.destroy === 'function') {
                        // @ts-ignore
                        this.vueFlowInstance.destroy()
                    }
                    // @ts-ignore - clearNodes might exist on internal instance
                    if (typeof this.vueFlowInstance.clearNodes === 'function') {
                        // @ts-ignore
                        this.vueFlowInstance.clearNodes()
                    }
                    // @ts-ignore - clearEdges might exist on internal instance
                    if (typeof this.vueFlowInstance.clearEdges === 'function') {
                        // @ts-ignore
                        this.vueFlowInstance.clearEdges()
                    }
                    this.vueFlowInstance = null
                    console.log('🧹 [VUE_FLOW] Cleared Vue Flow instance')
                }

                // Clean up any remaining DOM elements
                const remainingNodes = document.querySelectorAll('.vue-flow__node, .vue-flow__edge, .vue-flow__controls, .vue-flow__panel')
                if (remainingNodes.length > 0) {
                    console.log(`🧹 [VUE_FLOW] Removing ${remainingNodes.length} orphaned Vue Flow DOM elements`)
                    remainingNodes.forEach((node) => {
                        if (node.parentNode) {
                            node.parentNode.removeChild(node)
                        }
                    })
                }

                // Clear any global Vue Flow references
                if (typeof window !== 'undefined') {
                    const windowExt = window as unknown as Record<string, unknown>
                    delete windowExt.__vueFlow
                    delete windowExt.__vueFlowInstances
                }

            } catch (error) {
                console.warn('⚠️ [VUE_FLOW] Error during Vue Flow cleanup:', error)
            }

            console.log('✅ [VUE_FLOW] Vue Flow cleanup completed')
        },

        // Set Vue Flow ref for cleanup
        setVueFlowRef(ref: InstanceType<typeof VueFlow> | null) {
            this.vueFlowRef = ref
        },

        // Set node update batcher for cleanup
        setNodeBatcher(batcher: NodeBatcher | null) {
            this.nodeBatcher = batcher
        }
    }

    return resourceManager
}
