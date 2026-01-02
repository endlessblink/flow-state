<template>
  <div class="canvas-filter-toggles absolute flex gap-2" style="top: 12px; right: 12px; z-index: 100;">
    <!-- Hide Overdue Tasks Toggle (TASK-082) -->
    <button
      class="hide-overdue-toggle backdrop-blur-md border rounded-lg shadow-lg transition-all hover:scale-105"
      :class="taskStore.hideCanvasOverdueTasks ? 'text-orange-300' : 'text-gray-300'"
      :style="{
        padding: '8px',
        background: taskStore.hideCanvasOverdueTasks ? 'rgba(249,115,22,0.4)' : 'rgba(30,30,40,0.9)',
        borderColor: taskStore.hideCanvasOverdueTasks ? 'rgba(251,146,60,0.5)' : 'rgba(255,255,255,0.2)'
      }"
      :title="taskStore.hideCanvasOverdueTasks ? 'Show overdue tasks on canvas' : 'Hide overdue tasks on canvas'"
      @click="taskStore.hideCanvasOverdueTasks = !taskStore.hideCanvasOverdueTasks"
    >
      <CalendarX v-if="taskStore.hideCanvasOverdueTasks" :size="18" />
      <Calendar v-else :size="18" />
    </button>
    <!-- Hide Done Tasks Toggle (TASK-080, TASK-076) -->
    <button
      class="hide-done-toggle backdrop-blur-md border rounded-lg shadow-lg transition-all hover:scale-105"
      :class="taskStore.hideCanvasDoneTasks ? 'text-purple-300' : 'text-gray-300'"
      :style="{
        padding: '8px',
        background: taskStore.hideCanvasDoneTasks ? 'rgba(139,92,246,0.4)' : 'rgba(30,30,40,0.9)',
        borderColor: taskStore.hideCanvasDoneTasks ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.2)'
      }"
      :title="taskStore.hideCanvasDoneTasks ? 'Show completed tasks on canvas' : 'Hide completed tasks on canvas'"
      @click="taskStore.toggleCanvasDoneTasks()"
    >
      <EyeOff v-if="taskStore.hideCanvasDoneTasks" :size="18" />
      <Eye v-else :size="18" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { CalendarX, Calendar, EyeOff, Eye } from 'lucide-vue-next'
import { useTaskStore } from '@/stores/tasks'

const taskStore = useTaskStore()
</script>
