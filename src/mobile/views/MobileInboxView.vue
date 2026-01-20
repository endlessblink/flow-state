<template>
  <div class="mobile-inbox">
    <div class="mobile-inbox-header">
      <h2>Inbox</h2>
      <button class="add-task-btn" @click="handleAddTask">
        <Plus :size="24" />
      </button>
    </div>

    <div class="mobile-task-list">
      <div v-if="tasks.length === 0" class="empty-state">
        <p>No tasks in Inbox</p>
      </div>
      
      <div 
        v-for="task in tasks" 
        :key="task.id" 
        class="mobile-task-item"
        @click="handleTaskClick(task)"
      >
        <div class="task-checkbox" @click.stop="toggleTask(task)">
          <div :class="['checkbox-circle', { checked: task.status === 'done' }]">
            <Check v-if="task.status === 'done'" :size="14" />
          </div>
        </div>
        <div class="task-content">
          <span :class="['task-title', { done: task.status === 'done' }]">{{ task.title }}</span>
          <span v-if="task.description" class="task-date">{{ truncate(task.description, 30) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTaskStore, type Task } from '@/stores/tasks'
import { Plus, Check } from 'lucide-vue-next'

const taskStore = useTaskStore()

// Get inbox tasks (uncategorized or explicit inbox if we had that concept, 
// for now using 'uncategorized' smart view logic or just all tasks that are active)
// The user requirement says "Inbox". Usually this means tasks without a project or specifically 'inbox'.
// Let's use the store's filtered tasks but maybe force a specific filter if needed.
// For now, let's assume AllTasksView passes the right tasks, OR we pull from store.
// Let's pull from store to be self-contained but respect global filter if reasonable.
// Actually, simple mobile inbox usually means "Active tasks". 

const tasks = computed(() => {
  // Simple mobile view: All active tasks for now, or respect the current filter from store if set.
  // Default to active tasks if no filter.
  return taskStore.tasks.filter(t => t.status !== 'done')
})

const handleAddTask = () => {
  // Todo: Open mobile add task modal
  console.log('Add task clicked')
  // We can trigger the global new task event
  window.dispatchEvent(new CustomEvent('global-new-task'))
}

const toggleTask = (task: Task) => {
  const newStatus = task.status === 'done' ? 'planned' : 'done'
  taskStore.updateTask(task.id, { status: newStatus })
}

const handleTaskClick = (task: Task) => {
    // Todo: Open task detail
    console.log('Task clicked', task.id)
}

const truncate = (str: string, n: number) => {
  return (str.length > n) ? str.substr(0, n-1) + '&hellip;' : str
}
</script>

<style scoped>
.mobile-inbox {
  padding: 16px;
  padding-bottom: 80px;
}

.mobile-inbox-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.mobile-inbox-header h2 {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}

.add-task-btn {
  background: var(--primary-brand);
  color: white;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(var(--primary-brand-rgb), 0.3);
}

.mobile-task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mobile-task-item {
  display: flex;
  align-items: center;
  background: var(--surface-secondary);
  padding: 12px;
  border-radius: 12px;
  gap: 12px;
}

.task-checkbox {
  padding: 4px;
}

.checkbox-circle {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-subtle);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox-circle.checked {
  background: var(--primary-brand);
  border-color: var(--primary-brand);
  color: white;
}

.task-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.task-title {
  font-size: 16px;
  color: var(--text-primary);
}

.task-title.done {
  text-decoration: line-through;
  color: var(--text-muted);
}

.task-date {
  font-size: 12px;
  color: var(--text-tertiary);
}

.empty-state {
  text-align: center;
  color: var(--text-muted);
  margin-top: 40px;
}
</style>
