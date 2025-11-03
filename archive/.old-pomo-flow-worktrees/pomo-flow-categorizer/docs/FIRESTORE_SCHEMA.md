# Firestore Data Schema

## Overview
This document describes the Firestore database schema for Pomo-Flow, including collections, documents, and their fields.

---

## Collection Structure

```
users/{userId}
├── tasks/{taskId}
├── projects/{projectId}
└── settings/{settingId}
```

All data is scoped to individual users. Each user can only access their own data.

---

## 📝 Collections

### 1. `users/{userId}`

**Description**: User profile and metadata

**Document ID**: Firebase Auth UID

**Fields**:
```typescript
interface User {
  uid: string                    // Firebase Auth UID
  email: string                  // User email
  displayName: string | null     // User display name (from auth)
  photoURL: string | null        // Profile picture URL (from Google auth)
  locale: 'en' | 'he'           // Preferred language
  theme: 'light' | 'dark'       // Preferred theme
  createdAt: Timestamp          // Account creation date
  updatedAt: Timestamp          // Last update
  lastLoginAt: Timestamp        // Last login timestamp
}
```

**Example**:
```json
{
  "uid": "abc123xyz",
  "email": "user@example.com",
  "displayName": "John Doe",
  "photoURL": "https://lh3.googleusercontent.com/...",
  "locale": "en",
  "theme": "dark",
  "createdAt": "2025-10-24T10:30:00Z",
  "updatedAt": "2025-10-24T15:45:00Z",
  "lastLoginAt": "2025-10-24T15:45:00Z"
}
```

---

### 2. `users/{userId}/tasks/{taskId}`

**Description**: User's tasks with full Pomo-Flow data

**Document ID**: UUID (generated client-side)

**Fields**:
```typescript
interface Task {
  id: string                           // Task UUID
  userId: string                       // Owner user ID (for security rules)
  title: string                        // Task title
  description: string                  // Task description (markdown)
  status: 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold'
  priority: 'low' | 'medium' | 'high' | null
  progress: number                     // 0-100 percentage
  completedPomodoros: number          // Number of completed pomodoro sessions
  estimatedPomodoros: number | null   // AI-estimated pomodoro count
  dueDate: string | null              // ISO date string
  dueDateTimestamp: Timestamp | null  // For querying/sorting
  projectId: string | null            // Reference to project
  parentTaskId: string | null         // For subtasks
  tags: string[]                      // Task tags

  // Calendar scheduling (new system)
  instances: TaskInstance[]           // Multiple calendar occurrences

  // Canvas positioning
  canvasPosition: {
    x: number
    y: number
  } | null
  canvasSectionId: string | null     // Which canvas section it belongs to

  // Task dependencies
  dependsOn: string[]                 // Task IDs this task depends on

  // Metadata
  createdAt: Timestamp
  updatedAt: Timestamp
  completedAt: Timestamp | null

  // Backward compatibility (deprecated, use instances instead)
  scheduledDate?: string | null
  scheduledTime?: string | null
}

interface TaskInstance {
  id: string                          // Instance UUID
  date: string                        // ISO date string
  time: string | null                 // Time in HH:mm format
  duration: number | null             // Duration in minutes
  completedPomodoros: number          // Pomodoros for this instance
  completed: boolean
  type: 'scheduled' | 'later'        // "later" for indefinite scheduling
}
```

**Example**:
```json
{
  "id": "task-uuid-123",
  "userId": "abc123xyz",
  "title": "Implement Firebase authentication",
  "description": "Add Google Sign-In and Email/Password auth to the app",
  "status": "in_progress",
  "priority": "high",
  "progress": 45,
  "completedPomodoros": 3,
  "estimatedPomodoros": 8,
  "dueDate": "2025-10-25",
  "dueDateTimestamp": "2025-10-25T00:00:00Z",
  "projectId": "project-123",
  "parentTaskId": null,
  "tags": ["development", "authentication"],
  "instances": [
    {
      "id": "instance-1",
      "date": "2025-10-24",
      "time": "14:00",
      "duration": 120,
      "completedPomodoros": 3,
      "completed": true,
      "type": "scheduled"
    },
    {
      "id": "instance-2",
      "date": "2025-10-25",
      "time": "10:00",
      "duration": 180,
      "completedPomodoros": 0,
      "completed": false,
      "type": "scheduled"
    }
  ],
  "canvasPosition": {
    "x": 150,
    "y": 300
  },
  "canvasSectionId": "section-high-priority",
  "dependsOn": [],
  "createdAt": "2025-10-24T09:00:00Z",
  "updatedAt": "2025-10-24T15:45:00Z",
  "completedAt": null
}
```

**Indexes** (automatically created by Firebase):
- `userId + status + updatedAt` - For filtering by status
- `userId + priority + updatedAt` - For sorting by priority
- `userId + projectId + updatedAt` - For project views
- `userId + dueDate + updatedAt` - For calendar views

---

### 3. `users/{userId}/projects/{projectId}`

**Description**: User's projects for organizing tasks

**Document ID**: UUID (generated client-side)

