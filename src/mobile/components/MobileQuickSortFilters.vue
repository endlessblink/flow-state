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

<style scoped>
/* ================================
   THUMB ZONE (Bottom Controls)
   ================================ */

.thumb-zone {
  padding: var(--space-4) var(--space-5);
  padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom, var(--space-6)));
  background: linear-gradient(to top, var(--overlay-bg), var(--overlay-component-bg-lighter), transparent);
  margin-top: auto;
  flex-shrink: 0;
  touch-action: pan-x pan-y;
}

.quick-edit-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  margin-bottom: var(--space-2);
}

.edit-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  min-width: 52px;
}

.priority-pills,
.date-pills {
  display: flex;
  gap: var(--space-1_5);
  flex: 1;
}

.date-pills-scroll {
  display: flex;
  gap: var(--space-2_5);
  flex: 1;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding-bottom: var(--space-px);
  padding-inline-end: var(--space-4);
  scroll-snap-type: x proximity;
}

.date-pills-scroll::-webkit-scrollbar {
  display: none;
}

.date-row {
  overflow: visible;
}

.pill {
  flex: 0 0 auto;
  padding: var(--space-2) var(--space-2_5);
  min-height: var(--dropdown-trigger-height-compact);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  white-space: nowrap;
}

.pill.active {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.priority-pills .pill {
  flex: 1;
}

.pill.clear {
  flex: 0;
  padding: var(--space-2);
  color: var(--text-muted);
}

.pill:active {
  transform: scale(0.95);
}

/* Action Row - 4 buttons: Done, Save, Assign, Delete */
.action-row {
  display: flex;
  gap: var(--space-2);
  padding-top: var(--space-1);
}

.action-btn {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: var(--space-1_5);
  padding: var(--space-2_5) var(--space-2);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.action-btn.done {
  color: var(--color-success);
  border-color: var(--success-border);
}

.action-btn.done:active {
  background: var(--success-bg-subtle);
}

.action-btn.assign {
  color: var(--brand-primary);
  border-color: var(--state-hover-border);
}

.action-btn.assign:active {
  background: var(--state-hover-bg);
}

.action-btn.save {
  color: var(--brand-primary);
  border-color: var(--state-hover-border);
  position: relative;
}

.action-btn.save:active {
  background: var(--state-hover-bg);
}

.dirty-dot {
  width: var(--space-2);
  height: var(--space-2);
  border-radius: var(--radius-full);
  background: var(--brand-primary);
  animation: dirty-pulse 2s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes dirty-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.8); }
}

.action-btn.delete {
  flex: 0 0 auto;
  padding: var(--space-2_5);
  color: var(--color-danger);
  border-color: var(--danger-border-subtle);
}

.action-btn.delete:active {
  background: var(--danger-bg-subtle);
}

.action-btn:active {
  transform: scale(0.95);
}

/* ================================
   AI QUICK ACTIONS (TASK-1221)
   ================================ */

.ai-row {
  border-top: 1px solid var(--glass-border);
  padding-top: var(--space-2);
}

.pill.ai-pill {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  gap: var(--space-1);
}

.pill.ai-pill:active {
  background: var(--brand-bg-subtle);
}

.pill.ai-pill.is-loading {
  opacity: 0.7;
}

.pill.ai-pill:disabled {
  opacity: 0.4;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spin {
  animation: spin 1s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .dirty-dot,
  .spin {
    animation: none !important;
    transition: none !important;
  }
}

[dir="rtl"] .quick-edit-row {
  flex-direction: row-reverse;
}
[dir="rtl"] .priority-pills,
[dir="rtl"] .date-pills,
[dir="rtl"] .date-pills-scroll {
  flex-direction: row-reverse;
}
[dir="rtl"] .action-row {
  flex-direction: row-reverse;
}
[dir="rtl"] .action-btn {
  flex-direction: row-reverse;
}
</style>
