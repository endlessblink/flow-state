# Competing Side Effects & Lifecycle Conflicts

## Scenario: Multiple Places Fetching Same Data

### ❌ BAD - Side Effects in Multiple Locations

**Component 1: TaskList.vue - onMounted data fetching**
```vue
<template>
  <div class="task-list">
    <div v-if="loading" class="loading">Loading tasks...</div>
    <div v-else>
      <div v-for="task in tasks" :key="task.id" class="task-item">
        {{ task.title }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { Task } from '@/types';

const tasks = ref<Task[]>([]);
const loading = ref(false);
const error = ref<Error | null>(null);

// Side effect #1: Data fetching in component onMounted
onMounted(async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch('/api/tasks');
    const data = await response.json();
    tasks.value = data;
  } catch (err) {
    error.value = err as Error;
    console.error('Failed to fetch tasks in TaskList:', err);
  } finally {
    loading.value = false;
  }
});
</script>
```

**Component 2: TaskSidebar.vue - Another onMounted fetch**
```vue
<template>
  <div class="task-sidebar">
    <div v-if="sidebarLoading" class="loading">Loading...</div>
    <ul v-else>
      <li v-for="task in sidebarTasks" :key="task.id">
        {{ task.title }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import type { Task } from '@/types';

const sidebarTasks = ref<Task[]>([]);
const sidebarLoading = ref(false);

// Side effect #2: Same API call in different component
onMounted(async () => {
  sidebarLoading.value = true;
  try {
    const response = await fetch('/api/tasks');
    const data = await response.json();
    sidebarTasks.value = data.slice(0, 5); // Different slice, same source
  } catch (err) {
    console.error('Failed to fetch tasks in TaskSidebar:', err);
  } finally {
    sidebarLoading.value = false;
  }
});

// Additional side effect: Watching for route changes
watch(() => useRoute().params.category, async (newCategory) => {
  if (newCategory) {
    sidebarLoading.value = true;
    try {
      const response = await fetch(`/api/tasks?category=${newCategory}`);
      const data = await response.json();
      sidebarTasks.value = data;
    } catch (err) {
      console.error('Failed to fetch filtered tasks:', err);
    } finally {
      sidebarLoading.value = false;
    }
  }
});
</script>
```

**Composable: useTask.ts - Fetching in composable**
```typescript
// composables/useTask.ts
import { ref, watch, onMounted, computed } from 'vue';
import type { Task } from '@/types';

export function useTask(taskId?: string) {
  const tasks = ref<Task[]>([]);
  const currentTask = ref<Task | null>(null);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  // Side effect #3: Fetching in composable onMounted
  const fetchTasks = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await fetch('/api/tasks');
      const data = await response.json();
      tasks.value = data;
    } catch (err) {
      error.value = err as Error;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const fetchTask = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await fetch(`/api/tasks/${id}`);
      const data = await response.json();
      currentTask.value = data;
    } catch (err) {
      error.value = err as Error;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // Side effect #4: Auto-fetch on mount
  onMounted(() => {
    fetchTasks();
    if (taskId) {
      fetchTask(taskId);
    }
  });

  // Side effect #5: Watch for task ID changes
  watch(() => taskId, (newId) => {
    if (newId) {
      fetchTask(newId);
    }
  });

  // Side effect #6: Periodic refresh
  const refreshInterval = setInterval(() => {
    fetchTasks();
  }, 60000); // Refresh every minute

  onUnmounted(() => {
    clearInterval(refreshInterval);
  });

  return {
    tasks,
    currentTask,
    loading,
    error,
    fetchTasks,
    fetchTask
  };
}
```

**Store: TaskStore.ts - Store-based fetching**
```typescript
// stores/TaskStore.ts
import { defineStore } from 'pinia';
import type { Task } from '@/types';

export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([]);
  const loading = ref(false);
  const lastFetch = ref<Date | null>(null);

  // Side effect #7: Store method for fetching
  const load = async () => {
    loading.value = true;
    try {
      const response = await fetch('/api/tasks');
      const data = await response.json();
      tasks.value = data;
      lastFetch.value = new Date();
    } catch (error) {
      console.error('Store fetch failed:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  };

  // Side effect #8: Background refresh
  const refreshIfNeeded = async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (!lastFetch.value || lastFetch.value < fiveMinutesAgo) {
      await load();
    }
  };

  // Side effect #9: Watch for store initialization
  const initialize = async () => {
    if (tasks.value.length === 0) {
      await load();
    }
  };

  // Side effect #10: Auto-save to localStorage
  watch(tasks, (newTasks) => {
    localStorage.setItem('cached-tasks', JSON.stringify(newTasks));
  }, { deep: true });

  return {
    tasks,
    loading,
    load,
    refreshIfNeeded,
    initialize
  };
});
```

