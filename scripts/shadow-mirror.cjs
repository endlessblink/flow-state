/**
 * Shadow Mirror - Resilient Backup System
 * TASK-317: Hardened with connection health checks, threshold guards, and atomic writes
 *
 * This script creates periodic snapshots of Supabase data to a local SQLite database
 * and exports to JSON for frontend emergency restore.
 */

const { createClient } = require('@supabase/supabase-js');
const Database = require('better-sqlite3');
const writeFileAtomic = require('write-file-atomic');
const path = require('path');
const fs = require('fs');

// Schema version for compatibility tracking
const SCHEMA_VERSION = '3.1.0';

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
const PUBLIC_DIR = path.join(__dirname, '../public');
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

// Initialize Schema with enhanced metadata
db.exec(`
  CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'tasks', 'groups', 'projects', 'full'
    data_json TEXT NOT NULL,
    item_count INTEGER,
    checksum TEXT,
    connection_healthy INTEGER DEFAULT 1,
    latency_ms INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_timestamp ON snapshots(timestamp);
  CREATE INDEX IF NOT EXISTS idx_item_count ON snapshots(item_count);
`);

// Initialize Supabase Client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

/**
 * TASK-317: Check database connection health before fetching
 * Returns { healthy: boolean, latency: number }
 */
async function checkDatabaseHealth() {
    const start = Date.now();
    try {
        const { error } = await supabase.from('tasks').select('id', { count: 'exact', head: true });
        const latency = Date.now() - start;
        if (error) {
            console.error('[Shadow] ⚠️ Health check query failed:', error.message);
            return { healthy: false, latency: -1 };
        }
        return { healthy: true, latency };
    } catch (e) {
        console.error('[Shadow] ❌ Database health check failed:', e.message);
        return { healthy: false, latency: -1 };
    }
}

/**
 * TASK-317: Get the last good snapshot counts for threshold comparison
 */
function getLastGoodSnapshotCounts() {
    try {
        const row = db.prepare(`
            SELECT data_json FROM snapshots
            WHERE type = 'full' AND item_count > 0 AND connection_healthy = 1
            ORDER BY timestamp DESC
            LIMIT 1
        `).get();

        if (!row) return null;

        const data = JSON.parse(row.data_json);
        return {
            tasks: data.tasks?.length || 0,
            groups: data.groups?.length || 0,
            projects: data.projects?.length || 0
        };
    } catch (e) {
        console.warn('[Shadow] Could not read last good snapshot:', e.message);
        return null;
    }
}

/**
 * TASK-317: Check if new snapshot count drop is suspicious (>50% loss)
 */
function isSnapshotSuspicious(newCounts, lastGoodCounts) {
    const THRESHOLD = 0.5; // 50% drop threshold

    // Skip check if this is the first snapshot or no good reference
    if (!lastGoodCounts || lastGoodCounts.tasks === 0) {
        return false;
    }

    // Check for zero when we had data (complete wipe)
    if (newCounts.tasks === 0 && lastGoodCounts.tasks > 5) {
        console.warn(`[Shadow] 🚨 SUSPICIOUS: All ${lastGoodCounts.tasks} tasks disappeared!`);
        return true;
    }

    // Check for dramatic drop (>50%)
    if (newCounts.tasks < lastGoodCounts.tasks * THRESHOLD) {
        console.warn(`[Shadow] 🚨 SUSPICIOUS: Task count dropped from ${lastGoodCounts.tasks} to ${newCounts.tasks} (>${(1-THRESHOLD)*100}% loss)`);
        return true;
    }

    return false;
}

/**
 * TASK-317: Protected ring buffer - keep last N good snapshots, prune the rest
 */
function pruneWithProtection(keepProtected = 10) {
    try {
        // Get IDs of the last N good snapshots (non-empty, healthy connection)
        const protectedSnapshots = db.prepare(`
            SELECT id FROM snapshots
            WHERE item_count > 0 AND connection_healthy = 1
            ORDER BY timestamp DESC
            LIMIT ?
        `).all(keepProtected);

        const protectedIds = protectedSnapshots.map(s => s.id);

        if (protectedIds.length === 0) {
            console.log('[Shadow] No protected snapshots to preserve');
            return;
        }

        // Count total snapshots
        const totalCount = db.prepare('SELECT count(*) as c FROM snapshots').get().c;

        if (totalCount <= 1000) {
            return; // No pruning needed yet
        }

        // Delete old snapshots excluding protected ones
        const placeholders = protectedIds.map(() => '?').join(',');
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

        const result = db.prepare(`
            DELETE FROM snapshots
            WHERE id NOT IN (${placeholders})
            AND timestamp < ?
        `).run(...protectedIds, oneWeekAgo);

        if (result.changes > 0) {
            console.log(`[Shadow] 🧹 Pruned ${result.changes} old snapshots (kept ${protectedIds.length} protected)`);
        }
    } catch (e) {
        console.warn('[Shadow] Prune error:', e.message);
    }
}

