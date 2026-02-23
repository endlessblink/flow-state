<script setup lang="ts">

interface AISuggestion {
  field: string
  currentValue: unknown
  suggestedValue: unknown
  confidence: number
  reasoning?: string
}

defineProps<{
  show: boolean
  aiState: string | null
  aiAction: string | null
  aiError: string | null
  currentSuggestions: AISuggestion[]
  suggestedProjectId: string | null
  suggestedProjectName: string | null
  currentTaskProjectName: string | null
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'apply-suggestions'): void
}>()
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="show" class="sheet-overlay" @click.self="$emit('close')">
        <div class="ai-sheet" @click.stop>
          <div class="sheet-handle" />

          <!-- AI Error -->
          <div v-if="aiState === 'error'" class="ai-sheet-body">
            <h3 class="sheet-title">AI Error</h3>
            <p class="ai-error-text" dir="auto">{{ aiError }}</p>
            <div class="sheet-actions">
              <button class="sheet-btn primary" @click="$emit('close')">Close</button>
            </div>
          </div>

          <!-- Smart Suggest Results -->
          <div v-else-if="aiAction === 'suggest'" class="ai-sheet-body">
            <h3 class="sheet-title">AI Suggestions</h3>
            <div class="ai-suggestions-list">
              <div
                v-for="s in currentSuggestions"
                :key="s.field"
                class="ai-suggestion-item"
              >
                <div class="ai-suggestion-top">
                  <span class="ai-field-name">{{ s.field }}</span>
                  <span class="ai-confidence">{{ Math.round(s.confidence * 100) }}%</span>
                </div>
                <div class="ai-suggestion-change">
                  <span class="ai-from">{{ s.currentValue || 'none' }}</span>
                  <span class="ai-arrow">&rarr;</span>
                  <span class="ai-to" dir="auto">{{ s.suggestedValue }}</span>
                </div>
                <p v-if="s.reasoning" class="ai-reason" dir="auto">{{ s.reasoning }}</p>
              </div>
              <div v-if="suggestedProjectId" class="ai-suggestion-item">
                <div class="ai-suggestion-top">
                  <span class="ai-field-name">project</span>
                </div>
                <div class="ai-suggestion-change">
                  <span class="ai-from">{{ currentTaskProjectName || 'none' }}</span>
                  <span class="ai-arrow">&rarr;</span>
                  <span class="ai-to" dir="auto">{{ suggestedProjectName || 'Suggested' }}</span>
                </div>
              </div>
            </div>
            <div class="sheet-actions">
              <button class="sheet-btn primary" @click="$emit('apply-suggestions')">Apply All</button>
              <button class="sheet-btn secondary" @click="$emit('close')">Dismiss</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  backdrop-filter: blur(var(--blur-xs));
  -webkit-backdrop-filter: blur(var(--blur-xs));
  display: flex;
  align-items: flex-end;
  z-index: var(--z-dropdown);
}

.sheet-handle {
  width: var(--dropdown-trigger-height-compact);
  height: var(--space-1);
  background: var(--glass-border-strong);
  border-radius: var(--radius-full);
  margin: 0 auto var(--space-5);
}

.sheet-title {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  margin: 0 0 var(--space-4);
  text-align: center;
}

/* Sheet transition */
.sheet-enter-active,
.sheet-leave-active {
  transition: all var(--duration-slow) cubic-bezier(0.16, 1, 0.3, 1);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .ai-sheet,
.sheet-leave-to .ai-sheet {
  transform: translateY(100%);
}

/* AI Results Bottom Sheet (TASK-1221) */
.ai-sheet {
  width: 100%;
  max-height: 70vh;
  overflow-y: auto;
  background: var(--surface-primary);
  border-top-left-radius: var(--radius-2xl);
  border-top-right-radius: var(--radius-2xl);
  padding: var(--space-4) var(--space-5);
  padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom));
}

.ai-sheet-body {
  padding: 0;
}

.ai-error-text {
  color: var(--danger);
  font-size: var(--text-sm);
  margin: 0 0 var(--space-3) 0;
}

.ai-suggestions-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.ai-suggestion-item {
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
}

.ai-suggestion-top {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-1);
}

.ai-field-name {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  text-transform: capitalize;
}

.ai-confidence {
  font-size: var(--text-xs);
  color: var(--brand-primary);
  font-weight: var(--font-semibold);
}

.ai-suggestion-change {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
}

.ai-from {
  color: var(--text-muted);
  text-decoration: line-through;
}

.ai-arrow {
  color: var(--brand-primary);
}

.ai-to {
  color: var(--text-primary);
  font-weight: var(--font-semibold);
}

.ai-reason {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: var(--space-1) 0 0 0;
  font-style: italic;
}

/* AI Batch List */
.ai-batch-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1_5);
  margin-bottom: var(--space-3);
  max-height: 300px;
  overflow-y: auto;
}

.ai-batch-item {
  padding: var(--space-1_5) var(--space-2);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
}

.ai-batch-name {
  font-size: var(--text-sm);
  color: var(--text-primary);
  display: block;
  margin-bottom: var(--space-0_5);
}

.ai-batch-tags {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.ai-tag {
  font-size: 10px;
  padding: 1px var(--space-1);
  background: var(--glass-bg-medium);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
}

/* AI Explain Results */
.ai-explain-desc {
  font-size: var(--text-sm);
  color: var(--text-primary);
  margin: 0 0 var(--space-2) 0;
  line-height: 1.5;
}

.ai-explain-steps {
  margin: 0 0 var(--space-3) 0;
  padding-left: var(--space-5);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.ai-explain-steps li {
  margin-bottom: var(--space-1);
}

/* Sheet Action Buttons */
.sheet-actions {
  display: flex;
  gap: var(--space-2);
}

.sheet-btn {
  flex: 1;
  padding: var(--space-2_5) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal);
  backdrop-filter: blur(8px);
}

.sheet-btn.primary {
  background: var(--glass-bg-soft);
  border: 1px solid var(--brand-primary);
  color: var(--brand-primary);
}

.sheet-btn.primary:active {
  background: rgba(78, 205, 196, 0.15);
}

.sheet-btn.secondary {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
}

.sheet-btn.secondary:active {
  background: var(--glass-bg-medium);
}

/* AI Sort Feedback */
.ai-sort-feedback {
  background: var(--brand-bg-subtle) !important;
  border-color: var(--brand-primary) !important;
  color: var(--brand-primary) !important;
}
</style>
