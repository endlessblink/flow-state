#!/usr/bin/env node

/**
 * Skill Logger - Logs skill activation for Claude visibility
 *
 * This script can be called by Claude to indicate when a skill is being used.
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const LOG_DIR = join(process.cwd(), '.claude/logs');
const ACTIVITY_LOG = join(LOG_DIR, 'skill-activity.log');

class SkillLogger {
  constructor() {
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!existsSync(LOG_DIR)) {
      mkdirSync(LOG_DIR, { recursive: true });
    }
  }

  logSkillActivation(skillId, skillName, context = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      skill_id: skillId,
      skill_name: skillName,
      category: context.category || 'unknown',
      triggers: context.triggers || [],
      user_context: context.user_query || '',
      session_id: context.session_id || 'unknown'
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    try {
      writeFileSync(ACTIVITY_LOG, logLine, { flag: 'a' });
      console.log(`🔧 SKILL ACTIVATED: ${skillName} (${skillId})`);
      return true;
    } catch (error) {
      console.error('Failed to log skill activation:', error.message);
      return false;
    }
  }

  getRecentActivations(limit = 10) {
    try {
      if (!existsSync(ACTIVITY_LOG)) {
        return [];
      }

      const fs = require('fs');
      const content = fs.readFileSync(ACTIVITY_LOG, 'utf8');
      const lines = content.trim().split('\n').filter(line => line);

      return lines
        .slice(-limit)
        .map(line => JSON.parse(line))
        .reverse();
    } catch (error) {
      console.error('Failed to read activations log:', error.message);
      return [];
    }
  }

  formatActivationLog(activation) {
    const date = new Date(activation.timestamp);
    const timeStr = date.toLocaleString();

    return [
      `🔧 ${activation.skill_name}`,
      `📅 ${timeStr}`,
      `🏷️  Category: ${activation.category}`,
      activation.triggers.length > 0 ? `🎯 Triggers: ${activation.triggers.join(', ')}` : '',
      ''
    ].filter(Boolean).join('\n');
  }

  showRecentActivity() {
    const activations = this.getRecentActivations(5);

    if (activations.length === 0) {
      console.log('📝 No recent skill activity logged.');
      return;
    }

    console.log('📋 Recent Skill Activity:\n');
    activations.forEach(activation => {
      console.log(this.formatActivationLog(activation));
    });
  }
}

// CLI Interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const logger = new SkillLogger();
  const command = process.argv[2];

  switch (command) {
    case 'activate':
      const skillId = process.argv[3];
      const skillName = process.argv[4];
      const contextJson = process.argv[5] || '{}';

      if (!skillId || !skillName) {
        console.error('Usage: node skill-logger.mjs activate <skill-id> <skill-name> [context-json]');
        process.exit(1);
      }

      try {
        const context = JSON.parse(contextJson);
        logger.logSkillActivation(skillId, skillName, context);
      } catch (error) {
        console.error('Invalid context JSON:', error.message);
        process.exit(1);
      }
      break;

    case 'recent':
      logger.showRecentActivity();
      break;

    default:
      console.log('Usage:');
      console.log('  node skill-logger.mjs activate <skill-id> <skill-name> [context-json]');
      console.log('  node skill-logger.mjs recent');
  }
}

export default SkillLogger;