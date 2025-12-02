# Competing Reactive State Management Patterns

## Scenario: Mixed Reactive Patterns in Same Codebase

### ❌ BAD - Multiple Ways to Create Reactive State

**Pattern 1: Direct reactive() in stores**
```typescript
// stores/GlobalState.ts
import { reactive } from 'vue';

export const globalState = reactive({
  user: null,
  theme: 'light',
  sidebarOpen: true,
  notifications: [],
  loading: false,
  error: null
});

// Different mutation patterns
export const mutations = {
  setUser(user: User) {
    globalState.user = user;
  },
  setTheme(theme: string) {
    globalState.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
  },
  toggleSidebar() {
    globalState.sidebarOpen = !globalState.sidebarOpen;
  },
  addNotification(notification: Notification) {
    globalState.notifications.push(notification);
  },
  setLoading(loading: boolean) {
    globalState.loading = loading;
  },
  setError(error: Error | null) {
    globalState.error = error;
  }
};
```

**Pattern 2: ref() + value in components**
```typescript
// components/UserProfile.vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue';

const user = ref<User | null>(null);
const theme = ref<'light' | 'dark'>('light');
const sidebarOpen = ref(true);
const notifications = ref<Notification[]>([]);
const loading = ref(false);
const error = ref<Error | null>(null);

// Duplicate state management with different API
const fetchUserProfile = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch('/api/user/profile');
    const userData = await response.json();
    user.value = userData;
  } catch (err) {
    error.value = err as Error;
  } finally {
    loading.value = false;
  }
};

// Theme management different from global state
const toggleTheme = () => {
  theme.value = theme.value === 'light' ? 'dark' : 'light';
  localStorage.setItem('theme', theme.value);
  updateThemeClasses(theme.value);
};

const updateThemeClasses = (newTheme: string) => {
  document.documentElement.setAttribute('data-theme', newTheme);
};

// Sidebar state different from global
const toggleSidebar = () => {
  sidebarOpen.value = !sidebarOpen.value;
  localStorage.setItem('sidebar-open', String(sidebarOpen.value));
};
</script>
```

**Pattern 3: Pinia store with mixed reactive patterns**
```typescript
// stores/UIStore.ts
import { defineStore } from 'pinia';
import { ref, reactive, computed } from 'vue';

export const useUIStore = defineStore('ui', () => {
  // Mix of ref and reactive in same store
  const theme = ref<'light' | 'dark'>('light');
  const sidebarOpen = ref(true);

  // Some state as reactive object
  const layout = reactive({
    headerHeight: 64,
    sidebarWidth: 280,
    contentPadding: 24
  });

  // More ref state
  const notifications = ref<Notification[]>([]);
  const modals = ref<Record<string, boolean>>({});
  const loading = ref<Record<string, boolean>>({});

  // Computed derived state
  const isDarkMode = computed(() => theme.value === 'dark');
  const hasNotifications = computed(() => notifications.value.length > 0);
  const activeModals = computed(() => Object.values(modals.value).some(Boolean));

  // Different mutation patterns
  function setTheme(newTheme: 'light' | 'dark') {
    theme.value = newTheme;
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  }

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value;
    localStorage.setItem('sidebar-open', String(sidebarOpen.value));
  }

  function updateLayout(updates: Partial<typeof layout>) {
    Object.assign(layout, updates);
  }

  function addNotification(notification: Notification) {
    notifications.value.push(notification);
    if (notification.autoRemove) {
      setTimeout(() => removeNotification(notification.id), 5000);
    }
  }

  function removeNotification(id: string) {
    notifications.value = notifications.value.filter(n => n.id !== id);
  }

  function openModal(modalId: string) {
    modals.value[modalId] = true;
  }

  function closeModal(modalId: string) {
    modals.value[modalId] = false;
  }

  function setLoading(key: string, isLoading: boolean) {
    loading.value[key] = isLoading;
  }

  return {
    // Ref state
    theme: readonly(theme),
    sidebarOpen: readonly(sidebarOpen),
    notifications: readonly(notifications),
    modals: readonly(modals),
    loading: readonly(loading),

    // Reactive object
    layout: readonly(layout),

    // Computed
    isDarkMode,
    hasNotifications,
    activeModals,

    // Actions
    setTheme,
    toggleSidebar,
    updateLayout,
    addNotification,
    removeNotification,
    openModal,
    closeModal,
    setLoading
  };
});
```

