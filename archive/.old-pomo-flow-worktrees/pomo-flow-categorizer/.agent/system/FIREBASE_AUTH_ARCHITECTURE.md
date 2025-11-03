# Firebase Authentication Architecture

**Last Updated**: 2025-10-26
**Status**: Firebase Backend Complete | Authentication UI In Progress
**Branch**: `firebase-integration`

---

## Overview

Firebase Authentication integration for Pomo-Flow with multi-provider support (Email/Password + Google Sign-In), user-scoped data access, and seamless Pinia state management integration.

## Completed: Firebase Backend Setup ✅

### Firebase Project Configuration
- **Project ID**: `pomo-flow`
- **Region**: `eur3` (Europe West - optimized for Israel)
- **Firestore Edition**: Standard
- **Authentication Providers**:
  - Email/Password ✅
  - Google Sign-In ✅
  - Passwordless Email: Disabled (reduces mobile complexity)

### Security Architecture

**User-Scoped Data Model**:
```
firestore/
└── users/
    └── {userId}/           # Firebase Auth UID
        ├── tasks/          # User's tasks
        ├── projects/       # User's projects
        └── settings/       # User preferences
```

**Security Rules** (`firestore.rules`):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    match /users/{userId} {
      allow read, write: if isOwner(userId);

      match /tasks/{taskId} {
        allow read: if isOwner(userId);
        allow create: if isOwner(userId) && hasValidUserId();
        allow update, delete: if isOwner(userId);
      }
    }
  }
}
```

### Firestore Composable

**File**: `src/composables/useFirestore.ts`

**Features**:
- Type-safe CRUD operations with TypeScript generics
- Automatic user scoping (`users/{userId}/{collection}`)
- Real-time subscriptions with reactive refs
- Batch operations support
- Automatic timestamps (createdAt, updatedAt)
- Error handling with retry logic

**Example Usage**:
```typescript
const { data: tasks, loading, error, subscribe, create } = useFirestore<Task>('tasks')

// Subscribe to real-time updates
await subscribe()

// Create new task
await create({
  title: 'New Task',
  status: 'planned',
  priority: 'medium'
})
```

---

## Next: Authentication Implementation 🚧

### 1. Authentication Store (`src/stores/auth.ts`)

**State**:
```typescript
interface AuthState {
  user: User | null                    // Firebase User object
  profile: UserProfile | null          // Additional user data
  isAuthenticated: boolean             // Computed from user state
  isLoading: boolean                   // Auth state loading
  error: string | null                 // Auth error messages
}

interface UserProfile {
  uid: string
  email: string
  displayName: string | null
  photoURL: string | null
  createdAt: Date
  lastLoginAt: Date
  preferences: {
    language: 'en' | 'he'
    theme: 'light' | 'dark' | 'auto'
  }
}
```

**Actions**:
```typescript
// Email/Password authentication
async signUpWithEmail(email: string, password: string): Promise<void>
async signInWithEmail(email: string, password: string): Promise<void>

// Google Sign-In
async signInWithGoogle(): Promise<void>

// Password management
async sendPasswordResetEmail(email: string): Promise<void>
async updatePassword(newPassword: string): Promise<void>

// Profile management
async updateProfile(data: Partial<UserProfile>): Promise<void>

// Session management
async signOut(): Promise<void>
initAuthListener(): void  // Listen to auth state changes
```

**Auth State Persistence**:
- Firebase handles session persistence automatically
- Store user profile in `users/{userId}/profile` document
- Sync profile changes across devices via Firestore

### 2. Authentication UI Components

#### LoginForm.vue
**Location**: `src/components/auth/LoginForm.vue`

**Features**:
- Email/password input fields
- Form validation (email format, password min length)
- Error display (invalid credentials, network errors)
- "Forgot password" link
- "Sign up" navigation
- Loading states during authentication

**Props**:
```typescript
interface LoginFormProps {
  redirectTo?: string  // Route to redirect after login
}
```

**Emits**:
```typescript
interface LoginFormEmits {
  success: (user: User) => void
  switchToSignup: () => void
  forgotPassword: (email: string) => void
}
```

#### SignupForm.vue
**Location**: `src/components/auth/SignupForm.vue`

**Features**:
- Email, password, confirm password fields
- Display name input (optional)
- Password strength indicator
- Form validation (matching passwords, email uniqueness)
- Terms of service checkbox
- "Already have an account" navigation

**Validation Rules**:
- Email: Valid format, not already registered
- Password: Min 8 characters, contains uppercase, lowercase, number
- Confirm Password: Matches password field
- Display Name: Optional, max 50 characters

#### GoogleSignInButton.vue
**Location**: `src/components/auth/GoogleSignInButton.vue`

**Features**:
- Google branding guidelines compliance
- One-click sign-in
- Loading state during OAuth flow
- Error handling (popup blocked, OAuth errors)

**Integration**:
```typescript
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth'

