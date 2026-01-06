/**
 * Migration Script: CouchDB to Supabase
 *
 * This script reads tasks and projects from CouchDB and inserts them into Supabase.
 *
 * Usage:
 *   node scripts/migrate-couchdb-to-supabase.cjs
 *
 * Prerequisites:
 *   - CouchDB accessible at the configured URL
 *   - Supabase local instance running
 *   - Supabase tables created (run supabase/schema.sql first)
 */

const https = require('http');

// Configuration
const COUCHDB_URL = process.env.COUCHDB_URL || 'http://84.46.253.137:5984/pomoflow-tasks';
const COUCHDB_USER = process.env.COUCHDB_USER || 'admin';
const COUCHDB_PASS = process.env.COUCHDB_PASS || 'pomoflow-2024';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

// The user ID to associate migrated data with (you need to get this from your Supabase auth)
// This should be the UUID of the authenticated user
const TARGET_USER_ID = process.env.SUPABASE_USER_ID || '8b4c3850-7d1d-4bb9-87ac-8a6ffeaabdef';

async function fetchFromCouchDB(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${COUCHDB_URL}${path}`);
    const auth = Buffer.from(`${COUCHDB_USER}:${COUCHDB_PASS}`).toString('base64');

    const req = https.request({
      hostname: url.hostname,
      port: url.port || 5984,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function insertIntoSupabase(table, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    const postData = JSON.stringify(data);

    const req = https.request({
      hostname: url.hostname,
      port: url.port || 54321,
      path: url.pathname,
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, status: res.statusCode });
        } else {
          resolve({ success: false, status: res.statusCode, error: data });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function deleteFromSupabase(table) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}?user_id=eq.${TARGET_USER_ID}`);

    const req = https.request({
      hostname: url.hostname,
      port: url.port || 54321,
      path: url.pathname + url.search,
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode }));
    });

    req.on('error', reject);
    req.end();
  });
}

function transformTask(couchTask) {
  // Map CouchDB task to Supabase schema
  return {
    id: couchTask.id || couchTask._id,
    user_id: TARGET_USER_ID,
    project_id: couchTask.projectId === 'uncategorized' ? null : couchTask.projectId,
    title: couchTask.title || 'Untitled Task',
    description: couchTask.description || '',
    status: couchTask.status || 'planned',
    priority: couchTask.priority || null,
    progress: couchTask.progress || 0,
    completed_pomodoros: couchTask.completedPomodoros || 0,
    estimated_pomodoros: couchTask.estimatedPomodoros || 1,
    due_date: couchTask.dueDate || null,
    due_time: couchTask.dueTime || null,
    subtasks: couchTask.subtasks || [],
    position: couchTask.canvasPosition || null,
    instances: couchTask.instances || [],
    is_in_inbox: couchTask.isInInbox || false,
    parent_task_id: couchTask.parentTaskId || null,
    depends_on: couchTask.dependsOn || [],
    is_deleted: couchTask.deleted || false,
    created_at: couchTask.createdAt || new Date().toISOString(),
    updated_at: couchTask.updatedAt || new Date().toISOString()
  };
}

function transformProject(couchProject) {
  // Map CouchDB project to Supabase schema
  return {
    id: couchProject.id || couchProject._id,
    user_id: TARGET_USER_ID,
    name: couchProject.name || 'Untitled Project',
    color: couchProject.color || '#3b82f6',
    color_type: couchProject.colorType || 'hex',
    view_type: couchProject.viewType || 'status',
    parent_id: couchProject.parentId || null,
    order: couchProject.order || 0,
    is_deleted: couchProject.deleted || false,
    created_at: couchProject.createdAt || new Date().toISOString(),
    updated_at: couchProject.updatedAt || new Date().toISOString()
  };
}

async function migrate() {
  console.log('🚀 Starting CouchDB to Supabase Migration\n');
  console.log('Configuration:');
  console.log(`  CouchDB: ${COUCHDB_URL}`);
  console.log(`  Supabase: ${SUPABASE_URL}`);
  console.log(`  Target User ID: ${TARGET_USER_ID}\n`);

  try {
    // 1. Fetch all documents from CouchDB
    console.log('📥 Fetching data from CouchDB...');
    const allDocs = await fetchFromCouchDB('/_all_docs?include_docs=true');

    if (!allDocs.rows) {
      throw new Error('No data found in CouchDB');
    }

    // 2. Filter and transform tasks
    const tasks = allDocs.rows
      .filter(row => row.id.startsWith('task-'))
      .map(row => transformTask(row.doc));

    console.log(`  Found ${tasks.length} tasks`);

    // 3. Filter and transform projects
    const projects = allDocs.rows
      .filter(row => row.id.startsWith('project-'))
      .map(row => transformProject(row.doc));

    console.log(`  Found ${projects.length} projects`);

    // 4. Clear existing data in Supabase (optional - uncomment if needed)
    console.log('\n🗑️  Clearing existing data in Supabase...');
    await deleteFromSupabase('tasks');
    await deleteFromSupabase('projects');
    console.log('  Cleared existing data');

    // 5. Insert projects first (tasks may reference them)
    console.log('\n📤 Inserting projects into Supabase...');
    let projectSuccess = 0, projectFailed = 0;
    for (const project of projects) {
      const result = await insertIntoSupabase('projects', project);
      if (result.success) {
        projectSuccess++;
        process.stdout.write('.');
      } else {
        projectFailed++;
        console.log(`\n  ❌ Failed: ${project.name} - ${result.error}`);
      }
    }
    console.log(`\n  ✅ Projects: ${projectSuccess} success, ${projectFailed} failed`);

    // 6. Insert tasks
    console.log('\n📤 Inserting tasks into Supabase...');
    let taskSuccess = 0, taskFailed = 0;
    for (const task of tasks) {
      const result = await insertIntoSupabase('tasks', task);
      if (result.success) {
        taskSuccess++;
        process.stdout.write('.');
      } else {
        taskFailed++;
        console.log(`\n  ❌ Failed: ${task.title} - ${result.error}`);
      }
    }
    console.log(`\n  ✅ Tasks: ${taskSuccess} success, ${taskFailed} failed`);

    // 7. Summary
    console.log('\n🎉 Migration Complete!');
    console.log(`  Projects migrated: ${projectSuccess}/${projects.length}`);
    console.log(`  Tasks migrated: ${taskSuccess}/${tasks.length}`);
    console.log('\nRefresh your browser to see the migrated data.');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
