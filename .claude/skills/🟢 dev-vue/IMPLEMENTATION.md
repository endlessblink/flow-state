# Vue Component Development

## Quick Start Guide

CREATE Vue 3 components with Composition API and TypeScript. Build reactive components, handle props/events, implement lifecycle hooks, and integrate with Pinia state management and Vue Router. Use when building new UI components, fixing component bugs, or refactoring Vue code.

### When to Use This Skill
- When working with `vue`
- When working with `component`
- When working with `reactive`
- When working with `composable`
- When working with `template`
- When working with `script setup`

### Common Workflows

**Component Creation**
1. Define component interface with TypeScript
2. Set up reactive state with ref() and computed()
3. Implement prop validation and events
4. Add lifecycle hooks (onMounted, onUpdated)
5. Integrate with Pinia stores
6. Test component functionality

**Component Refactoring**
1. Identify performance bottlenecks
2. Extract reusable logic into composables
3. Optimize reactivity patterns
4. Update TypeScript types
5. Validate with testing

### Key Implementation Steps
- Set up Vue 3 component structure with `<script setup lang="ts">`
- Define TypeScript interfaces for props and data
- Import necessary Vue composition functions
- Set up reactive state with `ref()` and `computed()`
- Implement prop validation with `defineProps()`
- Define custom events with `defineEmits()`
- Integrate with Pinia stores using `useStore()`
- Add lifecycle hooks for component initialization
- Follow established component patterns in Pomo-Flow

### Navigation Map
- [Detailed Implementation](./references/detailed-guide.md)
- [Code Examples](./references/examples/)
- [Troubleshooting Guide](./references/troubleshooting.md)
- [Best Practices](./references/best-practices.md)

## Quick Reference

### Essential Commands
```bash
# Common commands for dev-vue
npm run dev              # Start development server
npm run build           # Build for production
npm run test            # Run component tests
npm run lint            # Check code style
```

### Key Files and Patterns
- `src/components/` - Reusable UI components
- `src/views/` - Page-level components
- `src/composables/` - Reusable composition functions
- `src/stores/` - Pinia state management stores

## Dependencies
- `vue` - Vue 3 framework
- `typescript` - TypeScript support
- `pinia` - State management
- `@vueuse/core` - Vue utility composables

## Component Template

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTaskStore } from '@/stores/tasks'

// Props interface
interface Props {
  taskId?: string
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false
})

const emit = defineEmits<{
  update: [task: Task]
  delete: [id: string]
}>()

// Store integration
const taskStore = useTaskStore()

// Reactive state
const isLoading = ref(false)
const localData = ref({})

// Computed properties
const filteredTasks = computed(() =>
  taskStore.tasks.filter(task => task.status === 'active')
)

// Methods
const handleUpdate = (task: Task) => {
  emit('update', task)
}

// Lifecycle
onMounted(() => {
  taskStore.loadTasks()
})
</script>
```

## Common Patterns

### Store Integration
```typescript
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useTimerStore } from '@/stores/timer'

const taskStore = useTaskStore()
const canvasStore = useCanvasStore()
const timerStore = useTimerStore()
```

### VueUse Integration
```typescript
import { useDark, useToggle, onClickOutside } from '@vueuse/core'

const isDark = useDark()
const toggleDark = useToggle(isDark)
const modalRef = ref<HTMLElement>()
onClickOutside(modalRef, () => closeModal())
```