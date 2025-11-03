#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class SkillMonitoringLauncher {
  constructor() {
    this.projectRoot = __dirname;
    this.mcpServer = null;
    this.skillMonitor = null;
    this.isShuttingDown = false;
  }

  async launch() {
    console.log('🚀 Starting Complete Claude Code Skill Monitoring System');
    console.log('=========================================================');
    console.log('');

    // Step 1: Start MCP Server
    console.log('1️⃣  Starting MCP Server...');
    await this.startMcpServer();

    // Wait a moment for server to start
    await this.sleep(2000);

    // Step 2: Open Dashboard
    console.log('2️⃣  Opening Skill Dashboard...');
    await this.openDashboard();

    // Step 3: Start Skill Monitor
    console.log('3️⃣  Starting Terminal Monitor...');
    await this.startSkillMonitor();

    // Setup cleanup handlers
    this.setupCleanupHandlers();

    console.log('');
    console.log('✅ Complete skill monitoring system is now running!');
    console.log('📊 Terminal Monitor: Active (this terminal)');
    console.log('🌐 Web Dashboard: Open in your browser');
    console.log('🔧 MCP Server: Running on port 3001');
    console.log('');
    console.log('🎮 Press Ctrl+C to stop all services');
    console.log('');
  }

  async startMcpServer() {
    return new Promise((resolve, reject) => {
      const serverPath = join(this.projectRoot, '.claude', 'mcp-logging-server', 'server.js');

      this.mcpServer = spawn('node', [serverPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: this.projectRoot
      });

      let serverStarted = false;

      this.mcpServer.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('🚀 Claude Code Skill Logging Server running on port 3001')) {
          if (!serverStarted) {
            serverStarted = true;
            console.log('   ✅ MCP Server started successfully');
            resolve();
          }
        }
        // Show server output with minimal formatting
        process.stdout.write('   📡 ' + output);
      });

      this.mcpServer.stderr.on('data', (data) => {
        const error = data.toString();
        if (!error.includes('Failed to update metrics')) { // Hide the metrics error we know about
          process.stderr.write('   ❌ ' + error);
        }
      });

      this.mcpServer.on('exit', (code) => {
        if (!this.isShuttingDown) {
          console.error(`   ❌ MCP Server exited with code ${code}`);
          reject(new Error(`MCP Server exited with code ${code}`));
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!serverStarted) {
          console.log('   ⚠️  MCP Server startup timeout, but continuing...');
          resolve();
        }
      }, 10000);
    });
  }

  async openDashboard() {
    return new Promise((resolve) => {
      const dashboardPath = join(this.projectRoot, 'skill-dashboard.html');

      // Check if dashboard file exists
      if (!fs.existsSync(dashboardPath)) {
        console.log('   ⚠️  Dashboard file not found, skipping browser launch');
        resolve();
        return;
      }

      // Try to open in browser (works on Linux/WSL)
      const openCommand = process.platform === 'win32' ? 'start' :
                         process.platform === 'darwin' ? 'open' : 'xdg-open';

      const browser = spawn(openCommand, [dashboardPath], {
        stdio: 'ignore',
        detached: true
      });

      browser.on('error', () => {
        console.log('   ⚠️  Could not open browser automatically');
        console.log(`   📍 Open manually: file://${dashboardPath}`);
      });

      browser.unref();

      console.log(`   ✅ Dashboard opened in browser`);
      console.log(`   📍 If it didn't open: file://${dashboardPath}`);
      resolve();
    });
  }

  async startSkillMonitor() {
    return new Promise((resolve) => {
      const monitorPath = join(this.projectRoot, 'simple-skill-monitor.js');

      this.skillMonitor = spawn('node', [monitorPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: this.projectRoot
      });

      this.skillMonitor.stdout.on('data', (data) => {
        const output = data.toString();
        // Show monitor output
        process.stdout.write(output);
      });

      this.skillMonitor.stderr.on('data', (data) => {
        const error = data.toString();
        process.stderr.write('   ❌ Monitor Error: ' + error);
      });

      this.skillMonitor.on('exit', (code) => {
        if (!this.isShuttingDown) {
          console.error(`   ❌ Skill Monitor exited with code ${code}`);
        }
      });

      // Give it a moment to start
      setTimeout(() => {
        console.log('   ✅ Terminal Monitor started');
        resolve();
      }, 1000);
    });
  }

  setupCleanupHandlers() {
    const cleanup = () => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      console.log('');
      console.log('🛑 Shutting down skill monitoring system...');

      const shutdownPromises = [];

      if (this.skillMonitor) {
        console.log('   📡 Stopping terminal monitor...');
        shutdownPromises.push(new Promise(resolve => {
          this.skillMonitor.on('exit', resolve);
          this.skillMonitor.kill('SIGTERM');
        }));
      }

      if (this.mcpServer) {
        console.log('   🔧 Stopping MCP server...');
        shutdownPromises.push(new Promise(resolve => {
          this.mcpServer.on('exit', resolve);
          this.mcpServer.kill('SIGTERM');
        }));
      }

      Promise.all(shutdownPromises).then(() => {
        console.log('✅ All services stopped successfully');
        process.exit(0);
      });

      // Force exit after 5 seconds
      setTimeout(() => {
        console.log('⚠️  Force exiting...');
        process.exit(1);
      }, 5000);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  const launcher = new SkillMonitoringLauncher();

  try {
    await launcher.launch();
  } catch (error) {
    console.error('❌ Failed to launch skill monitoring system:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { SkillMonitoringLauncher };