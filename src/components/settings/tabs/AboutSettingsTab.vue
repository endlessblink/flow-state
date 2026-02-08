<script setup lang="ts">
import { CheckCircle, Download, RefreshCw, AlertCircle, ExternalLink, Info } from 'lucide-vue-next'
import SettingsSection from '../SettingsSection.vue'
import SettingsToggle from '../SettingsToggle.vue'
import { useTauriUpdater } from '@/composables/useTauriUpdater'
import { isTauri } from '@/composables/useTauriStartup'
import { useSettingsStore } from '@/stores/settings'
import { EXTERNAL_URLS } from '@/config/urls'

declare const __APP_VERSION__: string

const updater = useTauriUpdater()
const currentVersion = __APP_VERSION__
const settingsStore = useSettingsStore()

const handleCheckForUpdates = async () => {
  // After checking, update version from the updater response if available
  await updater.checkForUpdates()
}

const handleDownload = async () => {
  await updater.downloadAndInstall()
}

const handleRestart = async () => {
  await updater.restart()
}

const openWebsite = () => {
  window.open(EXTERNAL_URLS.PRODUCTION_SITE, '_blank')
}

const openGithub = () => {
  window.open(EXTERNAL_URLS.GITHUB_REPO, '_blank')
}
</script>

<template>
  <div class="about-settings-tab">
    <!-- App Info Section -->
    <SettingsSection>
      <div class="app-info">
        <div class="app-icon">
          <Info :size="32" class="icon" />
        </div>
        <h2 class="app-name">FlowState</h2>
        <p class="app-version">Version {{ currentVersion }}</p>
        <p class="app-tagline">Productivity meets flow</p>
      </div>
    </SettingsSection>

    <!-- Updates Section (Tauri only) -->
    <SettingsSection v-if="isTauri()" title="Updates">
      <div class="update-section">
        <!-- Idle / Up to Date State -->
        <div v-if="updater.status.value === 'idle' || updater.status.value === 'up-to-date'" class="update-idle">
          <div v-if="updater.status.value === 'up-to-date'" class="update-status success">
            <CheckCircle :size="20" />
            <span>You're up to date!</span>
          </div>
          <button class="update-btn primary" @click="handleCheckForUpdates">
            <RefreshCw :size="16" />
            Check for Updates
          </button>
        </div>

        <!-- Checking State -->
        <div v-else-if="updater.isChecking.value" class="update-status checking">
          <div class="spinner" />
          <span>Checking for updates...</span>
        </div>

        <!-- Update Available State -->
        <div v-else-if="updater.status.value === 'available'" class="update-available">
          <div class="update-info-box">
            <h4 class="update-info-title">Update Available: v{{ updater.updateInfo.value?.version }}</h4>
            <p v-if="updater.updateInfo.value?.body" class="update-info-body">
              {{ updater.updateInfo.value.body }}
            </p>
            <p v-if="updater.updateInfo.value?.date" class="update-info-date">
              Released: {{ new Date(updater.updateInfo.value.date).toLocaleDateString() }}
            </p>
          </div>
          <button class="update-btn primary" @click="handleDownload">
            <Download :size="16" />
            Download &amp; Install
          </button>
        </div>

        <!-- Downloading State -->
        <div v-else-if="updater.isDownloading.value" class="update-downloading">
          <div class="download-header">
            <span>Downloading update...</span>
            <span class="download-percent">{{ updater.downloadProgress.value }}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${updater.downloadProgress.value}%` }" />
          </div>
        </div>

        <!-- Ready to Restart State -->
        <div v-else-if="updater.status.value === 'ready'" class="update-ready">
          <div class="update-status success">
            <CheckCircle :size="20" />
            <span>Update downloaded and ready!</span>
          </div>
          <button class="update-btn primary" @click="handleRestart">
            <RefreshCw :size="16" />
            Restart to Apply
          </button>
        </div>

        <!-- Error State -->
        <div v-else-if="updater.status.value === 'error'" class="update-error">
          <div class="update-status error">
            <AlertCircle :size="20" />
            <span>{{ updater.error.value || 'Failed to check for updates' }}</span>
          </div>
          <button class="update-btn secondary" @click="handleCheckForUpdates">
            <RefreshCw :size="16" />
            Retry
          </button>
        </div>

        <!-- Auto-update toggle -->
        <div class="auto-update-toggle">
          <SettingsToggle
            label="Automatic updates"
            description="Download and install updates automatically on launch"
            :value="settingsStore.autoUpdateEnabled"
            @update="(val: boolean) => settingsStore.updateSetting('autoUpdateEnabled', val)"
          />
        </div>
      </div>
    </SettingsSection>

    <!-- Links Section -->
    <SettingsSection title="Links">
      <div class="links-section">
        <button class="link-btn" @click="openWebsite">
          <ExternalLink :size="16" />
          Website
        </button>
        <button class="link-btn" @click="openGithub">
          <ExternalLink :size="16" />
          GitHub
        </button>
      </div>
    </SettingsSection>
  </div>
</template>

<style scoped>
.about-settings-tab {
  display: flex;
  flex-direction: column;
}

/* App Info */
.app-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--space-6) 0;
}

.app-icon {
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-4);
  box-shadow: 0 8px 16px var(--shadow-strong);
}

.app-icon .icon {
  color: white;
}

.app-name {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0 0 var(--space-1) 0;
}

.app-version {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin: 0 0 var(--space-3) 0;
  font-family: monospace;
}

.app-tagline {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin: 0;
  font-style: italic;
}

/* Update Section */
.update-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.update-idle,
.update-available,
.update-downloading,
.update-ready,
.update-error {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.update-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.update-status.success {
  background: var(--glass-bg-soft);
  border: 1px solid var(--success-border);
  color: var(--success-text);
}

.update-status.checking {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
}

.update-status.error {
  background: var(--glass-bg-soft);
  border: 1px solid var(--danger-border);
  color: var(--danger-text);
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--glass-border);
  border-top-color: var(--primary-500);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Update Info Box */
.update-info-box {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}

.update-info-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-2) 0;
}

.update-info-body {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0 0 var(--space-2) 0;
  line-height: 1.5;
  white-space: pre-wrap;
}

.update-info-date {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: 0;
}

/* Progress Bar */
.download-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: var(--font-medium);
}

.download-percent {
  color: var(--primary-500);
  font-weight: var(--font-semibold);
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-500), var(--primary-600));
  border-radius: var(--radius-full);
  transition: width 0.3s var(--spring-smooth);
}

/* Buttons */
.update-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  border: 1px solid transparent;
}

.update-btn.primary {
  background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
  color: white;
  box-shadow: 0 4px 12px var(--shadow-strong);
}

.update-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px var(--shadow-xl);
}

.update-btn.primary:active {
  transform: translateY(0);
}

.update-btn.secondary {
  background: var(--glass-bg-soft);
  border-color: var(--glass-border);
  color: var(--text-primary);
}

.update-btn.secondary:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-strong);
}

/* Links Section */
.links-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.auto-update-toggle {
  padding-top: var(--space-3);
  border-top: 1px solid var(--glass-border);
}

.link-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  text-align: left;
}

.link-btn:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-strong);
  transform: translateX(4px);
}

.link-btn svg {
  color: var(--text-muted);
}
</style>
