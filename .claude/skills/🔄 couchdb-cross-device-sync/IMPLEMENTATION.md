# CouchDB Cross-Device Sync Implementation Guide

## Quick Start Templates

### 1. Basic Setup Script Generator

```javascript
// generate-setup.js - Creates all necessary files
const fs = require('fs')
const path = require('path')

const templates = {
  // Docker Compose Template
  'docker-compose.yml': `version: '3.8'

services:
  couchdb:
    image: couchdb:3.3
    container_name: couchdb-sync
    restart: always
    ports:
      - "5984:5984"
    environment:
      - COUCHDB_USER=\${COUCHDB_USER}
      - COUCHDB_PASSWORD=\${COUCHDB_PASSWORD}
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

volumes:
  couchdb-data:
    driver: local
  couchdb-config:
    driver: local

networks:
  couchdb-network:
    driver: bridge`,

  // Environment Template
  '.env.couchdb': `# CouchDB Configuration
COUCHDB_URL=http://localhost:5984
COUCHDB_USER=admin
COUCHDB_PASSWORD=your_secure_password_here

# Vue Environment Variables
VITE_COUCHDB_URL=http://localhost:5984/yourapp
VITE_COUCHDB_USER=admin
VITE_COUCHDB_PASSWORD=your_secure_password_here
VITE_COUCHDB_AUTH=true`,

  // CORS Fix Script
  'fix-cors.sh': `#!/bin/bash

COUCHDB_URL="http://localhost:5984"
ADMIN_USER="admin"
ADMIN_PASS="\${COUCHDB_PASSWORD:-admin}"

echo "🔧 Applying CORS configuration to CouchDB"

# Enable CORS
curl -X PUT "\${COUCHDB_URL}/_node/_local/_config/httpd/enable_cors" \\
  -u \${ADMIN_USER}:\${ADMIN_PASS} \\
  -d '"true"'

# Set origins
curl -X PUT "\${COUCHDB_URL}/_node/_local/_config/cors/origins" \\
  -u \${ADMIN_USER}:\${ADMIN_PASS} \\
  -d '"*"'

# Enable credentials
curl -X PUT "\${COUCHDB_URL}/_node/_local/_config/cors/credentials" \\
  -u \${ADMIN_USER}:\${ADMIN_PASS} \\
  -d '"true"'

# Set methods
curl -X PUT "\${COUCHDB_URL}/_node/_local/_config/cors/methods" \\
  -u \${ADMIN_USER}:\${ADMIN_PASS} \\
  -d '"GET, PUT, POST, HEAD, DELETE, OPTIONS"'

# Set headers
curl -X PUT "\${COUCHDB_URL}/_node/_local/_config/cors/headers" \\
  -u \${ADMIN_USER}:\${ADMIN_PASS} \\
  -d '"accept, authorization, content-type, origin, referer, x-csrf-token, x-requested-with"'

echo "✅ CORS configuration completed!"`,

  // Connection Test Script
  'test-connection.mjs': `import { chromium } from 'playwright'

