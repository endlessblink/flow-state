<script setup lang="ts">
/**
 * ArenaAbilityBar.vue — Ability buttons with cooldown indicators
 * 4 abilities: AOE Blast, Shield, Overclock, Heal
 * Shows charge count, cooldown progress, hotkey hints
 */
import { computed } from 'vue'
import { Zap, Shield, Cpu, Heart } from 'lucide-vue-next'
import { useArenaStore } from '@/stores/arena'
import { ABILITY_DEFINITIONS } from '@/types/arena'
import type { AbilityType } from '@/types/arena'
import { canActivateAbility } from '@/services/arena/arenaAbilities'

const arenaStore = useArenaStore()

const iconMap: Record<string, any> = {
  Zap,
  Shield,
  Cpu,
  Heart,
}

const hotkeys = ['Q', 'W', 'E', 'R']

const abilities = computed(() =>
  ABILITY_DEFINITIONS.map((def, idx) => {
    const onCooldown = arenaStore.abilityCooldowns.get(def.type)
    const now = Date.now()
    const cdRemaining = onCooldown ? Math.max(0, onCooldown - now) : 0
    const cdPercent = onCooldown ? Math.max(0, (onCooldown - now) / def.cooldownMs) * 100 : 0
    const canUse = canActivateAbility(
      def.type,
      arenaStore.player?.abilityCharges ?? 0,
      arenaStore.abilityCooldowns
    )

    return {
      ...def,
      icon: iconMap[def.iconName] ?? Zap,
      hotkey: hotkeys[idx],
      cdRemaining,
      cdPercent,
      canUse,
    }
  })
)

function handleAbilityClick(type: AbilityType) {
  arenaStore.activateAbility(type)
}

// Keyboard shortcuts
function handleKeydown(e: KeyboardEvent) {
  if (arenaStore.phase !== 'wave_active' && arenaStore.phase !== 'boss_phase') return

  const keyMap: Record<string, AbilityType> = {
    q: 'aoe_blast',
    w: 'shield',
    e: 'overclock',
    r: 'heal',
  }

  const ability = keyMap[e.key.toLowerCase()]
  if (ability) {
    handleAbilityClick(ability)
  }
}

// Register keyboard listener
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleKeydown)
}
</script>

<template>
  <div
    v-if="arenaStore.phase === 'wave_active' || arenaStore.phase === 'boss_phase'"
    class="ability-bar"
  >
    <div class="ability-bar-inner">
      <button
        v-for="ability in abilities"
        :key="ability.type"
        class="ability-button"
        :class="{
          'ability--available': ability.canUse,
          'ability--cooldown': ability.cdRemaining > 0,
          'ability--disabled': !ability.canUse,
        }"
        :title="`${ability.name}: ${ability.effect} [${ability.hotkey}]`"
        @click="handleAbilityClick(ability.type)"
      >
        <!-- Cooldown overlay -->
        <div
          v-if="ability.cdPercent > 0"
          class="cooldown-overlay"
          :style="{ height: ability.cdPercent + '%' }"
        />

        <!-- Icon -->
        <component :is="ability.icon" :size="20" class="ability-icon" />

        <!-- Hotkey -->
        <span class="ability-hotkey">{{ ability.hotkey }}</span>

        <!-- Cooldown timer text -->
        <span v-if="ability.cdRemaining > 0" class="cooldown-text">
          {{ Math.ceil(ability.cdRemaining / 1000) }}s
        </span>
      </button>
    </div>

    <!-- Charges counter -->
    <div class="charges-display">
      <Zap :size="12" class="charges-icon" />
      <span class="charges-count">{{ arenaStore.player?.abilityCharges ?? 0 }}</span>
    </div>
  </div>
</template>

<style scoped>
.ability-bar {
  position: absolute;
  bottom: 4.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  z-index: 15;
  pointer-events: auto;
}

.ability-bar-inner {
  display: flex;
  gap: 0.5rem;
}

.ability-button {
  position: relative;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(5, 5, 20, 0.8);
  border: 1px solid rgba(0, 255, 255, 0.3);
  border-radius: 6px;
  color: #00ffff;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
}

.ability-button:hover:not(.ability--disabled) {
  border-color: #00ffff;
  background: rgba(0, 255, 255, 0.1);
  box-shadow: 0 0 12px rgba(0, 255, 255, 0.3);
  transform: translateY(-2px);
}

.ability-button:active:not(.ability--disabled) {
  transform: scale(0.95);
}

.ability--available {
  border-color: rgba(0, 255, 255, 0.6);
  box-shadow: 0 0 6px rgba(0, 255, 255, 0.15);
}

.ability--cooldown {
  color: rgba(0, 255, 255, 0.4);
  border-color: rgba(0, 255, 255, 0.15);
  cursor: not-allowed;
}

.ability--disabled {
  color: rgba(100, 100, 120, 0.5);
  border-color: rgba(100, 100, 120, 0.2);
  cursor: not-allowed;
}

.cooldown-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.6);
  transition: height 0.1s linear;
  pointer-events: none;
}

.ability-icon {
  position: relative;
  z-index: 1;
}

.ability-hotkey {
  position: absolute;
  bottom: 2px;
  right: 3px;
  font-size: 0.5rem;
  font-family: 'JetBrains Mono', monospace;
  color: rgba(0, 255, 255, 0.4);
  z-index: 1;
}

.cooldown-text {
  position: absolute;
  top: 2px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.55rem;
  font-family: 'JetBrains Mono', monospace;
  color: rgba(255, 255, 255, 0.7);
  z-index: 1;
  text-shadow: 0 0 3px rgba(0, 0, 0, 0.8);
}

.charges-display {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
}

.charges-icon {
  color: #ffcc00;
}

.charges-count {
  color: #ffcc00;
  text-shadow: 0 0 4px rgba(255, 204, 0, 0.4);
}
</style>
