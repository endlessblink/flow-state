# Pomo-Flow - Third-Party Libraries & Plugins Documentation

## Overview

This document provides a comprehensive mapping of all third-party libraries, Vue plugins, and external dependencies used in the Pomo-Flow Vue.js productivity application, including their purposes, usage patterns, and implementation details.

## Table of Contents

- [Vue Ecosystem Libraries](#vue-ecosystem-libraries)
- [UI Component Libraries](#ui-component-libraries)
- [Canvas & Visualization Libraries](#canvas--visualization-libraries)
- [State Management Libraries](#state-management-libraries)
- [Database & Storage Libraries](#database--storage-libraries)
- [Authentication & Backend Libraries](#authentication--backend-libraries)
- [Utility & Helper Libraries](#utility--helper-libraries)
- [Mobile Development Libraries](#mobile-development-libraries)
- [Animation & UI Enhancement Libraries](#animation--ui-enhancement-libraries)
- [Testing & Development Tools](#testing--development-tools)
- [Build & Development Tools](#build--development-tools)
- [Type Definition Packages](#type-definition-packages)

---

## 🟢 Vue Ecosystem Libraries

### **Vue 3** (`vue: ^3.4.0`)

#### **Purpose**
- **Core Framework**: Progressive JavaScript framework for building user interfaces
- **Composition API**: Modern reactivity system with `<script setup>` syntax
- **Reactivity System**: Reactive state management and computed properties

#### **Usage Patterns**
```typescript
// Composition API imports
import { ref, reactive, computed, watch, onMounted } from 'vue'

// Reactive state
const count = ref(0)
const user = reactive({ name: 'John', age: 30 })

// Computed properties
const doubled = computed(() => count.value * 2)

// Lifecycle hooks
onMounted(() => {
  console.log('Component mounted')
})
```

#### **Implementation Locations**
- **Used in**: All Vue components (*.vue files)
- **Key files**: `src/App.vue`, `src/views/*.vue`, `src/components/*.vue`
- **Total files**: 80+ Vue SFC files

---

### **Vue Router** (`vue-router: ^4.2.5`)

#### **Purpose**
- **Routing**: Client-side routing with hash-based navigation
- **Navigation Guards**: Authentication and authorization guards
- **Route Management**: Dynamic route handling and parameter passing

#### **Usage Patterns**
```typescript
// Router configuration (src/router/index.ts)
import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: BoardView },
    { path: '/calendar', component: CalendarView },
    // ... 10 more routes
  ]
})

// Authentication guard
router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  if (requiresAuth && !isAuthenticated) {
    // Open auth modal instead of redirect
    uiStore.openAuthModal('login', to.fullPath)
  }
  next()
})
```

#### **Implementation Locations**
- **Configuration**: `src/router/index.ts`
- **Usage**: `src/App.vue` (router-view), `src/main.ts` (app.use)
- **Total usage**: Router integration in main app layout

---

### **Pinia** (`pinia: ^2.1.7`)

#### **Purpose**
- **State Management**: Modern, intuitive state management for Vue
- **Store Pattern**: Centralized store architecture with TypeScript support
- **DevTools Integration**: Excellent developer experience with time travel debugging

#### **Usage Patterns**
```typescript
// Store definition (src/stores/tasks.ts)
import { defineStore } from 'pinia'

export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
  const projects = ref<Project[]>([])

  const activeTasks = computed(() =>
    tasks.value.filter(t => t.status !== 'done')
  )

  const createTask = async (taskData: Partial<Task>) => {
    const task: Task = { /* task creation logic */ }
    tasks.value.push(task)
    await saveToDatabase()
    return task
  }

  return { tasks, activeTasks, createTask }
})

// Component usage
const taskStore = useTaskStore()
const { activeTasks, createTask } = taskStore
```

#### **Store Architecture**
1. **tasks.ts** - Task management (1,786 lines)
2. **canvas.ts** - Canvas state and Vue Flow (974 lines)
3. **timer.ts** - Pomodoro timer (539 lines)
4. **ui.ts** - Application UI state
5. **auth.ts** - Authentication management
6. **quickSort.ts** - Quick sort functionality
7. **taskScheduler.ts** - Task scheduling
8. **taskCore.ts** - Core task operations
9. **taskCanvas.ts** - Canvas-specific tasks
10. **tasks-new.ts** - New task features

#### **Implementation Locations**
- **Used in**: 40+ components across the application
- **Stores**: `src/stores/*.ts` (10 stores)
- **Integration**: `src/main.ts` (app.use(pinia))

---

### **Vue I18n** (`vue-i18n: ^9.14.5`)

#### **Purpose**
- **Internationalization**: Multi-language support with RTL language handling
- **Locale Management**: Dynamic language switching with persistence
- **Message Formatting**: Pluralization, date/time formatting, currency

#### **Usage Patterns**
```typescript
// i18n configuration (src/i18n/index.ts)
import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import he from './locales/he.json'

const i18n = createI18n({
  legacy: false,                               // Composition API mode
  locale: getSavedLocale(),                    // Browser/localStorage detection
  fallbackLocale: 'en',
  messages: { en, he },                        // English + Hebrew support
  globalInjection: true,                       // $t available in templates
  missingWarn: process.env.NODE_ENV !== 'production'
})

// Component usage
const { t } = useI18n()
const title = t('auth.login', 'Login')         // With fallback
```

#### **Language Support**
- **English (en)**: Primary language
- **Hebrew (he)**: RTL language support
- **RTL Detection**: Automatic direction switching for RTL languages
- **Locale Storage**: Persistent language preference in localStorage

#### **Implementation Locations**
- **Configuration**: `src/i18n/index.ts`
- **Locales**: `src/i18n/locales/en.json`, `src/i18n/locales/he.json`
- **Integration**: `src/main.ts` (app.use(i18n))
- **Usage**: All components with text content

---

### **Vue Test Utils** (`@vue/test-utils: ^2.4.3`)

#### **Purpose**
- **Component Testing**: Testing utilities for Vue components
- **Mount Testing**: Component mounting and interaction testing
- **Mocking**: Easy mocking of components and composables

#### **Usage Patterns**
```typescript
// Component testing example
import { mount } from '@vue/test-utils'
import TaskCard from '@/components/TaskCard.vue'

describe('TaskCard', () => {
  it('renders task title correctly', () => {
    const wrapper = mount(TaskCard, {
      props: {
        task: { id: '1', title: 'Test Task', status: 'planned' }
      }
    })

    expect(wrapper.text()).toContain('Test Task')
  })
})
```

#### **Implementation Locations**
- **Testing**: `tests/**/*.{test,spec}.{js,ts,jsx,tsx}`
- **Configuration**: `vitest.config.ts` (test environment setup)

---

## 🎨 UI Component Libraries

### **Naive UI** (`naive-ui: ^2.43.1`)

#### **Purpose**
- **Component Library**: Comprehensive Vue 3 component library with TypeScript support
- **Dark Theme**: Built-in dark/light theme support
- **Customization**: Highly customizable with design tokens

#### **Components Used**
```typescript
// Global providers (src/App.vue)
import {
  NConfigProvider,
  NMessageProvider,
  NGlobalStyle,
  darkTheme
} from 'naive-ui'

// Common components throughout app
- NButton, NInput, NSelect          // Form controls
- NModal, NDrawer                    // Overlays
- NMessage, NNotification           // User feedback
- NCard, NTabs, NMenu               // Layout components
- NDatePicker, NTimePicker          // Date/time selection
- NDropdown, NPopover               // Context menus
```

#### **Theme Integration**
```typescript
// Dark theme configuration
const themeOverrides = {
  common: {
    primaryColor: '#8b5cf6',           // Custom brand color
    primaryColorHover: '#7c3aed',
    primaryColorPressed: '#6d28d9',
  }
}

// Application setup
<NConfigProvider :theme="themeOverrides" :theme-overrides="themeOverrides">
  <NMessageProvider>
    <NGlobalStyle />
    <RouterView />
  </NMessageProvider>
</NConfigProvider>
```

#### **Implementation Locations**
- **Global Setup**: `src/App.vue` (providers and theme)
- **Component Usage**: 15+ components across the application
- **Integration**: Vite plugin in `vite.config.ts`

---

### **Headless UI Vue** (`@headlessui/vue: ^1.7.23`)

#### **Purpose**
- **Unstyled Components**: Accessible, unstyled component primitives
- **Custom Styling**: Complete control over component appearance
- **Accessibility**: Built-in ARIA support and keyboard navigation

#### **Components Used**
```typescript
import {
  Dialog, DialogPanel, DialogTitle,   // Modal dialogs
  Menu, MenuButton, MenuItem,         // Dropdown menus
  Disclosure, DisclosureButton,       // Accordion/collapsible
  Listbox, ListboxButton, ListboxOption, // Select dropdowns
  Switch, SwitchGroup,               // Toggle switches
  TabGroup, TabList, Tab, TabPanels   // Tab navigation
} from '@headlessui/vue'
```

#### **Usage Examples**
```typescript
// Modal dialog with custom styling
<Dialog :open="isOpen" @close="isOpen = false">
  <DialogPanel class="modal-content">
    <DialogTitle class="modal-title">Edit Task</DialogTitle>
    <div class="modal-body">
      <!-- Custom form content -->
    </div>
  </DialogPanel>
</Dialog>

// Dropdown menu
<Menu as="div" class="relative">
  <MenuButton class="menu-button">Options</MenuButton>
  <MenuItems class="menu-items">
    <MenuItem v-slot="{ active }">
      <button :class="{ 'menu-item-active': active }">Edit</button>
    </MenuItem>
    <MenuItem>
      <button>Delete</button>
    </MenuItem>
  </MenuItems>
</Menu>
```

#### **Implementation Locations**
- **Modal Systems**: `src/components/modals/*.vue`
- **Context Menus**: `src/components/*.vue` (various context menus)
- **Form Controls**: Custom form implementations
- **Total Usage**: 20+ components across the application

---

### **Heroicons Vue** (`@heroicons/vue: ^2.2.0`)

#### **Purpose**
- **Icon Library**: Beautiful, consistent SVG icons
- **Vue Integration**: Optimized Vue components with props
- **Consistency**: Consistent visual language across the application

#### **Icon Categories Used**
```typescript
// Navigation icons
import { Home, Calendar, LayoutList, Settings } from '@heroicons/vue/24/outline'

// Action icons
import { Plus, X, Edit, Trash2, Check } from '@heroicons/vue/20/solid'

// Status icons
import { ExclamationTriangle, CheckCircle, InformationCircle } from '@heroicons/vue/24/outline'

// UI icons
import { ChevronDown, ChevronUp, MagnifyingGlass, Bell } from '@heroicons/vue/20/solid'
```

#### **Usage Patterns**
```typescript
// Icon component usage
<template>
  <button class="btn">
    <Plus class="icon" />
    Add Task
  </button>

  <div class="status-indicator">
    <CheckCircle class="success-icon" />
    Completed
  </div>
</template>

// Dynamic icon selection
const iconMap = {
  edit: PencilIcon,
  delete: TrashIcon,
  save: CheckIcon
}
```

#### **Implementation Locations**
- **Used in**: 40+ components throughout the application
- **Common locations**: Button components, status indicators, navigation
- **Icon variants**: 20/outline and 24/solid sizes primarily used

---

### **Lucide Vue Next** (`lucide-vue-next: ^0.294.0`)

#### **Purpose**
- **Modern Icon Library**: Consistent, modern icon set with Vue 3 support
- **Comprehensive Collection**: 1000+ icons covering all UI needs
- **TypeScript Support**: Full TypeScript definitions

#### **Popular Icons Used**
```typescript
import {
  Calendar, Clock, Timer,               // Time/date icons
  Zap, AlertCircle, Flag,              // Status/priority icons
  ChevronDown, ChevronUp, Menu,         // Navigation icons
  Play, Pause, Square, Check,          // Control icons
  Edit, Copy, Trash2, X,                // Action icons
  List, LayoutList, AlignJustify        // Layout icons
} from 'lucide-vue-next'
```

#### **Implementation Locations**
- **Components**: `src/components/ViewControls.vue`, `src/views/QuickSortView.vue`
- **Task Management**: Task status indicators, action buttons
- **Navigation**: Menu items, view controls
- **Total Usage**: 15+ components with Lucide icons

---

## 🎨 Canvas & Visualization Libraries

### **Vue Flow Core** (`@vue-flow/core: ^1.47.0`)

#### **Purpose**
- **Node-based Canvas**: Interactive node graph visualization
- **Drag & Drop**: Built-in drag and drop for nodes and connections
- **Customization**: Highly customizable nodes, edges, and controls
- **Performance**: Optimized for large graphs with virtualization

#### **Key Features Used**
```typescript
// Core Vue Flow functionality
import {
  VueFlow,           // Main canvas component
  useVueFlow,        // Canvas state and controls
  useNodesInitialized, // Node initialization hook
  PanOnScrollMode   // Scroll-based panning
} from '@vue-flow/core'

// Canvas state management
const {
  nodes, edges,           // Graph data
  addNodes, removeNodes, // Node manipulation
  connectEdges,          // Edge creation
  fitView,              // View controls
  onConnect, onNodeDragStop // Event handlers
} = useVueFlow()
```

#### **Implementation Details**
```typescript
// Canvas component structure (src/views/CanvasView.vue)
<template>
  <VueFlow
    v-model:nodes="nodes"
    v-model:edges="edges"
    @node-drag-stop="handleNodeDragStop"
    @connect="onConnect"
    @edge-created="onEdgeCreated"
    :pan-on-scroll="true"
    :fit-view-on-init="true"
  >
    <Background pattern-color="#aaa" :gap="20" />
    <Controls />
    <MiniMap />
  </VueFlow>
</template>
```

#### **Critical Implementation Rules**
⚠️ **Vue Flow Integration Rules - DO NOT VIOLATE**
- **❌ DO NOT EXTRACT**: v-model bindings, event handlers, VueFlow component
- **✅ SAFE TO EXTRACT**: Canvas controls, modals, context menus, sidebar panels
- **Violation Consequences**: Broken drag/drop, lost connections, state sync issues

#### **Implementation Locations**
- **Main Canvas**: `src/views/CanvasView.vue` (2,000+ lines)
- **Task Nodes**: `src/components/canvas/TaskNode.vue`
- **Selection**: `src/components/canvas/MultiSelectionOverlay.vue`
- **Total Canvas Components**: 10+ canvas-specific components

---

### **Vue Flow Background** (`@vue-flow/background: ^1.3.2`)

#### **Purpose**
- **Canvas Background**: Configurable background patterns and colors
- **Grid System**: Optional grid overlay for better node alignment
- **Visual Polish**: Professional canvas appearance

#### **Usage**
```typescript
import { Background } from '@vue-flow/background'

<Background
  pattern-color="#aaa"
  :gap="20"
  :pattern="dots"
/>
```

#### **Implementation Locations**
- **Canvas View**: `src/views/CanvasView.vue`

---

### **Vue Flow Controls** (`@vue-flow/controls: ^1.1.3`)

#### **Purpose**
- **Viewport Controls**: Zoom in/out, fit view, reset view
- **Interaction Controls**: Pan, select, delete controls
- **User Experience**: Intuitive canvas navigation

#### **Usage**
```typescript
import { Controls } from '@vue-flow/controls'

<Controls
  showZoom={true}
  showFitView={true}
  showInteractive={true}
/>
```

#### **Implementation Locations**
- **Canvas View**: `src/views/CanvasView.vue`

---

### **Vue Flow MiniMap** (`@vue-flow/minimap: ^1.5.4`)

#### **Purpose**
- **Navigation Aid**: Small overview map of entire canvas
- **Quick Navigation**: Click to jump to specific canvas areas
- **Spatial Awareness**: Understand node relationships at a glance

#### **Usage**
```typescript
import { MiniMap } from '@vue-flow/minimap'

<MiniMap
  nodeColor="#8b5cf6"
  maskColor="rgba(255, 255, 255, 0.1)"
/>
```

#### **Implementation Locations**
- **Canvas View**: `src/views/CanvasView.vue`

---

### **Vue Flow Node Resizer** (`@vue-flow/node-resizer: ^1.5.0`)

#### **Purpose**
- **Node Resizing**: Resize handles for canvas nodes
- **Visual Feedback**: Clear resize indicators and constraints
- **User Interaction**: Intuitive resize behavior

#### **Usage**
```typescript
import { NodeResizer, NodeResizeControl } from '@vue-flow/node-resizer'

<NodeResizer
  :min-width="200"
  :min-height="100"
  :max-width="600"
  :max-height="400"
/>
```

#### **Implementation Locations**
- **Canvas View**: `src/views/CanvasView.vue`

---

### **Konva** (`konva: ^9.2.0`)

#### **Purpose**
- **2D Canvas Library**: High-performance 2D canvas rendering
- **Shape Drawing**: Complex shapes, text, and image rendering
- **Animation**: Powerful animation and transition system

#### **Vue Konva Integration** (`vue-konva: ^3.0.2`)

#### **Usage Patterns**
```typescript
// Canvas drawing functionality
import Konva from 'konva'
import { Stage, Layer, Circle, Text } from 'vue-konva'

// Stage setup
<Stage :config="stageConfig">
  <Layer>
    <Circle :config="circleConfig" />
    <Text :config="textConfig" />
  </Layer>
</Stage>

// Shape configuration
const stageConfig = {
  width: 800,
  height: 600
}

const circleConfig = {
  x: 100,
  y: 100,
  radius: 50,
  fill: '#8b5cf6'
}
```

#### **Implementation Locations**
- **Canvas Features**: Advanced drawing capabilities in canvas system
- **Visual Elements**: Custom shapes and graphics
- **Performance**: Optimized rendering for complex visualizations

---

### **Vue Cal** (`vue-cal: ^4.10.2`)

#### **Purpose**
- **Calendar Component**: Full-featured calendar with event display
- **Event Management**: Event creation, editing, and display
- **View Modes**: Month, week, day, and custom view modes

#### **Usage Patterns**
```typescript
import VueCal from 'vue-cal'

<template>
  <vue-cal
    :time="true"
    :events="calendarEvents"
    :disable-days="disableDays"
    @cell-click="onCellClick"
    @event-click="onEventClick"
  />
</template>

// Event data structure
const calendarEvents = ref([
  {
    start: new Date(),
    end: new Date(),
    title: 'Team Meeting',
    content: 'Discuss project progress',
    class: 'meeting-event'
  }
])
```

#### **Implementation Locations**
- **Calendar Alternative**: Alternative calendar implementation
- **Test Component**: `src/router/index.ts` (calendar-test route)
- **Event Display**: Calendar event visualization and interaction

---

### **Qalendar** (`qalendar: ^3.9.0`)

#### **Purpose**
- **Modern Calendar**: Fresh, modern calendar component with Vue 3 support
- **Event Management**: Comprehensive event handling and display
- **Responsive Design**: Mobile-friendly calendar interface

#### **Usage Patterns**
```typescript
import Qalendar from 'qalendar'

<template>
  <Qalendar
    :events="events"
    :selected-date="selectedDate"
    :config="calendarConfig"
    @event-was-clicked="onEventClick"
    @event-was-dropped="onEventDrop"
  />
</template>
```

#### **Implementation Locations**
- **Primary Calendar**: Main calendar implementation in the application
- **Event Scheduling**: Task scheduling and calendar integration
- **Time Management**: Pomodoro session calendar integration

---

## 🗄️ Database & Storage Libraries

### **LocalForage** (`localforage: ^1.10.0`)

#### **Purpose**
- **Offline Storage**: Offline-first storage with IndexedDB fallback
- **Promise API**: Modern Promise-based storage API
- **Data Persistence**: Reliable data persistence across browser sessions

#### **Usage Patterns**
```typescript
// Database abstraction layer (src/composables/useDatabase.ts)
import localforage from 'localforage'

// Generic save operation
export const saveToDatabase = async <T>(key: string, data: T): Promise<void> => {
  try {
    await localforage.setItem(key, data)
  } catch (error) {
    console.error('Failed to save data:', error)
    throw error
  }
}

// Generic load operation
export const loadFromDatabase = async <T>(key: string): Promise<T | null> => {
  try {
    return await localforage.getItem<T>(key)
  } catch (error) {
    console.error('Failed to load data:', error)
    return null
  }
}

// Usage in stores
const saveTasks = async () => {
  await saveToDatabase('tasks', tasks.value)
}

const loadTasks = async () => {
  const savedTasks = await loadFromDatabase<Task[]>('tasks')
  if (savedTasks) {
    tasks.value = savedTasks
  }
}
```

#### **Database Schema**
```typescript
export const DB_KEYS = {
  TASKS: 'tasks',              // Main task storage
  PROJECTS: 'projects',        // Project definitions
  CANVAS: 'canvas',            // Canvas layout data
  TIMER: 'timer',             // Timer session history
  SETTINGS: 'settings',       // App preferences
  VERSION: 'version'          // Schema version tracking
} as const
```

#### **Implementation Locations**
- **Database Layer**: `src/composables/useDatabase.ts`, `src/composables/useBulletproofPersistence.ts`
- **Store Integration**: All Pinia stores for data persistence
- **Data Sync**: Background sync and offline support

---

### **YJS Ecosystem** (Collaborative Editing)

#### **YJS Core** (`yjs: ^13.6.27`)
**Purpose**: Real-time collaborative data structures
```typescript
import * as Y from 'yjs'

// Shared document
const doc = new Y.Doc()
const yText = doc.getText('content')
const yArray = doc.getArray('tasks')

// Real-time updates
yText.observe(() => {
  console.log('Text changed:', yText.toString())
})
```

#### **Y Websocket** (`y-websocket: ^3.0.0`)
**Purpose**: WebSocket provider for YJS
```typescript
import { WebsocketProvider } from 'y-websocket'

const wsProvider = new WebsocketProvider(
  'ws://localhost:1234',
  'pomo-flow-room',
  doc
)
```

#### **Y IndexedDB** (`y-indexeddb: ^9.0.12`)
**Purpose**: IndexedDB persistence provider for YJS
```typescript
import { IndexeddbPersistence } from 'y-indexeddb'

const indexeddbProvider = new IndexeddbPersistence('pomo-flow', doc)
```

#### **Y Protocols** (`y-protocols: ^1.0.6`)
**Purpose**: YJS protocol extensions and utilities
```typescript
import { awarenessProtocol } from 'y-protocols'

const awareness = wsProvider.awareness
awareness.setLocalStateField('user', {
  name: 'John Doe',
  color: '#8b5cf6'
})
```

#### **Implementation Locations**
- **Collaboration Features**: Real-time collaborative editing
- **Canvas System**: Multi-user canvas interactions
- **Data Sync**: Real-time synchronization across devices
- **WebSocket Integration**: Real-time communication layer

---

## 🔐 Authentication & Backend Libraries

### **Firebase** (`firebase: ^12.5.0`)

#### **Purpose**
- **Backend-as-a-Service**: Complete backend infrastructure
- **Authentication**: User authentication and authorization
- **Database**: NoSQL cloud database (Firestore)
- **Hosting**: Static site hosting and deployment

#### **Firebase Authentication** (`firebase/auth`)
```typescript
// Authentication setup (src/config/firebase.ts)
import { getAuth, connectAuthEmulator } from 'firebase/auth'

const auth = getAuth(app)

// Development emulator support
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099')
}
```

#### **Firebase Firestore** (`firebase/firestore`)
```typescript
// Firestore setup (src/config/firebase.ts)
import {
  getFirestore,
  connectFirestoreEmulator,
  enableIndexedDbPersistence,
  enableMultiTabIndexedDbPersistence
} from 'firebase/firestore'

const db = getFirestore(app)

// Offline persistence
enableMultiTabIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    enableIndexedDbPersistence(db!)
  }
})
```

#### **Usage Patterns**
```typescript
// Authentication store (src/stores/auth.ts)
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider
} from 'firebase/auth'

// Firestore operations (src/composables/useFirestore.ts)
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore'

// User data operations
const saveUserProfile = async (userId: string, profile: UserProfile) => {
  await setDoc(doc(db, 'users', userId, 'profile', 'main'), {
    ...profile,
    updatedAt: serverTimestamp()
  })
}
```

#### **Implementation Locations**
- **Configuration**: `src/config/firebase.ts`
- **Authentication**: `src/stores/auth.ts`
- **Firestore Composable**: `src/composables/useFirestore.ts`
- **Firebase Adapter**: `src/composables/adapters/FirebaseAdapter.ts`

---

## 🛠️ Utility & Helper Libraries

### **VueUse** (`@vueuse/core: ^10.11.1`)

#### **Purpose**
- **Composition API Utilities**: Collection of useful Vue Composition API utilities
- **Browser APIs**: Easy access to browser APIs and Web APIs
- **Reactive Helpers**: Reactive helpers for common patterns

#### **Most Used Utilities**
```typescript
// Browser APIs
import {
  useLocalStorage,    // Local storage integration
  useSessionStorage,   // Session storage integration
  useClipboard,        // Clipboard API
  useWindowSize,       // Window size tracking
  useMediaQuery,       // Media query handling
  useEventListener,    // Event listener management
  useFetch,            // Fetch API wrapper
  useInterval,         // Interval management
  useDebounce,         // Debouncing utility
  useThrottle,         // Throttling utility
  useKeyModifier,      // Keyboard modifier tracking
  useMagicKeys,        // Keyboard shortcuts
} from '@vueuse/core'

// Animation utilities
import {
  useTransition,       // Transition management
  useMotion,           // Motion animations
  useSpring,           // Spring animations
} from '@vueuse/motion'

// Gesture utilities
import {
  useSwipe,            // Swipe gestures
  useScroll,           // Scroll tracking
  useDraggable,        // Draggable elements
} from '@vueuse/gesture'
```

#### **Usage Examples**
```typescript
// Local storage for theme preference
const theme = useLocalStorage('theme', 'dark')

// Window size tracking
const { width, height } = useWindowSize()

// Debounced search
const searchQuery = ref('')
const debouncedQuery = useDebounce(searchQuery, 300)

// Keyboard shortcuts
const { ctrl, shift, alt } = useKeyModifier()
const { space, enter } = useMagicKeys({
  passive: false,
  onEventFired(e) {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault()
      saveDocument()
    }
  }
})

// Clipboard operations
const { copy, copied, isSupported } = useClipboard()

// Media queries
const isMobile = useMediaQuery('(max-width: 768px)')
const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
```

#### **Implementation Locations**
- **Used in**: 60+ components throughout the application
- **Common Patterns**: Local storage, event handling, animations
- **Key Features**: Theme switching, keyboard shortcuts, responsive design

---

### **VueUse Gesture** (`@vueuse/gesture: ^2.0.0`)

#### **Purpose**
- **Touch Gestures**: Touch and mouse gesture recognition
- **Drag & Drop**: Enhanced drag and drop functionality
- **User Interaction**: Rich interaction patterns

#### **Usage Examples**
```typescript
import { useSwipe, useDraggable } from '@vueuse/gesture'

// Swipe gestures
const { swipe } = useSwipe(swipeRef, {
  onSwipe: (direction) => {
    if (direction === 'left') nextSlide()
    if (direction === 'right') previousSlide()
  }
})

// Draggable elements
const { x, y, style } = useDraggable(draggableRef, {
  initialValue: { x: 100, y: 100 }
})
```

#### **Implementation Locations**
- **Canvas System**: Touch interactions in canvas
- **Mobile Views**: Swipe gestures for mobile navigation
- **Drag & Drop**: Enhanced drag and drop functionality

---

### **Date Fns** (`date-fns: ^3.6.0`)

#### **Purpose**
- **Date Utilities**: Modern JavaScript date utility library
- **Immutable Operations**: Immutable date manipulation functions
- **Internationalization**: International date formatting

#### **Usage Examples**
```typescript
import {
  format,
  isToday,
  isTomorrow,
  isPast,
  startOfDay,
  endOfDay,
  addDays,
  addWeeks,
  differenceInDays,
  isWithinInterval,
  parseISO
} from 'date-fns'

// Date formatting
const formatDate = (date: Date) => {
  return format(date, 'MMM d, yyyy')
}

// Date comparisons
const isTaskOverdue = (dueDate: string) => {
  const due = parseISO(dueDate)
  return isPast(due) && !isToday(due)
}

// Date calculations
const getNextWeek = () => {
  return addWeeks(new Date(), 1)
}

// Mobile usage examples
import { format, isToday, startOfDay, endOfDay } from 'date-fns'

// Today view mobile
const isCurrentTask = (taskDate: string) => {
  return isToday(parseISO(taskDate))
}
```

#### **Implementation Locations**
- **Mobile Components**: `src/mobile/views/TodayView.vue`, `src/mobile/components/TaskList.vue`
- **Calendar System**: Date calculations and formatting
- **Task Management**: Due date handling and scheduling
- **Date Display**: Consistent date formatting across the app

---

### **UUID** (`uuid: ^9.0.1`)

#### **Purpose**
- **Unique Identifiers**: Generate RFC-compliant UUIDs
- **ID Generation**: Create unique IDs for tasks, projects, and entities
- **Type Safety**: TypeScript definitions included

#### **Usage Examples**
```typescript
import { v4 as uuidv4 } from 'uuid'

// Generate unique task ID
const createTask = (taskData: Partial<Task>) => {
  const task: Task = {
    id: uuidv4(),
    title: taskData.title || '',
    status: 'planned',
    createdAt: new Date(),
    updatedAt: new Date()
  }
  return task
}

// Generate subtask ID
const createSubtask = (parentId: string) => {
  return {
    id: uuidv4(),
    parentTaskId: parentId,
    title: '',
    isCompleted: false,
    createdAt: new Date(),
    updatedAt: new Date()
  }
}
```

#### **Implementation Locations**
- **Task Creation**: All task and subtask creation functions
- **Canvas System**: Node and element ID generation
- **Data Generation**: Test data and mock data creation

---

### **FormKit Auto Animate** (`@formkit/auto-animate: ^0.9.0`)

#### **Purpose**
- **Auto Animation**: Automatic smooth transitions for list changes
- **Reorder Animations**: Smooth animations when reordering items
- **Performance**: Efficient animation system

#### **Usage Examples**
```typescript
import { autoAnimate } from '@formkit/auto-animate'

// Template usage
<template>
  <div ref="listContainer">
    <div v-for="item in items" :key="item.id">
      {{ item.name }}
    </div>
  </div>
</template>

// Script setup
const listContainer = ref<HTMLElement>()
autoAnimate(listContainer)

// When items array changes, reordering is automatically animated
```

#### **Implementation Locations**
- **List Animations**: Task lists, project lists, menu items
- **Dynamic Content**: Reorderable components and dynamic lists
- **User Experience**: Smooth transitions for list changes

---

## 📱 Mobile Development Libraries

### **Capacitor Core** (`@capacitor/core: ^7.4.3`)

#### **Purpose**
- **Cross-Platform Development**: Build native iOS and Android apps with web tech
- **Native APIs**: Access to native device capabilities
- **Plugin System**: Extensible plugin architecture

### **Capacitor CLI** (`@capacitor/cli: ^7.4.3`)

#### **Purpose**
- **Build Tools**: Command-line tools for building and managing mobile apps
- **Plugin Management**: Install and manage Capacitor plugins
- **Platform Sync**: Sync web assets to native projects

### **Capacitor Android** (`@capacitor/android: ^7.4.3`)

#### **Purpose**
- **Android Platform**: Android-specific platform implementation
- **Native Integration**: Android-specific features and APIs

### **Capacitor iOS** (`@capacitor/ios: ^7.4.3`)

#### **Purpose**
- **iOS Platform**: iOS-specific platform implementation
- **Native Integration**: iOS-specific features and APIs

### **Capacitor Local Notifications** (`@capacitor/local-notifications: ^7.0.3`)

#### **Purpose**
- **Local Notifications**: Schedule and display local notifications
- **Notification Management**: Complete notification lifecycle management
- **User Interaction**: Handle notification interactions

#### **Usage Examples**
```typescript
import { LocalNotifications } from '@capacitor/local-notifications'

// Schedule notification
const schedulePomodoroNotification = async () => {
  await LocalNotifications.schedule({
    notifications: [{
      id: 1,
      title: 'Pomodoro Session Complete!',
      body: 'Time to take a break!',
      schedule: { at: new Date(Date.now() + 25 * 60 * 1000) },
      sound: 'default',
      smallIcon: 'ic_stat_notify_24dp'
    }]
  })
}

// Handle notification clicks
LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
  if (notification.notificationId === 1) {
    // Handle pomodoro completion
    startBreakSession()
  }
})
```

#### **Implementation Locations**
- **Mobile Notifications**: `src/mobile/services/notificationService.ts`
- **Timer Integration**: Pomodoro session notifications
- **Mobile Features**: Background notifications for mobile users

### **Capacitor Push Notifications** (`@capacitor/push-notifications: ^7.0.3`)

#### **Purpose**
- **Push Notifications**: Remote push notification support
- **FCM Integration**: Firebase Cloud Messaging integration
- **Background Sync**: Background message handling

#### **Implementation Locations**
- **Push Notifications**: Remote notification system
- **Cloud Sync**: Background synchronization
- **User Engagement**: Remote notifications for task reminders

### **Capacitor Haptics** (`@capacitor/haptics: ^7.0.2`)

#### **Purpose**
- **Haptic Feedback**: Tactile feedback for user interactions
- **Device Vibrations**: Control device vibration patterns
- **User Experience**: Enhanced tactile feedback

#### **Usage Examples**
```typescript
import { Haptics, ImpactStyle } from '@capacitor/haptics'

// Task completion feedback
const notifyTaskCompletion = async () => {
  await Haptics.notification({
    type: 'SUCCESS'
  })
}

// Button press feedback
const handleButtonPress = async () => {
  await Haptics.impact({
    style: ImpactStyle.Light
  })
}
```

#### **Implementation Locations**
- **Mobile UX**: Enhanced user experience on mobile devices
- **Task Actions**: Haptic feedback for task completion
- **User Interactions**: Tactile feedback for button presses and gestures

---

## 🎭 Animation & UI Enhancement Libraries

### **Vue Draggable** (`vuedraggable: ^4.1.0`)

#### **Purpose**
- **Drag & Drop**: Vue component for drag and drop functionality
- **Sortable Lists**: Reorderable lists and containers
- **Touch Support**: Mobile-friendly drag and drop

#### **Usage Examples**
```typescript
import draggable from 'vuedraggable'

// Kanban column
<template>
  <draggable
    v-model="tasks"
    :group="tasks"
    item-key="id"
    @change="onTaskReorder"
    class="task-list"
  >
    <template #item="{ element: task }">
      <TaskCard :task="task" />
    </template>
  </draggable>
</template>

// Swimlane drag and drop
<draggable
  v-model="swimlaneTasks"
  :group="{ name: 'tasks', put: true, pull: clone }"
  class="swimlane-content"
>
  <!-- Task content -->
</draggable>
```

#### **Implementation Locations**
- **Kanban Board**: `src/components/kanban/KanbanColumn.vue`, `src/components/kanban/KanbanSwimlane.vue`
- **Task Reordering**: Drag and drop between columns and swimlanes
- **Project Management**: Project-based task organization

---

## 🧪 Testing & Development Tools

### **Vitest** (`vitest: ^3.2.4`)

#### **Purpose**
- **Unit Testing**: Fast unit test framework with Vite integration
- **TypeScript Support**: First-class TypeScript support
- **Hot Reloading**: Fast test execution with hot reloading

#### **Usage Examples**
```typescript
// Component testing
import { test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TaskCard from '@/components/TaskCard.vue'

test('TaskCard renders task title', () => {
  const wrapper = mount(TaskCard, {
    props: {
      task: { id: '1', title: 'Test Task', status: 'planned' }
    }
  })

  expect(wrapper.text()).toContain('Test Task')
})

// Store testing
import { setActivePinia, createPinia } from 'pinia'
import { useTaskStore } from '@/stores/tasks'

test('TaskStore creates task correctly', () => {
  setActivePinia(createPinia())
  const store = useTaskStore()

  const task = store.createTask({ title: 'New Task' })
  expect(task.title).toBe('New Task')
  expect(task.status).toBe('planned')
})
```

#### **Configuration** (`vitest.config.ts`)
- **Environment**: Node environment for file system access
- **Setup Files**: Global test setup and configuration
- **Browser Testing**: Playwright integration for browser tests

#### **Implementation Locations**
- **Test Files**: `tests/**/*.{test,spec}.{js,ts,jsx,tsx}`
- **Configuration**: `vitest.config.ts`
- **Component Tests**: Unit tests for Vue components and stores

### **Playwright** (`playwright: ^1.56.0`)

#### **Purpose**
- **E2E Testing**: End-to-end testing for web applications
- **Cross-Browser**: Testing across multiple browsers
- **Mobile Testing**: Mobile device emulation and testing

#### **Usage Examples**
```typescript
import { test, expect } from '@playwright/test'

test('Task creation workflow', async ({ page }) => {
  await page.goto('http://localhost:5546')

  // Create task
  await page.fill('[data-testid="quick-task-input"]', 'Test task')
  await page.press('[data-testid="quick-task-input"]', 'Enter')

  // Verify task appears
  await expect(page.locator('[data-testid="task-card"]')).toContainText('Test task')
})
```

#### **Implementation Locations**
- **E2E Tests**: Browser automation tests
- **Visual Testing**: Component visual verification
- **Mobile Testing**: Responsive design testing

---

## 🔧 Build & Development Tools

### **Vite** (`vite: ^7.1.10`)

#### **Purpose**
- **Build Tool**: Fast build tool with modern JavaScript support
- **Development Server**: Hot module replacement and fast development
- **Plugin System**: Extensible plugin architecture

#### **Configuration** (`vite.config.ts`)
```typescript
export default defineConfig({
  plugins: [
    vue(),                                    // Vue SFC support
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
    port: 5546                                 // Fixed development port
  },
  build: {
    minify: 'esbuild',                         // Fast minification
    sourcemap: false,                          // No sourcemaps in production
    target: 'esnext'                           // Modern browser target
  }
})
```

#### **Implementation Locations**
- **Development**: Fast development server with HMR
- **Production**: Optimized production builds
- **Configuration**: Build configuration and optimization

### **TypeScript** (`typescript: ^5.9.3`)

#### **Purpose**
- **Type Safety**: Static type checking for JavaScript
- **Developer Experience**: Enhanced IDE support and autocompletion
- **Code Quality**: Catch errors at compile time

#### **Configuration** (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.tsx", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

#### **Implementation Locations**
- **Type Safety**: All TypeScript files and Vue components
- **Type Definitions**: Custom type definitions for application data
- **Development**: Enhanced IDE support and error catching

---

## 🎯 Type Definition Packages

### **@types/node** (`@types/node: ^24.8.1`)
- **Node.js Types**: TypeScript definitions for Node.js APIs
- **Server Code**: Type safety for server-side code

### **@types/uuid** (`@types/uuid: ^9.0.7`)
- **UUID Types**: TypeScript definitions for UUID library

### **@types/cors** (`@types/cors: ^2.8.19`)
- **CORS Types**: TypeScript definitions for CORS middleware

### **@types/express** (`@types/express: ^5.0.3`)
- **Express Types**: TypeScript definitions for Express.js

---

## 📚 Documentation & Component Tools

### **Storybook** (`storybook: ^9.1.12`)

#### **Purpose**
- **Component Documentation**: Interactive component documentation
- **Design System**: Visual design system documentation
- **Development**: Component development and testing environment

#### **Storybook Addons**
- **@storybook/addon-docs**: Documentation and MDX support
- **@storybook/addon-a11y**: Accessibility testing
- **@storybook/addon-vitest**: Integration with Vitest testing
- **@storybook/vue3-vite**: Vue 3 Vite integration
- **@chromatic-com/storybook**: Visual testing integration

#### **Configuration**
```typescript
// .storybook/main.ts
export default {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-vitest'
  ],
  framework: {
    name: '@storybook/vue3-vite',
    options: {}
  }
}
```

#### **Implementation Locations**
- **Component Stories**: `src/stories/**/*.stories.@(js|jsx|ts|tsx|mdx)`
- **Development**: `npm run storybook` (port 6006)
- **Configuration**: `.storybook/` directory

---

## 📦 MCP (Model Context Protocol) Servers

### **Brave Search MCP Server** (`@brave/brave-search-mcp-server: ^2.0.54`)
- **Search Integration**: Brave Search API integration
- **Web Search**: Web search capabilities for AI assistance
- **Content Discovery**: Enhanced content discovery and research

### **DevTools Debugger MCP** (`devtools-debugger-mcp`)
- **Debugging Tools**: Enhanced debugging capabilities
- **Development Support**: Development workflow integration
- **Error Analysis**: Advanced error analysis and reporting

---

## 🎨 CSS & Styling Libraries

### **Tailwind CSS** (`tailwindcss: ^3.4.0`)

#### **Purpose**
- **Utility-First CSS**: Rapid UI development with utility classes
- **Design System**: Consistent design system implementation
- **Responsive Design**: Mobile-first responsive design

#### **Configuration** (`tailwind.config.js`)
- **Extended Theme**: Custom color palette and design tokens
- **Component Classes**: Pre-built component classes
- **RTL Support**: Right-to-left language support

#### **Tailwind Plugins**
- **@tailwindcss/forms**: Form styling utilities
- **@tailwindcss/typography**: Typography utilities
- **@tailwindcss/aspect-ratio**: Aspect ratio utilities

### **PostCSS** (`postcss: ^8.4.32`)
- **CSS Processing**: Post-processing for CSS
- **Autoprefixer**: Vendor prefixing
- **CSS Optimization**: CSS optimization and minification

### **Autoprefixer** (`autoprefixer: ^10.4.16`)
- **Vendor Prefixes**: Automatic vendor prefixing
- **Browser Compatibility**: Enhanced browser support

---

## 🔍 Code Quality & Linting

### **ESLint** (`eslint: ^8.55.0`)
- **Code Linting**: JavaScript and TypeScript code quality
- **Vue Integration**: Vue-specific linting rules
- **Consistency**: Code consistency and best practices

### **ESLint Plugins**
- **@typescript-eslint/parser**: TypeScript parser
- **@typescript-eslint/plugin**: TypeScript rules
- **@vue/eslint-config-typescript**: Vue TypeScript configuration
- **eslint-plugin-vue**: Vue-specific linting rules
- **eslint-plugin-storybook**: Storybook linting rules

---

## 📊 Usage Summary

### **Library Categories by Count**
- **Vue Ecosystem**: 7 packages (Vue, Router, Pinia, I18n, Test Utils)
- **UI Components**: 4 packages (Naive UI, Headless UI, Heroicons, Lucide)
- **Canvas & Visualization**: 7 packages (Vue Flow ecosystem, Konva, Calendars)
- **Database & Storage**: 6 packages (LocalForage, YJS ecosystem)
- **Authentication**: 1 package (Firebase ecosystem)
- **Utilities**: 7 packages (VueUse ecosystem, Date Fns, UUID, FormKit)
- **Mobile Development**: 6 packages (Capacitor ecosystem)
- **Animation**: 1 package (Vue Draggable)
- **Testing**: 4 packages (Vitest, Playwright, Happy DOM, JSDOM)
- **Build Tools**: 4 packages (Vite, TypeScript, PostCSS, Autoprefixer)
- **Documentation**: 8 packages (Storybook ecosystem)
- **Code Quality**: 5 packages (ESLint ecosystem)
- **Type Definitions**: 3 packages (@types/*)

### **Total Dependencies**
- **Production Dependencies**: 38 packages
- **Development Dependencies**: 47 packages
- **Total Libraries**: 85 packages

---

## 🚀 Integration Patterns

### **Plugin Loading Order**
```typescript
// Critical initialization order (src/main.ts)
1. Vue 3                    // Core framework
2. Pinia                    // State management
3. Vue Router               // Routing
4. Vue I18n                 // Internationalization
5. Firebase                 // Backend services
6. Global error handling    // Error management
7. Keyboard shortcuts       // User interactions
8. App mounting             // Render application
```

### **Import Patterns**
```typescript
// Vue ecosystem
import { ref, computed, onMounted } from 'vue'
import { createRouter } from 'vue-router'
import { defineStore } from 'pinia'
import { useI18n } from 'vue-i18n'

// UI components
import { NButton, NModal } from 'naive-ui'
import { Dialog, Menu } from '@headlessui/vue'
import { Plus, X, Check } from '@heroicons/vue'

// Utilities
import { useLocalStorage, useDebounce } from '@vueuse/core'
import { format, isToday } from 'date-fns'
import { v4 as uuid } from 'uuid'

// Canvas system
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background, Controls, MiniMap } from '@vue-flow/*'

// Database
import localforage from 'localforage'
import * as Y from 'yjs'

// Mobile
import { LocalNotifications, Haptics } from '@capacitor/*'
```

---

**Last Updated**: November 2, 2025
**Library Versions**: Latest stable versions as of package.json
**Integration Status**: All libraries actively integrated and used throughout the application
**Documentation**: Comprehensive usage patterns and implementation details provided