**Pattern 4: shallowReactive() in some places**
```typescript
// composables/useCache.ts
import { shallowReactive } from 'vue';

const cache = shallowReactive<Record<string, any>>({});

export function useCache() {
  const get = (key: string) => {
    return cache[key];
  };

  const set = (key: string, value: any, ttl?: number) => {
    cache[key] = {
      value,
      expires: ttl ? Date.now() + ttl * 1000 : null
    };
  };

  const remove = (key: string) => {
    delete cache[key];
  };

  const clear = () => {
    Object.keys(cache).forEach(key => delete cache[key]);
  };

  const isExpired = (key: string) => {
    const item = cache[key];
    return item && item.expires && Date.now() > item.expires;
  };

  const cleanup = () => {
    Object.keys(cache).forEach(key => {
      if (isExpired(key)) {
        delete cache[key];
      }
    });
  };

  // Auto cleanup every 5 minutes
  setInterval(cleanup, 300000);

  return {
    get,
    set,
    remove,
    clear,
    isExpired,
    cleanup
  };
}
```

**Pattern 5: Manual class with reactive()**
```typescript
// classes/TaskManager.ts
import { reactive, watch } from 'vue';

export class TaskManager {
  private _state = reactive({
    tasks: [],
    filter: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    loading: false,
    error: null
  });

  get tasks() {
    return this._state.tasks;
  }

  get filter() {
    return this._state.filter;
  }

  get loading() {
    return this._state.loading;
  }

  get error() {
    return this._state.error;
  }

  get filteredTasks() {
    return this.tasks
      .filter(task =>
        !this.filter ||
        task.title.toLowerCase().includes(this.filter.toLowerCase()) ||
        task.description?.toLowerCase().includes(this.filter.toLowerCase())
      )
      .sort((a, b) => {
        const order = this._state.sortOrder === 'asc' ? 1 : -1;
        switch (this._state.sortBy) {
          case 'title':
            return a.title.localeCompare(b.title) * order;
          case 'priority':
            return b.priority - a.priority;
          default:
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
      });
  }

  setFilter(filter: string) {
    this._state.filter = filter;
  }

  setSorting(sortBy: string, sortOrder: string) {
    this._state.sortBy = sortBy;
    this._state.sortOrder = sortOrder;
  }

  async addTask(task: Partial<Task>) {
    this._state.loading = true;
    this._state.error = null;
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(task)
      });
      const newTask = await response.json();
      this._state.tasks.push(newTask);
      return newTask;
    } catch (error) {
      this._state.error = error;
      throw error;
    } finally {
      this._state.loading = false;
    }
  }

  removeTask(taskId: string) {
    this._state.tasks = this._state.tasks.filter(t => t.id !== taskId);
  }

  updateTask(taskId: string, updates: Partial<Task>) {
    const index = this._state.tasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
      this._state.tasks[index] = { ...this._state.tasks[index], ...updates };
    }
  }

  async fetchTasks() {
    this._state.loading = true;
    this._state.error = null;
    try {
      const response = await fetch('/api/tasks');
      const tasks = await response.json();
      this._state.tasks = tasks;
    } catch (error) {
      this._state.error = error;
      throw error;
    } finally {
      this._state.loading = false;
    }
  }

  // Watch for changes and persist to localStorage
  constructor() {
    watch(() => this._state.tasks, (tasks) => {
      localStorage.setItem('tasks', JSON.stringify(tasks));
    }, { deep: true });
  }
}
```

### ✅ GOOD - Consistent Reactive Pattern

**Unified: Composables for reactive state, Pinia for shared state**

