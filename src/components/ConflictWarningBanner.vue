<template>
  <div v-if="showBanner" class="conflict-warning-banner">
    <div class="banner-icon">
      <AlertTriangle :size="20" />
    </div>
    <div class="banner-content">
      <span class="banner-title">Data Conflicts Detected</span>
      <span class="banner-message">
        {{ conflictCount }} document{{ conflictCount === 1 ? '' : 's' }}
        {{ conflictCount === 1 ? 'has' : 'have' }} conflicting versions.
        Manual resolution required.
      </span>
    </div>
    <div class="banner-actions">
      <button class="banner-btn" @click="dismissBanner" title="Dismiss for this session">
        Dismiss
      </button>
      <!-- Future: Link to ConflictResolutionDialog when ready -->
      <!-- <button class="banner-btn primary" @click="openResolution">
        Resolve
      </button> -->
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ConflictWarningBanner - Data Safety Feature
 *
 * Shows when PouchDB conflicts are detected during data load.
 * READ-ONLY: Does not auto-resolve conflicts - user must manually resolve.
 *
 * @safety This component only displays warnings. It does NOT modify data.
 */

import { ref, computed } from 'vue'
import { AlertTriangle } from 'lucide-vue-next'
import { useDatabase, type DetectedConflict } from '@/composables/useDatabase'

// Props for external control
interface Props {
  conflicts?: DetectedConflict[]
}

const props = withDefaults(defineProps<Props>(), {
  conflicts: () => []
})

// Internal state
const isDismissed = ref(false)
const database = useDatabase()

// Computed values
const allConflicts = computed(() => {
  // Use props if provided, otherwise use database state
  return props.conflicts.length > 0
    ? props.conflicts
    : database.detectedConflicts.value
})

const conflictCount = computed(() => allConflicts.value.length)

const showBanner = computed(() => {
  return conflictCount.value > 0 && !isDismissed.value
})

// Actions
const dismissBanner = () => {
  isDismissed.value = true
  console.log('[ConflictWarningBanner] Banner dismissed by user')
}

// Future: Open conflict resolution dialog
// const openResolution = () => {
//   console.log('[ConflictWarningBanner] Opening conflict resolution...')
//   // Emit event or navigate to resolution UI
// }
</script>

<style scoped>
.conflict-warning-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(255, 193, 7, 0.15), rgba(255, 152, 0, 0.1));
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: 8px;
  margin: 8px 16px;
  color: var(--text-primary, #fff);
}

.banner-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffc107;
  flex-shrink: 0;
}

.banner-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.banner-title {
  font-weight: 600;
  font-size: 14px;
  color: #ffc107;
}

.banner-message {
  font-size: 12px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
}

.banner-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.banner-btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary, #fff);
}

.banner-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.banner-btn.primary {
  background: rgba(255, 193, 7, 0.3);
  border-color: rgba(255, 193, 7, 0.5);
  color: #ffc107;
}

.banner-btn.primary:hover {
  background: rgba(255, 193, 7, 0.4);
}
</style>
