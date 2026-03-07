<script setup lang="ts">
import { computed } from 'vue'
import type { Big3Slot } from '@/composables/useMorningDashboard'

const props = defineProps<{
  slot: Big3Slot
  index: number
  isDragover?: boolean
}>()

const emit = defineEmits<{
  clear: [index: number]
}>()

const isEmpty = computed(() => !props.slot.title.trim())
const isFilled = computed(() => props.slot.title.trim().length > 0 && !props.slot.completed)
const isCompleted = computed(() => props.slot.completed)

const placeholderTexts = [
  'Top priority',
  'Second focus',
  'One more thing',
]
</script>

<template>
  <div
    class="drop-zone"
    :class="{
      'drop-zone--empty': isEmpty && !isDragover,
      'drop-zone--dragover': isDragover,
      'drop-zone--filled': isFilled,
      'drop-zone--completed': isCompleted,
    }"
  >
    <!-- Empty state -->
    <template v-if="isEmpty && !isDragover">
      <span class="zone-number">{{ index + 1 }}.</span>
      <span class="zone-placeholder">{{ placeholderTexts[index] }}</span>
    </template>

    <!-- Dragover state -->
    <template v-else-if="isDragover && isEmpty">
      <span class="zone-number">{{ index + 1 }}.</span>
      <span class="zone-drop-hint">Drop here</span>
    </template>

    <!-- Filled state -->
    <template v-else-if="isFilled">
      <span class="zone-number">{{ index + 1 }}.</span>
      <span class="zone-title">{{ slot.title }}</span>
      <button class="zone-clear" type="button" @click.stop="emit('clear', index)" aria-label="Clear slot">
        &times;
      </button>
    </template>

    <!-- Completed state -->
    <template v-else-if="isCompleted">
      <span class="zone-number">{{ index + 1 }}.</span>
      <span class="zone-title zone-title--done">{{ slot.title }}</span>
      <svg class="zone-check" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="var(--brand-primary)" stroke-width="1.5" />
        <path d="M5 8l2 2 4-4" stroke="var(--brand-primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </template>
  </div>
</template>

<style scoped>
.drop-zone {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  min-height: 40px;
  transition: all 0.2s ease;
}

.drop-zone--empty {
  border: 2px dashed var(--glass-border);
}

.drop-zone--dragover {
  border: 2px solid var(--brand-primary);
  background: rgba(78, 205, 196, 0.06);
  transform: scale(1.02);
  box-shadow: 0 0 16px rgba(78, 205, 196, 0.15);
}

.drop-zone--filled {
  background: var(--surface-primary);
  border-left: 3px solid var(--brand-primary);
  border-top: 1px solid var(--glass-border);
  border-right: 1px solid var(--glass-border);
  border-bottom: 1px solid var(--glass-border);
}

.drop-zone--completed {
  background: var(--surface-primary);
  border-left: 3px solid var(--brand-primary);
  border-top: 1px solid var(--glass-border);
  border-right: 1px solid var(--glass-border);
  border-bottom: 1px solid var(--glass-border);
  opacity: 0.6;
}

.zone-number {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--brand-primary);
  min-width: 18px;
  flex-shrink: 0;
}

.zone-placeholder {
  font-size: 0.8rem;
  color: var(--text-muted);
  flex: 1;
}

.zone-drop-hint {
  font-size: 0.8rem;
  color: var(--brand-primary);
  font-weight: 500;
  flex: 1;
}

.zone-title {
  font-size: 0.85rem;
  color: var(--text-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zone-title--done {
  text-decoration: line-through;
  color: var(--text-muted);
}

.zone-clear {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0 var(--space-1);
  line-height: 1;
  flex-shrink: 0;
  transition: color 0.15s ease;
}

.zone-clear:hover {
  color: var(--text-primary);
}

.zone-check {
  flex-shrink: 0;
}
</style>
