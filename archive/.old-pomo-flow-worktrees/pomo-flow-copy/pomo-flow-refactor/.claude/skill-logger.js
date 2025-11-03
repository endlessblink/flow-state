#!/usr/bin/env node

/**
 * Claude Code Skill Usage Logger
 * Tracks and logs skill usage with timestamps, context, and performance metrics
 */

import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SkillLogger {
  constructor(configPath = null) {
    this.configPath = configPath || path.join(__dirname, 'config', 'logging.json');
    this.logDir = path.join(__dirname, 'logs');
    this.currentSession = this.generateSessionId();
    this.config = {};
    this.initialized = false;
  }

  /**
   * Initialize the logger with configuration
   */
  async init() {
    try {
      await this.ensureDirectories();
      await this.loadConfig();
      this.initialized = true;
      console.log(`[SkillLogger] Initialized with session: ${this.currentSession}`);
    } catch (error) {
      console.error('[SkillLogger] Initialization failed:', error.message);
    }
  }

  /**
   * Ensure required directories exist
   */
  async ensureDirectories() {
    const dirs = [this.logDir, path.dirname(this.configPath)];
    for (const dir of dirs) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
      }
    }
  }

  /**
   * Load logging configuration
   */
  async loadConfig() {
    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
    } catch (error) {
      // Use default config if file doesn't exist
      this.config = {
        level: 'INFO',
        maxLogFiles: 10,
        maxLogSize: '10MB',
        enableMetrics: true,
        enablePerformanceTracking: true,
        retentionDays: 30
      };
      await this.saveConfig();
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfig() {
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }

  /**
   * Generate a unique session ID
   */
  generateSessionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `session_${timestamp}_${random}`;
  }

  /**
   * Get current log file path
   */
  getLogFilePath() {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `skill-usage-${date}.log`);
  }

  /**
   * Create a log entry
   */
  createLogEntry(skillName, parameters, outcome, duration = null, error = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      sessionId: this.currentSession,
      skillName,
      parameters: this.sanitizeParameters(parameters),
      outcome, // 'success', 'error', 'timeout'
      duration,
      error: error ? {
        message: error.message,
        stack: error.stack,
        code: error.code
      } : null,
      metadata: {
        nodeVersion: process.version,
        platform: process.platform,
        cwd: process.cwd()
      }
    };

    return entry;
  }

  /**
   * Sanitize parameters to remove sensitive information
   */
  sanitizeParameters(parameters) {
    if (!parameters || typeof parameters !== 'object') {
      return parameters;
    }

    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth'];
    const sanitized = { ...parameters };

    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Write log entry to file
   */
  async writeLogEntry(entry) {
    try {
      const logFile = this.getLogFilePath();
      const logLine = JSON.stringify(entry) + '\n';
      await fs.appendFile(logFile, logLine);

      // Also update metrics if enabled
      if (this.config.enableMetrics) {
        await this.updateMetrics(entry);
      }
    } catch (error) {
      console.error('[SkillLogger] Failed to write log entry:', error.message);
    }
  }

  /**
   * Update skill usage metrics
   */
  async updateMetrics(entry) {
    try {
      const metricsFile = path.join(this.logDir, 'skill-metrics.json');
      let metrics = {};

      try {
        const existing = await fs.readFile(metricsFile, 'utf8');
        metrics = JSON.parse(existing);
      } catch {
        // Start with empty metrics
      }

      const skillKey = entry.skillName;
      if (!metrics[skillKey]) {
        metrics[skillKey] = {
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          totalDuration: 0,
          averageDuration: 0,
          lastUsed: null,
          firstUsed: entry.timestamp
        };
      }

      const skillMetrics = metrics[skillKey];
      skillMetrics.totalCalls++;
      skillMetrics.lastUsed = entry.timestamp;

      if (entry.outcome === 'success') {
        skillMetrics.successfulCalls++;
        if (entry.duration) {
          skillMetrics.totalDuration += entry.duration;
          skillMetrics.averageDuration = skillMetrics.totalDuration / skillMetrics.successfulCalls;
        }
      } else {
        skillMetrics.failedCalls++;
      }

      await fs.writeFile(metricsFile, JSON.stringify(metrics, null, 2));
    } catch (error) {
      console.error('[SkillLogger] Failed to update metrics:', error.message);
    }
  }

  /**
   * Log skill usage (main entry point)
   */
  async logSkillUsage(skillName, parameters, outcome, duration = null, error = null) {
    if (!this.initialized) {
      await this.init();
    }

    const entry = this.createLogEntry(skillName, parameters, outcome, duration, error);
    await this.writeLogEntry(entry);

    // Also log to console if debug level
    if (this.config.level === 'DEBUG') {
      console.log(`[SkillLogger] ${skillName}: ${outcome}${duration ? ` (${duration}ms)` : ''}`);
    }

    return entry;
  }

  /**
   * Get recent log entries
   */
  async getRecentLogs(limit = 50, skillName = null) {
    try {
      const logFile = this.getLogFilePath();
      const content = await fs.readFile(logFile, 'utf8');
      const lines = content.trim().split('\n').filter(line => line);

      let entries = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(entry => entry);

      if (skillName) {
        entries = entries.filter(entry => entry.skillName === skillName);
      }

      return entries.slice(-limit);
    } catch (error) {
      console.error('[SkillLogger] Failed to read logs:', error.message);
      return [];
    }
  }

  /**
   * Get skill usage metrics
   */
  async getMetrics() {
    try {
      const metricsFile = path.join(this.logDir, 'skill-metrics.json');
      const content = await fs.readFile(metricsFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return {};
    }
  }

  /**
   * Clean old log files based on retention policy
   */
  async cleanupLogs() {
    try {
      const files = await fs.readdir(this.logDir);
      const retentionDays = this.config.retentionDays || 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      for (const file of files) {
        if (file.startsWith('skill-usage-') && file.endsWith('.log')) {
          const filePath = path.join(this.logDir, file);
          const stats = await fs.stat(filePath);

          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            console.log(`[SkillLogger] Cleaned up old log file: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('[SkillLogger] Cleanup failed:', error.message);
    }
  }
}

// Export for use as module
export { SkillLogger };

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const logger = new SkillLogger();

  const command = process.argv[2];
  const skillName = process.argv[3];

  switch (command) {
    case 'test':
      logger.init().then(() => {
        logger.logSkillUsage('test-skill', { test: true }, 'success', 100);
        console.log('Test log entry created');
      });
      break;

    case 'recent':
      logger.init().then(async () => {
        const limit = parseInt(process.argv[4]) || 10;
        const logs = await logger.getRecentLogs(limit, skillName);
        console.log('Recent logs:');
        logs.forEach(log => {
          console.log(`${log.timestamp} - ${log.skillName}: ${log.outcome}`);
        });
      });
      break;

    case 'metrics':
      logger.init().then(async () => {
        const metrics = await logger.getMetrics();
        console.log('Skill Usage Metrics:');
        console.log(JSON.stringify(metrics, null, 2));
      });
      break;

    case 'cleanup':
      logger.init().then(() => {
        logger.cleanupLogs();
      });
      break;

    default:
      console.log('Usage: node skill-logger.js <command> [options]');
      console.log('Commands: test, recent [skill] [limit], metrics, cleanup');
  }
}