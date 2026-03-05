<script setup lang="ts">
import { useMorningDashboard } from '@/composables/useMorningDashboard'
import BigThreeSlot from './BigThreeSlot.vue'
import TaskSuggestionChip from './TaskSuggestionChip.vue'

const {
  big3Slots,
  allSlotsAssigned,
  suggestedTasks,
  assignSlot,
  clearSlot,
  startMyDay,
} = useMorningDashboard()

function handleAssign(index: number, taskId: string | null, title: string) {
  assignSlot(index, taskId, title)
}

function handleClear(index: number) {
  clearSlot(index)
}

function handleChipSelect(taskId: string, title: string) {
  // Assign to first empty slot
  const emptyIndex = big3Slots.value.findIndex((s) => !s.title.trim())
  if (emptyIndex !== -1) {
    assignSlot(emptyIndex, taskId, title)
  }
}
</script>

<template>
  <div class="big-three-card">
    <div class="card-header">
      <h2 class="card-title">Today's Big 3</h2>
      <span class="card-subtitle">Your three most important tasks</span>
    </div>

    <div class="slots-list">
      <BigThreeSlot
        v-for="(slot, index) in big3Slots"
        :key="index"
        :slot="slot"
        :index="index"
        @assign="handleAssign"
        @clear="handleClear"
      />
    </div>

    <!-- Suggestion chips -->
    <div v-if="suggestedTasks.length" class="suggestions-row">
      <TaskSuggestionChip
        v-for="task in suggestedTasks"
        :key="task.id"
        :title="task.title"
        :task-id="task.id"
        @select="handleChipSelect"
      />
    </div>

    <!-- Start My Day button -->
    <button
      class="start-day-button"
      :class="{ 'start-day-button--ready': allSlotsAssigned }"
      :disabled="!allSlotsAssigned"
      type="button"
      @click="startMyDay"
    >
      Start My Day
    </button>
  </div>
</template>

<style scoped>
.big-three-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-6);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(12px);
}

.card-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.card-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.card-subtitle {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.slots-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.suggestions-row {
  display: flex;
  flex-wrap: nowrap;
  gap: var(--space-2);
  overflow-x: auto;
  padding-bottom: var(--space-1);
  scrollbar-width: thin;
  scrollbar-color: var(--glass-border) transparent;
}

.suggestions-row::-webkit-scrollbar {
  height: 3px;
}

.suggestions-row::-webkit-scrollbar-track {
  background: transparent;
}

.suggestions-row::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: 2px;
}

.start-day-button {
  padding: var(--space-3) var(--space-6);
  background: var(--glass-bg-soft);
  color: var(--brand-primary);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition:
    background var(--duration-normal) var(--ease-out),
    opacity var(--duration-normal) var(--ease-out),
    box-shadow var(--duration-normal) var(--ease-out);
  align-self: center;
  min-width: 160px;
}

.start-day-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.start-day-button--ready {
  animation: pulse-teal 2s ease-in-out infinite;
}

.start-day-button--ready:hover {
  background: rgba(78, 205, 196, 0.12);
}

@keyframes pulse-teal {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(78, 205, 196, 0.4);
  }
  50% {
    box-shadow: 0 0 20px 4px rgba(78, 205, 196, 0.2);
  }
}

@media (prefers-reduced-motion: reduce) {
  .start-day-button--ready {
    animation: none;
  }
}
</style>
