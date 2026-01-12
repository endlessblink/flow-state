const { createClient } = require('@supabase/supabase-js');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

async function verifyLayer3() {
    console.log('🧪 Starting Layer 3 (Shadow Mirror) Verification...\n');

    // 1. Environment Check
    const envPath = path.join(__dirname, '../.env.local');
    if (!fs.existsSync(envPath)) {
        console.error('❌ Error: .env.local not found');
        process.exit(1);
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const getEnv = (key) => {
        const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
        return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : null;
    };

    const SUPABASE_URL = getEnv('VITE_SUPABASE_URL');
    const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('VITE_SUPABASE_ANON_KEY');

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('❌ Error: Supabase credentials missing');
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const dbPath = path.join(__dirname, '../backups/shadow.db');
    const jsonPath = path.join(__dirname, '../public/shadow-latest.json');

    try {
        // Step 1: Live Supabase Stats
        console.log('📡 Step 1: Fetching live data from Supabase...');
        const { count: supabaseTasks } = await supabase.from('tasks').select('*', { count: 'exact', head: true });
        const { count: supabaseGroups } = await supabase.from('groups').select('*', { count: 'exact', head: true });
        console.log(`   - Supabase Tasks: ${supabaseTasks}`);
        console.log(`   - Supabase Groups: ${supabaseGroups}`);

        // Step 2: Trigger Mirror Sync
        console.log('\n🔄 Step 2: Triggering Shadow Mirror sync...');
        const { execSync } = require('child_process');
        execSync('node scripts/shadow-mirror.cjs');
        console.log('   ✅ Sync triggered successfully.');

        // Step 3: SQLite Verification
        console.log('\n📁 Step 3: Verifying SQLite shadow storage...');
        if (!fs.existsSync(dbPath)) throw new Error('shadow.db not found');

        const db = new Database(dbPath);
        const lastSnapshot = db.prepare('SELECT * FROM snapshots ORDER BY timestamp DESC LIMIT 1').get();

        if (!lastSnapshot) throw new Error('No snapshots found in SQLite');

        const snapshotData = JSON.parse(lastSnapshot.data_json);
        console.log(`   - SQLite Snapshot Time: ${new Date(lastSnapshot.timestamp).toLocaleString()}`);
        console.log(`   - SQLite Tasks: ${snapshotData.tasks.length}`);
        console.log(`   - SQLite Groups: ${snapshotData.groups.length}`);

        if (snapshotData.tasks.length !== supabaseTasks) {
            console.warn(`   ⚠️  Mismatch! Supabase(${supabaseTasks}) vs SQLite(${snapshotData.tasks.length})`);
        } else {
            console.log('   ✅ Counts match perfectly.');
        }

        // Step 4: JSON Export Verification
        console.log('\n🌐 Step 4: Verifying Frontend JSON snapshot...');
        if (!fs.existsSync(jsonPath)) throw new Error('shadow-latest.json not found');

        const jsonContent = fs.readFileSync(jsonPath, 'utf8');
        const jsonData = JSON.parse(jsonContent);

        console.log(`   - JSON Tasks: ${jsonData.tasks.length}`);
        console.log(`   - JSON Groups: ${jsonData.groups.length}`);
        console.log(`   - JSON Timestamp: ${new Date(jsonData.meta.timestamp).toLocaleString()}`);

        if (jsonData.tasks.length === snapshotData.tasks.length) {
            console.log('   ✅ JSON matches SQLite Snapshot.');
        } else {
            throw new Error('Fidelity Mismatch: JSON != SQLite');
        }

        console.log('\n✨ Layer 3 is RELIABLE and READY for frontend recovery!');

    } catch (error) {
        console.error(`\n❌ Verification Failed: ${error.message}`);
        process.exit(1);
    }
}

verifyLayer3();
