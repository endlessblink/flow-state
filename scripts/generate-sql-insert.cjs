/**
 * Generate SQL INSERT statements from CouchDB data
 * This bypasses RLS by using direct SQL
 */
const http = require('http');

const COUCHDB_URL = 'http://84.46.253.137:5984/pomoflow-tasks';
const COUCHDB_USER = 'admin';
const COUCHDB_PASS = 'pomoflow-2024';
const TARGET_USER_ID = '8b4c3850-7d1d-4bb9-87ac-8a6ffeaabdef';

async function fetchFromCouchDB(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(COUCHDB_URL + path);
    const auth = Buffer.from(COUCHDB_USER + ':' + COUCHDB_PASS).toString('base64');

    const req = http.request({
      hostname: url.hostname,
      port: url.port || 5984,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

function escapeSql(str) {
  if (str == null) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

function escapeJson(obj) {
  if (obj == null) return 'NULL';
  return "'" + JSON.stringify(obj).replace(/'/g, "''") + "'::jsonb";
}

async function main() {
  const allDocs = await fetchFromCouchDB('/_all_docs?include_docs=true');

  // Projects
  const projects = allDocs.rows.filter(r => r.id.startsWith('project-')).map(r => r.doc);
  console.log('-- Projects (' + projects.length + ')');
  for (const p of projects) {
    const id = escapeSql(p.id || p._id);
    const name = escapeSql(p.name || 'Untitled');
    const color = escapeSql(p.color || '#3b82f6');
    const colorType = escapeSql(p.colorType || 'hex');
    const viewType = escapeSql(p.viewType || 'status');
    const parentId = p.parentId ? escapeSql(p.parentId) : 'NULL';
    const order = p.order || 0;
    const isDeleted = p.deleted ? 'true' : 'false';
    const createdAt = p.createdAt ? escapeSql(p.createdAt) : 'now()';
    const updatedAt = p.updatedAt ? escapeSql(p.updatedAt) : 'now()';

    console.log('INSERT INTO public.projects (id, user_id, name, color, color_type, view_type, parent_id, "order", is_deleted, created_at, updated_at) VALUES (' + id + ', \'' + TARGET_USER_ID + '\'::uuid, ' + name + ', ' + color + ', ' + colorType + ', ' + viewType + ', ' + parentId + ', ' + order + ', ' + isDeleted + ', ' + createdAt + '::timestamptz, ' + updatedAt + '::timestamptz) ON CONFLICT (id) DO NOTHING;');
  }

  // Tasks
  const tasks = allDocs.rows.filter(r => {
    // Match task-* or numeric IDs that are tasks
    if (r.id.startsWith('task-')) return true;
    if (/^\d+$/.test(r.id) && r.doc && r.doc.title) return true;
    return false;
  }).map(r => r.doc);

  console.log('-- Tasks (' + tasks.length + ')');
  for (const t of tasks) {
    if (!t) continue;
    const id = escapeSql(t.id || t._id);
    const title = escapeSql(t.title || 'Untitled');
    const description = escapeSql(t.description || '');
    const status = escapeSql(t.status || 'planned');
    const priority = t.priority ? escapeSql(t.priority) : 'NULL';
    const progress = t.progress || 0;
    const completedPomodoros = t.completedPomodoros || 0;
    const estimatedPomodoros = t.estimatedPomodoros || 0;
    const dueDate = t.dueDate ? escapeSql(t.dueDate) + '::timestamptz' : 'NULL';
    const dueTime = t.dueTime ? escapeSql(t.dueTime) : 'NULL';
    const subtasks = t.subtasks ? escapeJson(t.subtasks) : "'[]'::jsonb";
    const position = t.canvasPosition ? escapeJson(t.canvasPosition) : 'NULL';
    const instances = t.instances ? escapeJson(t.instances) : "'[]'::jsonb";
    const isInInbox = t.isInInbox ? 'true' : 'false';
    const projectId = (t.projectId && t.projectId !== 'uncategorized') ? escapeSql(t.projectId) : 'NULL';
    const parentTaskId = t.parentTaskId ? escapeSql(t.parentTaskId) : 'NULL';

    let dependsOn = 'NULL';
    if (t.dependsOn && Array.isArray(t.dependsOn) && t.dependsOn.length > 0) {
      dependsOn = 'ARRAY[' + t.dependsOn.map(d => escapeSql(d)).join(',') + ']::text[]';
    }

    const isDeleted = t.deleted ? 'true' : 'false';
    const createdAt = t.createdAt ? escapeSql(t.createdAt) : 'now()';
    const updatedAt = t.updatedAt ? escapeSql(t.updatedAt) : 'now()';

    console.log('INSERT INTO public.tasks (id, user_id, project_id, title, description, status, priority, progress, completed_pomodoros, estimated_pomodoros, due_date, due_time, subtasks, position, instances, is_in_inbox, parent_task_id, depends_on, is_deleted, created_at, updated_at) VALUES (' + id + ', \'' + TARGET_USER_ID + '\'::uuid, ' + projectId + ', ' + title + ', ' + description + ', ' + status + ', ' + priority + ', ' + progress + ', ' + completedPomodoros + ', ' + estimatedPomodoros + ', ' + dueDate + ', ' + dueTime + ', ' + subtasks + ', ' + position + ', ' + instances + ', ' + isInInbox + ', ' + parentTaskId + ', ' + dependsOn + ', ' + isDeleted + ', ' + createdAt + '::timestamptz, ' + updatedAt + '::timestamptz) ON CONFLICT (id) DO NOTHING;');
  }
}

main().catch(console.error);
