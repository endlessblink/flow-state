/**
 * useOfflineVoiceQueue - Offline voice recording queue
 * TASK-1131: Save audio blobs when offline, auto-transcribe when back online
 *
 * Uses IndexedDB to persist audio blobs across sessions.
 * VueUse's useOnline() detects connectivity changes.
 */

import { ref, computed, watch, readonly, onMounted } from 'vue'
import { useOnline } from '@vueuse/core'

export interface QueuedVoiceItem {
  id: string
  audioBlob: Blob
  mimeType: string
  createdAt: number
  retryCount: number
}

export interface UseOfflineVoiceQueueOptions {
  /** Database name for IndexedDB */
  dbName?: string
  /** Store name within the database */
  storeName?: string
  /** Max retry attempts before giving up */
  maxRetries?: number
  /** Callback when an item is successfully processed */
  onProcessed?: (result: { transcript: string; item: QueuedVoiceItem }) => void
  /** Callback when processing fails */
  onError?: (error: string, item: QueuedVoiceItem) => void
  /** Function to call Whisper API - must be provided */
  transcribeAudio?: (blob: Blob, mimeType: string) => Promise<{ text: string; language: string }>
}

const DEFAULT_OPTIONS = {
  dbName: 'flowstate-voice-queue',
  storeName: 'audio-queue',
  maxRetries: 3
}

// Singleton state for the queue (shared across component instances)
let db: IDBDatabase | null = null
const queue = ref<QueuedVoiceItem[]>([])
const isProcessing = ref(false)
const lastError = ref<string | null>(null)