**App.vue - Root level side effects**
```vue
<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useTaskStore } from '@/stores/TaskStore';

const taskStore = useTaskStore();

// Side effect #11: Global data fetching in root component
onMounted(async () => {
  try {
    // Global initialization
    await taskStore.load();
  } catch (error) {
    console.error('Failed to initialize tasks globally:', error);
  }
});

// Side effect #12: Watch for route changes and refetch
watch(() => useRoute().name, async (newRouteName) => {
  if (newRouteName === 'tasks' || newRouteName === 'home') {
    try {
      await taskStore.refreshIfNeeded();
    } catch (error) {
      console.error('Failed to refresh tasks on route change:', error);
    }
  }
});

// Side effect #13: Network status monitoring
onMounted(() => {
  const handleOnline = async () => {
    console.log('Back online, refreshing tasks...');
    try {
      await taskStore.load();
    } catch (error) {
      console.error('Failed to refresh tasks when back online:', error);
    }
  };

  window.addEventListener('online', handleOnline);
  onUnmounted(() => {
    window.removeEventListener('online', handleOnline);
  });
});
</script>
```

### ✅ GOOD - Single Lifecycle Owner with Centralized Side Effects

**Unified Store: TaskStore.ts - Single owner of task data**
```typescript
// stores/TaskStore.ts
import { defineStore } from 'pinia';
import type { Task, TaskFilter } from '@/types';

export const useTaskStore = defineStore('tasks', () => {
  // Single source of truth for task data
  const tasks = ref<Task[]>([]);
  const loading = ref(false);
  const error = ref<Error | null>(null);
  const lastFetchTime = ref<Date | null>(null);

  // Cache management
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  const isCacheValid = () =>
    lastFetchTime.value &&
    Date.now() - lastFetchTime.value.getTime() < CACHE_DURATION;

  // Centralized fetching logic - single place to fetch tasks
  const fetchTasks = async (forceRefresh = false) => {
    // Prevent duplicate requests
    if (loading.value) return;

    // Use cache if valid and not forcing refresh
    if (!forceRefresh && isCacheValid()) {
      return tasks.value;
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/tasks');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      tasks.value = data;
      lastFetchTime.value = new Date();

      // Cache in localStorage for offline support
      localStorage.setItem('tasks-cache', JSON.stringify({
        data,
        timestamp: lastFetchTime.value.getTime()
      }));

      return data;
    } catch (err) {
      error.value = err as Error;
      console.error('Failed to fetch tasks:', err);

      // Try to load from cache if network fails
      try {
        const cached = localStorage.getItem('tasks-cache');
        if (cached) {
          const { data: cachedData, timestamp } = JSON.parse(cached);
          const cacheAge = Date.now() - timestamp;
          if (cacheAge < CACHE_DURATION * 4) { // Allow older cache when offline
            tasks.value = cachedData;
            lastFetchTime.value = new Date(timestamp);
            console.warn('Using cached tasks due to network error');
          }
        }
      } catch (cacheError) {
        console.error('Failed to load cached tasks:', cacheError);
      }

      throw err;
    } finally {
      loading.value = false;
    }
  };

  // Invalidate cache - forces refresh on next fetch
  const invalidateCache = () => {
    lastFetchTime.value = null;
    localStorage.removeItem('tasks-cache');
  };

  // Background refresh - only one place doing this
  const backgroundRefresh = () => {
    if (!loading.value && document.visibilityState === 'visible') {
      fetchTasks(true).catch(() => {
        // Silent fail for background refresh
      });
    }
  };

  // Task management methods
  const addTask = async (taskData: Partial<Task>) => {
    loading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const newTask = await response.json();
      tasks.value.push(newTask);
      return newTask;
    } catch (err) {
      error.value = err as Error;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    loading.value = true;
    error.value = null;

    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const updatedTask = await response.json();
      const index = tasks.value.findIndex(t => t.id === id);
      if (index !== -1) {
        tasks.value[index] = updatedTask;
      }
      return updatedTask;
    } catch (err) {
      error.value = err as Error;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const deleteTask = async (id: string) => {
    loading.value = true;
    error.value = null;

    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      tasks.value = tasks.value.filter(t => t.id !== id);
    } catch (err) {
      error.value = err as Error;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // Computed derived states
  const completedTasks = computed(() =>
    tasks.value.filter(t => t.completed)
  );

  const pendingTasks = computed(() =>
    tasks.value.filter(t => !t.completed)
  );

  const tasksByCategory = computed(() => {
    const grouped = tasks.value.reduce((acc, task) => {
      const category = task.category || 'uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(task);
      return acc;
    }, {} as Record<string, Task[]>);
    return grouped;
  });

  return {
    // State
    tasks: readonly(tasks),
    loading: readonly(loading),
    error: readonly(error),
    lastFetchTime: readonly(lastFetchTime),

    // Computed
    completedTasks,
    pendingTasks,
    tasksByCategory,
    isCacheValid,

    // Actions
    fetchTasks,
    invalidateCache,
    backgroundRefresh,
    addTask,
    updateTask,
    deleteTask
  };
});
```

