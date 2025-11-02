#!/usr/bin/env node

/**
 * Log Analysis Utilities for Claude Code Skills
 * Provides analysis and insights from skill usage logs
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LogAnalyzer {
  constructor(logDir) {
    this.logDir = logDir || path.join(__dirname, '..', 'logs');
  }

  /**
   * Analyze skill usage patterns over time
   */
  async analyzeUsagePatterns(days = 7) {
    try {
      const logs = await this.getLogsInRange(days);
      const patterns = {
        totalCalls: logs.length,
        uniqueSkills: new Set(logs.map(log => log.skillName)).size,
        successRate: this.calculateSuccessRate(logs),
        averageDuration: this.calculateAverageDuration(logs),
        topSkills: this.getTopSkills(logs, 10),
        hourlyDistribution: this.getHourlyDistribution(logs),
        dailyDistribution: this.getDailyDistribution(logs),
        errorPatterns: this.getErrorPatterns(logs)
      };

      return patterns;
    } catch (error) {
      console.error('[LogAnalyzer] Pattern analysis failed:', error.message);
      return null;
    }
  }

  /**
   * Get logs within date range
   */
  async getLogsInRange(days) {
    const logs = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(file =>
        file.startsWith('skill-usage-') && file.endsWith('.log')
      );

      for (const file of logFiles) {
        const filePath = path.join(this.logDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.trim().split('\n').filter(line => line);

        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            const entryDate = new Date(entry.timestamp);
            if (entryDate >= cutoffDate) {
              logs.push(entry);
            }
          } catch (e) {
            // Skip malformed entries
          }
        }
      }
    } catch (error) {
      console.error('[LogAnalyzer] Failed to read logs:', error.message);
    }

    return logs;
  }

  /**
   * Calculate success rate
   */
  calculateSuccessRate(logs) {
    if (logs.length === 0) return 0;
    const successful = logs.filter(log => log.outcome === 'success').length;
    return (successful / logs.length * 100).toFixed(2);
  }

  /**
   * Calculate average duration
   */
  calculateAverageDuration(logs) {
    const logsWithDuration = logs.filter(log => log.duration);
    if (logsWithDuration.length === 0) return 0;

    const total = logsWithDuration.reduce((sum, log) => sum + log.duration, 0);
    return (total / logsWithDuration.length).toFixed(2);
  }

  /**
   * Get most used skills
   */
  getTopSkills(logs, limit = 10) {
    const skillCounts = {};

    logs.forEach(log => {
      skillCounts[log.skillName] = (skillCounts[log.skillName] || 0) + 1;
    });

    return Object.entries(skillCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([skill, count]) => ({ skill, count }));
  }

  /**
   * Get hourly usage distribution
   */
  getHourlyDistribution(logs) {
    const hourly = Array(24).fill(0);

    logs.forEach(log => {
      const hour = new Date(log.timestamp).getHours();
      hourly[hour]++;
    });

    return hourly.map((count, hour) => ({
      hour: hour.toString().padStart(2, '0') + ':00',
      count
    }));
  }

  /**
   * Get daily usage distribution
   */
  getDailyDistribution(logs) {
    const daily = {};

    logs.forEach(log => {
      const date = log.timestamp.split('T')[0];
      daily[date] = (daily[date] || 0) + 1;
    });

    return Object.entries(daily)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Analyze error patterns
   */
  getErrorPatterns(logs) {
    const errorLogs = logs.filter(log => log.outcome === 'error' || log.error);
    const patterns = {
      totalErrors: errorLogs.length,
      errorBySkill: {},
      commonErrors: {},
      recentErrors: errorLogs.slice(-5)
    };

    errorLogs.forEach(log => {
      // Count errors by skill
      patterns.errorBySkill[log.skillName] =
        (patterns.errorBySkill[log.skillName] || 0) + 1;

      // Count common error messages
      if (log.error && log.error.message) {
        const message = log.error.message.split(':')[0]; // Take first part
        patterns.commonErrors[message] =
          (patterns.commonErrors[message] || 0) + 1;
      }
    });

    return patterns;
  }

  /**
   * Generate skill performance report
   */
  async generatePerformanceReport() {
    try {
      const metricsFile = path.join(this.logDir, 'skill-metrics.json');
      const metrics = JSON.parse(await fs.readFile(metricsFile, 'utf8'));

      const report = {
        generatedAt: new Date().toISOString(),
        summary: {
          totalSkills: Object.keys(metrics).length,
          totalCalls: Object.values(metrics).reduce((sum, skill) => sum + skill.totalCalls, 0),
          averageSuccessRate: this.calculateOverallSuccessRate(metrics)
        },
        skills: {}
      };

      for (const [skillName, skillMetrics] of Object.entries(metrics)) {
        const successRate = ((skillMetrics.successfulCalls / skillMetrics.totalCalls) * 100).toFixed(2);
        const recentUse = this.isRecentlyUsed(skillMetrics.lastUsed);

        report.skills[skillName] = {
          ...skillMetrics,
          successRate: `${successRate}%`,
          performance: this.getPerformanceRating(successRate, skillMetrics.averageDuration),
          recentlyUsed: recentUse
        };
      }

      return report;
    } catch (error) {
      console.error('[LogAnalyzer] Performance report failed:', error.message);
      return null;
    }
  }

  /**
   * Calculate overall success rate
   */
  calculateOverallSuccessRate(metrics) {
    const totalCalls = Object.values(metrics).reduce((sum, skill) => sum + skill.totalCalls, 0);
    const successfulCalls = Object.values(metrics).reduce((sum, skill) => sum + skill.successfulCalls, 0);

    return totalCalls > 0 ? ((successfulCalls / totalCalls) * 100).toFixed(2) + '%' : '0%';
  }

  /**
   * Check if skill was recently used (within 7 days)
   */
  isRecentlyUsed(lastUsed) {
    if (!lastUsed) return false;
    const lastUsedDate = new Date(lastUsed);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return lastUsedDate >= weekAgo;
  }

  /**
   * Get performance rating based on success rate and duration
   */
  getPerformanceRating(successRate, avgDuration) {
    if (successRate >= 95 && (!avgDuration || avgDuration < 5000)) return 'Excellent';
    if (successRate >= 90 && (!avgDuration || avgDuration < 10000)) return 'Good';
    if (successRate >= 80) return 'Fair';
    return 'Poor';
  }

  /**
   * Export analysis results to file
   */
  async exportAnalysis(format = 'json', days = 7) {
    try {
      const analysis = await this.analyzeUsagePatterns(days);
      const performanceReport = await this.generatePerformanceReport();

      const exportData = {
        analysisPeriod: `${days} days`,
        generatedAt: new Date().toISOString(),
        usagePatterns: analysis,
        performanceReport
      };

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `skill-analysis-${timestamp}.${format}`;
      const filePath = path.join(this.logDir, filename);

      if (format === 'json') {
        await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));
      } else if (format === 'csv') {
        const csv = this.convertToCSV(exportData);
        await fs.writeFile(filePath, csv);
      }

      console.log(`Analysis exported to: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('[LogAnalyzer] Export failed:', error.message);
      return null;
    }
  }

  /**
   * Convert analysis data to CSV format
   */
  convertToCSV(data) {
    const headers = ['Metric', 'Value'];
    const rows = [];

    // Add usage patterns
    for (const [key, value] of Object.entries(data.usagePatterns)) {
      if (typeof value === 'object' && value !== null) {
        rows.push([key, JSON.stringify(value)]);
      } else {
        rows.push([key, value]);
      }
    }

    // Convert to CSV string
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return csvContent;
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const analyzer = new LogAnalyzer();
  const command = process.argv[2];
  const days = parseInt(process.argv[3]) || 7;

  switch (command) {
    case 'patterns':
      analyzer.analyzeUsagePatterns(days).then(patterns => {
        console.log('Usage Patterns:');
        console.log(JSON.stringify(patterns, null, 2));
      });
      break;

    case 'performance':
      analyzer.generatePerformanceReport().then(report => {
        console.log('Performance Report:');
        console.log(JSON.stringify(report, null, 2));
      });
      break;

    case 'export':
      const format = process.argv[3] || 'json';
      const exportDays = parseInt(process.argv[4]) || 7;
      analyzer.exportAnalysis(format, exportDays);
      break;

    default:
      console.log('Usage: node log-analyzer.js <command> [options]');
      console.log('Commands: patterns [days], performance, export [format] [days]');
  }
}

export { LogAnalyzer };