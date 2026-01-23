# Competing Filtering Systems

## Scenario: Task Filtering in Multiple Places

### ❌ BAD - Multiple Filter Implementations

**Component: src/components/TaskList.vue (Inline Filtering)**
```vue
<template>
  <div class="task-list">
    <div class="filters">
      <input
        v-model="filterText"
        type="text"
        placeholder="Search tasks..."
        class="search-input"
      />
      <select v-model="selectedStatus" class="status-filter">
        <option value="">All Status</option>
        <option value="pending">Pending</option>
        <option value="completed">Completed</option>
      </select>
      <select v-model="selectedCategory" class="category-filter">
        <option value="">All Categories</option>
        <option value="work">Work</option>
        <option value="personal">Personal</option>
        <option value="urgent">Urgent</option>
      </select>
    </div>

    <div class="task-items">
      <!-- Inline filtering logic with multiple conditions -->
      <div
        v-for="task in filteredTasks"
        :key="task.id"
        class="task-item"
        :class="{ completed: task.completed }"
      >
        <h3>{{ task.title }}</h3>
        <p>{{ task.description }}</p>
        <span class="category">{{ task.category }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Task } from '@/types';
import { useTaskStore } from '@/stores/TaskStore';

const taskStore = useTaskStore();
const { tasks } = storeToRefs(taskStore);

// Filter state
const filterText = ref('');
const selectedStatus = ref('');
const selectedCategory = ref('');

// Computed filtering with multiple conditions (implementation #1)
const filteredTasks = computed(() => {
  return tasks.value
    .filter(task => {
      // Text search filter
      if (!filterText.value) return true;
      const searchText = filterText.value.toLowerCase();
      return (
        task.title.toLowerCase().includes(searchText) ||
        task.description?.toLowerCase().includes(searchText)
      );
    })
    .filter(task => {
      // Status filter
      if (!selectedStatus.value) return true;
      return selectedStatus.value === 'completed' ? task.completed : !task.completed;
    })
    .filter(task => {
      // Category filter
      if (!selectedCategory.value) return true;
      return task.category === selectedCategory.value;
    })
    .sort((a, b) => {
      // Sorting logic
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
});

// Reactive updates
watch([filterText, selectedStatus, selectedCategory], () => {
  // Optional: trigger analytics or side effects
}, { debounce: 300 });
</script>
```

**Composable: src/composables/useTaskFilter.ts (Filter Logic Composable)**
```typescript
import { ref, computed, watch } from 'vue';
import type { Task, FilterCriteria } from '@/types';

export interface TaskFilterCriteria {
  searchQuery?: string;
  status?: 'all' | 'completed' | 'pending';
  category?: string;
  priority?: 'all' | 'low' | 'medium' | 'high';
  sortBy?: 'date' | 'title' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

export function useTaskFilter(tasks: Ref<Task[]>) {
  const criteria = reactive<TaskFilterCriteria>({
    searchQuery: '',
    status: 'all',
    category: '',
    priority: 'all',
    sortBy: 'date',
    sortOrder: 'desc'
  });

  const loading = ref(false);
  const results = ref<Task[]>([]);

  // Separate filtering implementation (implementation #2)
  const filteredTasks = computed(() => {
    let result = [...tasks.value];

    // Search filter (slightly different logic)
    if (criteria.searchQuery) {
      const query = criteria.searchQuery.toLowerCase();
      result = result.filter(task =>
        task.title.toLowerCase().includes(query) ||
        (task.description && task.description.toLowerCase().includes(query))
      );
    }

    // Status filter (different naming)
    if (criteria.status !== 'all') {
      result = result.filter(task =>
        criteria.status === 'completed' ? task.completed : !task.completed
      );
    }

    // Category filter (same as component)
    if (criteria.category) {
      result = result.filter(task => task.category === criteria.category);
    }

    // Priority filter (additional logic not in component)
    if (criteria.priority !== 'all') {
      result = result.filter(task => task.priority === criteria.priority);
    }

    // Sorting (more flexible than component)
    result.sort((a, b) => {
      let comparison = 0;

      switch (criteria.sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'priority':
          const priorityOrder = { low: 1, medium: 2, high: 3 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case 'date':
        default:
          comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          break;
      }

      return criteria.sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  });

  // Method to update criteria
  const updateCriteria = (newCriteria: Partial<TaskFilterCriteria>) => {
    Object.assign(criteria, newCriteria);
  };

  // Reset filters
  const resetFilters = () => {
    Object.assign(criteria, {
      searchQuery: '',
      status: 'all',
      category: '',
      priority: 'all',
      sortBy: 'date',
      sortOrder: 'desc'
    });
  };

  // Get active filters count
  const activeFiltersCount = computed(() => {
    return Object.values(criteria).filter(value =>
      value !== 'all' && value !== '' && value !== undefined
    ).length;
  });

  // Watch for changes and update results
  watch(filteredTasks, (newResults) => {
    results.value = newResults;
  }, { immediate: true });

  return {
    criteria,
    filteredTasks,
    results,
    loading,
    activeFiltersCount,
    updateCriteria,
    resetFilters
  };
}
```

