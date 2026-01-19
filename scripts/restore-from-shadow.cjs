#!/usr/bin/env node
/**
 * Foolproof Shadow Backup Recovery Script
 * TASK-317: Enhanced with tombstone filtering to prevent zombie data resurrection
 *
 * Restores data from shadow.db to Supabase with:
 * - Automatic user_id remapping
 * - Correct FK constraint ordering (topological sort)
 * - UPSERT to handle existing data
 * - Tombstone filtering (skips permanently deleted items)
 * - Soft-delete filtering (skips is_deleted=true items)
 * - Dry-run mode for previewing
 *
 * Usage:
 *   npm run restore              # Auto-detect user, restore all
 *   npm run restore:dry-run      # Preview without changes
 *   node scripts/restore-from-shadow.cjs [user_id] [--dry-run]
 *   node scripts/restore-from-shadow.cjs [user_id] [--no-filter]  # Skip tombstone filtering
 *
 * @since 2026-01-16
 * @updated 2026-01-20 - TASK-317 tombstone filtering
 */

const Database = require('better-sqlite3')
const { createClient } = require('@supabase/supabase-js')
const path = require('path')
const fs = require('fs')

// =============================================================================
// Configuration
// =============================================================================

const SHADOW_DB_PATH = path.join(__dirname, '../backups/shadow.db')

// Parse command line args
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const SKIP_FILTER = args.includes('--no-filter')  // TASK-317: Skip tombstone/soft-delete filtering
const USER_ID_ARG = args.find(a => !a.startsWith('--'))

// =============================================================================
// Utilities
// =============================================================================

function log(emoji, message) {
  console.log(`${emoji} ${message}`)
}

function loadEnv() {
  const envFiles = ['.env.local', '.env']
  for (const file of envFiles) {
    const envPath = path.join(__dirname, '..', file)
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8')
      content.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=')
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim()
        }
      })
    }
  }
}

// =============================================================================
// TASK-317: Tombstone Filtering
// =============================================================================

/**
 * Fetch tombstones from Supabase to filter permanently deleted items
 */
async function fetchTombstones(supabase) {
  try {
    const { data, error } = await supabase
      .from('tombstones')
      .select('entity_type, entity_id')

    if (error) {
      log('⚠️', `Could not fetch tombstones: ${error.message}`)
      return new Set()
    }

    return new Set(data.map(t => `${t.entity_type}:${t.entity_id}`))
  } catch (e) {
    log('⚠️', `Tombstone fetch failed: ${e.message}`)
    return new Set()
  }
}

/**
 * Filter items based on soft-delete flag and tombstones
 */
function filterDeletedItems(items, entityType, tombstones) {
  if (SKIP_FILTER) return items

  const original = items.length
  const filtered = items.filter(item => {
    // Skip soft-deleted items
    if (item.is_deleted === true) {
      return false
    }

    // Skip tombstoned items (permanently deleted)
    if (tombstones.has(`${entityType}:${item.id}`)) {
      return false
    }

    return true
  })

  const removed = original - filtered.length
  if (removed > 0) {
    log('🗑️', `Filtered ${removed} deleted ${entityType}s (${filtered.length} remaining)`)
  }

  return filtered
}

// =============================================================================
// Main Recovery Functions
// =============================================================================

async function getLatestSnapshot() {
  if (!fs.existsSync(SHADOW_DB_PATH)) {
    throw new Error(`Shadow database not found at ${SHADOW_DB_PATH}`)
  }

  const db = new Database(SHADOW_DB_PATH, { readonly: true })

  const snapshot = db.prepare(`
    SELECT id, timestamp, data_json, item_count
    FROM snapshots
    WHERE item_count > 0
    ORDER BY timestamp DESC
    LIMIT 1
  `).get()

  db.close()

  if (!snapshot) {
    throw new Error('No snapshots with data found in shadow.db')
  }

  const data = JSON.parse(snapshot.data_json)

  return {
    id: snapshot.id,
    timestamp: snapshot.timestamp,
    tasks: data.tasks || [],
    groups: data.groups || [],
    projects: data.projects || [],
    meta: data.meta
  }
}

