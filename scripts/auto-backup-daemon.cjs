const { exec } = require('child_process');
const path = require('path');

// Configuration
const CONFIG = {
    INTERVAL_MS: 5 * 60 * 1000,  // 5 minutes (High Frequency)
    KEEP_BACKUPS: 50,            // Keep last 50 SQL dumps
    SCRIPT_SQL: 'npm run db:backup',
    SCRIPT_SHADOW: 'node scripts/shadow-mirror.cjs'
};

console.log('🔄 Auto-Backup Daemon Started (Dual Engine)');
console.log(`   Interval: ${CONFIG.INTERVAL_MS / 60000} minutes`);
console.log(`   Engines:  SQL Dump + Shadow Mirror (SQLite)`);
console.log('----------------------------------------');

// Function to run dual backups
const runBackup = () => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] 💾 Starting dual backup...`);

    // 1. Run SQL Dump (Rotated)
    const commandSQL = `${CONFIG.SCRIPT_SQL} -- --rotate ${CONFIG.KEEP_BACKUPS}`;

    exec(commandSQL, (error, stdout, stderr) => {
        if (error) {
            console.error(`[${timestamp}] ❌ SQL Backup Failed:`, error.message);
        } else {
            // Quiet success for SQL
            const lines = stdout.split('\n');
            const sizeLine = lines.find(l => l.includes('Size:'));
            const size = sizeLine ? sizeLine.trim() : '?';
            console.log(`[${timestamp}] ✅ SQL Backup: ${size}`);
        }
    });

    // 2. Run Shadow Mirror
    exec(CONFIG.SCRIPT_SHADOW, (error, stdout, stderr) => {
        if (error) {
            console.error(`[${timestamp}] ❌ Shadow Mirror Failed:`, error.message);
            if (stderr) console.error(stderr); // Log details for shadow failure
        } else {
            // Shadow script prints its own success message, let's capture it
            const match = stdout.match(/✅ Snapshot saved! .*/);
            if (match) {
                console.log(`[${timestamp}] ${match[0]}`);
            } else {
                console.log(`[${timestamp}] ✅ Shadow Mirror Synced`);
            }
        }
    });
};

// Initial backup on start
// Wait 30s to allow app startup, then run first, then interval.
setTimeout(() => {
    runBackup();
    setInterval(runBackup, CONFIG.INTERVAL_MS);
}, 30000); // 30s delay on startup

// TASK-330: Staleness Monitoring
// Check every minute if the shadow file looks stale (> 6 mins old)
setInterval(() => {
    const fs = require('fs');
    const shadowPath = path.join(__dirname, '../backups/shadow.db');
    if (fs.existsSync(shadowPath)) {
        const stats = fs.statSync(shadowPath);
        const ageMs = Date.now() - stats.mtimeMs;
        if (ageMs > (CONFIG.INTERVAL_MS + 60000)) {
            console.warn(`[${new Date().toLocaleTimeString()}] ⚠️  WARNING: Shadow backup is STALE (${Math.round(ageMs / 60000)} mins old)`);
        }
    }
}, 60000);
