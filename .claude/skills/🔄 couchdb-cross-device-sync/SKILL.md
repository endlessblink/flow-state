---
name: couchdb-cross-device-sync
description: This skill enables seamless cross-device synchronization using CouchDB (server) and PouchDB (client) for offline-first Vue 3 applications with real-time sync and conflict resolution.
---

# CouchDB Cross-Device Sync Skill

**For: Claude Code IDE**
**Version:** 1.0
**Updated:** November 2025
**Category:** Database, Synchronization, Vue.js

## Overview

This skill enables seamless cross-device synchronization using CouchDB (server) and PouchDB (client) for offline-first applications. Perfect for Vue 3 apps requiring real-time data sync across devices with robust offline support.

### What You'll Build

- **Production CouchDB Server** on Contabo VPS with Docker
- **PouchDB Client** integration with Vue 3 composables
- **Real-time bidirectional sync** with conflict resolution
- **Offline-first architecture** with automatic reconnection
- **Secure authentication** using environment variables

### Tech Stack

- **Server:** CouchDB 3.3+ (Docker)
- **Client:** PouchDB 8.0+
- **Framework:** Vue 3 Composition API
- **VPS:** Contabo Cloud VPS
- **Security:** CORS, Basic Auth, HTTPS ready

---

## When to Use This Skill

Use this skill when you need to:

✅ **Set up CouchDB server** on Contabo VPS or local development
✅ **Configure Vue 3 + PouchDB** for offline-first sync
✅ **Fix CORS issues** with CouchDB/PouchDB
✅ **Debug sync problems** between client and server
✅ **Test database connectivity** and authentication
✅ **Implement real-time sync** with conflict resolution
✅ **Create production-ready** cross-device synchronization

### Common Scenarios

- "Help me setup CouchDB on my Contabo VPS"
- "Fix CORS errors with CouchDB"
- "Create a Vue 3 composable for PouchDB sync"
- "Test my CouchDB connection"
- "Implement offline-first todo app"
- "Debug sync issues between devices"

---

## Core Implementation Patterns

### 1. Vue 3 PouchDB Composable

```typescript
// src/composables/useDatabase.ts
import { ref, onMounted, onUnmounted } from 'vue'
import PouchDB from 'pouchdb'
import PouchDBFind from 'pouchdb-find'

PouchDB.plugin(PouchDBFind)

export interface SyncStatus {
  active: boolean
  paused: boolean
  error: string | null
  lastSync: Date | null
}

export function useDatabase(dbName: string) {
  const localDB = new PouchDB(dbName)
  const remoteDB = new PouchDB(
    `${import.meta.env.VITE_COUCHDB_URL}/${dbName}`,
    {
      auth: {
        username: import.meta.env.VITE_COUCHDB_USER,
        password: import.meta.env.VITE_COUCHDB_PASSWORD
      },
      skip_setup: false
    }
  )

  const syncStatus = ref<SyncStatus>({
    active: false,
    paused: false,
    error: null,
    lastSync: null
  })

  let syncHandler: PouchDB.Replication.Sync<any> | null = null

  const startSync = () => {
    syncHandler = localDB.sync(remoteDB, {
      live: true,
      retry: true,
      heartbeat: 10000,
      timeout: 30000
    })
      .on('change', (info) => {
        console.log('Sync change:', info)
        syncStatus.value.lastSync = new Date()
      })
      .on('paused', (err) => {
        syncStatus.value.paused = true
        syncStatus.value.active = false
        if (err) syncStatus.value.error = err.message
      })
      .on('active', () => {
        syncStatus.value.active = true
        syncStatus.value.paused = false
        syncStatus.value.error = null
      })
      .on('error', (err) => {
        syncStatus.value.error = err.message
      })

    syncStatus.value.active = true
  }

  // Document operations (create, read, update, delete, query)
  const createDoc = async <T extends { _id?: string }>(doc: T) => {
    if (!doc._id) doc._id = new Date().toISOString()
    return await localDB.put(doc)
  }

  const getDoc = async <T>(id: string): Promise<T | null> => {
    try {
      return await localDB.get(id) as T
    } catch (error: any) {
      if (error.status === 404) return null
      throw error
    }
  }

  // ... other operations

  return {
    localDB,
    remoteDB,
    syncStatus,
    startSync,
    createDoc,
    getDoc,
    // ... other methods
  }
}
```

