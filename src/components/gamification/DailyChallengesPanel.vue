<script setup lang="ts">
/**
 * DailyChallengesPanel Component
 * FEATURE-1132: Display 3 daily missions with generation trigger
 */
import { computed, ref, onMounted } from 'vue'
import { useChallengesStore } from '@/stores/challenges'
import { createAIRouter } from '@/services/ai/router'
import type { ChatMessage } from '@/services/ai/types'
import type { Challenge } from '@/types/challenges'
import { storeToRefs } from 'pinia'
import ChallengeCard from './ChallengeCard.vue'
import ARIAMessage from './ARIAMessage.vue'
import { RefreshCw, Sparkles, CheckCircle2, AlertCircle, Target } from 'lucide-vue-next'

// Props
defineProps<{
  compact?: boolean
}>()

const emit = defineEmits<{
  pickChallenge: [challenge: Challenge]
}>()

// Store
const challengesStore = useChallengesStore()
const {
  activeDailies,
  allDailiesComplete,
  isGenerating,
  lastDailyGeneration: _lastDailyGeneration,
  completedTodayCount,
  pickedChallengeId,
  pickedChallenge,
} = storeToRefs(challengesStore)

// AI Router for challenge generation
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
    console.warn('[DailyChallenges] AI router init failed:', e)
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
    console.warn('[DailyChallenges] AI chat failed:', e)
    return { content: '' }
  }
}

// Local state
const showGenerateConfirm = ref(false)
const generationError = ref<string | null>(null)

// Computed
const needsGeneration = computed(() =>
  activeDailies.value.length === 0 && !allDailiesComplete.value
)

const statusMessage = computed(() => {
  if (isGenerating.value) {
    return 'ARIA is analyzing your patterns...'
  }
  if (allDailiesComplete.value) {
    return 'All daily missions complete. Grid stability restored.'
  }
  if (activeDailies.value.length > 0) {
    return `${3 - activeDailies.value.length} of 3 missions complete`
  }
  return 'Daily missions ready for deployment'
})

// Actions
async function generateChallenges() {
  generationError.value = null

  try {
    await challengesStore.generateDailyChallengesAction({
      aiAvailable: aiAvailable.value,
      chat: chatWithAI,
    })
    showGenerateConfirm.value = false
  } catch (error) {
    generationError.value = error instanceof Error ? error.message : 'Failed to generate challenges'
    console.error('[DailyChallenges] Generation failed:', error)
  }
}

function handleChallengeClick(challenge: Challenge) {
  // Toggle: click again to deselect
  if (pickedChallengeId.value === challenge.id) {
    challengesStore.pickChallengeById(null)
    return
  }
  challengesStore.pickChallengeById(challenge.id)
  emit('pickChallenge', challenge)
}
</script>

<template>
  <div class="daily-challenges-panel" :class="{ 'panel--compact': compact }">
    <!-- Header -->
    <div class="panel-header">
      <div class="header-title">
        <Sparkles class="header-icon" :size="18" />
        <h3>Daily Missions</h3>
      </div>
      <div class="header-status">
        <span
          class="status-indicator"
          :class="{
            'status--complete': allDailiesComplete,
            'status--active': activeDailies.length > 0,
            'status--pending': needsGeneration,
          }"
        />
        <span class="status-text">{{ completedTodayCount }}/3</span>
      </div>
    </div>

    <!-- ARIA Message -->
    <ARIAMessage
      v-if="!compact"
      :message="statusMessage"
      :type="allDailiesComplete ? 'success' : isGenerating ? 'loading' : 'info'"
    />

    <!-- Active Mission Banner -->
    <div v-if="pickedChallenge" class="active-mission-banner">
      <div class="mission-banner-indicator" />
      <Target :size="14" class="mission-banner-icon" />
      <div class="mission-banner-content">
        <span class="mission-banner-label">ACTIVE MISSION</span>
        <span class="mission-banner-title">{{ pickedChallenge.title }}</span>
      </div>
      <span class="mission-banner-progress">{{ pickedChallenge.objectiveCurrent }}/{{ pickedChallenge.objectiveTarget }}</span>
    </div>

    <!-- Challenge Cards -->
    <div v-if="activeDailies.length > 0" class="challenges-list">
      <ChallengeCard
        v-for="challenge in activeDailies"
        :key="challenge.id"
        :challenge="challenge"
        :compact="compact"
        :class="{
          'card--picked': pickedChallengeId === challenge.id,
          'card--other': pickedChallengeId && pickedChallengeId !== challenge.id
        }"
        @click="handleChallengeClick(challenge)"
      />
    </div>

    <!-- All Complete State -->
    <div v-else-if="allDailiesComplete" class="all-complete">
      <CheckCircle2 class="complete-icon" :size="32" />
      <p>Excellent work, netrunner.</p>
      <p class="subtext">
        Return tomorrow for new missions.
      </p>
    </div>

    <!-- Generate Button -->
    <div v-else-if="needsGeneration" class="generate-section">
      <p class="generate-prompt">
        ARIA has prepared your daily missions.
        <br>
        Ready to accept the challenge?
      </p>

      <button
        class="generate-button"
        :disabled="isGenerating"
        @click="generateChallenges"
      >
        <RefreshCw
          v-if="isGenerating"
          class="button-icon spinning"
          :size="16"
        />
        <Sparkles v-else class="button-icon" :size="16" />
        {{ isGenerating ? 'Generating...' : 'Accept Missions' }}
      </button>

      <!-- Error message -->
      <div v-if="generationError" class="error-message">
        <AlertCircle :size="14" />
        {{ generationError }}
      </div>
    </div>

    <!-- Loading State -->
    <div v-else-if="isGenerating" class="loading-state">
      <RefreshCw class="spinning" :size="24" />
      <p>ARIA is analyzing the Grid...</p>
    </div>
  </div>