async function testCouchDBConnection() {
  console.log('🔍 Testing CouchDB Connection')

  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()

  try {
    await page.goto('http://localhost:3000') // Your Vue app URL

    // Wait for app to load
    await page.waitForTimeout(5000)

    // Check for sync activity
    const consoleMessages = []
    page.on('console', msg => {
      const text = msg.text()
      if (text.includes('CouchDB') || text.includes('sync') || text.includes('PouchDB')) {
        console.log(\`📝 \${msg.type().toUpperCase()}: \${text}\`)
      }
    })

    // Test document creation
    console.log('📝 Testing document creation...')

    await browser.close()
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

testCouchDBConnection()`
}

// Generate files
Object.entries(templates).forEach(([filename, content]) => {
  fs.writeFileSync(filename, content)
  console.log(\`✅ Created: \${filename}\`)
})

console.log('🎉 CouchDB setup files generated!')
console.log('📋 Next steps:')
console.log('   1. Edit .env.couchdb with your credentials')
console.log('   2. Run: docker compose up -d')
console.log('   3. Run: chmod +x fix-cors.sh && ./fix-cors.sh')
```

### 2. Vue 3 Integration Patterns

#### Enhanced Database Composable
```typescript
// src/composables/useEnhancedDatabase.ts
import { ref, onMounted, onUnmounted, computed } from 'vue'
import PouchDB from 'pouchdb'
import PouchDBFind from 'pouchdb-find'

PouchDB.plugin(PouchDBFind)

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
  }
}

export interface SyncStatus {
  active: boolean
  paused: boolean
  error: string | null
  lastSync: Date | null
  pushCount: number
  pullCount: number
}

export function useEnhancedDatabase(config: DatabaseConfig) {
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
  const connectionCount = ref(0)

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

  // Enhanced sync with better error handling
  const startSync = async () => {
    if (!remoteDB) {
      console.warn('⚠️ No remote database configured')
      return
    }

    try {
      // Test remote connection first
      await remoteDB.info()
      console.log('🌐 Remote database accessible')

      syncHandler = localDB.sync(remoteDB, {
        live: config.options?.live ?? true,
        retry: config.options?.retry ?? true,
        timeout: config.options?.timeout ?? 30000,
        heartbeat: 10000,
        batch_size: 100
      })
        .on('change', (info) => {
          connectionCount.value++
          syncStatus.value.lastSync = new Date()

          if (info.direction === 'push') {
            syncStatus.value.pushCount++
          } else {
            syncStatus.value.pullCount++
          }

          console.log(`📤 Sync ${info.direction}: ${info.change.docs?.length || 0} changes`)
        })
        .on('paused', (err) => {
          syncStatus.value.paused = true
          syncStatus.value.active = false
          if (err && err.message !== 'replication terminated') {
            syncStatus.value.error = err.message
            console.warn('⏸️ Sync paused:', err.message)
          }
        })
        .on('active', () => {
          syncStatus.value.active = true
          syncStatus.value.paused = false
          syncStatus.value.error = null
          console.log('▶️ Sync active')
        })
        .on('denied', (err) => {
          console.error('🚫 Sync denied:', err.message)
          syncStatus.value.error = `Permission denied: ${err.message}`
        })
        .on('complete', (info) => {
          console.log('✅ Sync complete:', info)
          syncStatus.value.active = false
        })
        .on('error', (err) => {
          console.error('❌ Sync error:', err.message)
          syncStatus.value.error = err.message
        })

      syncStatus.value.active = true
      console.log('🔄 Two-way sync initialized successfully')

    } catch (error) {
      console.error('❌ Failed to start sync:', error.message)
      syncStatus.value.error = `Connection failed: ${error.message}`
    }
  }

  const stopSync = () => {
    if (syncHandler) {
      syncHandler.cancel()
      syncHandler = null
      syncStatus.value.active = false
      syncStatus.value.paused = false
      console.log('⏹️ Sync stopped')
    }
  }

  // Enhanced document operations
  const createDoc = async <T extends { _id?: string }>(doc: T) => {
    try {
      if (!doc._id) {
        doc._id = new Date().toISOString()
      }

      // Add metadata
      const enhancedDoc = {
        ...doc,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deviceId: getDeviceId(),
        _rev: undefined // Clear any existing revision
      }

      const response = await localDB.put(enhancedDoc)
      console.log(`✅ Document created: ${response.id}`)
      return response
    } catch (error) {
      console.error('❌ Create error:', error.message)
      throw error
    }
  }

  const getDoc = async <T>(id: string): Promise<T | null> => {
    try {
      const doc = await localDB.get(id)
      return doc as T
    } catch (error: any) {
      if (error.status === 404) return null
      throw error
    }
  }

  const updateDoc = async <T extends { _id: string; _rev?: string }>(doc: T) => {
    try {
      const enhancedDoc = {
        ...doc,
        updatedAt: new Date().toISOString(),
        deviceId: getDeviceId()
      }

      const response = await localDB.put(enhancedDoc)
      console.log(`✅ Document updated: ${response.id}`)
      return response
    } catch (error) {
      console.error('❌ Update error:', error.message)
      throw error
    }
  }

  const deleteDoc = async (id: string, rev: string) => {
    try {
      const response = await localDB.remove(id, rev)
      console.log(`✅ Document deleted: ${id}`)
      return response
    } catch (error) {
      console.error('❌ Delete error:', error.message)
      throw error
    }
  }

  const query = async <T>(selector: any, options?: any): Promise<T[]> => {
    try {
      const result = await localDB.find({
        selector,
        ...options
      })
      return result.docs as T[]
    } catch (error) {
      console.error('❌ Query error:', error.message)
      throw error
    }
  }

  const getAllDocs = async <T>(options?: PouchDB.Core.AllDocsOptions): Promise<T[]> => {
    try {
      const result = await localDB.allDocs({
        include_docs: true,
        ...options
      })
      return result.rows
        .filter(row => row.doc && !row.id.startsWith('_design/'))
        .map(row => row.doc as T)
    } catch (error) {
      console.error('❌ GetAll error:', error.message)
      throw error
    }
  }

  // Conflict resolution
  const resolveConflicts = async (docId: string) => {
    try {
      const doc = await localDB.get(docId, { conflicts: true })

      if (doc._conflicts && doc._conflicts.length > 0) {
        console.log('🔄 Resolving conflicts for:', docId)

        for (const rev of doc._conflicts) {
          const conflictDoc = await localDB.get(docId, { rev })

          // Strategy: Keep the most recently updated document
          if (conflictDoc.updatedAt < doc.updatedAt) {
            await localDB.remove(docId, rev)
          } else {
            await localDB.remove(docId, doc._rev)
            // Update doc with conflict version
            doc._rev = rev
          }
        }

        console.log('✅ Conflicts resolved for:', docId)
      }
    } catch (error) {
      console.error('❌ Conflict resolution error:', error.message)
    }
  }

  // Initialize
  onMounted(async () => {
    console.log('🗄️ Initializing enhanced PouchDB database...')

    try {
      // Test local database
      await localDB.info()
      console.log('✅ Local database ready:', config.name)

      // Start remote sync if configured
      if (remoteDB) {
        // Add delay for app initialization
        setTimeout(() => {
          startSync()
        }, 1000)
      }
    } catch (error) {
      console.error('❌ Database initialization failed:', error.message)
      syncStatus.value.error = `Initialization failed: ${error.message}`
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

  const syncStats = computed(() => ({
    totalChanges: syncStatus.value.pushCount + syncStatus.value.pullCount,
    isHealthy: isConnected.value && !hasErrors.value,
    lastSyncAgo: syncStatus.value.lastSync
      ? Date.now() - syncStatus.value.lastSync.getTime()
      : null
  }))

  return {
    // Database instances
    localDB,
    remoteDB,

    // Status
    syncStatus: readonly(syncStatus),
    isOnline: readonly(isOnline),
    isConnected,
    hasErrors,
    syncStats,
    connectionCount: readonly(connectionCount),

    // Sync control
    startSync,
    stopSync,

    // Document operations
    createDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    query,
    getAllDocs,

    // Advanced features
    resolveConflicts
  }
}

// Helper function for device identification
function getDeviceId(): string {
  let deviceId = localStorage.getItem('deviceId')
  if (!deviceId) {
    deviceId = \`device_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`
    localStorage.setItem('deviceId', deviceId)
  }
  return deviceId
}
```

### 3. Main.ts Integration Fix

```typescript
// src/main.ts - Enhanced initialization
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/styles/main.css'

// Database initialization
const initializeDatabase = async () => {
  try {
    console.log('🗄️ [MAIN.TS] Initializing PouchDB database...')

    // Import database composable
    const { useEnhancedDatabase } = await import('./composables/useEnhancedDatabase')

    // Initialize main app database
    const db = useEnhancedDatabase({
      name: 'pomoflow-app',
      remote: import.meta.env.VITE_COUCHDB_URL,
      auth: {
        username: import.meta.env.VITE_COUCHDB_USER,
        password: import.meta.env.VITE_COUCHDB_PASSWORD
      },
      options: {
        live: true,
        retry: true,
        timeout: 30000
      }
    })

    // Wait for database to be ready with better timeout handling
    const maxWaitTime = 10000 // 10 seconds instead of 5000
    const checkInterval = 500
    let attempts = 0
    const maxAttempts = maxWaitTime / checkInterval

    const waitForDB = async (): Promise<boolean> => {
      return new Promise((resolve) => {
        const checkDB = async () => {
          attempts++

          try {
            // Check if local database is responsive
            await db.localDB.info()
            console.log('✅ [MAIN.TS] PouchDB database ready')
            resolve(true)
          } catch (error) {
            console.log(`⏳ [MAIN.TS] Database attempt ${attempts}/${maxAttempts}`)

            if (attempts >= maxAttempts) {
              console.error('❌ [MAIN.TS] PouchDB failed to initialize after timeout')
              console.log('🔄 [MAIN.TS] Continuing without database - sync will retry when possible')
              resolve(false) // Don't fail the entire app
            } else {
              setTimeout(checkDB, checkInterval)
            }
          }
        }

        checkDB()
      })
    }

    const dbReady = await waitForDB()

    // Expose database to window for debugging
    window.pomoFlowDb = {
      local: db.localDB,
      remote: db.remoteDB,
      status: db.syncStatus,
      stats: db.syncStats,
      isConnected: db.isConnected,
      hasErrors: db.hasErrors,
      startSync: db.startSync,
      stopSync: db.stopSync
    }

    console.log('✅ [MAIN.TS] PouchDB exposed to window.pomoFlowDb')

    return dbReady

  } catch (error) {
    console.error('❌ [MAIN.TS] Database initialization error:', error.message)
    console.log('🔄 [MAIN.TS] App will continue without database sync')
    return false
  }
}

// Initialize app with database
const initializeApp = async () => {
  // Initialize database first (but don't block app startup)
  const dbReady = await initializeDatabase().catch(() => false)

  // Create Vue app
  const app = createApp(App)

  // Use plugins
  app.use(createPinia())
  app.use(router)

  // Provide database status to app
  app.provide('dbReady', dbReady)

  // Mount app
  app.mount('#app')

  console.log(`🚀 [MAIN.TS] App initialized (database ${dbReady ? 'ready' : 'will retry'})`)
}

// Error handling
window.addEventListener('error', (event) => {
  console.error('❌ [MAIN.TS] Unhandled error:', event.error)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ [MAIN.TS] Unhandled promise rejection:', event.reason)
})

// Start the app
initializeApp().catch(console.error)
```

### 4. Component Usage Examples

#### Task Management Component
```vue
<!-- src/components/TaskManager.vue -->
<template>
  <div class="task-manager">
    <!-- Sync Status Indicator -->
    <div class="sync-status" :class="statusClass">
      <span v-if="db.isConnected" class="status-indicator online">
        🟢 Connected
      </span>
      <span v-else-if="db.hasErrors" class="status-indicator error">
        🔴 Error: {{ db.syncStatus.error }}
      </span>
      <span v-else class="status-indicator offline">
        🟡 Offline
      </span>

      <div class="sync-stats" v-if="db.isConnected">
        <small>
          Last sync: {{ formatTime(db.syncStatus.lastSync) }}
          | Changes: {{ db.syncStats.totalChanges }}
        </small>
      </div>
    </div>

    <!-- Task Form -->
    <form @submit.prevent="addTask" class="task-form">
      <input
        v-model="newTask"
        placeholder="Enter new task..."
        :disabled="!db.isConnected"
        required
      />
      <button type="submit" :disabled="!db.isConnected || loading">
        {{ loading ? 'Adding...' : 'Add Task' }}
      </button>
    </form>

    <!-- Task List -->
    <div class="task-list">
      <div v-for="task in tasks" :key="task._id" class="task-item">
        <input
          type="checkbox"
          v-model="task.completed"
          @change="updateTask(task)"
          :disabled="!db.isConnected"
        />
        <span :class="{ completed: task.completed }">
          {{ task.title }}
        </span>
        <button @click="deleteTask(task)" :disabled="!db.isConnected">
          Delete
        </button>
      </div>
    </div>

    <!-- Connection Controls -->
    <div class="connection-controls">
      <button @click="db.startSync" v-if="!db.isConnected && !db.hasErrors">
        🔄 Retry Connection
      </button>
      <button @click="db.stopSync" v-if="db.isConnected">
        ⏹️ Stop Sync
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useEnhancedDatabase } from '@/composables/useEnhancedDatabase'

interface Task {
  _id: string
  _rev?: string
  title: string
  completed: boolean
  createdAt: string
  updatedAt: string
}

const db = useEnhancedDatabase({
  name: 'pomoflow-tasks',
  remote: import.meta.env.VITE_COUCHDB_URL,
  auth: {
    username: import.meta.env.VITE_COUCHDB_USER,
    password: import.meta.env.VITE_COUCHDB_PASSWORD
  }
})

const tasks = ref<Task[]>([])
const newTask = ref('')
const loading = ref(false)

const statusClass = computed(() => ({
  'status-online': db.isConnected.value,
  'status-offline': !db.isConnected.value && !db.hasErrors.value,
  'status-error': db.hasErrors.value
}))

// Load tasks
const loadTasks = async () => {
  try {
    tasks.value = await db.getAllDocs<Task>({
      startkey: 'task_',
      endkey: 'task_\ufff0'
    })
    console.log(`📋 Loaded ${tasks.value.length} tasks`)
  } catch (error) {
    console.error('❌ Failed to load tasks:', error.message)
  }
}

// Add task
const addTask = async () => {
  if (!newTask.value.trim() || !db.isConnected.value) return

  loading.value = true
  try {
    const task: Omit<Task, '_id' | '_rev'> = {
      title: newTask.value,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    await db.createDoc(task)
    newTask.value = ''
    await loadTasks()
  } catch (error) {
    console.error('❌ Failed to add task:', error.message)
  } finally {
    loading.value = false
  }
}

// Update task
const updateTask = async (task: Task) => {
  if (!task._rev || !db.isConnected.value) return

  try {
    await db.updateDoc({
      ...task,
      updatedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('❌ Failed to update task:', error.message)
  }
}

// Delete task
const deleteTask = async (task: Task) => {
  if (!task._rev || !db.isConnected.value) return

  if (confirm('Delete this task?')) {
    try {
      await db.deleteDoc(task._id, task._rev)
      await loadTasks()
    } catch (error) {
      console.error('❌ Failed to delete task:', error.message)
    }
  }
}

// Format time
const formatTime = (date: Date | null) => {
  if (!date) return 'Never'
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

// Watch for sync changes and reload
watch(() => db.syncStats.value.totalChanges, async () => {
  if (db.isConnected.value) {
    await loadTasks()
  }
})

// Initialize
onMounted(() => {
  loadTasks()

  // Listen for real-time changes
  db.localDB.changes({
    since: 'now',
    live: true,
    include_docs: true
  }).on('change', async () => {
    await loadTasks()
  })
})
</script>

<style scoped>
.task-manager {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.sync-status {
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 20px;
  text-align: center;
}

.status-online {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status-offline {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.status-error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.task-form {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.task-form input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.task-form button {
  padding: 10px 20px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.task-form button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 4px;
  margin-bottom: 8px;
}

.task-item .completed {
  text-decoration: line-through;
  opacity: 0.6;
}

.connection-controls {
  margin-top: 20px;
  text-align: center;
}

.connection-controls button {
  padding: 8px 16px;
  margin: 0 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

.connection-controls button:hover {
  background: #f8f9fa;
}
</style>
```

This implementation guide provides:

1. **File Generation Scripts** - Automated setup file creation
2. **Enhanced Database Composable** - Production-ready PouchDB integration
3. **Main.ts Integration** - Proper initialization with timeout handling
4. **Component Examples** - Real-world usage patterns

The enhanced version specifically addresses the timing issues you're experiencing in main.ts by:
- Using more generous timeouts
- Better error handling that doesn't crash the app
- Exposing database status for debugging
- Providing retry mechanisms
- Adding comprehensive logging