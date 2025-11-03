<template>
  <div class="inbox-panel" :class="{ collapsed: isCollapsed }">
    <!-- Header -->
    <div class="inbox-header">
      <button @click="isCollapsed = !isCollapsed" class="collapse-btn" :title="isCollapsed ? 'Expand Inbox' : 'Collapse Inbox'">
        <ChevronLeft v-if="!isCollapsed" :size="16" />
        <ChevronRight v-else :size="16" />
      </button>
      <h3 v-if="!isCollapsed" class="inbox-title">Inbox</h3>
      <n-badge v-if="!isCollapsed" :value="inboxTasks.length" type="info" />
    </div>

    <!-- Quick Add -->
    <div v-if="!isCollapsed" class="quick-add">
      <n-input
        v-model:value="newTaskTitle"
        @keydown.enter="addTask"
        placeholder="Quick add task (Enter)..."
        size="large"
        clearable
      />
    </div>

    <!-- Brain Dump Mode Toggle -->
    <n-button
      v-if="!isCollapsed"
      @click="brainDumpMode = !brainDumpMode"
      secondary
      block
    >
      {{ brainDumpMode ? 'Quick Add Mode' : 'Brain Dump Mode' }}
    </n-button>

    <!-- Brain Dump Textarea -->
    <div v-if="!isCollapsed && brainDumpMode" class="brain-dump">
      <n-input
        v-model:value="brainDumpText"
        type="textarea"
        placeholder="Paste or type tasks (one per line):
  Write proposal !!!
  Review code 2h
  Call client"
        :rows="8"
      />
      <n-button
        @click="processBrainDump"
        type="primary"
        block
        size="large"
        :disabled="parsedTaskCount === 0"
      >
        Add {{ parsedTaskCount }} Tasks
      </n-button>
    </div>

    <!-- Inbox Task List -->
    <div v-if="!isCollapsed" class="inbox-tasks">
      <div
        v-for="task in inboxTasks"
        :key="task.id"
        class="inbox-task-card"
        draggable="true"
        @dragstart="handleDragStart($event, task)"
      >
        <div :class="`priority-stripe priority-stripe-${task.priority}`"></div>
        <div class="task-content">
          <div class="task-title">{{ task.title }}</div>
          <div class="task-meta">
            <n-tag
              :type="task.priority === 'high' ? 'error' : task.priority === 'medium' ? 'warning' : 'info'"
              size="small"
              round
            >
              {{ task.priority }}
            </n-tag>
            <span v-if="task.estimatedDuration" class="duration-badge">
              {{ task.estimatedDuration }}m
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { NInput, NButton, NBadge, NTag, NIcon } from 'naive-ui'
import { Plus, Zap, Clock, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { useTaskStore } from '@/stores/tasks'

const taskStore = useTaskStore()

const newTaskTitle = ref('')
const brainDumpMode = ref(false)
const brainDumpText = ref('')
const isCollapsed = ref(false)
const quickInputRef = ref<HTMLInputElement>()

// Get ALL filtered tasks (not just inbox) - includes canvas-positioned tasks
const inboxTasks = computed(() => taskStore.filteredTasks)

// Parse brain dump text to count tasks
const parsedTaskCount = computed(() => {
  if (!brainDumpText.value.trim()) return 0
  return brainDumpText.value.split('\n').filter(line => line.trim()).length
})

// Add single task from quick input
const addTask = () => {
  if (!newTaskTitle.value.trim()) return

  taskStore.createTask({
    title: newTaskTitle.value.trim(),
    isInInbox: true,
    priority: 'medium',
    status: 'planned'
  })

  newTaskTitle.value = ''
  quickInputRef.value?.focus()
}

// Process brain dump (multi-line)
const processBrainDump = () => {
  const lines = brainDumpText.value.split('\n').filter(line => line.trim())

  lines.forEach(line => {
    let title = line.trim()
    let priority: 'low' | 'medium' | 'high' = 'medium'
    let estimatedDuration: number | undefined

    // Parse priority markers
    if (title.includes('!!!')) {
      priority = 'high'
      title = title.replace(/!!!/g, '').trim()
    } else if (title.includes('!!')) {
      priority = 'medium'
      title = title.replace(/!!/g, '').trim()
    } else if (title.includes('!')) {
      priority = 'low'
      title = title.replace(/!/g, '').trim()
    }

    // Parse time estimates (30m, 1h, 2h, etc.)
    const timeMatch = title.match(/(\d+)(h|m)/i)
    if (timeMatch) {
      const value = parseInt(timeMatch[1])
      const unit = timeMatch[2].toLowerCase()
      estimatedDuration = unit === 'h' ? value * 60 : value
      title = title.replace(/\d+(h|m)/i, '').trim()
    }

    // Create task
    if (title) {
      taskStore.createTask({
        title,
        priority,
        estimatedDuration,
        isInInbox: true,
        status: 'planned'
      })
    }
  })

  brainDumpText.value = ''
  brainDumpMode.value = false
}

// Handle drag start from inbox
const handleDragStart = (event: DragEvent, task: any) => {
  event.dataTransfer?.setData('application/json', JSON.stringify({
    taskId: task.id,
    fromInbox: true
  }))
}
</script>

<style scoped>
/* UNIFIED DESIGN SYSTEM - Outlined + Glass with Green Accent */

.inbox-panel {
  width: 320px;
  margin: var(--space-4);
  margin-right: 0;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  overflow: hidden;
  transition: width var(--duration-normal) var(--spring-smooth), padding var(--duration-normal);
  /* Clean solid background matching target design */
  background: var(--surface-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: 16px; /* Moderate rounded corners */
  box-shadow: var(--shadow-sm);
}

.inbox-panel.collapsed {
  width: 60px;
  padding: var(--space-4) var(--space-2);
}

.inbox-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
}

.collapse-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-muted);
  padding: var(--space-2);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--duration-normal) var(--spring-smooth);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}

