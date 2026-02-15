<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useWorkProfile } from '@/composables/useWorkProfile'
import { useSettingsStore } from '@/stores/settings'
import SettingsSection from '../SettingsSection.vue'
import SettingsToggle from '../SettingsToggle.vue'
import { RefreshCw, Trash2 } from 'lucide-vue-next'

const settingsStore = useSettingsStore()
const { profile, loadProfile, savePreferences, computeCapacityMetrics, resetLearnedData, addMemoryObservation } = useWorkProfile()

const isSaving = ref(false)
const isRecalculating = ref(false)
const isResetting = ref(false)
const saveMessage = ref('')
const isClearingMemories = ref(false)

// Local editable form state
const form = ref({
  workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as string[],
  daysOff: [] as string[],
  heavyMeetingDays: [] as string[],
  maxTasksPerDay: 6,
  preferredWorkStyle: 'balanced' as 'frontload' | 'balanced' | 'backload',
})

const dayOptions = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
]

const workStyleOptions = [
  { key: 'frontload' as const, label: 'Front-load', desc: 'Heavy Mon-Tue, lighter Thu-Fri' },
  { key: 'balanced' as const, label: 'Balanced', desc: 'Even distribution across days' },
  { key: 'backload' as const, label: 'Back-load', desc: 'Lighter Mon-Tue, heavier Thu-Fri' },
]

onMounted(async () => {
  const p = await loadProfile()
  if (p) {
    form.value.workDays = [...p.workDays]
    form.value.daysOff = [...p.daysOff]
    form.value.heavyMeetingDays = [...p.heavyMeetingDays]
    form.value.maxTasksPerDay = p.maxTasksPerDay
    form.value.preferredWorkStyle = p.preferredWorkStyle
  }
})

function toggleDay(list: string[], key: string) {
  const idx = list.indexOf(key)
  if (idx === -1) list.push(key)
  else list.splice(idx, 1)
}

async function onSave() {
  isSaving.value = true
  saveMessage.value = ''
  try {
    await savePreferences({
      workDays: [...form.value.workDays],
      daysOff: [...form.value.daysOff],
      heavyMeetingDays: [...form.value.heavyMeetingDays],
      maxTasksPerDay: form.value.maxTasksPerDay,
      preferredWorkStyle: form.value.preferredWorkStyle,
    })
    saveMessage.value = 'Preferences saved!'
    setTimeout(() => { saveMessage.value = '' }, 3000)
  } catch (err) {
    saveMessage.value = 'Failed to save'
  } finally {
    isSaving.value = false
  }
}

async function onRecalculate() {
  isRecalculating.value = true
  try {
    await computeCapacityMetrics()
  } finally {
    isRecalculating.value = false
  }
}

async function onReset() {
  if (!confirm('Reset all learned patterns? This cannot be undone.')) return
  isResetting.value = true
  try {
    await resetLearnedData()
  } finally {
    isResetting.value = false
  }
}

async function onClearMemories() {
  if (!confirm('Clear all memory observations? The AI will need to re-learn patterns.')) return
  isClearingMemories.value = true
  try {
    // Save empty memoryGraph
    await savePreferences({ memoryGraph: [] } as any)
  } finally {
    isClearingMemories.value = false
  }
}
</script>