**Store: src/stores/TaskStore.ts (Store-Based Filtering)**
```typescript
import { defineStore } from 'pinia';
import type { Task, TaskFilter } from '@/types';

export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([]);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  // Filter state in store (third implementation)
  const filters = reactive<TaskFilter>({
    search: '',
    status: 'all',
    category: '',
    priority: 'all',
    tags: []
  });

  // Store-based filtered tasks (implementation #3)
  const filteredTasks = computed(() => {
    return tasks.value
      .filter(task => {
        // Search with different field inclusion
        if (!filters.search) return true;
        const searchLower = filters.search.toLowerCase();
        return (
          task.title.toLowerCase().includes(searchLower) ||
          (task.description && task.description.toLowerCase().includes(searchLower)) ||
          (task.tags && task.tags.some(tag => tag.toLowerCase().includes(searchLower)))
        );
      })
      .filter(task => {
        // Status filtering
        if (filters.status === 'all') return true;
        if (filters.status === 'completed') return task.completed;
        if (filters.status === 'pending') return !task.completed;
        return false;
      })
      .filter(task => {
        // Category filtering
        if (!filters.category) return true;
        return task.category === filters.category;
      })
      .filter(task => {
        // Priority filtering
        if (filters.priority === 'all') return true;
        return task.priority === filters.priority;
      })
      .filter(task => {
        // Tags filtering (unique to store)
        if (filters.tags.length === 0) return true;
        return filters.tags.some(tag => task.tags?.includes(tag));
      });
  });

  // Store methods for filter management
  const setFilter = (key: keyof TaskFilter, value: any) => {
    filters[key] = value;
  };

  const clearFilters = () => {
    Object.assign(filters, {
      search: '',
      status: 'all',
      category: '',
      priority: 'all',
      tags: []
    });
  };

  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(value =>
      value !== 'all' &&
      value !== '' &&
      (Array.isArray(value) ? value.length > 0 : true)
    ).length;
  };

  // Fetch tasks
  const fetchTasks = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await fetch('/api/tasks');
      const data = await response.json();
      tasks.value = data;
    } catch (err) {
      error.value = err as Error;
    } finally {
      loading.value = false;
    }
  };

  return {
    tasks,
    filteredTasks,
    loading,
    error,
    filters,
    setFilter,
    clearFilters,
    getActiveFiltersCount,
    fetchTasks
  };
});
```

### ✅ GOOD - Single Unified Filtering System

