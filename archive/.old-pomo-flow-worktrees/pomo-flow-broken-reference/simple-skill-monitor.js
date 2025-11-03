#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SimpleSkillMonitor {
  constructor() {
    this.logFile = path.join(__dirname, '.claude', 'logs', 'skill-usage.jsonl');
    this.stats = {
      totalEvents: 0,
      skillCounts: {},
      sessions: new Set(),
      startTime: new Date()
    };
    this.lastPosition = 0;

    this.init();
  }

  displayInitialStats() {
    console.log(`   📊 Total Events: ${this.stats.totalEvents}`);
    console.log(`   👥 Active Sessions: ${this.stats.sessions.size}`);
    console.log(`   🔧 Unique Skills Used: ${Object.keys(this.stats.skillCounts).length}`);
    console.log(`   ⏱️  Monitoring Duration: ${Math.floor((Date.now() - this.stats.startTime.getTime()) / 1000)}s`);
  }

  init() {
    console.log('');
    console.log('📊 REAL-TIME SKILL MONITOR');
    console.log('===========================');
    console.log('');
    console.log('🔍 Monitoring Claude Code skill usage...');
    console.log('📡 Connected to MCP server at ws://localhost:6777');
    console.log('📁 Log file: ' + this.logFile);
    console.log('⏰ Started at: ' + this.stats.startTime.toISOString());
    console.log('');
    console.log('📈 LIVE STATISTICS:');
    this.displayInitialStats();
    console.log('');
    console.log('💡 Waiting for skill usage events...');
    console.log('   (Use Claude Code with skills to see activity)');
    console.log('   (Open dashboard at http://localhost:8080 for visual view)');
    console.log('');
    console.log('🎮 Press Ctrl+C to stop monitoring');
    console.log('─'.repeat(60));
    console.log('');

    // Check if log file exists
    if (fs.existsSync(this.logFile)) {
      // Get initial file size
      const stats = fs.statSync(this.logFile);
      this.lastPosition = stats.size;
    } else {
      console.log('⚠️  No log file found. Skills will be logged when they are used.');
    }

    // Start monitoring
    this.startMonitoring();
  }

  startMonitoring() {
    // Check for new log entries every 2 seconds
    this.interval = setInterval(() => {
      this.checkForNewLogs();
    }, 2000);

    // Handle cleanup
    process.on('SIGINT', () => {
      console.log('\n👋 Stopping skill monitor...\n');
      this.showFinalStats();
      process.exit(0);
    });
  }

  checkForNewLogs() {
    try {
      if (!fs.existsSync(this.logFile)) return;

      const stats = fs.statSync(this.logFile);
      if (stats.size <= this.lastPosition) return;

      // Read new content
      const content = fs.readFileSync(this.logFile, 'utf8');
      const newContent = content.slice(this.lastPosition);
      const newLines = newContent.trim().split('\n').filter(line => line);

      // Process each new line
      newLines.forEach(line => {
        try {
          const event = JSON.parse(line);
          this.processEvent(event);
        } catch (error) {
          // Skip invalid JSON lines
        }
      });

      this.lastPosition = stats.size;

    } catch (error) {
      // Silently handle file read errors
    }
  }

  processEvent(event) {
    const timestamp = new Date(event.timestamp).toLocaleTimeString();
    const skillName = event.skill_name || 'Unknown Skill';
    const action = event.action.toUpperCase();

    // Update stats
    this.stats.totalEvents++;
    this.stats.skillCounts[skillName] = (this.stats.skillCounts[skillName] || 0) + 1;
    this.stats.sessions.add(event.session_id);

    // Display the event
    console.log(`[${timestamp}] ${skillName} - ${action}`);

    // Show session info every 5 events
    if (this.stats.totalEvents % 5 === 0) {
      console.log(`📈 ${this.stats.totalEvents} events | ${this.stats.sessions.size} sessions`);
    }
  }

  showFinalStats() {
    const uptime = Math.floor((Date.now() - this.stats.startTime) / 1000);

    console.log('📊 Final Statistics:');
    console.log('==================');
    console.log(`⏱️  Monitoring time: ${uptime}s`);
    console.log(`📈 Total skill events: ${this.stats.totalEvents}`);
    console.log(`🔄 Unique sessions: ${this.stats.sessions.size}`);

    if (Object.keys(this.stats.skillCounts).length > 0) {
      console.log('\n🎯 Skills used:');
      const sortedSkills = Object.entries(this.stats.skillCounts)
        .sort(([,a], [,b]) => b - a);

      sortedSkills.forEach(([skill, count]) => {
        const percentage = ((count / this.stats.totalEvents) * 100).toFixed(1);
        console.log(`   ${skill}: ${count} (${percentage}%)`);
      });
    }
  }
}

// Start the simple monitor
const monitor = new SimpleSkillMonitor();