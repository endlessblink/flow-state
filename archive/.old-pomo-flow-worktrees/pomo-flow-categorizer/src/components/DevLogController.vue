<template>
  <div v-if="isVisible" class="log-controller">
    <div class="log-controller-header">
      <h3>🔧 Dev Log Controller</h3>
      <button @click="togglePanel" class="close-btn">✕</button>
    </div>

    <div class="log-controller-body">
      <div class="log-section">
        <h4>Master Controls</h4>
        <button @click="toggleAll(true)" class="btn-success">Enable All Logs</button>
        <button @click="toggleAll(false)" class="btn-danger">Disable All Logs</button>
      </div>

      <div class="log-section">
        <h4>Timer Logs 🍅</h4>
        <label>
          <input type="checkbox" v-model="logToggles.timer" @change="updateFilters">
          Timer updates (every second)
        </label>
        <label>
          <input type="checkbox" v-model="logToggles.tabUpdate" @change="updateFilters">
          Browser tab updates
        </label>
      </div>

      <div class="log-section">
        <h4>Task Store Logs 🚨</h4>
        <label>
          <input type="checkbox" v-model="logToggles.taskFiltering" @change="updateFilters">
          Task filtering (very verbose)
        </label>
        <label>
          <input type="checkbox" v-model="logToggles.taskUpdates" @change="updateFilters">
          Task updates
        </label>
      </div>

      <div class="log-section">
        <h4>Undo/Redo Logs 🔍</h4>
        <label>
          <input type="checkbox" v-model="logToggles.undoSystem" @change="updateFilters">
          Undo system debug
        </label>
        <label>
          <input type="checkbox" v-model="logToggles.undoOperations" @change="updateFilters">
          Undo operations
        </label>
      </div>

      <div class="log-section">
        <h4>Canvas Logs 📐</h4>
        <label>
          <input type="checkbox" v-model="logToggles.canvasResize" @change="updateFilters">
          Section resizing
        </label>
        <label>
          <input type="checkbox" v-model="logToggles.canvasDrag" @change="updateFilters">
          Dragging operations
        </label>
        <label>
          <input type="checkbox" v-model="logToggles.taskNodeTimer" @change="updateFilters">
          TaskNode timer checks
        </label>
      </div>

      <div class="log-section">
        <h4>Database Logs 💾</h4>
        <label>
          <input type="checkbox" v-model="logToggles.database" @change="updateFilters">
          Database operations
        </label>
      </div>

      <div class="log-section">
        <h4>Other Logs</h4>
        <label>
          <input type="checkbox" v-model="logToggles.cloudSync" @change="updateFilters">
          Cloud sync
        </label>
        <label>
          <input type="checkbox" v-model="logToggles.storage" @change="updateFilters">
          Storage operations
        </label>
      </div>

      <div class="log-section info">
        <p><strong>How to use:</strong></p>
        <ol>
          <li>Uncheck categories to hide those logs in real-time</li>
          <li>Changes apply instantly to the console</li>
          <li>Settings are saved automatically</li>
        </ol>
        <div class="filter-output">
          <strong>Current Status:</strong>
          <code>{{ consoleFilter }}</code>
          <button @click="copyFilter" class="btn-copy">📋 Copy</button>
        </div>
      </div>
    </div>

    <div class="log-controller-footer">
      <small>Press <kbd>Ctrl+Shift+L</kbd> to toggle this panel</small>
    </div>
  </div>

  <!-- Floating toggle button -->
  <button v-else @click="togglePanel" class="log-controller-toggle" title="Open Log Controller (Ctrl+Shift+L)">
    🔧
  </button>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { getLogToggles, saveLogToggles } from '@/utils/consoleFilter'

const isVisible = ref(false)

const logToggles = ref(getLogToggles())