**Global app state with Pinia (shared state):**
```typescript
// stores/AppStore.ts
import { defineStore } from 'pinia';
import type { User, Notification } from '@/types';

export const useAppStore = defineStore('app', () => {
  // Use ref() for primitive values - consistent pattern
  const user = ref<User | null>(null);
  const theme = ref<'light' | 'dark'>('light');
  const sidebarOpen = ref(true);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  // Use ref() for arrays - consistent pattern
  const notifications = ref<Notification[]>([]);

  // Computed derived values
  const isAuthenticated = computed(() => !!user.value);
  const isDarkMode = computed(() => theme.value === 'dark');
  const hasNotifications = computed(() => notifications.value.length > 0);

  // Actions for state mutations
  function setUser(newUser: User | null) {
    user.value = newUser;
    if (newUser) {
      localStorage.setItem('user', JSON.stringify(newUser));
    } else {
      localStorage.removeItem('user');
    }
  }

  function setTheme(newTheme: 'light' | 'dark') {
    theme.value = newTheme;
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  }

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value;
    localStorage.setItem('sidebar-open', String(sidebarOpen.value));
  }

  function setLoading(isLoading: boolean) {
    loading.value = isLoading;
  }

  function setError(newError: Error | null) {
    error.value = newError;
  }

  function addNotification(notification: Notification) {
    notifications.value.push(notification);

    // Auto-remove notification after delay
    if (notification.autoRemove !== false) {
      setTimeout(() => {
        removeNotification(notification.id);
      }, notification.duration || 5000);
    }
  }

  function removeNotification(id: string) {
    notifications.value = notifications.value.filter(n => n.id !== id);
  }

  function clearNotifications() {
    notifications.value = [];
  }

  // Initialize state from localStorage
  function initializeFromStorage() {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      theme.value = savedTheme;
      document.documentElement.setAttribute('data-theme', savedTheme);
    }

    const savedSidebarOpen = localStorage.getItem('sidebar-open');
    if (savedSidebarOpen !== null) {
      sidebarOpen.value = savedSidebarOpen === 'true';
    }

    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        user.value = JSON.parse(savedUser);
      } catch {
        localStorage.removeItem('user');
      }
    }
  }

  // Logout function
  function logout() {
    user.value = null;
    theme.value = 'light';
    sidebarOpen.value = true;
    notifications.value = [];
    loading.value = false;
    error.value = null;

    localStorage.clear();
    document.documentElement.setAttribute('data-theme', 'light');
  }

  return {
    // State (readonly)
    user: readonly(user),
    theme: readonly(theme),
    sidebarOpen: readonly(sidebarOpen),
    loading: readonly(loading),
    error: readonly(error),
    notifications: readonly(notifications),

    // Computed
    isAuthenticated,
    isDarkMode,
    hasNotifications,

    // Actions
    setUser,
    setTheme,
    toggleSidebar,
    setLoading,
    setError,
    addNotification,
    removeNotification,
    clearNotifications,
    initializeFromStorage,
    logout
  };
});
```

