const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CRASH_LOG_DIR = '/tmp/mcp-crash-logs';
const MONITOR_LOG = path.join(CRASH_LOG_DIR, 'monitor.log');
const CRASH_EVENTS = path.join(CRASH_LOG_DIR, 'crash-events.jsonl');
const SYSTEM_SNAPSHOTS = path.join(CRASH_LOG_DIR, 'system-snapshots.jsonl');
const MCP_CONNECTIONS_LOG = path.join(CRASH_LOG_DIR, 'mcp-connections.jsonl');
const ALERT_LOG = path.join(CRASH_LOG_DIR, 'alerts.log');

// Monitoring intervals
const SYSTEM_CHECK_INTERVAL = 30000; // 30 seconds
const MCP_HEARTBEAT_INTERVAL = 10000; // 10 seconds
const CRASH_DETECTION_THRESHOLD = 3; // 3 failures = crash
const MEMORY_CRITICAL_THRESHOLD = 90; // 90% memory usage
const SWAP_CRITICAL_THRESHOLD = 95; // 95% swap usage

// MCP servers to monitor
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

// State tracking
let serverStatus = {};
let consecutiveFailures = {};
let lastKnownGood = {};
let monitoringActive = false;
let monitorStartTime = new Date();

// Ensure log directory exists
if (!fs.existsSync(CRASH_LOG_DIR)) {
  fs.mkdirSync(CRASH_LOG_DIR, { recursive: true });
}