const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({
    prompt: 'select_account'  // Always show account picker
  })

  try {
    const result = await signInWithPopup(auth, provider)
    // Handle successful sign-in
  } catch (error) {
    // Handle errors (popup blocked, cancelled, etc.)
  }
}
```

#### AuthModal.vue
**Location**: `src/components/auth/AuthModal.vue`

**Features**:
- Container for auth forms
- Tab switching (Login / Sign Up)
- Modal backdrop and animations
- Responsive design (mobile-friendly)
- Close button with confirmation (if form is dirty)

**State Management**:
```typescript
type AuthModalView = 'login' | 'signup' | 'reset-password'

interface AuthModalState {
  isOpen: boolean
  currentView: AuthModalView
  redirectAfterLogin?: string
}
```

### 3. Router Integration

**File**: `src/router/index.ts`

**Route Guards**:
```typescript
import { useAuthStore } from '@/stores/auth'

// Protect authenticated routes
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  // Public routes (allow unauthenticated access)
  const publicRoutes = ['/login', '/signup', '/reset-password']

  if (!authStore.isAuthenticated && !publicRoutes.includes(to.path)) {
    // Redirect to login, preserve intended destination
    next({
      path: '/login',
      query: { redirect: to.fullPath }
    })
  } else if (authStore.isAuthenticated && publicRoutes.includes(to.path)) {
    // Redirect authenticated users away from auth pages
    next('/')
  } else {
    next()
  }
})
```

**Auth Routes**:
```typescript
const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/signup',
    name: 'Signup',
    component: () => import('@/views/SignupView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/HomeView.vue'),
    meta: { requiresAuth: true }
  }
]
```

### 4. UI Store Updates

**File**: `src/stores/ui.ts`

**Add Auth Modal State**:
```typescript
interface UIState {
  // Existing state...
  authModal: {
    isOpen: boolean
    view: 'login' | 'signup' | 'reset-password'
    redirectAfterLogin?: string
  }
}

// Actions
function openAuthModal(view: 'login' | 'signup' = 'login', redirectTo?: string) {
  authModal.isOpen = true
  authModal.view = view
  authModal.redirectAfterLogin = redirectTo
}

function closeAuthModal() {
  authModal.isOpen = false
  authModal.redirectAfterLogin = undefined
}

function switchAuthView(view: 'login' | 'signup' | 'reset-password') {
  authModal.view = view
}
```

---

## Error Handling

### Common Firebase Auth Errors

**Email/Password Errors**:
```typescript
const AUTH_ERRORS = {
  'auth/email-already-in-use': 'This email is already registered',
  'auth/invalid-email': 'Invalid email address',
  'auth/operation-not-allowed': 'Email/password sign-in is disabled',
  'auth/weak-password': 'Password must be at least 8 characters',
  'auth/user-disabled': 'This account has been disabled',
  'auth/user-not-found': 'No account found with this email',
  'auth/wrong-password': 'Incorrect password',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later',
  'auth/network-request-failed': 'Network error. Please check your connection'
}
```

**Google Sign-In Errors**:
```typescript
const GOOGLE_AUTH_ERRORS = {
  'auth/popup-blocked': 'Popup was blocked by the browser. Please allow popups.',
  'auth/popup-closed-by-user': 'Sign-in cancelled',
  'auth/account-exists-with-different-credential': 'Email already registered with different provider',
  'auth/cancelled-popup-request': 'Only one popup request at a time'
}
```

**Error Display Component**:
```vue
<template>
  <div v-if="error" class="error-message">
    <ExclamationCircleIcon class="icon" />
    <span>{{ userFriendlyMessage }}</span>
  </div>
</template>