.collapse-btn:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  backdrop-filter: var(--state-active-glass);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: var(--state-hover-shadow);
}

.inbox-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
  flex: 1;
}

.quick-add {
  /* Naive UI handles internal styling */
}

.brain-dump {
  padding: var(--space-4);
  background: var(--surface-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  box-shadow: var(--shadow-sm);
}

.inbox-tasks {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  margin: calc(var(--space-2) * -1);
}

/* Unified card styling - subtle at rest, green vibrant on hover */
.inbox-task-card {
  position: relative;
  padding: var(--space-4);
  margin-bottom: var(--space-1);
  cursor: move;
  background: var(--surface-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-sm);
}

.inbox-task-card:last-child {
  margin-bottom: 0;
}

.inbox-task-card:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  backdrop-filter: var(--state-active-glass);
  transform: translateY(-2px) scale(1.01);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
  z-index: 10;
}

/* Hover state: Enhanced visibility */
.inbox-task-card:hover .task-title {
  color: var(--text-primary);
}

.inbox-task-card:hover .task-meta {
  opacity: 0.95;
}

.priority-stripe {
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
}

.task-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.task-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  line-height: var(--leading-tight);
  transition: color var(--duration-normal);
}

.task-meta {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  transition: opacity var(--duration-normal);
}

.duration-badge {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-weight: var(--font-medium);
}

/* Unified scrollbar styling */
.inbox-tasks::-webkit-scrollbar {
  width: 6px;
}

.inbox-tasks::-webkit-scrollbar-track {
  background: transparent;
}

.inbox-tasks::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: var(--radius-md);
  transition: background var(--duration-fast);
}

.inbox-tasks::-webkit-scrollbar-thumb:hover {
  background: var(--border-hover);
}

.inbox-tasks {
  scrollbar-width: thin;
  scrollbar-color: var(--glass-border) transparent;
}
</style>
