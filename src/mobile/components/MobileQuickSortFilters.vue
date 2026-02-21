<template>
  <div class="thumb-zone">
    <!-- Priority Quick Edit -->
    <div class="quick-edit-row">
      <span class="edit-label">Priority</span>
      <div class="priority-pills">
        <button
          class="pill"
          :class="{ active: currentTask?.priority === 'low' }"
          @click="$emit('set-priority', 'low')"
        >
          Low
        </button>
        <button
          class="pill"
          :class="{ active: currentTask?.priority === 'medium' }"
          @click="$emit('set-priority', 'medium')"
        >
          Med
        </button>
        <button
          class="pill"
          :class="{ active: currentTask?.priority === 'high' }"
          @click="$emit('set-priority', 'high')"
        >
          High
        </button>
      </div>
    </div>

    <!-- Date Quick Edit - Scrollable -->
    <div class="quick-edit-row date-row">
      <span class="edit-label">Due</span>
      <div class="date-pills-scroll">
        <button
          class="pill"
          :class="{ active: isToday }"
          @click="$emit('set-date', 'today')"
        >
          ☀️ Today
        </button>
        <button
          class="pill"
          :class="{ active: isTomorrow }"
          @click="$emit('set-date', 'tomorrow')"
        >
          🌅 Tmrw
        </button>
        <button
          class="pill"
          @click="$emit('set-date', 'in3days')"
        >
          📅 +3d
        </button>
        <button
          class="pill"
          :class="{ active: isWeekend }"
          @click="$emit('set-date', 'weekend')"
        >
          🏖️ Wknd
        </button>
        <button
          class="pill"
          @click="$emit('set-date', 'nextweek')"
        >
          📆 +1wk
        </button>
        <button
          class="pill"
          @click="$emit('set-date', '1month')"
        >
          🗓️ +1mo
        </button>
        <button
          class="pill clear"
          @click="$emit('set-date', 'clear')"
        >
          <X :size="14" />
        </button>
      </div>
    </div>

    <!-- AI Quick Action (TASK-1221) -->
    <div class="quick-edit-row ai-row">
      <span class="edit-label">AI</span>
      <div class="date-pills-scroll">
        <button
          class="pill ai-pill"
          :class="{ 'is-loading': aiAction === 'suggest' }"
          :disabled="isAIBusy"
          @click="$emit('ai-suggest')"
        >
          <Loader2 v-if="aiAction === 'suggest'" :size="12" class="spin" />
          <Sparkles v-else :size="12" />
          Suggest
        </button>
      </div>
    </div>

    <!-- Action Buttons - Four options: Done, Save, Assign, Delete -->
    <div class="action-row">
      <button class="action-btn done" @click="$emit('mark-done')">
        <CheckCircle :size="20" />
        <span>Done</span>
      </button>
      <button class="action-btn save" @click="$emit('save')">
        <Save :size="20" />
        <span>Save</span>
        <span v-if="isTaskDirty" class="dirty-dot" />
      </button>
      <button class="action-btn assign" @click="$emit('assign')">
        <FolderOpen :size="20" />
        <span>Assign</span>
      </button>
      <button class="action-btn delete" @click="$emit('delete')">
        <Trash2 :size="20" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  X, Sparkles, Loader2, CheckCircle, Save, FolderOpen, Trash2
} from 'lucide-vue-next'
import type { Task } from '@/types/tasks'

defineProps<{
  currentTask: Task | null
  isToday: boolean
  isTomorrow: boolean
  isWeekend: boolean
  aiAction: string | null
  isAIBusy: boolean
  isTaskDirty: boolean
}>()

defineEmits<{
  (e: 'set-priority', priority: 'low' | 'medium' | 'high'): void
  (e: 'set-date', preset: 'today' | 'tomorrow' | 'in3days' | 'weekend' | 'nextweek' | '1month' | 'clear'): void
  (e: 'ai-suggest'): void
  (e: 'mark-done'): void
  (e: 'save'): void
  (e: 'assign'): void
  (e: 'delete'): void
}>()
</script>
