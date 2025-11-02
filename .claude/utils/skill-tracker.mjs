#!/usr/bin/env node

/**
 * Skill Usage Tracker for PomoFlow
 *
 * This utility tracks when Claude skills are activated and provides analytics
 * for skill effectiveness and usage patterns.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const CONFIG_PATH = join(process.cwd(), '.claude/config/skills.json');
const USAGE_LOG_PATH = join(process.cwd(), '.claude/logs/skill-usage.json');

class SkillTracker {
  constructor() {
    this.config = this.loadConfig();
    this.usageLog = this.loadUsageLog();
  }

  loadConfig() {
    try {
      if (existsSync(CONFIG_PATH)) {
        return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
      }
    } catch (error) {
      console.warn('Could not load skills config:', error.message);
    }
    return { skills: {}, usage_stats: {} };
  }

  loadUsageLog() {
    try {
      if (existsSync(USAGE_LOG_PATH)) {
        return JSON.parse(readFileSync(USAGE_LOG_PATH, 'utf8'));
      }
    } catch (error) {
      console.warn('Could not load usage log:', error.message);
    }
    return { activations: [], daily_stats: {} };
  }

  recordSkillActivation(skillId, context = {}) {
    const timestamp = new Date().toISOString();
    const date = timestamp.split('T')[0];

    // Update skill config
    if (this.config.skills[skillId]) {
      this.config.skills[skillId].activation_count = (this.config.skills[skillId].activation_count || 0) + 1;
      this.config.skills[skillId].last_used = timestamp;
    }

    // Update usage log
    const activation = {
      skill_id: skillId,
      timestamp,
      date,
      context: {
        trigger_phrases: context.trigger_phrases || [],
        user_query: context.user_query || '',
        session_id: context.session_id || 'unknown'
      }
    };

    this.usageLog.activations.push(activation);

    // Update daily stats
    if (!this.usageLog.daily_stats[date]) {
      this.usageLog.daily_stats[date] = {};
    }
    if (!this.usageLog.daily_stats[date][skillId]) {
      this.usageLog.daily_stats[date][skillId] = 0;
    }
    this.usageLog.daily_stats[date][skillId]++;

    // Update overall stats
    this.config.usage_stats.total_activations = (this.config.usage_stats.total_activations || 0) + 1;
    this.config.usage_stats.last_skill_used = skillId;
    this.config.usage_stats.last_used = timestamp;

    // Update most used skill
    let maxCount = 0;
    let mostUsedSkill = null;
    for (const [id, skill] of Object.entries(this.config.skills)) {
      if (skill.activation_count > maxCount) {
        maxCount = skill.activation_count;
        mostUsedSkill = id;
      }
    }
    this.config.usage_stats.most_used_skill = mostUsedSkill;

    this.save();
  }

  save() {
    try {
      writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2));
      writeFileSync(USAGE_LOG_PATH, JSON.stringify(this.usageLog, null, 2));
    } catch (error) {
      console.error('Could not save data:', error.message);
    }
  }

  getSkillStats(skillId) {
    return this.config.skills[skillId] || null;
  }

  getUsageSummary(days = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const recentActivations = this.usageLog.activations.filter(
      activation => activation.date >= cutoffStr
    );

    const skillCounts = {};
    for (const activation of recentActivations) {
      skillCounts[activation.skill_id] = (skillCounts[activation.skill_id] || 0) + 1;
    }

    return {
      total_activations: recentActivations.length,
      days: days,
      skill_counts: skillCounts,
      most_used: Object.keys(skillCounts).reduce((a, b) =>
        skillCounts[a] > skillCounts[b] ? a : b, Object.keys(skillCounts)[0]
      )
    };
  }

  generateReport() {
    const report = {
      generated_at: new Date().toISOString(),
      total_skills: Object.keys(this.config.skills).length,
      total_activations: this.config.usage_stats.total_activations || 0,
      most_used_skill: this.config.usage_stats.most_used_skill,
      last_used: this.config.usage_stats.last_used,
      skills: {}
    };

    for (const [id, skill] of Object.entries(this.config.skills)) {
      report.skills[id] = {
        name: skill.name,
        category: skill.category,
        activation_count: skill.activation_count || 0,
        last_used: skill.last_used,
        triggers: skill.triggers || []
      };
    }

    return report;
  }
}

// CLI Interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const tracker = new SkillTracker();
  const command = process.argv[2];

  switch (command) {
    case 'record':
      const skillId = process.argv[3];
      const context = process.argv[4] ? JSON.parse(process.argv[4]) : {};
      tracker.recordSkillActivation(skillId, context);
      console.log(`✅ Recorded activation for skill: ${skillId}`);
      break;

    case 'stats':
      const days = parseInt(process.argv[3]) || 7;
      const summary = tracker.getUsageSummary(days);
      console.log(`📊 Usage Summary (last ${days} days):`);
      console.log(`Total activations: ${summary.total_activations}`);
      console.log('Most used skill:', summary.most_used);
      console.log('Skill counts:', summary.skill_counts);
      break;

    case 'report':
      const report = tracker.generateReport();
      console.log(JSON.stringify(report, null, 2));
      break;

    default:
      console.log('Usage:');
      console.log('  node skill-tracker.mjs record <skill-id> [context-json]');
      console.log('  node skill-tracker.mjs stats [days]');
      console.log('  node skill-tracker.mjs report');
  }
}

export default SkillTracker;