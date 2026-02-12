<script setup lang="ts">
/**
 * GamificationHUD - RPG-styled header HUD
 * Replaces inline gamification widgets with a unified, cyberflow-themed display.
 *
 * Adapts to intensity level:
 * - minimal: "Lv.N" text only (no container, no decoration)
 * - moderate: Corner-cut container with level + XP bar + streak + challenge pips
 * - intense: Same + always-on glow + XP shine animation + narrative micro-text
 *
 * Skill sources: cyberflow-design-system (container, glow, typography),
 * game-ui-components (XP gradient, streak flame), gamification-intensity-system (rendering tiers)
 */
import { computed } from 'vue'
import { useGamificationStore } from '@/stores/gamification'
import { useChallengesStore } from '@/stores/challenges'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useUIStore } from '@/stores/ui'
import { useCyberflowTheme } from '@/composables/useCyberflowTheme'
import { useXpAnimations } from '@/composables/useXpAnimations'
import { getLevelNarrative } from '@/composables/useAriaTooltipNarrative'
import { GamificationTooltipWrapper, LevelBadge, ChallengePips } from '@/components/gamification'
import LevelTooltipContent from '@/components/gamification/tooltips/LevelTooltipContent.vue'
import XpTooltipContent from '@/components/gamification/tooltips/XpTooltipContent.vue'
import StreakTooltipContent from '@/components/gamification/tooltips/StreakTooltipContent.vue'
import ChallengeTooltipContent from '@/components/gamification/tooltips/ChallengeTooltipContent.vue'
import { Flame, ChevronDown, Target } from 'lucide-vue-next'

const props = defineProps<{
  panelOpen: boolean
}>()

const emit = defineEmits<{
  togglePanel: []
}>()

const gamificationStore = useGamificationStore()
const challengesStore = useChallengesStore()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const uiStore = useUIStore()

const { showAtIntensity } = useCyberflowTheme()
const isMinimal = computed(() => !showAtIntensity('moderate'))
const isIntense = computed(() => showAtIntensity('intense'))

const { latestLevelEvent } = useXpAnimations()

// Gamification data
const level = computed(() => gamificationStore.currentLevel)
const levelInfo = computed(() => gamificationStore.levelInfo)
const progressPercent = computed(() => levelInfo.value.progressPercent)
const xpText = computed(() => `${levelInfo.value.currentXp}/${levelInfo.value.xpForNextLevel}`)
const streakInfo = computed(() => gamificationStore.streakInfo)
const streak = computed(() => streakInfo.value.currentStreak)
const isActiveToday = computed(() => streakInfo.value.isActiveToday)
const hasChallenges = computed(() => challengesStore.hasActiveChallenges)

// Active mission for HUD display
const firstActiveDaily = computed(() => challengesStore.activeDailies[0])
const missionLabel = computed(() => {
  const c = firstActiveDaily.value
  if (!c) return null
  const title = c.title.length > 15 ? c.title.slice(0, 14) + '…' : c.title
  return `${title} ${c.objectiveCurrent}/${c.objectiveTarget}`
})

// Narrative (intense only)
const narrative = computed(() =>
  getLevelNarrative(level.value, progressPercent.value)
)

function goToSignIn() {
  uiStore.openAuthModal('login')
}
</script>

