<template>
  <div class="weekend-view">
    <div class="weekend-header">
      <h1>This Weekend</h1>
      <p class="weekend-subtitle">{{ weekendDateRange }}</p>
    </div>

    <!-- Weekend tasks display -->
    <div class="weekend-tasks">
      <div
        v-for="task in weekendTasks"
        :key="task.id"
        class="weekend-task-item"
      >
        <h3>{{ task.title }}</h3>
        <p>{{ task.description || 'No description' }}</p>
        <small>Status: {{ task.status }}</small>
      </div>

      <!-- Empty state -->
      <div v-if="weekendTasks.length === 0" class="empty-state">
        <Coffee :size="48" />
        <h3>No weekend tasks yet</h3>
        <p>Drag tasks to "This Weekend" in the sidebar to plan your weekend.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { Coffee } from 'lucide-vue-next'
import { filterTasksByView } from '@/utils/taskFilters'

const taskStore = useTaskStore()

const weekendDateRange = computed(() => {
  const today = new Date()
  const saturday = new Date(today)
  const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7
  saturday.setDate(today.getDate() + daysUntilSaturday)

  const sunday = new Date(saturday)
  sunday.setDate(saturday.getDate() + 1)

  return saturday.toLocaleDateString() + ' - ' + sunday.toLocaleDateString()
})

// Use the store's unified filtering to get actual weekend tasks
const weekendTasks = computed(() => {
  console.log('🗓️ Weekend View Debug (STORE UNIFIED):', {
    totalTasks: taskStore.tasks.length,
    totalProjects: taskStore.projects.length,
    storeCount: taskStore.weekendTaskCount
  })

  // Get actual weekend tasks from the store using the same filtering as the counter
  const filteredTasks = filterTasksByView(
    taskStore.tasks,
    'all',
    { smartView: 'weekend', projects: taskStore.projects },
    taskStore.projects
  )

  console.log('🎯 Weekend view showing tasks (STORE UNIFIED):', filteredTasks.length)
  console.log('🗓️ Weekend view tasks found:', filteredTasks.map(t => t.title))

  return filteredTasks
})
</script>

<style scoped>
.weekend-view {
  padding: var(--space-6);
  max-width: 1200px;
  margin: 0 auto;
}

.weekend-header {
  margin-bottom: var(--space-8);
  text-align: center;
}

.weekend-header h1 {
  font-size: var(--text-3xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.weekend-subtitle {
  font-size: var(--text-lg);
  color: var(--text-secondary);
  margin: 0;
}

.weekend-tasks {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-4);
}

.weekend-task-item {
  background: var(--surface-secondary);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}

.weekend-task-item h3 {
  margin: 0 0 var(--space-2) 0;
  color: var(--text-primary);
}

.weekend-task-item p {
  margin: 0 0 var(--space-2) 0;
  color: var(--text-secondary);
}

.weekend-task-item small {
  color: var(--text-muted);
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: var(--space-12);
  color: var(--text-muted);
}

.empty-state svg {
  margin-bottom: var(--space-4);
  opacity: 0.5;
}

.empty-state h3 {
  font-size: var(--text-xl);
  margin-bottom: var(--space-2);
  color: var(--text-secondary);
}

.empty-state p {
  margin: 0;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}
</style>