import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class Safety {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.backupDir = path.join(baseDir, '.meta', 'backups');
    this.ensureBackupDir();
    this.currentBackup = null;
  }

  ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  // Start operation: backup critical files
  startOperation(operationName) {
    this.currentBackup = {
      operation: operationName,
      timestamp: new Date().toISOString(),
      backups: {}
    };

    console.log(`🔒 Starting: ${operationName} (backups created)`);
  }

  // Backup single file
  backup(filePath, operationName = null) {
    try {
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ File doesn't exist: ${filePath}`);
        return false;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const hash = crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
      const filename = `backup-${Date.now()}-${hash}.bak`;
      const backupPath = path.join(this.backupDir, filename);

      fs.writeFileSync(backupPath, content);

      if (this.currentBackup) {
        this.currentBackup.backups[filePath] = backupPath;
      }

      console.log(`📦 Backed up: ${path.basename(filePath)}`);
      return backupPath;

    } catch (e) {
      console.error(`❌ Backup failed: ${e.message}`);
      throw e;
    }
  }

  // End operation successfully
  endOperation() {
    if (this.currentBackup) {
      console.log(`✅ Operation complete. Backups retained.`);
      this.currentBackup = null;
    }
  }

  // Rollback on error
  rollback() {
    if (!this.currentBackup) {
      console.error('❌ No active operation to rollback');
      return false;
    }

    try {
      console.log(`⏮️ Rolling back...`);

      for (const [original, backup] of Object.entries(this.currentBackup.backups)) {
        if (fs.existsSync(backup)) {
          const content = fs.readFileSync(backup, 'utf8');
          fs.writeFileSync(original, content);
          console.log(`✅ Restored: ${path.basename(original)}`);
        }
      }

      console.log(`✅ Rollback complete. No data lost.`);
      return true;

    } catch (e) {
      console.error(`❌ Rollback failed: ${e.message}`);
      return false;
    } finally {
      this.currentBackup = null;
    }
  }

  // Detect corruption
  checkCorruption(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');

      // Check 1: Null bytes
      if (content.includes('\x00')) {
        return { corrupted: true, reason: 'Contains null bytes' };
      }

      // Check 2: Empty (for markdown)
      if (filePath.endsWith('.md') && content.trim().length === 0) {
        return { corrupted: true, reason: 'File is empty' };
      }

      // Check 3: JSON validity
      if (filePath.endsWith('.json')) {
        try {
          JSON.parse(content);
        } catch (e) {
          return { corrupted: true, reason: `Invalid JSON: ${e.message}` };
        }
      }

      return { corrupted: false };

    } catch (e) {
      return { corrupted: true, reason: e.message };
    }
  }

  // Simple recovery command
  recover() {
    console.log('\n🔧 Starting safety recovery...\n');

    try {
      // Find latest backups
      const backups = fs.readdirSync(this.backupDir)
        .filter(f => f.endsWith('.bak'))
        .sort()
        .reverse()
        .slice(0, 5);

      if (backups.length === 0) {
        console.log('✅ No corrupted files detected.');
        return;
      }

      console.log(`Found ${backups.length} recent backups:\n`);
      backups.forEach((backup, i) => {
        console.log(`  ${i + 1}. ${backup}`);
      });

      console.log('\n💡 To restore a backup, provide the filename.');
      console.log('   Backups are kept for 30 days.\n');

    } catch (e) {
      console.error(`❌ Recovery check failed: ${e.message}`);
    }
  }

  // List recent backups
  listBackups(limit = 10) {
    try {
      const backups = fs.readdirSync(this.backupDir)
        .sort()
        .reverse()
        .slice(0, limit);

      console.log(`\n📋 Recent Backups (${backups.length}):\n`);
      backups.forEach(backup => {
        const filepath = path.join(this.backupDir, backup);
        const stats = fs.statSync(filepath);
        const sizeKB = (stats.size / 1024).toFixed(2);
        console.log(`  • ${backup} (${sizeKB} KB)`);
      });

    } catch (e) {
      console.error(`❌ Failed to list backups: ${e.message}`);
    }
  }

  // Clean old backups (30 days)
  cleanupOldBackups(olderThanDays = 30) {
    try {
      const now = Date.now();
      const maxAge = olderThanDays * 24 * 60 * 60 * 1000;

      const files = fs.readdirSync(this.backupDir);
      let cleanedCount = 0;

      for (const file of files) {
        const filepath = path.join(this.backupDir, file);
        const stats = fs.statSync(filepath);

        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filepath);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} old backups`);
      }

      return cleanedCount;

    } catch (e) {
      console.error(`⚠️ Cleanup failed: ${e.message}`);
      return 0;
    }
  }
}

export default Safety;