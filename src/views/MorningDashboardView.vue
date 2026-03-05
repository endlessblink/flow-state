<script setup lang="ts">
import MorningGreeting from '@/components/morning-dashboard/MorningGreeting.vue'
import MorningScore from '@/components/morning-dashboard/MorningScore.vue'
import BigThreeCard from '@/components/morning-dashboard/BigThreeCard.vue'
import MorningMissions from '@/components/morning-dashboard/MorningMissions.vue'
import MorningNews from '@/components/morning-dashboard/MorningNews.vue'
import MorningQuickCapture from '@/components/morning-dashboard/MorningQuickCapture.vue'
</script>

<template>
  <div class="morning-dashboard">
    <div class="morning-greeting bento-cell bento-cell--1">
      <MorningGreeting />
    </div>
    <div class="morning-score bento-cell bento-cell--2">
      <MorningScore />
    </div>
    <div class="morning-big3 bento-cell bento-cell--3">
      <BigThreeCard />
    </div>
    <div class="morning-missions bento-cell bento-cell--4">
      <MorningMissions />
    </div>
    <div class="morning-news bento-cell bento-cell--5">
      <MorningNews />
    </div>
    <div class="morning-capture bento-cell bento-cell--6">
      <MorningQuickCapture />
    </div>
  </div>
</template>

<style scoped>
.morning-dashboard {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto auto auto auto;
  gap: var(--space-4);
  padding: var(--space-6);
  max-width: 900px;
  margin: 0 auto;
  min-height: 100vh;
  align-content: start;
  overflow-y: auto;
}

.morning-greeting { grid-column: 1; }
.morning-score { grid-column: 2; }
.morning-big3 { grid-column: 1 / -1; }
.morning-missions { grid-column: 1; }
.morning-news { grid-column: 2; }
.morning-capture { grid-column: 1 / -1; }

/* Stagger fade-in animation */
.bento-cell {
  opacity: 0;
  animation: bento-fade-in 0.4s ease forwards;
}

.bento-cell--1 { animation-delay: 0ms; }
.bento-cell--2 { animation-delay: 50ms; }
.bento-cell--3 { animation-delay: 100ms; }
.bento-cell--4 { animation-delay: 150ms; }
.bento-cell--5 { animation-delay: 200ms; }
.bento-cell--6 { animation-delay: 250ms; }

@keyframes bento-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .bento-cell {
    opacity: 1;
    animation: none;
  }
}

@media (max-width: 1023px) {
  .morning-dashboard {
    grid-template-columns: 1fr;
    padding: var(--space-4);
  }

  .morning-greeting,
  .morning-score,
  .morning-big3,
  .morning-missions,
  .morning-news,
  .morning-capture {
    grid-column: 1;
  }
}
</style>
