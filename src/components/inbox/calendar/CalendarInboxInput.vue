<template>
  <!-- Quick Add -->
  <div class="quick-add">
    <input
      :value="modelValue"
      :dir="quickAddDirection"
      placeholder="Quick add task (Enter)..."
      class="quick-add-input"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @keydown.enter="handleEnter"
      @paste="handlePaste"
    >

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
import { computed, ref } from 'vue'
import { NButton } from 'naive-ui'
import { Globe, X } from 'lucide-vue-next'
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
