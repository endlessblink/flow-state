<script setup lang="ts">
/**
 * CyberMissionBriefing Component
 * FEATURE-1132: Interactive mission briefing with activation
 *
 * Clean, game-quality layout. Click missions to activate (make it your focus).
 * Fits in viewport - no scrolling needed.
 */
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useChallengesStore } from '@/stores/challenges'
import { createAIRouter } from '@/services/ai/router'
import type { ChatMessage } from '@/services/ai/types'
import CyberMissionCard from './CyberMissionCard.vue'
import { Crosshair, Loader2 } from 'lucide-vue-next'

const challengesStore = useChallengesStore()

// AI Router for challenge generation
let router: ReturnType<typeof createAIRouter> | null = null
const aiAvailable = ref(false)

onMounted(async () => {
  try {
    router = createAIRouter({ debug: false })
    await router.initialize()
    const provider = await router.getActiveProvider()
    aiAvailable.value = !!provider
  } catch (e) {
    console.warn('[CyberMissionBriefing] AI router init failed:', e)
    aiAvailable.value = false
  }
})

async function chatWithAI(
  messages: ChatMessage[],
  options?: { taskType?: string }
): Promise<{ content: string }> {
  if (!router) return { content: '' }
  try {
    const response = await router.chat(messages, { taskType: options?.taskType as 'planning' })
    return { content: response.content }
  } catch (e) {
    console.warn('[CyberMissionBriefing] AI chat failed:', e)
    return { content: '' }
  }
}

const {
  activeDailies,
  isGenerating,
  isLoading,
  completedTodayCount,
} = storeToRefs(challengesStore)

// Active mission tracking (local state, no store changes)
const activeMissionId = ref<string | null>(null)

function handleActivate(missionId: string) {
  activeMissionId.value = missionId
}

// Show action button at bottom
const showActionButton = computed(() =>
  activeDailies.value.length === 0 && completedTodayCount.value === 0
)

// Generate missions handler
const generateError = ref<string | null>(null)

async function handleGenerate() {
  generateError.value = null
  try {
    await challengesStore.generateDailyChallengesAction({
      chat: chatWithAI,
      aiAvailable: aiAvailable.value,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    generateError.value = msg
    console.error('[MissionBriefing] Generation failed:', msg)
  }
}
</script>

<template>
  <div class="mission-briefing">
    <!-- Error message -->
    <div v-if="generateError" class="mission-briefing__error">
      <span>{{ generateError }}</span>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading || isGenerating" class="mission-briefing__loading">
      <Loader2 :size="24" class="mission-briefing__spinner" />
      <span class="mission-briefing__loading-text">
        {{ isGenerating ? 'Generating missions...' : 'Loading...' }}
      </span>
    </div>

    <!-- Mission cards -->
    <div
      v-else-if="activeDailies.length > 0"
      class="mission-briefing__cards"
    >
      <CyberMissionCard
        v-for="challenge in activeDailies"
        :key="challenge.id"
        :challenge="challenge"
        :is-active="activeMissionId === challenge.id"
        @activate="handleActivate(challenge.id)"
      />
    </div>

    <!-- Empty state -->
    <div
      v-else
      class="mission-briefing__empty"
    >
      <div class="mission-briefing__empty-icon">
        <Crosshair :size="48" />
      </div>
      <p class="mission-briefing__empty-text">
        No active missions
      </p>
      <p class="mission-briefing__empty-hint">
        Click below to generate new missions
      </p>
    </div>

    <!-- Action button at bottom -->
    <button
      v-if="showActionButton"
      class="mission-briefing__action-btn"
      :disabled="isGenerating"
      @click="handleGenerate"
    >
      <Crosshair :size="16" />
      <span>GENERATE MISSIONS</span>
    </button>
  </div>
</template>

<style scoped>
.mission-briefing {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-height: calc(100vh - 200px);
  overflow-y: auto;
  padding: var(--space-1);
}

/* Error message */
.mission-briefing__error {
  padding: var(--space-3);
  background: var(--cf-dark-3);
  border: 2px solid var(--cf-magenta);
  border-radius: var(--radius-md);
  font-family: var(--font-cyber-data);
  font-size: var(--text-sm);
  color: var(--cf-magenta);
  box-shadow: 0 0 var(--space-3) var(--cf-magenta-20);
}

/* Loading state */
.mission-briefing__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-3);
  min-height: 200px;
}

.mission-briefing__spinner {
  color: var(--cf-cyan);
  animation: spin 1s linear infinite;
}

.mission-briefing__loading-text {
  font-family: var(--font-cyber-data);
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.05em;
}

/* Mission cards */
.mission-briefing__cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Empty state */
.mission-briefing__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-3);
  min-height: 200px;
}

.mission-briefing__empty-icon {
  color: var(--cf-cyan);
  opacity: 0.3;
}

.mission-briefing__empty-text {
  margin: 0;
  font-family: var(--font-cyber-title);
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.05em;
}

.mission-briefing__empty-hint {
  margin: 0;
  font-family: var(--font-cyber-data);
  font-size: var(--text-sm);
  color: var(--text-muted);
  opacity: 0.7;
}

/* Action button */
.mission-briefing__action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  background: var(--cf-dark-3);
  border: 2px solid var(--cf-cyan);
  border-radius: var(--radius-md);
  color: var(--cf-cyan);
  font-family: var(--font-cyber-title);
  font-size: var(--text-base);
  font-weight: 700;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  margin-top: var(--space-2);
  box-shadow: 0 0 var(--space-3) var(--cf-cyan-20);
}

.mission-briefing__action-btn:hover:not(:disabled) {
  background: var(--cf-dark-2);
  border-color: var(--cf-cyan);
  box-shadow: 0 0 var(--space-6) var(--cf-cyan-20);
  transform: translateY(calc(var(--space-0_5) * -1));
}

.mission-briefing__action-btn:active:not(:disabled) {
  transform: translateY(0);
}

.mission-briefing__action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .mission-briefing__spinner {
    animation: none;
  }

  .mission-briefing__action-btn {
    transition: none;
  }
}

/* Scrollbar styling */
.mission-briefing::-webkit-scrollbar {
  width: var(--space-1_5);
}

.mission-briefing::-webkit-scrollbar-track {
  background: var(--cf-dark-2);
  border-radius: var(--radius-xs);
}

.mission-briefing::-webkit-scrollbar-thumb {
  background: var(--cf-cyan-20);
  border-radius: var(--radius-xs);
}

.mission-briefing::-webkit-scrollbar-thumb:hover {
  background: var(--cf-cyan);
}
</style>
