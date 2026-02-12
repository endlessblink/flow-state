<script setup lang="ts">
/**
 * ArenaHUD.vue — HTML overlay HUD for the arena
 * Layout:
 *   Top bar: wave, hostiles, corruption
 *   Target info: targeted enemy task title + HP bar
 *   Left: Combat feed (scrolling log of damage, kills, XP)
 *   Right: Instructions (How to Play)
 *   Bottom: HP bar + ability charges
 */
import { computed, ref, watch, nextTick } from 'vue'
import { Crosshair, Zap, Info } from 'lucide-vue-next'
import { useArenaStore } from '@/stores/arena'

const arenaStore = useArenaStore()

const player = computed(() => arenaStore.player)
const targetedEnemy = computed(() => arenaStore.targetedEnemy)

// Show instructions (auto-hide after 10 seconds, toggleable)
const showInstructions = ref(true)
let instructionsTimer: ReturnType<typeof setTimeout> | null = null

watch(() => arenaStore.phase, (phase) => {
  if (phase === 'wave_active') {
    showInstructions.value = true
    if (instructionsTimer) clearTimeout(instructionsTimer)
    instructionsTimer = setTimeout(() => {
      showInstructions.value = false
    }, 12000)
  }
})

function toggleInstructions() {
  showInstructions.value = !showInstructions.value
}

// Combat feed — show last 12 entries
const combatFeed = computed(() => arenaStore.combatLog.slice(0, 12))
const feedRef = ref<HTMLElement | null>(null)

// Auto-scroll combat feed on new entries
watch(() => arenaStore.combatLog.length, () => {
  nextTick(() => {
    if (feedRef.value) {
      feedRef.value.scrollTop = 0
    }
  })
})

const hpPercent = computed(() => {
  if (!player.value) return 0
  return (player.value.health / player.value.maxHealth) * 100
})

const targetHpPercent = computed(() => {
  if (!targetedEnemy.value) return 0
  return (targetedEnemy.value.health / targetedEnemy.value.maxHealth) * 100
})

const hpBarColor = computed(() => {
  if (hpPercent.value > 60) return '#00ffaa'
  if (hpPercent.value > 30) return '#ffaa00'
  return '#ff3344'
})

const targetHpBarColor = computed(() => {
  if (targetHpPercent.value > 60) return '#ff4466'
  if (targetHpPercent.value > 30) return '#ff8844'
  return '#ff2222'
})

function feedEntryColor(type: string): string {
  switch (type) {
    case 'damage': return '#00ccff'
    case 'kill': return '#00ff88'
    case 'ability': return '#cc66ff'
    case 'xp': return '#ffcc00'
    case 'system': return '#ff4466'
    default: return '#888899'
  }
}
</script>