**Single lifecycle manager: src/managers/DataManager.ts**
```typescript
// managers/DataManager.ts - Centralized side effect management
import { useTaskStore } from '@/stores/TaskStore';
import { watch, onMounted, onUnmounted } from 'vue';

export class DataManager {
  private taskStore = useTaskStore();
  private refreshInterval: NodeJS.Timeout | null = null;
  private visibilityChangeHandler: (() => void) | null = null;
  private onlineHandler: (() => void) | null = null;
  private routeChangeUnsubscribe: (() => void) | null = null;

  // Centralized initialization - single place for app data loading
  async initialize() {
    console.log('🚀 Initializing DataManager...');

    // Load initial data
    await this.loadInitialData();

    // Set up background refresh
    this.setupBackgroundRefresh();

    // Set up lifecycle listeners
    this.setupLifecycleListeners();

    // Set up route change listeners
    this.setupRouteListeners();

    console.log('✅ DataManager initialized successfully');
  }

  // Single place for initial data loading
  private async loadInitialData() {
    try {
      // Load from cache first for instant UI
      const cached = this.loadFromCache();
      if (cached) {
        console.log('📦 Loaded tasks from cache');
      }

      // Then fetch fresh data
      await this.taskStore.fetchTasks();
      console.log('🔄 Fetched fresh task data');
    } catch (error) {
      console.error('❌ Failed to load initial data:', error);
      // If we have cache, continue anyway
      if (!this.taskStore.tasks.length) {
        throw error;
      }
    }
  }

  // Single background refresh mechanism
  private setupBackgroundRefresh() {
    // Refresh every 5 minutes when tab is visible
    this.refreshInterval = setInterval(() => {
      this.taskStore.backgroundRefresh();
    }, 5 * 60 * 1000);

    // Also refresh when tab becomes visible again
    this.visibilityChangeHandler = () => {
      if (document.visibilityState === 'visible') {
        this.taskStore.backgroundRefresh();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);

    // Refresh when coming back online
    this.onlineHandler = () => {
      console.log('🌐 Back online, refreshing data...');
      this.taskStore.fetchTasks(true).catch(console.error);
    };
    window.addEventListener('online', this.onlineHandler);
  }

  // Single route change handler
  private setupRouteListeners() {
    const router = useRouter();
    const currentRoute = useRoute();

    // Watch for route changes that might require data refresh
    this.routeChangeUnsubscribe = watch(
      () => currentRoute.name,
      async (newRouteName, oldRouteName) => {
        console.log(`🛣️ Route changed: ${oldRouteName} → ${newRouteName}`);

        // Only refresh tasks if navigating to task-related routes
        const taskRoutes = ['tasks', 'home', 'dashboard'];
        if (taskRoutes.includes(newRouteName as string)) {
          await this.taskStore.refreshIfNeeded();
        }
      }
    );
  }

  // Single lifecycle setup
  private setupLifecycleListeners() {
    // Save data before unloading page
    const beforeUnloadHandler = () => {
      this.saveToCache();
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);

    // Cleanup on component unmount
    onUnmounted(() => {
      this.cleanup();
      window.removeEventListener('beforeunload', beforeUnloadHandler);
    });
  }

  // Cache management
  private loadFromCache(): boolean {
    try {
      const cached = localStorage.getItem('tasks-cache');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const cacheAge = Date.now() - timestamp;

        // Use cache if it's less than 1 hour old
        if (cacheAge < 60 * 60 * 1000) {
          // Manually set store state (bypassing fetchTasks to avoid network call)
          this.taskStore.tasks = data;
          this.taskStore.lastFetchTime = new Date(timestamp);
          return true;
        }
      }
    } catch (error) {
      console.warn('Failed to load from cache:', error);
    }
    return false;
  }

  private saveToCache() {
    try {
      if (this.taskStore.tasks.length > 0) {
        localStorage.setItem('tasks-cache', JSON.stringify({
          data: this.taskStore.tasks,
          timestamp: this.taskStore.lastFetchTime?.getTime() || Date.now()
        }));
      }
    } catch (error) {
      console.warn('Failed to save to cache:', error);
    }
  }

  // Cleanup all listeners and intervals
  private cleanup() {
    console.log('🧹 Cleaning up DataManager...');

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }

    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
      this.onlineHandler = null;
    }

    if (this.routeChangeUnsubscribe) {
      this.routeChangeUnsubscribe();
      this.routeChangeUnsubscribe = null;
    }

    // Save final cache state
    this.saveToCache();
  }

  // Force refresh of all data
  async refreshAll() {
    console.log('🔄 Force refreshing all data...');
    this.taskStore.invalidateCache();
    return this.taskStore.fetchTasks(true);
  }
}

// Singleton instance
export const dataManager = new DataManager();

// Composable for easy access in components
export function useDataManager() {
  onMounted(() => {
    dataManager.initialize();
  });

  return {
    dataManager,
    refreshAll: () => dataManager.refreshAll()
  };
}
```