### 2. CouchDB Docker Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  couchdb:
    image: couchdb:3.3
    container_name: couchdb-sync
    restart: always
    ports:
      - "5984:5984"
    environment:
      - COUCHDB_USER=${COUCHDB_USER}
      - COUCHDB_PASSWORD=${COUCHDB_PASSWORD}
    volumes:
      - couchdb-data:/opt/couchdb/data
    networks:
      - couchdb-network

volumes:
  couchdb-data:
    driver: local

networks:
  couchdb-network:
    driver: bridge
```

### 3. CORS Configuration

```bash
# Enable CORS for CouchDB
curl -X PUT "http://localhost:5984/_node/_local/_config/httpd/enable_cors" \
  -u admin:password -d '"true"'

curl -X PUT "http://localhost:5984/_node/_local/_config/cors/origins" \
  -u admin:password -d '"*"'

curl -X PUT "http://localhost:5984/_node/_local/_config/cors/credentials" \
  -u admin:password -d '"true"'

curl -X PUT "http://localhost:5984/_node/_local/_config/cors/methods" \
  -u admin:password -d '"GET, PUT, POST, HEAD, DELETE, OPTIONS"'

curl -X PUT "http://localhost:5984/_node/_local/_config/cors/headers" \
  -u admin:password -d '"accept, authorization, content-type, origin, referer, x-csrf-token, x-requested-with"'
```

### 4. Environment Configuration

```typescript
// .env.local
VITE_COUCHDB_URL=http://your-vps-ip:5984/pomoflow-tasks
VITE_COUCHDB_USER=admin
VITE_COUCHDB_PASSWORD=your_secure_password
VITE_COUCHDB_AUTH=true

// src/env.d.ts
interface ImportMetaEnv {
  readonly VITE_COUCHDB_URL: string
  readonly VITE_COUCHDB_USER: string
  readonly VITE_COUCHDB_PASSWORD: string
  readonly VITE_COUCHDB_AUTH: string
}
```

---

## Skill Activation Triggers

This skill automatically activates when you mention:

- "couchdb" or "pouchdb"
- "cross device sync" or "offline-first"
- "cors" with "couchdb"
- "database sync" with "vue"
- "contabo vps" with "database"
- "remote database" for vue apps

---

## Quick Solutions

### Fix CORS Issues (Most Common)

```bash
# Method 1: Manual curl commands
curl -X PUT "http://your-server:5984/_node/_local/_config/httpd/enable_cors" \
  -u admin:password -d '"true"'

# Method 2: npm package
npm install -g add-cors-to-couchdb
add-cors-to-couchdb http://your-server:5984 -u admin -p password
```

### Test Database Connectivity

```javascript
// Quick connection test
const testConnection = async () => {
  try {
    const response = await fetch('http://your-server:5984/', {
      headers: {
        'Authorization': 'Basic ' + btoa('admin:password')
      }
    })
    const info = await response.json()
    console.log('✅ CouchDB connected:', info.version)
  } catch (error) {
    console.error('❌ Connection failed:', error.message)
  }
}
```

### Debug Sync Problems

```typescript
// Add detailed sync logging
const startSync = () => {
  syncHandler = localDB.sync(remoteDB, { live: true, retry: true })
    .on('change', (info) => console.log('📥 Sync change:', info))
    .on('paused', (err) => console.log('⏸️ Sync paused:', err))
    .on('active', () => console.log('▶️ Sync active'))
    .on('error', (err) => console.error('❌ Sync error:', err))
}
```

---

## Implementation Workflow

When this skill is activated:

1. **Assessment**: Identify current setup (VPS, local, existing config)
2. **Server Setup**: Configure CouchDB with proper CORS and security
3. **Client Integration**: Set up PouchDB composable for Vue 3
4. **Testing**: Verify connectivity and sync functionality
5. **Debugging**: Troubleshoot any CORS, auth, or sync issues
6. **Production**: Secure setup for production deployment

---

## File Patterns

### Generated Files
- `docker-compose.yml` - CouchDB server configuration
- `.env.local` - Environment variables
- `src/composables/useDatabase.ts` - Vue 3 PouchDB composable
- `fix-cors.sh` - CORS configuration script
- `test-connectivity.mjs` - Database connectivity test

### Modified Files
- `package.json` - Add PouchDB dependencies
- `src/main.ts` - Database initialization
- `.gitignore` - Exclude sensitive files

---

## Testing Strategy

### 1. Server Testing
- Verify CouchDB is accessible
- Test authentication credentials
- Confirm CORS configuration

### 2. Client Testing
- Test PouchDB initialization
- Verify sync establishment
- Test document operations

### 3. Integration Testing
- End-to-end sync verification
- Offline/online transition testing
- Multi-device sync validation

---

## Security Best Practices

- ✅ Use strong passwords (32+ characters)
- ✅ Enable HTTPS in production
- ✅ Restrict CORS origins to your domain
- ✅ Use database-level permissions
- ✅ Never commit credentials to Git
- ✅ Implement rate limiting
- ✅ Regular backups of CouchDB volumes

---

## Troubleshooting Guide

### Common Issues & Solutions

**CORS Errors**: Apply CORS configuration to server
**Authentication Failures**: Verify credentials in .env.local
**Sync Not Starting**: Check network connectivity and server URL
**Document Conflicts**: Implement conflict resolution strategy
**Performance Issues**: Create indexes and use efficient queries

### Debug Commands

```bash
# Check CouchDB status
curl http://localhost:5984/_up