<script setup lang="ts">
const userFriendlyMessage = computed(() => {
  return AUTH_ERRORS[error.code] || 'An unexpected error occurred'
})
</script>
```

---

## User Profile Management

### Profile Document Structure

**Firestore Path**: `users/{userId}/profile/main`

```typescript
interface UserProfileDocument {
  uid: string                    // Firebase Auth UID
  email: string
  displayName: string | null
  photoURL: string | null
  createdAt: Timestamp
  lastLoginAt: Timestamp
  preferences: {
    language: 'en' | 'he'
    theme: 'light' | 'dark' | 'auto'
    notifications: {
      email: boolean
      push: boolean
    }
    timezone: string             // IANA timezone
  }
  stats: {
    totalTasks: number
    completedTasks: number
    totalPomodoros: number
  }
}
```

### Profile Sync Strategy

**On Sign-Up**:
1. Create Firebase Auth user
2. Create Firestore profile document
3. Initialize default preferences
4. Redirect to onboarding (if needed)

**On Sign-In**:
1. Fetch Firebase Auth user
2. Subscribe to profile document
3. Update `lastLoginAt` timestamp
4. Sync profile to Pinia store

**On Profile Update**:
1. Update Pinia store (optimistic)
2. Update Firestore document
3. Handle errors with rollback

---

## Testing Strategy

### Unit Tests (Vitest)

**Auth Store Tests**:
```typescript
describe('Auth Store', () => {
  it('should sign up with email and password', async () => {
    const authStore = useAuthStore()
    await authStore.signUpWithEmail('test@example.com', 'password123')
    expect(authStore.isAuthenticated).toBe(true)
  })

  it('should handle invalid email error', async () => {
    const authStore = useAuthStore()
    await expect(
      authStore.signInWithEmail('invalid', 'password')
    ).rejects.toThrow('Invalid email address')
  })
})
```

### Integration Tests (Playwright)

**Login Flow Test**:
```typescript
test('user can log in with email and password', async ({ page }) => {
  await page.goto('http://localhost:5546/login')

  await page.fill('[data-testid="email-input"]', 'test@example.com')
  await page.fill('[data-testid="password-input"]', 'password123')
  await page.click('[data-testid="login-button"]')

  // Should redirect to home page
  await expect(page).toHaveURL('http://localhost:5546/')

  // Should show user profile
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
})
```

**Google Sign-In Test**:
```typescript
test('user can sign in with Google', async ({ page }) => {
  // Mock Google OAuth popup
  await page.route('**/accounts.google.com/**', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({ token: 'mock-token' })
    })
  })

  await page.goto('http://localhost:5546/login')
  await page.click('[data-testid="google-signin-button"]')

  await expect(page).toHaveURL('http://localhost:5546/')
})
```

---

## Security Considerations

### Password Requirements
- **Minimum length**: 8 characters
- **Complexity**: At least one uppercase, one lowercase, one number
- **Firebase validation**: Uses built-in `auth/weak-password` check

### Session Management
- **Auto logout**: After 7 days of inactivity (Firebase default)
- **Refresh tokens**: Automatically handled by Firebase SDK
- **Multi-device**: Sessions persist across devices

### Data Privacy
- **User data isolation**: Firestore security rules enforce user-scoped access
- **No email verification required**: Optional, can be added later
- **Profile data**: Stored in user-owned Firestore documents

### Cross-Site Request Forgery (CSRF)
- **Protection**: Firebase Auth tokens are HTTP-only (when using server SDK)
- **Client SDK**: Uses localStorage, protected by same-origin policy

---

## Migration from IndexedDB to Firestore

### Migration Strategy

**Phase 1: Dual Write** (Authentication Complete → Sync Start)
1. User logs in
2. Continue writing to IndexedDB (existing behavior)
3. **Also** write to Firestore (new behavior)
4. IndexedDB remains source of truth

**Phase 2: Dual Read** (Sync Active)
1. On app load, check if user is authenticated
2. If authenticated, fetch from Firestore
3. Merge with IndexedDB data (Firestore wins on conflicts)
4. Continue dual write

**Phase 3: Firestore Primary** (After Testing)
1. Firestore becomes source of truth
2. IndexedDB used only as offline cache
3. On reconnection, Firestore data syncs to IndexedDB

### Migration Composable

**File**: `src/composables/useMigration.ts`

```typescript
export function useMigration() {
  const { loadFromDatabase } = useDatabase()
  const { create: createTask } = useFirestore<Task>('tasks')

  async function migrateTasksToFirestore(): Promise<void> {
    // Load all tasks from IndexedDB
    const localTasks = await loadFromDatabase<Task[]>('tasks')

    if (!localTasks || localTasks.length === 0) {
      console.log('No tasks to migrate')
      return
    }

    console.log(`Migrating ${localTasks.length} tasks to Firestore...`)

    // Batch write to Firestore
    for (const task of localTasks) {
      await createTask({
        ...task,
        // Preserve original IDs
        id: task.id,
        migratedAt: new Date()
      })
    }

    console.log('Migration complete')
  }

  return { migrateTasksToFirestore }
}
```

---

## Performance Optimization

### Lazy Loading
- Auth components loaded only when auth modal opens
- Reduces initial bundle size

### Caching
- Profile data cached in Pinia store
- Firestore offline persistence enabled (multi-tab support)

### Bundle Size
- Firebase SDK: ~200KB gzipped (Auth + Firestore)
- Impact: Acceptable for mobile-first app

---

## Next Steps

1. **Create Auth Store** (`src/stores/auth.ts`) ← START HERE
2. **Build LoginForm Component** (`src/components/auth/LoginForm.vue`)
3. **Build SignupForm Component** (`src/components/auth/SignupForm.vue`)
4. **Build GoogleSignInButton Component** (`src/components/auth/GoogleSignInButton.vue`)
5. **Add Router Guards** (update `src/router/index.ts`)
6. **Update UI Store** (add auth modal state)
7. **Test with Playwright** (login, signup, Google sign-in flows)

---

## Resources

- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Vue 3 + Firebase Best Practices](https://firebase.google.com/docs/web/setup)
- [Pinia with Firebase](https://pinia.vuejs.org/cookbook/)