**Consolidated: src/composables/useFiltering.ts**
```typescript
import { ref, computed, reactive, watch, type Ref } from 'vue';

export interface FilterConfig<T = any> {
  // Text search configuration
  search?: {
    fields: (keyof T)[];
    fuzzy?: boolean;
    caseSensitive?: boolean;
  };

  // Category/multi-select filters
  categories?: {
    field: keyof T;
    options: Array<{ label: string; value: any; count?: number }>;
    multiple?: boolean;
  };

  // Status filters
  status?: {
    field: keyof T;
    options: Array<{ label: string; value: any; count?: number }>;
  };

  // Range filters (dates, numbers)
  ranges?: {
    [key: string]: {
      field: keyof T;
      min?: number | Date;
      max?: number | Date;
      type: 'number' | 'date';
    };
  };

  // Sort configuration
  sort?: {
    field: keyof T;
    direction: 'asc' | 'desc';
    custom?: (a: any, b: any) => number;
  };
}

export interface FilterState<T = any> {
  search: string;
  categories: any[];
  status: any;
  ranges: Record<string, [any, any]>;
  sort: {
    field: keyof T;
    direction: 'asc' | 'desc';
  };
}

export function useFiltering<T extends Record<string, any>>(
  items: Ref<T[]>,
  config: FilterConfig<T>
) {
  // Initialize filter state based on config
  const state = reactive<FilterState<T>>({
    search: '',
    categories: config.categories?.multiple ? [] : '',
    status: config.status?.options[0]?.value || '',
    ranges: Object.keys(config.ranges || {}).reduce((acc, key) => {
      acc[key] = [config.ranges![key].min, config.ranges![key].max];
      return acc;
    }, {} as Record<string, [any, any]>),
    sort: {
      field: config.sort?.field || 'createdAt' as keyof T,
      direction: config.sort?.direction || 'desc'
    }
  });

  const loading = ref(false);
  const lastFilterTime = ref(0);

  // Memoized filtered results
  const filteredItems = computed(() => {
    const startTime = performance.now();
    loading.value = true;

    let result = [...items.value];

    // Apply search filter
    if (config.search && state.search.trim()) {
      const searchFields = config.search.fields;
      const searchTerm = config.search.caseSensitive
        ? state.search
        : state.search.toLowerCase();

      result = result.filter(item => {
        return searchFields.some(field => {
          const value = item[field];
          if (!value) return false;

          const valueToSearch = config.search.caseSensitive
            ? value.toString()
            : value.toString().toLowerCase();

          if (config.search?.fuzzy) {
            // Fuzzy matching implementation
            return fuzzyMatch(valueToSearch, searchTerm);
          } else {
            // Exact matching
            return valueToSearch.includes(searchTerm);
          }
        });
      });
    }

    // Apply category filters
    if (config.categories && Array.isArray(state.categories)) {
      if (state.categories.length > 0) {
        result = result.filter(item =>
          state.categories.includes(item[config.categories.field])
        );
      }
    } else if (config.categories && state.categories) {
      result = result.filter(item =>
        item[config.categories.field] === state.categories
      );
    }

    // Apply status filter
    if (config.status && state.status && state.status !== 'all') {
      result = result.filter(item =>
        item[config.status.field] === state.status
      );
    }

    // Apply range filters
    if (config.ranges) {
      Object.entries(state.ranges).forEach(([rangeKey, [min, max]]) => {
        const rangeConfig = config.ranges![rangeKey];
        const field = rangeConfig.field;

        result = result.filter(item => {
          const value = item[field];

          if (rangeConfig.type === 'date') {
            const itemDate = new Date(value);
            return (!min || itemDate >= new Date(min)) &&
                   (!max || itemDate <= new Date(max));
          } else {
            return (!min || value >= min) && (!max || value <= max);
          }
        });
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      const { field, direction } = state.sort;

      let comparison: number;

      if (config.sort?.custom && field === config.sort.field) {
        comparison = config.sort.custom(a[field], b[field]);
      } else {
        const aVal = a[field];
        const bVal = b[field];

        // Handle different data types
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          comparison = aVal.localeCompare(bVal);
        } else if (aVal instanceof Date && bVal instanceof Date) {
          comparison = aVal.getTime() - bVal.getTime();
        } else {
          comparison = (aVal || 0) - (bVal || 0);
        }
      }

      return direction === 'asc' ? comparison : -comparison;
    });

    // Calculate filter statistics
    const endTime = performance.now();
    const filterTime = endTime - startTime;
    lastFilterTime.value = filterTime;

    // Small delay to prevent UI flicker for fast filters
    setTimeout(() => {
      loading.value = false;
    }, Math.max(0, 50 - filterTime));

    return result;
  });

  // Filter statistics
  const stats = computed(() => ({
    total: items.value.length,
    filtered: filteredItems.value.length,
    hidden: items.value.length - filteredItems.value.length,
    filterTime: lastFilterTime.value
  }));

  const activeFiltersCount = computed(() => {
    let count = 0;
    if (state.search.trim()) count++;
    if (config.categories) {
      const activeCategories = Array.isArray(state.categories)
        ? state.categories.length
        : (state.categories ? 1 : 0);
      count += activeCategories;
    }
    if (config.status && state.status && state.status !== 'all') count++;
    if (config.ranges) {
      Object.entries(state.ranges).forEach(([rangeKey, [min, max]]) => {
        const rangeConfig = config.ranges![rangeKey];
        const defaultMin = rangeConfig.min;
        const defaultMax = rangeConfig.max;
        if (min !== defaultMin || max !== defaultMax) count++;
      });
    }
    return count;
  });

  // Filter management methods
  const updateSearch = (search: string) => {
    state.search = search;
  };

  const updateCategories = (categories: any | any[]) => {
    state.categories = categories;
  };

  const updateStatus = (status: any) => {
    state.status = status;
  };

  const updateRange = (rangeKey: string, min: any, max: any) => {
    state.ranges[rangeKey] = [min, max];
  };

  const updateSort = (field: keyof T, direction: 'asc' | 'desc') => {
    state.sort.field = field;
    state.sort.direction = direction;
  };

  const resetFilters = () => {
    state.search = '';
    state.categories = config.categories?.multiple ? [] : '';
    state.status = config.status?.options[0]?.value || '';

    // Reset ranges to defaults
    if (config.ranges) {
      Object.keys(config.ranges).forEach(rangeKey => {
        state.ranges[rangeKey] = [config.ranges![rangeKey].min, config.ranges![rangeKey].max];
      });
    }

    // Reset sort to default
    state.sort.field = config.sort?.field || 'createdAt' as keyof T;
    state.sort.direction = config.sort?.direction || 'desc';
  };

  const clearAllFilters = () => {
    resetFilters();
  };

  // Filter preset management
  const savePreset = (name: string) => {
    const preset = {
      name,
      state: JSON.parse(JSON.stringify(state)),
      timestamp: new Date().toISOString()
    };
    const presets = JSON.parse(localStorage.getItem('filter-presets') || '[]');
    presets.push(preset);
    localStorage.setItem('filter-presets', JSON.stringify(presets));
  };

  const loadPreset = (name: string) => {
    const presets = JSON.parse(localStorage.getItem('filter-presets') || '[]');
    const preset = presets.find((p: any) => p.name === name);
    if (preset) {
      Object.assign(state, preset.state);
    }
  };

  const getPresets = () => {
    return JSON.parse(localStorage.getItem('filter-presets') || '[]');
  };

  return {
    // State
    state,
    loading,
    filteredItems,
    stats,
    activeFiltersCount,

    // Methods
    updateSearch,
    updateCategories,
    updateStatus,
    updateRange,
    updateSort,
    resetFilters,
    clearAllFilters,

    // Presets
    savePreset,
    loadPreset,
    getPresets
  };
}

// Helper function for fuzzy matching
function fuzzyMatch(str: string, pattern: string): boolean {
  let patternIdx = 0;
  let strIdx = 0;
  let patternLength = pattern.length;
  let strLength = str.length;

  while (patternIdx < patternLength && strIdx < strLength) {
    if (pattern[patternIdx] === str[strIdx]) {
      patternIdx++;
    }
    strIdx++;
  }

  return patternIdx === patternLength;
}

// Task-specific filtering configuration
export function useTaskFiltering(tasks: Ref<Task[]>) {
  return useFiltering(tasks, {
    search: {
      fields: ['title', 'description', 'tags'],
      fuzzy: true,
      caseSensitive: false
    },
    categories: {
      field: 'category',
      options: [
        { label: 'Work', value: 'work' },
        { label: 'Personal', value: 'personal' },
        { label: 'Urgent', value: 'urgent' },
        { label: 'Learning', value: 'learning' }
      ],
      multiple: true
    },
    status: {
      field: 'status',
      options: [
        { label: 'All', value: 'all' },
        { label: 'Todo', value: 'todo' },
        { label: 'In Progress', value: 'in-progress' },
        { label: 'Completed', value: 'completed' }
      ]
    },
    ranges: {
      dueDate: {
        field: 'dueDate',
        type: 'date'
      },
      priority: {
        field: 'priority',
        type: 'number',
        min: 1,
        max: 5
      }
    },
    sort: {
      field: 'createdAt',
      direction: 'desc'
    }
  });
}
```

