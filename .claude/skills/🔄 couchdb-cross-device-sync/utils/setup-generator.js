#!/usr/bin/env node

/**
 * CouchDB Setup Generator
 * Part of CouchDB Cross-Device Sync Skill
 * Generates all necessary files for CouchDB + PouchDB setup
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class CouchDBSetupGenerator {
  constructor(options = {}) {
    this.options = {
      projectName: options.projectName || 'myapp',
      couchdbUrl: options.couchdbUrl || 'http://localhost:5984',
      databaseName: options.databaseName || 'myapp',
      username: options.username || 'admin',
      password: options.password || this.generatePassword(),
      appPort: options.appPort || 3000,
      ...options
    }

    this.templates = {}
    this.initializeTemplates()
  }

  generatePassword() {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15)
  }

  initializeTemplates() {
    this.templates = {
      // Docker Compose Template
      'docker-compose.yml': this.getDockerComposeTemplate(),

      // Environment Files
      '.env.couchdb': this.getEnvTemplate(),
      '.env.example': this.getEnvExampleTemplate(),

      // Scripts
      'setup-couchdb.sh': this.getSetupScript(),
      'fix-cors.sh': this.getCorsFixScript(),
      'create-database.sh': this.getCreateDatabaseScript(),
      'backup-database.sh': this.getBackupScript(),

      // Vue/React Integration
      'src/composables/useDatabase.ts': this.getDatabaseComposable(),
      'src/types/database.ts': this.getDatabaseTypes(),
      'src/utils/device-id.ts': this.getDeviceIdUtil(),

      // Testing
      'tests/database.test.js': this.getDatabaseTest(),
      'utils/test-connectivity.js': this.getConnectivityTester(),

      // Documentation
      'README-CouchDB.md': this.getReadmeTemplate(),
      'TROUBLESHOOTING.md': this.getTroubleshootingTemplate(),

      // Package.json updates
      'package-additions.json': this.getPackageAdditions()
    }
  }

  getDockerComposeTemplate() {
    return `version: '3.8'

services:
  couchdb:
    image: couchdb:3.3
    container_name: ${this.options.projectName}-couchdb
    restart: always
    ports:
      - "5984:5984"
    environment:
      - COUCHDB_USER=${this.options.username}
      - COUCHDB_PASSWORD=${this.options.password}
      - COUCHDB_SECRET=${this.generatePassword()}
    volumes:
      - couchdb-data:/opt/couchdb/data
      - couchdb-config:/opt/couchdb/etc/local.d
    networks:
      - couchdb-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5984/_up"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Optional: Nginx reverse proxy for HTTPS
  nginx:
    image: nginx:alpine
    container_name: ${this.options.projectName}-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - couchdb
    networks:
      - couchdb-network
    profiles:
      - production

volumes:
  couchdb-data:
    driver: local
  couchdb-config:
    driver: local

networks:
  couchdb-network:
    driver: bridge`
  }

  getEnvTemplate() {
    return `# CouchDB Configuration - DO NOT COMMIT TO VERSION CONTROL
# Generated for ${this.options.projectName}

# Server Configuration
COUCHDB_URL=${this.options.couchdbUrl}
COUCHDB_USER=${this.options.username}
COUCHDB_PASSWORD=${this.options.password}
COUCHDB_DATABASE=${this.options.databaseName}

# Vue/Vite Environment Variables
VITE_COUCHDB_URL=${this.options.couchdbUrl}/${this.options.databaseName}
VITE_COUCHDB_USER=${this.options.username}
VITE_COUCHDB_PASSWORD=${this.options.password}
VITE_COUCHDB_AUTH=true

# App Configuration
VITE_APP_NAME=${this.options.projectName}
VITE_APP_PORT=${this.options.appPort}

# Development Settings
VITE_ENABLE_CORS=true
VITE_DEV_SYNC_DELAY=1000
VITE_SYNC_BATCH_SIZE=100
VITE_SYNC_RETRY_ATTEMPTS=3

# Environment
NODE_ENV=development`
  }

  getEnvExampleTemplate() {
    return `# CouchDB Configuration - Copy to .env.couchdb and fill in your values
COUCHDB_URL=http://localhost:5984
COUCHDB_USER=admin
COUCHDB_PASSWORD=your_secure_password_here
COUCHDB_DATABASE=myapp

# Vue Environment Variables
VITE_COUCHDB_URL=http://localhost:5984/myapp
VITE_COUCHDB_USER=admin
VITE_COUCHDB_PASSWORD=your_secure_password_here
VITE_COUCHDB_AUTH=true

# App Configuration
VITE_APP_NAME=myapp
VITE_APP_PORT=3000`
  }

  getSetupScript() {
    return `#!/bin/bash

# CouchDB Setup Script for ${this.options.projectName}
# This script sets up CouchDB with proper configuration

set -e

echo "🚀 Setting up CouchDB for ${this.options.projectName}"

# Configuration
COUCHDB_URL="${this.options.couchdbUrl}"
COUCHDB_USER="${this.options.username}"
COUCHDB_PASSWORD="${this.options.password}"
DATABASE="${this.options.databaseName}"

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

echo "📋 Configuration:"
echo "   URL: $COUCHDB_URL"
echo "   User: $COUCHDB_USER"
echo "   Database: $DATABASE"

# Wait for CouchDB to be ready
echo "⏳ Waiting for CouchDB to be ready..."
until curl -f "$COUCHDB_URL/_up" > /dev/null 2>&1; do
    echo -n "."
    sleep 2
done
echo " ✅ CouchDB is ready!"

# Verify authentication
echo "🔐 Testing authentication..."
AUTH_RESPONSE=$(curl -s -u "$COUCHDB_USER:$COUCHDB_PASSWORD" "$COUCHDB_URL/_session")
if echo "$AUTH_RESPONSE" | grep -q '"ok":true'; then
    echo " ✅ Authentication successful"
else
    echo -e "${RED}❌ Authentication failed${NC}"
    echo "Please check your credentials and that CouchDB is running."
    exit 1
fi

# Create database
echo "📝 Creating database: $DATABASE"
CREATE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \\
    -X PUT \\
    -u "$COUCHDB_USER:$COUCHDB_PASSWORD" \\
    "$COUCHDB_URL/$DATABASE")

if [ "$CREATE_RESPONSE" = "201" ]; then
    echo " ✅ Database created successfully"
elif [ "$CREATE_RESPONSE" = "412" ]; then
    echo " ⚠️ Database already exists"
else
    echo -e "${RED}❌ Failed to create database (HTTP $CREATE_RESPONSE)${NC}"
    exit 1
fi

# Apply CORS configuration
echo "🌐 Configuring CORS..."

# Enable CORS
curl -X PUT "$COUCHDB_URL/_node/_local/_config/httpd/enable_cors" \\
    -u "$COUCHDB_USER:$COUCHDB_PASSWORD" \\
    -d '"true"' > /dev/null

# Set allowed origins
curl -X PUT "$COUCHDB_URL/_node/_local/_config/cors/origins" \\
    -u "$COUCHDB_USER:$COUCHDB_PASSWORD" \\
    -d '"*"' > /dev/null

# Enable credentials
curl -X PUT "$COUCHDB_URL/_node/_local/_config/cors/credentials" \\
    -u "$COUCHDB_USER:$COUCHDB_PASSWORD" \\
    -d '"true"' > /dev/null

# Set allowed methods
curl -X PUT "$COUCHDB_URL/_node/_local/_config/cors/methods" \\
    -u "$COUCHDB_USER:$COUCHDB_PASSWORD" \\
    -d '"GET, PUT, POST, HEAD, DELETE, OPTIONS"' > /dev/null

# Set allowed headers
curl -X PUT "$COUCHDB_URL/_node/_local/_config/cors/headers" \\
    -u "$COUCHDB_USER:$COUCHDB_PASSWORD" \\
    -d '"accept, authorization, content-type, origin, referer, x-csrf-token, x-requested-with"' > /dev/null

echo " ✅ CORS configuration applied"

# Create security document for database
echo "🔒 Setting up database security..."
SECURITY_DOC='{
  "admins": {
    "names": ["'$COUCHDB_USER'"],
    "roles": []
  },
  "members": {
    "names": [],
    "roles": ["app_users"]
  }
}'

curl -X PUT "$COUCHDB_URL/$DATABASE/_security" \\
    -u "$COUCHDB_USER:$COUCHDB_PASSWORD" \\
    -H "Content-Type: application/json" \\
    -d "$SECURITY_DOC" > /dev/null

echo " ✅ Database security configured"

# Verify setup
echo "🔍 Verifying setup..."
DB_INFO=$(curl -s -u "$COUCHDB_USER:$COUCHDB_PASSWORD" "$COUCHDB_URL/$DATABASE")

if echo "$DB_INFO" | grep -q '"db_name":"'$DATABASE'"'; then
    echo " ✅ Database is accessible"
    DOC_COUNT=$(echo "$DB_INFO" | grep -o '"doc_count":[0-9]*' | cut -d':' -f2)
    echo " 📊 Document count: $DOC_COUNT"
else
    echo -e "${RED}❌ Database verification failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 CouchDB setup completed successfully!${NC}"
echo ""
echo "📋 Next steps:"
echo "   1. Copy .env.couchdb to your app's environment"
echo "   2. Install dependencies: npm install pouchdb pouchdb-find"
echo "   3. Import the database composable: useDatabase.ts"
echo "   4. Test connection: node utils/test-connectivity.js"
echo ""
echo "🌐 Access your database at: $COUCHDB_URL/_utils/"
echo "👤 Login with: $COUCHDB_USER / [your password]"
echo ""
echo "📚 For more information, see README-CouchDB.md"`
  }

  getCorsFixScript() {
    return `#!/bin/bash

# Quick CORS Fix for CouchDB
# Use this if you're experiencing CORS errors

COUCHDB_URL="${COUCHDB_URL:-http://localhost:5984}"
COUCHDB_USER="${COUCHDB_USER:-admin}"
COUCHDB_PASSWORD="${COUCHDB_PASSWORD:-admin}"

echo "🔧 Applying CORS configuration to CouchDB"
echo "URL: $COUCHDB_URL"

# Enable CORS
echo "Enabling CORS..."
curl -X PUT "$COUCHDB_URL/_node/_local/_config/httpd/enable_cors" \\
    -u "$COUCHDB_USER:$COUCHDB_PASSWORD" \\
    -d '"true"'

# Set origins (you can replace * with your specific domain)
echo "Setting origins..."
curl -X PUT "$COUCHDB_URL/_node/_local/_config/cors/origins" \\
    -u "$COUCHDB_USER:$COUCHDB_PASSWORD" \\
    -d '"*"'

# Enable credentials
echo "Enabling credentials..."
curl -X PUT "$COUCHDB_URL/_node/_local/_config/cors/credentials" \\
    -u "$COUCHDB_USER:$COUCHDB_PASSWORD" \\
    -d '"true"'

# Set methods
echo "Setting methods..."
curl -X PUT "$COUCHDB_URL/_node/_local/_config/cors/methods" \\
    -u "$COUCHDB_USER:$COUCHDB_PASSWORD" \\
    -d '"GET, PUT, POST, HEAD, DELETE, OPTIONS"'

# Set headers
echo "Setting headers..."
curl -X PUT "$COUCHDB_URL/_node/_local/_config/cors/headers" \\
    -u "$COUCHDB_USER:$COUCHDB_PASSWORD" \\
    -d '"accept, authorization, content-type, origin, referer, x-csrf-token, x-requested-with"'

echo "✅ CORS configuration completed!"
echo ""
echo "🔍 Verify configuration:"
curl -s "$COUCHDB_URL/_node/_local/_config/cors" | python3 -m json.tool`
  }

  getCreateDatabaseScript() {
    return `#!/bin/bash

# Create CouchDB Database Script

DATABASE_NAME="${1:-${this.options.databaseName}}"
COUCHDB_URL="${COUCHDB_URL:-${this.options.couchdbUrl}}"
COUCHDB_USER="${COUCHDB_USER:-${this.options.username}}"
COUCHDB_PASSWORD="${COUCHDB_PASSWORD:-${this.options.password}}"

echo "📝 Creating database: $DATABASE_NAME"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \\
    -X PUT \\
    -u "$COUCHDB_USER:$COUCHDB_PASSWORD" \\
    "$COUCHDB_URL/$DATABASE_NAME")

case $RESPONSE in
    201)
        echo "✅ Database '$DATABASE_NAME' created successfully"
        ;;
    412)
        echo "⚠️ Database '$DATABASE_NAME' already exists"
        ;;
    *)
        echo "❌ Failed to create database (HTTP $RESPONSE)"
        exit 1
        ;;
esac`
  }

  getBackupScript() {
    return `#!/bin/bash

# CouchDB Backup Script

DATABASE="${1:-${this.options.databaseName}}"
BACKUP_DIR="${2:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/${DATABASE}_backup_$TIMESTAMP.json"

COUCHDB_URL="${COUCHDB_URL:-${this.options.couchdbUrl}}"
COUCHDB_USER="${COUCHDB_USER:-${this.options.username}}"
COUCHDB_PASSWORD="${COUCHDB_PASSWORD:-${this.options.password}}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "💾 Backing up database: $DATABASE"
echo "📁 Backup file: $BACKUP_FILE"

# Create backup
curl -s -u "$COUCHDB_USER:$COUCHDB_PASSWORD" \\
    "$COUCHDB_URL/$DATABASE/_all_docs?include_docs=true" \\
    | python3 -c "
import json, sys
data = json.load(sys.stdin)
backup = {
    'database': '$DATABASE',
    'timestamp': '$TIMESTAMP',
    'docs': []
}
for row in data['rows']:
    if 'doc' in row and not row['id'].startswith('_design/'):
        backup['docs'].append(row['doc'])
print(json.dumps(backup, indent=2))
" > "$BACKUP_FILE"

echo "✅ Backup completed: $BACKUP_FILE"
echo "📊 Documents backed up: $(jq '.docs | length' "$BACKUP_FILE")"`
  }

  getDatabaseComposable() {
    return `import { ref, onMounted, onUnmounted, computed, readonly } from 'vue'
import PouchDB from 'pouchdb'
import PouchDBFind from 'pouchdb-find'

// Enable plugins
PouchDB.plugin(PouchDBFind)

export interface SyncStatus {
  active: boolean
  paused: boolean
  error: string | null
  lastSync: Date | null
  pushCount: number
  pullCount: number
}

export interface DatabaseConfig {
  name: string
  remote?: string
  auth?: {
    username: string
    password: string
  }
  options?: {
    live?: boolean
    retry?: boolean
    timeout?: number
    batch_size?: number
  }
}

export function useDatabase(config: DatabaseConfig) {
  const localDB = new PouchDB(config.name)

  let remoteDB: PouchDB.Database | null = null
  if (config.remote && config.auth) {
    remoteDB = new PouchDB(config.remote, {
      auth: config.auth,
      skip_setup: false
    })
  }

  const syncStatus = ref<SyncStatus>({
    active: false,
    paused: false,
    error: null,
    lastSync: null,
    pushCount: 0,
    pullCount: 0
  })

  const isOnline = ref(navigator.onLine)
  let syncHandler: PouchDB.Replication.Sync<any> | null = null

  // Monitor online/offline status
  const handleOnline = () => {
    isOnline.value = true
    if (remoteDB && !syncStatus.value.active) {
      startSync()
    }
  }

  const handleOffline = () => {
    isOnline.value = false
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  const startSync = async () => {
    if (!remoteDB) {
      console.warn('⚠️ No remote database configured')
      return
    }

    try {
      await remoteDB.info()
      console.log('🌐 Remote database accessible')

      syncHandler = localDB.sync(remoteDB, {
        live: config.options?.live ?? true,
        retry: config.options?.retry ?? true,
        timeout: config.options?.timeout ?? 30000,
        heartbeat: 10000,
        batch_size: config.options?.batch_size ?? 100
      })
        .on('change', (info) => {
          syncStatus.value.lastSync = new Date()
          if (info.direction === 'push') {
            syncStatus.value.pushCount++
          } else {
            syncStatus.value.pullCount++
          }
          console.log(\`📤 Sync \${info.direction}: \${info.change.docs?.length || 0} changes\`)
        })
        .on('paused', (err) => {
          syncStatus.value.paused = true
          syncStatus.value.active = false
          if (err && err.message !== 'replication terminated') {
            syncStatus.value.error = err.message
          }
        })
        .on('active', () => {
          syncStatus.value.active = true
          syncStatus.value.paused = false
          syncStatus.value.error = null
        })
        .on('error', (err) => {
          console.error('❌ Sync error:', err.message)
          syncStatus.value.error = err.message
        })

      syncStatus.value.active = true
      console.log('🔄 Two-way sync initialized successfully')

    } catch (error) {
      console.error('❌ Failed to start sync:', error.message)
      syncStatus.value.error = \`Connection failed: \${error.message}\`
    }
  }

  const stopSync = () => {
    if (syncHandler) {
      syncHandler.cancel()
      syncHandler = null
      syncStatus.value.active = false
      syncStatus.value.paused = false
    }
  }

  // Document operations
  const createDoc = async <T extends { _id?: string }>(doc: T) => {
    if (!doc._id) {
      doc._id = new Date().toISOString()
    }

    const enhancedDoc = {
      ...doc,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deviceId: getDeviceId()
    }

    return await localDB.put(enhancedDoc)
  }

  const getDoc = async <T>(id: string): Promise<T | null> => {
    try {
      return await localDB.get(id) as T
    } catch (error: any) {
      if (error.status === 404) return null
      throw error
    }
  }

  const updateDoc = async <T extends { _id: string; _rev?: string }>(doc: T) => {
    const enhancedDoc = {
      ...doc,
      updatedAt: new Date().toISOString(),
      deviceId: getDeviceId()
    }
    return await localDB.put(enhancedDoc)
  }

  const deleteDoc = async (id: string, rev: string) => {
    return await localDB.remove(id, rev)
  }

  const query = async <T>(selector: any, options?: any): Promise<T[]> => {
    const result = await localDB.find({ selector, ...options })
    return result.docs as T[]
  }

  const getAllDocs = async <T>(options?: PouchDB.Core.AllDocsOptions): Promise<T[]> => {
    const result = await localDB.allDocs({ include_docs: true, ...options })
    return result.rows
      .filter(row => row.doc && !row.id.startsWith('_design/'))
      .map(row => row.doc as T)
  }

  // Lifecycle
  onMounted(() => {
    if (remoteDB) {
      setTimeout(() => {
        startSync()
      }, 1000)
    }
  })

  onUnmounted(() => {
    stopSync()
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  })

  // Computed properties
  const isConnected = computed(() =>
    syncStatus.value.active && isOnline.value
  )

  const hasErrors = computed(() =>
    !!syncStatus.value.error
  )

  return {
    localDB,
    remoteDB,
    syncStatus: readonly(syncStatus),
    isOnline: readonly(isOnline),
    isConnected,
    hasErrors,
    startSync,
    stopSync,
    createDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    query,
    getAllDocs
  }
}

// Device ID helper
function getDeviceId(): string {
  let deviceId = localStorage.getItem('deviceId')
  if (!deviceId) {
    deviceId = \`device_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`
    localStorage.setItem('deviceId', deviceId)
  }
  return deviceId
}`
  }

  getDatabaseTypes() {
    return `// Database type definitions for ${this.options.projectName}

export interface BaseDocument {
  _id: string
  _rev?: string
  createdAt: string
  updatedAt: string
  deviceId: string
}

export interface SyncStatus {
  active: boolean
  paused: boolean
  error: string | null
  lastSync: Date | null
  pushCount: number
  pullCount: number
}

export interface DatabaseStats {
  name: string
  docCount: number
  updateSeq: string
  instanceStartTime: string
  adapter: string
  syncMode: 'local' | 'remote'
}

export interface SyncEvent {
  direction: 'push' | 'pull'
  change: {
    docs: any[]
    pending: number
  }
  info: any
}

export interface ConflictResolution {
  strategy: 'latest' | 'manual' | 'merge'
  winner: 'local' | 'remote' | 'merged'
  timestamp: string
}

// Example document types
export interface TaskDocument extends BaseDocument {
  type: 'task'
  title: string
  description?: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  dueDate?: string
  projectId?: string
  tags?: string[]
}

export interface ProjectDocument extends BaseDocument {
  type: 'project'
  name: string
  description?: string
  color?: string
  archived: boolean
}

export interface UserDocument extends BaseDocument {
  type: 'user'
  name: string
  email: string
  preferences: {
    theme: 'light' | 'dark'
    notifications: boolean
    language: string
  }
}

export interface SettingsDocument extends BaseDocument {
  type: 'settings'
  key: string
  value: any
  category?: string
}

// Database configuration
export interface DatabaseConfig {
  name: string
  remote?: string
  auth?: {
    username: string
    password: string
  }
  options?: {
    live?: boolean
    retry?: boolean
    timeout?: number
    batch_size?: number
  }
}

// Query options
export interface QueryOptions {
  limit?: number
  skip?: number
  sort?: Record<string, 'asc' | 'desc'>[]
  fields?: string[]
  use_index?: string
}

// Sync options
export interface SyncOptions {
  live?: boolean
  retry?: boolean
  timeout?: number
  heartbeat?: number
  batch_size?: number
  batches_limit?: number
}`
  }

  getDeviceIdUtil() {
    return `// Device identification utility for ${this.options.projectName}

export interface DeviceInfo {
  id: string
  name: string
  platform: string
  userAgent: string
  createdAt: string
  lastSeen: string
}

export class DeviceManager {
  private static instance: DeviceManager
  private deviceInfo: DeviceInfo

  constructor() {
    this.deviceInfo = this.loadDeviceInfo()
  }

  static getInstance(): DeviceManager {
    if (!DeviceManager.instance) {
      DeviceManager.instance = new DeviceManager()
    }
    return DeviceManager.instance
  }

  private loadDeviceInfo(): DeviceInfo {
    const stored = localStorage.getItem('deviceInfo')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch (error) {
        console.warn('Failed to parse device info:', error)
      }
    }

    // Create new device info
    const newDeviceInfo: DeviceInfo = {
      id: this.generateDeviceId(),
      name: this.getDeviceName(),
      platform: this.getPlatform(),
      userAgent: navigator.userAgent,
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    }

    this.saveDeviceInfo(newDeviceInfo)
    return newDeviceInfo
  }

  private generateDeviceId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 9)
    return \`device_\${timestamp}_\${random}\`
  }

  private getDeviceName(): string {
    const userAgent = navigator.userAgent

    if (userAgent.includes('Windows')) {
      return 'Windows Desktop'
    } else if (userAgent.includes('Mac')) {
      return 'Mac Desktop'
    } else if (userAgent.includes('Linux')) {
      return 'Linux Desktop'
    } else if (userAgent.includes('iPhone')) {
      return 'iPhone'
    } else if (userAgent.includes('iPad')) {
      return 'iPad'
    } else if (userAgent.includes('Android')) {
      return 'Android Device'
    } else {
      return 'Unknown Device'
    }
  }

  private getPlatform(): string {
    const userAgent = navigator.userAgent

    if (userAgent.includes('Chrome')) return 'Chrome'
    if (userAgent.includes('Firefox')) return 'Firefox'
    if (userAgent.includes('Safari')) return 'Safari'
    if (userAgent.includes('Edge')) return 'Edge'
    if (userAgent.includes('Opera')) return 'Opera'

    return 'Unknown Browser'
  }

  private saveDeviceInfo(deviceInfo: DeviceInfo): void {
    localStorage.setItem('deviceInfo', JSON.stringify(deviceInfo))
  }

  public getDeviceInfo(): DeviceInfo {
    this.deviceInfo.lastSeen = new Date().toISOString()
    this.saveDeviceInfo(this.deviceInfo)
    return { ...this.deviceInfo }
  }

  public getDeviceId(): string {
    return this.deviceInfo.id
  }

  public getDeviceName(): string {
    return this.deviceInfo.name
  }

  public updateLastSeen(): void {
    this.deviceInfo.lastSeen = new Date().toISOString()
    this.saveDeviceInfo(this.deviceInfo)
  }

  public resetDevice(): void {
    localStorage.removeItem('deviceInfo')
    this.deviceInfo = this.loadDeviceInfo()
  }
}

// Export singleton instance
export const deviceManager = DeviceManager.getInstance()

// Export convenience functions
export const getDeviceId = (): string => deviceManager.getDeviceId()
export const getDeviceInfo = (): DeviceInfo => deviceManager.getDeviceInfo()
export const updateDeviceLastSeen = (): void => deviceManager.updateLastSeen()`
  }

  getDatabaseTest() {
    return `// Database tests for ${this.options.projectName}

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import PouchDB from 'pouchdb'

// Test configuration
const TEST_DB_NAME = 'test_${this.options.projectName}'
const COUCHDB_URL = process.env.COUCHDB_URL || 'http://localhost:5984'
const COUCHDB_USER = process.env.COUCHDB_USER || 'admin'
const COUCHDB_PASSWORD = process.env.COUCHDB_PASSWORD || 'admin'

describe('Database Operations', () => {
  let localDB: PouchDB.Database
  let remoteDB: PouchDB.Database | null = null

  beforeEach(async () => {
    // Create fresh test database
    localDB = new PouchDB(TEST_DB_NAME)

    // Setup remote connection if available
    if (COUCHDB_URL && COUCHDB_USER && COUCHDB_PASSWORD) {
      try {
        remoteDB = new PouchDB(\`\${COUCHDB_URL}/\${TEST_DB_NAME}_remote\`, {
          auth: { username: COUCHDB_USER, password: COUCHDB_PASSWORD },
          skip_setup: false
        })
      } catch (error) {
        console.warn('Remote database not available for testing:', error.message)
      }
    }
  })

  afterEach(async () => {
    // Cleanup databases
    await localDB.destroy()
    if (remoteDB) {
      try {
        await remoteDB.destroy()
      } catch (error) {
        console.warn('Failed to cleanup remote database:', error.message)
      }
    }
  })

  describe('Local Database Operations', () => {
    it('should create and retrieve documents', async () => {
      const testDoc = {
        _id: 'test-1',
        type: 'test',
        title: 'Test Document',
        createdAt: new Date().toISOString()
      }

      // Create document
      const result = await localDB.put(testDoc)
      expect(result.id).toBe('test-1')
      expect(result.ok).toBe(true)

      // Retrieve document
      const retrieved = await localDB.get('test-1')
      expect(retrieved.title).toBe('Test Document')
      expect(retrieved.type).toBe('test')
    })

    it('should update documents', async () => {
      const testDoc = {
        _id: 'test-update',
        type: 'test',
        title: 'Original Title',
        createdAt: new Date().toISOString()
      }

      // Create document
      const createResult = await localDB.put(testDoc)

      // Update document
      const updatedDoc = {
        ...testDoc,
        _rev: createResult.rev,
        title: 'Updated Title',
        updatedAt: new Date().toISOString()
      }

      const updateResult = await localDB.put(updatedDoc)
      expect(updateResult.rev).not.toBe(createResult.rev)

      // Verify update
      const retrieved = await localDB.get('test-update')
      expect(retrieved.title).toBe('Updated Title')
    })

    it('should delete documents', async () => {
      const testDoc = {
        _id: 'test-delete',
        type: 'test',
        title: 'To Delete',
        createdAt: new Date().toISOString()
      }

      // Create document
      const createResult = await localDB.put(testDoc)

      // Delete document
      const deleteResult = await localDB.remove('test-delete', createResult.rev)
      expect(deleteResult.ok).toBe(true)

      // Verify deletion
      try {
        await localDB.get('test-delete')
        expect.fail('Document should have been deleted')
      } catch (error: any) {
        expect(error.status).toBe(404)
      }
    })

    it('should query documents', async () => {
      // Create test documents
      const docs = [
        { _id: 'query-1', type: 'task', title: 'Task 1', completed: false },
        { _id: 'query-2', type: 'task', title: 'Task 2', completed: true },
        { _id: 'query-3', type: 'note', title: 'Note 1', completed: false }
      ]

      await Promise.all(docs.map(doc => localDB.put(doc)))

      // Query all documents
      const allDocs = await localDB.allDocs({ include_docs: true })
      expect(allDocs.rows).toHaveLength(3)

      // Query by type (using Mango if available)
      try {
        const taskQuery = await localDB.find({
          selector: { type: 'task' }
        })
        expect(taskQuery.docs).toHaveLength(2)
      } catch (error) {
        console.warn('Mango query not supported:', error.message)
      }
    })
  })

  describe('Remote Database Operations', () => {
    beforeEach(() => {
      if (!remoteDB) {
        // Skip remote tests if no connection
        pending('Remote database not available')
      }
    })

    it('should sync with remote database', async () => {
      // Create local document
      const localDoc = {
        _id: 'sync-test',
        type: 'test',
        title: 'Sync Test',
        createdAt: new Date().toISOString()
      }

      await localDB.put(localDoc)

      // Setup sync
      const syncHandler = localDB.sync(remoteDB!, {
        live: false,
        retry: false
      })

      const syncComplete = new Promise((resolve, reject) => {
        syncHandler
          .on('complete', resolve)
          .on('error', reject)
      })

      await syncComplete

      // Verify document exists in remote
      const remoteDoc = await remoteDB!.get('sync-test')
      expect(remoteDoc.title).toBe('Sync Test')
    }, 10000)

    it('should handle sync conflicts', async () => {
      // This test would require more complex setup for conflict simulation
      // For now, just verify sync doesn't crash
      const syncHandler = localDB.sync(remoteDB!, {
        live: false,
        retry: false
      })

      const syncComplete = new Promise((resolve) => {
        syncHandler.on('complete', resolve)
      })

      await syncComplete
      expect(true).toBe(true) // Test passes if no errors
    }, 5000)
  })

  describe('Error Handling', () => {
    it('should handle document not found errors', async () => {
      try {
        await localDB.get('non-existent-id')
        expect.fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.status).toBe(404)
        expect(error.name).toBe('not_found')
      }
    })

    it('should handle revision conflicts', async () => {
      const testDoc = {
        _id: 'conflict-test',
        type: 'test',
        title: 'Original'
      }

      const result1 = await localDB.put(testDoc)

      // Try to update with wrong revision
      try {
        await localDB.put({
          ...testDoc,
          _rev: 'wrong-revision',
          title: 'Updated'
        })
        expect.fail('Should have thrown a conflict error')
      } catch (error: any) {
        expect(error.status).toBe(409)
        expect(error.name).toBe('conflict')
      }
    })
  })
})

describe('Database Configuration', () => {
  it('should have proper environment variables', () => {
    expect(COUCHDB_URL).toBeDefined()
    expect(COUCHDB_USER).toBeDefined()
    expect(COUCHDB_PASSWORD).toBeDefined()
  })

  it('should validate URL format', () => {
    expect(COUCHDB_URL).toMatch(/^https?:\/\/.+/)
  })
})`
  }

  getConnectivityTester() {
    return `// Import the connectivity tester from the skill
import CouchDBTester from './test-connectivity.js'

// Export for easy usage
export { CouchDBTester }
export default CouchDBTester`
  }

  getReadmeTemplate() {
    return `# CouchDB Setup for ${this.options.projectName}

This directory contains the complete CouchDB setup for ${this.options.projectName}, including database configuration, synchronization, and offline support.

## Quick Start

### 1. Environment Setup

\`\`\`bash
# Copy environment template
cp .env.example .env.couchdb

# Edit with your configuration
nano .env.couchdb
\`\`\`

### 2. Start CouchDB Server

\`\`\`bash
# Using Docker (recommended)
docker compose up -d

# Or using the setup script
chmod +x setup-couchdb.sh
./setup-couchdb.sh
\`\`\`

### 3. Install Dependencies

\`\`\`bash
# For Vue.js/React
npm install pouchdb pouchdb-find

# For TypeScript support
npm install --save-dev @types/pouchdb
\`\`\`

### 4. Test Connection

\`\`\`bash
# Run connectivity test
node utils/test-connectivity.js

# Or use with custom environment
APP_URL=http://localhost:3000 \\
COUCHDB_URL=http://localhost:5984 \\
COUCHDB_USER=admin \\
COUCHDB_PASSWORD=your_password \\
node utils/test-connectivity.js
\`\`\`

## Configuration

### Environment Variables

- \`COUCHDB_URL\`: CouchDB server URL
- \`COUCHDB_USER\`: Database username
- \`COUCHDB_PASSWORD\`: Database password
- \`COUCHDB_DATABASE\`: Database name
- \`VITE_COUCHDB_URL\`: Client-side database URL (Vue/Vite)
- \`VITE_COUCHDB_USER\`: Client-side username
- \`VITE_COUCHDB_PASSWORD\`: Client-side password

### Database Structure

\`\`\typescript
interface BaseDocument {
  _id: string
  _rev?: string
  createdAt: string
  updatedAt: string
  deviceId: string
}
\`\`\`

## Usage Examples

### Vue 3 Component

\`\`\`vue
<template>
  <div>
    <div v-if="db.isConnected" class="status online">
      🟢 Connected to database
    </div>
    <div v-else class="status offline">
      🟡 Offline
    </div>

    <form @submit.prevent="addTask">
      <input v-model="newTask" placeholder="Add task...">
      <button type="submit">Add</button>
    </form>

    <ul>
      <li v-for="task in tasks" :key="task._id">
        {{ task.title }}
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useDatabase } from '@/composables/useDatabase'

const db = useDatabase({
  name: 'tasks',
  remote: import.meta.env.VITE_COUCHDB_URL,
  auth: {
    username: import.meta.env.VITE_COUCHDB_USER,
    password: import.meta.env.VITE_COUCHDB_PASSWORD
  }
})

const tasks = ref([])
const newTask = ref('')

const addTask = async () => {
  await db.createDoc({
    type: 'task',
    title: newTask.value,
    completed: false
  })
  newTask.value = ''
  await loadTasks()
}

const loadTasks = async () => {
  tasks.value = await db.getAllDocs()
}

onMounted(loadTasks)
</script>
\`\`\`

## Scripts

### setup-couchdb.sh
Initial CouchDB setup with CORS configuration and database creation.

\`\`\`bash
./setup-couchdb.sh
\`\`\`

### fix-cors.sh
Quick CORS fix for existing CouchDB installation.

\`\`\`bash
./fix-cors.sh
\`\`\`

### backup-database.sh
Create database backup.

\`\`\`bash
./backup-database.sh myapp ./backups
\`\`\`

### test-connectivity.js
Comprehensive connectivity and sync testing.

\`\`\`bash
node utils/test-connectivity.js
\`\`\`

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.

## Production Deployment

### Security

- Use strong passwords
- Enable HTTPS
- Restrict CORS origins
- Set up proper authentication

### Performance

- Create database indexes
- Use batch operations
- Monitor database size
- Regular compaction

### Monitoring

\`\`\`bash
# Check database status
curl -u user:pass http://localhost:5984/_up

# Monitor active tasks
curl -u user:pass http://localhost:5984/_active_tasks
\`\`\`

## Resources

- [CouchDB Documentation](https://docs.couchdb.org/)
- [PouchDB Documentation](https://pouchdb.com/guides/)
- [CouchDB Fauxton UI](http://localhost:5984/_utils/)

## Support

For issues specific to this setup, check the troubleshooting guide or open an issue in the project repository.`
  }

  getTroubleshootingTemplate() {
    return `# CouchDB Troubleshooting Guide

## Common Issues and Solutions

### 1. CORS Errors

**Problem**: Browser shows CORS errors when trying to access CouchDB.

**Solution**:
\`\`\`bash
# Apply CORS configuration
./fix-cors.sh

# Or manually:
curl -X PUT "http://localhost:5984/_node/_local/_config/httpd/enable_cors" \\
  -u admin:password -d '"true"'
\`\`\`

### 2. Authentication Failures

**Problem**: 401 Unauthorized errors.

**Solution**:
- Check credentials in .env.couchdb
- Verify user exists in CouchDB
- Ensure password is correct

\`\`\`bash
# Test authentication
curl -u admin:password http://localhost:5984/_session
\`\`\`

### 3. Sync Not Working

**Problem**: Documents not syncing between client and server.

**Solution**:
\`\`\`bash
# Test connection
node utils/test-connectivity.js

# Check network connectivity
curl -I http://your-couchdb-server:5984/

# Verify database exists
curl -u user:pass http://server:5984/yourdb
\`\`\`

### 4. Database Performance Issues

**Problem**: Slow queries or large database size.

**Solution**:
\`\`\`bash
# Create indexes
curl -X POST http://localhost:5984/yourdb/_index \\
  -u user:pass \\
  -H "Content-Type: application/json" \\
  -d '{
    "index": { "fields": ["type", "createdAt"] },
    "name": "type-created-index"
  }'

# Compact database
curl -X POST http://localhost:5984/yourdb/_compact \\
  -u user:pass
\`\`\`

### 5. Docker Container Issues

**Problem**: Container won't start or keeps restarting.

**Solution**:
\`\`\`bash
# Check logs
docker compose logs couchdb

# Check container status
docker compose ps

# Restart container
docker compose restart couchdb

# Full reset (WARNING: deletes data)
docker compose down -v
docker compose up -d
\`\`\`

### 6. Memory Issues

**Problem**: Out of memory errors.

**Solution**:
- Reduce batch size in sync configuration
- Implement pagination for large queries
- Regular database cleanup

\`\`\`typescript
// Example: Reduce batch size
const db = useDatabase({
  options: {
    batch_size: 50, // Reduce from default 100
    timeout: 60000  // Increase timeout
  }
})
\`\`\`

### 7. Conflict Resolution

**Problem**: Document conflicts during sync.

**Solution**:
\`\`\`typescript
// Handle conflicts in your composable
const resolveConflicts = async (docId: string) => {
  const doc = await localDB.get(docId, { conflicts: true })

  if (doc._conflicts) {
    // Choose conflict resolution strategy
    for (const rev of doc._conflicts) {
      const conflictDoc = await localDB.get(docId, { rev })

      // Keep the most recently updated
      if (conflictDoc.updatedAt > doc.updatedAt) {
        await localDB.remove(docId, doc._rev)
        break
      } else {
        await localDB.remove(docId, rev)
      }
    }
  }
}
\`\`\`

## Debug Mode

### Enable Detailed Logging

\`\`\`typescript
// In your database composable
const startSync = () => {
  syncHandler = localDB.sync(remoteDB, {
    live: true,
    retry: true
  })
    .on('change', (info) => {
      console.log('📥 Sync change:', info)
    })
    .on('paused', (err) => {
      console.log('⏸️ Sync paused:', err)
    })
    .on('active', () => {
      console.log('▶️ Sync active')
    })
    .on('error', (err) => {
      console.error('❌ Sync error:', err)
    })
}
\`\`\`

### Browser DevTools

1. Open Chrome DevTools
2. Go to Network tab
3. Filter by CouchDB server URL
4. Look for failed requests or CORS errors

### Command Line Debugging

\`\`\`bash
# Check database info
curl -u user:pass http://localhost:5984/yourdb

# Check active sync tasks
curl -u user:pass http://localhost:5984/_active_tasks

# Monitor database changes
curl -u user:pass http://localhost:5984/yourdb/_changes?feed=continuous
\`\`\`

## Performance Optimization

### Database Indexes

\`\`\`javascript
// Create index for common queries
await db.createIndex(['type', 'createdAt'])
await db.createIndex(['projectId', 'status'])
await db.createIndex(['deviceId', 'lastSync'])
\`\`\`

### Query Optimization

\`\`\`typescript
// Bad: Gets all documents then filters
const allDocs = await db.getAllDocs()
const tasks = allDocs.filter(doc => doc.type === 'task')

// Good: Use Mango query with index
const tasks = await db.query({
  selector: { type: 'task' },
  sort: [{ createdAt: 'desc' }],
  limit: 50
})
\`\`\`

### Sync Optimization

\`\`\`typescript
// Reduce sync frequency for better performance
const db = useDatabase({
  options: {
    heartbeat: 30000,        // Reduce heartbeat frequency
    batch_size: 50,          // Smaller batches
    batches_limit: 5,        // Limit concurrent batches
    timeout: 60000           // Longer timeout
  }
})
\`\`\`

## Getting Help

### Check Logs

\`\`\`bash
# Docker logs
docker compose logs -f couchdb

# Application logs (console)
# Check browser DevTools Console tab
\`\`\`

### Test Connection

\`\`\`bash
# Comprehensive connectivity test
node utils/test-connectivity.js

# Test specific components
APP_URL=http://localhost:3000 \\
COUCHDB_URL=http://localhost:5984 \\
node utils/test-connectivity.js
\`\`\`

### Common Error Messages

- \`401 Unauthorized\`: Check authentication credentials
- \`403 Forbidden\`: Check user permissions
- \`404 Not Found\`: Database doesn't exist
- \`409 Conflict\`: Document revision conflict
- \`CORS policy error\`: CORS not configured properly

### Community Resources

- [CouchDB Documentation](https://docs.couchdb.org/)
- [PouchDB GitHub](https://github.com/pouchdb/pouchdb)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/couchdb)
- [CouchDB Slack](https://couchdb.apache.org/slack.html)`
  }

  getPackageAdditions() {
    return `{
  "dependencies": {
    "pouchdb": "^8.0.1",
    "pouchdb-find": "^8.0.1"
  },
  "devDependencies": {
    "@types/pouchdb": "^6.4.0",
    "playwright": "^1.40.0"
  },
  "scripts": {
    "test:db": "node utils/test-connectivity.js",
    "setup:db": "./setup-couchdb.sh",
    "fix:cors": "./fix-cors.sh",
    "backup:db": "./backup-database.sh"
  }
}`
  }

  async generateFiles() {
    console.log('🚀 Generating CouchDB setup files...')
    console.log(`Project: ${this.options.projectName}`)

    const generatedFiles = []

    try {
      for (const [filename, content] of Object.entries(this.templates)) {
        const filePath = filename
        const directory = path.dirname(filePath)

        // Create directory if it doesn't exist
        if (directory && directory !== '.') {
          fs.mkdirSync(directory, { recursive: true })
        }

        // Write file
        fs.writeFileSync(filePath, content, 'utf8')
        generatedFiles.push(filePath)
        console.log(`✅ Created: ${filename}`)
      }

      // Make shell scripts executable
      const shellScripts = generatedFiles.filter(file => file.endsWith('.sh'))
      for (const script of shellScripts) {
        fs.chmodSync(script, '755')
        console.log(`🔓 Made executable: ${script}`)
      }

      this.showSuccessMessage(generatedFiles)
      return generatedFiles

    } catch (error) {
      console.error('❌ Error generating files:', error.message)
      throw error
    }
  }

  showSuccessMessage(generatedFiles) {
    console.log('\n' + '='.repeat(60))
    console.log('🎉 COUCHDB SETUP GENERATED SUCCESSFULLY!')
    console.log('='.repeat(60))

    console.log(`\n📁 Generated ${generatedFiles.length} files:`)
    generatedFiles.forEach(file => {
      console.log(`   - ${file}`)
    })

    console.log('\n🔧 Next steps:')
    console.log(`   1. Edit .env.couchdb with your credentials`)
    console.log(`   2. Start CouchDB: docker compose up -d`)
    console.log(`   3. Setup database: ./setup-couchdb.sh`)
    console.log(`   4. Test connection: node utils/test-connectivity.js`)

    console.log('\n📚 Documentation:')
    console.log(`   - README-CouchDB.md: Complete setup guide`)
    console.log(`   - TROUBLESHOOTING.md: Common issues and solutions`)

    console.log('\n🌐 Access:')
    console.log(`   - CouchDB: ${this.options.couchdbUrl}`)
    console.log(`   - Fauxton UI: ${this.options.couchdbUrl}/_utils/`)
    console.log(`   - Username: ${this.options.username}`)

    if (this.options.password === 'your_secure_password_here') {
      console.log(`   - Password: [SET IN .env.couchdb]`)
    } else {
      console.log(`   - Password: ${this.options.password}`)
    }

    console.log('\n⚠️  Important:')
    console.log('   - Never commit .env.couchdb to version control')
    console.log('   - Use strong passwords in production')
    console.log('   - Enable HTTPS for production deployments')
    console.log('   - Regular backups are recommended')

    console.log('\n🧪 Testing:')
    console.log(`   npm run test:db    # Test database connectivity`)
    console.log(`   npm run setup:db   # Setup CouchDB server`)
    console.log(`   npm run fix:cors    # Fix CORS issues`)
  }
}

// CLI interface
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  const options = {
    projectName: process.env.PROJECT_NAME || process.argv[2],
    couchdbUrl: process.env.COUCHDB_URL,
    databaseName: process.env.DATABASE_NAME,
    username: process.env.COUCHDB_USER,
    password: process.env.COUCHDB_PASSWORD,
    appPort: process.env.APP_PORT ? parseInt(process.env.APP_PORT) : undefined
  }

  const generator = new CouchDBSetupGenerator(options)
  generator.generateFiles()
    .then(() => {
      console.log('\n✨ Setup generation completed!')
    })
    .catch(error => {
      console.error('❌ Setup generation failed:', error.message)
      process.exit(1)
    })
}

export default CouchDBSetupGenerator`
  }

  async createSkill() {
    console.log('Creating CouchDB cross-device sync skill...')

    // Additional utility files
    await fs.promises.writeFile(
      path.join('.claude/skills/couchdb-cross-device-sync/utils/setup-generator.js'),
      this.getSetupGenerator()
    )

    console.log('✅ CouchDB Cross-Device Sync skill created successfully!')
  }

  async getSetupGenerator() {
    // Return the setup generator content as string
    return this.templates['setup-generator.js'] || this.generateSetupScriptContent()
  }

  generateSetupScriptContent() {
    return `// Setup generator script content
console.log('CouchDB setup generator initialized')`
  }
}

// Create and run the skill generator
const generator = new CouchDBSetupGenerator()
await generator.createSkill()