<template>
  <div class="weekly-plan-settings-tab">
    <SettingsSection title="AI Learning">
      <SettingsToggle
        label="Enable AI work profile learning"
        :value="settingsStore.aiLearningEnabled"
        @update="(v: boolean) => settingsStore.updateSetting('aiLearningEnabled', v)"
      />
      <p class="learning-hint">
        When enabled, FlowState tracks your work patterns to make weekly plans smarter over time.
      </p>
    </SettingsSection>

    <SettingsSection title="Planning Preferences">
      <div class="setting-row">
        <label class="setting-label">Work days</label>
        <div class="day-chips">
          <button
            v-for="d in dayOptions"
            :key="d.key"
            class="day-chip"
            :class="{ active: form.workDays.includes(d.key) }"
            @click="toggleDay(form.workDays, d.key)"
          >
            {{ d.label }}
          </button>
        </div>
      </div>

      <div class="setting-row">
        <label class="setting-label">Days off</label>
        <div class="day-chips">
          <button
            v-for="d in dayOptions"
            :key="d.key"
            class="day-chip off"
            :class="{ active: form.daysOff.includes(d.key) }"
            @click="toggleDay(form.daysOff, d.key)"
          >
            {{ d.label }}
          </button>
        </div>
      </div>

      <div class="setting-row">
        <label class="setting-label">Heavy meeting days</label>
        <div class="day-chips">
          <button
            v-for="d in dayOptions"
            :key="d.key"
            class="day-chip meeting"
            :class="{ active: form.heavyMeetingDays.includes(d.key) }"
            @click="toggleDay(form.heavyMeetingDays, d.key)"
          >
            {{ d.label }}
          </button>
        </div>
      </div>

      <div class="setting-row">
        <label class="setting-label">Max tasks per day</label>
        <div class="number-chips">
          <button
            v-for="n in [3, 5, 6, 8, 10]"
            :key="n"
            class="number-chip"
            :class="{ active: form.maxTasksPerDay === n }"
            @click="form.maxTasksPerDay = n"
          >
            {{ n }}
          </button>
        </div>
      </div>

      <div class="setting-row">
        <label class="setting-label">Work style</label>
        <div class="style-chips">
          <button
            v-for="ws in workStyleOptions"
            :key="ws.key"
            class="style-chip"
            :class="{ active: form.preferredWorkStyle === ws.key }"
            @click="form.preferredWorkStyle = ws.key"
          >
            <span class="style-label">{{ ws.label }}</span>
            <span class="style-desc">{{ ws.desc }}</span>
          </button>
        </div>
      </div>

      <div class="save-row">
        <button class="save-btn" :disabled="isSaving" @click="onSave">
          {{ isSaving ? 'Saving...' : 'Save Preferences' }}
        </button>
        <span v-if="saveMessage" class="save-message">{{ saveMessage }}</span>
      </div>
    </SettingsSection>

    <SettingsSection title="Learned Patterns">
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-value">
            {{ profile?.avgWorkMinutesPerDay ? Math.round(profile.avgWorkMinutesPerDay) + ' min' : '—' }}
          </div>
          <div class="metric-label">
            Avg work/day
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-value">
            {{ profile?.avgTasksCompletedPerDay ? profile.avgTasksCompletedPerDay.toFixed(1) : '—' }}
          </div>
          <div class="metric-label">
            Avg tasks/day
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-value">
            {{ profile?.avgPlanAccuracy ? profile.avgPlanAccuracy.toFixed(0) + '%' : '—' }}
          </div>
          <div class="metric-label">
            Plan accuracy
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-value">
            {{ profile?.peakProductivityDays?.length ? profile.peakProductivityDays.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ') : '—' }}
          </div>
          <div class="metric-label">
            Peak days
          </div>
        </div>
      </div>

      <div class="action-row">
        <button class="action-btn" :disabled="isRecalculating" @click="onRecalculate">
          <RefreshCw :size="14" :class="{ spinning: isRecalculating }" />
          {{ isRecalculating ? 'Recalculating...' : 'Recalculate' }}
        </button>
        <button class="action-btn danger" :disabled="isResetting" @click="onReset">
          <Trash2 :size="14" />
          {{ isResetting ? 'Resetting...' : 'Reset Profile' }}
        </button>
      </div>
    </SettingsSection>

    <SettingsSection title="Memory Observations">
      <p class="obs-hint">
        {{ profile?.memoryGraph?.length || 0 }} observations from your work patterns
      </p>

      <div v-if="profile?.memoryGraph?.length" class="obs-list">
        <div
          v-for="(obs, idx) in profile.memoryGraph"
          :key="idx"
          class="obs-card"
        >
          <div class="obs-header">
            <span class="obs-entity">{{ obs.entity }}</span>
            <span class="obs-relation">{{ obs.relation }}</span>
          </div>
          <div class="obs-value">
            {{ obs.value }}
          </div>
          <div class="obs-meta">
            <div class="confidence-bar">
              <div class="confidence-fill" :style="{ width: (obs.confidence * 100) + '%' }" />
            </div>
            <span class="obs-confidence">{{ (obs.confidence * 100).toFixed(0) }}%</span>
            <span class="obs-source">{{ obs.source }}</span>
          </div>
        </div>
      </div>
      <p v-else class="obs-empty">
        No observations yet. They'll appear as FlowState learns your patterns.
      </p>

      <div v-if="profile?.memoryGraph?.length" class="action-row">
        <button class="action-btn danger" :disabled="isClearingMemories" @click="onClearMemories">
          <Trash2 :size="14" />
          {{ isClearingMemories ? 'Clearing...' : 'Clear Memories' }}
        </button>
      </div>
    </SettingsSection>
  </div>
</template>

<style scoped>
.weekly-plan-settings-tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.setting-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) 0;
}

