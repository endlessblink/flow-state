<!--
  KeyboardTestSuite Component
  Extracted from CanvasView.vue lines 211-231 and related functions
  Temporary testing component for keyboard deletion functionality
-->
<template>
  <div v-if="isVisible" class="keyboard-test-overlay">
    <div class="keyboard-test-content">
      <div class="test-header">
        <h3>Keyboard Deletion Test Suite</h3>
        <button @click="$emit('close')" class="close-btn">✕</button>
      </div>
      <div class="test-controls">
        <button
          @click="$emit('run-test')"
          :disabled="isTestRunning"
          class="test-btn primary"
        >
          {{ isTestRunning ? '⏳ Running...' : '🚀 Run Test' }}
        </button>
        <div class="test-status">{{ testStatus }}</div>
      </div>
      <div class="test-results">
        <div
          v-for="(result, index) in testResults"
          :key="index"
          :class="['result-item', result.status]"
        >
          <span>{{ result.status === 'passed' ? '✅' : result.status === 'failed' ? '❌' : '⏳' }}</span>
          <span>{{ result.message }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  isVisible: boolean
  isTestRunning: boolean
  testStatus: string
  testResults: Array<{
    status: 'passed' | 'failed' | 'running'
    message: string
  }>
}

interface Emits {
  (e: 'close'): void
  (e: 'run-test'): void
}

defineProps<Props>()
defineEmits<Emits>()
</script>

<style scoped>
.keyboard-test-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.keyboard-test-content {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  padding: 2rem;
  color: var(--text-primary);
}

.test-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.test-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  transition: all var(--transition-fast);
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.test-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.test-btn {
  background: var(--accent-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  padding: 0.75rem 1.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  min-width: 120px;
}

.test-btn:hover:not(:disabled) {
  background: var(--accent-primary-hover);
  transform: translateY(-1px);
}

.test-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.test-btn.primary {
  background: var(--brand-primary);
  color: white;
}

.test-btn.primary:hover:not(:disabled) {
  background: var(--brand-primary-hover);
}

.test-status {
  font-size: 0.875rem;
  color: var(--text-secondary);
  text-align: center;
  max-width: 400px;
}

.test-results {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
  padding: 0.5rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.result-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  transition: all var(--transition-fast);
}

.result-item.passed {
  background: var(--success-bg);
  color: var(--success-color);
  border: 1px solid var(--success-border);
}

.result-item.failed {
  background: var(--error-bg);
  color: var(--error-color);
  border: 1px solid var(--error-border);
}

.result-item.running {
  background: var(--warning-bg);
  color: var(--warning-color);
  border: 1px solid var(--warning-border);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

@media (max-width: 768px) {
  .keyboard-test-content {
    margin: 1rem;
    padding: 1.5rem;
  }

  .test-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .test-controls {
    align-items: stretch;
  }

  .test-btn {
    width: 100%;
  }
}
</style>