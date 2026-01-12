<template>
  <Transition name="slide-up">
    <div v-if="isOpen" class="bulk-action-bar">
      <div class="bulk-content">
        <div class="selection-count">
          <span class="count">{{ count }}</span>
          <span class="label">selected</span>
        </div>

        <div class="actions">
          <!-- TODO: Add icons from lucide-vue-next -->
          <button @click="emit('done')" class="action-btn" title="Mark as Done">
            Done
          </button>
          
          <button @click="emit('date')" class="action-btn" title="Reschedule">
             Date
          </button>

          <button @click="emit('priority')" class="action-btn" title="Set Priority">
             Priority
          </button>

          <button @click="emit('move')" class="action-btn" title="Move to Project">
             Move
          </button>

          <div class="separator"></div>

          <button @click="emit('delete')" class="action-btn delete" title="Delete">
             Delete
          </button>
        </div>

        <button @click="emit('clear')" class="close-btn" title="Clear Selection">
          ✕
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  isOpen: boolean
  count: number
}>()

const emit = defineEmits<{
  (e: 'clear'): void
  (e: 'done'): void
  (e: 'date'): void
  (e: 'priority'): void
  (e: 'move'): void
  (e: 'delete'): void
}>()
</script>

<style scoped>
.bulk-action-bar {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  justify-content: center;
  width: auto;
  min-width: 400px;
}

.bulk-content {
  background: var(--surface-0);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-xl);
  padding: 0.5rem 1rem;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  animation: slide-up 0.2s ease-out;
}

.selection-count {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: var(--text-primary);
  padding-right: 1rem;
  border-right: 1px solid var(--border-color);
}

.count {
  background: var(--primary-100);
  color: var(--primary-700);
  padding: 0.1rem 0.5rem;
  border-radius: 99px;
  font-size: 0.875rem;
}

.actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.action-btn {
  background: transparent;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--surface-100);
  color: var(--text-primary);
}

.action-btn.delete:hover {
  background: var(--danger-100);
  color: var(--danger-600);
}

.separator {
  width: 1px;
  height: 24px;
  background: var(--border-color);
  margin: 0 0.5rem;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 50%;
  margin-left: auto;
  font-size: 1.25rem;
  line-height: 1;
}

.close-btn:hover {
  background: var(--surface-200);
  color: var(--text-primary);
}

/* Transitions */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translate(-50%, 100%);
  opacity: 0;
}
</style>