async function runShadowSync() {
    const timestamp = Date.now();
    console.log(`[Shadow] 🌑 Starting Mirror Sync at ${new Date(timestamp).toLocaleTimeString()}...`);

    if (SUPABASE_KEY.includes('service_role')) {
        console.log('         🔐 Mode: SERVICE_ROLE (Full Access)');
    } else {
        console.log('         ⚠️  Mode: ANON (RLS Restricted - Backup might be empty)');
    }

    // TASK-317: Connection health check BEFORE fetching
    const healthCheck = await checkDatabaseHealth();
    if (!healthCheck.healthy) {
        console.error('[Shadow] ❌ BLOCKED: Database unreachable - skipping this sync cycle');
        console.error('[Shadow] 💡 Last good snapshot preserved. Will retry on next cycle.');
        process.exit(1);
    }
    console.log(`[Shadow] ✅ Database healthy (latency: ${healthCheck.latency}ms)`);

    try {
        // 1. Fetch Data
        const { data: tasks, error: taskError } = await supabase.from('tasks').select('*');
        if (taskError) throw taskError;

        const { data: groups, error: groupError } = await supabase.from('groups').select('*');
        if (groupError) throw groupError;

        const { data: projects, error: projectError } = await supabase.from('projects').select('*');
        if (projectError) throw projectError;

        // TASK-317: Threshold guard - compare with last good snapshot
        const newCounts = {
            tasks: tasks.length,
            groups: groups.length,
            projects: projects.length
        };

        const lastGoodCounts = getLastGoodSnapshotCounts();

        if (isSnapshotSuspicious(newCounts, lastGoodCounts)) {
            console.error('[Shadow] ❌ BLOCKED: Snapshot count drop exceeds safety threshold');
            console.error('[Shadow] 💡 This could indicate a database issue. Last good snapshot preserved.');
            console.error(`[Shadow] 📊 Previous: ${lastGoodCounts?.tasks || 0} tasks | Current: ${newCounts.tasks} tasks`);
            process.exit(1);
        }

        // 2. Prepare Snapshot with enhanced metadata
        const snapshot = {
            tasks,
            groups,
            projects,
            meta: {
                timestamp,
                schema_version: SCHEMA_VERSION,
                connection_healthy: healthCheck.healthy,
                latency_ms: healthCheck.latency,
                counts: {
                    tasks: tasks.length,
                    groups: groups.length,
                    projects: projects.length
                }
            }
        };

        const json = JSON.stringify(snapshot, null, 2);

        // 3. Insert into SQLite
        const insert = db.prepare(`
            INSERT INTO snapshots (timestamp, type, data_json, item_count, checksum, connection_healthy, latency_ms)
            VALUES (?, 'full', ?, ?, ?, ?, ?)
        `);

        // Simple hash-based checksum
        const checksum = `sha:${simpleHash(json)}`;

        insert.run(
            timestamp,
            json,
            tasks.length + groups.length + projects.length,
            checksum,
            healthCheck.healthy ? 1 : 0,
            healthCheck.latency
        );

        // 4. TASK-317: Atomic write for JSON export (prevents corruption)
        const exportPath = path.join(PUBLIC_DIR, 'shadow-latest.json');
        await writeFileAtomic(exportPath, json, { fsync: true });

        console.log(`[Shadow] ✅ Snapshot saved! (${tasks.length} tasks, ${groups.length} groups, ${projects.length} projects)`);

        // 5. TASK-317: Protected ring buffer pruning
        pruneWithProtection(10);

        // 6. Create SQLite backup periodically (every 10 snapshots)
        const snapshotCount = db.prepare('SELECT count(*) as c FROM snapshots').get().c;
        if (snapshotCount % 10 === 0) {
            const backupPath = path.join(BACKUP_DIR, `shadow-${Date.now()}.db.backup`);
            db.backup(backupPath).then(() => {
                console.log(`[Shadow] 💾 SQLite backup created: ${path.basename(backupPath)}`);
            }).catch(err => {
                console.warn('[Shadow] SQLite backup failed:', err.message);
            });
        }

    } catch (error) {
        console.error('[Shadow] ❌ Sync Failed:', error.message);
        process.exit(1);
    }
}

/**
 * Simple hash function for checksum (djb2 algorithm)
 */
function simpleHash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return Math.abs(hash).toString(16);
}

// Run immediately
runShadowSync();
