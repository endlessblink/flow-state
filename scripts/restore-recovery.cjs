#!/usr/bin/env node
/**
 * Emergency restore from Jan 15th recovery backup
 */
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load env
function loadEnv() {
  const envFiles = ['.env.local', '.env']
  for (const file of envFiles) {
    const envPath = path.join(__dirname, '..', file)
    if (fs.existsSync(envPath)) {
      fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
        const [key, ...val] = line.split('=')
        if (key && val.length) process.env[key.trim()] = val.join('=').trim()
      })
    }
  }
}

loadEnv()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
)

async function restore() {
  const backupPath = path.join(__dirname, '../backups/RECOVERY-2026-01-15T23-16-49-145Z.json')
  const backup = JSON.parse(fs.readFileSync(backupPath))

  console.log('\n=== Restoring from Jan 15th backup ===')
  console.log('  Tasks:', backup.tasks.length)
  console.log('  Groups:', backup.groups.length)
  console.log('  Projects:', backup.projects.length)
  console.log('')

  const userId = '717f5209-42d8-4bb9-8781-740107a384e5'

  // Filter to only active (non-deleted) items
  const tasks = backup.tasks.filter(t => !t.is_deleted)
  const groups = backup.groups.filter(g => !g.is_deleted)
  const projects = backup.projects.filter(p => !p.is_deleted)

  console.log('After filtering deleted:')
  console.log('  Tasks:', tasks.length)
  console.log('  Groups:', groups.length)
  console.log('  Projects:', projects.length)
  console.log('')

  // Restore projects first
  console.log('Restoring projects...')
  for (const p of projects) {
    const { error } = await supabase.from('projects').upsert({
      id: p.id,
      user_id: userId,
      name: p.name || 'Untitled',
      color: p.color,
      color_type: p.color_type || 'hex',
      view_type: p.view_type || 'status',
      is_deleted: false,
      created_at: p.created_at,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' })
    if (error) console.error('  Project error:', p.name, error.message)
    else console.log('  OK:', p.name)
  }

  // Restore groups (root first, then children)
  console.log('\nRestoring groups...')
  const rootGroups = groups.filter(g => !g.parent_group_id)
  const childGroups = groups.filter(g => g.parent_group_id)

  for (const g of [...rootGroups, ...childGroups]) {
    const posJson = g.position_json || g.position || { x: 0, y: 0, width: 300, height: 200 }
    const { error } = await supabase.from('groups').upsert({
      id: g.id,
      user_id: userId,
      name: g.name || g.title || 'Untitled',
      type: g.type || 'custom',
      color: g.color,
      position_json: posJson,
      layout: g.layout || 'freeform',
      is_visible: g.is_visible !== false,
      is_collapsed: g.is_collapsed || false,
      parent_group_id: g.parent_group_id,
      is_deleted: false,
      created_at: g.created_at,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' })
    const name = g.name || g.title || g.id.slice(0,8)
    if (error) console.error('  Group error:', name, error.message)
    else console.log('  OK:', name)
  }

  // Restore tasks
  console.log('\nRestoring tasks...')
  let success = 0, failed = 0
  for (const t of tasks) {
    const pos = t.position || (t.canvasPosition ? {
      x: t.canvasPosition.x,
      y: t.canvasPosition.y,
      parentId: t.parentId
    } : null)

    const { error } = await supabase.from('tasks').upsert({
      id: t.id,
      user_id: userId,
      title: t.title || 'Untitled',
      description: t.description || '',
      status: t.status || 'planned',
      priority: t.priority,
      due_date: t.due_date || t.dueDate,
      project_id: t.project_id || t.projectId,
      position: pos,
      subtasks: t.subtasks || [],
      tags: t.tags || [],
      is_in_inbox: t.is_in_inbox || t.isInInbox || false,
      is_deleted: false,
      completed_at: t.completed_at || t.completedAt,
      created_at: t.created_at || t.createdAt,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' })

    if (error) {
      console.error('  Task error:', t.title, error.message)
      failed++
    } else {
      success++
    }
  }
  console.log('  Tasks:', success, 'restored,', failed, 'failed')

  console.log('\n=== Restore complete! ===\n')
}

restore().catch(console.error)
