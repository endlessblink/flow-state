<template>
  <div class="simple-backup-settings">
    <div class="backup-status">
      <h3 class="section-title">💾 Backup & Export</h3>

      <div class="status-indicator">
        <div class="status-icon">
          ⚠️
        </div>
        <div class="status-text">
          <div class="primary-status">Backup system disabled</div>
          <div class="backup-count">Automatic backups temporarily paused</div>
        </div>
      </div>

      <div class="backup-notice">
        <p>⚠️ The backup system has been temporarily disabled for application stability.</p>
        <p>Your tasks are still saved locally and will persist between sessions.</p>
      </div>
    </div>

    <!-- Manual Actions Section -->
    <div class="backup-actions">
      <h3 class="section-title">📤 Manual Actions</h3>

      <div class="action-buttons">
        <button @click="showManualExportHelp" class="action-button primary" disabled>
          📤 Export Tasks (Disabled)
        </button>

        <button @click="showManualBackupHelp" class="action-button secondary" disabled>
          💾 Create Backup (Disabled)
        </button>
      </div>

      <div class="manual-help">
        <p><strong>Manual Data Access:</strong></p>
        <p>• Browser Developer Tools → Application → Local Storage</p>
        <p>• Browser Developer Tools → Application → IndexedDB</p>
        <p>• Data is stored in PouchDB and will persist automatically</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// ⚠️ Backup system disabled for stability
console.log('SimpleBackupSettings: Backup system disabled - showing placeholder')

// Simple placeholder methods
const showManualExportHelp = () => {
  console.log('Export functionality disabled for stability')
}

const showManualBackupHelp = () => {
  console.log('Backup functionality disabled for stability')
}

// TODO: Re-enable backup system after app stabilization
</script>

<style scoped>
.simple-backup-settings {
  padding: 20px;
  max-width: 600px;
}

.section-title {
  font-size: 1.1em;
  font-weight: 600;
  margin: 0 0 15px 0;
  color: var(--text-primary);
}

.backup-status {
  background: var(--glass-bg-soft);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 25px;
  border: 1px solid var(--glass-border);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 15px;
}

.status-icon {
  font-size: 24px;
  opacity: 0.3;
  transition: opacity 0.2s;
}

.status-icon.active {
  opacity: 1;
}

.status-text {
  flex: 1;
}

.primary-status {
  font-size: 1.1em;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.backup-count {
  font-size: 0.9em;
  color: var(--text-muted);
}

.backup-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  padding-top: 15px;
  border-top: 1px solid var(--glass-border);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.9em;
}

.label {
  color: var(--text-muted);
}

.value {
  font-weight: 600;
  color: var(--text-primary);
}

.backup-actions {
  background: var(--glass-bg-soft);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid var(--glass-border);
}

.action-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 25px;
}

.action-button {
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 0.95em;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-button.primary {
  background: transparent;
  border: 1px solid var(--brand-primary);
  color: var(--brand-primary);
}

.action-button.primary:hover:not(:disabled) {
  background: rgba(78, 205, 196, 0.08);
  border-color: var(--brand-hover);
  color: var(--brand-hover);
}

.action-button.secondary {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
}

.action-button.secondary:hover:not(:disabled) {
  background: var(--state-hover-bg);
  border-color: var(--border-medium);
  color: var(--text-primary);
}

.action-button.tertiary {
  background: transparent;
  border: 1px solid var(--border-light);
  color: var(--text-muted);
}

.action-button.tertiary:hover:not(:disabled) {
  background: var(--state-hover-bg);
  border-color: var(--border-medium);
  color: var(--text-secondary);
}

.restore-section {
  border-top: 1px solid var(--glass-border);
  padding-top: 20px;
}

.restore-title {
  font-size: 1em;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: var(--text-primary);
}

.restore-button {
  padding: 10px 16px;
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: 6px;
  font-size: 0.9em;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.restore-button:hover:not(:disabled) {
  background: var(--glass-bg-medium);
}

.restore-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.message {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 12px 20px;
  border-radius: 8px;
  font-weight: 600;
  z-index: 2000;
  animation: slideIn 0.3s ease-out;
}

.message.success {
  background: var(--success-color, #10b981);
  color: white;
}

.message.error {
  background: var(--error-color, #ef4444);
  color: white;
}

.message.warning {
  background: var(--warning-color, #f59e0b);
  color: white;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.restore-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.restore-dialog {
  background: var(--glass-bg-heavy);
  border-radius: 12px;
  padding: 0;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--glass-border);
  background: var(--glass-bg-light);
}

.dialog-header h3 {
  margin: 0;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-muted);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

.dialog-content {
  padding: 20px;
}

.backup-list {
  max-height: 300px;
  overflow-y: auto;
  margin: 20px 0;
}

.backup-option {
  padding: 12px;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.backup-option:hover {
  background: var(--glass-bg-light);
}

.backup-option.selected {
  border-color: var(--state-active-border);
  background: var(--state-active-bg);
  color: white;
}

.backup-time {
  font-weight: 600;
  margin-bottom: 4px;
}

.backup-stats {
  font-size: 0.9em;
  opacity: 0.8;
  margin-bottom: 4px;
}

.hebrew-indicator {
  font-size: 0.85em;
  font-weight: 600;
}

.dialog-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}

.import-btn,
.confirm-btn,
.cancel-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 0.9em;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.import-btn {
  background: var(--glass-bg-light);
  color: var(--text-primary);
  border: 1px solid var(--glass-border);
}

.import-btn:hover {
  background: var(--glass-bg-medium);
}

.confirm-btn.primary {
  background: var(--state-active-bg);
  color: white;
}

.confirm-btn.primary:hover:not(:disabled) {
  background: var(--state-active-border);
}

.cancel-btn {
  background: transparent;
  color: var(--text-muted);
}

.cancel-btn:hover {
  background: var(--glass-bg-light);
  color: var(--text-primary);
}

.backup-notice {
  padding: 15px;
  margin-top: 15px;
  border-radius: 8px;
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  font-size: 0.9em;
  line-height: 1.4;
}

.backup-notice p {
  margin: 0 0 8px 0;
}

.backup-notice p:last-child {
  margin-bottom: 0;
}

.manual-help {
  margin-top: 20px;
  padding: 15px;
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  font-size: 0.9em;
  color: var(--text-secondary);
  line-height: 1.4;
}

.manual-help p {
  margin: 0 0 8px 0;
}

.manual-help p:last-child {
  margin-bottom: 0;
}

.manual-help strong {
  color: var(--text-primary);
  display: block;
  margin-bottom: 8px;
}
</style>