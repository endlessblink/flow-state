<script setup lang="ts">
import { ref } from 'vue'
import { Flag, Calendar, CalendarPlus, Plus, CheckCircle } from 'lucide-vue-next'
import type { Task } from '@/types/tasks'

const props = defineProps<{
  title: string
  priority: 'low' | 'medium' | 'high' | undefined
  due: 'today' | 'tomorrow' | undefined
  recentlyAdded: Task[]
}>()

defineEmits<{
  (e: 'update:title', value: string): void
  (e: 'update:priority', value: 'low' | 'medium' | 'high' | undefined): void
  (e: 'update:due', value: 'today' | 'tomorrow' | undefined): void
  (e: 'quick-add'): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)

// Expose inputRef so parent can access it (for focus after add)
defineExpose({ inputRef })
</script>

<template>
  <div class="capture-phase">
    <div class="capture-input-area">
      <div class="capture-card">
        <input
          ref="inputRef"
          :value="title"
          type="text"
          class="capture-input"
          placeholder="What needs to be done?"
          autofocus
          @input="$emit('update:title', ($event.target as HTMLInputElement).value)"
          @keydown.enter="$emit('quick-add')"
        >

        <!-- Quick Actions -->
        <div class="quick-actions">
          <button
            class="quick-action-btn"
            :class="{ active: priority === 'high' }"
            @click="$emit('update:priority', priority === 'high' ? undefined : 'high')"
          >
            <Flag :size="16" class="priority-high" />
            High
          </button>
          <button
            class="quick-action-btn"
            :class="{ active: due === 'today' }"
            @click="$emit('update:due', due === 'today' ? undefined : 'today')"
          >
            <Calendar :size="16" />
            Today
          </button>
          <button
            class="quick-action-btn"
            :class="{ active: due === 'tomorrow' }"
            @click="$emit('update:due', due === 'tomorrow' ? undefined : 'tomorrow')"
          >
            <CalendarPlus :size="16" />
            Tomorrow
          </button>
        </div>

        <button
          class="add-task-btn"
          :disabled="!title.trim()"
          @click="$emit('quick-add')"
        >
          <Plus :size="20" />
          Add Task
        </button>
      </div>
    </div>

    <!-- Recently Added -->
    <div v-if="recentlyAdded.length > 0" class="recently-added">
      <h3 class="section-title">Just Added</h3>
      <TransitionGroup name="task-list" tag="ul" class="recent-list">
        <li
          v-for="task in recentlyAdded"
          :key="task.id"
          class="recent-item"
        >
          <CheckCircle :size="16" class="check-icon" />
          <span class="recent-title">{{ task.title }}</span>
        </li>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
/* ================================
   CAPTURE PHASE
   ================================ */

.capture-phase {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: var(--space-5);
  overflow-y: auto;
  touch-action: pan-y; /* Capture phase needs vertical scroll */
}

.capture-input-area {
  margin-bottom: var(--space-6);
}

.capture-card {
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-2xl);
  padding: var(--space-5);
}

.capture-input {
  width: 100%;
  padding: var(--space-4);
  background: var(--overlay-component-bg-lighter);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: var(--text-lg);
  font-weight: var(--font-medium);
  outline: none;
  transition: all var(--duration-normal) ease;
}

.capture-input::placeholder {
  color: var(--text-muted);
}

.capture-input:focus {
  border-color: var(--state-hover-border);
  box-shadow: 0 0 0 3px var(--state-hover-bg);
}

.quick-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-4);
  flex-wrap: wrap;
}

.quick-action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-size: var(--text-meta);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.quick-action-btn.active {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.quick-action-btn:active {
  transform: scale(0.95);
}

.priority-high {
  color: var(--color-priority-high);
}

.add-task-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  margin-top: var(--space-4);
  padding: var(--space-4);
  background: transparent;
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-lg);
  color: var(--brand-primary);
  font-size: var(--text-base);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-task-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.add-task-btn:not(:disabled):active {
  transform: scale(0.98);
}

/* Recently Added */
.recently-added {
  flex: 1;
}

.section-title {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: var(--space-3);
}

.recent-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-bg-weak);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-2);
}

.check-icon {
  color: var(--color-success);
}

.recent-title {
  flex: 1;
  font-size: var(--text-base);
  color: var(--text-secondary);
}

/* Task list transitions */
.task-list-enter-active {
  transition: all var(--duration-slow) ease;
}

.task-list-leave-active {
  transition: all var(--duration-normal) ease;
}

.task-list-enter-from {
  opacity: 0;
  transform: translateY(calc(-1 * var(--space-2_5)));
}

.task-list-leave-to {
  opacity: 0;
  transform: translateX(calc(-1 * var(--space-5)));
}

/* RTL support */
[dir="rtl"] .quick-actions {
  flex-direction: row-reverse;
}

[dir="rtl"] .quick-action-btn {
  flex-direction: row-reverse;
}

[dir="rtl"] .recent-item {
  flex-direction: row-reverse;
}

[dir="rtl"] .capture-input {
  text-align: right;
  direction: rtl;
}
</style>
