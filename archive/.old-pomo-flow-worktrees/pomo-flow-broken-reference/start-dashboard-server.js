#!/usr/bin/env node

import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 8080;
const DASHBOARD_FILE = join(__dirname, 'mcp-dashboard.html');

const server = createServer((req, res) => {
  try {
    // Parse URL to handle different routes
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let filePath;

    // Handle root and dashboard routes
    if (url.pathname === '/' || url.pathname === '/dashboard') {
      filePath = DASHBOARD_FILE;
    } else {
      // For other paths, try to serve from the project directory
      filePath = join(__dirname, url.pathname);
    }

    // Check if file exists
    if (existsSync(filePath)) {
      const content = readFileSync(filePath);

      // Determine MIME type
      let contentType = 'text/plain';
      if (filePath.endsWith('.html')) {
        contentType = 'text/html';
      } else if (filePath.endsWith('.css')) {
        contentType = 'text/css';
      } else if (filePath.endsWith('.js')) {
        contentType = 'application/javascript';
      } else if (filePath.endsWith('.json')) {
        contentType = 'application/json';
      } else if (filePath.endsWith('.png')) {
        contentType = 'image/png';
      } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
        contentType = 'image/jpeg';
      } else if (filePath.endsWith('.svg')) {
        contentType = 'image/svg+xml';
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': Buffer.byteLength(content),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      res.end(content);
    } else {
      // If file not found, serve the main dashboard
      const content = readFileSync(DASHBOARD_FILE, 'utf8');
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Content-Length': Buffer.byteLength(content, 'utf8')
      });
      res.end(content);
    }
  } catch (error) {
    console.error('Error serving file:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Error loading dashboard');
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('🌐 DASHBOARD HTTP SERVER STARTED');
  console.log('================================');
  console.log(`📱 Dashboard URL: http://localhost:${PORT}`);
  console.log(`🔗 Direct access: http://localhost:${PORT}/mcp-dashboard.html`);
  console.log(`📡 Serving file: ${DASHBOARD_FILE}`);
  console.log('');
  console.log('📊 DASHBOARD FEATURES:');
  console.log('   ✅ Real-time WebSocket connections');
  console.log('   ✅ Interactive skill usage charts');
  console.log('   ✅ Live session monitoring');
  console.log('   ✅ Event history and filtering');
  console.log('   ✅ Responsive design for all devices');
  console.log('');
  console.log('🔌 Backend Connection:');
  console.log('   🌐 WebSocket: ws://localhost:6777');
  console.log('   📡 API: http://localhost:6777/api/*');
  console.log('   💚 Health: http://localhost:6777/health');
  console.log('');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping dashboard server...');
  server.close(() => {
    console.log('✅ Dashboard server stopped');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Stopping dashboard server...');
  server.close(() => {
    console.log('✅ Dashboard server stopped');
    process.exit(0);
  });
});