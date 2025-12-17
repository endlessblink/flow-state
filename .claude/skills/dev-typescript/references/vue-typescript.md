# Vue 3 + TypeScript Reference

## defineProps

### Type-Based Declaration (Recommended)

```typescript
<script setup lang="ts">
// Simple props
const props = defineProps<{
  title: string
  count: number
  isActive?: boolean  // Optional
}>()

// Using an interface (better for complex props)
interface Props {
  title: string
  count: number
  items: string[]
  user?: {
    id: string
    name: string
  }
}

const props = defineProps<Props>()
</script>
```

### With Default Values (withDefaults)

```typescript
<script setup lang="ts">
interface Props {
  title: string
  count?: number
  items?: string[]
  config?: { theme: string }
}

const props = withDefaults(defineProps<Props>(), {
  count: 0,
  // IMPORTANT: Wrap arrays/objects in functions!
  items: () => [],
  config: () => ({ theme: 'light' })
})

// props.count is number, not number | undefined
// props.items is string[], not string[] | undefined
</script>
```

### Imported Types (Vue 3.3+)

```typescript
// types/props.ts
export interface TaskProps {
  id: string
  title: string
  status: 'pending' | 'done'
}

// Component.vue
<script setup lang="ts">
import type { TaskProps } from '@/types/props'

const props = defineProps<TaskProps>()
</script>
```

---

## defineEmits

### Old Syntax (Vue 3.2)

```typescript
<script setup lang="ts">
const emit = defineEmits<{
  (e: 'update', value: string): void
  (e: 'delete', id: string): void
  (e: 'select', items: string[]): void
}>()

emit('update', 'new value')
emit('delete', '123')
</script>
```

### New Simplified Syntax (Vue 3.3+)

```typescript
<script setup lang="ts">
// Cleaner tuple syntax
const emit = defineEmits<{
  update: [value: string]
  delete: [id: string]
  select: [items: string[], source: 'click' | 'keyboard']
}>()

emit('update', 'new value')
emit('select', ['a', 'b'], 'click')
</script>
```

### With Validation

```typescript
<script setup lang="ts">
const emit = defineEmits({
  // Runtime validation
  update: (value: string) => {
    if (value.length === 0) {
      console.warn('Empty value')
      return false
    }
    return true
  }
})
</script>
```

---

## defineModel (Vue 3.4+)

Two-way binding made easy:

```typescript
<script setup lang="ts">
// Basic usage
const modelValue = defineModel<string>()

// With default
const modelValue = defineModel<string>({ default: '' })

// Named model
const title = defineModel<string>('title')
const count = defineModel<number>('count', { default: 0 })

// Required model
const value = defineModel<string>({ required: true })
</script>

<template>
  <input v-model="modelValue" />
</template>
```

---

## Template Refs

### Single Element Ref

```typescript
<script setup lang="ts">
import { ref, onMounted } from 'vue'

// Type the ref explicitly
const inputRef = ref<HTMLInputElement | null>(null)

onMounted(() => {
  // Always check for null
  inputRef.value?.focus()
})
</script>

<template>
  <input ref="inputRef" />
</template>
```

### Component Ref

```typescript
<script setup lang="ts">
import { ref } from 'vue'
import MyComponent from './MyComponent.vue'

// Use InstanceType for component refs
const componentRef = ref<InstanceType<typeof MyComponent> | null>(null)

function callMethod() {
  componentRef.value?.someMethod()
}
</script>

<template>
  <MyComponent ref="componentRef" />
</template>
```

### Multiple Refs (v-for)

```typescript
<script setup lang="ts">
import { ref } from 'vue'

const itemRefs = ref<HTMLDivElement[]>([])

function setItemRef(el: HTMLDivElement | null, index: number) {
  if (el) {
    itemRefs.value[index] = el
  }
}
</script>

<template>
  <div v-for="(item, index) in items" :ref="el => setItemRef(el, index)">
    {{ item }}
  </div>
</template>
```

---

## Pinia Store Typing

### Setup Store Syntax (Recommended)

```typescript
// stores/tasks.ts
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export interface Task {
  id: string
  title: string
  completed: boolean
}

export const useTaskStore = defineStore('tasks', () => {
  // State
  const tasks = ref<Task[]>([])
  const isLoading = ref(false)

  // Getters
  const completedTasks = computed(() =>
    tasks.value.filter(t => t.completed)
  )

  const taskById = computed(() => {
    return (id: string) => tasks.value.find(t => t.id === id)
  })

  // Actions
  async function fetchTasks(): Promise<void> {
    isLoading.value = true
    try {
      const response = await fetch('/api/tasks')
      tasks.value = await response.json()
    } finally {
      isLoading.value = false
    }
  }

  function addTask(task: Omit<Task, 'id'>): Task {
    const newTask: Task = {
      id: crypto.randomUUID(),
      ...task
    }
    tasks.value.push(newTask)
    return newTask
  }

  function updateTask(id: string, updates: Partial<Task>): void {
    const index = tasks.value.findIndex(t => t.id === id)
    if (index !== -1) {
      tasks.value[index] = { ...tasks.value[index], ...updates }
    }
  }

  return {
    // State
    tasks,
    isLoading,
    // Getters
    completedTasks,
    taskById,
    // Actions
    fetchTasks,
    addTask,
    updateTask
  }
})
```

