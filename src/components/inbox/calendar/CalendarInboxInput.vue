<template>
  <!-- Quick Add -->
  <div class="quick-add">
    <input
      :value="modelValue"
      :dir="quickAddDirection"
      placeholder="Quick add task (Enter)..."
      class="quick-add-input"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @keydown.enter="$emit('addTask')"
    >
  </div>

  <!-- Brain Dump Mode -->
  <div class="brain-dump-section">
    <NButton
      secondary
      block
      size="small"
      class="brain-dump-toggle"
      @click="brainDumpMode = !brainDumpMode"
    >
      {{ brainDumpMode ? 'Quick Add Mode' : 'Brain Dump Mode' }}
    </NButton>

    <!-- Brain Dump Textarea -->
    <div v-if="brainDumpMode" class="brain-dump-container">
      <textarea
        v-model="brainDumpText"
        :dir="textDirection"
        class="brain-dump-textarea"
        rows="5"
        placeholder="Paste or type tasks (one per line)..."
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
import { computed } from 'vue'
import { NButton } from 'naive-ui'
import { useBrainDump } from '@/composables/useBrainDump'

const props = defineProps<{
  modelValue: string
}>()

defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'addTask'): void
}>()

const {
  brainDumpMode,
  brainDumpText,
  textDirection,
  parsedTaskCount,
  processBrainDump
} = useBrainDump()

const quickAddDirection = computed(() => {
  if (!props.modelValue.trim()) return 'ltr'
  const firstChar = props.modelValue.trim()[0]
  const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
  return rtlRegex.test(firstChar) ? 'rtl' : 'ltr'
})
</script>

<style scoped>
.quick-add {
  padding: 0;
}

.quick-add-input {
  width: 100%;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  unicode-bidi: plaintext;
  text-align: start;
}

.brain-dump-section {
  padding: 0 var(--space-1);
}

.brain-dump-toggle {
  margin-bottom: var(--space-2);
}

.brain-dump-toggle:hover {
  background: var(--state-hover-bg);
  color: var(--text-secondary);
}

.brain-dump-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.brain-dump-textarea {
  width: 100%;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  resize: vertical;
  margin-bottom: var(--space-2);
  unicode-bidi: plaintext;
  text-align: start;
}
</style>