# Test database access
curl -u admin:password http://localhost:5984/mydb

# Check CORS config
curl -u admin:password http://localhost:5984/_node/_local/_config/cors
```

---

## Production Deployment

### VPS Setup (Contabo)
1. Install Docker and Docker Compose
2. Set up firewall and security
3. Deploy CouchDB container
4. Configure SSL with Nginx
5. Set up monitoring and backups

### Vue.js App Configuration
1. Use production environment variables
2. Enable secure authentication
3. Implement error handling
4. Add sync status indicators
5. Set up proper logging

---

## Quick Reference

### Essential Commands
```bash
# Start CouchDB container
docker compose up -d

# Apply CORS configuration
add-cors-to-couchdb http://server:5984 -u admin -p pass

# Test database
curl -u admin:password http://server:5984/db_name
```

### Key Files
- `src/composables/useDatabase.ts` - Main PouchDB composable
- `.env.local` - Environment configuration
- `docker-compose.yml` - Server setup
- `fix-cors.sh` - CORS fix script

---

## Related Skills

- **vue-pwa-offline-sync** - PWA integration with offline sync
- **database-migration** - Schema migrations for CouchDB
- **real-time-collaboration** - Multi-user real-time features
- **backup-automation** - Automated database backups

---

**This skill provides production-ready CouchDB/PouchDB synchronization for Vue 3 applications with comprehensive testing, debugging, and deployment workflows.**

---

## MANDATORY USER VERIFICATION REQUIREMENT

### Policy: No Fix Claims Without User Confirmation

**CRITICAL**: Before claiming ANY issue, bug, or problem is "fixed", "resolved", "working", or "complete", the following verification protocol is MANDATORY:

#### Step 1: Technical Verification
- Run all relevant tests (build, type-check, unit tests)
- Verify no console errors
- Take screenshots/evidence of the fix

#### Step 2: User Verification Request
**REQUIRED**: Use the `AskUserQuestion` tool to explicitly ask the user to verify the fix:

```
"I've implemented [description of fix]. Before I mark this as complete, please verify:
1. [Specific thing to check #1]
2. [Specific thing to check #2]
3. Does this fix the issue you were experiencing?

Please confirm the fix works as expected, or let me know what's still not working."
```

#### Step 3: Wait for User Confirmation
- **DO NOT** proceed with claims of success until user responds
- **DO NOT** mark tasks as "completed" without user confirmation
- **DO NOT** use phrases like "fixed", "resolved", "working" without user verification

#### Step 4: Handle User Feedback
- If user confirms: Document the fix and mark as complete
- If user reports issues: Continue debugging, repeat verification cycle

### Prohibited Actions (Without User Verification)
- Claiming a bug is "fixed"
- Stating functionality is "working"
- Marking issues as "resolved"
- Declaring features as "complete"
- Any success claims about fixes

### Required Evidence Before User Verification Request
1. Technical tests passing
2. Visual confirmation via Playwright/screenshots
3. Specific test scenarios executed
4. Clear description of what was changed

**Remember: The user is the final authority on whether something is fixed. No exceptions.**
