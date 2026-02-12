<script setup lang="ts">
/**
 * ArenaView.vue — Main arena container
 * FEATURE: Cyberflow Arena — tasks become enemies, productivity = combat
 * Layout: 3D scene (ArenaScene) + HTML overlay (ArenaHUD) + phase overlays
 *
 * Briefing overlay: ARIA narrative + enemy type breakdown + threat analysis
 * Victory overlay: Stats + XP earned
 */
import { onMounted } from 'vue'
import { useArenaStore } from '@/stores/arena'
import { useArenaSync } from '@/composables/arena/useArenaSync'
import ArenaScene from './ArenaScene.vue'
import ArenaHUD from './ArenaHUD.vue'
import ArenaAbilityBar from './ArenaAbilityBar.vue'

const arenaStore = useArenaStore()
const { initIfNeeded } = useArenaSync()

onMounted(() => {
  initIfNeeded()
})

// Don't cleanup on unmount — arena state persists across tab switches
// User must explicitly click EXIT ARENA to cleanup
</script>

<template>
  <div class="arena-view">
    <!-- 3D Scene -->
    <ArenaScene class="arena-scene" />

    <!-- HTML Overlay HUD -->
    <ArenaHUD class="arena-hud" />

    <!-- Ability Bar (HTML overlay with pointer-events) -->
    <ArenaAbilityBar />

    <!-- Briefing Phase Overlay -->
    <Transition name="fade">
      <div
        v-if="arenaStore.phase === 'briefing'"
        class="arena-overlay briefing-overlay"
      >
        <div class="overlay-content">
          <!-- ARIA Narrative Header -->
          <div class="aria-header">
            <span class="aria-tag">ARIA</span>
            <span class="aria-subtitle">Autonomous Runtime Intelligence Agent</span>
          </div>

          <div class="briefing-narrative">
            <p class="narrative-line">
              Netrunner, scanning the Grid...
              <span class="narrative-highlight">{{ arenaStore.enemies.length }} hostile signatures</span> detected.
            </p>
            <p v-if="arenaStore.enemyBreakdown.overdue > 0" class="narrative-line narrative-warning">
              WARNING: {{ arenaStore.enemyBreakdown.overdue }} corrupted threat{{ arenaStore.enemyBreakdown.overdue > 1 ? 's' : '' }} from overdue data packets.
              They've been festering in the Grid.
            </p>
            <p v-else class="narrative-line narrative-clear">
              Grid integrity holding. No overdue corruption detected.
            </p>
          </div>

          <!-- Enemy Breakdown -->
          <div class="briefing-breakdown">
            <div class="breakdown-title">THREAT ANALYSIS</div>
            <div class="breakdown-grid">
              <div v-if="arenaStore.enemyBreakdown.grunt > 0" class="breakdown-item">
                <span class="breakdown-count">{{ arenaStore.enemyBreakdown.grunt }}</span>
                <span class="breakdown-type breakdown-grunt">GRUNT</span>
                <span class="breakdown-desc">Low priority</span>
              </div>
              <div v-if="arenaStore.enemyBreakdown.standard > 0" class="breakdown-item">
                <span class="breakdown-count">{{ arenaStore.enemyBreakdown.standard }}</span>
                <span class="breakdown-type breakdown-standard">STANDARD</span>
                <span class="breakdown-desc">Medium priority</span>
              </div>
              <div v-if="arenaStore.enemyBreakdown.elite > 0" class="breakdown-item">
                <span class="breakdown-count">{{ arenaStore.enemyBreakdown.elite }}</span>
                <span class="breakdown-type breakdown-elite">ELITE</span>
                <span class="breakdown-desc">High priority</span>
              </div>
              <div v-if="arenaStore.enemyBreakdown.boss > 0" class="breakdown-item">
                <span class="breakdown-count">{{ arenaStore.enemyBreakdown.boss }}</span>
                <span class="breakdown-type breakdown-boss">BOSS</span>
                <span class="breakdown-desc">Critical threat</span>
              </div>
            </div>
          </div>

          <!-- Quick Controls Reference -->
          <div class="briefing-controls">
            <span class="control-hint"><kbd>WASD</kbd> Move</span>
            <span class="control-divider">/</span>
            <span class="control-hint"><kbd>Click</kbd> Shoot</span>
            <span class="control-divider">/</span>
            <span class="control-hint"><kbd>Q W E R</kbd> Abilities</span>
          </div>

          <button
            class="engage-button"
            @click="arenaStore.startWave()"
          >
            <span class="engage-text">ENGAGE HOSTILES</span>
            <span class="engage-border" />
          </button>
        </div>
      </div>
    </Transition>

    <!-- Victory Phase Overlay -->
    <Transition name="fade">
      <div
        v-if="arenaStore.phase === 'victory'"
        class="arena-overlay victory-overlay"
      >
        <div class="overlay-content">
          <div class="aria-header">
            <span class="aria-tag aria-tag--victory">ARIA</span>
            <span class="aria-subtitle">Mission Report</span>
          </div>

          <div class="victory-title" data-text="SECTOR CLEARED">
            SECTOR CLEARED
          </div>

          <div class="victory-narrative">
            Outstanding work, Netrunner. All threats neutralized.
          </div>

          <div class="victory-stats">
            <div class="victory-stat">
              <span class="stat-label">ENEMIES ELIMINATED</span>
              <span class="stat-value">{{ arenaStore.enemiesKilled.length }}</span>
            </div>
            <div class="victory-stat">
              <span class="stat-label">XP EARNED</span>
              <span class="stat-value stat-value--xp">{{ arenaStore.currentRun?.totalXpEarned ?? 0 }}</span>
            </div>
            <div class="victory-stat">
              <span class="stat-label">MAX CORRUPTION</span>
              <span class="stat-value">
                {{ Math.round((arenaStore.currentRun?.maxCorruptionReached ?? 0) * 100) }}%
              </span>
            </div>
            <div class="victory-stat">
              <span class="stat-label">ABILITIES USED</span>
              <span class="stat-value">{{ arenaStore.currentRun?.abilitiesUsed ?? 0 }}</span>
            </div>
          </div>

          <button
            class="engage-button"
            @click="arenaStore.cleanup()"
          >
            <span class="engage-text">EXIT ARENA</span>
            <span class="engage-border" />
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.arena-view {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #050510;
}