<template>
  <!-- Not authenticated: CTA -->
  <div v-if="!authStore.isAuthenticated" class="hud-connect" @click="goToSignIn">
    <span class="hud-connect-label">CONNECT TO THE GRID</span>
  </div>

  <!-- Authenticated: RPG HUD -->
  <div
    v-else-if="settingsStore.gamificationEnabled"
    class="gamification-hud"
    :class="[
      { 'hud--minimal': isMinimal },
      { 'hud--moderate': !isMinimal && !isIntense },
      { 'hud--intense': isIntense },
      { 'hud--active': panelOpen }
    ]"
    role="group"
    tabindex="0"
    :aria-label="`Level ${level} netrunner. ${progressPercent}% to next level.`"
    @click="emit('togglePanel')"
    @keydown.enter="emit('togglePanel')"
  >
    <!-- Minimal: text only (per intensity-system §4) -->
    <span v-if="isMinimal" class="hud-level-text">Lv.{{ level }}</span>

    <!-- Moderate+: full HUD bar -->
    <template v-else>
      <!-- Level section -->
      <GamificationTooltipWrapper :panel-open="panelOpen">
        <div class="hud-section hud-level">
          <LevelBadge size="sm" :level-event="latestLevelEvent" />
          <span class="hud-stat-label">LV</span>
          <span class="hud-stat-value">{{ level }}</span>
        </div>
        <template #tooltip><LevelTooltipContent /></template>
      </GamificationTooltipWrapper>

      <div class="hud-divider" />

      <!-- XP section -->
      <GamificationTooltipWrapper :panel-open="panelOpen">
        <div class="hud-section hud-xp">
          <span class="hud-stat-label">XP</span>
          <div class="hud-xp-track">
            <div class="hud-xp-fill" :style="{ width: progressPercent + '%' }" />
            <div v-if="isIntense" class="hud-xp-shine" :style="{ width: progressPercent + '%' }" />
          </div>
          <span class="hud-stat-value hud-xp-text">{{ isIntense ? xpText : progressPercent + '%' }}</span>
        </div>
        <template #tooltip><XpTooltipContent /></template>
      </GamificationTooltipWrapper>

      <div class="hud-divider" />

      <!-- Streak section -->
      <GamificationTooltipWrapper :panel-open="panelOpen">
        <div class="hud-section hud-streak">
          <Flame :size="14" class="hud-flame" :class="{ 'hud-flame--active': isActiveToday }" />
          <span class="hud-stat-value">{{ streak }}d</span>
        </div>
        <template #tooltip><StreakTooltipContent /></template>
      </GamificationTooltipWrapper>

      <!-- Challenge pips -->
      <GamificationTooltipWrapper v-if="hasChallenges" :panel-open="panelOpen">
        <div class="hud-section hud-challenges">
          <ChallengePips />
        </div>
        <template #tooltip><ChallengeTooltipContent /></template>
      </GamificationTooltipWrapper>

      <!-- Expand chevron -->
      <ChevronDown :size="12" class="hud-chevron" :class="{ 'hud-chevron--open': panelOpen }" />
    </template>

    <!-- Intense: narrative micro-text row -->
    <div v-if="isIntense && !panelOpen" class="hud-narrative">
      "{{ narrative }}"
    </div>
  </div>
</template>

<style scoped>
/* ============================================
   HUD Container — uses corner-cut-sm from
   cyberflow-design-system §6 (8px diagonal cuts)
   ============================================ */
.gamification-hud {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1-5, 6px) var(--space-3);
  cursor: pointer;
  user-select: none;
  flex-wrap: wrap;
}

/* Pseudo-element for background + border + shape.
   clip-path kills backdrop-filter, so we clip only the pseudo
   and keep blur on the main element. */
.gamification-hud::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: rgba(18, 18, 26, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--cf-cyan-20, rgba(0, 240, 255, 0.2));
  /* corner-cut-sm from cyberflow-design-system §6 */
  clip-path: polygon(
    8px 0, 100% 0,
    100% calc(100% - 8px),
    calc(100% - 8px) 100%,
    0 100%, 0 8px
  );
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

/* Moderate hover: neon-cyan--subtle from cyberflow-design-system §2 */
.gamification-hud:hover::before {
  border-color: var(--cf-cyan-50, rgba(0, 240, 255, 0.5));
  box-shadow:
    0 0 5px rgba(0, 240, 255, 0.5),
    0 0 10px rgba(0, 240, 255, 0.2);
}

