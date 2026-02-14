<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plus, Trash2, RefreshCw, Calendar, AlertCircle, Check } from 'lucide-vue-next'
import { useSettingsStore, type ExternalCalendarConfig } from '@/stores/settings'
import SettingsSection from '../SettingsSection.vue'
import SettingsToggle from '../SettingsToggle.vue'

const settingsStore = useSettingsStore()

// Form state for adding a new calendar
const newCalName = ref('')
const newCalUrl = ref('')
const newCalColor = ref('#6366f1') // indigo default
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

  // Basic URL validation
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

  // Reset form
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
</script>

<template>
  <div class="integrations-tab">
    <SettingsSection title="External Calendars">
      <p class="section-description">
        Add iCal/ICS calendar feeds to show external events as read-only overlays in your calendar views.
        Works with Google Calendar, Outlook, Apple Calendar, and any iCal-compatible service.
      </p>

      <!-- How to get iCal URL -->
      <details class="help-details">
        <summary class="help-summary">How to get your Google Calendar iCal URL</summary>
        <ol class="help-steps">
          <li>Open <strong>Google Calendar</strong> in your browser</li>
          <li>Click the <strong>gear icon</strong> → <strong>Settings</strong></li>
          <li>Under "Settings for my calendars", click the calendar you want</li>
          <li>Scroll to <strong>"Integrate calendar"</strong></li>
          <li>Copy the <strong>"Secret address in iCal format"</strong> URL</li>
        </ol>
      </details>

      <!-- Existing Calendars -->
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

      <!-- Add Calendar Form -->
      <div class="add-calendar-form">
        <h4 class="form-title">
          <Plus :size="14" />
          Add Calendar
        </h4>

        <div class="form-field">
          <label class="field-label">Name</label>
          <input
            v-model="newCalName"
            type="text"
            class="field-input"
            placeholder="e.g. Work Calendar"
          />
        </div>

        <div class="form-field">
          <label class="field-label">iCal URL</label>
          <input
            v-model="newCalUrl"
            type="url"
            class="field-input"
            placeholder="https://calendar.google.com/calendar/ical/..."
          />
        </div>

        <div class="form-field">
          <label class="field-label">Color</label>
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
            />
          </div>
        </div>

        <div v-if="addError" class="form-error">
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
      <div class="form-field">
        <label class="field-label">Auto-sync interval</label>
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
.integrations-tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

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

/* Calendar List */
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

/* Empty State */
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

/* Add Form */
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

.form-field {
  margin-bottom: var(--space-3);
}

.field-label {
  display: block;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  margin-bottom: var(--space-1);
}

.field-input {
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

.field-input:focus {
  border-color: var(--accent-primary);
}

.field-input::placeholder {
  color: var(--text-muted);
}

/* Color Picker */
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

/* Error */
.form-error {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-danger);
  margin-bottom: var(--space-3);
}

/* Add Button */
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

/* Sync Settings */
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
