const fs = require('fs');
const path = require('path');

/**
 * Log Rotation Utility for Skill Usage Logs
 *
 * Manages automatic rotation and archival of JSONL log files
 * to prevent unbounded growth while preserving historical data.
 */

const DEFAULT_CONFIG = {
  logFile: path.join(__dirname, 'skill-usage.jsonl'),
  archiveDir: path.join(__dirname, 'archives'),
  maxEntries: 100,           // Rotate after this many entries
  keepArchives: 3,           // Keep last N archives
  dryRun: false              // Set to true to preview without changes
};

/**
 * Count lines in a file
 */
function countLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return 0;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return content.trim().split('\n').filter(line => line.trim()).length;
}

/**
 * Get formatted timestamp for archive filename
 */
function getArchiveTimestamp() {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Ensure archive directory exists
 */
function ensureArchiveDir(archiveDir) {
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }
}

/**
 * Get list of existing archives sorted by date (newest first)
 */
function getExistingArchives(archiveDir, logFileName) {
  if (!fs.existsSync(archiveDir)) {
    return [];
  }

  const baseName = path.basename(logFileName, '.jsonl');
  const archives = fs.readdirSync(archiveDir)
    .filter(file => file.startsWith(baseName) && file.endsWith('.jsonl'))
    .map(file => ({
      name: file,
      path: path.join(archiveDir, file),
      stats: fs.statSync(path.join(archiveDir, file))
    }))
    .sort((a, b) => b.stats.mtime - a.stats.mtime);

  return archives;
}

/**
 * Remove old archives beyond retention limit
 */
function cleanOldArchives(archiveDir, logFileName, keepCount) {
  const archives = getExistingArchives(archiveDir, logFileName);

  if (archives.length <= keepCount) {
    return [];
  }

  const toDelete = archives.slice(keepCount);
  const deleted = [];

  toDelete.forEach(archive => {
    fs.unlinkSync(archive.path);
    deleted.push(archive.name);
  });

  return deleted;
}

/**
 * Rotate log file to archive
 */
function rotateLog(config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const results = {
    rotated: false,
    lineCount: 0,
    archivePath: null,
    deletedArchives: [],
    message: ''
  };

  // Check if log file exists
  if (!fs.existsSync(cfg.logFile)) {
    results.message = 'Log file does not exist, nothing to rotate';
    return results;
  }

  // Count entries
  const lineCount = countLines(cfg.logFile);
  results.lineCount = lineCount;

  // Check if rotation needed
  if (lineCount < cfg.maxEntries) {
    results.message = `Log has ${lineCount} entries (threshold: ${cfg.maxEntries}), rotation not needed`;
    return results;
  }

  if (cfg.dryRun) {
    results.message = `[DRY RUN] Would rotate ${lineCount} entries to archive`;
    return results;
  }

  // Ensure archive directory exists
  ensureArchiveDir(cfg.archiveDir);

  // Generate archive filename with timestamp
  const timestamp = getArchiveTimestamp();
  const logFileName = path.basename(cfg.logFile);
  const baseName = path.basename(logFileName, '.jsonl');
  const archiveFileName = `${baseName}-${timestamp}.jsonl`;
  const archivePath = path.join(cfg.archiveDir, archiveFileName);

  // Handle duplicate archive names (same day rotation)
  let counter = 1;
  let finalArchivePath = archivePath;
  while (fs.existsSync(finalArchivePath)) {
    finalArchivePath = path.join(
      cfg.archiveDir,
      `${baseName}-${timestamp}-${counter}.jsonl`
    );
    counter++;
  }

  // Move log to archive
  fs.renameSync(cfg.logFile, finalArchivePath);

  // Create new empty log file
  fs.writeFileSync(cfg.logFile, '', 'utf8');

  results.rotated = true;
  results.archivePath = finalArchivePath;

  // Clean old archives
  results.deletedArchives = cleanOldArchives(
    cfg.archiveDir,
    logFileName,
    cfg.keepArchives
  );

  results.message = `Rotated ${lineCount} entries to ${path.basename(finalArchivePath)}`;
  if (results.deletedArchives.length > 0) {
    results.message += `, deleted ${results.deletedArchives.length} old archive(s)`;
  }

  return results;
}

/**
 * Check if rotation is needed (without performing it)
 */
function checkRotationNeeded(config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!fs.existsSync(cfg.logFile)) {
    return { needed: false, lineCount: 0, threshold: cfg.maxEntries };
  }

  const lineCount = countLines(cfg.logFile);
  return {
    needed: lineCount >= cfg.maxEntries,
    lineCount,
    threshold: cfg.maxEntries
  };
}

/**
 * Get log statistics
 */
function getLogStats(config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const stats = {
    activeLog: {
      path: cfg.logFile,
      exists: fs.existsSync(cfg.logFile),
      lineCount: 0,
      size: 0
    },
    archives: [],
    totalEntries: 0,
    rotationNeeded: false
  };

  if (stats.activeLog.exists) {
    stats.activeLog.lineCount = countLines(cfg.logFile);
    stats.activeLog.size = fs.statSync(cfg.logFile).size;
    stats.totalEntries += stats.activeLog.lineCount;
  }

  // Get archive info
  const archives = getExistingArchives(cfg.archiveDir, path.basename(cfg.logFile));
  stats.archives = archives.map(archive => ({
    name: archive.name,
    lineCount: countLines(archive.path),
    size: archive.stats.size,
    modified: archive.stats.mtime
  }));

  stats.totalEntries += stats.archives.reduce((sum, a) => sum + a.lineCount, 0);
  stats.rotationNeeded = stats.activeLog.lineCount >= cfg.maxEntries;

  return stats;
}

module.exports = {
  rotateLog,
  checkRotationNeeded,
  getLogStats,
  DEFAULT_CONFIG
};
