<template>
  <div class="cyber-dashboard-hub">
    <div class="cdh-grid">
      <!-- Card 1: CHARACTER -->
      <CyberSummaryCard
        title="CHARACTER"
        :accent-color="'var(--cf-cyan)'"
        clickable
        @click="emit('openCharacter')"
      >
        <div class="cdh-character">
          <img
            :src="avatarUrl"
            alt="Character Avatar"
            class="cdh-character-avatar"
          />
          <div class="cdh-character-info">
            <div class="cdh-character-level">
              LEVEL {{ currentLevel }}
            </div>
            <div class="cdh-character-xp-bar">
              <div
                class="cdh-character-xp-fill"
                :style="{ width: `${levelInfo.progressPercent}%` }"
              />
            </div>
            <div class="cdh-character-xp-text">
              {{ levelInfo.currentXp }} / {{ levelInfo.xpForNextLevel }} XP
            </div>
            <div class="cdh-character-streak">
              <span class="cdh-streak-icon">🔥</span>
              {{ streakInfo.currentStreak }} day streak
            </div>
            <div class="cdh-character-class">
              NETRUNNER
            </div>
          </div>
        </div>
      </CyberSummaryCard>

      <!-- Card 2: MISSIONS -->
      <CyberSummaryCard
        title="DAILY BRIEFING"
        :accent-color="'var(--cf-cyan)'"
        clickable
        @click="emit('navigate', 'missions')"
      >
        <div class="cdh-missions">
          <div class="cdh-missions-completion">
            {{ completedTodayCount }}/3 CLEARED
          </div>
          <div class="cdh-missions-progress-bar">
            <div
              class="cdh-missions-progress-fill"
              :style="{ width: `${missionCompletionPercent}%` }"
            />
          </div>
          <div class="cdh-missions-expiry">
            {{ missionsStatus }}
          </div>
        </div>
      </CyberSummaryCard>

      <!-- Card 3: BOSS THREAT -->
      <CyberSummaryCard
        title="BOSS THREAT"
        :accent-color="'var(--cf-magenta)'"
        clickable
        @click="emit('navigate', 'boss')"
      >
        <div class="cdh-boss">
          <template v-if="activeBoss">
            <div class="cdh-boss-name">
              {{ activeBoss.title }}
            </div>
            <div class="cdh-boss-hp-bar">
              <div
                class="cdh-boss-hp-fill"
                :class="bossHpColorClass"
                :style="{ width: `${bossHpPercent}%` }"
              />
            </div>
            <div class="cdh-boss-hp-text">
              {{ bossHpPercent }}% HP
            </div>
            <div class="cdh-boss-phase">
              {{ activeBoss.difficulty.toUpperCase() }}
            </div>
            <div class="cdh-boss-time">
              {{ bossTimeLeft }}
            </div>
          </template>
          <template v-else>
            <div class="cdh-boss-empty-title">
              NO ACTIVE THREAT
            </div>
            <div class="cdh-boss-empty-subtitle">
              SYSTEMS NOMINAL
            </div>
          </template>
        </div>
      </CyberSummaryCard>

      <!-- Card 4: UPGRADES -->
      <CyberSummaryCard
        title="UPGRADES"
        :accent-color="'var(--cf-gold)'"
        clickable
        @click="emit('navigate', 'upgrades')"
      >
        <div class="cdh-upgrades">
          <div class="cdh-upgrades-achievements">
            {{ unlockedAchievementsCount }}/{{ totalAchievementsCount }} trophies
          </div>
          <div class="cdh-upgrades-credits">
            {{ availableXp }} XP
          </div>
          <div class="cdh-upgrades-featured">
            {{ featuredItemText }}
          </div>
        </div>
      </CyberSummaryCard>
    </div>

    <!-- System Status Footer (Compact Single Line) -->
    <div class="cdh-system-status">
      <div class="cdh-aria-message">
        <span class="cdh-aria-label">ARIA:</span>
        <span class="cdh-aria-text">{{ ariaGreeting }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useGamificationStore } from '@/stores/gamification'
import { useChallengesStore } from '@/stores/challenges'
import { useAuthStore } from '@/stores/auth'
import CyberSummaryCard from './CyberSummaryCard.vue'
import { EXTERNAL_URLS } from '@/config/urls'

