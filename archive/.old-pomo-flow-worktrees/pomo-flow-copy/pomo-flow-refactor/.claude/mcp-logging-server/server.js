#!/usr/bin/env node

import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SkillLoggingServer {
  constructor(port = 3001) {
    this.port = port;
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    this.clients = new Set();
    this.skillEvents = [];
    this.sessions = new Map();
    this.logFile = path.join(__dirname, '..', 'logs', 'skill-usage.jsonl');
    this.metricsFile = path.join(__dirname, '..', 'logs', 'skill-metrics.json');

    // Skill Router Integration
    this.skillsDir = path.join(__dirname, '..', 'skills');
    this.routerConfigFile = path.join(this.skillsDir, 'skill-router', 'routing-config.json');
    this.availableSkills = [];
    this.routerConfig = null;
    this.lastSkillScan = null;

    // CRITICAL FIX: Bind all methods to maintain 'this' context
    this.processSkillEvent = this.processSkillEvent.bind(this);
    this.broadcastEvent = this.broadcastEvent.bind(this);
    this.updateSession = this.updateSession.bind(this);
    this.persistEvent = this.persistEvent.bind(this);
    this.getRecentEvents = this.getRecentEvents.bind(this);
    this.calculateBasicMetrics = this.calculateBasicMetrics.bind(this);
    this.discoverSkills = this.discoverSkills.bind(this);
    this.loadRouterConfig = this.loadRouterConfig.bind(this);
    this.getSkillRouterInfo = this.getSkillRouterInfo.bind(this);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.loadExistingData();

    // Load skill router information on startup
    this.discoverSkills().catch(console.error);
    this.loadRouterConfig().catch(console.error);

    // Set up periodic skill discovery (every 5 minutes)
    setInterval(() => {
      this.discoverSkills().catch(console.error);
    }, 5 * 60 * 1000);
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.static(path.join(__dirname, 'public')));
  }

  setupRoutes() {
    // MCP-style endpoint for skill usage events
    this.app.post('/mcp/skill-usage', async (req, res) => {
      try {
        const event = this.processSkillEvent(req.body);
        this.broadcastEvent(event);
        res.status(200).json({
          success: true,
          eventId: event.id,
          timestamp: event.timestamp
        });
      } catch (error) {
        console.error('Error processing skill event:', error);
        res.status(400).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get current metrics
    this.app.get('/api/metrics', async (req, res) => {
      try {
        const metrics = await this.calculateMetrics();
        res.json(metrics);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get recent events
    this.app.get('/api/events', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 50;
        const skill = req.query.skill || null;
        const events = this.getRecentEvents(limit, skill);
        res.json(events);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get session information
    this.app.get('/api/sessions', (req, res) => {
      try {
        const sessions = Array.from(this.sessions.values());
        res.json(sessions);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get skill router information
    this.app.get('/api/skill-router', async (req, res) => {
      try {
        const routerInfo = await this.getSkillRouterInfo();
        res.json(routerInfo);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    // Get usage summary (week/month/all-time stats)
    this.app.get('/api/usage-summary', (req, res) => {
      try {
        const summary = this.getUsageSummary();
        res.json(summary);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });


    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        activeConnections: this.clients.size,
        totalEvents: this.skillEvents.length,
        activeSessions: this.sessions.size
      });
    });

    // Enable MCP logging flag
    this.app.post('/api/enable-mcp-logging', (req, res) => {
      this.enableMCPLogging();
      res.json({ success: true, message: 'MCP logging enabled' });
    });
  }

  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      const clientId = uuidv4();
      const clientInfo = {
        id: clientId,
        connected: new Date(),
        lastActivity: new Date(),
        ip: req.socket.remoteAddress
      };

      this.clients.add(ws);
      console.log(`Client connected: ${clientId} from ${clientInfo.ip}`);

      // Send initial data to new client
      ws.send(JSON.stringify({
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString(),
        initialData: {
          recentEvents: this.getRecentEvents(10),
          metrics: this.calculateBasicMetrics()
        }
      }));

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.handleClientMessage(ws, clientId, message);
        } catch (error) {
          console.error(`Invalid message from ${clientId}:`, error);
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`Client disconnected: ${clientId}`);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for ${clientId}:`, error);
        this.clients.delete(ws);
      });
    });
  }

  processSkillEvent(rawData) {
    console.log('🔍 [DEBUG] Processing skill event:', rawData.skill_name);

    const event = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      ...rawData
    };

    console.log('📊 [DEBUG] Events before add:', this.skillEvents.length);

    // Add to events array (keep last 1000)
    this.skillEvents.push(event);
    if (this.skillEvents.length > 1000) {
      this.skillEvents = this.skillEvents.slice(-1000);
    }

    console.log('📊 [DEBUG] Events after add:', this.skillEvents.length);
    console.log('📊 [DEBUG] Current events:', this.skillEvents.map(e => e.skill_name));

    // Update session information
    this.updateSession(event);
    console.log('👥 [DEBUG] Sessions after update:', this.sessions.size);

    // Persist to log file
    this.persistEvent(event);

    return event;
  }

  updateSession(event) {
    const sessionId = event.session_id;

    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        sessionId,
        startTime: event.timestamp,
        lastActivity: event.timestamp,
        skillCount: 0,
        skills: new Set(),
        hostname: event.hostname,
        user: event.user
      });
    }

    const session = this.sessions.get(sessionId);
    session.lastActivity = event.timestamp;
    session.skillCount++;
    session.skills.add(event.skill_name);
  }

  async persistEvent(event) {
    try {
      // Append to JSONL log file
      const logLine = JSON.stringify(event) + '\n';
      await fs.appendFile(this.logFile, logLine);

      // Update metrics
      await this.updateMetrics(event);
    } catch (error) {
      console.error('Failed to persist event:', error);
    }
  }

  async updateMetrics(event) {
    try {
      let metrics = {};

      try {
        const existingMetrics = await fs.readFile(this.metricsFile, 'utf8');
        metrics = JSON.parse(existingMetrics);
      } catch {
        // Start with empty metrics if file doesn't exist
      }

      const skillName = event.skill_name;
      if (!metrics[skillName]) {
        metrics[skillName] = {
          totalCalls: 0,
          preCalls: 0,
          postCalls: 0,
          errors: 0,
          firstUsed: event.timestamp,
          lastUsed: event.timestamp,
          sessions: new Set()
        };
      }

      const skillMetrics = metrics[skillName];

      // Safety check to prevent undefined errors
      if (!skillMetrics) {
        console.error(`❌ Critical Error: skillMetrics is undefined for skill: ${skillName}`);
        return; // Skip this event to prevent crash
      }

      skillMetrics.totalCalls++;
      skillMetrics.lastUsed = event.timestamp;

      if (event.action === 'pre') {
        skillMetrics.preCalls++;
      } else if (event.action === 'post') {
        skillMetrics.postCalls++;
      }

      // Ensure sessions property exists before calling add()
      if (!skillMetrics.sessions) {
        skillMetrics.sessions = new Set();
      }

      skillMetrics.sessions.add(event.session_id);

      // Save metrics (convert Sets to Arrays for JSON serialization)
      const serializedMetrics = {};
      for (const [skill, data] of Object.entries(metrics)) {
        serializedMetrics[skill] = {
          ...data,
          sessions: Array.from(data.sessions)
        };
      }

      await fs.writeFile(this.metricsFile, JSON.stringify(serializedMetrics, null, 2));
    } catch (error) {
      console.error('Failed to update metrics:', error);
    }
  }

  broadcastEvent(event) {
    console.log('📡 [DEBUG] Broadcasting event to', this.clients.size, 'clients');
    console.log('📡 [DEBUG] Event being broadcast:', event.skill_name);

    const message = JSON.stringify({
      type: 'skillEvent',
      event
    });

    let successCount = 0;
    let failCount = 0;

    this.clients.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        try {
          ws.send(message);
          successCount++;
          console.log('✅ [DEBUG] Successfully sent to client');
        } catch (error) {
          console.error('❌ [DEBUG] Failed to send event to client:', error);
          failCount++;
        }
      } else {
        console.log('⚠️ [DEBUG] Client not ready, state:', ws.readyState);
        failCount++;
      }
    });

    console.log(`📡 [DEBUG] Broadcast complete: ${successCount} success, ${failCount} failed`);
  }

  handleClientMessage(ws, clientId, message) {
    switch (message.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        break;

      case 'subscribe':
        // Handle subscription to specific events
        ws.send(JSON.stringify({
          type: 'subscribed',
          filters: message.filters,
          timestamp: new Date().toISOString()
        }));
        break;

      default:
        console.log(`Unknown message type from ${clientId}:`, message.type);
    }
  }

  getRecentEvents(limit = 50, skillFilter = null) {
    let events = [...this.skillEvents].reverse();

    if (skillFilter) {
      events = events.filter(event => event.skill_name === skillFilter);
    }

    return events.slice(0, limit);
  }

  calculateBasicMetrics() {
    const totalEvents = this.skillEvents.length;
    const activeSessions = this.sessions.size;
    const connectedClients = this.clients.size;

    const skillCounts = {};
    this.skillEvents.forEach(event => {
      skillCounts[event.skill_name] = (skillCounts[event.skill_name] || 0) + 1;
    });

    return {
      totalEvents,
      activeSessions,
      connectedClients,
      skillCounts,
      topSkills: Object.entries(skillCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([skill, count]) => ({ skill, count }))
    };
  }

  async calculateMetrics() {
    const basicMetrics = this.calculateBasicMetrics();

    // Load detailed metrics from file
    try {
      const metricsData = await fs.readFile(this.metricsFile, 'utf8');
      const detailedMetrics = JSON.parse(metricsData);

      return {
        ...basicMetrics,
        detailedMetrics,
        sessions: Array.from(this.sessions.values())
      };
    } catch {
      return basicMetrics;
    }
  }

  async loadExistingData() {
    try {
      // Load existing events from log file
      const logContent = await fs.readFile(this.logFile, 'utf8');
      const lines = logContent.trim().split('\n').filter(line => line);

      for (const line of lines.slice(-100)) { // Load last 100 events
        try {
          const event = JSON.parse(line);
          this.skillEvents.push(event);
          this.updateSession(event);
        } catch (error) {
          console.error('Failed to parse log line:', error);
        }
      }

      console.log(`Loaded ${this.skillEvents.length} existing events from log file`);
    } catch (error) {
      console.log('No existing log file found, starting fresh');
    }
  }

  async discoverSkills() {
    try {
      const skillDirs = await fs.readdir(this.skillsDir, { withFileTypes: true });
      const skills = [];

      for (const dir of skillDirs) {
        if (dir.isDirectory() && dir.name !== 'skill-router') {
          const skillPath = path.join(this.skillsDir, dir.name);
          const skillFile = path.join(skillPath, 'SKILL.md');

          try {
            await fs.access(skillFile);
            skills.push({
              name: dir.name,
              path: skillPath,
              discovered: new Date().toISOString()
            });
          } catch {
            // Skip directories without SKILL.md
          }
        }
      }

      this.availableSkills = skills;
      this.lastSkillScan = new Date();

      console.log(`🔍 Skill Discovery: Found ${skills.length} skills`);
      return skills;
    } catch (error) {
      console.error('Failed to discover skills:', error);
      return [];
    }
  }

  async loadRouterConfig() {
    try {
      const configData = await fs.readFile(this.routerConfigFile, 'utf8');
      this.routerConfig = JSON.parse(configData);
      console.log(`📋 Skill Router Config Loaded: ${this.routerConfig.version}`);
      return this.routerConfig;
    } catch (error) {
      console.warn('Failed to load router config:', error.message);
      return null;
    }
  }

  async getSkillRouterInfo() {
    // Discover skills if not yet discovered or if scan is old (> 5 minutes)
    const SCAN_INTERVAL = 5 * 60 * 1000; // 5 minutes
    if (!this.lastSkillScan || (Date.now() - this.lastSkillScan.getTime() > SCAN_INTERVAL)) {
      await this.discoverSkills();
    }

    // Load router config if not loaded
    if (!this.routerConfig) {
      await this.loadRouterConfig();
    }

    // Calculate usage statistics per skill
    const skillUsage = {};
    for (const event of this.skillEvents) {
      const skillName = event.skill_name;
      if (!skillUsage[skillName]) {
        skillUsage[skillName] = { count: 0, lastUsed: event.timestamp };
      }
      skillUsage[skillName].count++;
      if (new Date(event.timestamp) > new Date(skillUsage[skillName].lastUsed)) {
        skillUsage[skillName].lastUsed = event.timestamp;
      }
    }

    return {
      totalSkills: this.availableSkills.length,
      skills: this.availableSkills.map(skill => ({
        ...skill,
        usage: skillUsage[skill.name] || { count: 0, lastUsed: null }
      })),
      routerConfig: this.routerConfig ? {
        version: this.routerConfig.version,
        totalPatterns: Object.keys(this.routingPatterns || {}).length,
        mandatoryGates: Object.keys(this.routerConfig.mandatoryGates || {}).length,
        skillChains: Object.keys(this.routerConfig.skillChains || {}).length
      } : null,
      lastScan: this.lastSkillScan,
      nextScan: this.lastSkillScan ? new Date(this.lastSkillScan.getTime() + SCAN_INTERVAL) : null
    };
  }

  getUsageSummary() {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const weekAgo = now - (7 * oneDay);
    const monthAgo = now - (30 * oneDay);

    // Calculate stats for different time periods
    const calculatePeriodStats = (startTime) => {
      const periodEvents = this.skillEvents.filter(event => {
        const eventTime = new Date(event.timestamp).getTime();
        return eventTime >= startTime;
      });

      const skillCounts = {};
      periodEvents.forEach(event => {
        const skillName = event.skill_name;
        skillCounts[skillName] = (skillCounts[skillName] || 0) + 1;
      });

      const uniqueSkills = Object.keys(skillCounts).length;
      const totalExecutions = periodEvents.length;

      // Find most used skill
      let mostUsedSkill = null;
      let maxCount = 0;
      for (const [skill, count] of Object.entries(skillCounts)) {
        if (count > maxCount) {
          maxCount = count;
          mostUsedSkill = skill;
        }
      }

      return {
        uniqueSkills,
        totalExecutions,
        mostUsed: mostUsedSkill ? { skill: mostUsedSkill, count: maxCount } : null
      };
    };

    return {
      thisWeek: calculatePeriodStats(weekAgo),
      thisMonth: calculatePeriodStats(monthAgo),
      allTime: calculatePeriodStats(0)
    };
  }

  enableMCPLogging() {
    // Create flag file to enable MCP logging in hooks
    const flagFile = path.join(__dirname, '..', 'mcp-logging-enabled');
    fs.writeFile(flagFile, new Date().toISOString()).catch(console.error);
  }

  start() {
    this.server.listen(this.port, () => {
      console.log('');
      console.log('🚀 Claude Code Skill Logging Server Started');
      console.log('==========================================');
      console.log(`📡 Server Status: RUNNING on port ${this.port}`);
      console.log(`🔗 HTTP API: http://localhost:${this.port}`);
      console.log(`🌐 WebSocket: ws://localhost:${this.port}`);
      console.log(`💚 Health Check: http://localhost:${this.port}/health`);
      console.log('');
      console.log('📊 Available Endpoints:');
      console.log(`   POST http://localhost:${this.port}/mcp/skill-usage - Log skill usage`);
      console.log(`   GET  http://localhost:${this.port}/api/metrics - Get usage metrics`);
      console.log(`   GET  http://localhost:${this.port}/api/events - Get recent events`);
      console.log(`   GET  http://localhost:${this.port}/api/sessions - Get session info`);
      console.log(`   GET  http://localhost:${this.port}/health - Health check`);
      console.log('');
      console.log('📈 Real-time Features:');
      console.log(`   ✅ WebSocket connections: ${this.clients.size} active`);
      console.log(`   ✅ Event broadcasting: ENABLED`);
      console.log(`   ✅ Session tracking: ENABLED`);
      console.log(`   ✅ Persistent logging: ENABLED`);
      console.log('');
      console.log('💾 Data Storage:');
      console.log(`   📁 Events: ${this.logFile}`);
      console.log(`   📁 Metrics: ${this.metricsFile}`);
      console.log(`   📊 Current events: ${this.skillEvents.length}`);
      console.log(`   👥 Active sessions: ${this.sessions.size}`);
      console.log('');
      console.log('🔧 MCP Logging Status: ENABLED');
      console.log('   Hook script should send events to /mcp/skill-usage');
      console.log('');
    });

    // Enable MCP logging by default
    this.enableMCPLogging();
  }
}

// Start the server
const server = new SkillLoggingServer(6777);
server.start();