<script setup lang="ts">
/**
 * Task Node New - Clean foundation component
 */
import { computed } from 'vue'
import type { NodeProps } from '@vue-flow/core'
import type { Task } from '@/types/tasks'
import { useTaskStore } from '@/stores/tasks'

const props = defineProps<NodeProps<{ task: Task }>>()
const taskStore = useTaskStore()

// Reactively get task from store to ensure title/status updates show
const task = computed(() => 
  taskStore.tasks.find(t => t.id === props.data.task.id) || props.data.task
)

const isDone = computed(() => task.value.status === 'done')

const priorityColor = computed(() => {
  switch (task.value.priority) {
    case 'high': return 'bg-red-500'
    case 'medium': return 'bg-yellow-500'
    case 'low': return 'bg-green-500'
    default: return 'bg-gray-500'
  }
})
</script>

<template>
  <div 
    class="task-node-new group relative flex flex-col p-3 rounded-xl transition-all duration-200"
    :class="[
      selected ? 'ring-4 ring-blue-500/30' : 'ring-1 ring-white/10 shadow-lg',
      isDone ? 'bg-gray-800/40 opacity-60' : 'bg-gray-800/80 backdrop-blur-md'
    ]"
    style="width: 200px;"
  >
    <!-- Priority indicator -->
    <div 
      class="absolute left-0 top-3 bottom-3 w-1.5 rounded-r-md"
      :class="priorityColor"
    />

    <h3 
      class="text-xs font-semibold text-gray-100 leading-tight line-clamp-2 pl-2"
      :class="{ 'line-through text-gray-500': isDone }"
    >
      {{ task.title }}
    </h3>
    
    <div class="flex items-center gap-2 mt-2 px-2">
      <div 
        v-if="task.completedPomodoros" 
        class="text-[10px] text-red-400 font-bold"
      >
        🍅 {{ task.completedPomodoros }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-node-new {
  user-select: none;
  cursor: grab;
}

.task-node-new:active {
  cursor: grabbing;
}
</style>
