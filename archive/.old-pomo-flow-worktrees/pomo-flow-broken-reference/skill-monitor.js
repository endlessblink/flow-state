#!/usr/bin/env node

import WebSocket from 'ws';
import readline from 'readline';
import { EventEmitter } from 'events';

class SkillTerminalMonitor extends EventEmitter {
  constructor(serverUrl = 'ws://localhost:3001') {
    super();
    this.serverUrl = serverUrl;
    this.ws = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.stats = {
      totalEvents: 0,
      skillCounts: {},
      sessions: new Set(),
      startTime: new Date()
    };
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.setupKeyboardHandlers();
  }

  setupKeyboardHandlers() {
    // Handle keyboard input
    process.stdin.on('keypress', (str, key) => {
      if (key && key.ctrl && key.name === 'c') {
        this.stop();
      } else if (key && key.name === 'r') {
        this.clearScreen();
      } else if (key && key.name === 's') {
        this.showStats();
      } else if (key && key.name === 'h') {
        this.showHelp();
      }
    });

    // Enable raw mode for keypress events
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
  }

  async connect() {
    try {
      console.log('🔗 Connecting to Claude Code Skill Logging Server...');
      this.ws = new WebSocket(this.serverUrl);

      this.ws.on('open', () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        console.log('✅ Connected to skill logging server');
        console.log('📊 Real-time monitoring active');
        console.log('');
        this.showHelp();
        this.startMonitoring();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.handleMessage(message);
        } catch (error) {
          console.error('❌ Invalid message received:', error.message);
        }
      });

      this.ws.on('close', () => {
        this.connected = false;
        console.log('🔌 Disconnected from server');
        this.attemptReconnect();
      });

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
        this.connected = false;
      });

    } catch (error) {
      console.error('❌ Failed to connect:', error.message);
      process.exit(1);
    }
  }

  handleMessage(message) {
    switch (message.type) {
      case 'connected':
        console.log(`🆕 Client connected: ${message.clientId}`);
        if (message.initialData) {
          console.log(`📋 Loaded ${message.initialData.initialData.recentEvents.length} historical events`);
        }
        break;

      case 'skillEvent':
        this.handleSkillEvent(message.event);
        break;

      case 'pong':
        // Server is alive
        break;

      default:
        console.log(`📩 Unknown message type: ${message.type}`);
    }
  }

  handleSkillEvent(event) {
    this.stats.totalEvents++;
    this.stats.skillCounts[event.skill_name] = (this.stats.skillCounts[event.skill_name] || 0) + 1;
    this.stats.sessions.add(event.session_id);

    // Display the event
    this.displaySkillEvent(event);

    // Emit for other handlers
    this.emit('skillEvent', event);
  }

  displaySkillEvent(event) {
    const timestamp = new Date(event.timestamp).toLocaleTimeString();
    const action = event.action.toUpperCase();
    const skill = event.skill_name;

    // Color coding
    let actionColor = '\x1b[36m'; // Cyan for PRE
    if (action === 'POST') {
      actionColor = '\x1b[32m'; // Green for POST
    }

    // Clear current line and write event
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);

    console.log(`${actionColor}[${timestamp}]\x1b[0m \x1b[1m${skill}\x1b[0m - ${actionColor}${action}\x1b[0m`);

    // Show session info if it's a new session
    if (this.stats.sessions.size > 0 && this.stats.sessions.size % 5 === 0) {
      console.log(`📈 Active sessions: ${this.stats.sessions.size} | Total events: ${this.stats.totalEvents}`);
    }
  }

  startMonitoring() {
    // Send initial message to get current status
    this.ws.send(JSON.stringify({ type: 'ping' }));

    // Set up periodic status updates
    this.statusInterval = setInterval(() => {
      if (this.connected) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Every 30 seconds
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff

      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay/1000}s...`);

      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.log('❌ Max reconnection attempts reached. Exiting.');
      process.exit(1);
    }
  }

  showStats() {
    console.log('\n📊 Skill Usage Statistics:');
    console.log('=' .repeat(50));

    const uptime = Date.now() - this.stats.startTime;
    console.log(`⏱️  Uptime: ${Math.floor(uptime / 1000)}s`);
    console.log(`📈 Total Events: ${this.stats.totalEvents}`);
    console.log(`🔄 Active Sessions: ${this.stats.sessions.size}`);

    if (Object.keys(this.stats.skillCounts).length > 0) {
      console.log('\n🎯 Skill Usage:');
      const sortedSkills = Object.entries(this.stats.skillCounts)
        .sort(([,a], [,b]) => b - a);

      sortedSkills.forEach(([skill, count]) => {
        const percentage = ((count / this.stats.totalEvents) * 100).toFixed(1);
        console.log(`   ${skill}: ${count} (${percentage}%)`);
      });
    }

    console.log('=' .repeat(50));
    console.log('');
  }

  showHelp() {
    console.log('🎮 Controls:');
    console.log('   r - Clear screen');
    console.log('   s - Show statistics');
    console.log('   h - Show this help');
    console.log('   Ctrl+C - Exit');
    console.log('');
  }

  clearScreen() {
    console.clear();
    console.log('🔍 Claude Code Skill Usage Monitor');
    console.log('=====================================\n');
  }

  stop() {
    console.log('\n👋 Shutting down skill monitor...');

    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }

    if (this.ws) {
      this.ws.close();
    }

    this.rl.close();
    process.exit(0);
  }
}

// CLI argument handling
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    serverUrl: 'ws://localhost:3001',
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--server':
      case '-s':
        options.serverUrl = args[++i];
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  return options;
}

function showUsage() {
  console.log('Claude Code Skill Usage Monitor');
  console.log('Usage: node skill-monitor.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  -s, --server <url>    WebSocket server URL (default: ws://localhost:3001)');
  console.log('  -h, --help           Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node skill-monitor.js');
  console.log('  node skill-monitor.js --server ws://localhost:3002');
  console.log('');
}

// Main execution
async function main() {
  const options = parseArgs();

  if (options.help) {
    showUsage();
    process.exit(0);
  }

  const monitor = new SkillTerminalMonitor(options.serverUrl);

  // Handle process termination
  process.on('SIGINT', () => monitor.stop());
  process.on('SIGTERM', () => monitor.stop());

  // Start monitoring
  await monitor.connect();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { SkillTerminalMonitor };