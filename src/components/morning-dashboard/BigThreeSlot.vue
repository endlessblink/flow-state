<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Big3Slot } from '@/composables/useMorningDashboard'
import { useMorningDashboard } from '@/composables/useMorningDashboard'
import TaskSuggestionChip from './TaskSuggestionChip.vue'

const props = defineProps<{
  slot: Big3Slot
  index: number
}>()

const emit = defineEmits<{
  assign: [index: number, taskId: string | null, title: string]
  clear: [index: number]
}>()

const { suggestedTasks } = useMorningDashboard()

const isEditing = ref(false)
const inputValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const isEmpty = computed(() => !props.slot.title.trim())
const isFilled = computed(() => props.slot.title.trim().length > 0 && !props.slot.completed)
const isCompleted = computed(() => props.slot.completed)

function startEditing() {
  if (isCompleted.value) return
  isEditing.value = true
  inputValue.value = props.slot.title
  setTimeout(() => inputRef.value?.focus(), 0)
}

function commitEdit() {
  const trimmed = inputValue.value.trim()
  if (trimmed) {
    emit('assign', props.index, props.slot.taskId, trimmed)
  }
  isEditing.value = false
  inputValue.value = ''
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') commitEdit()
  if (e.key === 'Escape') {
    isEditing.value = false
    inputValue.value = ''
  }
}

function selectSuggestion(taskId: string, title: string) {
  emit('assign', props.index, taskId, title)
  isEditing.value = false
  inputValue.value = ''
}

function clearSlot() {
  emit('clear', props.index)
}
</script>

<template>
  <div
    class="big-three-slot"
    :class="{
      'slot--empty': isEmpty && !isEditing,
      'slot--editing': isEditing,
      'slot--filled': isFilled,
      'slot--completed': isCompleted,
    }"
    @click="isEmpty && !isEditing ? startEditing() : undefined"
  >
    <!-- Empty state -->
    <template v-if="isEmpty && !isEditing">
      <span class="slot-number">{{ index + 1 }}</span>
      <span class="slot-placeholder">Pick or type your focus...</span>
    </template>

    <!-- Editing state -->
    <template v-else-if="isEditing">
      <span class="slot-number">{{ index + 1 }}</span>
      <div class="slot-input-wrapper">
        <input
          ref="inputRef"
          v-model="inputValue"
          class="slot-input"
          placeholder="Type a task or pick below..."
          @keydown="handleKeydown"
          @blur="commitEdit"
        />
        <div v-if="suggestedTasks.length" class="slot-dropdown">
          <button
            v-for="task in suggestedTasks.slice(0, 6)"
            :key="task.id"
            class="slot-dropdown-item"
            type="button"
            @mousedown.prevent="selectSuggestion(task.id, task.title)"
          >
            {{ task.title }}
          </button>
        </div>
      </div>
    </template>

    <!-- Filled state -->
    <template v-else-if="isFilled">
      <span class="slot-number">{{ index + 1 }}</span>
      <span class="slot-title" @click="startEditing">{{ slot.title }}</span>
      <button class="slot-clear" type="button" @click.stop="clearSlot" aria-label="Clear slot">
        &times;
      </button>
    </template>

    <!-- Completed state -->
    <template v-else-if="isCompleted">
      <span class="slot-number">{{ index + 1 }}</span>
      <span class="slot-title slot-title--done">{{ slot.title }}</span>
      <svg class="slot-check" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="var(--brand-primary)" stroke-width="1.5" />
        <path d="M5 8l2 2 4-4" stroke="var(--brand-primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </template>
  </div>
</template>

<style scoped>
.big-three-slot {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  transition:
    background var(--duration-normal) var(--ease-out),
    border-color var(--duration-normal) var(--ease-out);
  min-height: 48px;
  position: relative;
}

.slot--empty {
  border: 2px dashed var(--glass-border);
  cursor: pointer;
}

.slot--empty:hover {
  border-color: var(--brand-primary);
  background: rgba(78, 205, 196, 0.04);
}

.slot--editing {
  border: 2px solid var(--brand-primary);
  background: var(--glass-bg-soft);
  align-items: flex-start;
  flex-direction: row;
}

.slot--filled {
  background: var(--glass-bg-soft);
  border-left: 3px solid var(--brand-primary);
  border-top: 1px solid var(--glass-border);
  border-right: 1px solid var(--glass-border);
  border-bottom: 1px solid var(--glass-border);
}

.slot--completed {
  background: var(--glass-bg-soft);
  border-left: 3px solid var(--brand-primary);
  border-top: 1px solid var(--glass-border);
  border-right: 1px solid var(--glass-border);
  border-bottom: 1px solid var(--glass-border);
  opacity: 0.6;
}

.slot-number {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--brand-primary);
  min-width: 16px;
  flex-shrink: 0;
}

.slot-placeholder {
  font-size: 0.875rem;
  color: var(--text-muted);
  flex: 1;
}

.slot-title {
  font-size: 0.875rem;
  color: var(--text-primary);
  flex: 1;
  cursor: pointer;
}

.slot-title--done {
  text-decoration: line-through;
  color: var(--text-muted);
  cursor: default;
}

.slot-clear {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1rem;
  cursor: pointer;
  padding: 0 var(--space-1);
  line-height: 1;
  flex-shrink: 0;
  transition: color var(--duration-normal) var(--ease-out);
}

.slot-clear:hover {
  color: var(--text-primary);
}

.slot-check {
  flex-shrink: 0;
}

.slot-input-wrapper {
  flex: 1;
  position: relative;
}

.slot-input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 0.875rem;
  padding: 0;
  caret-color: var(--brand-primary);
}

.slot-input::placeholder {
  color: var(--text-muted);
}

.slot-dropdown {
  position: absolute;
  top: calc(100% + var(--space-2));
  left: 0;
  right: 0;
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.slot-dropdown-item {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: var(--space-2) var(--space-3);
  color: var(--text-secondary);
  font-size: 0.8rem;
  cursor: pointer;
  transition: background var(--duration-normal) var(--ease-out);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.slot-dropdown-item:hover {
  background: rgba(78, 205, 196, 0.08);
  color: var(--text-primary);
}
</style>
