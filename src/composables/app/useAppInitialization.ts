import { onMounted, onUnmounted } from 'vue'
import { useTimerStore } from '@/stores/timer'
import { useTaskStore } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'
import { useCanvasStore } from '@/stores/canvas'
import { useUIStore } from '@/stores/ui'
import { useNotificationStore } from '@/stores/notifications'
import { getGlobalReliableSyncManager } from '@/composables/useReliableSyncManager'
import { useSafariITPProtection } from '@/utils/safariITPProtection'
import { initGlobalKeyboardShortcuts } from '@/utils/globalKeyboardHandlerSimple'
import { useDatabaseHealthCheck, runPreInitializationCheck } from '@/composables/useDatabaseHealthCheck'
import { initCrossTabCoordination } from '@/composables/useCrossTabCoordination'
import { startPeriodicPruning } from '@/composables/useConflictPruning'
import { initializeSyncService } from '@/composables/useReliableSyncManager'
import { watch } from 'vue'

export function useAppInitialization() {
    const timerStore = useTimerStore()
    const taskStore = useTaskStore()
    const projectStore = useProjectStore()
    const canvasStore = useCanvasStore()
    const uiStore = useUIStore()
    const notificationStore = useNotificationStore()
    const itpProtection = useSafariITPProtection()

    // TASK-085: Initialize corruption prevention safeguards
    const { checkHealth } = useDatabaseHealthCheck()

    // BUG-054 FIX: Get sync manager and register callback IMMEDIATELY
    // Stores are created above which triggers useDatabase → sync starts in background
    // We MUST register the callback NOW, before sync can complete and notify
    const syncManager = getGlobalReliableSyncManager()

    // BUG-054 FIX: Register callback as early as possible (outside onMounted)
    // This ensures we catch data pulled events even from initial sync
    const unregisterDataPulledCallback = syncManager.registerDataPulledCallback(async () => {
        // [DEEP-DIVE FIX] Disable aggressive store reloading to prevent Canvas View resets
        // Rely on incremental handlePouchDBChange updates instead
        console.log('🔄 [APP] Sync pulled data - trusting incremental updates (no full reload)...')

        // Only reload if valid reasons exist (e.g. major drift? TBD)
        // For now, we strictly AVOID reloading canvasStore to stop the viewport reset
        // await taskStore.loadFromDatabase() 
        // await projectStore.loadProjectsFromPouchDB()
        // await canvasStore.loadFromDatabase() // <-- THIS is the likely culprit for resets
    })

    // BUG-057 FIX: Define handler at composable level for proper cleanup
    // BUG-061 FIX: Properly extract task data from PouchDB document format
    const handlePouchDBChange = (event: Event) => {
        const detail = (event as CustomEvent).detail
        if (!detail) return

        const { id, doc, deleted } = detail

        // Handle task documents (task-{id})
        if (id.startsWith('task-')) {
            const taskId = id.replace('task-', '')
            if (taskStore.syncInProgress) return // Skip if already processing

            // BUG-061 FIX: PouchDB docs have nested format: { _id, _rev, type, data: { id, title, ... } }
            // We need to extract the actual task data from doc.data and convert dates
            if (deleted) {
                taskStore.updateTaskFromSync(taskId, null, true)
                return
            }

            // Extract task data from nested format
            let taskData = null
            if (doc?.data && typeof doc.data === 'object') {
                // Standard format: { data: { id, title, updatedAt, ... } }
                taskData = doc.data
            } else if (doc?.id && doc?.title !== undefined) {
                // Flat format (legacy): { id, title, updatedAt, ... }
                taskData = doc
            }

            // Validate task has required fields
            if (!taskData || !taskData.id) {
                console.warn('⚠️ [SYNC] Skipping invalid task doc (no id):', id)
                return
            }

            // Convert dates from ISO strings to Date objects
            const normalizedTask = {
                ...taskData,
                createdAt: taskData.createdAt
                    ? new Date(taskData.createdAt)
                    : new Date(),
                updatedAt: taskData.updatedAt
                    ? new Date(taskData.updatedAt)
                    : new Date()
            }

            taskStore.updateTaskFromSync(taskId, normalizedTask, false)
        }

        // Handle project documents (project-{id})
        if (id.startsWith('project-')) {
            if (deleted) {
                projectStore.removeProjectFromSync(id.replace('project-', ''))
            } else if (doc?.data) {
                projectStore.updateProjectFromSync(id.replace('project-', ''), doc.data)
            }
        }

        // Handle canvas section documents (section-{id} or group-{id})
        if (id.startsWith('section-') || id.startsWith('group-')) {
            if (deleted) {
                // Use deleteGroup directly (PowerSync enabled)
                canvasStore.deleteGroup(id)
            } else if (doc?.data) {
                // Use updateGroup directly (PowerSync enabled)
                canvasStore.updateGroup(id, doc.data)
            }
        }
    }

    // ... existing code ...

    onMounted(async () => {
        // MARK: SESSION START for stability guards in storage layer
        if (typeof window !== 'undefined') {
            (window as any).PomoFlowSessionStart = Date.now()
        }
        console.log('🚀 [APP] Starting strictly ordered initialization...')

        // BUG-057: Run PRE-INITIALIZATION check for Firefox/Zen browser compatibility
        // This must run FIRST - before any PouchDB operations
        const preCheckResult = await runPreInitializationCheck()
        console.log('✅ [APP] Checkpoint 1: Pre-Initialization Check complete')
        if (preCheckResult.cleared) {
            console.log('🔄 [APP] Corrupted IndexedDB was cleared - reloading page to sync fresh data...')
            setTimeout(() => window.location.reload(), 500)
            return
        }

        // TASK-085: Initialize cross-tab coordination for write safety
        initCrossTabCoordination()
        console.log('✅ [APP] Checkpoint 2: Cross-tab coordination ready')

        // 1. WAIT FOR DATABASE (Single Source of Truth)
        // We expect useDatabase to auto-initialize via its internal IIFE.
        // We poll until the 'database' ref is populated.
        const { database } = await import('@/composables/useDatabase').then(m => m.useDatabase())

        let attempts = 0
        while (!database.value && attempts < 50) {
            await new Promise(r => setTimeout(r, 100))
            attempts++
        }

        if (!database.value) {
            console.error('❌ [APP] Database failed to initialize after 5s')
            return
        }

        const dbInstance = database.value
        console.log('✅ [APP] Checkpoint 3: Database Instance Acquired:', dbInstance.name)

        // DIAGNOSTIC EXTRAS: Check LocalStorage Backups
        try {
            const golden = localStorage.getItem('pomo-flow-golden-backup')
            if (golden) {
                const parsed = JSON.parse(golden)
                console.log(`💾 [BACKUP-CHECK] Found GOLDEN backup in localStorage: ${parsed.metadata?.taskCount} tasks.`)
            } else {
                console.log('❌ [BACKUP-CHECK] No GOLDEN backup found in localStorage.')
            }
        } catch (e) {
            console.warn('⚠️ [BACKUP-CHECK] Failed to read backups:', e)
        }

        // AUTOMATIC MIGRATION CHECK & SELF-HEALING
        // Determine if we need to migrate:
        // 1. Flag is missing (first run)
        // 2. Flag is present but DB is empty (failed persistence check)

        let needsMigration = false
        const isMigrationComplete = localStorage.getItem('POWERSYNC_MIGRATION_COMPLETE') === 'true'

        if (!isMigrationComplete) {
            needsMigration = true
        } else {
            // SELF-HEALING: Verify data actually exists
            try {
                const { default: PowerSyncService } = await import('@/services/database/PowerSyncDatabase')
                const db = await PowerSyncService.getInstance()
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const countResult = await db.getAll('SELECT count(*) as count FROM tasks') as any[]
                const count = countResult[0]?.count || 0

                // SELF-HEALING: Only trigger if SQLite is TRULY empty and PouchDB is not
                if (count === 0) {
                    try {
                        const pouchInfo = await dbInstance.info()
                        if (pouchInfo.doc_count > 0) {
                            console.warn(`⚠️ [APP] Data Mismatch Detected: SQLite is empty but PouchDB has ${pouchInfo.doc_count} docs. Forcing re-migration.`)
                            needsMigration = true
                        }
                    } catch (e) {
                        console.warn('⚠️ [APP] Failed to check PouchDB for self-healing:', e)
                    }
                } else {
                    // Check schema version - trigger if version mismatch
                    const currentVersion = parseInt(localStorage.getItem('POWERSYNC_MIGRATION_VERSION') || '0')
                    if (currentVersion < 2) {
                        console.log(`🔄 [APP] SQLite Schema Version Mismatch (${currentVersion} < 2). Triggering migration update.`)
                        needsMigration = true
                    }
                }
            } catch (e) {
                console.warn('⚠️ [APP] Failed to verify SQLite state, assuming healthy to prevent loops:', e)
                // If we crash checking the DB, don't infinite loop migration
            }
        }

        const SAFE_GUARD_LIMIT = 2
        const currentAttempts = parseInt(localStorage.getItem('MIGRATION_ATTEMPTS') || '0')

        if (needsMigration && currentAttempts < SAFE_GUARD_LIMIT) {
            console.log(`🚀 [APP] Auto-Migration Triggered (Attempt ${currentAttempts + 1}/${SAFE_GUARD_LIMIT})...`)

            // Increment attempt counter
            localStorage.setItem('MIGRATION_ATTEMPTS', (currentAttempts + 1).toString())

            try {
                const { migratePouchToSql } = await import('@/utils/migratePouchToSql')

                // Pass existing PouchDB instance to avoid re-opening if possible
                await migratePouchToSql(dbInstance)

                console.log('✅ [APP] Auto-Migration finished. Page should reload shortly.')
                setTimeout(() => window.location.reload(), 500)
                return // Stop further initialization
            } catch (err) {
                console.error('❌ [APP] Auto-Migration Failed:', err)
            }
        } else if (needsMigration && currentAttempts >= SAFE_GUARD_LIMIT) {
            console.error('🛑 [APP] Auto-Migration halted: Max attempts reached. Data mismatches may persist.')
        }


        // 2. INJECT DATABASE INTO SYNC SERVICE (Dependency Injection)
        // This ensures Sync Service uses the EXACT SAME database instance as the UI
        try {
            await initializeSyncService(dbInstance)
            console.log('✅ [APP] Sync Service Initialized with injected DB')

            // CRITICAL FIX: Ensure 'todo' status is mapped to 'planned' for existing data
            // This fixes the "Hidden Tasks" bug where tasks exist but don't appear in Kanban columns
            try {
                // Determine DB instance for Query
                const { default: PowerSyncService } = await import('@/services/database/PowerSyncDatabase')
                const autoFixDb = await PowerSyncService.getInstance()

                const result = await autoFixDb.execute(`UPDATE tasks SET status = 'planned' WHERE status = 'todo'`)
                if (result.rowsAffected > 0) {
                    console.log(`🛠️ [AUTO-FIX] Updated ${result.rowsAffected} tasks from 'todo' to 'planned'`)
                }
            } catch (e) {
                console.warn('⚠️ [AUTO-FIX] Failed to update legacy statuses:', e)
            }

        } catch (e) {
            console.error('❌ [APP] Sync Service init failed:', e)
        }

        // 3. LOAD STORES (Now that DB and Sync are ready)
        console.log('⚡ [APP] Loading stores from valid database...')

        // Load UI state first
        uiStore.loadState()

        // Load Data Stores
        await Promise.all([
            taskStore.loadFromDatabase(),
            projectStore.loadProjectsFromPouchDB(),
            canvasStore.loadFromDatabase()
        ])

        console.log('✅ [APP] All stores loaded')

        // Start sync in background - don't await, let it run while app is usable
        // ALWAYS reload stores after sync completes (fixes empty data on fresh browser)
        let hasReloadedStores = false

        syncManager.waitForInitialSync(30000).then(async (syncCompleted) => {
            if (hasReloadedStores) {
                console.log('ℹ️ [APP] Stores already reloaded by fallback timer')
                return
            }
            hasReloadedStores = true
            if (syncCompleted) {
                console.log('✅ [APP] Background sync completed - reloading task/project stores...')
                // Always reload task/project stores after sync to catch conflict-resolved data
                await taskStore.loadFromDatabase()
                await projectStore.loadProjectsFromPouchDB()
                // TASK-089 FIX: Do NOT reload canvas store - it resets viewport and group positions
                // Canvas uses incremental sync via updateSectionFromSync() and handlePouchDBChange()
                // await canvasStore.loadFromDatabase()  // <-- CAUSES POSITION RESETS
                console.log('✅ [APP] Task/project stores reloaded (canvas preserved via incremental sync)')
            } else {
                console.warn('⚠️ [APP] Background sync timed out - using local data')
            }

            // BUG-057 FIX: Start live sync with changes feed pattern
            // Now uses incremental updates instead of full store reloads
            if (syncManager.remoteConnected?.value || syncManager.hasConnectedEver?.value) {
                console.log('🔄 [APP] Starting live sync with incremental updates...')
                syncManager.startLiveSync().then(success => {
                    if (success) {
                        console.log('✅ [APP] Live sync started')
                    }
                }).catch(err => {
                    console.warn('⚠️ [APP] Live sync error:', err)
                })
            }
        }).catch(err => {
            console.warn('⚠️ [APP] Background sync failed:', err)
        })

        // BUG-055 FALLBACK: Force reload stores after 10 seconds if sync hasn't completed
        // This handles cases where sync hangs or takes too long in some browsers (Firefox/Zen)
        // TASK-089 FIX: Do NOT reload canvas store - it resets viewport and group positions
        setTimeout(async () => {
            if (hasReloadedStores) {
                // console.log('ℹ️ [APP] Fallback timer: stores already reloaded')
                return
            }
            console.log('⏰ [APP] Fallback timer triggered - reloading task/project stores (NOT canvas)...')
            hasReloadedStores = true
            await taskStore.loadFromDatabase()
            await projectStore.loadProjectsFromPouchDB()
            // TASK-089: REMOVED canvas reload - it resets viewport and positions
            // Canvas uses incremental sync via updateSectionFromSync() and handlePouchDBChange()
            // await canvasStore.loadFromDatabase()  // <-- CAUSES POSITION RESETS
            console.log('✅ [APP] Task/project stores reloaded (canvas preserved)')

            // BUG-057 FIX: Start live sync from fallback if not already running
            if (!syncManager.isLiveSyncActive() && (syncManager.remoteConnected?.value || syncManager.hasConnectedEver?.value)) {
                console.log('🔄 [APP] Fallback: Starting live sync...')
                syncManager.startLiveSync().catch(() => { })
            }
        }, 10000)

        // BUG-057 FIX: Listen for incremental PouchDB changes
        // Handler is defined at composable level for proper cleanup
        window.addEventListener('pouchdb-change', handlePouchDBChange)

        // Clean up legacy monolithic documents if in individual-only mode
        // This ensures database pruning after successful migration
        // Reuse the already acquired dbInstance (Dependency Injection)
        if (dbInstance) {
            const { cleanupLegacyMonolithicDocuments } = await import('@/utils/legacyStorageCleanup')
            cleanupLegacyMonolithicDocuments(dbInstance).catch(err => {
                console.warn('⚠️ Legacy storage cleanup failed:', err)
            })
        }

        // Initialize notification system
        if (taskStore.tasks.length >= 0) {
            try {
                await notificationStore.initializeNotifications()
            } catch (error) {
                console.warn('⚠️ Notification system initialization failed:', error)
            }
        }

        // Request notification permission for timer
        try {
            await timerStore.requestNotificationPermission()
        } catch (error) {
            console.warn('⚠️ Timer notification permission request failed:', error)
        }

        // Safari ITP Protection
        try {
            itpProtection.initialize()
            if (itpProtection.shouldShowWarning.value) {
                const warningMessage = itpProtection.warningMessage.value
                if (warningMessage) {
                    console.warn('🍎 [Safari ITP]', warningMessage)
                    itpProtection.markAsWarned()
                }
            }
            itpProtection.recordInteraction()
        } catch (error) {
            console.warn('⚠️ Safari ITP check failed:', error)
        }

        // Initialize global keyboard shortcuts (system-level: undo/redo/new-task)
        await initGlobalKeyboardShortcuts()
        console.log('✅ [APP] Checkpoint 3.5: Keyboard shortcuts initialized')

        // TASK-085: Start periodic conflict pruning (hourly background job)
        startPeriodicPruning()
        console.log('✅ [APP] Checkpoint 4: Periodic tasks started')

        // DEBUG: Sample IDs to solve the "9k docs mystery"
        setTimeout(async () => {
            const db = (window as any).pomoFlowDb
            if (db) {
                try {
                    // DIAGNOSTICS: Deep inspection of DB contents
                    const dbInfo = await db.info()
                    console.log(`🔍 [SYNC-DIAGNOSTIC] DB Name: ${dbInfo.db_name}`)
                    console.log(`🔍 [SYNC-DIAGNOSTIC] DB Doc Count: ${dbInfo.doc_count}`)

                    const allDocs = await db.allDocs({ limit: 20, include_docs: false })
                    console.log('🔍 [SYNC-DIAGNOSTIC] First 20 IDs (ANY type):', JSON.stringify(allDocs.rows.map((r: any) => r.id)))

                    // Check specifically for tasks including deleted
                    const taskDocs = await db.allDocs({
                        startkey: 'task-',
                        endkey: 'task-\ufff0',
                        limit: 10,
                        include_docs: true
                    })
                    console.log('🔍 [SYNC-DIAGNOSTIC] Detailed Task Rows:', JSON.stringify(taskDocs.rows))

                    // WRITE TEST: Prove DB is usable
                    try {
                        const testId = `debug-write-test-${Date.now()}`
                        await db.put({ _id: testId, type: 'debug' })
                        console.log(`✅ [SYNC-DIAGNOSTIC] Write Test Passed: ${testId}`)
                    } catch (e) {
                        console.error(`❌ [SYNC-DIAGNOSTIC] Write Test FAILED:`, e)
                    }

                    const legacy = await db.get('tasks:data').catch(() => null)
                    console.log('🔍 [SYNC-DIAGNOSTIC] Legacy tasks:data found:', !!legacy)
                } catch (e) { }
            }
        }, 3000)

        // DEBUG: Auto-Dump DB to console to verify sync
        console.log('🔍 [APP] Scheduling auto-dump in 5s...')
        setTimeout(async () => {
            const db = (window as any).pomoFlowDb
            if (db) {
                try {
                    const allDocs = await db.allDocs({ include_docs: true })
                    console.group('🔍 [AUTO-DUMP] Database Contents')
                    console.log(`Total Docs: ${allDocs.total_rows}`)
                    const types = {} as Record<string, number>
                    allDocs.rows.forEach((row: any) => {
                        const type = row.doc.type || (row.id.split('-')[0])
                        types[type] = (types[type] || 0) + 1
                    })
                    console.table(types)
                    console.log('Sample Doc:', allDocs.rows[0]?.doc)
                    console.groupEnd()
                } catch (e) {
                    console.error('❌ Auto-dump failed:', e)
                }
            }
        }, 5000)
    })

    // BUG-054/057 FIX: Cleanup on unmount
    onUnmounted(() => {
        if (unregisterDataPulledCallback) {
            unregisterDataPulledCallback()
        }
        // BUG-057: Remove changes feed listener
        window.removeEventListener('pouchdb-change', handlePouchDBChange)
    })
}