.arena-scene {
  position: absolute;
  inset: 0;
}

.arena-hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
}

/* ─── Phase Overlays ─── */
.arena-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  background: rgba(5, 5, 16, 0.88);
  backdrop-filter: blur(10px);
}

.overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  max-width: 500px;
  padding: 0 2rem;
}

/* ─── ARIA Header ─── */
.aria-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.aria-tag {
  padding: 0.2rem 0.6rem;
  background: rgba(0, 255, 255, 0.15);
  border: 1px solid rgba(0, 255, 255, 0.4);
  border-radius: 3px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  font-weight: 700;
  color: #00ffff;
  letter-spacing: 0.2em;
  text-shadow: 0 0 8px rgba(0, 255, 255, 0.5);
}

.aria-tag--victory {
  background: rgba(0, 255, 136, 0.15);
  border-color: rgba(0, 255, 136, 0.4);
  color: #00ff88;
  text-shadow: 0 0 8px rgba(0, 255, 136, 0.5);
}

.aria-subtitle {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.55rem;
  color: rgba(0, 255, 255, 0.35);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* ─── Briefing Narrative ─── */
.briefing-narrative {
  text-align: center;
  font-family: 'JetBrains Mono', monospace;
}

.narrative-line {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
  margin-bottom: 0.3rem;
}

.narrative-highlight {
  color: #00ffff;
  font-weight: 700;
  text-shadow: 0 0 6px rgba(0, 255, 255, 0.4);
}

.narrative-warning {
  color: rgba(255, 64, 100, 0.8);
}

.narrative-clear {
  color: rgba(0, 255, 136, 0.6);
}

/* ─── Enemy Breakdown ─── */
.briefing-breakdown {
  width: 100%;
  padding: 1rem;
  background: rgba(5, 5, 20, 0.5);
  border: 1px solid rgba(0, 255, 255, 0.1);
  border-radius: 4px;
}

.breakdown-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.55rem;
  font-weight: 700;
  color: rgba(0, 255, 255, 0.45);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  margin-bottom: 0.75rem;
  text-align: center;
}

