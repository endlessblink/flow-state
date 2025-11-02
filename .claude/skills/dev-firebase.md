# Firebase Development Skill

**🔧 SKILL ACTIVATED: Firebase Development**

You are working with Firebase authentication and Firestore database integration for the Pomo-Flow application.

## Project Structure

### Two Development Environments:

**Main App (Port 5546):**
- Location: `/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow`
- Branch: `feature/groups-vs-sections-wizard` (or current working branch)
- Purpose: Stable development, main UI work
- Firebase: May or may not have Firebase features

**Firebase Worktree (Port 5547):**
- Location: `/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow-firebase`
- Branch: `firebase-integration`
- Purpose: Safe Firebase testing without affecting main work
- Firebase: Always has latest Firebase auth and database features

## Critical Rules

### 🚨 ALWAYS Use Worktree for Firebase Development
- **All Firebase changes** must be made in the worktree at `../pomo-flow-firebase/`
- **Test auth features** at `http://localhost:5547` (worktree)
- **Never break the main app** on port 5546
- **Commit to firebase-integration branch** in the worktree
- **Merge back to main** only when features are fully tested and stable

### 🚨 Port Management
- Main app: **5546** (stable work)
- Firebase worktree: **5547** (auth testing)
- Always verify correct port when making Firebase changes
- Check which directory you're in before file operations

### 🚨 Firebase Package Installation
If Firebase imports fail in worktree:
```bash
cd "/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow-firebase"
npm install firebase
```

## Firebase Architecture

### Authentication (`src/stores/auth.ts`)
```typescript
// Auth Store Pattern
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isLoading = ref(true)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!user.value)

  // Sign in methods
  async function signInWithGoogle() { /* ... */ }
  async function signInWithEmail(email: string, password: string) { /* ... */ }

  // Sign out
  async function signOut() { /* ... */ }

  // Auth state listener
  function initAuthListener() {
    onAuthStateChanged(auth, (firebaseUser) => {
      user.value = firebaseUser
      isLoading.value = false
    })
  }

  return {
    user,
    isLoading,
    error,
    isAuthenticated,
    signInWithGoogle,
    signInWithEmail,
    signOut,
    initAuthListener
  }
})
```

### Firebase Configuration (`src/config/firebase.ts`)
```typescript
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  // Configuration from environment variables
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  // ... other config
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
```

### Database Adapter Pattern (`src/composables/useDatabaseAdapter.ts`)
Abstraction layer for easy migration between Firebase, Supabase, PocketBase:

```typescript
export interface DatabaseAdapter {
  readonly name: string
  readonly version: string
  tasks: TaskDatabaseAdapter
  projects: ProjectDatabaseAdapter
  canvas: CanvasDatabaseAdapter
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
  ping(): Promise<boolean>
}

// Firebase implementation
export class FirebaseAdapter implements DatabaseAdapter {
  // User-scoped data: users/{userId}/{collection}
  tasks: FirebaseTaskAdapter
  projects: FirebaseProjectAdapter
  canvas: FirebaseCanvasAdapter
}
```

## Component Patterns

### UserProfile Component (`src/components/auth/UserProfile.vue`)
- Location: Top-left header (before timer)
- Shows: User avatar (Google photo or email initial)
- Dropdown: Email, Settings, Sign Out
- Only visible when `authStore.isAuthenticated`

```vue
<template>
  <div class="user-profile">
    <button @click="toggleDropdown" class="user-avatar-button">
      <div class="avatar-circle">
        <img v-if="authStore.user?.photoURL" :src="authStore.user.photoURL" />
        <span v-else>{{ userInitial }}</span>
      </div>
    </button>

    <div v-if="isDropdownOpen" class="user-dropdown">
      <!-- User info and sign out -->
    </div>
  </div>
</template>
```

### AuthModal Component (`src/components/auth/AuthModal.vue`)
- Auto-closes when `authStore.isAuthenticated` becomes true
- Watcher pattern:
```typescript
watch(() => authStore.isAuthenticated, (isAuth) => {
  if (isAuth && uiStore.authModalOpen) {
    uiStore.closeAuthModal()
  }
})
```

### Router Guards (`src/router/index.ts`)
```typescript
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)

  if (requiresAuth) {
    // Wait for auth initialization
    if (authStore.isLoading) {
      while (authStore.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    if (!authStore.isAuthenticated) {
      // Only open modal if not already open
      if (!uiStore.authModalOpen) {
        uiStore.openAuthModal('login', to.fullPath)
      }
    }
  }
  next()
})
```

## Firestore Data Structure

