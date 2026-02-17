<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { LogOut, Key, Eye, EyeOff, Check, AlertCircle, Loader2, CheckCircle, Download, RefreshCw, ExternalLink, Info, Plus, Trash2, Calendar } from 'lucide-vue-next'
import SettingsSection from '../SettingsSection.vue'
import SettingsToggle from '../SettingsToggle.vue'
import { supabase } from '@/services/auth/supabase'
import { useTauriUpdater } from '@/composables/useTauriUpdater'
import { isTauri } from '@/composables/useTauriStartup'
import { useSettingsStore, type ExternalCalendarConfig } from '@/stores/settings'
import { EXTERNAL_URLS } from '@/config/urls'

const emit = defineEmits<{ closeModal: [] }>()

declare const __APP_VERSION__: string

const authStore = useAuthStore()
const settingsStore = useSettingsStore()

// ── About section ──
const updater = useTauriUpdater()
const currentVersion = __APP_VERSION__

const handleCheckForUpdates = async () => {
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

// ── Integrations section ──
const newCalName = ref('')
const newCalUrl = ref('')
const newCalColor = ref('#6366f1')
const addError = ref('')

const calendars = computed(() => settingsStore.externalCalendars || [])
const syncInterval = computed(() => settingsStore.externalCalendarSyncInterval)

const colorPresets = [
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Teal', value: '#14b8a6' },
]

const addCalendar = () => {
  addError.value = ''

  if (!newCalName.value.trim()) {
    addError.value = 'Name is required'
    return
  }
  if (!newCalUrl.value.trim()) {
    addError.value = 'URL is required'
    return
  }

  try {
    new URL(newCalUrl.value.trim())
  } catch {
    addError.value = 'Invalid URL format'
    return
  }

  const id = `ical-${Date.now()}`
  const config: ExternalCalendarConfig = {
    id,
    name: newCalName.value.trim(),
    url: newCalUrl.value.trim(),
    color: newCalColor.value,
    enabled: true
  }

  const cals = [...(settingsStore.externalCalendars || []), config]
  settingsStore.updateSetting('externalCalendars', cals)

  newCalName.value = ''
  newCalUrl.value = ''
  newCalColor.value = '#6366f1'
}

const removeCalendar = (calId: string) => {
  const cals = (settingsStore.externalCalendars || []).filter(c => c.id !== calId)
  settingsStore.updateSetting('externalCalendars', cals)
}

const toggleCalendar = (calId: string) => {
  const cals = [...(settingsStore.externalCalendars || [])]
  const idx = cals.findIndex(c => c.id === calId)
  if (idx !== -1) {
    cals[idx] = { ...cals[idx], enabled: !cals[idx].enabled }
    settingsStore.updateSetting('externalCalendars', cals)
  }
}

const updateSyncInterval = (minutes: number) => {
  settingsStore.updateSetting('externalCalendarSyncInterval', minutes)
}

const formatLastSynced = (isoString?: string) => {
  if (!isoString) return 'Never'
  const d = new Date(isoString)
  return d.toLocaleString()
}

// Change password state
const showChangePassword = ref(false)
const newPassword = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const passwordError = ref('')
const passwordSuccess = ref(false)
const isChangingPassword = ref(false)

// TASK-337: Computed properties for proper auth state handling
const isAuthReady = computed(() =>
  authStore.isInitialized && authStore.isAuthenticated && supabase !== null
)

// TASK-337 FIX: Always allow password change attempt for authenticated users
// Reason: app_metadata.providers is unreliable (doesn't update after OAuth users set password)
// The Supabase API will return an appropriate error if password change isn't supported
// See: https://github.com/supabase/auth/issues/1605
const canChangePassword = computed(() => true)

const handleSignOut = async () => {
  await authStore.signOut()
  // BUG-1352: Force full page reload to reset all reactive state to guest mode.
  // Just closing the modal leaves stale data in composables, watchers, and views
  // that don't properly react to the auth→guest transition.
  window.location.reload()
}

const handleChangePassword = async () => {
  // TASK-337: Null check for supabase client (Guest Mode protection)
  if (!supabase) {
    passwordError.value = 'Password change unavailable in Guest Mode'
    return
  }

  passwordError.value = ''
  passwordSuccess.value = false

  if (newPassword.value.length < 6) {
    passwordError.value = 'Password must be at least 6 characters'
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Passwords do not match'
    return
  }

  isChangingPassword.value = true

  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword.value
    })

    if (error) {
      // Provide user-friendly error messages
      if (error.message.includes('identity') || error.message.includes('provider')) {
        passwordError.value = 'Password change not available for accounts using Google/OAuth sign-in'
      } else {
        passwordError.value = error.message
      }
    } else {
      // TASK-337: Refresh session after password change
      await supabase.auth.refreshSession()

      passwordSuccess.value = true
      newPassword.value = ''
      confirmPassword.value = ''
      setTimeout(() => {
        showChangePassword.value = false
        passwordSuccess.value = false
      }, 2000)
    }
  } catch (err: unknown) {
    passwordError.value = err instanceof Error ? err.message : 'Failed to change password'
  } finally {
    isChangingPassword.value = false
  }
}
</script>