function log(msg, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${level}] ${msg}`;
  console.error(entry);
  fs.appendFileSync(MONITOR_LOG, entry + '\n');
}

function logCrashEvent(server, reason, details) {
  const event = {
    timestamp: new Date().toISOString(),
    server,
    reason,
    details,
    systemState: getSystemSnapshot(),
    severity: details.critical ? 'CRITICAL' : 'WARNING'
  };

  fs.appendFileSync(CRASH_EVENTS, JSON.stringify(event) + '\n');
  log(`CRASH EVENT: ${server} - ${reason}`, 'CRITICAL');

  // Also alert
  alertServerIssue(server, reason, event);
}

function logMCPConnection(server, status, details = {}) {
  const event = {
    timestamp: new Date().toISOString(),
    server,
    status, // 'connected', 'disconnected', 'reconnected', 'timeout'
    details
  };

  fs.appendFileSync(MCP_CONNECTIONS_LOG, JSON.stringify(event) + '\n');
}

function alertServerIssue(server, reason, event) {
  const alertMsg = `[${new Date().toISOString()}] ALERT: ${server} issue detected\n` +
                   `Reason: ${reason}\n` +
                   `Severity: ${event.severity}\n` +
                   `Memory Usage: ${event.systemState.memoryPercent}%\n` +
                   `Swap Usage: ${event.systemState.swapPercent}%\n` +
                   `Suspended Processes: ${event.systemState.suspendedProcesses}\n`;

  fs.appendFileSync(ALERT_LOG, alertMsg);
  console.error(`\n🚨 MCP SERVER ALERT 🚨\n${alertMsg}`);
}

function getSystemSnapshot() {
  try {
    const memInfo = execSync('free -m', { encoding: 'utf8' });
    const memLines = memInfo.split('\n');
    const memLine = memLines[1].split(/\s+/);
    const swapLine = memLines[2].split(/\s+/);

    const totalMem = parseInt(memLine[1]);
    const usedMem = parseInt(memLine[2]);
    const totalSwap = parseInt(swapLine[1]);
    const usedSwap = parseInt(swapLine[2]);

    // Count suspended processes
    const suspendedProcs = parseInt(
      execSync('ps aux | grep -E "(node|python)" | grep " T " | wc -l', { encoding: 'utf8' }).trim()
    );

    // Count MCP-related processes
    const mcpProcs = parseInt(
      execSync('ps aux | grep -i mcp | grep -v grep | wc -l', { encoding: 'utf8' }).trim()
    );

    return {
      timestamp: new Date().toISOString(),
      memoryTotal: totalMem,
      memoryUsed: usedMem,
      memoryPercent: Math.round((usedMem / totalMem) * 100),
      swapTotal: totalSwap,
      swapUsed: usedSwap,
      swapPercent: totalSwap > 0 ? Math.round((usedSwap / totalSwap) * 100) : 0,
      suspendedProcesses: suspendedProcs,
      mcpProcesses: mcpProcs,
      loadAverage: execSync('uptime').toString().split('load average:')[1].trim(),
      uptime: execSync('uptime -p', { encoding: 'utf8' }).trim()
    };
  } catch (err) {
    log(`Failed to get system snapshot: ${err.message}`, 'ERROR');
    return {
      timestamp: new Date().toISOString(),
      error: err.message
    };
  }
}

function checkMCPServerHealth(serverName) {
  try {
    // Check if processes are running
    const processes = execSync(`ps aux | grep -i "${serverName}" | grep -v grep`, {
      encoding: 'utf8',
      timeout: 5000
    });

    if (!processes.trim()) {
      return {
        status: 'missing',
        processes: 0,
        suspended: 0,
        details: 'No processes found'
      };
    }

    const processList = processes.split('\n').filter(line => line.trim());
    const suspendedCount = processList.filter(line => line.includes(' T ')).length;

    return {
      status: suspendedCount > 0 ? 'degraded' : 'healthy',
      processes: processList.length,
      suspended: suspendedCount,
      details: `${processList.length} processes, ${suspendedCount} suspended`
    };
  } catch (err) {
    return {
      status: 'error',
      processes: 0,
      suspended: 0,
      details: `Check failed: ${err.message}`,
      error: err.message
    };
  }
}

function detectMCPCrash(serverName, currentStatus) {
  const previousStatus = serverStatus[serverName];

  // Initialize if first time seeing this server
  if (!previousStatus) {
    serverStatus[serverName] = currentStatus;
    consecutiveFailures[serverName] = 0;
    lastKnownGood[serverName] = new Date();
    return false;
  }

  // Check for crash conditions
  let isCrash = false;
  let crashReason = '';

  // 1. Server went from healthy to missing
  if (previousStatus.status === 'healthy' && currentStatus.status === 'missing') {
    isCrash = true;
    crashReason = 'Server disappeared (processes terminated)';
  }

  // 2. Server has too many consecutive errors
  if (currentStatus.status === 'error') {
    consecutiveFailures[serverName] = (consecutiveFailures[serverName] || 0) + 1;
    if (consecutiveFailures[serverName] >= CRASH_DETECTION_THRESHOLD) {
      isCrash = true;
      crashReason = `Consecutive errors (${consecutiveFailures[serverName]})`;
    }
  } else {
    consecutiveFailures[serverName] = 0;
  }

  // 3. Server degraded with many suspended processes
  if (currentStatus.suspended > 3) {
    isCrash = true;
    crashReason = `Too many suspended processes (${currentStatus.suspended})`;
  }

  // Update status
  serverStatus[serverName] = currentStatus;

  if (currentStatus.status === 'healthy') {
    lastKnownGood[serverName] = new Date();
  }

  if (isCrash) {
    const timeSinceGood = lastKnownGood[serverName] ?
      Date.now() - lastKnownGood[serverName].getTime() : null;

    logCrashEvent(serverName, crashReason, {
      currentStatus,
      previousStatus,
      consecutiveFailures: consecutiveFailures[serverName],
      timeSinceLastGood: timeSinceGood,
      critical: currentStatus.status === 'missing'
    });

    logMCPConnection(serverName, 'crashed', {
      reason: crashReason,
      timeSinceGood
    });
  } else if (currentStatus.status !== previousStatus.status) {
    // Log status changes
    logMCPConnection(serverName, currentStatus.status, {
      previous: previousStatus.status,
      details: currentStatus.details
    });
  }

  return isCrash;
}

function performSystemHealthCheck() {
  const snapshot = getSystemSnapshot();
  fs.appendFileSync(SYSTEM_SNAPSHOTS, JSON.stringify(snapshot) + '\n');

  // Check for critical system conditions
  if (snapshot.memoryPercent > MEMORY_CRITICAL_THRESHOLD) {
    log(`CRITICAL: Memory usage at ${snapshot.memoryPercent}%`, 'CRITICAL');
    logCrashEvent('system', 'High memory usage', {
      memoryPercent: snapshot.memoryPercent,
      critical: true
    });
  }

  if (snapshot.swapPercent > SWAP_CRITICAL_THRESHOLD) {
    log(`CRITICAL: Swap usage at ${snapshot.swapPercent}%`, 'CRITICAL');
    logCrashEvent('system', 'High swap usage', {
      swapPercent: snapshot.swapPercent,
      critical: true
    });
  }

  if (snapshot.suspendedProcesses > 10) {
    log(`WARNING: ${snapshot.suspendedProcesses} suspended processes`, 'WARNING');
    logCrashEvent('system', 'Excessive suspended processes', {
      suspendedProcesses: snapshot.suspendedProcesses,
      critical: false
    });
  }

  return snapshot;
}

async function monitorMCPServers() {
  if (!monitoringActive) {
    log('Starting MCP crash monitoring...');
    monitoringActive = true;
    monitorStartTime = new Date();
  }

  // Check all MCP servers
  let crashesDetected = 0;
  for (const server of MCP_SERVERS) {
    const status = checkMCPServerHealth(server);
    if (detectMCPCrash(server, status)) {
      crashesDetected++;
    }
  }

  // Periodic system health check
  const systemSnapshot = performSystemHealthCheck();

  // Log summary
  const healthyCount = Object.values(serverStatus).filter(s => s.status === 'healthy').length;
  const degradedCount = Object.values(serverStatus).filter(s => s.status === 'degraded').length;
  const errorCount = Object.values(serverStatus).filter(s => s.status === 'error').length;
  const missingCount = Object.values(serverStatus).filter(s => s.status === 'missing').length;

  log(`Health check: ${healthyCount} healthy, ${degradedCount} degraded, ${errorCount} errors, ${missingCount} missing. System: ${systemSnapshot.memoryPercent}% memory, ${systemSnapshot.swapPercent}% swap`);

  return {
    timestamp: new Date().toISOString(),
    crashesDetected,
    healthyCount,
    degradedCount,
    errorCount,
    missingCount,
    systemSnapshot
  };
}

function generateReport() {
  const report = {
    timestamp: new Date().toISOString(),
    monitoringStartTime: monitorStartTime.toISOString(),
    uptime: Date.now() - monitorStartTime.getTime(),
    currentStatus: serverStatus,
    consecutiveFailures,
    lastKnownGood,
    recentCrashes: [],
    systemTrends: []
  };

  // Read recent crash events
  try {
    const crashLines = fs.readFileSync(CRASH_EVENTS, 'utf8').split('\n').filter(line => line.trim());
    report.recentCrashes = crashLines.slice(-10).map(line => JSON.parse(line));
  } catch (err) {
    log(`Could not read crash events: ${err.message}`);
  }

  // Read recent system snapshots
  try {
    const snapshotLines = fs.readFileSync(SYSTEM_SNAPSHOTS, 'utf8').split('\n').filter(line => line.trim());
    report.systemTrends = snapshotLines.slice(-20).map(line => JSON.parse(line));
  } catch (err) {
    log(`Could not read system snapshots: ${err.message}`);
  }

  return report;
}

function startMonitoring(intervalMs = SYSTEM_CHECK_INTERVAL) {
  log(`Starting continuous MCP monitoring (interval: ${intervalMs}ms)`);

  // Initial health check
  monitorMCPServers();

  // Set up interval monitoring
  const monitorInterval = setInterval(async () => {
    try {
      await monitorMCPServers();
    } catch (err) {
      log(`Monitoring error: ${err.message}`, 'ERROR');
    }
  }, intervalMs);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    log('Shutting down MCP crash monitor...');
    clearInterval(monitorInterval);
    monitoringActive = false;

    const report = generateReport();
    const reportPath = path.join(CRASH_LOG_DIR, `final-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log(`Final report saved to: ${reportPath}`);
    process.exit(0);
  });

  return monitorInterval;
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2] || 'start';

  switch (command) {
    case 'start':
      startMonitoring();
      break;

    case 'check':
      monitorMCPServers().then(result => {
        console.log('\n=== MCP Health Check Results ===');
        console.log(`Crashes detected: ${result.crashesDetected}`);
        console.log(`Healthy servers: ${result.healthyCount}`);
        console.log(`Degraded servers: ${result.degradedCount}`);
        console.log(`Error servers: ${result.errorCount}`);
        console.log(`Missing servers: ${result.missingCount}`);
        console.log(`System memory: ${result.systemSnapshot.memoryPercent}%`);
        console.log(`System swap: ${result.systemSnapshot.swapPercent}%`);
        console.log(`Suspended processes: ${result.systemSnapshot.suspendedProcesses}`);
      });
      break;

    case 'report':
      const report = generateReport();
      console.log(JSON.stringify(report, null, 2));
      break;

    case 'status':
      const snapshot = getSystemSnapshot();
      console.log('Current System Status:');
      console.log(JSON.stringify(snapshot, null, 2));
      break;

    default:
      console.log('Usage: node mcp-crash-monitor.cjs [start|check|report|status]');
      break;
  }
}

module.exports = {
  startMonitoring,
  monitorMCPServers,
  generateReport,
  getSystemSnapshot,
  CRASH_LOG_DIR
};