**Usage Example:**
```vue
<template>
  <div class="task-list">
    <div class="filters">
      <input
        :value="filtering.state.search"
        @input="filtering.updateSearch($event.target.value)"
        placeholder="Search tasks..."
      />

      <select
        :value="filtering.state.status"
        @change="filtering.updateStatus($event.target.value)"
      >
        <option v-for="option in statusOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>

      <select multiple v-model="filtering.state.categories">
        <option v-for="option in categoryOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>

      <div class="stats">
        {{ filtering.stats.filtered }} of {{ filtering.stats.total }} tasks
        {{ filtering.activeFiltersCount > 0 ? `(${filtering.activeFiltersCount} filters)` : '' }}
      </div>
    </div>

    <div v-if="filtering.loading" class="loading">Filtering...</div>

    <div v-else class="task-items">
      <div
        v-for="task in filtering.filteredItems"
        :key="task.id"
        class="task-item"
      >
        <!-- Task content -->
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTaskStore } from '@/stores/TaskStore';
import { useTaskFiltering } from '@/composables/useFiltering';

const taskStore = useTaskStore();
const { tasks } = storeToRefs(taskStore);

const filtering = useTaskFiltering(tasks);
</script>
```

### Conflict Report

**COMPETING SYSTEM DETECTED**
- **Category**: Filtering & Search Systems
- **Severity**: HIGH