**Composables for local component state:**
```typescript
// composables/useLocalState.ts
import { ref, computed, type Ref } from 'vue';

/**
 * Generic composable for managing local component state
 * Consistent use of ref() for all local state
 */
export function useLocalState<T extends Record<string, any>>(
  initialState: T
) {
  // Create refs for all initial state properties
  const state = {} as { [K in keyof T]: Ref<T[K]> };

  Object.keys(initialState).forEach(key => {
    const typedKey = key as keyof T;
    state[typedKey] = ref(initialState[typedKey]) as Ref<T[typeof typedKey]>;
  });

  // Computed for checking if state is dirty
  const isDirty = computed(() => {
    return Object.keys(state).some(key => {
      const typedKey = key as keyof T;
      return state[typedKey].value !== initialState[typedKey];
    });
  });

  // Method to reset state
  const reset = () => {
    Object.keys(state).forEach(key => {
      const typedKey = key as keyof T;
      state[typedKey].value = initialState[typedKey];
    });
  };

  // Method to get current state as object
  const getState = (): T => {
    const result = {} as T;
    Object.keys(state).forEach(key => {
      const typedKey = key as keyof T;
      result[typedKey] = state[typedKey].value;
    });
    return result;
  };

  return {
    state,
    isDirty,
    reset,
    getState
  };
}

/**
 * Composable for managing form state consistently
 */
export function useFormState<T extends Record<string, any>>(
  initialValues: T,
  validation?: (values: T) => Partial<Record<keyof T, string>>
) {
  const { state, isDirty, reset, getState } = useLocalState(initialValues);
  const errors = ref<Partial<Record<keyof T, string>>>({});
  const touched = ref<Partial<Record<keyof T, boolean>>>({});
  const isSubmitting = ref(false);

  // Validate specific field
  const validateField = (field: keyof T) => {
    if (!validation) return true;

    const validationErrors = validation(getState());
    const fieldError = validationErrors[field];

    if (fieldError) {
      errors.value[field] = fieldError;
      return false;
    } else {
      delete errors.value[field];
      return true;
    }
  };

  // Validate all fields
  const validateAll = () => {
    if (!validation) return true;

    const validationErrors = validation(getState());
    errors.value = validationErrors;
    return Object.keys(validationErrors).length === 0;
  };

  // Update field value and mark as touched
  const setFieldValue = (field: keyof T, value: T[keyof T]) => {
    state[field].value = value;
    touched.value[field] = true;

    // Validate field if it has been touched
    if (touched.value[field]) {
      validateField(field);
    }
  };

  // Check if field has error
  const hasError = (field: keyof T) => !!errors.value[field];

  // Get error message for field
  const getError = (field: keyof T) => errors.value[field];

  // Check if field is touched
  const isTouched = (field: keyof T) => !!touched.value[field];

  // Check if form is valid
  const isValid = computed(() => Object.keys(errors.value).length === 0);

  // Submit form
  const submit = async (onSubmit: (values: T) => Promise<void>) => {
    // Mark all fields as touched
    Object.keys(state).forEach(key => {
      touched.value[key as keyof T] = true;
    });

    if (!validateAll()) {
      return false;
    }

    isSubmitting.value = true;
    try {
      await onSubmit(getState());
      return true;
    } catch (error) {
      console.error('Form submission failed:', error);
      return false;
    } finally {
      isSubmitting.value = false;
    }
  };

  return {
    state,
    errors,
    touched,
    isSubmitting,
    isDirty,
    isValid,
    setFieldValue,
    validateField,
    validateAll,
    hasError,
    getError,
    isTouched,
    submit,
    reset
  };
}

/**
 * Cache composable using ref() instead of shallowReactive()
 */
export function useCache() {
  const cache = ref<Record<string, { value: any; expires: number | null }>>({});

  const get = (key: string) => {
    const item = cache.value[key];
    if (!item) return null;

    if (item.expires && Date.now() > item.expires) {
      remove(key);
      return null;
    }

    return item.value;
  };

  const set = (key: string, value: any, ttl?: number) => {
    cache.value[key] = {
      value,
      expires: ttl ? Date.now() + ttl * 1000 : null
    };
  };

  const remove = (key: string) => {
    delete cache.value[key];
  };

  const clear = () => {
    cache.value = {};
  };

  const isExpired = (key: string) => {
    const item = cache.value[key];
    return item && item.expires && Date.now() > item.expires;
  };

  const cleanup = () => {
    Object.keys(cache.value).forEach(key => {
      if (isExpired(key)) {
        remove(key);
      }
    });
  };

  // Auto cleanup every 5 minutes
  const cleanupInterval = setInterval(cleanup, 300000);

  // Cleanup interval on unmount
  onUnmounted(() => {
    clearInterval(cleanupInterval);
  });

  return {
    get,
    set,
    remove,
    clear,
    isExpired,
    cleanup
  };
}
```

