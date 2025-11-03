#!/usr/bin/env node

/**
 * Skill Monitoring Wrapper
 *
 * Since Claude Code hooks are not triggering reliably,
 * this provides an alternative monitoring method.
 *
 * This script:
 * 1. Monitors log files for skill usage patterns
 * 2. Provides manual logging capability
 * 3. Creates synthetic skill usage events
 * 4. Integrates with the existing MCP logging system
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SkillMonitorWrapper {
  constructor() {
    this.logDir = path.join(__dirname, '..', 'logs');
    this.usageLog = path.join(this.logDir, 'skill-usage.jsonl');
    this.metricsFile = path.join(this.logDir, 'skill-metrics.json');
    this.mcpEnabled = path.join(__dirname, '..', 'mcp-logging-enabled');
    this.mcpServerUrl = 'http://localhost:6777/mcp/skill-usage';
  }

  async logSkillUsage(skillName, action = 'manual', data = {}) {
    try {
      const timestamp = new Date().toISOString();
      const sessionId = `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const event = {
        timestamp,
        session_id: sessionId,
        action,
        skill_name: skillName,
        data: {
          skill: skillName,
          source: 'manual-monitor',
          ...data
        },
        hostname: process.env.HOSTNAME || require('os').hostname(),
        user: process.env.USER || require('os').userInfo().username
      };

      // Log to local file
      await this.appendToLog(event);

      // Send to MCP server if enabled
      if (await this.isMCPEnabled()) {
        await this.sendToMCP(event);
      }

      console.log(`✅ Logged skill usage: ${skillName} (${action})`);
      return event;
    } catch (error) {
      console.error('❌ Failed to log skill usage:', error);
      throw error;
    }
  }

  async appendToLog(event) {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
      const logLine = JSON.stringify(event) + '\n';
      await fs.appendFile(this.usageLog, logLine);
    } catch (error) {
      console.error('Failed to append to log:', error);
    }
  }

  async isMCPEnabled() {
    try {
      await fs.access(this.mcpEnabled);
      return true;
    } catch {
      return false;
    }
  }

  async sendToMCP(event) {
    try {
      // Use built-in Node.js HTTPS/http module if fetch is not available
      let response;
      try {
        response = await fetch(this.mcpServerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event)
        });
      } catch (fetchError) {
        // Fallback to Node.js built-in http module
        const http = await import('http');
        const https = await import('https');
        const url = new URL(this.mcpServerUrl);
        const client = url.protocol === 'https:' ? https : http;

        response = await new Promise((resolve, reject) => {
          const postData = JSON.stringify(event);
          const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          };

          const req = client.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              statusText: res.statusMessage
            }));
          });

          req.on('error', reject);
          req.write(postData);
          req.end();
        });
      }

      if (!response.ok) {
        console.warn(`MCP server responded: ${response.status} ${response.statusText}`);
      } else {
        console.log('✅ Event sent to MCP server successfully');
      }
    } catch (error) {
      console.warn('Failed to send to MCP server:', error.message);
    }
  }

  async monitorSession() {
    console.log('🔍 Starting skill monitoring session...');
    console.log('📝 Commands:');
    console.log('   log <skill-name> - Manually log skill usage');
    console.log('   status - Show current monitoring status');
    console.log('   quit - Exit monitoring');

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', async (key) => {
      if (key === '\u0003' || key === 'q') { // Ctrl+C or q
        console.log('\n👋 Exiting skill monitor');
        process.exit(0);
      }
    });

    // Example: Monitor for specific patterns
    console.log('\n💡 To log skill usage, call:');
    console.log('   node .claude/hooks/skill-monitor-wrapper.js log <skill-name>');
  }

  async getStatus() {
    try {
      const stats = await fs.stat(this.usageLog).catch(() => ({ size: 0 }));
      const mcpStatus = await this.isMCPEnabled() ? '✅ Enabled' : '❌ Disabled';

      console.log('📊 Skill Monitor Status:');
      console.log(`   Log file: ${this.usageLog}`);
      console.log(`   Log size: ${stats.size} bytes`);
      console.log(`   MCP Server: ${mcpStatus}`);
      console.log(`   Server URL: ${this.mcpServerUrl}`);
    } catch (error) {
      console.error('Failed to get status:', error);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const monitor = new SkillMonitorWrapper();

  if (args.length === 0) {
    await monitor.monitorSession();
    return;
  }

  const command = args[0];

  switch (command) {
    case 'log':
      if (args.length < 2) {
        console.error('Usage: node skill-monitor-wrapper.js log <skill-name>');
        process.exit(1);
      }
      const skillName = args[1];
      const data = {};

      // Parse additional data
      for (let i = 2; i < args.length; i += 2) {
        if (args[i + 1]) {
          data[args[i].replace('--', '')] = args[i + 1];
        }
      }

      await monitor.logSkillUsage(skillName, 'manual', data);
      break;

    case 'status':
      await monitor.getStatus();
      break;

    case 'test':
      console.log('🧪 Testing skill monitoring...');
      await monitor.logSkillUsage('test-skill', 'test', {
        test: true,
        timestamp: new Date().toISOString()
      });
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Available commands: log, status, test');
      process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default SkillMonitorWrapper;