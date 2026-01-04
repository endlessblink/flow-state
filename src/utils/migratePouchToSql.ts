
import PouchDB from 'pouchdb'
import PowerSyncService from '@/services/database/PowerSyncDatabase'
import { SqlTask, SqlProject } from '@/services/database/SqlDatabaseTypes'

// Helper to find the active PomoFlow database name
async function findActivePouchDBName(): Promise<string> {
    if (typeof indexedDB === 'undefined' || !indexedDB.databases) {
        console.warn('⚠️ [MIGRATION] indexedDB.databases() not supported, falling back to default name')
        return 'pomoflow_local_db'
    }

    try {
        const dbs = await indexedDB.databases()
        // Look for databases starting with _pouch_pomoflow (PouchDB prefixes internal names)
        // OR look for our known prefix 'pomoflow'
        const pomoDb = dbs.find(db => db.name && (db.name.includes('pomoflow-app') || db.name.includes('pomoflow_local_db')))

        if (pomoDb && pomoDb.name) {
            // PouchDB prefixes the actual IndexedDB name with '_pouch_', we need to strip it if present
            // But valid PouchDB constructor name should NOT have _pouch_ prefix if we want it to map to that IDB.
            // Wait: new PouchDB('foo') creates IDB '_pouch_foo'.
            // So if IDB name is '_pouch_pomoflow-app-123', we pass 'pomoflow-app-123'.
            const realName = pomoDb.name.replace(/^_pouch_/, '')
            console.log(`🔍 [MIGRATION] Auto-detected active DB: ${realName} (from ${pomoDb.name})`)
            return realName
        }
    } catch (e) {
        console.error('⚠️ [MIGRATION] Failed to list databases', e)
    }

    return 'pomoflow_local_db' // Fallback
}

/**
 * Migrate all data from PouchDB to SQLite
 */
export async function migratePouchToSql(existingPouch?: PouchDB.Database): Promise<{ tasks: number, projects: number, errors: string[] }> {
    console.log('📦 [MIGRATION] Starting PouchDB -> SQLite migration...')
    const errors: string[] = []
    let taskCount = 0
    let projectCount = 0

    try {
        // 1. Initialize Legacy PouchDB (Read Only)
        let pouch: PouchDB.Database
        let dbName = ''

        if (existingPouch) {
            console.log('📦 [MIGRATION] Reusing existing PouchDB connection')
            pouch = existingPouch
            dbName = pouch.name
        } else {
            // Auto-discover the name
            dbName = await findActivePouchDBName()
            pouch = new PouchDB(dbName, { adapter: 'idb' })
        }

        const allDocs = await pouch.allDocs({ include_docs: true })

        console.log(`📦 [MIGRATION] Found ${allDocs.rows.length} documents in PouchDB (${dbName})`)

        if (allDocs.rows.length === 0) {
            console.warn('⚠️ [MIGRATION] No documents found. Is the DB name correct?')
        }

        // 2. Initialize New SQLite DB
        const sqlDb = await PowerSyncService.getInstance()

        // 3. Prepare Bulk Data
        const tasksToInsert: any[] = []
        const projectsToInsert: any[] = []

        for (const row of allDocs.rows) {
            const doc = row.doc as any
            if (!doc) continue

            // --- TASKS ---
            // Detection: standard tasks or independent task docs
            if (doc.type === 'task' || (doc._id && !doc._id.startsWith('_') && !doc.type)) {
                // Basic task shape validation
                if (!doc.title && !doc.content) continue;

                // Handle legacy field names
                const completedPomos = doc.completedPomodoros ?? doc.totalPomodoros ?? doc.actPomodoros ?? 0;
                const estimatedPomos = doc.estimatedPomodoros ?? doc.estPomodoros ?? 1;

                const task: SqlTask = {
                    id: doc._id,
                    title: doc.title || doc.content || 'Untitled',
                    status: doc.status || 'todo',
                    project_id: doc.projectId || doc.project_id || 'uncategorized',
                    description: doc.note || doc.description || '',
                    total_pomodoros: completedPomos,
                    estimated_pomodoros: estimatedPomos,
                    order: doc.order || 0,
                    column_id: doc.columnId || doc.column_id || '',
                    created_at: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : (doc.createdAt || new Date().toISOString()),
                    updated_at: new Date().toISOString(), // Fresh timestamp
                    completed_at: doc.completedAt || undefined,
                    is_deleted: doc.isDeleted ? 1 : 0,
                    deleted_at: doc.deletedAt || undefined
                }
                tasksToInsert.push(task)
                taskCount++
            }

            // --- PROJECTS ---
            if (doc.type === 'project') {
                const project: SqlProject = {
                    id: doc._id,
                    name: doc.name || 'Untitled Project',
                    color: doc.color || '#808080',
                    created_at: doc.createdAt || new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    is_deleted: doc.isDeleted ? 1 : 0
                }
                projectsToInsert.push(project)
                projectCount++
            }
        }

        // 4. Execute Bulk Inserts (Transaction)
        await sqlDb.writeTransaction(async (tx) => {
            // Tasks
            for (const t of tasksToInsert) {
                await tx.execute(`
          INSERT OR REPLACE INTO tasks (
            id, title, status, project_id, description, 
            total_pomodoros, estimated_pomodoros, "order", column_id,
            created_at, updated_at, completed_at, is_deleted, deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
                    t.id, t.title, t.status, t.project_id, t.description,
                    t.total_pomodoros, t.estimated_pomodoros, t.order, t.column_id,
                    t.created_at, t.updated_at, t.completed_at, t.is_deleted, t.deleted_at
                ])
            }

            // Projects
            for (const p of projectsToInsert) {
                await tx.execute(`
          INSERT OR REPLACE INTO projects (
            id, name, color, created_at, updated_at, is_deleted
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
                    p.id, p.name, p.color, p.created_at, p.updated_at, p.is_deleted
                ])
            }
        })

        console.log(`✅ [MIGRATION] Migration Complete! Moved ${taskCount} tasks and ${projectCount} projects.`)
        localStorage.setItem('POWERSYNC_MIGRATION_COMPLETE', 'true')

        // Force reload to switch drivers
        setTimeout(() => window.location.reload(), 1000)

        return { tasks: taskCount, projects: projectCount, errors }

    } catch (err: any) {
        console.error('❌ [MIGRATION] Critical Failure:', err)
        errors.push(err.message)
        return { tasks: taskCount, projects: projectCount, errors }
    }
}