<template>
  <div
    v-if="arenaStore.phase === 'wave_active' || arenaStore.phase === 'boss_phase'"
    class="arena-hud-container"
  >
    <!-- Top Bar -->
    <div class="hud-top-bar">
      <div class="hud-stat">
        <span class="hud-label">WAVE</span>
        <span class="hud-value">{{ arenaStore.waveNumber }}</span>
      </div>
      <div class="hud-stat">
        <span class="hud-label">HOSTILES</span>
        <span class="hud-value">{{ arenaStore.activeEnemies.length }}</span>
      </div>
      <div class="hud-stat corruption-stat">
        <span class="hud-label">CORRUPTION</span>
        <span
          class="hud-value"
          :class="{ 'corruption-high': arenaStore.corruption > 0.5 }"
        >
          {{ Math.round(arenaStore.corruptionPercent) }}%
        </span>
      </div>
    </div>

    <!-- Target Info (when enemy targeted) -->
    <div v-if="targetedEnemy" class="hud-target-info">
      <div class="target-header">
        <Crosshair :size="14" class="target-icon" />
        <span class="target-name">{{ targetedEnemy.taskTitle }}</span>
        <span class="target-tier">{{ targetedEnemy.tier.toUpperCase() }}</span>
      </div>
      <div class="target-hp-bar-container">
        <div
          class="target-hp-bar-fill"
          :style="{
            width: targetHpPercent + '%',
            backgroundColor: targetHpBarColor,
          }"
        />
        <span class="target-hp-text">
          {{ targetedEnemy.health }} / {{ targetedEnemy.maxHealth }}
        </span>
      </div>
    </div>

    <!-- Middle row: Combat feed (left) + Instructions (right) -->
    <div class="hud-middle">
      <!-- Combat Feed -->
      <div ref="feedRef" class="combat-feed">
        <div
          v-for="entry in combatFeed"
          :key="entry.id"
          class="feed-entry"
          :style="{ color: feedEntryColor(entry.type) }"
        >
          <span class="feed-prefix">{{ entry.type === 'system' ? '>>>' : entry.type === 'kill' ? '***' : '>' }}</span>
          {{ entry.message }}
        </div>
        <div v-if="combatFeed.length === 0" class="feed-entry feed-empty">
          > Awaiting combat data...
        </div>
      </div>

      <!-- Instructions Panel -->
      <Transition name="fade-instructions">
        <div v-if="showInstructions" class="instructions-panel">
          <div class="instructions-title">HOW TO PLAY</div>
          <div class="instructions-list">
            <div class="instruction-item">
              <span class="instruction-key">WASD</span>
              <span class="instruction-desc">Move player</span>
            </div>
            <div class="instruction-item">
              <span class="instruction-key">CLICK</span>
              <span class="instruction-desc">Shoot enemy</span>
            </div>
            <div class="instruction-item">
              <span class="instruction-key">Q W E R</span>
              <span class="instruction-desc">Abilities</span>
            </div>
          </div>
          <div class="instructions-shapes">
            <div class="shape-legend">
              <span class="shape-color" style="background: #00ff88;">&#9670;</span>
              <span>Grunt (low priority)</span>
            </div>
            <div class="shape-legend">
              <span class="shape-color" style="background: #ffaa00;">&#9670;</span>
              <span>Standard (medium)</span>
            </div>
            <div class="shape-legend">
              <span class="shape-color" style="background: #ff4466;">&#9670;</span>
              <span>Elite (high priority)</span>
            </div>
            <div class="shape-legend">
              <span class="shape-color" style="background: #ff0044;">&#9670;</span>
              <span>Boss (highest)</span>
            </div>
          </div>
          <div class="instructions-hint">
            Complete tasks in any view to instantly kill their enemy!
          </div>
        </div>
      </Transition>

      <!-- Instructions toggle button -->
      <button
        class="instructions-toggle"
        :class="{ 'toggle-active': showInstructions }"
        @click="toggleInstructions"
        title="Toggle instructions"
      >
        <Info :size="16" />
      </button>
    </div>

    <!-- Bottom Bar -->
    <div class="hud-bottom-bar">
      <!-- HP Bar -->
      <div class="hud-hp-section">
        <span class="hud-label">HP</span>
        <div class="hp-bar-container">
          <div
            class="hp-bar-fill"
            :style="{
              width: hpPercent + '%',
              backgroundColor: hpBarColor,
            }"
          />
          <span class="hp-text">
            {{ player?.health ?? 0 }} / {{ player?.maxHealth ?? 0 }}
          </span>
        </div>
      </div>

      <!-- Ability Charges -->
      <div class="hud-abilities-section">
        <Zap :size="14" class="ability-icon" />
        <span class="hud-label">CHARGES</span>
        <span class="hud-value ability-charges">
          {{ player?.abilityCharges ?? 0 }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.arena-hud-container {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  color: #00ffff;
  pointer-events: none;
}

/* ─── Top Bar ─── */
.hud-top-bar {
  display: flex;
  justify-content: center;
  gap: 2.5rem;
  padding: 0.5rem 1.5rem;
  background: rgba(5, 5, 20, 0.7);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(0, 255, 255, 0.15);
  border-radius: 4px;
  align-self: center;
}

.hud-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
}

.hud-label {
  font-size: 0.55rem;
  color: rgba(0, 255, 255, 0.45);
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.hud-value {
  font-size: 1rem;
  font-weight: 700;
  text-shadow: 0 0 8px rgba(0, 255, 255, 0.5);
}

.corruption-high {
  color: #ff2040 !important;
  text-shadow: 0 0 8px rgba(255, 32, 64, 0.6) !important;
}

/* ─── Target Info ─── */
.hud-target-info {
  align-self: center;
  min-width: 280px;
  max-width: 400px;
  padding: 0.5rem 1rem;
  background: rgba(5, 5, 20, 0.75);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(0, 255, 255, 0.2);
  border-radius: 4px;
  margin-top: 0.5rem;
}

.target-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}

.target-icon {
  color: #00ffff;
  flex-shrink: 0;
}

.target-name {
  font-size: 0.75rem;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.target-tier {
  font-size: 0.55rem;
  padding: 0.1rem 0.4rem;
  background: rgba(255, 0, 102, 0.2);
  border: 1px solid rgba(255, 0, 102, 0.4);
  border-radius: 2px;
  color: #ff4466;
  letter-spacing: 0.1em;
  flex-shrink: 0;
}

.target-hp-bar-container {
  position: relative;
  height: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 68, 102, 0.3);
  border-radius: 2px;
  overflow: hidden;
}

