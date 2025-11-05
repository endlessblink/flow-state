# Pomo-Flow - Deployment and Configuration Reference

## Overview

This comprehensive reference document consolidates all configuration, build, deployment, and API interaction aspects of the Pomo-Flow Vue.js productivity application. It covers development setup, production deployment, mobile app configuration, and external service integrations.

## Table of Contents

- [Application Architecture](#application-architecture)
- [Development Environment Setup](#development-environment-setup)
- [Build System Configuration](#build-system-configuration)
- [Environment Variables Management](#environment-variables-management)
- [API and Service Integration](#api-and-service-integration)
- [Mobile App Configuration](#mobile-app-configuration)
- [Testing Configuration](#testing-configuration)
- [Deployment Pipeline](#deployment-pipeline)
- [Performance Optimization](#performance-optimization)
- [Security Configuration](#security-configuration)
- [Validation and Quality Assurance](#validation-and-quality-assurance)

---

## 🏗️ Application Architecture

### Technology Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Frontend Framework** | Vue 3 | 3.4.0 | Core UI framework with Composition API |
| **Build Tool** | Vite | 7.1.10 | Fast development server and production builds |
| **TypeScript** | TypeScript | 5.9.3 | Type safety and enhanced development |
| **State Management** | Pinia | Latest | Centralized state management |
| **UI Framework** | Naive UI | Latest | Component library with dark theme |
| **Styling** | Tailwind CSS | 3.x | Utility-first CSS with custom design system |
| **Authentication** | Firebase Auth | v10 | User authentication and authorization |
| **Database** | Firebase Firestore | v10 | Cloud-based NoSQL database |
| **Mobile Platform** | Capacitor | 7.0 | Cross-platform mobile app development |
| **Testing** | Vitest + Playwright | Latest | Unit and E2E testing |
| **Documentation** | Storybook | Latest | Component documentation and testing |

### Project Structure

```
pomo-flow/
├── src/
│   ├── components/           # Vue components (6 categories, 83 total)
│   │   ├── base/            # Base components (Button, Modal, Input)
│   │   ├── board/           # Kanban board components
│   │   ├── canvas/          # Canvas-based task organization
│   │   └── modals/          # Modal dialogs and overlays
│   ├── stores/              # Pinia state management
│   │   ├── tasks.ts         # Task management (1786 lines)
│   │   ├── canvas.ts        # Canvas state (974 lines)
│   │   ├── timer.ts         # Pomodoro timer (539 lines)
│   │   └── ui.ts            # Application UI state
│   ├── composables/         # Vue 3 composables
│   ├── views/               # Main application views
│   ├── config/              # Configuration files
│   │   ├── firebase.ts      # Firebase configuration
│   │   └── themes.ts        # Theme system
│   └── utils/               # Utility functions
├── docs/                    # Documentation
├── .storybook/              # Storybook configuration
├── capacitor.config.ts      # Mobile app configuration
├── vite.config.ts           # Build configuration
├── tailwind.config.js       # Styling configuration
└── package.json             # Project dependencies and scripts
```

---

## 🛠️ Development Environment Setup

### Prerequisites

```bash
# Node.js version requirement
node --version  # v20 LTS or higher
npm --version   # Latest npm
```

### Initial Setup Process

```bash
# 1. Clone repository
git clone <repository-url>
cd pomo-flow

# 2. Install dependencies
npm install

# 3. Create environment configuration
cp .env.example .env.local
# Edit .env.local with your credentials

# 4. Start development server
npm run dev

# 5. Validate setup
npm run validate:all
```

### Development Scripts

| Script | Command | Purpose | Environment |
|--------|---------|---------|-------------|
| **`npm run dev`** | `vite --host 0.0.0.0 --port 5546` | Start development server | Development |
| **`npm run storybook`** | `storybook dev -p 6006` | Component documentation | Development |
| **`npm run test`** | `vitest` | Unit tests | Development |
| **`npm run test:watch`** | `vitest --ui` | Interactive testing | Development |
| **`npm run validate:all`** | Multi-step validation | Code quality check | Development |
| **`npm run kill`** | `bash kill-pomo.sh` | Terminate processes | Development |

### Development Port Configuration

| Service | Port | Purpose | Access |
|---------|------|---------|--------|
| **Main Application** | 5546 | Primary development server | Network accessible |
| **Storybook** | 6006 | Component documentation | Local only |
| **Test Servers** | 5547-5560 | E2E testing | Local only |
| **Hot Reload** | Dynamic | HMR WebSocket | Automatic |

---

## ⚙️ Build System Configuration

### Vite Configuration (`vite.config.ts`)

```typescript
export default defineConfig({
  plugins: [
    vue(),                                    // Vue 3 SFC support
    VueI18nPlugin({                           // Internationalization
      include: [resolve('./src/i18n/locales/**')],
      strictMessage: false,
      escapeHtml: false
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))  // Path alias
    }
  },
  server: {
    host: '0.0.0.0',                          // Network access
    port: 5546,                                // Fixed development port
    hmr: true                                  // Hot module replacement
  },
  build: {
    minify: 'esbuild',                         // Fast minification
    sourcemap: false,                          // No sourcemaps in production
    chunkSizeWarningLimit: 1000,              // Reduced warnings
    target: 'esnext',                         // Modern browser target
    rollupOptions: {
      external: ['fsevents']                  // Exclude macOS dependency
    }
  },
  optimizeDeps: {
    include: [                                 // Pre-bundle dependencies
      'vue', 'vue-router', 'pinia', 'naive-ui',
      '@vueuse/core', '@vue-flow/core', 'date-fns'
    ]
  }
})
```

### Production Build Process

```bash
# Standard production build
npm run build

# Mobile app build
npm run build:mobile    # Build + Capacitor sync

# Storybook build
npm run build-storybook
```

### Build Output Structure

```
dist/
├── assets/
│   ├── index-[hash].css      # Main stylesheet
│   ├── index-[hash].js       # Main JavaScript bundle
│   └── vendor-[hash].js      # Third-party libraries
├── favicon.ico               # Site icon
└── index.html                # SPA entry point
```

### Performance Optimizations

| Feature | Implementation | Benefit |
|---------|----------------|---------|
| **Code Splitting** | Automatic route-based chunks | Faster initial load |
| **Tree Shaking** | ESBuild minification | Smaller bundle size |
| **Dependency Pre-bundling** | Vite optimization | Faster development startup |
| **Asset Optimization** | Built-in compression | Better performance |
| **Modern Browser Target** | `esnext` output | Smaller, more efficient code |

---

## 🌍 Environment Variables Management

### Environment File Hierarchy

| File | Purpose | Loading Order |
|------|---------|---------------|
| **`.env`** | Default configuration | 1 (always) |
| **`.env.local`** | Local overrides | 2 (git ignored) |
| **`.env.development`** | Development specific | 3 (dev only) |
| **`.env.production`** | Production values | 3 (prod only) |

### Required Environment Variables

```bash
# Firebase Configuration (Required)
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Firebase Development (Optional)
VITE_USE_FIREBASE_EMULATORS=true

# Application Configuration
VITE_LOG_LEVEL=debug
VITE_DEV_PORT=5546
VITE_APP_URL=http://localhost:5546
```

### Environment Variable Access Patterns

```typescript
// Firebase configuration (src/config/firebase.ts)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID
}

// Development mode detection
if (import.meta.env.DEV) {
  console.log('Development mode detected')
}

// Logging configuration
const logLevel = import.meta.env.VITE_LOG_LEVEL?.toLowerCase() || 'error'
```

### Environment Variable Security

- **VITE_ Prefix Required**: Only variables with `VITE_` prefix are exposed to client
- **Git Ignored**: `.env.local` is excluded from version control
- **Runtime Validation**: Configuration validation before initialization
- **Placeholder Detection**: Development-time checks for placeholder values

---

## 🔌 API and Service Integration

### Firebase Authentication (`src/config/firebase.ts`)

#### Authentication Operations

| Operation | Firebase Method | Purpose | Data Flow |
|-----------|----------------|---------|-----------|
| **Email Sign Up** | `createUserWithEmailAndPassword` | User registration | Email, Password → User Credential |
| **Email Sign In** | `signInWithEmailAndPassword` | User login | Email, Password → User Credential |
| **Google Sign In** | `signInWithPopup` + `GoogleAuthProvider` | OAuth authentication | Google Account → User Credential |
| **Sign Out** | `firebaseSignOut` | User logout | None → Clears auth state |
| **Password Reset** | `sendPasswordResetEmail` | Send reset email | Email → Reset email sent |

#### Firebase Initialization Flow

```typescript
// 1. Configuration validation
const validateConfig = () => {
  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId']
  // Check for missing keys and placeholder values
}

// 2. Conditional initialization
if (isConfigValid) {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)

  // 3. Offline persistence setup
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      enableIndexedDbPersistence(db!)  // Fallback to single-tab mode
    }
  })

  // 4. Development emulator connections
  if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
    connectAuthEmulator(auth, 'http://localhost:9099')
    connectFirestoreEmulator(db, 'localhost', 8080)
  }
}
```

### Firebase Firestore Database Operations

#### Task Management API

| Operation | Firestore Path | Method | Authentication |
|-----------|----------------|--------|----------------|
| **Save Task** | `users/{userId}/tasks/{taskId}` | `setDoc` | User-scoped |
| **Load Task** | `users/{userId}/tasks/{taskId}` | `getDoc` | User-scoped |
| **Delete Task** | `users/{userId}/tasks/{taskId}` | `deleteDoc` | User-scoped |
| **Save Tasks (Batch)** | `users/{userId}/tasks/*` | `writeBatch` | User-scoped |
| **Real-time Tasks** | `users/{userId}/tasks` | `onSnapshot` | User-scoped |

#### Project Management API

| Operation | Firestore Path | Method | Authentication |
|-----------|----------------|--------|----------------|
| **Save Project** | `users/{userId}/projects/{projectId}` | `setDoc` | User-scoped |
| **Load Projects** | `users/{userId}/projects` | `getDocs` | User-scoped |
| **Real-time Projects** | `users/{userId}/projects` | `onSnapshot` | User-scoped |

#### Canvas Operations

| Operation | Firestore Path | Method | Authentication |
|-----------|----------------|--------|----------------|
| **Save Canvas** | `users/{userId}/canvas/state` | `setDoc` | User-scoped |
| **Load Canvas** | `users/{userId}/canvas/state` | `getDoc` | User-scoped |
| **Real-time Canvas** | `users/{userId}/canvas/state` | `onSnapshot` | User-scoped |

### Cloud Sync External Services

#### JSONBin Cloud Storage

| Operation | Endpoint | Method | Authentication |
|-----------|----------|--------|----------------|
| **Create Record** | `https://api.jsonbin.io/v3/b` | POST | API Key |
| **Update Record** | `https://api.jsonbin.io/v3/b/{binId}` | PUT | API Key |
| **Fetch Record** | `https://api.jsonbin.io/v3/b/{binId}/latest` | GET | API Key |
| **Delete Record** | `https://api.jsonbin.io/v3/b/{binId}` | DELETE | API Key |

#### GitHub Gist Storage

| Operation | Endpoint | Method | Authentication |
|-----------|----------|--------|----------------|
| **Create Gist** | `https://api.github.com/gists` | POST | Personal Access Token |
| **Update Gist** | `https://api.github.com/gists/{gistId}` | PATCH | Personal Access Token |
| **Fetch Gist** | `https://api.github.com/gists/{gistId}` | GET | Public access |
| **List Gists** | `https://api.github.com/users/{username}/gists` | GET | Personal Access Token |

### Browser Storage APIs

#### IndexedDB Operations (via LocalForage)

| Collection | Key | Data Type | Purpose |
|------------|-----|-----------|---------|
| **Tasks** | `'tasks'` | `Task[]` | Local task storage |
| **Projects** | `'projects'` | `Project[]` | Project data |
| **Canvas** | `'canvas'` | `CanvasState` | Canvas layout |
| **Timer** | `'timer'` | `TimerState` | Pomodoro sessions |
| **Settings** | `'settings'` | `AppSettings` | App preferences |

#### Local Storage Operations

| Key | Purpose | Data Type | Persistence |
|-----|---------|-----------|-------------|
| `'pomo-flow-theme'` | Theme preference | `'light' | 'dark' | 'auto'` | localStorage |
| `'pomo-flow-language'` | Language preference | `'en' | 'he'` | localStorage |
| `'pomo-flow-backup-schedule'` | Backup settings | `BackupSchedule` | localStorage |

---

## 📱 Mobile App Configuration

### Capacitor Configuration (`capacitor.config.ts`)

```typescript
const config: CapacitorConfig = {
  appId: 'com.pomoflow.app',
  appName: 'pomo-flow',
  webDir: 'dist',                               // Build output directory
  server: {
    androidScheme: 'https',                      // HTTPS for Android
    iosScheme: 'capacitor'                       // Custom scheme for iOS
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,                  // 2 second splash screen
      backgroundColor: '#1a1a1a',                // Dark background
      showSpinner: false                         // No loading spinner
    },
    StatusBar: {
      style: 'dark',                             // Dark status bar
      backgroundColor: '#1a1a1a'                  // Match splash screen
    },
    LocalNotifications: {
      permissions: ['prompt', 'badge', 'sound', 'alert']
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
}
```

### Mobile Build Workflow

```bash
# 1. Build web assets for mobile
npm run build:mobile    # Equivalent to: npm run build && npx cap sync

# 2. Sync with native projects
npm run mobile:sync     # npx cap sync

# 3. Run on device/emulator
npm run mobile:run:android
npm run mobile:run:ios
```

### Mobile-Specific Features

#### Local Notifications API

| Method | Purpose | Parameters |
|--------|---------|------------|
| **Request Permissions** | Request notification access | None |
| **Schedule Notification** | Schedule future notification | Notification object |
| **Cancel Notification** | Cancel scheduled notification | Notification ID |
| **Register Actions** | iOS notification actions | Action type definitions |

#### Push Notifications API

| Method | Purpose | Data Flow |
|--------|---------|-----------|
| **Request Permissions** | Request push access | Permission result |
| **Register** | Register for push tokens | Device token |
| **Listeners** | Handle push events | Push data |

#### Haptic Feedback API

| Method | Purpose | Parameters |
|--------|---------|------------|
| **Impact** | Haptic impact feedback | ImpactStyle (Light/Medium/Heavy) |
| **Notification** | Success/error haptics | NotificationType (SUCCESS/ERROR/WARNING) |

### Native Platform Integration

- **iOS**: Xcode project configuration
- **Android**: Android Studio project configuration
- **Cross-platform**: Capacitor plugin ecosystem
- **Performance**: Native app performance with web technologies

---

## 🧪 Testing Configuration

### Vitest Configuration (`vitest.config.ts`)

```typescript
export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,                              // Global test functions
    environment: 'node',                       // Node environment for file system tests
    include: [
      'tests/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'src/**/__tests__/**/*.{js,ts,jsx,tsx}'
    ],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    allowOnly: true,                            // Allow .only for focused tests
    testTimeout: 30000,                         // 30 second timeout
    hookTimeout: 30000,
    projects: [{
      extends: true,
      plugins: [
        storybookTest({
          configDir: path.join(dirname, '.storybook')  // Storybook integration
        })
      ],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: 'playwright',
          instances: [{ browser: 'chromium' }]
        },
        setupFiles: ['.storybook/vitest.setup.ts']
      }
    }]
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')          // Path alias for imports
    }
  }
})
```

### Testing Scripts and Commands

| Script | Command | Purpose | Scope |
|--------|---------|---------|-------|
| **`npm run test`** | `vitest` | Unit tests | Watch mode |
| **`npm run test:watch`** | `vitest --ui` | Interactive testing | GUI interface |
| **`npm run test:safety`** | Custom safety checks | Validation | Security/Quality |
| **`npm run test:e2e`** | `playwright test` | End-to-end tests | Browser automation |

### Testing Best Practices

1. **Unit Testing**: Test individual components and composables
2. **Integration Testing**: Test component interactions
3. **E2E Testing**: Test complete user workflows
4. **Storybook Testing**: Visual component testing
5. **Performance Testing**: Monitor app performance metrics

---

## 🚀 Deployment Pipeline

### Current Deployment Status: **Manual Builds Only**

#### Missing Infrastructure
- ❌ **No CI/CD Pipeline** (GitHub Actions, GitLab CI)
- ❌ **No Automated Testing** in deployment pipeline
- ❌ **No Staging Environment** for pre-production testing
- ❌ **No Container Configuration** (Docker)
- ❌ **No Platform Configuration** (Vercel, Netlify, Railway)

### Production Build Process

```bash
# 1. Set production environment variables
export NODE_ENV=production
export VITE_FIREBASE_API_KEY=production-api-key

# 2. Build production assets
npm run build

# 3. Preview build locally
npm run preview

# 4. Deploy to hosting platform
# Manual deployment of /dist directory contents
```

### Recommended Deployment Options

#### Option 1: Vercel (Recommended)

```json
// vercel.json (to create)
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {},
  "routes": [
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

#### Option 2: Netlify

```toml
# netlify.toml (to create)
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_ENV = "production"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

#### Option 3: Firebase Hosting

```bash
# Firebase hosting setup
firebase init hosting
firebase deploy --only hosting
```

### Mobile App Deployment

#### Mobile Store Requirements

| Platform | Developer Account | Cost | Review Process |
|----------|------------------|------|----------------|
| **iOS App Store** | Apple Developer Program | $99/year | Manual review (1-7 days) |
| **Google Play** | Google Play Console | $25 one-time | Automated review (hours) |

#### Mobile Build Process

```bash
# 1. Build for production
npm run build:mobile

# 2. Native project configuration
# Open android/ in Android Studio
# Open ios/ in Xcode

# 3. Sign and build
# Platform-specific signing and compilation

# 4. Store submission
# Upload to App Store / Google Play Console
```

---

## ⚡ Performance Optimization

### Build Performance Features

| Feature | Implementation | Impact |
|---------|----------------|---------|
| **ESBuild Minification** | Vite production builds | 10-100x faster than Webpack |
| **Code Splitting** | Automatic route-based chunks | Faster initial load |
| **Tree Shaking** | Dead code elimination | Smaller bundle sizes |
| **Dependency Pre-bundling** | Vite dev server optimization | Faster development startup |
| **Asset Compression** | Built-in gzip/brotli | Better transfer speeds |

### Runtime Performance

| Metric | Target | Optimization Strategy |
|--------|--------|----------------------|
| **First Contentful Paint** | <1.5s | Code splitting, lazy loading |
| **Largest Contentful Paint** | <2.5s | Image optimization, critical CSS |
| **First Input Delay** | <100ms | JavaScript optimization |
| **Cumulative Layout Shift** | <0.1 | Stable layout, dimension management |

### Memory Management

- **Debounced Saves**: Prevent excessive IndexedDB writes
- **Lazy Loading**: Load data on demand
- **Component Cleanup**: Proper unmounting and memory release
- **Memory Monitoring**: Track memory usage in development

### Mobile Performance

- **Native Performance**: Capacitor provides native app performance
- **Optimized Builds**: Mobile-specific build optimizations
- **Resource Management**: Efficient memory and CPU usage
- **Battery Optimization**: Minimal background processing

---

## 🔒 Security Configuration

### Authentication Security

| Feature | Implementation | Protection |
|---------|----------------|------------|
| **Firebase Authentication** | Industry-standard OAuth | Secure user management |
| **Token Management** | Automatic refresh tokens | Session security |
| **Password Security** | Firebase Auth best practices | Secure credential handling |
| **Session Management** | Secure logout and timeout | Unauthorized access prevention |

### Data Security

| Aspect | Configuration | Protection |
|--------|----------------|------------|
| **User-Scoped Access** | Firestore security rules | Data isolation |
| **API Key Protection** | Environment variables only | Client-side key exposure prevention |
| **HTTPS Enforcement** | Firebase Auth requirement | Secure communication |
| **Token Encryption** | Local storage encryption | Sensitive data protection |

### Build Security

| Feature | Implementation | Security Benefit |
|---------|----------------|-----------------|
| **Environment Variables** | VITE_ prefix only | Prevents server-side secret exposure |
| **Source Maps Disabled** | Production build setting | Prevents code exposure |
| **Content Security Policy** | Manual CSP headers recommended | XSS protection |
| **Dependency Scanning** | Manual review recommended | Vulnerability detection |

### Privacy Protection

- **Local-First Approach**: Data stays on device by default
- **Opt-In Sync**: User-controlled cloud backup
- **Data Minimization**: Only necessary data collection
- **Transparent Storage**: User can export/delete data
- **GDPR Compliance**: User data rights respected

---

## 🔍 Validation and Quality Assurance

### Validation Scripts

| Script | Command | Purpose | Coverage |
|--------|---------|---------|----------|
| **`npm run validate:imports`** | Custom validator | Vue import validation | All Vue files |
| **`npm run validate:css`** | Custom validator | CSS structure validation | All CSS files |
| **`npm run validate:dependencies`** | Custom validator | Dependency validation | package.json |
| **`npm run validate:all`** | Multi-step | Comprehensive validation | Entire project |

### Code Quality Assurance

| Tool | Purpose | Configuration |
|------|---------|---------------|
| **ESLint** | Code linting | `.eslintrc.js` |
| **TypeScript** | Type checking | `tsconfig.json` |
| **Vitest** | Unit testing | `vitest.config.ts` |
| **Playwright** | E2E testing | `playwright.config.ts` |
| **Storybook** | Component testing | `.storybook/` |

### Validation Workflow

```bash
# Complete validation pipeline
npm run validate:all

# Individual validations
npm run validate:imports      # Vue import validation
npm run validate:css          # CSS structure validation
npm run validate:dependencies # Dependency validation
npm run lint                 # Code quality validation
npm run test                 # Unit test validation
```

### Quality Gates

1. **All validations must pass** before commits
2. **Unit test coverage** minimum 80%
3. **TypeScript compilation** with no errors
4. **ESLint compliance** with project standards
5. **Build success** in production mode

---

## 📊 Configuration Management

### Configuration File Dependencies

```
main.ts
├── consoleFilter.js              (First - Console setup)
├── ./config/firebase.ts          (Firebase setup)
├── ./stores/auth.ts              (Authentication)
├── ./utils/globalKeyboardHandlerSimple.ts (Shortcuts)
└── ./assets/styles.css           (Styles)

vite.config.ts
├── Vue plugin                   (Vue SFC support)
├── VueI18nPlugin               (Internationalization)
└── Path aliases                ('@' -> './src')

tailwind.config.js
├── Design tokens               (CSS custom properties)
├── Component classes           (.task-base, .btn, etc.)
├── RTL support                 (Logical properties)
└── External plugins            (@tailwindcss/forms, etc.)

package.json
├── Development scripts          (dev, build, test)
├── Validation scripts          (validate:all)
├── Mobile scripts              (mobile:run:*)
└── Storybook scripts           (storybook)
```

### Plugin Initialization Order

1. **Vue App Creation** - `createApp(App)`
2. **Pinia Store Setup** - `createPinia()`
3. **Router Integration** - `app.use(router)`
4. **i18n Setup** - `app.use(i18n)`
5. **Firebase Configuration** - Conditional initialization
6. **Authentication Store** - `useAuthStore().initAuthListener()`
7. **Keyboard Shortcuts** - `initGlobalKeyboardShortcuts()`
8. **App Mounting** - `app.mount('#root')`

### Environment-Specific Configuration

#### Development Environment
- **Firebase Emulators**: Local development backend
- **Console Filtering**: Development-specific logging
- **Hot Module Replacement**: Live reloading
- **Source Maps**: Debugging support

#### Production Environment
- **Optimized Builds**: Minification and compression
- **Error Handling**: Production error reporting
- **Performance Monitoring**: Runtime metrics
- **Security Headers**: CSP and HTTPS enforcement

#### Testing Environment
- **Mock Services**: Firebase and API mocking
- **Test Database**: Isolated test data
- **Headless Browser**: Automated testing
- **Coverage Reporting**: Test metrics

---

## 🔧 Troubleshooting and Debugging

### Common Configuration Issues

#### Firebase Configuration Problems

```typescript
// Debug Firebase configuration
export const isFirebaseReady = () => {
  return !!(app && auth && db)
}

// Check configuration validity
export const validateFirebaseConfig = () => {
  const required = ['apiKey', 'authDomain', 'projectId', 'appId']
  const missing = required.filter(key => !firebaseConfig[key])
  return missing.length === 0
}
```

#### Development Server Issues

```bash
# Kill all processes on development ports
npm run kill

# Clear Vite cache
rm -rf node_modules/.vite

# Reinstall dependencies
npm install

# Check port availability
netstat -an | grep 5546
```

#### Build Process Issues

```bash
# Clean build
rm -rf dist
npm run build

# Check for TypeScript errors
npx tsc --noEmit

# Validate imports
npm run validate:imports
```

### Performance Debugging

```typescript
// Memory monitoring
const checkMemoryUsage = () => {
  if (performance.memory) {
    const used = performance.memory.usedJSHeapSize
    const limit = performance.memory.jsHeapSizeLimit
    const percentage = (used / limit) * 100
    console.log(`Memory usage: ${percentage.toFixed(1)}%`)
  }
}

// FPS monitoring
let frameCount = 0
let lastTime = performance.now()
const measureFPS = () => {
  frameCount++
  const currentTime = performance.now()
  if (currentTime - lastTime >= 1000) {
    console.log(`FPS: ${frameCount}`)
    frameCount = 0
    lastTime = currentTime
  }
  requestAnimationFrame(measureFPS)
}
```

### Debug Mode Features

- **Development Indicators**: Visual development mode markers
- **Console Logging**: Enhanced debugging information
- **Vue DevTools**: Component state inspection
- **Performance Monitoring**: Real-time performance metrics
- **Error Boundaries**: Graceful error handling and reporting

---

## 📈 Future Enhancements

### Recommended Improvements

1. **CI/CD Pipeline**
   - GitHub Actions with automated testing
   - Staging environment deployment
   - Automated production releases

2. **Enhanced Monitoring**
   - Sentry error tracking
   - Firebase Analytics integration
   - Performance monitoring dashboard

3. **Progressive Web App**
   - Service worker implementation
   - Offline functionality
   - App manifest configuration

4. **Security Enhancements**
   - Content Security Policy headers
   - Automated dependency scanning
   - Security audit pipeline

5. **Mobile Optimizations**
   - Fastlane for mobile deployment
   - Automated testing on real devices
   - App store optimization

### Infrastructure Improvements

1. **Container Configuration**
   - Docker configuration for deployment
   - Docker Compose for development
   - Kubernetes for production scaling

2. **CDN Integration**
   - Content delivery network setup
   - Asset optimization and caching
   - Global performance improvement

3. **Database Optimizations**
   - Firebase security rules refinement
   - Data indexing strategy
   - Backup and recovery procedures

---

**Last Updated**: November 2, 2025
**Configuration Version**: Vue 3.4.0, Vite 7.1.10, TypeScript 5.9.3
**Deployment Status**: Manual builds only - CI/CD pipeline recommended
**Mobile Platform**: Capacitor 7.0 with iOS/Android support
**API Integration**: Firebase v10, Capacitor plugins, Fetch API
**Security**: Firebase Authentication with user-scoped data access
**Performance**: ESBuild optimization with modern browser targeting