const emit = defineEmits<{
  navigate: [section: 'missions' | 'boss' | 'upgrades' | 'achievements']
  openCharacter: []
}>()

const gamificationStore = useGamificationStore()
const challengesStore = useChallengesStore()
const authStore = useAuthStore()

const {
  currentLevel,
  levelInfo,
  streakInfo,
  availableXp,
  achievements,
  earnedAchievements,
  shopItemsWithOwnership
} = storeToRefs(gamificationStore)

const { activeDailies, activeBoss, completedTodayCount: storeCompletedToday } = storeToRefs(challengesStore)

// Avatar URL from email seed
const avatarUrl = computed(() => {
  const email = authStore.user?.email || 'default'
  return `${EXTERNAL_URLS.DICEBEAR_API}?seed=${encodeURIComponent(email)}`
})

// Missions card data — use the store's computed directly
const completedTodayCount = storeCompletedToday

const missionCompletionPercent = computed(() => {
  // Daily target is always 3
  return Math.min(100, (completedTodayCount.value / 3) * 100)
})

const missionsStatus = computed(() => {
  const incomplete = activeDailies.value.filter(d => d.status === 'active')

  if (completedTodayCount.value === 3) {
    return 'ALL CLEAR'
  }

  if (incomplete.length === 0) {
    return 'NO ACTIVE MISSIONS'
  }

  // Find earliest expiry
  const earliestExpiry = incomplete.reduce((earliest, mission) => {
    if (!mission.expiresAt) return earliest
    const expiryTime = new Date(mission.expiresAt).getTime()
    return !earliest || expiryTime < earliest ? expiryTime : earliest
  }, 0 as number)

  if (!earliestExpiry) return 'In progress'

  const now = Date.now()
  const timeLeft = earliestExpiry - now
  const hours = Math.floor(timeLeft / (1000 * 60 * 60))
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60))

  return `Next expires: ${hours}h ${minutes}m`
})

// Boss card data
const bossHpPercent = computed(() => {
  if (!activeBoss.value) return 0
  const total = activeBoss.value.objectiveTarget
  const current = total - activeBoss.value.objectiveCurrent
  return total > 0 ? Math.round((current / total) * 100) : 0
})

const bossHpColorClass = computed(() => {
  const percent = bossHpPercent.value
  if (percent > 50) return 'hp-high'
  if (percent > 25) return 'hp-medium'
  return 'hp-low'
})

const bossTimeLeft = computed(() => {
  if (!activeBoss.value?.expiresAt) return ''

  const now = Date.now()
  const expiry = new Date(activeBoss.value.expiresAt).getTime()
  const timeLeft = expiry - now

  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24))
  const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  return `${days}d ${hours}h left`
})

// Upgrades card data
const unlockedAchievementsCount = computed(() => earnedAchievements.value.length)
const totalAchievementsCount = computed(() => achievements.value.length)

const featuredItemText = computed(() => {
  const unowned = shopItemsWithOwnership.value.filter(item => !item.isOwned)
  if (unowned.length === 0) return 'All items owned'

  const featured = unowned[0]
  return `${featured.name} - ${featured.priceXp} XP`
})

// ARIA greeting (same logic as CyberMissionBriefing)
const ariaGreeting = computed(() => {
  const completedCount = completedTodayCount.value
  const hasActiveBoss = !!activeBoss.value

  if (completedCount === 3 && !hasActiveBoss) {
    return 'All systems optimal. Standing by for new directives.'
  }

  if (hasActiveBoss) {
    return `Boss threat detected. Mission completion: ${completedCount}/3.`
  }

  if (completedCount === 0) {
    return 'Daily briefing ready. Mission protocol active.'
  }

  return `${completedCount} mission${completedCount > 1 ? 's' : ''} cleared. Proceed with remaining objectives.`
})

const ariaVariant = computed<'info' | 'warning' | 'success' | 'danger'>(() => {
  if (activeBoss.value && bossHpPercent.value < 30) return 'warning'
  if (completedTodayCount.value === 3) return 'success'
  return 'info'
})
</script>

<style scoped>
.cyber-dashboard-hub {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Grid Layout */
.cdh-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
}

