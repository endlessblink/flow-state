const { createClient } = require('@supabase/supabase-js');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Function to load env vars manually to avoid dependencies
function loadEnv(filename) {
    try {
        const envPath = path.join(__dirname, '../' + filename);
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            const lines = content.split('\n');
            const env = {};
            lines.forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
                }
            });
            return env;
        }
    } catch (e) {
        // Ignore missing files
    }
    return {};
}

// Load .env and .env.local
const env = { ...loadEnv('.env'), ...loadEnv('.env.local') };

const BACKUP_DIR = path.join(__dirname, '../backups');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';

// Key Priority: Service Role (Bypass RLS) > Anon (Respect RLS)
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
    console.error('[Shadow] ❌ Error: No Supabase Key found in environment or .env/.env.local');
    process.exit(1);
}

// Ensure backup dir exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Initialize SQLite Shadow Database
const db = new Database(path.join(BACKUP_DIR, 'shadow.db'));
db.pragma('journal_mode = WAL');

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'tasks', 'groups', 'projects', 'full'
    data_json TEXT NOT NULL,
    item_count INTEGER,
    checksum TEXT
  );
  
  CREATE INDEX IF NOT EXISTS idx_timestamp ON snapshots(timestamp);
`);

// Initialize Supabase Client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

async function runShadowSync() {
    const timestamp = Date.now();
    console.log(`[Shadow] 🌑 Starting Mirror Sync at ${new Date(timestamp).toLocaleTimeString()}...`);

    if (SUPABASE_KEY.includes('service_role')) {
        console.log('         🔐 Mode: SERVICE_ROLE (Full Access)');
    } else {
        console.log('         ⚠️  Mode: ANON (RLS Restricted - Backup might be empty)');
    }

    try {
        // 1. Fetch Data
        const { data: tasks, error: taskError } = await supabase.from('tasks').select('*');
        if (taskError) throw taskError;

        const { data: groups, error: groupError } = await supabase.from('groups').select('*');
        if (groupError) throw groupError;

        const { data: projects, error: projectError } = await supabase.from('projects').select('*');
        if (projectError) throw projectError;

        // 2. Prepare Snapshot
        const snapshot = {
            tasks,
            groups,
            projects,
            meta: {
                timestamp,
                counts: {
                    tasks: tasks.length,
                    groups: groups.length,
                    projects: projects.length
                }
            }
        };

        const json = JSON.stringify(snapshot);

        // 3. Insert into SQLite
        const insert = db.prepare(`
      INSERT INTO snapshots (timestamp, type, data_json, item_count, checksum)
      VALUES (?, 'full', ?, ?, ?)
    `);

        // Simple length-based checksum
        const checksum = `len:${json.length}`;

        insert.run(timestamp, json, tasks.length + groups.length, checksum);

        console.log(`[Shadow] ✅ Snapshot saved! (${tasks.length} tasks, ${groups.length} groups)`);

        // 4. Prune old snapshots (Keep last 1000)
        const count = db.prepare('SELECT count(*) as c FROM snapshots').get().c;
        if (count > 1000) {
            db.prepare('DELETE FROM snapshots WHERE id IN (SELECT id FROM snapshots ORDER BY timestamp ASC LIMIT 1)').run();
        }

    } catch (error) {
        console.error('[Shadow] ❌ Sync Failed:', error.message);
        process.exit(1);
    }
}

// Run immediately
runShadowSync();
