import { ref, computed, type Ref } from 'vue'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
  serverTimestamp,
  writeBatch,
  type WriteBatch
} from 'firebase/firestore'
import { db, auth } from '@/config/firebase'

export interface FirestoreOptions {
  userId?: string // If not provided, uses current auth user
  realtime?: boolean // Enable real-time updates
}

export interface FirestoreQuery {
  field: string
  operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains'
  value: unknown
}

export interface FirestoreSortOptions {
  field: string
  direction?: 'asc' | 'desc'
}

/**
 * Composable for Firestore operations with user scoping and real-time updates
 *
 * @example
 * ```ts
 * const { data: tasks, loading, error, fetch, create, update, remove } = useFirestore('tasks')
 *
 * // Fetch all tasks for current user
 * await fetch()
 *
 * // Create a new task
 * await create({ title: 'New task', status: 'planned' })
 *
 * // Update a task
 * await update('taskId', { title: 'Updated title' })
 *
 * // Delete a task
 * await remove('taskId')
 * ```
 */
export function useFirestore<T extends DocumentData>(
  collectionName: string,
  options: FirestoreOptions = {}
) {
  const data = ref<T[]>([]) as Ref<T[]>
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const unsubscribe = ref<Unsubscribe | null>(null)

  // Get user ID from auth or options
  const getUserId = (): string | null => {
    if (options.userId) return options.userId
    return auth?.currentUser?.uid || null
  }

  // Check if Firebase is ready
  const isReady = computed(() => {
    return !!(db && auth)
  })

  /**
   * Get collection reference scoped to user
   */
  const getCollectionRef = () => {
    const userId = getUserId()
    if (!userId) {
      throw new Error('User not authenticated')
    }
    if (!db) {
      throw new Error('Firestore not initialized')
    }
    return collection(db, 'users', userId, collectionName)
  }

  /**
   * Get document reference scoped to user
   */
  const getDocRef = (docId: string) => {
    const userId = getUserId()
    if (!userId) {
      throw new Error('User not authenticated')
    }
    if (!db) {
      throw new Error('Firestore not initialized')
    }
    return doc(db, 'users', userId, collectionName, docId)
  }

  /**
   * Fetch documents with optional filters and sorting
   */
  const fetch = async (
    queries: FirestoreQuery[] = [],
    sort?: FirestoreSortOptions,
    limitCount?: number
  ) => {
    if (!isReady.value) {
      error.value = new Error('Firebase not initialized')
      return []
    }

    loading.value = true
    error.value = null

    try {
      const collectionRef = getCollectionRef()
      const constraints: QueryConstraint[] = []

      // Add query constraints
      queries.forEach(q => {
        constraints.push(where(q.field, q.operator, q.value))
      })

      // Add sorting
      if (sort) {
        constraints.push(orderBy(sort.field, sort.direction || 'asc'))
      }

      // Add limit
      if (limitCount) {
        constraints.push(limit(limitCount))
      }

      const q = query(collectionRef, ...constraints)
      const querySnapshot = await getDocs(q)

      data.value = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[]

      return data.value
    } catch (err) {
      error.value = err as Error
      console.error('Firestore fetch error:', err)
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * Subscribe to real-time updates
   */
  const subscribe = (
    queries: FirestoreQuery[] = [],
    sort?: FirestoreSortOptions,
    limitCount?: number
  ) => {
    if (!isReady.value) {
      error.value = new Error('Firebase not initialized')
      return
    }

    // Unsubscribe from previous listener
    if (unsubscribe.value) {
      unsubscribe.value()
    }

    try {
      const collectionRef = getCollectionRef()
      const constraints: QueryConstraint[] = []

      // Add query constraints
      queries.forEach(q => {
        constraints.push(where(q.field, q.operator, q.value))
      })

      // Add sorting
      if (sort) {
        constraints.push(orderBy(sort.field, sort.direction || 'asc'))
      }

      // Add limit
      if (limitCount) {
        constraints.push(limit(limitCount))
      }

      const q = query(collectionRef, ...constraints)

      unsubscribe.value = onSnapshot(
        q,
        (querySnapshot) => {
          data.value = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as T[]
        },
        (err) => {
          error.value = err as Error
          console.error('Firestore subscription error:', err)
        }
      )
    } catch (err) {
      error.value = err as Error
      console.error('Firestore subscribe error:', err)
    }
  }

  /**
   * Get a single document by ID
   */
  const getById = async (docId: string): Promise<T | null> => {
    if (!isReady.value) {
      error.value = new Error('Firebase not initialized')
      return null
    }

    loading.value = true
    error.value = null

    try {
      const docRef = getDocRef(docId)
      const docSnapshot = await getDoc(docRef)

      if (docSnapshot.exists()) {
        return {
          id: docSnapshot.id,
          ...docSnapshot.data()
        } as T
      }
      return null
    } catch (err) {
      error.value = err as Error
      console.error('Firestore getById error:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Create a new document
   */
  const create = async (docData: Partial<T>, docId?: string): Promise<string | null> => {
    if (!isReady.value) {
      error.value = new Error('Firebase not initialized')
      return null
    }

    loading.value = true
    error.value = null

    try {
      const userId = getUserId()
      const newDocId = docId || crypto.randomUUID()
      const docRef = getDocRef(newDocId)

      const dataWithMetadata = {
        ...docData,
        userId, // Always add userId for data scoping
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }

      await setDoc(docRef, dataWithMetadata)
      return newDocId
    } catch (err) {
      error.value = err as Error
      console.error('Firestore create error:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Update an existing document
   */
  const update = async (docId: string, updates: Partial<T>): Promise<boolean> => {
    if (!isReady.value) {
      error.value = new Error('Firebase not initialized')
      return false
    }

    loading.value = true
    error.value = null

    try {
      const docRef = getDocRef(docId)

      const updatesWithMetadata = {
        ...updates,
        updatedAt: serverTimestamp()
      }

      await updateDoc(docRef, updatesWithMetadata)
      return true
    } catch (err) {
      error.value = err as Error
      console.error('Firestore update error:', err)
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete a document
   */
  const remove = async (docId: string): Promise<boolean> => {
    if (!isReady.value) {
      error.value = new Error('Firebase not initialized')
      return false
    }

    loading.value = true
    error.value = null

    try {
      const docRef = getDocRef(docId)
      await deleteDoc(docRef)
      return true
    } catch (err) {
      error.value = err as Error
      console.error('Firestore remove error:', err)
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Batch write operations (up to 500 operations per batch)
   */
  const batchWrite = async (
    operations: Array<{
      type: 'create' | 'update' | 'delete'
      docId: string
      data?: Partial<T>
    }>
  ): Promise<boolean> => {
    if (!isReady.value || !db) {
      error.value = new Error('Firebase not initialized')
      return false
    }

    loading.value = true
    error.value = null

    try {
      const batch: WriteBatch = writeBatch(db)
      const userId = getUserId()

      operations.forEach(op => {
        const docRef = getDocRef(op.docId)

        switch (op.type) {
          case 'create':
            if (op.data) {
              batch.set(docRef, {
                ...op.data,
                userId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              })
            }
            break
          case 'update':
            if (op.data) {
              batch.update(docRef, {
                ...op.data,
                updatedAt: serverTimestamp()
              })
            }
            break
          case 'delete':
            batch.delete(docRef)
            break
        }
      })

      await batch.commit()
      return true
    } catch (err) {
      error.value = err as Error
      console.error('Firestore batch error:', err)
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Clean up real-time listener
   */
  const cleanup = () => {
    if (unsubscribe.value) {
      unsubscribe.value()
      unsubscribe.value = null
    }
  }

  return {
    // Reactive state
    data,
    loading,
    error,
    isReady,

    // Methods
    fetch,
    subscribe,
    getById,
    create,
    update,
    remove,
    batchWrite,
    cleanup
  }
}