**Component usage examples:**
```vue
<!-- UserProfile.vue - Using consistent patterns -->
<template>
  <div class="user-profile">
    <!-- Use shared state from Pinia -->
    <div class="theme-toggle">
      <button @click="appStore.toggleTheme">
        {{ appStore.isDarkMode ? '🌙' : '☀️' }}
      </button>
    </div>

    <!-- Use local form state -->
    <form @submit.prevent="handleSubmit">
      <input
        v-model="formState.state.name.value"
        @blur="formState.validateField('name')"
        :class="{ error: formState.hasError('name') }"
        placeholder="Name"
      />
      <span v-if="formState.hasError('name')" class="error-message">
        {{ formState.getError('name') }}
      </span>

      <button type="submit" :disabled="formState.isSubmitting.value">
        {{ formState.isSubmitting.value ? 'Saving...' : 'Save' }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '@/stores/AppStore';
import { useFormState } from '@/composables/useLocalState';

// Use shared state consistently
const appStore = useAppStore();

// Use local form state consistently
const formState = useFormState({
  name: '',
  email: '',
  bio: ''
}, (values) => {
  const errors: Record<string, string> = {};
  if (!values.name || values.name.length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }
  if (!values.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = 'Please enter a valid email';
  }
  return errors;
});

const handleSubmit = async () => {
  await formState.submit(async (values) => {
    appStore.setLoading(true);
    try {
      await updateUserProfile(values);
      appStore.addNotification({
        id: Date.now().toString(),
        type: 'success',
        message: 'Profile updated successfully'
      });
    } finally {
      appStore.setLoading(false);
    }
  });
};
</script>
```

### Conflict Report

**COMPETING SYSTEM DETECTED**
- **Category**: Reactive State Management Conflicts
- **Severity**: MEDIUM

**Conflict Type**: Mixed Reactive Patterns
- **Scope**: State creation and management across application
- **Pattern Match**: 92% inconsistency in reactive patterns

**Files Involved**:
- `stores/GlobalState.ts` (reactive() pattern)
- `components/UserProfile.vue` (ref() pattern)
- `stores/UIStore.ts` (mixed ref/reactive pattern)
- `composables/useCache.ts` (shallowReactive() pattern)
- `classes/TaskManager.ts` (class + reactive() pattern)

**Issues Identified**:
1. **Inconsistent reactive API usage**: 5 different patterns for creating reactive state
2. **Predictability problems**: Team doesn't know which pattern to use when
3. **Performance confusion**: Unnecessary use of shallowReactive vs reactive vs ref
4. **Debugging difficulty**: Different patterns require different debugging approaches
5. **Type inconsistency**: Different typing patterns across implementations
6. **Memory leaks**: Inconsistent cleanup patterns
7. **Testing complexity**: Different mocking patterns for each reactive type

**Recommendation**: Standardize on consistent reactive patterns
1. **Use ref() for all primitives and arrays** - most predictable
2. **Use reactive() only for complex objects** - when needed for deep reactivity
3. **Use Pinia stores for shared state** - consistent across application
4. **Use composables for local state** - reusable and consistent
5. **Avoid shallowReactive unless performance-critical**
6. **Avoid class-based state management** - inconsistent with Vue 3 patterns

**Estimated Effort**: 2-3 hours
- **Create consistent patterns**: 1 hour
- **Migrate existing code**: 1-2 hours
- **Update team guidelines**: 30 minutes

**Risk**: Low
- **Breaking changes**: Minimal, mostly internal refactoring
- **Testing scope**: Components using mixed patterns
- **Rollback difficulty**: Easy (can change back gradually)

**Migration Path**:
1. Create unified reactive composables (useLocalState, useFormState)
2. Update all reactive() usage to ref() or composables
3. Replace shallowReactive() with ref() alternatives
4. Refactor class-based state to composables or stores
5. Update component implementations to use consistent patterns
6. Add team documentation and guidelines
7. Audit codebase for remaining inconsistencies

**Benefits**:
- **Predictable state management** across entire application
- **Easier onboarding** for new developers
- **Better debugging** with consistent patterns
- **Improved performance** through appropriate reactivity usage
- **Cleaner code** with standardized patterns
- **Easier testing** with consistent mocking strategies
- **Better TypeScript support** with unified patterns