### Using Store in Components

```typescript
<script setup lang="ts">
import { useTaskStore } from '@/stores/tasks'
import { storeToRefs } from 'pinia'

const taskStore = useTaskStore()

// For reactive state/getters, use storeToRefs
const { tasks, completedTasks, isLoading } = storeToRefs(taskStore)

// Actions can be destructured directly
const { fetchTasks, addTask } = taskStore

async function handleCreate() {
  const task = addTask({ title: 'New Task', completed: false })
  console.log('Created:', task.id)
}
</script>
```

---

## Composable Return Types

### Explicit Return Type

```typescript
// composables/useCounter.ts
import { ref, computed, type Ref, type ComputedRef } from 'vue'

interface UseCounterReturn {
  count: Ref<number>
  doubled: ComputedRef<number>
  increment: () => void
  decrement: () => void
  reset: () => void
}

export function useCounter(initial = 0): UseCounterReturn {
  const count = ref(initial)
  const doubled = computed(() => count.value * 2)

  function increment() { count.value++ }
  function decrement() { count.value-- }
  function reset() { count.value = initial }

  return { count, doubled, increment, decrement, reset }
}
```

### Generic Composables

```typescript
// composables/useAsyncData.ts
import { ref, type Ref } from 'vue'

interface UseAsyncDataReturn<T> {
  data: Ref<T | null>
  error: Ref<Error | null>
  isLoading: Ref<boolean>
  execute: () => Promise<void>
}

export function useAsyncData<T>(
  fetcher: () => Promise<T>
): UseAsyncDataReturn<T> {
  const data = ref<T | null>(null) as Ref<T | null>
  const error = ref<Error | null>(null)
  const isLoading = ref(false)

  async function execute() {
    isLoading.value = true
    error.value = null
    try {
      data.value = await fetcher()
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
    } finally {
      isLoading.value = false
    }
  }

  return { data, error, isLoading, execute }
}

// Usage
const { data: users, isLoading, execute: fetchUsers } = useAsyncData<User[]>(
  () => fetch('/api/users').then(r => r.json())
)
```

---

## Event Handling

### Native Events

```typescript
<script setup lang="ts">
function handleClick(event: MouseEvent) {
  console.log(event.clientX, event.clientY)
}

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  console.log(target.value)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    // Submit
  }
}

function handleSubmit(event: Event) {
  event.preventDefault()
  const form = event.target as HTMLFormElement
  const formData = new FormData(form)
}
</script>

<template>
  <button @click="handleClick">Click</button>
  <input @input="handleInput" @keydown="handleKeydown" />
  <form @submit="handleSubmit">...</form>
</template>
```

### Custom Component Events

```typescript
// ChildComponent.vue
<script setup lang="ts">
const emit = defineEmits<{
  select: [item: { id: string; name: string }]
}>()
</script>

// ParentComponent.vue
<script setup lang="ts">
interface Item { id: string; name: string }

function handleSelect(item: Item) {
  console.log('Selected:', item.name)
}
</script>

<template>
  <ChildComponent @select="handleSelect" />
</template>
```

---

## Provide/Inject with Types

```typescript
// Parent component
<script setup lang="ts">
import { provide, ref, type InjectionKey } from 'vue'

interface UserContext {
  user: Ref<User | null>
  login: (credentials: Credentials) => Promise<void>
  logout: () => void
}

// Create typed injection key
export const UserKey: InjectionKey<UserContext> = Symbol('user')

const user = ref<User | null>(null)

provide(UserKey, {
  user,
  login: async (credentials) => { /* ... */ },
  logout: () => { user.value = null }
})
</script>

// Child component
<script setup lang="ts">
import { inject } from 'vue'
import { UserKey } from './Parent.vue'

const userContext = inject(UserKey)

if (!userContext) {
  throw new Error('UserContext not provided')
}

const { user, login, logout } = userContext
</script>
```

---

## Type-Safe Slots

```typescript
<script setup lang="ts">
defineSlots<{
  default: (props: { item: Task; index: number }) => any
  header: (props: { title: string }) => any
  empty: () => any
}>()
</script>

<template>
  <div>
    <slot name="header" :title="'Tasks'" />
    <template v-for="(item, index) in tasks">
      <slot :item="item" :index="index" />
    </template>
    <slot v-if="tasks.length === 0" name="empty" />
  </div>
</template>
```
