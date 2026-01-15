<template>
  <div class="quick-add">
    <input
      v-model="newTaskTitle"
      :dir="quickAddDirection"
      placeholder="Quick add task (Enter)..."
      class="quick-add-input"
      @keydown.enter="handleAddTask"
    >
  </div>

  <!-- Brain Dump Mode -->
  <div v-if="showBrainDump" class="brain-dump-section">
    <NButton
      secondary
      block
      size="small"
      class="brain-dump-toggle"
      @click="brainDumpMode = !brainDumpMode"
    >
      {{ brainDumpMode ? 'Quick Add Mode' : 'Brain Dump Mode' }}
    </NButton>

    <div v-if="brainDumpMode" class="brain-dump-container">
      <textarea
        v-model="brainDumpText"
        placeholder="Paste or type tasks (one per line):
Write proposal !!!
Review code 2h
Call client"
        :dir="textDirection"
        class="brain-dump-textarea"
        rows="5"
      />
      <NButton
        type="primary"
        block
        :disabled="parsedTaskCount === 0"
        @click="processBrainDump"
      >
        Add {{ parsedTaskCount }} Tasks
      </NButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { NButton } from 'naive-ui'
import { useBrainDump } from '@/composables/useBrainDump'

defineProps<{
  showBrainDump: boolean
}>()

const emit = defineEmits<{
  (e: 'addTask', title: string): void
}>()

const newTaskTitle = ref('')

const {
  brainDumpMode,
  brainDumpText,
  textDirection,
  parsedTaskCount,
  processBrainDump
} = useBrainDump()

const quickAddDirection = computed(() => {
  if (!newTaskTitle.value.trim()) return 'ltr'
  const firstChar = newTaskTitle.value.trim()[0]
  const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
  return rtlRegex.test(firstChar) ? 'rtl' : 'ltr'
})

const handleAddTask = () => {
  if (!newTaskTitle.value.trim()) return
  emit('addTask', newTaskTitle.value)
  newTaskTitle.value = ''
}
</script>

<style scoped>
.quick-add {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--glass-border);
  background: transparent;
}

.quick-add-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-soft);
  color: var(--text-primary);
  font-size: var(--text-sm);
  transition: all var(--duration-normal);
}

.quick-add-input:focus {
  outline: none;
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 2px var(--brand-primary-subtle);
}

.brain-dump-section {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--glass-border);
  background: transparent;
}

.brain-dump-container {
  margin-top: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.brain-dump-textarea {
  width: 100%;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-soft);
  color: var(--text-primary);
  font-size: var(--text-sm);
  resize: vertical;
  min-height: 100px;
}

.brain-dump-textarea:focus {
  outline: none;
  border-color: var(--brand-primary);
}
</style>
