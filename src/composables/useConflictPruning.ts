/**
 * Periodic Conflict Pruning Composable
 * TASK-085: Safeguard 3 - Automatically cleans up conflicting document revisions
 *
 * Purpose:
 * - Prevents conflict buildup that can corrupt IndexedDB
 * - Deletes only losing revisions, never the winning document
 * - Runs hourly in the background when tab is visible
 *
 * Safety:
 * - Only deletes _conflicts revisions (duplicates)
 * - Never touches the current/winning document version
 * - Pauses when tab is not visible (saves resources)
 * - Logs all pruning actions for debugging
 */

import { ref, onMounted, onUnmounted } from 'vue'

// Pruning interval (ms) - every hour
const PRUNE_INTERVAL = 60 * 60 * 1000 // 1 hour

// Minimum interval between prunes (ms) - don't run more than once per 5 minutes
const MIN_PRUNE_INTERVAL = 5 * 60 * 1000 // 5 minutes

// Maximum conflicts to process per run (prevent blocking)
const MAX_CONFLICTS_PER_RUN = 100

export interface PruneResult {
  documentsChecked: number
  conflictsFound: number
  conflictsPruned: number
  errors: string[]
  duration: number
}

export interface ConflictInfo {
  docId: string
  conflictCount: number
  conflictRevs: string[]
}

let lastPruneTime = 0
let pruneTimer: ReturnType<typeof setInterval> | null = null
let isRunning = false

/**
 * Get all documents with conflicts
 */
async function getDocumentsWithConflicts(db: PouchDB.Database): Promise<ConflictInfo[]> {
  const result = await db.allDocs({
    conflicts: true,
    include_docs: true
  })

  const conflicts: ConflictInfo[] = []

  for (const row of result.rows) {
    // Skip design documents
    if (row.id.startsWith('_design/')) continue

    const doc = row.doc as any
    if (doc?._conflicts && doc._conflicts.length > 0) {
      conflicts.push({
        docId: row.id,
        conflictCount: doc._conflicts.length,
        conflictRevs: doc._conflicts
      })
    }
  }

  return conflicts
}

/**
 * Prune conflicts for a single document
 * Only deletes the losing revisions, never the winning one
 */
async function pruneDocumentConflicts(
  db: PouchDB.Database,
  docId: string,
  conflictRevs: string[]
): Promise<{ pruned: number; errors: string[] }> {
  let pruned = 0
  const errors: string[] = []

  for (const conflictRev of conflictRevs) {
    try {
      // Delete the conflicting revision (not the main doc!)
      await db.remove(docId, conflictRev)
      pruned++
      console.log(`🧹 [CONFLICT PRUNE] Removed conflict rev ${conflictRev} from ${docId}`)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      // 404 is fine - conflict may have already been resolved
      if (!errorMsg.includes('missing') && !errorMsg.includes('404')) {
        errors.push(`${docId}@${conflictRev}: ${errorMsg}`)
      }
    }
  }

  return { pruned, errors }
}

/**
 * Main pruning function - call periodically
 */
