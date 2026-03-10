<script setup lang="ts">
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { X } from 'lucide-vue-next'
import { useTaskStore } from '@/stores/tasks'
import { useMorningRitual } from '@/composables/useMorningRitual'
import MorningGreeting from '@/components/morning-dashboard/MorningGreeting.vue'
import MorningScore from '@/components/morning-dashboard/MorningScore.vue'
import BigThreeCard from '@/components/morning-dashboard/BigThreeCard.vue'
import MorningMissions from '@/components/morning-dashboard/MorningMissions.vue'
import MorningNews from '@/components/morning-dashboard/MorningNews.vue'
import MorningQuickCapture from '@/components/morning-dashboard/MorningQuickCapture.vue'
import MorningSummaryChip from '@/components/morning-dashboard/MorningSummaryChip.vue'

const router = useRouter()
const taskStore = useTaskStore()
const morningRitual = useMorningRitual()

// Clear filters on ANY exit from morning dashboard (dismiss, sidebar click, back button, etc.)
// This prevents smart view / duration filters from leaking into other views
onBeforeRouteLeave(() => {
  taskStore.setSmartView(null)
  taskStore.setActiveDurationFilter(null)
})

function dismiss() {
  router.push('/')
}
</script>

<template>
  <div class="morning-dashboard">
    <div class="morning-content">
      <div class="morning-header">
        <MorningGreeting />
        <MorningScore />
        <button class="morning-dismiss" @click="dismiss" aria-label="Close morning dashboard">
          <X :size="20" />
        </button>
      </div>

      <!-- Show summary chip when ritual is done -->
      <MorningSummaryChip
        :show="morningRitual.isRitualCompleted.value"
        :task-count="morningRitual.ritualSummary.value?.taskCount ?? 0"
        :total-minutes="morningRitual.ritualSummary.value?.totalMinutes ?? 0"
        style="align-self: flex-start;"
      />

      <BigThreeCard />

      <div class="morning-bottom">
        <MorningMissions />
        <MorningNews />
      </div>

      <MorningQuickCapture />
    </div>
  </div>
</template>

<style scoped>
.morning-dashboard {
  display: flex;
  justify-content: center;
  padding: var(--space-6);
  overflow-y: auto;
  height: 100%;
}

.morning-content {
  width: 100%;
  max-width: 1080px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-bottom: var(--space-6);
}

.morning-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.morning-dismiss {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  color: var(--text-muted);
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all var(--duration-normal) var(--ease-out);
  backdrop-filter: blur(8px);
}

.morning-dismiss:hover {
  background: rgba(255, 255, 255, 0.12);
  color: var(--text-primary);
}

.morning-bottom {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

@media (max-width: 768px) {
  .morning-dashboard {
    padding: var(--space-3);
  }

  .morning-header {
    flex-direction: column;
  }

  .morning-bottom {
    grid-template-columns: 1fr;
  }
}
</style>