/* CHARACTER Card */
.cdh-character {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.cdh-character-avatar {
  width: var(--space-12);
  height: var(--space-12);
  border-radius: var(--radius-md);
  border: 2px solid var(--cf-cyan);
  flex-shrink: 0;
}

.cdh-character-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.cdh-character-level {
  font-family: var(--font-cyber-title);
  font-size: var(--text-lg);
  color: var(--cf-cyan);
  font-weight: 700;
  line-height: 1;
}

.cdh-character-xp-bar {
  height: var(--space-1_5);
  background: var(--cf-dark-2);
  border-radius: var(--radius-full);
  overflow: hidden;
  position: relative;
}

.cdh-character-xp-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--cf-cyan), var(--cf-magenta));
  transition: width 0.3s ease;
}

.cdh-character-xp-text {
  font-size: var(--text-2xs);
  color: var(--text-muted);
  font-family: var(--font-cyber-data);
}

.cdh-character-streak {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-family: var(--font-cyber-ui);
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.cdh-streak-icon {
  font-size: var(--text-sm);
  color: var(--cf-orange);
}

.cdh-character-class {
  font-size: var(--text-2xs);
  color: var(--cf-magenta);
  font-family: var(--font-cyber-title);
  font-weight: 700;
  padding: var(--space-0_5) var(--space-2);
  background: var(--cf-dark-2);
  border: 1px solid var(--cf-magenta);
  border-radius: var(--radius-sm);
  width: fit-content;
}

/* MISSIONS Card */
.cdh-missions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.cdh-missions-completion {
  font-family: var(--font-cyber-title);
  font-size: var(--text-lg);
  color: var(--cf-cyan);
  font-weight: 700;
}

.cdh-missions-progress-bar {
  height: var(--space-2);
  background: var(--cf-dark-2);
  border-radius: var(--radius-full);
  overflow: hidden;
  position: relative;
}

.cdh-missions-progress-fill {
  height: 100%;
  background: var(--cf-cyan);
  transition: width 0.3s ease;
}

.cdh-missions-expiry {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-family: var(--font-cyber-data);
}

/* BOSS Card */
.cdh-boss {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.cdh-boss-name {
  font-family: var(--font-cyber-title);
  font-size: var(--text-xs);
  color: var(--cf-magenta);
  font-weight: 700;
  text-transform: uppercase;
}

.cdh-boss-hp-bar {
  height: var(--space-2);
  background: var(--cf-dark-2);
  border-radius: var(--radius-full);
  overflow: hidden;
  position: relative;
}

.cdh-boss-hp-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.cdh-boss-hp-fill.hp-high {
  background: var(--color-success);
}

.cdh-boss-hp-fill.hp-medium {
  background: var(--cf-orange);
}

.cdh-boss-hp-fill.hp-low {
  background: var(--color-danger);
}

.cdh-boss-hp-text {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-family: var(--font-cyber-data);
}

.cdh-boss-phase {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-family: var(--font-cyber-ui);
}

.cdh-boss-time {
  font-size: var(--text-xs);
  color: var(--cf-magenta);
  font-family: var(--font-cyber-data);
  font-weight: 600;
}

.cdh-boss-empty-title {
  font-family: var(--font-cyber-title);
  font-size: var(--text-base);
  color: var(--text-muted);
  font-weight: 700;
}

.cdh-boss-empty-subtitle {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-family: var(--font-cyber-data);
}

/* UPGRADES Card */
.cdh-upgrades {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.cdh-upgrades-achievements {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-family: var(--font-cyber-data);
}

.cdh-upgrades-credits {
  font-family: var(--font-cyber-title);
  font-size: var(--text-lg);
  color: var(--cf-lime);
  font-weight: 700;
}

.cdh-upgrades-featured {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-family: var(--font-cyber-ui);
}

/* System Status Footer (Compact Single Line) */
.cdh-system-status {
  padding: var(--space-3) var(--space-4);
  background: var(--cf-dark-3);
  border-top: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.cdh-aria-message {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.cdh-aria-label {
  font-family: var(--font-cyber-title);
  font-size: var(--text-xs);
  color: var(--cf-cyan);
  font-weight: 700;
}

.cdh-aria-text {
  font-family: var(--font-cyber-data);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

/* Responsive: stack grid on mobile */
@media (max-width: 768px) {
  .cdh-grid {
    grid-template-columns: 1fr;
  }

  .cdh-character-avatar {
    width: var(--space-10);
    height: var(--space-10);
  }

  .cdh-aria-message {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
  }
}
</style>