const consoleFilter = computed(() => {
  const disabled: string[] = []

  if (!logToggles.value.timer) disabled.push('Timer updates')
  if (!logToggles.value.tabUpdate) disabled.push('Tab updates')
  if (!logToggles.value.taskFiltering) disabled.push('Task filtering')
  if (!logToggles.value.taskUpdates) disabled.push('Task updates')
  if (!logToggles.value.undoSystem) disabled.push('Undo system')
  if (!logToggles.value.undoOperations) disabled.push('Undo operations')
  if (!logToggles.value.canvasResize) disabled.push('Canvas resize')
  if (!logToggles.value.canvasDrag) disabled.push('Canvas drag')
  if (!logToggles.value.taskNodeTimer) disabled.push('TaskNode timer')
  if (!logToggles.value.database) disabled.push('Database')
  if (!logToggles.value.cloudSync) disabled.push('Cloud sync')
  if (!logToggles.value.storage) disabled.push('Storage')

  return disabled.length > 0
    ? `Filtered: ${disabled.join(', ')}`
    : 'All logs enabled'
})

const togglePanel = () => {
  isVisible.value = !isVisible.value
}

const toggleAll = (enabled: boolean) => {
  Object.keys(logToggles.value).forEach(key => {
    logToggles.value[key as keyof typeof logToggles.value] = enabled
  })
  updateFilters()
}

const updateFilters = () => {
  // Save preferences using shared utility
  saveLogToggles(logToggles.value)
}

const copyFilter = async () => {
  try {
    await navigator.clipboard.writeText(consoleFilter.value)
    alert('Current filter settings copied to clipboard!')
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

// Keyboard shortcut
const handleKeyboard = (e: KeyboardEvent) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'L') {
    e.preventDefault()
    togglePanel()
  }
}

// Watch for toggle changes and reapply filtering
watch(logToggles, () => {
  updateFilters()
}, { deep: true })

onMounted(() => {
  // Load current toggles from shared utility
  logToggles.value = getLogToggles()

  window.addEventListener('keydown', handleKeyboard)

  console.log('🔧 DevLogController initialized - Press Ctrl+Shift+L to toggle')
  console.log('📊 All logs are HIDDEN by default. Check categories to enable them.')
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyboard)
})
</script>

<style scoped>
.log-controller {
  position: fixed;
  top: 60px;
  right: 20px;
  width: 400px;
  max-height: 80vh;
  background: rgba(30, 30, 40, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(10px);
  z-index: 9999;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.log-controller-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.log-controller-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #fff;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.log-controller-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.log-section {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.log-section:last-child {
  border-bottom: none;
}

.log-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #a0a0ff;
}

.log-section label {
  display: block;
  margin-bottom: 8px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.log-section input[type="checkbox"] {
  cursor: pointer;
  width: 16px;
  height: 16px;
}

.log-section button {
  margin-right: 8px;
  margin-bottom: 8px;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-success {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.btn-success:hover {
  background: rgba(34, 197, 94, 0.3);
}

.btn-danger {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.btn-danger:hover {
  background: rgba(239, 68, 68, 0.3);
}

.log-section.info {
  background: rgba(59, 130, 246, 0.1);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.log-section.info p {
  margin: 0 0 8px 0;
  font-size: 13px;
}

.log-section.info ol {
  margin: 8px 0;
  padding-left: 20px;
  font-size: 12px;
  line-height: 1.6;
}

.filter-output {
  margin-top: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.filter-output strong {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  color: #a0a0ff;
}

.filter-output code {
  display: block;
  padding: 8px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 4px;
  font-size: 11px;
  font-family: 'Courier New', monospace;
  word-break: break-all;
  color: #4ade80;
  margin-bottom: 8px;
}

.btn-copy {
  width: 100%;
  padding: 6px;
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-copy:hover {
  background: rgba(59, 130, 246, 0.3);
}

.log-controller-footer {
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.05);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
}

.log-controller-footer small {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}

kbd {
  background: rgba(0, 0, 0, 0.3);
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  font-family: monospace;
  font-size: 11px;
}

.log-controller-toggle {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(30, 30, 40, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  z-index: 9999;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.log-controller-toggle:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  background: rgba(30, 30, 40, 1);
}
</style>