.setting-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.day-chips,
.number-chips {
  display: flex;
  gap: var(--space-1_5);
  flex-wrap: wrap;
}

.day-chip,
.number-chip {
  padding: var(--space-1_5) var(--space-3);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-soft);
  backdrop-filter: blur(8px);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.day-chip:hover,
.number-chip:hover {
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.day-chip.active {
  background: rgba(78, 205, 196, 0.12);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.day-chip.off.active {
  background: rgba(239, 68, 68, 0.12);
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.day-chip.meeting.active {
  background: rgba(245, 158, 11, 0.12);
  border-color: var(--color-warning);
  color: var(--color-warning);
}

.number-chip {
  width: 40px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.number-chip.active {
  background: rgba(78, 205, 196, 0.12);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.style-chips {
  display: flex;
  gap: var(--space-2);
}

.style-chip {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-0_5);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-soft);
  backdrop-filter: blur(8px);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.style-chip:hover {
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.style-chip.active {
  background: rgba(78, 205, 196, 0.12);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.style-label {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
}

.style-desc {
  font-size: var(--text-xs);
  opacity: 0.7;
}

.save-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding-top: var(--space-3);
}

.save-btn {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  background: var(--glass-bg-soft);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-lg);
  color: var(--brand-primary);
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: all var(--duration-fast);
}

.save-btn:hover:not(:disabled) {
  background: rgba(78, 205, 196, 0.08);
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.save-message {
  font-size: var(--text-sm);
  color: var(--brand-primary);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
}

.metric-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
}

.metric-value {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--text-primary);
}

.metric-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.action-row {
  display: flex;
  gap: var(--space-3);
  padding-top: var(--space-2);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-1_5) var(--space-3);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.action-btn:hover:not(:disabled) {
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.action-btn.danger:hover:not(:disabled) {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.learning-hint {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: 0;
  line-height: var(--leading-relaxed);
}

.obs-hint {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: 0 0 var(--space-3) 0;
}

.obs-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.obs-card {
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
}

.obs-header {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin-bottom: var(--space-1);
}

.obs-entity {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--brand-primary);
  background: rgba(78, 205, 196, 0.08);
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-xs);
}

.obs-relation {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.obs-value {
  font-size: var(--text-sm);
  color: var(--text-primary);
  margin-bottom: var(--space-1_5);
}

.obs-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.confidence-bar {
  flex: 1;
  max-width: 80px;
  height: 4px;
  background: var(--glass-bg);
  border-radius: 2px;
  overflow: hidden;
}

.confidence-fill {
  height: 100%;
  background: var(--brand-primary);
  border-radius: 2px;
  transition: width var(--duration-normal);
}

.obs-confidence {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  min-width: 32px;
}

.obs-source {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.obs-empty {
  font-size: var(--text-sm);
  color: var(--text-muted);
  font-style: italic;
  margin: 0;
}
</style>