export function useOfflineVoiceQueue(options: UseOfflineVoiceQueueOptions = {}) {
  const {
    dbName = DEFAULT_OPTIONS.dbName,
    storeName = DEFAULT_OPTIONS.storeName,
    maxRetries = DEFAULT_OPTIONS.maxRetries,
    onProcessed,
    onError,
    transcribeAudio
  } = options

  const isOnline = useOnline()
  const pendingCount = computed(() => queue.value.length)
  const hasPending = computed(() => queue.value.length > 0)

  /**
   * Initialize IndexedDB
   */
  const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      if (db) {
        resolve(db)
        return
      }

      const request = indexedDB.open(dbName, 1)

      request.onerror = () => {
        console.error('[OfflineVoice] IndexedDB error:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        db = request.result
        resolve(db)
      }

      request.onupgradeneeded = (event) => {
        const database = (event.target as IDBOpenDBRequest).result
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName, { keyPath: 'id' })
        }
      }
    })
  }

  /**
   * Load queue from IndexedDB
   */
  const loadQueue = async (): Promise<void> => {
    try {
      const database = await initDB()
      const transaction = database.transaction(storeName, 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.getAll()

      request.onsuccess = () => {
        // IndexedDB returns plain objects, need to reconstruct Blobs
        const items = request.result as Array<QueuedVoiceItem & { audioData?: ArrayBuffer }>
        queue.value = items.map(item => ({
          ...item,
          // If audioData was stored as ArrayBuffer, reconstruct Blob
          audioBlob: item.audioBlob instanceof Blob
            ? item.audioBlob
            : new Blob([item.audioData || item.audioBlob], { type: item.mimeType })
        }))
        if (import.meta.env.DEV) {
          console.log('[OfflineVoice] Loaded queue:', queue.value.length, 'items')
        }
      }
    } catch (err) {
      console.error('[OfflineVoice] Failed to load queue:', err)
    }
  }

  /**
   * Save an item to IndexedDB
   */
  const saveToDB = async (item: QueuedVoiceItem): Promise<void> => {
    try {
      const database = await initDB()
      const transaction = database.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)

      // Convert Blob to ArrayBuffer for storage
      const arrayBuffer = await item.audioBlob.arrayBuffer()

      store.put({
        ...item,
        audioBlob: arrayBuffer,  // Store as ArrayBuffer (Blob doesn't serialize well)
        audioData: arrayBuffer   // Backup field
      })
    } catch (err) {
      console.error('[OfflineVoice] Failed to save to DB:', err)
    }
  }

  /**
   * Remove an item from IndexedDB
   */
  const removeFromDB = async (id: string): Promise<void> => {
    try {
      const database = await initDB()
      const transaction = database.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      store.delete(id)
    } catch (err) {
      console.error('[OfflineVoice] Failed to remove from DB:', err)
    }
  }

  /**
   * Add audio blob to queue (when offline)
   */
  const enqueue = async (audioBlob: Blob, mimeType: string): Promise<string> => {
    const item: QueuedVoiceItem = {
      id: `voice-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      audioBlob,
      mimeType,
      createdAt: Date.now(),
      retryCount: 0
    }

    queue.value.push(item)
    await saveToDB(item)

    if (import.meta.env.DEV) {
      console.log('[OfflineVoice] Enqueued audio:', item.id, 'Queue size:', queue.value.length)
    }

    return item.id
  }

  /**
   * Process a single queued item
   */
  const processItem = async (item: QueuedVoiceItem): Promise<boolean> => {
    if (!transcribeAudio) {
      console.warn('[OfflineVoice] No transcribeAudio function provided')
      return false
    }

    try {
      if (import.meta.env.DEV) {
        console.log('[OfflineVoice] Processing item:', item.id)
      }

      const result = await transcribeAudio(item.audioBlob, item.mimeType)

      // Success - remove from queue
      queue.value = queue.value.filter(q => q.id !== item.id)
      await removeFromDB(item.id)

      if (onProcessed) {
        onProcessed({ transcript: result.text, item })
      }

      return true
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'

      item.retryCount++

      if (item.retryCount >= maxRetries) {
        // Give up after max retries
        console.error('[OfflineVoice] Max retries reached for:', item.id)
        queue.value = queue.value.filter(q => q.id !== item.id)
        await removeFromDB(item.id)

        if (onError) {
          onError(`Failed after ${maxRetries} attempts: ${errorMsg}`, item)
        }
      } else {
        // Update retry count in DB
        await saveToDB(item)

        if (import.meta.env.DEV) {
          console.log('[OfflineVoice] Retry', item.retryCount, 'for:', item.id)
        }
      }

      return false
    }
  }

  /**
   * Process all queued items
   */
  const processQueue = async (): Promise<void> => {
    if (isProcessing.value || queue.value.length === 0 || !isOnline.value) {
      return
    }

    isProcessing.value = true
    lastError.value = null

    if (import.meta.env.DEV) {
      console.log('[OfflineVoice] Processing queue:', queue.value.length, 'items')
    }

    // Process items one at a time (oldest first)
    const itemsToProcess = [...queue.value].sort((a, b) => a.createdAt - b.createdAt)

    for (const item of itemsToProcess) {
      if (!isOnline.value) {
        // Stop if we go offline during processing
        if (import.meta.env.DEV) {
          console.log('[OfflineVoice] Went offline, pausing queue processing')
        }
        break
      }

      await processItem(item)

      // Small delay between items to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    isProcessing.value = false
  }

  /**
   * Clear all queued items
   */
  const clearQueue = async (): Promise<void> => {
    for (const item of queue.value) {
      await removeFromDB(item.id)
    }
    queue.value = []
  }

  // Watch for online status changes
  watch(isOnline, (online, wasOnline) => {
    if (online && !wasOnline && queue.value.length > 0) {
      if (import.meta.env.DEV) {
        console.log('[OfflineVoice] Back online, processing queue...')
      }
      processQueue()
    }
  })

  // Load queue on mount
  onMounted(() => {
    loadQueue().then(() => {
      // Process any pending items if we're online
      if (isOnline.value && queue.value.length > 0) {
        processQueue()
      }
    })
  })

  return {
    // State (readonly)
    isOnline: readonly(isOnline),
    pendingCount,
    hasPending,
    isProcessing: readonly(isProcessing),
    lastError: readonly(lastError),
    queue: readonly(queue),

    // Methods
    enqueue,
    processQueue,
    clearQueue
  }
}
