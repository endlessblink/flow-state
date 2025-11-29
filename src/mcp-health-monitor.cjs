const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Your actual MCP servers from configuration
const MCP_SERVERS = [
  'brave-search',
  'devtools-debugger',
  'zai-mcp-server',
  'context7',
  'octocode',
  'clean-cut-mcp',
  'firebase',
  'claude-code-templates',
  'playwright'
];

const HEALTH_LOG = '/tmp/mcp-health.log';
const TIMEOUT_MS = 30000; // 30 second timeout threshold

function log(msg) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${msg}`;
  console.error(entry);
  fs.appendFileSync(HEALTH_LOG, entry + '\n');
}

function checkServerHealth(serverName) {
  try {
    // Check if any processes are running for this server
    const processes = execSync(`ps aux | grep -i "${serverName}" | grep -v grep`, {
      encoding: 'utf8',
      timeout: 5000
    });

    if (processes.trim()) {
      // Check if any are suspended (T status)
      const suspended = processes.split('\n').filter(line => line.includes(' T '));
      if (suspended.length > 0) {
        log(`⚠ ${serverName}: Has ${suspended.length} suspended processes`);
        return 'suspended';
      }

      log(`✓ ${serverName}: Running (${processes.split('\n').filter(l => l.trim()).length} processes)`);
      return 'healthy';
    } else {
      log(`✗ ${serverName}: No processes found`);
      return 'missing';
    }
  } catch (err) {
    // No processes found or error checking
    log(`? ${serverName}: Status unknown - ${err.message}`);
    return 'unknown';
  }
}

function checkSystemHealth() {
  log('=== System Health Check ===');

  // Check swap status
  try {
    const swapOutput = execSync('free -h | grep Swap', { encoding: 'utf8' });
    const swapTotal = swapOutput.split(/\s+/)[1];
    const swapUsed = swapOutput.split(/\s+/)[2];

    if (swapTotal === '0B') {
      log('✗ CRITICAL: No swap configured!');
      return 'critical';
    } else {
      log(`✓ Swap: ${swapUsed} / ${swapTotal}`);
    }
  } catch (err) {
    log(`✗ Could not check swap status: ${err.message}`);
  }

  // Check suspended processes
  try {
    const suspendedCount = parseInt(
      execSync('ps aux | grep -E "(node|python)" | grep " T " | wc -l', { encoding: 'utf8' }).trim()
    );

    if (suspendedCount > 5) {
      log(`⚠ WARNING: ${suspendedCount} suspended processes found`);
      log('  Run: npm run mcp:cleanup');
    } else {
      log(`✓ Suspended processes: ${suspendedCount}`);
    }
  } catch (err) {
    log(`? Could not check suspended processes`);
  }

  // Check memory
  try {
    const memOutput = execSync('free -h | grep Mem', { encoding: 'utf8' });
    const memAvailable = memOutput.split(/\s+/)[6];
    log(`✓ Memory available: ${memAvailable}`);
  } catch (err) {
    log(`? Could not check memory status`);
  }

  return 'healthy';
}

function monitorMCPServers() {
  log('=== MCP Server Health Check ===');

  // First check system health
  const systemHealth = checkSystemHealth();
  if (systemHealth === 'critical') {
    log('❌ System health critical - aborting server checks');
    return { systemHealth, servers: {} };
  }

  const serverResults = {};
  const statusCounts = { healthy: 0, suspended: 0, missing: 0, unknown: 0 };

  for (const server of MCP_SERVERS) {
    const status = checkServerHealth(server);
    serverResults[server] = status;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }

  // Summary
  log(`=== Summary ===`);
  log(`✓ Healthy: ${statusCounts.healthy}`);
  if (statusCounts.suspended > 0) log(`⚠ Suspended: ${statusCounts.suspended}`);
  if (statusCounts.missing > 0) log(`✗ Missing: ${statusCounts.missing}`);
  if (statusCounts.unknown > 0) log(`? Unknown: ${statusCounts.unknown}`);

  // Recommendations
  if (statusCounts.suspended > 0) {
    log('🔧 Recommendation: Run "npm run mcp:cleanup" to fix suspended processes');
  }

  if (statusCounts.missing > 0) {
    log('🔧 Recommendation: Check MCP server configuration and restart missing servers');
  }

  const failed = Object.entries(serverResults)
    .filter(([_, status]) => status !== 'healthy')
    .map(([name, _]) => name);

  return {
    systemHealth,
    servers: serverResults,
    failed,
    summary: statusCounts
  };
}

// Export for CLI use
module.exports = { monitorMCPServers };

// Run health check if called directly
if (require.main === module) {
  monitorMCPServers();
}