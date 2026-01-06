/**
 * Cleanup orphan tasks - mark tasks as deleted that should have been deleted
 * Run once to fix tasks that were "deleted" before the persistence bug was fixed
 */
const https = require('https');

const SUPABASE_URL = 'hruaigefkzndcrqblkba.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY environment variable required');
  console.log('Usage: SUPABASE_SERVICE_KEY=your_key node scripts/cleanup-orphan-tasks.cjs');
  process.exit(1);
}

// Task IDs to mark as deleted (add the IDs of tasks showing incorrectly)
// For now, let's query and show all tasks first
async function supabaseRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SUPABASE_URL,
      path: '/rest/v1' + path,
      method: method,
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data || '[]'));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('🔍 Fetching all non-deleted tasks...\n');
  
  const tasks = await supabaseRequest('GET', '/tasks?is_deleted=eq.false&select=id,title,status,created_at');
  
  if (!Array.isArray(tasks)) {
    console.error('Failed to fetch tasks:', tasks);
    return;
  }
  
  console.log(`Found ${tasks.length} non-deleted tasks:\n`);
  tasks.forEach((t, i) => {
    console.log(`${i + 1}. [${t.id}] ${t.title} (${t.status})`);
  });
  
  console.log('\n📝 To mark specific tasks as deleted, run:');
  console.log('SUPABASE_SERVICE_KEY=xxx TASK_IDS="id1,id2,id3" node scripts/cleanup-orphan-tasks.cjs --delete');
}

async function deleteSpecificTasks() {
  const taskIds = process.env.TASK_IDS?.split(',').map(s => s.trim()).filter(Boolean);
  
  if (!taskIds || taskIds.length === 0) {
    console.error('❌ TASK_IDS environment variable required');
    return;
  }
  
  console.log(`🗑️ Marking ${taskIds.length} tasks as deleted...\n`);
  
  for (const taskId of taskIds) {
    console.log(`  Deleting: ${taskId}`);
    await supabaseRequest('PATCH', `/tasks?id=eq.${taskId}`, {
      is_deleted: true,
      deleted_at: new Date().toISOString()
    });
  }
  
  console.log('\n✅ Done! Refresh the app to see changes.');
}

if (process.argv.includes('--delete')) {
  deleteSpecificTasks();
} else {
  main();
}