**Conflict Type**: Multiple Filter Implementations
- **Scope**: Task filtering across 3 locations
- **Pattern Match**: 87% code similarity in filter logic

**Files Involved**:
- `src/components/TaskList.vue` (inline filtering - implementation #1)
- `src/composables/useTaskFilter.ts` (composable filtering - implementation #2)
- `src/stores/TaskStore.ts` (store-based filtering - implementation #3)

**Issues Identified**:
1. **Duplicate filtering logic**: 87% code similarity across all three implementations
2. **Inconsistent filter criteria**: Different fields and options in each implementation
3. **Performance issues**: Filtering recalculated in multiple places
4. **Maintenance nightmare**: Filter changes require updates in 3 places
5. **Inconsistent sorting**: Different sorting logic between implementations
6. **Missing features**: Each implementation lacks features from the others
7. **State management confusion**: Filter state scattered across component, composable, and store

**Recommendation**: Consolidate into single unified filtering composable
1. **Create comprehensive useFiltering composable** with all features
2. **Move all filtering logic** out of components and stores
3. **Support flexible configuration** for different data types
4. **Add performance optimizations** (caching, debouncing)
5. **Update all filtering implementations** to use unified system
6. **Add filter presets and persistence** (new features)

**Estimated Effort**: 3-4 hours
- **Core implementation**: 2 hours
- **Migration of components**: 1-2 hours
- **Testing and optimization**: 1 hour

**Risk**: Medium
- **Breaking changes**: Requires updating all filter usage
- **Testing scope**: All filtered components and stores
- **Rollback difficulty**: Medium (can implement gradually)

**Migration Path**:
1. Implement unified useFiltering composable with all features
2. Create specialized wrappers for common use cases (useTaskFiltering)
3. Update TaskList.vue to use new composable
4. Remove filtering logic from TaskStore
5. Update other components with filtering needs
6. Delete useTaskFilter.ts after migration
7. Update team documentation and patterns

**Benefits**:
- **Single source of truth** for all filtering logic
- **Consistent filter API** across the application
- **Reduced code duplication** by 70%
- **Better performance** through optimized filtering
- **Enhanced features** (presets, persistence, statistics)
- **Type safety** with comprehensive configuration
- **Easier maintenance** and feature additions
- **Improved user experience** with loading states and statistics