import PouchDB from 'pouchdb-browser'
import { getDatabaseConfig } from '@/config/database'

// ============================================
// VUE FLOW + POUCHDB DEBUG UTILITIES
// ============================================

export const installDebugHelper = () => {
    if (typeof window === 'undefined') return

    (window as any).debugHelper = {
        // ============= DATABASE INSPECTION =============
        async inspectDB() {
            const db = (window as any).__POUCHDB__
            if (!db) {
                console.error('❌ PouchDB not exposed. Please ensure window.__POUCHDB__ is set in main.ts or Canvas store initialization.')
                return
            }

            console.clear()
            console.log('%c╔════════════════════════════════════╗', 'color: cyan; font-family: monospace;')
            console.log('%c║   LOCAL DATABASE INSPECTION        ║', 'color: cyan; font-family: monospace;')
            console.log('%c╚════════════════════════════════════╝', 'color: cyan; font-family: monospace;')

            try {
                const result = await db.allDocs({ include_docs: true })
                const groups = result.rows.filter((r: any) => r.id.startsWith('group-') || r.id.startsWith('section-'))
                const tasks = result.rows.filter((r: any) => r.id.startsWith('task-'))
                const designs = result.rows.filter((r: any) => r.id.startsWith('_design'))

                console.table({
                    '📊 Total Documents': result.total_rows,
                    '📁 Groups/Sections': groups.length,
                    '✅ Tasks': tasks.length,
                    '🔧 Design Docs': designs.length,
                    '❓ Other': result.total_rows - groups.length - tasks.length - designs.length
                })

                // List all group IDs
                if (groups.length > 0) {
                    console.log('%c📋 All Groups:', 'color: blue; font-weight: bold; font-size: 12px;')
                    groups.forEach((g: any) => {
                        const normalizedId = g.id.replace(/^section-/, 'group-')
                        const mismatch = normalizedId !== g.id ? ' ⚠️ ID MISMATCH' : ''
                        console.log(`   ${g.id}${mismatch}`)
                    })
                }

                return result
            } catch (err) {
                console.error('❌ Error reading DB:', err)
            }
        },

        // ============= REPLICATION STATUS =============
        async checkSyncStatus() {
            const db = (window as any).__POUCHDB__
            if (!db) return console.error('❌ PouchDB not exposed')

            console.clear()
            console.log('%c╔════════════════════════════════════╗', 'color: cyan; font-family: monospace;')
            console.log('%c║   REPLICATION STATUS               ║', 'color: cyan; font-family: monospace;')
            console.log('%c╚════════════════════════════════════╝', 'color: cyan; font-family: monospace;')

            try {
                const checkpoint = await db.get('_local/sync-checkpoint')
                console.log('%c✅ Checkpoint Found', 'color: green; font-weight: bold;')
                console.table({
                    'Last Sync Seq': checkpoint.last_seq,
                    'Direction': checkpoint.direction || 'N/A',
                    'Timestamp': new Date(checkpoint.timestamp || 0).toISOString()
                })
            } catch (err) {
                console.log('%c⚠️  No Checkpoint', 'color: orange; font-weight: bold;')
                console.log('   This is normal on first sync or after checkpoint reset')
            }
        },

        // ============= REPLICATION HELPER =============
        async resetReplicationCheckpoint() {
            const db = (window as any).__POUCHDB__
            if (!db) return console.error('❌ PouchDB not exposed')

            try {
                // Try to find any local checkpoint docs
                const allDocs = await db.allDocs({ startkey: '_local/', endkey: '_local/\uffff' })
                const checkpoints = allDocs.rows.filter((row: any) => row.id.includes('checkpoint'))

                if (checkpoints.length === 0) {
                    console.log('ℹ️  No checkpoints found to reset.')
                    return
                }

                for (const cp of checkpoints) {
                    const doc = await db.get(cp.id)
                    await db.remove(doc)
                    console.log(`✅ Removed checkpoint: ${cp.id}`)
                }

                console.log('%c✅ All checkpoints reset. Please RELOAD PAGE to trigger full sync.', 'color: green; font-weight: bold;')

            } catch (err: any) {
                console.error('❌ Error resetting checkpoint:', err)
            }
        },

        // ============= GROUP RECOVERY =============
        async clearGroupDeletions() {
            const db = (window as any).__POUCHDB__
            if (!db) return console.error('❌ PouchDB not exposed')

            try {
                const deletionDoc = await db.get('_local/deleted-groups')
                await db.remove(deletionDoc)
                console.log('%c✅ Group deletion history CLEARED.', 'color: green; font-weight: bold;')
                console.log('Please RELOAD the page to see your groups.')
            } catch (err: any) {
                if (err.status === 404) {
                    console.log('ℹ️ No hidden groups found (history already clean).')
                } else {
                    console.error('❌ Error clearing group deletions:', err)
                }
            }
        },

        // ============= CONFLICT RESOLUTION =============
        async resolveAllConflicts() {
            const db = (window as any).__POUCHDB__
            if (!db) return console.error('❌ PouchDB not exposed')

            try {
                const allDocs = await db.allDocs({ include_docs: true, conflicts: true })
                const conflicting = allDocs.rows.filter((r: any) => r.doc._conflicts && r.doc._conflicts.length > 0)

                if (conflicting.length === 0) {
                    console.log('✅ No conflicts found.')
                    return
                }

                console.log(`🔥 Found ${conflicting.length} documents with conflicts. Resolving to WINNING revision...`)

                for (const row of conflicting) {
                    // For now, we trust the current "winning" revision PouchDB picked, 
                    // but we must delete the conflict branches to clean up.
                    // Or, if the winning revision is "Deleted", we might want to RESURRECT the conflict.

                    // Simple strategy: Just delete the conflict revisions.
                    const doc = row.doc
                    const conflictRevs = doc._conflicts

                    const bulk = conflictRevs.map((rev: string) => ({
                        _id: doc._id,
                        _rev: rev,
                        _deleted: true
                    }))

                    await db.bulkDocs(bulk)
                    console.log(`Solved conflicts for ${doc._id}`)
                }
                console.log('✅ All conflicts resolved. Please reload.')

            } catch (err) {
                console.error('❌ Conflict resolution failed:', err)
            }
        },

        // ============= FORCE READ =============
        async forceDebugGroups() {
            const db = (window as any).__POUCHDB__
            if (!db) return
            const res = await db.allDocs({ include_docs: true, startkey: 'section-', endkey: 'section-\uffff' })
            console.log('🔎 FORCE READ found sections:', res.rows.map((r: any) => ({
                id: r.id,
                rev: r.doc._rev,
                isDeleted: r.doc._deleted,
                conflicts: r.doc._conflicts
            })))
        },

        // ============= NUKE DATABASE =============
        async nukeDB() {
            const db = (window as any).__POUCHDB__
            if (db) {
                try {
                    await db.destroy()
                    console.log('💥 Task Database DESTROYED.')
                } catch (e) {
                    console.error('Failed to destroy task DB:', e)
                }
            }

            // Also try to delete the timer DB if possible, or just the main one is enough
            try {
                // Using PouchDB directly if available nicely, or just IDB
                const req = indexedDB.deleteDatabase('_pouch_pomoflow-tasks')
                req.onsuccess = () => console.log('💥 _pouch_pomoflow-tasks deleted from IndexedDB')
                req.onerror = () => console.log('⚠️ Could not delete from IDB directly')
            } catch (e) { console.error(e) }

            console.log('%c✅ LOCAL DATA WIPED. Reloading in 3 seconds...', 'color: red; font-weight: bold; font-size: 14px;')
            setTimeout(() => window.location.reload(), 3000)
        },

        // ============= DIAGNOSE DATABASE =============
        async diagnoseDB() {
            const db = (window as any).__POUCHDB__
            if (!db) return console.error('❌ PouchDB not exposed')

            try {
                const info = await db.info()
                console.log('📊 DB Info:', info)

                const allDocs = await db.allDocs({ limit: 5 })
                console.log('🔎 First 5 docs:', allDocs.rows)

                const sectionDocs = await db.allDocs({ startkey: 'section-', endkey: 'section-\uffff' })
                console.log(`🔎 Found ${sectionDocs.rows.length} SECTION docs`)

                const taskDocs = await db.allDocs({ startkey: 'task-', endkey: 'task-\uffff' })
                console.log(`🔎 Found ${taskDocs.rows.length} INDIVIDUAL TASK docs`)

                const legacyTasks = await db.get('tasks:data').catch(() => null)
                console.log(`🔎 Legacy "tasks:data" document: ${legacyTasks ? 'PRESENT (' + legacyTasks.tasks?.length + ' tasks)' : 'ABSENT'}`)

            } catch (err) {
                console.error('❌ Diagnose failed:', err)
            }
        },

        // ============= MIGRATION BRIDGE =============
        async migrateFromDev() {
            console.log('🚀 [MIGRATION] Checking for data in "pomoflow-app-dev"...')
            const devDb = new PouchDB('pomoflow-app-dev')
            const currentDb = (window as any).pomoFlowDb

            if (!currentDb) return console.error('❌ Reference database (pomoflow-app) not ready.')

            try {
                const info = await devDb.info()
                if (info.doc_count === 0) {
                    console.log('ℹ️ "pomoflow-app-dev" is empty. No migration needed.')
                    return
                }

                console.log(`📦 Founding ${info.doc_count} docs in dev database. Migrating to production...`)

                // Replicate Dev -> Current
                await devDb.replicate.to(currentDb)
                console.log('✅ [MIGRATION] Migration complete!')

                const verify = await currentDb.info()
                console.log(`📊 Current DB Docs after migration: ${verify.doc_count}`)

                console.log('%c Please RELOAD the page.', 'color: green; font-weight: bold; font-size: 16px;')
            } catch (err) {
                console.error('❌ Migration failed:', err)
            }
        },

        async nukeAll() {
            console.log('💥 Nuking both app and dev databases...')
            try {
                await new PouchDB('pomoflow-app').destroy()
                await new PouchDB('pomoflow-app-dev').destroy()
                console.log('✅ Nuke complete. Reloading...')
                window.location.reload()
            } catch (e) {
                console.error(e)
            }
        },

        // ============= EMERGENCY RECOVERY =============
        async emergencyRecovery() {
            console.log('%c🚨 EMERGENCY RECOVERY: Orphaned Revision Fix', 'color: red; font-weight: bold; font-size: 14px;')
            console.log('This will delete ALL local PouchDB databases and reload to sync from CouchDB.')
            console.log('')

            try {
                // Delete all PouchDB databases using native IndexedDB API
                if (indexedDB.databases) {
                    const allDbs = await indexedDB.databases()
                    const pouchDbs = allDbs.filter(db => db.name?.startsWith('_pouch_'))

                    console.log(`🗑️ Found ${pouchDbs.length} PouchDB databases to delete:`)
                    for (const db of pouchDbs) {
                        if (db.name) {
                            console.log(`   - ${db.name}`)
                            indexedDB.deleteDatabase(db.name)
                        }
                    }
                } else {
                    // Firefox fallback
                    console.log('🗑️ Deleting known PouchDB databases...')
                    indexedDB.deleteDatabase('_pouch_pomoflow-app-dev')
                    indexedDB.deleteDatabase('_pouch_pomoflow-tasks')
                }

                // Wait for deletions
                await new Promise(resolve => setTimeout(resolve, 1000))

                console.log('%c✅ Local databases cleared. Reloading in 2 seconds...', 'color: green; font-weight: bold;')
                console.log('Data will be restored from CouchDB server.')

                setTimeout(() => window.location.reload(), 2000)
            } catch (e) {
                console.error('❌ Emergency recovery failed:', e)
                console.log('%c🛠️ Manual fix: Open DevTools > Application > IndexedDB, delete all "_pouch_*" databases, then reload.', 'color: orange;')
            }
        },

        // ============= RELIABILITY PROOF =============
        async proveReliability() {
            const localDb = (window as any).pomoFlowDb
            if (!localDb) return console.error('❌ Local DB not ready')

            console.log('%c🔍 [RELIABILITY-PROOF] Starting Audit...', 'color: cyan; font-weight: bold;')

            try {
                const config = getDatabaseConfig()
                const remoteUrl = config.remote?.url
                const remoteDb = remoteUrl ? new PouchDB(remoteUrl, {
                    auth: config.remote?.auth
                }) : null

                const localInfo = await localDb.info()
                const remoteInfo = remoteDb ? await remoteDb.info() : { doc_count: 'OFFLINE' }

                console.log('%c📊 DOCUMENT COUNTS', 'color: yellow; font-weight: bold;')
                console.table({
                    'LOCAL DATABASE': { Name: localInfo.db_name, Docs: localInfo.doc_count, UpdateSeq: localInfo.update_seq },
                    'REMOTE DATABASE': { Name: remoteUrl || 'N/A', Docs: remoteInfo.doc_count, UpdateSeq: (remoteInfo as any).update_seq }
                })

                if (remoteDb && localInfo.doc_count === remoteInfo.doc_count) {
                    console.log('%c✅ PROOF: Local and Remote counts match perfectly!', 'color: green; font-weight: bold; font-size: 14px;')
                } else if (remoteDb) {
                    console.log(`%c⚠️ DISCREPANCY: Local (${localInfo.doc_count}) vs Remote (${remoteInfo.doc_count})`, 'color: orange;')
                }

                console.log('%c📋 ID STRUCTURE ANALYSIS (Top 20 IDs)', 'color: yellow; font-weight: bold;')
                const sample = await localDb.allDocs({ limit: 20 })
                console.log(sample.rows.map((r: any) => r.id))

                const taskCount = (await localDb.allDocs({ startkey: 'task-', endkey: 'task-\ufff0' })).total_rows
                const legacyExists = await localDb.get('tasks:data').then(() => true).catch(() => false)

                console.log('%c🎯 VISIBILITY REPORT', 'color: yellow; font-weight: bold;')
                console.table({
                    'Individual Tasks (task-*)': taskCount,
                    'Legacy Bundle (tasks:data)': legacyExists ? 'PRESENT' : 'ABSENT',
                    'Total Viewable Tasks': (window as any).pomoFlowDb ? 'Check UI or Store' : 'N/A'
                })

            } catch (err) {
                console.error('❌ Audit failed:', err)
            }
        },

        async listDocSamples() {
            const db = (window as any).pomoFlowDb
            if (!db) return
            const res = await db.allDocs({ include_docs: false, limit: 100 })
            console.log('📑 [ID-SAMPLES] First 100 document IDs in database:')
            console.log(res.rows.map((r: any) => r.id))

            const prefixes = new Set(res.rows.map((r: any) => r.id.split('-')[0] || r.id.split(':')[0]))
            console.log('🏷️  Detected Prefixes:', Array.from(prefixes))
        }
    }

    console.log('🔧 [DebugHelper] Installed. Run `debugHelper.inspectDB()`, `debugHelper.resetReplicationCheckpoint()`, `debugHelper.diagnoseDB()` or `debugHelper.nukeDB()`')
}