### User-Scoped Collections
All data is scoped under `users/{userId}/`:
- `users/{userId}/tasks/` - User's tasks
- `users/{userId}/projects/` - User's projects
- `users/{userId}/canvas/state` - Canvas layout data
- `users/{userId}/profile/main` - User profile settings

### Batch Operations
```typescript
async saveTasks(userId: string, tasks: Task[]): Promise<void> {
  const batchSize = 500  // Firebase max
  const batches = []

  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = writeBatch(db)
    const batchTasks = tasks.slice(i, i + batchSize)

    for (const task of batchTasks) {
      const taskRef = doc(db, 'users', userId, 'tasks', task.id)
      batch.set(taskRef, { ...task, updatedAt: serverTimestamp() })
    }

    batches.push(batch.commit())
  }

  await Promise.all(batches)
}
```

### Real-Time Subscriptions
```typescript
subscribeToTasks(userId: string, callback: (tasks: Task[]) => void): () => void {
  const tasksRef = collection(db, 'users', userId, 'tasks')

  const unsubscribe = onSnapshot(tasksRef, (snapshot) => {
    const tasks: Task[] = []
    snapshot.forEach((doc) => {
      tasks.push({ ...doc.data(), id: doc.id } as Task)
    })
    callback(tasks)
  })

  return unsubscribe  // Call this to stop listening
}
```

## Testing Workflow

### 1. Development in Worktree
```bash
cd /mnt/d/MY\ PROJECTS/AI/LLM/AI\ Code\ Gen/my-builds/Productivity/pomo-flow-firebase
npm run dev  # Port 5547
```

### 2. Test at http://localhost:5547
- Sign in with Google
- Test UserProfile dropdown
- Test sign out
- Verify auth state persistence
- Check console logs for debug info

### 3. Commit in Worktree
```bash
cd /mnt/d/MY\ PROJECTS/AI/LLM/AI\ Code\ Gen/my-builds/Productivity/pomo-flow-firebase
git add .
git commit -m "feat(auth): description"
```

### 4. Merge to Main (When Stable)
```bash
cd /mnt/d/MY\ PROJECTS/AI/LLM/AI\ Code\ Gen/my-builds/Productivity/pomo-flow
git merge firebase-integration
```

## Debug Console Logs

Watch for these logs when testing:
- `👤 User profile dropdown toggled`
- `🔴 Sign out clicked`
- `✅ Signed out successfully`
- `🛣️ Router guard check`
- `👁️ Auth state changed in modal`
- `✅ User is now authenticated, auto-closing modal`

## Common Issues

### Issue: Firebase imports fail
**Solution:** Install Firebase in worktree:
```bash
cd /mnt/d/MY\ PROJECTS/AI/LLM/AI\ Code\ Gen/my-builds/Productivity/pomo-flow-firebase
npm install firebase
```

### Issue: Auth store not found
**Solution:** Copy from main branch:
```bash
cp /mnt/d/MY\ PROJECTS/.../pomo-flow/src/stores/auth.ts \
   /mnt/d/MY\ PROJECTS/.../pomo-flow-firebase/src/stores/
```

### Issue: Modal won't close after sign-in
**Check:**
1. Watcher in AuthModal.vue is active
2. Router guard checks `uiStore.authModalOpen` before opening
3. `authStore.isAuthenticated` is actually true after sign-in
4. Console shows auto-close logs

### Issue: Port 5547 not responding
**Solution:** Restart dev server:
```bash
cd /mnt/d/MY\ PROJECTS/.../pomo-flow-firebase
npm run dev
```

## Environment Variables

Required in `.env.local` (worktree):
```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

## Firebase Free Tier Limits

**Firestore:**
- 50,000 reads/day
- 20,000 writes/day
- 20,000 deletes/day
- 1 GB storage

**Authentication:**
- Unlimited sign-ins (Google OAuth, Email/Password)

**Hosting:**
- 10 GB storage
- 360 MB/day bandwidth

**Region:** `eur3` (Europe - optimized for Israel)

## Best Practices

1. **Always work in worktree for Firebase changes**
2. **Test thoroughly before merging to main**
3. **Use batch operations for multiple writes**
4. **Clean up subscriptions on component unmount**
5. **Handle offline state gracefully**
6. **Use IndexedDB as primary storage** (Firebase as backup/sync)
7. **Debug with console logs** (emoji markers for easy identification)
8. **Check auth state before Firestore operations**

---

**Remember:** Firebase worktree = Safe testing environment. Main app = Stable work. Never break the main app while testing Firebase features!