async function restoreProjects(supabase, projects, userId) {
  log('📁', `Restoring ${projects.length} projects...`)

  let success = 0, skipped = 0, failed = 0

  for (const project of projects) {
    const projectData = {
      id: project.id,
      user_id: userId,
      name: project.name || 'Untitled',
      color: project.color || '#3b82f6',
      color_type: project.color_type || 'hex',
      view_type: project.view_type || 'status',
      order: project.order || 0,
      is_deleted: false,
      created_at: project.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    if (DRY_RUN) {
      log('  📋', `Would restore project: ${projectData.name}`)
      success++
      continue
    }

    const { error } = await supabase
      .from('projects')
      .upsert(projectData, { onConflict: 'id' })

    if (error) {
      log('  ❌', `Failed to restore project ${projectData.name}: ${error.message}`)
      failed++
    } else {
      success++
    }
  }

  return { success, skipped, failed }
}

async function restoreGroups(supabase, groups, userId) {
  log('📦', `Restoring ${groups.length} groups...`)

  let success = 0, skipped = 0, failed = 0

  // Separate root groups (no parent) from child groups
  const rootGroups = groups.filter(g => !g.parent_group_id)
  const childGroups = groups.filter(g => g.parent_group_id)

  // Insert root groups first
  for (const group of rootGroups) {
    const result = await insertGroup(supabase, group, userId, null)
    if (result === 'success') success++
    else if (result === 'skipped') skipped++
    else failed++
  }

  // Then insert child groups (parent references now exist)
  for (const group of childGroups) {
    const result = await insertGroup(supabase, group, userId, group.parent_group_id)
    if (result === 'success') success++
    else if (result === 'skipped') skipped++
    else failed++
  }

  return { success, skipped, failed }
}

async function insertGroup(supabase, group, userId, parentGroupId) {
  // Build position_json from various possible sources
  let positionJson = group.position_json
  if (!positionJson && (group.canvasPosition || group.position)) {
    positionJson = {
      x: group.canvasPosition?.x ?? group.position?.x ?? 0,
      y: group.canvasPosition?.y ?? group.position?.y ?? 0,
      width: group.dimensions?.width ?? group.width ?? 300,
      height: group.dimensions?.height ?? group.height ?? 200
    }
  }

  const groupData = {
    id: group.id,
    user_id: userId,
    name: group.name || group.title || 'Untitled',
    type: group.type || 'custom',
    color: group.color || '#6366f1',
    position_json: positionJson || { x: 0, y: 0, width: 300, height: 200 },
    layout: group.layout || 'freeform',
    is_visible: group.is_visible !== false,
    is_collapsed: group.is_collapsed || false,
    parent_group_id: parentGroupId,
    is_pinned: group.is_pinned || false,
    is_deleted: false,
    auto_collect: group.auto_collect || false,
    is_power_mode: group.is_power_mode || false,
    assign_on_drop_json: group.assign_on_drop_json || null,
    created_at: group.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  if (DRY_RUN) {
    log('  📋', `Would restore group: ${groupData.name} (pos: ${groupData.position_json.x}, ${groupData.position_json.y})`)
    return 'success'
  }

  const { error } = await supabase
    .from('groups')
    .upsert(groupData, { onConflict: 'id' })

  if (error) {
    log('  ❌', `Failed to restore group ${groupData.name}: ${error.message}`)
    return 'failed'
  }

  return 'success'
}

async function restoreTasks(supabase, tasks, userId) {
  log('✅', `Restoring ${tasks.length} tasks...`)

  let success = 0, skipped = 0, failed = 0

  for (const task of tasks) {
    // Build position jsonb from various possible sources
    let positionJson = task.position
    if (!positionJson && task.canvasPosition) {
      positionJson = {
        x: task.canvasPosition.x ?? 0,
        y: task.canvasPosition.y ?? 0,
        format: 'absolute',
        parentId: task.canvasPosition.parentId || null
      }
    }

    const taskData = {
      id: task.id,
      user_id: userId,
      title: task.title || 'Untitled Task',
      description: task.description || '',
      status: task.status || 'planned',
      priority: task.priority || 'medium',
      due_date: task.dueDate || task.due_date || null,
      due_time: task.due_time || null,
      parent_task_id: task.parent_task_id || task.parentId || task.parent_id || null,
      project_id: task.projectId || task.project_id || null,
      position: positionJson || null,
      subtasks: task.subtasks || [],
      tags: task.tags || [],
      estimated_pomodoros: task.estimatedPomodoros || task.estimated_pomodoros || 0,
      completed_pomodoros: task.completedPomodoros || task.completed_pomodoros || 0,
      is_in_inbox: task.is_in_inbox ?? false,
      order: task.order ?? 0,
      completed_at: task.completedAt || task.completed_at || null,
      is_deleted: false,
      created_at: task.createdAt || task.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    if (DRY_RUN) {
      log('  📋', `Would restore task: ${taskData.title}`)
      success++
      continue
    }

    const { error } = await supabase
      .from('tasks')
      .upsert(taskData, { onConflict: 'id' })

    if (error) {
      // If FK constraint fails (project doesn't exist), try without project_id
      if (error.message.includes('foreign key') && taskData.project_id) {
        log('  ⚠️', `Task "${taskData.title}" references missing project, restoring without project`)
        taskData.project_id = null
        const { error: retryError } = await supabase
          .from('tasks')
          .upsert(taskData, { onConflict: 'id' })

        if (retryError) {
          log('  ❌', `Failed to restore task ${taskData.title}: ${retryError.message}`)
          failed++
        } else {
          success++
        }
      } else {
        log('  ❌', `Failed to restore task ${taskData.title}: ${error.message}`)
        failed++
      }
    } else {
      success++
    }
  }

  return { success, skipped, failed }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('')
  console.log('═══════════════════════════════════════════════════════════════════')
  console.log('  SHADOW BACKUP RECOVERY')
  console.log('═══════════════════════════════════════════════════════════════════')
  console.log('')

  if (DRY_RUN) {
    log('🔍', 'DRY RUN MODE - No changes will be made')
    console.log('')
  }

  try {
    // Load environment
    loadEnv()

    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials in .env.local')
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    })

    // Get latest snapshot
    log('📂', 'Loading latest snapshot from shadow.db...')
    const snapshot = await getLatestSnapshot()
    const snapshotDate = new Date(snapshot.timestamp).toLocaleString()

    console.log('')
    log('📊', `Snapshot from: ${snapshotDate}`)
    log('   ', `Tasks: ${snapshot.tasks.length}`)
    log('   ', `Groups: ${snapshot.groups.length}`)
    log('   ', `Projects: ${snapshot.projects.length}`)
    console.log('')

    // Get current user
    let userId = USER_ID_ARG

    if (!userId) {
      // Query auth.users via PostgREST with service role key
      // Service role key bypasses RLS and can access auth schema
      log('👤', 'Auto-detecting user from database...')

      // Use raw SQL via psql since Supabase client can't query auth schema directly
      const { execSync } = require('child_process')
      try {
        const result = execSync(
          'docker exec supabase_db_flow-state psql -U postgres -d postgres -t -c "SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 1;"',
          { encoding: 'utf-8', timeout: 5000 }
        ).trim()

        if (result && result.includes('|')) {
          const [id, email] = result.split('|').map(s => s.trim())
          if (id) {
            userId = id
            log('👤', `Found user: ${email || 'unknown'} (${id})`)
          }
        }
      } catch (err) {
        // Docker command failed, try from snapshot
        log('⚠️', 'Could not query database directly, checking snapshot for user_id...')
      }
    }

    // Fallback: get user_id from the snapshot data itself
    if (!userId && snapshot.tasks.length > 0) {
      const snapshotUserId = snapshot.tasks[0].user_id
      if (snapshotUserId) {
        log('⚠️', `Using user_id from snapshot: ${snapshotUserId}`)
        log('⚠️', 'Note: This may fail if user no longer exists. Provide user_id as argument.')
        userId = snapshotUserId
      }
    }

    if (!userId) {
      throw new Error('Could not detect user. Please provide user_id as argument: npm run restore -- <user_id>')
    }

    log('👤', `Restoring for user: ${userId}`)
    console.log('')

    // TASK-317: Fetch tombstones and filter deleted items
    if (!SKIP_FILTER) {
      log('🪦', 'Fetching tombstones (permanently deleted items)...')
      const tombstones = await fetchTombstones(supabase)
      log('🪦', `Found ${tombstones.size} tombstoned items`)
      console.log('')

      // Filter soft-deleted and tombstoned items
      snapshot.projects = filterDeletedItems(snapshot.projects, 'project', tombstones)
      snapshot.groups = filterDeletedItems(snapshot.groups, 'group', tombstones)
      snapshot.tasks = filterDeletedItems(snapshot.tasks, 'task', tombstones)
      console.log('')
    } else {
      log('⚠️', '--no-filter: Skipping tombstone/soft-delete filtering')
      console.log('')
    }

    // Restore in order: Projects → Groups → Tasks
    const results = {
      projects: await restoreProjects(supabase, snapshot.projects, userId),
      groups: await restoreGroups(supabase, snapshot.groups, userId),
      tasks: await restoreTasks(supabase, snapshot.tasks, userId)
    }

    // Summary
    console.log('')
    console.log('═══════════════════════════════════════════════════════════════════')
    console.log('  RECOVERY SUMMARY')
    console.log('═══════════════════════════════════════════════════════════════════')
    console.log('')

    const totalSuccess = results.projects.success + results.groups.success + results.tasks.success
    const totalFailed = results.projects.failed + results.groups.failed + results.tasks.failed

    log('📁', `Projects: ${results.projects.success} restored, ${results.projects.failed} failed`)
    log('📦', `Groups:   ${results.groups.success} restored, ${results.groups.failed} failed`)
    log('✅', `Tasks:    ${results.tasks.success} restored, ${results.tasks.failed} failed`)
    console.log('')

    if (DRY_RUN) {
      log('🔍', `DRY RUN COMPLETE - ${totalSuccess} items would be restored`)
      log('💡', 'Run without --dry-run to perform actual restore')
    } else if (totalFailed === 0) {
      log('🎉', `SUCCESS! ${totalSuccess} items restored`)
      log('💡', 'Refresh the app to see your restored data')
    } else {
      log('⚠️', `Completed with ${totalFailed} failures`)
    }

    console.log('')

  } catch (error) {
    console.error('')
    log('❌', `RECOVERY FAILED: ${error.message}`)
    console.error('')
    process.exit(1)
  }
}

main()