**Updated components - no duplicate side effects:**
```vue
<!-- TaskList.vue - Clean component, just uses store -->
<template>
  <div class="task-list">
    <div v-if="taskStore.loading" class="loading">Loading tasks...</div>
    <div v-else-if="taskStore.error" class="error">
      Error: {{ taskStore.error.message }}
      <button @click="refresh">Retry</button>
    </div>
    <div v-else>
      <div v-for="task in taskStore.tasks" :key="task.id" class="task-item">
        {{ task.title }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTaskStore } from '@/stores/TaskStore';

// No side effects in component - just uses store
const taskStore = useTaskStore();

const refresh = () => {
  taskStore.fetchTasks(true);
};
</script>
```

```vue
<!-- TaskSidebar.vue - Clean component, uses shared store -->
<template>
  <div class="task-sidebar">
    <div v-if="taskStore.loading" class="loading">Loading...</div>
    <ul v-else>
      <li v-for="task in recentTasks" :key="task.id">
        {{ task.title }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useTaskStore } from '@/stores/TaskStore';

// No duplicate data fetching - uses shared store
const taskStore = useTaskStore();

// Derived state from store
const recentTasks = computed(() =>
  taskStore.tasks.slice(0, 5)
);
</script>
```

**App.vue - Single initialization point:**
```vue
<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { useDataManager } from '@/managers/DataManager';

// Single place for app-wide side effects
const { dataManager } = useDataManager();
</script>
```

### Conflict Report

**COMPETING SYSTEM DETECTED**
- **Category**: Side Effects & Lifecycle Conflicts
- **Severity**: HIGH

**Conflict Type**: Duplicate Side Effects
- **Scope**: Data fetching and lifecycle management across 6 locations
- **Pattern Match**: 13 separate side effects for same data

**Files Involved**:
- `src/components/TaskList.vue` (onMounted fetch #1)
- `src/components/TaskSidebar.vue` (onMounted fetch #2)
- `src/composables/useTask.ts` (multiple fetch patterns #3-6)
- `src/stores/TaskStore.ts` (store-based fetching #7-10)
- `App.vue` (global initialization #11-13)

**Issues Identified**:
1. **Race conditions**: Multiple components fetching same data simultaneously
2. **Network waste**: Same API called multiple times on page load
3. **State inconsistency**: Different components might have different task data
4. **Performance problems**: Unnecessary network requests and processing
5. **Cache coordination**: No unified caching strategy
6. **Error handling scattered**: Different error handling in each location
7. **Debugging nightmare**: 13 places to check for data issues
8. **Memory leaks**: Multiple intervals and listeners not properly cleaned up

**Recommendation**: Centralize side effects with single lifecycle owner
1. **Create DataManager** as single owner of task data lifecycle
2. **Move all fetch logic** to TaskStore with caching
3. **Remove all onMounted data fetching** from components
4. **Centralize background refresh** in one place
5. **Coordinate all lifecycle events** through single manager
6. **Update components** to just use store state
7. **Add comprehensive error handling** and retry logic

**Estimated Effort**: 4-6 hours
- **DataManager implementation**: 2 hours
- **Store refactoring**: 2 hours
- **Component cleanup**: 1-2 hours
- **Testing and validation**: 1 hour

**Risk**: Medium
- **Breaking changes**: Components lose their independent fetching
- **Testing scope**: All components that fetch data
- **Rollback difficulty**: Medium (can implement gradually)

**Migration Path**:
1. Implement DataManager with centralized lifecycle management
2. Refactor TaskStore to include caching and unified fetching
3. Update components one by one to remove data fetching
4. Test each updated component thoroughly
5. Remove duplicate fetching from composables
6. Update App.vue to use DataManager
7. Add comprehensive error handling and offline support
8. Deploy with monitoring for data loading issues

**Benefits**:
- **Single source of truth** for task data
- **Eliminated race conditions** and network waste
- **Improved performance** through intelligent caching
- **Better error handling** with centralized retry logic
- **Offline support** with cache management
- **Easier debugging** with single data flow
- **Reduced complexity** in components
- **Better user experience** with loading states and error recovery