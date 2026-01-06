# Code Patterns

## Component Structure
```vue
<script setup lang="ts">
// Imports at top
import { ref, computed, onMounted } from 'vue'
import { useTaskStore } from '@/stores/tasks'

// Props and emits
interface Props {
  taskId: string
  variant?: 'default' | 'compact'
}
const props = withDefaults(defineProps<Props>(), {
  variant: 'default'
})

// Store and composable usage
const taskStore = useTaskStore()
const { createTaskWithUndo } = useUnifiedUndoRedo()

// Reactive state
const isLoading = ref(false)
const localState = computed(() => taskStore.getTask(props.taskId))

// Methods
const handleClick = async () => {
  isLoading.value = true
  try {
    await createTaskWithUndo({ title: 'New Task' })
  } finally {
    isLoading.value = false
  }
}

// Lifecycle
onMounted(() => {
  // Initialization
})
</script>
```

## Store Pattern
```typescript
export const useTaskStore = defineStore('tasks', () => {
  // State
  const tasks = ref<Task[]>([])
  const projects = ref<Project[]>([])

  // Getters
  const activeTasks = computed(() =>
    tasks.value.filter(t => t.status !== 'done')
  )

  // Actions
  const createTask = async (taskData: Partial<Task>) => {
    const task: Task = {
      id: generateId(),
      title: taskData.title || '',
      description: taskData.description || '',
      // ... rest of task
    }
    tasks.value.push(task)
    await saveToDatabase()
    return task
  }

  return {
    tasks,
    activeTasks,
    createTask
  }
})
```

## Best Practices
1. **Composables over Mixins** - Use Vue 3 composables for reusable logic
2. **Pinia for State** - Centralized state management with proper reactivity
3. **Error Boundaries** - Wrap components in error handling
4. **Performance Optimization** - Use computed properties and debounced operations
5. **Accessibility** - Include ARIA labels and keyboard navigation

## Naming Conventions
- **Components**: PascalCase (TaskCard.vue, CalendarView.vue)
- **Composables**: camelCase with `use` prefix (useTaskManager.ts)
- **Stores**: camelCase (taskStore, canvasStore)
- **Utilities**: camelCase (formatDateKey.ts)
- **CSS Classes**: kebab-case with BEM-style modifiers