async function runConflictPruning(): Promise<PruneResult> {
  const startTime = Date.now()

  // Prevent concurrent runs
  if (isRunning) {
    console.log('⏳ [CONFLICT PRUNE] Already running - skipping')
    return {
      documentsChecked: 0,
      conflictsFound: 0,
      conflictsPruned: 0,
      errors: ['Already running'],
      duration: 0
    }
  }

  // Respect minimum interval
  if (Date.now() - lastPruneTime < MIN_PRUNE_INTERVAL) {
    console.log('⏳ [CONFLICT PRUNE] Too soon since last prune - skipping')
    return {
      documentsChecked: 0,
      conflictsFound: 0,
      conflictsPruned: 0,
      errors: ['Too soon since last prune'],
      duration: 0
    }
  }

  isRunning = true
  lastPruneTime = Date.now()

  const result: PruneResult = {
    documentsChecked: 0,
    conflictsFound: 0,
    conflictsPruned: 0,
    errors: [],
    duration: 0
  }

  try {
    const db = (window as any).pomoFlowDb as PouchDB.Database | undefined

    if (!db) {
      console.log('ℹ️ [CONFLICT PRUNE] No database instance - skipping')
      return { ...result, errors: ['No database instance'] }
    }

    console.log('🔍 [CONFLICT PRUNE] Starting conflict scan...')

    // Get all documents with conflicts
    const conflictDocs = await getDocumentsWithConflicts(db)

    result.documentsChecked = conflictDocs.length

    if (conflictDocs.length === 0) {
      console.log('✅ [CONFLICT PRUNE] No conflicts found')
      return { ...result, duration: Date.now() - startTime }
    }

    result.conflictsFound = conflictDocs.reduce((sum, doc) => sum + doc.conflictCount, 0)
    console.log(`📊 [CONFLICT PRUNE] Found ${result.conflictsFound} conflicts in ${conflictDocs.length} documents`)

    // Prune conflicts (limit per run to prevent blocking)
    let processedConflicts = 0

    for (const conflictDoc of conflictDocs) {
      if (processedConflicts >= MAX_CONFLICTS_PER_RUN) {
        console.log(`⚠️ [CONFLICT PRUNE] Hit limit of ${MAX_CONFLICTS_PER_RUN} - will continue next run`)
        break
      }

      const pruneResult = await pruneDocumentConflicts(
        db,
        conflictDoc.docId,
        conflictDoc.conflictRevs
      )

      result.conflictsPruned += pruneResult.pruned
      result.errors.push(...pruneResult.errors)
      processedConflicts += conflictDoc.conflictCount
    }

    console.log(`✅ [CONFLICT PRUNE] Pruned ${result.conflictsPruned} conflicts`)

    if (result.errors.length > 0) {
      console.warn(`⚠️ [CONFLICT PRUNE] ${result.errors.length} errors:`, result.errors)
    }

    return {
      ...result,
      duration: Date.now() - startTime
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('❌ [CONFLICT PRUNE] Pruning failed:', errorMsg)
    return {
      ...result,
      errors: [errorMsg],
      duration: Date.now() - startTime
    }
  } finally {
    isRunning = false
  }
}

/**
 * Start the periodic pruning scheduler
 */
function startPeriodicPruning(): void {
  if (pruneTimer) return

  console.log('⏰ [CONFLICT PRUNE] Starting periodic pruning scheduler (hourly)')

  // Run immediately on start (after a short delay)
  setTimeout(() => {
    if (document.visibilityState === 'visible') {
      runConflictPruning()
    }
  }, 10000) // 10 seconds after startup

  // Schedule hourly runs
  pruneTimer = setInterval(() => {
    // Only run when tab is visible
    if (document.visibilityState === 'visible') {
      runConflictPruning()
    } else {
      console.log('💤 [CONFLICT PRUNE] Tab not visible - skipping scheduled prune')
    }
  }, PRUNE_INTERVAL)
}

/**
 * Stop the periodic pruning scheduler
 */
function stopPeriodicPruning(): void {
  if (pruneTimer) {
    clearInterval(pruneTimer)
    pruneTimer = null
    console.log('⏹️ [CONFLICT PRUNE] Stopped periodic pruning scheduler')
  }
}

/**
 * Vue composable for conflict pruning
 */
export function useConflictPruning() {
  const lastResult = ref<PruneResult | null>(null)
  const isPruning = ref(false)

  onMounted(() => {
    startPeriodicPruning()
  })

  onUnmounted(() => {
    // Don't stop the scheduler on component unmount
    // It should run app-wide
  })

  /**
   * Manually trigger a prune (for debugging/admin)
   */
  const manualPrune = async (): Promise<PruneResult> => {
    isPruning.value = true
    try {
      const result = await runConflictPruning()
      lastResult.value = result
      return result
    } finally {
      isPruning.value = false
    }
  }

  /**
   * Get current conflict stats without pruning
   */
  const getConflictStats = async (): Promise<{ total: number; documents: ConflictInfo[] }> => {
    const db = (window as any).pomoFlowDb as PouchDB.Database | undefined
    if (!db) return { total: 0, documents: [] }

    const conflicts = await getDocumentsWithConflicts(db)
    const total = conflicts.reduce((sum, doc) => sum + doc.conflictCount, 0)

    return { total, documents: conflicts }
  }

  return {
    manualPrune,
    getConflictStats,
    lastResult,
    isPruning,
    startPeriodicPruning,
    stopPeriodicPruning
  }
}

// Export for use outside Vue components
export { runConflictPruning, startPeriodicPruning, stopPeriodicPruning }
