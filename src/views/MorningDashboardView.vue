<script setup lang="ts">
import { useRouter } from 'vue-router'
import { X } from 'lucide-vue-next'
import MorningGreeting from '@/components/morning-dashboard/MorningGreeting.vue'
import MorningScore from '@/components/morning-dashboard/MorningScore.vue'
import BigThreeCard from '@/components/morning-dashboard/BigThreeCard.vue'
import MorningMissions from '@/components/morning-dashboard/MorningMissions.vue'
import MorningNews from '@/components/morning-dashboard/MorningNews.vue'
import MorningQuickCapture from '@/components/morning-dashboard/MorningQuickCapture.vue'

const router = useRouter()

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
  max-width: 860px;
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