</template>

<style scoped>
.daily-challenges-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--overlay-component-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
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
  color: var(--color-accent-cyan);
}

.header-title h3 {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.header-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.status-indicator {
  width: var(--space-2);
  height: var(--space-2);
  border-radius: var(--radius-full);
  background: var(--text-muted);
}

.status--complete {
  background: var(--color-success-500);
  box-shadow: 0 0 var(--space-2) var(--color-success-500);
}

.status--active {
  background: var(--color-primary-500);
  animation: pulse 2s ease-in-out infinite;
}

.status--pending {
  background: var(--color-warning-500);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-text {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
}

.challenges-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.all-complete {
  text-align: center;
  padding: var(--space-4);
}

.complete-icon {
  color: var(--color-success-500);
  margin-bottom: var(--space-2);
}

.all-complete p {
  color: var(--text-secondary);
  margin: 0;
}

.all-complete .subtext {
  font-size: var(--text-sm);
  color: var(--color-gray-500);
  margin-top: var(--space-1);
}

.generate-section {
  text-align: center;
  padding: var(--space-4);
}

.generate-prompt {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin-bottom: var(--space-3);
  line-height: var(--leading-normal);
}

.generate-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: linear-gradient(135deg, var(--color-primary-600), var(--color-accent-cyan));
  color: var(--text-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
}

.generate-button:hover:not(:disabled) {
  transform: translateY(calc(-1 * var(--space-px) * 2));
  box-shadow: 0 var(--space-1) var(--space-3) rgba(0, 200, 255, 0.3);
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding: var(--space-2);
  background: var(--danger-bg-medium);
  border-radius: var(--radius-sm);
  color: var(--color-error-400);
  font-size: var(--text-xs);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  color: var(--text-tertiary);
}

.loading-state p {
  margin: 0;
  font-size: var(--text-sm);
}

/* ============================================
   Active Mission Banner
   ============================================ */
.active-mission-banner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: rgba(0, 240, 255, 0.06);
  border: 1px solid rgba(0, 240, 255, 0.25);
  border-radius: var(--radius-md);
  animation: bannerAppear 0.4s ease-out;
}

.mission-banner-indicator {
  width: 3px;
  height: 24px;
  background: var(--cf-cyan, #00f0ff);
  border-radius: 2px;
  flex-shrink: 0;
  animation: indicatorPulse 2s ease-in-out infinite;
}

.mission-banner-icon {
  color: var(--cf-cyan, #00f0ff);
  flex-shrink: 0;
}

.mission-banner-content {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.mission-banner-label {
  font-family: var(--font-cyber-data, 'Space Mono', monospace);
  font-size: 9px;
  font-weight: 700;
  color: var(--cf-cyan, #00f0ff);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  line-height: 1;
}

.mission-banner-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.mission-banner-progress {
  font-family: var(--font-cyber-data, 'Space Mono', monospace);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--cf-cyan, #00f0ff);
  flex-shrink: 0;
}

/* ============================================
   Picked card: persistent cyan glow + pulse
   ============================================ */
.card--picked {
  border-color: var(--cf-cyan, rgba(0, 240, 255, 0.8)) !important;
  box-shadow:
    0 0 8px rgba(0, 240, 255, 0.4),
    0 0 20px rgba(0, 240, 255, 0.15) !important;
  animation: pickedGlow 2.5s ease-in-out infinite;
}

/* Other cards: dimmed when one is picked */
.card--other {
  opacity: 0.5;
  transition: opacity 0.3s ease;
}

.card--other:hover {
  opacity: 0.8;
}

@keyframes pickedGlow {
  0%, 100% {
    box-shadow:
      0 0 8px rgba(0, 240, 255, 0.4),
      0 0 20px rgba(0, 240, 255, 0.15);
  }
  50% {
    box-shadow:
      0 0 12px rgba(0, 240, 255, 0.6),
      0 0 28px rgba(0, 240, 255, 0.25);
  }
}

@keyframes bannerAppear {
  0% { opacity: 0; transform: translateY(-4px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes indicatorPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@media (prefers-reduced-motion: reduce) {
  .card--picked {
    animation: none;
  }
  .active-mission-banner {
    animation: none;
  }
  .mission-banner-indicator {
    animation: none;
  }
}
</style>