**Fields**:
```typescript
interface Project {
  id: string                       // Project UUID
  userId: string                   // Owner user ID
  name: string                     // Project name
  description: string              // Project description
  color: string                    // Hex color code (#xxxxxx)
  icon: string | null              // Icon name (lucide icon)
  parentProjectId: string | null   // For nested projects
  isArchived: boolean              // Archived status
  order: number                    // Display order
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**Example**:
```json
{
  "id": "project-123",
  "userId": "abc123xyz",
  "name": "Pomo-Flow Development",
  "description": "Building the Pomo-Flow productivity app",
  "color": "#3B82F6",
  "icon": "code",
  "parentProjectId": null,
  "isArchived": false,
  "order": 1,
  "createdAt": "2025-10-01T00:00:00Z",
  "updatedAt": "2025-10-24T15:45:00Z"
}
```

---

### 4. `users/{userId}/settings/{settingId}`

**Description**: User preferences and settings

**Document IDs**:
- `timer` - Pomodoro timer settings
- `ui` - UI preferences
- `canvas` - Canvas view settings

**Fields**:
```typescript
interface TimerSettings {
  id: 'timer'
  userId: string
  workDuration: number          // Minutes (default: 25)
  shortBreakDuration: number   // Minutes (default: 5)
  longBreakDuration: number    // Minutes (default: 15)
  sessionsUntilLongBreak: number // (default: 4)
  autoStartBreaks: boolean     // Auto-start break timers
  autoStartPomodoros: boolean  // Auto-start next pomodoro
  notificationsEnabled: boolean
  soundEnabled: boolean
  soundVolume: number          // 0-100
  updatedAt: Timestamp
}

interface UISettings {
  id: 'ui'
  userId: string
  theme: 'light' | 'dark' | 'system'
  locale: 'en' | 'he'
  boardDensity: 'comfortable' | 'compact'
  defaultView: 'board' | 'calendar' | 'canvas' | 'all-tasks'
  sidebarCollapsed: boolean
  updatedAt: Timestamp
}

interface CanvasSettings {
  id: 'canvas'
  userId: string
  snapToGrid: boolean
  gridSize: number
  showMinimap: boolean
  defaultSections: CanvasSection[]
  updatedAt: Timestamp
}
```

**Example (Timer Settings)**:
```json
{
  "id": "timer",
  "userId": "abc123xyz",
  "workDuration": 25,
  "shortBreakDuration": 5,
  "longBreakDuration": 15,
  "sessionsUntilLongBreak": 4,
  "autoStartBreaks": false,
  "autoStartPomodoros": false,
  "notificationsEnabled": true,
  "soundEnabled": true,
  "soundVolume": 70,
  "updatedAt": "2025-10-24T15:45:00Z"
}
```

---

## 🔐 Security Rules

All data is protected by Firestore Security Rules that ensure:

1. **Authentication Required**: Users must be logged in to access any data
2. **User Scoping**: Users can only access their own data (`userId` must match `auth.uid`)
3. **Data Validation**: All writes must include correct `userId` and timestamp fields
4. **Deny by Default**: Any path not explicitly allowed is denied

See `firestore.rules` for the complete security rules implementation.

---

## 📊 Data Migration Strategy

### From IndexedDB to Firestore

When a user first logs in, their local IndexedDB data will be migrated to Firestore:

1. **Check if migration needed**: Compare IndexedDB vs Firestore data
2. **Upload local tasks**: Create Firestore documents for all local tasks
3. **Upload projects and settings**: Migrate project and settings data
4. **Mark migration complete**: Set a flag to prevent re-migration
5. **Keep IndexedDB as cache**: IndexedDB remains for offline support

**Migration Logic** (pseudocode):
```typescript
async function migrateToFirestore(userId: string) {
  // Get local data from IndexedDB
  const localTasks = await getLocalTasks()
  const localProjects = await getLocalProjects()

  // Check if already migrated
  const migrationFlag = await getFirestoreDoc(`users/${userId}/settings/migration`)
  if (migrationFlag?.completed) {
    return // Already migrated
  }

  // Batch upload to Firestore
  const batch = []
  localTasks.forEach(task => {
    batch.push({
      type: 'create',
      docId: task.id,
      data: { ...task, userId }
    })
  })

  await batchWrite(batch)

  // Mark migration complete
  await setDoc(`users/${userId}/settings/migration`, {
    completed: true,
    migratedAt: serverTimestamp()
  })
}
```

---

## 🔄 Sync Strategy

### Real-Time Sync

- **From Firestore to App**: Use `onSnapshot` listeners for real-time updates
- **From App to Firestore**: Optimistic updates with rollback on error
- **Conflict Resolution**: Last-write-wins based on `updatedAt` timestamp

### Offline Support

- **Firestore Offline Persistence**: Enabled via `enableMultiTabIndexedDbPersistence`
- **Local Cache**: IndexedDB serves as backup when offline
- **Automatic Sync**: Changes sync automatically when connection restored

---

## 💾 Storage Estimates

### Per User (Average):
- **Tasks**: ~100 tasks × 2 KB = 200 KB
- **Projects**: ~10 projects × 1 KB = 10 KB
- **Settings**: ~3 settings × 0.5 KB = 1.5 KB
- **Total**: ~212 KB per user

### For 100 users:
- **Total Storage**: ~21 MB (well within 1 GB free tier)

### Query Costs (Per User Per Day):
- **App Load**: 1 read (user doc) + ~100 reads (tasks) = 101 reads
- **Real-time Updates**: ~20-50 reads (as tasks change throughout day)
- **Daily Total**: ~150 reads per active user

**For 20 active users**: 3,000 reads/day (well within 50,000 free tier)

---

## 📈 Scaling Considerations

### When Free Tier is Not Enough

If you exceed free tier limits (unlikely for <100 users):

1. **Implement Pagination**: Load tasks in batches of 20
2. **Lazy Load Projects**: Only load projects when needed
3. **Cache Aggressively**: Use IndexedDB cache, reduce Firestore reads
4. **Debounce Writes**: Batch updates together
5. **Archive Old Tasks**: Move completed tasks older than 30 days to separate collection

---

**Last Updated**: October 24, 2025
