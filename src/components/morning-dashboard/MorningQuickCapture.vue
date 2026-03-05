<script setup lang="ts">
import { ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import { useTaskStore } from '@/stores/tasks'

const taskStore = useTaskStore()
const inputValue = ref('')

async function handleSubmit() {
  const trimmed = inputValue.value.trim()
  if (!trimmed) return

  await taskStore.createTask({ title: trimmed, status: 'todo' })
  inputValue.value = ''
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    handleSubmit()
  }
}
</script>

<template>
  <div class="morning-quick-capture">
    <Plus :size="16" class="capture-icon" />
    <input
      v-model="inputValue"
      class="capture-input"
      type="text"
      placeholder="Quick capture a task..."
      @keydown="handleKeydown"
    />
  </div>
</template>

<style scoped>
.morning-quick-capture {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-soft);
  border-top: 1px solid var(--glass-border);
  border-left: 1px solid var(--glass-border);
  border-right: 1px solid var(--glass-border);
  border-bottom: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(12px);
}

.capture-icon {
  color: var(--text-muted);
  flex-shrink: 0;
  transition: color var(--duration-normal) var(--ease-out);
}

.morning-quick-capture:focus-within .capture-icon {
  color: var(--brand-primary);
}

.capture-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 0.875rem;
  caret-color: var(--brand-primary);
}

.capture-input::placeholder {
  color: var(--text-muted);
}
</style>