.target-hp-bar-fill {
  position: absolute;
  inset: 0;
  transition: width 0.3s ease;
}

.target-hp-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.55rem;
  color: rgba(255, 255, 255, 0.8);
  text-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
}

/* ─── Middle Row ─── */
.hud-middle {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem;
  padding: 0.5rem 0;
  position: relative;
}

/* ─── Combat Feed ─── */
.combat-feed {
  width: 320px;
  max-height: 180px;
  overflow-y: auto;
  padding: 0.5rem 0.75rem;
  background: rgba(5, 5, 20, 0.6);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(0, 255, 255, 0.1);
  border-radius: 4px;
  font-size: 0.65rem;
  line-height: 1.5;
  pointer-events: auto;
}

.combat-feed::-webkit-scrollbar {
  width: 3px;
}

.combat-feed::-webkit-scrollbar-track {
  background: transparent;
}

.combat-feed::-webkit-scrollbar-thumb {
  background: rgba(0, 255, 255, 0.2);
  border-radius: 2px;
}

.feed-entry {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  animation: feed-flash 0.3s ease;
}

.feed-prefix {
  opacity: 0.5;
  margin-right: 0.25rem;
}

.feed-empty {
  color: rgba(0, 255, 255, 0.3);
}

@keyframes feed-flash {
  0% { opacity: 0; transform: translateX(-4px); }
  100% { opacity: 1; transform: translateX(0); }
}

/* ─── Instructions Panel ─── */
.instructions-panel {
  width: 220px;
  padding: 0.75rem;
  background: rgba(5, 5, 20, 0.7);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(0, 255, 255, 0.15);
  border-radius: 4px;
}

.instructions-title {
  font-size: 0.65rem;
  font-weight: 700;
  color: #00ffff;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
  text-shadow: 0 0 6px rgba(0, 255, 255, 0.4);
}

.instructions-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.6rem;
}

.instruction-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.6rem;
}

.instruction-key {
  min-width: 60px;
  padding: 0.15rem 0.35rem;
  background: rgba(0, 255, 255, 0.1);
  border: 1px solid rgba(0, 255, 255, 0.25);
  border-radius: 3px;
  color: #00ffff;
  text-align: center;
  font-weight: 700;
  font-size: 0.55rem;
  letter-spacing: 0.1em;
}

.instruction-desc {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.55rem;
}

.instructions-shapes {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-bottom: 0.5rem;
  font-size: 0.5rem;
  color: rgba(255, 255, 255, 0.5);
}

.shape-legend {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.shape-color {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  font-size: 0;
}

.instructions-hint {
  font-size: 0.5rem;
  color: rgba(0, 255, 255, 0.4);
  font-style: italic;
  border-top: 1px solid rgba(0, 255, 255, 0.1);
  padding-top: 0.4rem;
}

.instructions-toggle {
  position: absolute;
  bottom: 0.5rem;
  right: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(5, 5, 20, 0.7);
  border: 1px solid rgba(0, 255, 255, 0.2);
  border-radius: 4px;
  color: rgba(0, 255, 255, 0.4);
  cursor: pointer;
  pointer-events: auto;
  transition: all 0.2s ease;
}

.instructions-toggle:hover {
  border-color: #00ffff;
  color: #00ffff;
}

.toggle-active {
  color: #00ffff;
  border-color: rgba(0, 255, 255, 0.4);
}

/* ─── Instructions transition ─── */
.fade-instructions-enter-active,
.fade-instructions-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-instructions-enter-from,
.fade-instructions-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

/* ─── Bottom Bar ─── */
.hud-bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  padding: 0.5rem 1.5rem;
  background: rgba(5, 5, 20, 0.7);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(0, 255, 255, 0.15);
  border-radius: 4px;
}

.hud-hp-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
}

.hp-bar-container {
  position: relative;
  flex: 1;
  max-width: 300px;
  height: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(0, 255, 170, 0.3);
  border-radius: 2px;
  overflow: hidden;
}

.hp-bar-fill {
  position: absolute;
  inset: 0;
  transition: width 0.3s ease, background-color 0.5s ease;
}

.hp-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
}

.hud-abilities-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ability-icon {
  color: #ffcc00;
}

.ability-charges {
  color: #ffcc00;
  text-shadow: 0 0 6px rgba(255, 204, 0, 0.5);
}
</style>
