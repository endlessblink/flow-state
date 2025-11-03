#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting Complete Claude Code Skill Monitoring System');
console.log('=========================================================');
console.log('');

// Check if MCP Server is already running
async function checkServerRunning() {
  try {
    const response = await fetch('http://localhost:6777/health');
    const data = await response.json();
    return data.status === 'healthy';
  } catch (error) {
    return false;
  }
}

// Start MCP Server if not already running
let mcpServer = null;
console.log('1️⃣  Checking MCP Server status...');
const serverRunning = await checkServerRunning();

if (serverRunning) {
  console.log('   ✅ MCP Server already running on port 6777');
} else {
  console.log('   🔄 Starting MCP Server...');
  mcpServer = spawn('node', [join(__dirname, '.claude/mcp-logging-server/server.js')], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true
  });
}

// Start Dashboard HTTP Server
console.log('2️⃣  Starting Dashboard HTTP Server...');
const dashboardServer = spawn('node', [join(__dirname, 'start-dashboard-server.js')], {
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true
});

// Wait a moment for HTTP server to start
await new Promise(resolve => setTimeout(resolve, 2000));

// Handle server output only if we started it
if (mcpServer) {
  mcpServer.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('🚀 Claude Code Skill Logging Server running on port 6777')) {
      console.log('   ✅ MCP Server started successfully');
    }
    if (output.includes('Client connected') || output.includes('Client disconnected')) {
      // Hide connection messages for cleaner output
      return;
    }
    process.stdout.write('   📡 ' + output);
  });

  mcpServer.stderr.on('data', (data) => {
    const error = data.toString();
    if (!error.includes('Failed to update metrics')) {
      process.stderr.write('   ❌ ' + error);
    }
  });

  mcpServer.unref();
}

// Handle HTTP server output
dashboardServer.stdout.on('data', (data) => {
  const output = data.toString();
  if (output.includes('Dashboard HTTP Server running on http://localhost:8080')) {
    console.log('   ✅ Dashboard HTTP Server started successfully');
  }
  process.stdout.write('   🌐 ' + output);
});

dashboardServer.stderr.on('data', (data) => {
  const error = data.toString();
  process.stderr.write('   ❌ ' + error);
});

dashboardServer.unref();

// Wait for both servers to be ready
const waitTime = serverRunning ? 2000 : 4000;
setTimeout(() => {
  // Open Dashboard in browser
  console.log('3️⃣  Opening Dashboard in browser...');
  const dashboardHttpUrl = 'http://localhost:8080';
  const dashboardFilePath = join(__dirname, 'mcp-dashboard.html');

  try {
    // Try to open browser with HTTP URL
    const browser = spawn('xdg-open', [dashboardHttpUrl], {
      stdio: 'ignore',
      detached: true
    });
    browser.unref();
    console.log(`   ✅ Dashboard opened in browser`);
    console.log(`   🔗 Dashboard URL: ${dashboardHttpUrl}`);
    console.log(`   📍 Local file: ${dashboardFilePath}`);
  } catch (error) {
    console.log(`   🔗 Dashboard URL: ${dashboardHttpUrl}`);
    console.log(`   📍 Local file: ${dashboardFilePath}`);
    console.log(`   💡 Copy and paste the HTTP URL above into your browser`);
  }

  // Start Skill Monitor after another delay
  setTimeout(() => {
    console.log('4️⃣  Starting Terminal Monitor...');

    const skillMonitor = spawn('node', [join(__dirname, 'simple-skill-monitor.js')], {
      stdio: ['ignore', 'inherit', 'inherit']
    });

    console.log('');
    console.log('✅ Complete MCP Skill Monitoring System is RUNNING!');
    console.log('================================================');
    console.log('');
    console.log('🖥️  TERMINAL OUTPUT:');
    console.log('   📊 Skill usage events will appear here in real-time');
    console.log('   📈 Live metrics and statistics displayed below');
    console.log('   🔍 Monitoring all Claude Code skill activity');
    console.log('');
    console.log('🌐 WEB DASHBOARD:');
    console.log('   📱 Interactive dashboard: http://localhost:8080');
    console.log('   📊 Real-time charts and statistics');
    console.log('   📜 Session history and event logs');
    console.log('   ⚙️  Configuration and controls');
    console.log('');
    console.log('🔧 MCP SERVER:');
    console.log('   📡 API endpoint: http://localhost:6777');
    console.log('   🌐 WebSocket: ws://localhost:6777');
    console.log('   💚 Health check: http://localhost:6777/health');
    console.log('   📝 API docs: POST /mcp/skill-usage, GET /api/metrics');
    console.log('');
    console.log('📋 ACTIVE FEATURES:');
    console.log('   ✅ Automatic skill usage logging via Claude Code hooks');
    console.log('   ✅ Real-time WebSocket updates to dashboard');
    console.log('   ✅ Persistent session and metrics storage');
    console.log('   ✅ Terminal monitoring with live updates');
    console.log('   ✅ Cross-project compatibility');
    console.log('');
    console.log('🎯 NEXT STEPS:');
    console.log('   1. Use Claude Code normally - skills will be logged automatically');
    console.log('   2. Open http://localhost:8080 to see the interactive dashboard');
    console.log('   3. Watch this terminal for real-time skill usage events');
    console.log('   4. Press Ctrl+C to stop all services');
    console.log('');
    console.log('⚠️  HOOK CONFIGURATION:');
    console.log('   Ensure .claude/settings.local.json has hook configuration');
    console.log('   Hook script: .claude/hooks/skill-logger.sh');
    console.log('');
    console.log('🎮 Press Ctrl+C to stop all services');
    console.log('');

    // Setup cleanup
    const cleanup = () => {
      console.log('🛑 Shutting down...');
      if (mcpServer) {
        console.log('   🔧 Stopping MCP server...');
        mcpServer.kill('SIGTERM');
      } else {
        console.log('   ℹ️  MCP server was already running, leaving it active');
      }
      skillMonitor.kill('SIGTERM');
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

  }, 2000);

}, 3000);