.breakdown-grid {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.breakdown-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  min-width: 70px;
}

.breakdown-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.5rem;
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
}

.breakdown-type {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  padding: 0.1rem 0.4rem;
  border-radius: 2px;
}

.breakdown-grunt {
  color: #00ff88;
  background: rgba(0, 255, 136, 0.1);
  border: 1px solid rgba(0, 255, 136, 0.3);
}

.breakdown-standard {
  color: #ffaa00;
  background: rgba(255, 170, 0, 0.1);
  border: 1px solid rgba(255, 170, 0, 0.3);
}

.breakdown-elite {
  color: #ff4466;
  background: rgba(255, 68, 102, 0.1);
  border: 1px solid rgba(255, 68, 102, 0.3);
}

.breakdown-boss {
  color: #ff0044;
  background: rgba(255, 0, 68, 0.15);
  border: 1px solid rgba(255, 0, 68, 0.4);
  text-shadow: 0 0 6px rgba(255, 0, 68, 0.4);
}

.breakdown-desc {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.45rem;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 0.05em;
}

/* ─── Controls Reference ─── */
.briefing-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  color: rgba(0, 255, 255, 0.4);
}

.control-hint kbd {
  padding: 0.1rem 0.3rem;
  background: rgba(0, 255, 255, 0.08);
  border: 1px solid rgba(0, 255, 255, 0.2);
  border-radius: 3px;
  color: rgba(0, 255, 255, 0.6);
  font-family: inherit;
  font-size: 0.55rem;
}

.control-divider {
  color: rgba(0, 255, 255, 0.15);
}

/* ─── Victory ─── */
.victory-title {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 2.5rem;
  font-weight: 700;
  color: #00ff88;
  text-shadow:
    0 0 10px rgba(0, 255, 136, 0.8),
    0 0 40px rgba(0, 255, 136, 0.4);
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.victory-narrative {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
}

.victory-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  width: 100%;
}

.victory-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 0.6rem;
  background: rgba(5, 5, 20, 0.5);
  border: 1px solid rgba(0, 255, 136, 0.1);
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
}

.victory-stat .stat-label {
  font-size: 0.5rem;
  color: rgba(0, 255, 136, 0.5);
  letter-spacing: 0.1em;
}

.victory-stat .stat-value {
  font-size: 1.3rem;
  font-weight: 700;
  color: #00ff88;
  text-shadow: 0 0 8px rgba(0, 255, 136, 0.5);
}

.stat-value--xp {
  color: #ffcc00 !important;
  text-shadow: 0 0 8px rgba(255, 204, 0, 0.5) !important;
}

/* ─── Engage Button ─── */
.engage-button {
  position: relative;
  padding: 0.75rem 3rem;
  background: transparent;
  border: 1px solid rgba(0, 255, 255, 0.4);
  color: #00ffff;
  font-family: 'JetBrains Mono', monospace;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s ease;
}

.engage-button:hover {
  background: rgba(0, 255, 255, 0.1);
  border-color: #00ffff;
  box-shadow:
    0 0 20px rgba(0, 255, 255, 0.3),
    inset 0 0 20px rgba(0, 255, 255, 0.1);
}

.engage-button:active {
  transform: scale(0.97);
}

.engage-border {
  position: absolute;
  inset: -1px;
  border: 1px solid transparent;
  pointer-events: none;
}

.engage-button:hover .engage-border {
  animation: border-scan 1.5s linear infinite;
}

/* ─── Transitions ─── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ─── Animations ─── */
@keyframes border-scan {
  0% { clip-path: inset(0 100% 0 0); border-color: #00ffff; }
  25% { clip-path: inset(0 0 100% 0); border-color: #00ffff; }
  50% { clip-path: inset(0 0 0 100%); border-color: #00ffff; }
  75% { clip-path: inset(100% 0 0 0); border-color: #00ffff; }
  100% { clip-path: inset(0 100% 0 0); border-color: #00ffff; }
}
</style>
