<script setup lang="ts">
/**
 * BossFightPanel Component
 * FEATURE-1132: Weekly boss fight display with HP bar and timer
 */
import { computed, ref, onMounted } from 'vue'
import { useChallengesStore } from '@/stores/challenges'
import { createAIRouter } from '@/services/ai/router'
import type { ChatMessage } from '@/services/ai/types'
import { storeToRefs } from 'pinia'
import ARIAMessage from './ARIAMessage.vue'
import { Skull, Swords, Clock, Zap, Trophy, RefreshCw, Sparkles } from 'lucide-vue-next'

// Props
const props = defineProps<{
  compact?: boolean
}>()

// Store
const challengesStore = useChallengesStore()
const { activeBoss, isGenerating, lastWeeklyGeneration } = storeToRefs(challengesStore)

// AI Router for boss generation
let router: ReturnType<typeof createAIRouter> | null = null
const aiAvailable = ref(false)

// Initialize router and check availability
onMounted(async () => {
  try {
    router = createAIRouter({ debug: false })
    await router.initialize()
    const provider = await router.getActiveProvider()
    aiAvailable.value = !!provider
  } catch (e) {
    console.warn('[BossFight] AI router init failed:', e)
    aiAvailable.value = false
  }
})

// Chat wrapper for gamemaster
async function chatWithAI(messages: ChatMessage[], options?: { taskType?: string }): Promise<{ content: string }> {
  if (!router) {
    return { content: '' }
  }
  try {
    const response = await router.chat(messages, { taskType: options?.taskType as 'planning' })
    return { content: response.content }
  } catch (e) {
    console.warn('[BossFight] AI chat failed:', e)
    return { content: '' }
  }
}

// Local state
const generationError = ref<string | null>(null)

// Computed
const bossHp = computed(() => {
  if (!activeBoss.value) return { current: 0, max: 0, percent: 0 }

  const context = activeBoss.value.aiContext as { total_hp?: number } | undefined
  const maxHp = context?.total_hp ?? activeBoss.value.objectiveTarget * 10
  const damage = activeBoss.value.objectiveCurrent * 10
  const currentHp = Math.max(0, maxHp - damage)
  const percent = (currentHp / maxHp) * 100

  return { current: currentHp, max: maxHp, percent }
})

const damageDealt = computed(() => {
  if (!activeBoss.value) return 0
  return activeBoss.value.objectiveCurrent * 10
})

const timeRemaining = computed(() => {
  if (!activeBoss.value) return 'No active boss'

  const now = new Date()
  const expires = new Date(activeBoss.value.expiresAt)
  const diff = expires.getTime() - now.getTime()

  if (diff <= 0) return 'Time expired!'

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  return `${days}d ${hours}h remaining`
})

const hpBarColor = computed(() => {
  const percent = bossHp.value.percent
  if (percent > 66) return 'bg-red-500'
  if (percent > 33) return 'bg-orange-500'
  return 'bg-green-500'
})

const isDefeated = computed(() =>
  activeBoss.value?.status === 'completed' || bossHp.value.percent <= 0
)

const needsGeneration = computed(() => {
  if (activeBoss.value) return false

  // Only suggest generation on Monday or if explicitly requested
  const now = new Date()
  return now.getDay() === 1 // Monday
})

const ariaMessage = computed(() => {
  if (!activeBoss.value) {
    return needsGeneration.value
      ? 'Netrunner, a major threat has emerged in the Grid. Ready to engage?'
      : 'No active threats detected. Weekly boss spawns on Monday.'
  }

  if (isDefeated.value) {
    return 'Victory! The threat has been neutralized. The Grid thanks you.'
  }

  if (bossHp.value.percent < 25) {
    return 'Critical damage! The boss is weakened. Finish it!'
  }

  if (bossHp.value.percent < 50) {
    return 'Making progress. Keep the pressure on, netrunner.'
  }

  return `Engaging ${activeBoss.value.title}. Deal damage by completing tasks.`
})

// Actions
async function generateBoss() {
  generationError.value = null

  try {
    await challengesStore.generateWeeklyBossAction({
      aiAvailable: aiAvailable.value,
      chat: chatWithAI,
    })
  } catch (error) {
    generationError.value = error instanceof Error ? error.message : 'Failed to generate boss'
    console.error('[BossFight] Generation failed:', error)
  }
}
</script>