<template>
  <div class="account-settings-tab">
    <SettingsSection title="👤 Account Settings">
      <!-- TASK-337: Fixed template structure - single v-if block for authenticated content -->
      <template v-if="isAuthReady">
        <div class="account-info">
          <div class="user-details">
            <div class="user-email">
              {{ authStore.user?.email }}
            </div>
            <div class="user-status">
              Logged in via Supabase
            </div>
          </div>

          <div class="account-actions">
            <!-- Only show Change Password for email auth users -->
            <button
              v-if="canChangePassword"
              class="change-password-btn"
              @click="showChangePassword = !showChangePassword"
            >
              <Key :size="16" />
              <span>Change Password</span>
            </button>
            <button class="logout-btn" @click="handleSignOut">
              <LogOut :size="16" />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        <!-- Change Password Form -->
        <div v-if="showChangePassword" class="change-password-form">
          <div class="form-group">
            <label class="form-label">New Password</label>
            <div class="password-input-wrapper">
              <input
                v-model="newPassword"
                :type="showPassword ? 'text' : 'password'"
                class="form-input"
                placeholder="Enter new password"
              >
              <button class="toggle-visibility" @click="showPassword = !showPassword">
                <Eye v-if="!showPassword" :size="16" />
                <EyeOff v-else :size="16" />
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Confirm Password</label>
            <input
              v-model="confirmPassword"
              :type="showPassword ? 'text' : 'password'"
              class="form-input"
              placeholder="Confirm new password"
            >
          </div>

          <div v-if="passwordError" class="password-error">
            <AlertCircle :size="14" />
            {{ passwordError }}
          </div>

          <div v-if="passwordSuccess" class="password-success">
            <Check :size="14" />
            Password changed successfully!
          </div>

          <button
            class="save-password-btn"
            :disabled="isChangingPassword || !newPassword || !confirmPassword"
            @click="handleChangePassword"
          >
            {{ isChangingPassword ? 'Changing...' : 'Save New Password' }}
          </button>
        </div>
      </template>

      <!-- Loading state while auth initializes -->
      <div v-else-if="!authStore.isInitialized" class="loading-state">
        <Loader2 :size="20" class="animate-spin" />
        <span>Loading account info...</span>
      </div>

      <!-- Guest Mode - shows when not authenticated -->
      <div v-else class="guest-info">
        <div class="guest-status">
          <div class="status-badge">
            Guest Mode
          </div>
          <p class="setting-description">
            You are currently using local storage. Create an account to sync your tasks across devices.
          </p>
        </div>
      </div>
    </SettingsSection>

    <!-- About Section (merged from AboutSettingsTab) -->
    <SettingsSection>
      <div class="app-info">
        <div class="app-icon">
          <Info :size="32" class="icon" />
        </div>
        <h2 class="app-name">
          FlowState
        </h2>
        <p class="app-version">
          Version {{ currentVersion }}
        </p>
        <p class="app-tagline">
          Productivity meets flow
        </p>
      </div>
    </SettingsSection>

    <SettingsSection v-if="isTauri()" title="Updates">
      <div class="update-section">
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

        <div v-else-if="updater.isChecking.value" class="update-status checking">
          <div class="spinner" />
          <span>Checking for updates...</span>
        </div>

        <div v-else-if="updater.status.value === 'available'" class="update-available">
          <div class="update-info-box">
            <h4 class="update-info-title">
              Update Available: v{{ updater.updateInfo.value?.version }}
            </h4>
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

        <div v-else-if="updater.isDownloading.value" class="update-downloading">
          <div class="download-header">
            <span>Downloading update...</span>
            <span class="download-percent">{{ updater.downloadProgress.value }}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${updater.downloadProgress.value}%` }" />
          </div>
        </div>

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

    <!-- Integrations Section (merged from IntegrationsSettingsTab) -->
    <SettingsSection title="External Calendars">
      <p class="section-description">
        Add iCal/ICS calendar feeds to show external events as read-only overlays in your calendar views.
        Works with Google Calendar, Outlook, Apple Calendar, and any iCal-compatible service.
      </p>

      <details class="help-details">
        <summary class="help-summary">
          How to get your Google Calendar iCal URL
        </summary>
        <ol class="help-steps">
          <li>Open <strong>Google Calendar</strong> in your browser</li>
          <li>Click the <strong>gear icon</strong> → <strong>Settings</strong></li>
          <li>Under "Settings for my calendars", click the calendar you want</li>
          <li>Scroll to <strong>"Integrate calendar"</strong></li>
          <li>Copy the <strong>"Secret address in iCal format"</strong> URL</li>
        </ol>
      </details>

      <div v-if="calendars.length > 0" class="calendar-list">
        <div
          v-for="cal in calendars"
          :key="cal.id"
          class="calendar-item"
        >
          <div class="calendar-item-left">
            <div class="color-dot" :style="{ backgroundColor: cal.color }" />
            <div class="calendar-info">
              <span class="calendar-name">{{ cal.name }}</span>
              <span class="calendar-meta">
                <template v-if="cal.error">
                  <AlertCircle :size="12" class="error-icon" />
                  {{ cal.error }}
                </template>
                <template v-else-if="cal.lastSynced">
                  <Check :size="12" class="success-icon" />
                  Last synced: {{ formatLastSynced(cal.lastSynced) }}
                </template>
                <template v-else>
                  Not yet synced
                </template>
              </span>
            </div>
          </div>
          <div class="calendar-item-actions">
            <SettingsToggle
              :label="cal.enabled ? 'On' : 'Off'"
              :value="cal.enabled"
              @update="toggleCalendar(cal.id)"
            />
            <button class="icon-btn danger" title="Remove calendar" @click="removeCalendar(cal.id)">
              <Trash2 :size="14" />
            </button>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <Calendar :size="32" class="empty-icon" />
        <p>No external calendars added yet</p>
      </div>

      <div class="add-calendar-form">
        <h4 class="form-title">
          <Plus :size="14" />
          Add Calendar
        </h4>

        <div class="cal-form-field">
          <label class="cal-field-label">Name</label>
          <input
            v-model="newCalName"
            type="text"
            class="cal-field-input"
            placeholder="e.g. Work Calendar"
          >
        </div>

        <div class="cal-form-field">
          <label class="cal-field-label">iCal URL</label>
          <input
            v-model="newCalUrl"
            type="url"
            class="cal-field-input"
            placeholder="https://calendar.google.com/calendar/ical/..."
          >
        </div>

        <div class="cal-form-field">
          <label class="cal-field-label">Color</label>
          <div class="color-picker-row">
            <button
              v-for="preset in colorPresets"
              :key="preset.value"
              class="color-preset"
              :class="{ active: newCalColor === preset.value }"
              :style="{ backgroundColor: preset.value }"
              :title="preset.label"
              @click="newCalColor = preset.value"
            />
            <input
              v-model="newCalColor"
              type="color"
              class="color-input"
              title="Custom color"
            >
          </div>
        </div>

        <div v-if="addError" class="cal-form-error">
          <AlertCircle :size="14" />
          {{ addError }}
        </div>

        <button class="add-btn" @click="addCalendar">
          <Plus :size="14" />
          Add Calendar
        </button>
      </div>
    </SettingsSection>

    <SettingsSection title="Sync Settings">
      <div class="cal-form-field">
        <label class="cal-field-label">Auto-sync interval</label>
        <div class="interval-picker">
          <button
            v-for="opt in [{ label: 'Manual', value: 0 }, { label: '15 min', value: 15 }, { label: '30 min', value: 30 }, { label: '1 hour', value: 60 }]"
            :key="opt.value"
            class="interval-btn"
            :class="{ active: syncInterval === opt.value }"
            @click="updateSyncInterval(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <p class="section-note">
        <RefreshCw :size="12" />
        You can also sync manually using the sync button in the calendar header.
      </p>
    </SettingsSection>
  </div>
</template>

<style scoped>
.account-settings-tab {
  display: flex;
  flex-direction: column;
}

.account-info {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--glass-bg-soft);
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border);
}

.user-details {
  min-width: 0;
  overflow: hidden;
}

.user-email {
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-status {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  white-space: nowrap;
  background: var(--color-danger-bg-light);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: var(--color-danger);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal);
}

.logout-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  transform: translateY(-1px);
}

.status-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-3);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

.setting-description {
  font-size: var(--text-xs);
  color: var(--text-muted);
  line-height: 1.4;
}

.account-actions {
  display: flex;
  flex-shrink: 0;
  gap: var(--space-2);
}

.change-password-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  white-space: nowrap;
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal);
}

.change-password-btn:hover {
  background: var(--glass-bg-strong);
  color: var(--text-primary);
}

.change-password-form {
  margin-top: var(--space-4);
  padding: var(--space-4);
  background: var(--glass-bg-soft);
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.form-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  padding-right: var(--space-10);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.toggle-visibility {
  position: absolute;
  right: var(--space-2);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-1);
}

.toggle-visibility:hover {
  color: var(--text-primary);
}

.password-error {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-danger);
  font-size: var(--text-sm);
}

.password-success {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-success);
  font-size: var(--text-sm);
}

.save-password-btn {
  background: var(--color-primary);
  border: none;
  color: white;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal);
}

.save-password-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
}

.save-password-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* TASK-337: Loading state styles */
.loading-state {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4);
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* ── About Section ── */
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

.auto-update-toggle {
  padding-top: var(--space-3);
  border-top: 1px solid var(--glass-border);
}

.links-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
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

/* ── Integrations Section ── */
.section-description {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin: 0 0 var(--space-4);
  line-height: 1.5;
}

.help-details {
  margin-bottom: var(--space-4);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.help-summary {
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  cursor: pointer;
  background: var(--glass-bg-soft);
}

.help-summary:hover {
  color: var(--text-primary);
}

.help-steps {
  padding: var(--space-3) var(--space-6);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.8;
  margin: 0;
}

.help-steps strong {
  color: var(--text-primary);
}

.calendar-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.calendar-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
}

.calendar-item-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.calendar-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-0_5);
  min-width: 0;
}

.calendar-name {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.calendar-meta {
  font-size: var(--text-xs);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.error-icon {
  color: var(--color-danger);
}

.success-icon {
  color: var(--color-success);
}

.calendar-item-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.icon-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

.icon-btn.danger:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: var(--color-danger);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-6);
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.empty-icon {
  opacity: 0.3;
}

.add-calendar-form {
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  background: var(--glass-bg-tint);
}

.form-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-3);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.cal-form-field {
  margin-bottom: var(--space-3);
}

.cal-field-label {
  display: block;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  margin-bottom: var(--space-1);
}

.cal-field-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  outline: none;
  transition: border-color var(--duration-fast);
}

.cal-field-input:focus {
  border-color: var(--accent-primary);
}

.cal-field-input::placeholder {
  color: var(--text-muted);
}

.color-picker-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.color-preset {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.color-preset:hover {
  transform: scale(1.15);
}

.color-preset.active {
  border-color: var(--text-primary);
  box-shadow: 0 0 0 2px var(--glass-bg-soft);
}

.color-input {
  width: 28px;
  height: 28px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  background: transparent;
  padding: 0;
}

.cal-form-error {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-danger);
  margin-bottom: var(--space-3);
}

.add-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--accent-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.add-btn:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.interval-picker {
  display: flex;
  gap: var(--space-1);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-1);
}

.interval-btn {
  padding: var(--space-1_5) var(--space-3);
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.interval-btn:hover {
  color: var(--text-primary);
  background: var(--glass-bg-medium);
}

.interval-btn.active {
  background: var(--state-active-bg);
  color: var(--text-primary);
}

.section-note {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin-top: var(--space-3);
}
</style>
