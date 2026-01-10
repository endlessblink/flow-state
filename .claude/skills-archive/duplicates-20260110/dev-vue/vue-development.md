---
name: Vue.js Development
description: Comprehensive Vue 3 development skill for component creation, Composition API patterns, TypeScript integration, and best practices. Ensures consistent, maintainable, and performant Vue.js code.
---

# Vue.js Development

**🚀 ACTIVATING VUE.JS DEVELOPMENT SKILL**

Comprehensive Vue 3 development skill for component creation, Composition API patterns, TypeScript integration, and best practices. Ensures consistent, maintainable, and performant Vue.js code.

## When to Use
- Creating Vue 3 components with Composition API
- Implementing TypeScript interfaces and type safety
- Building reactive composables and state management
- Integrating with Pinia stores and external APIs
- Optimizing component performance and reusability
- Following Vue.js best practices and patterns

## Skill Activation Message
When this skill is used, Claude Code will start with:
```
🚀 **VUE.JS DEVELOPMENT SKILL ACTIVATED**
Creating Vue 3 components with Composition API, TypeScript, and best practices...
```

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

// Computed properties
const filteredTasks = computed(() =>
  taskStore.tasks.filter(task => task.status === 'active')
)
</script>

<template>
  <div class="component-container">
    <!-- Component content -->
  </div>
</template>

<style scoped>
.component-container {
  background: var(--color-surface);
  padding: var(--spacing-md);
}
</style>
```

### Key Requirements
- Always use `<script setup lang="ts">`
- Use design tokens: `var(--color-*)`, `var(--spacing-*)`
- Include proper TypeScript interfaces
- Use Pinia stores for state management

This skill ensures consistent Vue 3 development patterns.