/* Active (panel open) */
.gamification-hud.hud--active::before {
  border-color: var(--cf-cyan, #00f0ff);
  box-shadow:
    0 0 5px rgba(0, 240, 255, 0.5),
    0 0 10px rgba(0, 240, 255, 0.2);
}

/* Intense: always-on glow from cyberflow-design-system §2 */
.gamification-hud.hud--intense::before {
  border-color: var(--cf-cyan, #00f0ff);
  box-shadow:
    0 0 5px rgba(0, 240, 255, 0.5),
    0 0 10px rgba(0, 240, 255, 0.2);
}

.gamification-hud.hud--intense:hover::before {
  box-shadow:
    0 0 5px #00f0ff,
    0 0 10px #00f0ff,
    0 0 20px #00f0ff,
    0 0 40px #00f0ff;
}

/* ============================================
   Minimal: per intensity-system §4
   "Just text, no decoration, monospace font"
   ============================================ */
.hud--minimal {
  padding: var(--space-1) var(--space-2);
}

.hud--minimal::before {
  display: none;
}

.hud-level-text {
  font-family: var(--font-cyber-data, 'Space Mono', monospace);
  font-size: var(--text-sm);
  font-weight: 700;
  color: rgba(0, 240, 255, 0.7);
  letter-spacing: 0.02em;
}

/* ============================================
   Typography — from cyberflow-design-system §7
   Space Mono for data, uppercase labels
   ============================================ */
.hud-stat-label {
  font-family: var(--font-cyber-data, 'Space Mono', monospace);
  font-size: 11px;
  font-weight: 400;
  color: var(--cf-cyan, #00f0ff);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  line-height: 1;
}

.hud-stat-value {
  font-family: var(--font-cyber-data, 'Space Mono', monospace);
  font-size: var(--text-sm);
  font-weight: 700;
  color: rgba(0, 240, 255, 0.9);
  letter-spacing: 0.02em;
  line-height: 1;
}

/* ============================================
   HUD Sections & Dividers
   ============================================ */
.hud-section {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.hud-divider {
  width: 1px;
  height: 16px;
  background: var(--cf-cyan-20, rgba(0, 240, 255, 0.2));
  flex-shrink: 0;
}

/* ============================================
   XP Bar — gradient from game-ui-components §2
   Uses --xp-bar-gradient token
   ============================================ */
.hud-xp-track {
  position: relative;
  width: 80px;
  height: 4px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 2px;
  overflow: hidden;
}

.hud-xp-fill {
  position: absolute;
  inset: 0;
  width: 0;
  background: var(--xp-bar-gradient, linear-gradient(90deg, rgba(0, 240, 255, 0.9), rgba(255, 0, 153, 0.9)));
  border-radius: 2px;
  transition: width 0.6s ease-out;
}

/* Intense: shine sweep from game-ui-components §2 */
.hud-xp-shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%);
  background-size: 200% 100%;
  animation: xp-shine 3s ease-in-out infinite;
}

.hud-xp-text {
  white-space: nowrap;
}

/* ============================================
   Streak — flame color from game-ui-components
   Uses --streak-flame-color token
   ============================================ */
.hud-flame {
  color: var(--text-muted, rgba(255, 255, 255, 0.4));
  transition: color 0.2s ease;
}

.hud-flame--active {
  color: var(--streak-flame-color, rgb(255, 107, 53));
  filter: drop-shadow(0 0 4px rgba(255, 107, 53, 0.6));
}

/* ============================================
   Chevron expand indicator
   ============================================ */
.hud-chevron {
  color: var(--cf-cyan-50, rgba(0, 240, 255, 0.5));
  transition: transform 0.2s ease, color 0.2s ease;
  flex-shrink: 0;
}

.hud-chevron--open {
  transform: rotate(180deg);
  color: var(--cf-cyan, #00f0ff);
}

/* ============================================
   Narrative micro-text (intense only)
   Uses getLevelNarrative() from useAriaTooltipNarrative
   ============================================ */
.hud-narrative {
  width: 100%;
  font-family: var(--font-cyber-data, 'Space Mono', monospace);
  font-size: 10px;
  font-style: italic;
  color: var(--cf-cyan-50, rgba(0, 240, 255, 0.5));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
  padding-top: 2px;
  line-height: 1.2;
}

/* ============================================
   Auth CTA
   ============================================ */
.hud-connect {
  position: relative;
  display: flex;
  align-items: center;
  padding: var(--space-1) var(--space-3);
  cursor: pointer;
}

.hud-connect::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: rgba(26, 26, 37, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--cf-cyan-20, rgba(0, 240, 255, 0.2));
  clip-path: polygon(
    8px 0, 100% 0,
    100% calc(100% - 8px),
    calc(100% - 8px) 100%,
    0 100%, 0 8px
  );
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.hud-connect:hover::before {
  border-color: var(--cf-cyan-50, rgba(0, 240, 255, 0.5));
  box-shadow:
    0 0 5px rgba(0, 240, 255, 0.3),
    0 0 10px rgba(0, 240, 255, 0.1);
}

.hud-connect-label {
  font-family: var(--font-cyber-data, 'Space Mono', monospace);
  font-size: 11px;
  color: var(--cf-cyan-50, rgba(0, 240, 255, 0.5));
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* ============================================
   Animations (with reduced-motion from
   cyberflow-design-system §10)
   ============================================ */
@keyframes xp-shine {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .gamification-hud,
  .hud-connect {
    transition: none;
  }
  .hud-xp-shine {
    animation: none;
    display: none;
  }
  .hud-xp-fill {
    transition: none;
  }
  .hud-chevron {
    transition: none;
  }
}
</style>
