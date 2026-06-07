<template>
  <!-- Quick Add -->
  <div class="quick-add">
    <div class="quick-add-field">
      <Plus :size="14" class="quick-add-icon" aria-hidden="true" />
      <input
        :value="modelValue"
        :dir="quickAddDirection"
        placeholder="Quick add task (Enter)..."
        class="quick-add-input"
        aria-label="Quick add task"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @keydown.enter="handleEnter"
        @paste="handlePaste"
      >
    </div>

    <!-- TASK-1325: URL scraping feedback -->
    <div v-if="isScraping" class="url-scraping-feedback">
      <Globe :size="16" class="scraping-icon" />
      <span class="scraping-status">Fetching page info...</span>
      <button class="scraping-cancel" @click="cancelScraping">
        <X :size="14" />
      </button>
    </div>
  </div>

  <!-- Brain Dump Mode -->
  <div class="brain-dump-section">
    <button
      type="button"
      class="brain-dump-toggle"
      :aria-pressed="brainDumpMode"
      @click="brainDumpMode = !brainDumpMode"
    >
      <ListPlus :size="13" aria-hidden="true" />
      {{ brainDumpMode ? 'Quick Add Mode' : 'Brain Dump Mode' }}
    </button>

    <!-- Brain Dump Textarea -->
    <div v-if="brainDumpMode" class="brain-dump-container">
      <textarea
        v-model="brainDumpText"
        :dir="textDirection"
        class="brain-dump-textarea"
        rows="5"
        placeholder="Paste or type tasks (one per line)..."
      />
      <button
        type="button"
        class="brain-dump-submit"
        :disabled="parsedTaskCount === 0"
        @click="processBrainDump"
      >
        Add {{ parsedTaskCount }} Tasks
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Globe, ListPlus, Plus, X } from 'lucide-vue-next'
import { useBrainDump } from '@/composables/useBrainDump'
import { useUrlScraping } from '@/composables/useUrlScraping'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'addTask'): void
  (e: 'addTaskWithDescription', title: string, description: string): void
}>()

// TASK-1325: URL scraping on paste
const { isScraping, scrapeIfUrl, cancel: cancelScraping } = useUrlScraping()
const pendingScrapeDescription = ref('')

const handlePaste = async (e: ClipboardEvent) => {
  const text = e.clipboardData?.getData('text') || ''
  if (!text.trim()) return

  const result = await scrapeIfUrl(text)
  if (result) {
    emit('update:modelValue', result.title)
    pendingScrapeDescription.value = result.description
  }
}

const handleEnter = () => {
  cancelScraping()
  if (pendingScrapeDescription.value) {
    emit('addTaskWithDescription', props.modelValue, pendingScrapeDescription.value)
    pendingScrapeDescription.value = ''
  } else {
    emit('addTask')
  }
}

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

.quick-add-field {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  min-height: 40px;
  padding: 0 var(--space-3);
  transition: border-color var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out);
}

.quick-add-field:focus-within {
  background: var(--surface-1);
  border-color: var(--brand-primary-dim);
  box-shadow: 0 0 0 2px var(--brand-primary-subtle);
}

.quick-add-icon {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.quick-add-field:focus-within .quick-add-icon {
  color: var(--brand-primary);
}

.quick-add-input {
  width: 100%;
  min-width: 0;
  background: transparent;
  border: 0;
  outline: none;
  color: var(--text-primary);
  padding: var(--space-2) 0;
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  unicode-bidi: plaintext;
  text-align: start;
}

.quick-add-input::placeholder {
  color: var(--text-muted);
}

/* TASK-1325: URL Scraping Feedback */
.url-scraping-feedback {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  margin-top: var(--space-2);
  background: var(--glass-bg-soft);
  border-radius: var(--radius-md);
  border: 1px solid var(--brand-primary);
}

.scraping-icon {
  color: var(--brand-primary);
  flex-shrink: 0;
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.scraping-status {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--brand-primary);
}

.scraping-cancel {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.scraping-cancel:hover {
  background: var(--glass-bg);
  color: var(--text-primary);
}

.brain-dump-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding: 0;
}

.brain-dump-toggle {
  align-items: center;
  align-self: stretch;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  gap: var(--space-2);
  justify-content: center;
  min-height: 28px;
  padding: var(--space-1_5) var(--space-2);
  transition: color var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out);
}

.brain-dump-toggle:hover,
.brain-dump-toggle[aria-pressed="true"] {
  background: var(--state-hover-bg);
  border-color: var(--border-subtle);
  color: var(--text-primary);
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

.brain-dump-textarea:focus {
  border-color: var(--brand-primary-dim);
  box-shadow: 0 0 0 2px var(--brand-primary-subtle);
  outline: none;
}

.brain-dump-submit {
  align-items: center;
  background: var(--brand-primary);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-md);
  color: white;
  cursor: pointer;
  display: flex;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  justify-content: center;
  min-height: 34px;
  padding: var(--space-2) var(--space-3);
  transition: opacity var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out);
}

.brain-dump-submit:active:not(:disabled) {
  transform: translateY(1px);
}

.brain-dump-submit:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
</style>