<template>
  <div class="boss-fight-panel" :class="{ 'panel--compact': compact }">
    <!-- Header -->
    <div class="panel-header">
      <div class="header-title">
        <Skull class="header-icon" :size="18" />
        <h3>Weekly Boss</h3>
      </div>
      <div v-if="activeBoss && !isDefeated" class="header-timer">
        <Clock :size="14" />
        <span>{{ timeRemaining }}</span>
      </div>
    </div>

    <!-- Active Boss -->
    <div v-if="activeBoss" class="boss-content">
      <!-- Boss Info -->
      <div class="boss-info" :class="{ 'boss-info--defeated': isDefeated }">
        <h4 class="boss-name">{{ activeBoss.title }}</h4>
        <p v-if="!compact" class="boss-description">{{ activeBoss.description }}</p>
      </div>

      <!-- HP Bar -->
      <div class="hp-section">
        <div class="hp-labels">
          <span class="hp-label">HP</span>
          <span class="hp-value">{{ bossHp.current }} / {{ bossHp.max }}</span>
        </div>
        <div class="hp-bar-container">
          <div
            class="hp-bar"
            :class="[hpBarColor, { 'hp-bar--empty': isDefeated }]"
            :style="{ width: `${bossHp.percent}%` }"
          />
        </div>
      </div>

      <!-- Damage Stats -->
      <div class="damage-stats">
        <div class="stat">
          <Swords :size="14" />
          <span>{{ damageDealt }} damage dealt</span>
        </div>
        <div class="stat">
          <Zap :size="14" />
          <span>{{ activeBoss.rewardXp }} XP reward</span>
        </div>
      </div>

      <!-- Victory State -->
      <div v-if="isDefeated" class="victory-banner">
        <Trophy class="trophy-icon" :size="24" />
        <span>VICTORY!</span>
      </div>

      <!-- ARIA Message -->
      <ARIAMessage
        v-if="!compact"
        :message="ariaMessage"
        :type="isDefeated ? 'success' : bossHp.percent < 25 ? 'warning' : 'info'"
        :show-avatar="false"
      />
    </div>

    <!-- No Boss State -->
    <div v-else class="no-boss">
      <ARIAMessage
        :message="ariaMessage"
        :type="needsGeneration ? 'warning' : 'info'"
        :show-avatar="!compact"
      />

      <button
        v-if="needsGeneration"
        class="generate-button"
        :disabled="isGenerating"
        @click="generateBoss"
      >
        <RefreshCw
          v-if="isGenerating"
          class="button-icon spinning"
          :size="16"
        />
        <Sparkles v-else class="button-icon" :size="16" />
        {{ isGenerating ? 'Summoning...' : 'Engage Boss' }}
      </button>

      <p v-if="generationError" class="error-message">
        {{ generationError }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.boss-fight-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: linear-gradient(135deg, rgba(139, 0, 0, 0.1), rgba(30, 30, 30, 0.9));
  border-radius: var(--radius-lg);
  border: 1px solid rgba(255, 60, 60, 0.3);
}

.panel--compact {
  padding: var(--space-3);
  gap: var(--space-2);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.header-icon {
  color: var(--color-error-400);
}

.header-title h3 {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-gray-100);
  margin: 0;
}

.header-timer {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-warning-400);
}

.boss-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.boss-info {
  text-align: center;
}

.boss-info--defeated {
  opacity: 0.6;
}

.boss-name {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-error-400);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin: 0 0 var(--space-1);
  text-shadow: 0 0 20px var(--color-error-500);
}

.boss-description {
  font-size: var(--text-sm);
  color: var(--color-gray-400);
  margin: 0;
  line-height: 1.4;
}

.hp-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.hp-labels {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-xs);
}

.hp-label {
  font-weight: 600;
  color: var(--color-gray-400);
  text-transform: uppercase;
}

.hp-value {
  font-weight: 600;
  color: var(--color-gray-200);
}

.hp-bar-container {
  height: 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  overflow: hidden;
  position: relative;
}

.hp-bar {
  height: 100%;
  border-radius: 6px;
  transition: width 0.5s ease, background-color 0.3s ease;
  box-shadow: 0 0 10px currentColor;
}

.hp-bar--empty {
  width: 0 !important;
}

.bg-red-500 { background: #ef4444; color: #ef4444; }
.bg-orange-500 { background: #f97316; color: #f97316; }
.bg-green-500 { background: #22c55e; color: #22c55e; }

.damage-stats {
  display: flex;
  justify-content: center;
  gap: var(--space-4);
}

.stat {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-gray-400);
}

.stat svg {
  color: var(--color-warning-400);
}

.victory-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: linear-gradient(135deg, var(--color-success-600), var(--color-success-500));
  border-radius: var(--radius-md);
  color: white;
  font-size: var(--text-lg);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  animation: victory-glow 1s ease-in-out infinite alternate;
}

@keyframes victory-glow {
  from { box-shadow: 0 0 10px var(--color-success-500); }
  to { box-shadow: 0 0 30px var(--color-success-400); }
}

.trophy-icon {
  animation: trophy-bounce 0.5s ease-in-out infinite alternate;
}

@keyframes trophy-bounce {
  from { transform: translateY(0); }
  to { transform: translateY(-4px); }
}

.no-boss {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  text-align: center;
}

.generate-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: linear-gradient(135deg, var(--color-error-600), var(--color-error-500));
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.generate-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 60, 60, 0.3);
}

.generate-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button-icon {
  flex-shrink: 0;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.error-message {
  font-size: var(--text-xs);
  color: var(--color-error-400);
}
</style>
