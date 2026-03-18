---
name: game-ui-components
description: "Game UI component patterns for FlowState's Cyberflow RPG. Encodes HP bars with damage trails, XP bars with glow, SVG radar charts, level badges with tier glow, streak counters, corruption meters, mission/challenge cards, boss fight UI, floating XP pop-ups, and DiceBear avatar integration. Use when building any game HUD element."
---

# Game UI Components -- Cyberflow RPG

**Version:** 1.0.0
**Category:** UI Component Library
**Related Skills:** cyberflow-rpg, cyberflow-design-system, frontend-ui-ux, gamification-intensity-system

## When to Activate

Invoke this skill when:
- Building any gamification visual component (HP bars, XP bars, radar charts, etc.)
- Implementing boss fight UI or challenge cards
- Adding floating XP pop-ups or loot reveals
- Working on level badges, streak counters, or corruption meters
- Integrating DiceBear avatars
- Extending or modifying existing gamification components in `src/components/gamification/`

## Design Token Reference (MANDATORY)

All components MUST use FlowState design tokens from `src/assets/design-tokens.css`. Never hardcode colors.

```css
/* Neon Colors (RGB triplets -- use with rgba()) */
--neon-cyan: 0, 255, 255;
--neon-magenta: 255, 0, 255;
--neon-lime: 57, 255, 20;
--neon-orange: 255, 107, 53;
--neon-purple: 138, 43, 226;

/* Neon Glow Effects (box-shadow values) */
--neon-glow-cyan: 0 0 8px rgba(var(--neon-cyan), 0.6), 0 0 16px rgba(var(--neon-cyan), 0.3), 0 0 32px rgba(var(--neon-cyan), 0.15);
--neon-glow-magenta: 0 0 8px rgba(var(--neon-magenta), 0.6), 0 0 16px rgba(var(--neon-magenta), 0.3), 0 0 32px rgba(var(--neon-magenta), 0.15);

/* Tier Colors (RGB triplets) */
--tier-bronze: 205, 127, 50;
--tier-silver: 192, 192, 192;
--tier-gold: 255, 215, 0;
--tier-platinum: 229, 228, 226;

/* Tier Glows */
--tier-glow-bronze: 0 0 8px rgba(var(--tier-bronze), 0.6);
--tier-glow-silver: 0 0 8px rgba(var(--tier-silver), 0.6);
--tier-glow-gold: 0 0 12px rgba(var(--tier-gold), 0.7), 0 0 24px rgba(var(--tier-gold), 0.3);
--tier-glow-platinum: 0 0 12px rgba(var(--tier-platinum), 0.8), 0 0 24px rgba(var(--tier-platinum), 0.4);

/* XP Bar */
--xp-bar-height: 8px;
--xp-bar-border-radius: 4px;
--xp-bar-bg: rgba(var(--color-slate-800), 0.8);
--xp-bar-gradient: linear-gradient(90deg, rgba(var(--neon-cyan), 0.9), rgba(var(--neon-magenta), 0.9));
--xp-bar-glow: 0 0 12px rgba(var(--neon-cyan), 0.5);

/* Gamification Panel */
--gamification-panel-bg: rgba(var(--color-slate-900), 0.95);
--gamification-panel-border: rgba(var(--neon-cyan), 0.3);
--gamification-card-bg: rgba(var(--color-slate-800), 0.8);
--gamification-text-primary: rgb(var(--color-slate-100));
--gamification-text-secondary: rgb(var(--color-slate-400));

/* Level Badge */
--level-badge-size: 48px;
--level-badge-font-size: 1.25rem;
--level-badge-bg: linear-gradient(135deg, rgba(var(--neon-cyan), 0.2), rgba(var(--neon-magenta), 0.2));
--level-badge-border: 2px solid rgba(var(--neon-cyan), 0.5);
--level-badge-glow: var(--neon-glow-cyan);

/* Streak */
--streak-flame-color: rgb(255, 107, 53);
--streak-text-color: rgb(var(--color-slate-100));
--streak-glow: 0 0 8px rgba(255, 107, 53, 0.5);

/* Spacing: var(--space-1) through var(--space-12) */
/* Typography: var(--text-xs), var(--text-sm), var(--text-base), var(--text-lg), var(--text-xl), var(--text-2xl) */
/* Font weights: var(--font-medium), var(--font-semibold), var(--font-bold) */
/* Radii: var(--radius-sm), var(--radius-md), var(--radius-lg), var(--radius-xl) */
```

## Existing Components (DO NOT DUPLICATE)

These components already exist in `src/components/gamification/`. Extend them, do not recreate:

| Component | File | What It Does |
|-----------|------|-------------|
| `XpBar.vue` | `src/components/gamification/XpBar.vue` | XP progress bar with neon glow |
| `LevelBadge.vue` | `src/components/gamification/LevelBadge.vue` | Circular level badge with glow |
| `StreakCounter.vue` | `src/components/gamification/StreakCounter.vue` | Streak display with flame icon |
| `BossFightPanel.vue` | `src/components/gamification/BossFightPanel.vue` | Weekly boss with HP bar |
| `ChallengeCard.vue` | `src/components/gamification/ChallengeCard.vue` | Individual mission card |
| `CorruptionOverlay.vue` | `src/components/gamification/CorruptionOverlay.vue` | Full-screen corruption effects |
| `AchievementBadge.vue` | `src/components/gamification/AchievementBadge.vue` | Achievement display |
| `AchievementToast.vue` | `src/components/gamification/AchievementToast.vue` | Achievement notification |
| `GamificationToasts.vue` | `src/components/gamification/GamificationToasts.vue` | Toast container |
| `ChallengeComplete.vue` | `src/components/gamification/ChallengeComplete.vue` | Victory animation |
| `ARIAMessage.vue` | `src/components/gamification/ARIAMessage.vue` | Game master messages |
| `DailyChallengesPanel.vue` | `src/components/gamification/DailyChallengesPanel.vue` | 3 daily missions |
| `GamificationPanel.vue` | `src/components/gamification/GamificationPanel.vue` | Main stats overview |
| `ShopModal.vue` | `src/components/gamification/ShopModal.vue` | Cosmetic shop |
| `AchievementsModal.vue` | `src/components/gamification/AchievementsModal.vue` | Achievements gallery |

## Key Type Imports

```typescript
import type { Challenge, BossFight, CorruptionTier, ChallengeDifficulty, ChallengeStatus } from '@/types/challenges'
import type { LevelInfo, StreakInfo, AchievementTier, UserStats, GamificationToast } from '@/types/gamification'
import { CORRUPTION_TIERS, getCorruptionTier } from '@/types/challenges'
import { TIER_COLORS } from '@/types/gamification'
```

## Key Store Imports

```typescript
import { useGamificationStore } from '@/stores/gamification'
import { useChallengesStore } from '@/stores/challenges'
import { storeToRefs } from 'pinia'
```

---

## Component 1: HP Bar with Dual-Layer Damage Trail

Used in boss fights. Three visual layers: dark background, yellow damage trail (delayed), current HP (color-shifts by percentage). Phase markers at 33% and 66%.

### Props Interface

```typescript
interface HpBarProps {
  currentHp: number
  maxHp: number
  showPhaseMarkers?: boolean   // default: true
  showText?: boolean           // default: true
  height?: number              // px, default: 28
  animated?: boolean           // default: true
  bossFrame?: boolean          // augmented-ui frame, default: false
  intensity?: 'minimal' | 'moderate' | 'intense'  // default: 'moderate'
}
```

### Complete Implementation

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  currentHp: number
  maxHp: number
  showPhaseMarkers?: boolean
  showText?: boolean
  height?: number
  animated?: boolean
  bossFrame?: boolean
  intensity?: 'minimal' | 'moderate' | 'intense'
}>(), {
  showPhaseMarkers: true,
  showText: true,
  height: 28,
  animated: true,
  bossFrame: false,
  intensity: 'moderate',
})

const currentPercent = computed(() =>
  props.maxHp > 0 ? Math.max(0, Math.min(100, (props.currentHp / props.maxHp) * 100)) : 0
)

// Trail follows current HP with a delay
const trailPercent = ref(currentPercent.value)
let trailTimeout: ReturnType<typeof setTimeout> | null = null

watch(currentPercent, (newVal, oldVal) => {
  if (newVal < oldVal) {
    // HP decreased: trail lingers, then catches up
    if (trailTimeout) clearTimeout(trailTimeout)
    trailTimeout = setTimeout(() => {
      trailPercent.value = newVal
    }, 600)
    // Flash effect
    showFlash.value = true
    setTimeout(() => { showFlash.value = false }, 150)
  } else {
    // HP increased (heal): trail snaps immediately
    trailPercent.value = newVal
  }
})

const showFlash = ref(false)

const hpBarColor = computed(() => {
  const p = currentPercent.value
  if (p > 50) return 'linear-gradient(90deg, #00cc00, #00ff00)'
  if (p > 25) return 'linear-gradient(90deg, #cccc00, #ffff00)'
  return 'linear-gradient(90deg, #cc0000, #ff3333)'
})

const isLowHp = computed(() => currentPercent.value < 25)

const phaseClass = computed(() => {
  const p = currentPercent.value
  if (p > 66) return 'phase-1'
  if (p > 33) return 'phase-2'
  return 'phase-3'
})
</script>

<template>
  <div
    class="hp-bar-wrapper"
    :class="[
      phaseClass,
      {
        'hp-bar-wrapper--boss': bossFrame,
        'hp-bar-wrapper--low': isLowHp && animated,
        'hp-bar-wrapper--flash': showFlash,
      }
    ]"
    :style="{ '--hp-bar-height': `${height}px` }"
    role="progressbar"
    :aria-valuenow="currentHp"
    :aria-valuemin="0"
    :aria-valuemax="maxHp"
    :aria-label="`HP: ${currentHp} of ${maxHp}`"
  >
    <div class="hp-bar">
      <!-- Phase markers -->
      <div v-if="showPhaseMarkers" class="hp-bar__markers">
        <div class="hp-bar__marker" style="left: 33%" />
        <div class="hp-bar__marker" style="left: 66%" />
      </div>

      <!-- Damage trail (yellow, delayed transition) -->
      <div
        class="hp-bar__trail"
        :style="{ width: trailPercent + '%' }"
      />

      <!-- Current HP (gradient green to red based on %) -->
      <div
        class="hp-bar__current"
        :style="{ width: currentPercent + '%', background: hpBarColor }"
      />

      <!-- Flash overlay on damage -->
      <div v-if="showFlash" class="hp-bar__flash" />

      <!-- Text overlay -->
      <span v-if="showText" class="hp-bar__text">
        {{ currentHp }} / {{ maxHp }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.hp-bar-wrapper {
  position: relative;
  width: 100%;
}

/* Boss frame via augmented-ui (if augmented-ui is available) */
.hp-bar-wrapper--boss {
  border: 2px solid rgba(var(--neon-cyan), 0.6);
  padding: 3px;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
}

.hp-bar {
  position: relative;
  height: var(--hp-bar-height, 28px);
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(var(--neon-cyan), 0.4);
  overflow: hidden;
}

.hp-bar__markers {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
}

.hp-bar__marker {
  position: absolute;
  top: 0;
  width: 1px;
  height: 100%;
  background: rgba(255, 255, 255, 0.3);
}

.hp-bar__trail {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #ffff00, #ff8800);
  transition: width 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  z-index: 1;
}

.hp-bar__current {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  transition: width 0.3s ease-out;
  z-index: 2;
  box-shadow: 0 0 8px currentColor;
}

.hp-bar__flash {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.6);
  z-index: 5;
  pointer-events: none;
  animation: hp-flash 0.15s ease-out forwards;
}

.hp-bar__text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 6;
  font-size: var(--text-sm);
  font-weight: var(--font-bold);
  color: white;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  letter-spacing: 0.05em;
}

/* Low HP pulse */
.hp-bar-wrapper--low .hp-bar {
  animation: hp-low-pulse 1.5s ease-in-out infinite;
}

@keyframes hp-low-pulse {
  0%, 100% { border-color: rgba(255, 50, 50, 0.4); }
  50% { border-color: rgba(255, 50, 50, 0.9); box-shadow: 0 0 12px rgba(255, 0, 0, 0.4); }
}

@keyframes hp-flash {
  0% { opacity: 1; }
  100% { opacity: 0; }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .hp-bar__trail { transition: width 0s; }
  .hp-bar__current { transition: width 0s; }
  .hp-bar-wrapper--low .hp-bar { animation: none; }
}
</style>
```

### Usage

```vue
<HpBar :current-hp="bossHp.current" :max-hp="bossHp.max" boss-frame />
<HpBar :current-hp="150" :max-hp="500" :height="16" :show-text="false" />
```

### Intensity Variants

| Intensity | Phase markers | Flash effect | Low HP pulse | Trail delay |
|-----------|---------------|--------------|--------------|-------------|
| `minimal` | Hidden | Disabled | Disabled | Instant |
| `moderate` | Shown | Enabled | Enabled | 600ms |
| `intense` | Shown + glow | Enabled + shake | Enabled + screen edge glow | 1000ms |

---

## Component 2: XP Bar with Animated Shine + Neon Glow

Enhanced version of the existing `XpBar.vue`. Adds sweeping shine animation and level-up flash.

### Props Interface

```typescript
interface XpBarEnhancedProps {
  currentXp: number
  maxXp: number
  level: number
  showLabel?: boolean     // default: true
  showLevelNumber?: boolean // default: true, shows level on left
  compact?: boolean       // default: false, thin variant for header
  animated?: boolean      // default: true
  intensity?: 'minimal' | 'moderate' | 'intense'
}
```

### Complete Implementation

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  currentXp: number
  maxXp: number
  level: number
  showLabel?: boolean
  showLevelNumber?: boolean
  compact?: boolean
  animated?: boolean
  intensity?: 'minimal' | 'moderate' | 'intense'
}>(), {
  showLabel: true,
  showLevelNumber: true,
  compact: false,
  animated: true,
  intensity: 'moderate',
})

const progressPercent = computed(() =>
  props.maxXp > 0 ? Math.min(100, (props.currentXp / props.maxXp) * 100) : 0
)

// Level-up flash
const showLevelUpFlash = ref(false)
watch(() => props.level, (newLevel, oldLevel) => {
  if (newLevel > oldLevel) {
    showLevelUpFlash.value = true
    setTimeout(() => { showLevelUpFlash.value = false }, 1500)
  }
})
</script>

<template>
  <div
    class="xp-bar-enhanced"
    :class="{ 'xp-bar-enhanced--compact': compact, 'xp-bar-enhanced--level-up': showLevelUpFlash }"
    role="progressbar"
    :aria-valuenow="currentXp"
    :aria-valuemin="0"
    :aria-valuemax="maxXp"
    :aria-label="`Level ${level}: ${currentXp} of ${maxXp} XP`"
  >
    <!-- Level number (left side) -->
    <span v-if="showLevelNumber && !compact" class="xp-bar-enhanced__level">
      {{ level }}
    </span>

    <!-- Bar track -->
    <div class="xp-bar-enhanced__track">
      <div
        class="xp-bar-enhanced__fill"
        :class="{ 'xp-bar-enhanced__fill--animated': animated && intensity !== 'minimal' }"
        :style="{ width: `${progressPercent}%` }"
      />
      <!-- Shine sweep -->
      <div
        v-if="animated && intensity !== 'minimal'"
        class="xp-bar-enhanced__shine"
        :style="{ width: `${progressPercent}%` }"
      />
      <!-- Glow layer -->
      <div
        class="xp-bar-enhanced__glow"
        :style="{ width: `${progressPercent}%` }"
      />
      <!-- Level-up flash overlay -->
      <div v-if="showLevelUpFlash" class="xp-bar-enhanced__levelup-flash" />
    </div>

    <!-- XP text (right side) -->
    <span v-if="showLabel && !compact" class="xp-bar-enhanced__label">
      {{ currentXp.toLocaleString() }} / {{ maxXp.toLocaleString() }} XP
    </span>
  </div>
</template>

<style scoped>
.xp-bar-enhanced {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
}

.xp-bar-enhanced--compact {
  gap: var(--space-1);
}

.xp-bar-enhanced__level {
  font-size: var(--text-sm);
  font-weight: var(--font-bold);
  color: rgba(var(--neon-cyan), 1);
  text-shadow: 0 0 6px rgba(var(--neon-cyan), 0.6);
  min-width: 24px;
  text-align: center;
}

.xp-bar-enhanced__track {
  position: relative;
  flex: 1;
  height: 16px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 2px;
  overflow: hidden;
  border: 1px solid rgba(var(--neon-purple), 0.4);
}

.xp-bar-enhanced--compact .xp-bar-enhanced__track {
  height: 6px;
}

.xp-bar-enhanced__fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--xp-bar-gradient);
  transition: width 0.5s ease-out;
}

.xp-bar-enhanced__fill--animated {
  box-shadow: 0 0 10px rgba(var(--neon-magenta), 0.5),
              0 0 20px rgba(var(--neon-magenta), 0.25);
}

/* Sweeping shine effect */
.xp-bar-enhanced__shine {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
}

.xp-bar-enhanced__shine::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 50%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  animation: xp-shine 3s ease-in-out infinite;
}

/* Glow underneath the fill */
.xp-bar-enhanced__glow {
  position: absolute;
  top: -2px;
  left: 0;
  height: calc(100% + 4px);
  background: transparent;
  box-shadow: var(--xp-bar-glow);
  border-radius: 2px;
  pointer-events: none;
  opacity: 0.6;
}

/* Level-up golden flash */
.xp-bar-enhanced__levelup-flash {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(var(--tier-gold), 0.8), rgba(var(--tier-gold), 0.4), rgba(var(--tier-gold), 0.8));
  animation: level-up-flash 1.5s ease-out forwards;
  z-index: 3;
  pointer-events: none;
}

.xp-bar-enhanced--level-up .xp-bar-enhanced__track {
  box-shadow: 0 0 20px rgba(var(--tier-gold), 0.6);
}

.xp-bar-enhanced__label {
  font-size: var(--text-xs);
  color: var(--gamification-text-secondary);
  white-space: nowrap;
  min-width: fit-content;
}

@keyframes xp-shine {
  0% { left: -100%; }
  50% { left: 150%; }
  100% { left: 150%; }
}

@keyframes level-up-flash {
  0% { opacity: 1; }
  100% { opacity: 0; }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .xp-bar-enhanced__fill { transition: width 0s; }
  .xp-bar-enhanced__shine::after { animation: none; }
  .xp-bar-enhanced__levelup-flash { animation: none; opacity: 0; }
}
</style>
```

### Usage

```vue
<XpBarEnhanced :current-xp="1250" :max-xp="2000" :level="12" />
<XpBarEnhanced :current-xp="800" :max-xp="1000" :level="5" compact :show-label="false" />
```

### Intensity Variants

| Intensity | Shine sweep | Glow | Level-up flash |
|-----------|-------------|------|----------------|
| `minimal` | Disabled | Static only | Disabled |
| `moderate` | 3s cycle | Pulsing | Golden flash |
| `intense` | 2s cycle + brighter | Strong pulse + neon bleed | Golden flash + screen shake |

---

## Component 3: SVG Radar Chart (5 Stats)

Pure SVG, no external dependencies. Renders a pentagon radar chart for player stats.

### Props Interface

```typescript
interface RadarChartProps {
  stats: {
    focus: number       // 0-100
    speed: number       // 0-100
    consistency: number // 0-100
    depth: number       // 0-100
    endurance: number   // 0-100
  }
  size?: number            // px, default: 200
  animated?: boolean       // animate on mount, default: true
  showLabels?: boolean     // default: true
  showValues?: boolean     // show numeric values next to labels, default: false
  intensity?: 'minimal' | 'moderate' | 'intense'
}
```

### Complete Implementation

```vue
<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'

const props = withDefaults(defineProps<{
  stats: {
    focus: number
    speed: number
    consistency: number
    depth: number
    endurance: number
  }
  size?: number
  animated?: boolean
  showLabels?: boolean
  showValues?: boolean
  intensity?: 'minimal' | 'moderate' | 'intense'
}>(), {
  size: 200,
  animated: true,
  showLabels: true,
  showValues: false,
  intensity: 'moderate',
})

const labels = ['Focus', 'Speed', 'Consistency', 'Depth', 'Endurance']
const statKeys = ['focus', 'speed', 'consistency', 'depth', 'endurance'] as const

const center = computed(() => props.size / 2)
const maxRadius = computed(() => props.size * 0.35) // Leave room for labels
const labelRadius = computed(() => props.size * 0.45)
const angleStep = (2 * Math.PI) / 5

// Animate from 0 to actual values
const animationProgress = ref(props.animated ? 0 : 1)

onMounted(() => {
  if (props.animated) {
    requestAnimationFrame(() => {
      animationProgress.value = 1
    })
  }
})

function getPoint(index: number, radius: number): { x: number; y: number } {
  const angle = index * angleStep - Math.PI / 2 // Start from top
  return {
    x: center.value + Math.cos(angle) * radius,
    y: center.value + Math.sin(angle) * radius,
  }
}

function getPentagonPoints(cx: number, radius: number): string {
  return Array.from({ length: 5 }, (_, i) => {
    const pt = getPoint(i, radius)
    return `${pt.x},${pt.y}`
  }).join(' ')
}

// Data polygon points with animation
const dataPointsArray = computed(() => {
  return statKeys.map((key, i) => {
    const value = (props.stats[key] / 100) * maxRadius.value * animationProgress.value
    return getPoint(i, value)
  })
})

const dataPoints = computed(() =>
  dataPointsArray.value.map(p => `${p.x},${p.y}`).join(' ')
)

function getLabelPoint(index: number): { x: number; y: number } {
  return getPoint(index, labelRadius.value)
}

const levelGridCounts = 5 // Number of background pentagon levels
</script>

<template>
  <svg
    :width="size"
    :height="size"
    :viewBox="`0 0 ${size} ${size}`"
    class="radar-chart"
    role="img"
    :aria-label="`Player stats: Focus ${stats.focus}, Speed ${stats.speed}, Consistency ${stats.consistency}, Depth ${stats.depth}, Endurance ${stats.endurance}`"
  >
    <!-- Background pentagons (grid levels) -->
    <polygon
      v-for="level in levelGridCounts"
      :key="`grid-${level}`"
      :points="getPentagonPoints(center, (level * maxRadius) / levelGridCounts)"
      fill="none"
      :stroke="`rgba(0, 240, 255, ${0.06 + 0.04 * level})`"
      stroke-width="1"
    />

    <!-- Axis lines from center to each vertex -->
    <line
      v-for="(_, i) in 5"
      :key="`axis-${i}`"
      :x1="center"
      :y1="center"
      :x2="getPoint(i, maxRadius).x"
      :y2="getPoint(i, maxRadius).y"
      stroke="rgba(0, 240, 255, 0.15)"
      stroke-width="1"
    />

    <!-- Data polygon fill -->
    <polygon
      :points="dataPoints"
      fill="rgba(147, 51, 234, 0.2)"
      stroke="rgba(192, 38, 211, 0.8)"
      stroke-width="2"
      class="radar-chart__data"
    />

    <!-- Data point circles -->
    <circle
      v-for="(point, i) in dataPointsArray"
      :key="`pt-${i}`"
      :cx="point.x"
      :cy="point.y"
      r="4"
      fill="rgba(192, 38, 211, 1)"
      stroke="rgba(255, 255, 255, 0.8)"
      stroke-width="1.5"
      class="radar-chart__point"
    />

    <!-- Labels -->
    <text
      v-for="(label, i) in labels"
      :key="`label-${i}`"
      :x="getLabelPoint(i).x"
      :y="getLabelPoint(i).y"
      fill="rgba(0, 240, 255, 0.9)"
      :font-size="size < 160 ? 9 : 11"
      font-weight="600"
      text-anchor="middle"
      dominant-baseline="middle"
      class="radar-chart__label"
    >
      {{ label }}{{ showValues ? ` (${stats[statKeys[i]]})` : '' }}
    </text>
  </svg>
</template>

<style scoped>
.radar-chart {
  filter: drop-shadow(0 0 4px rgba(var(--neon-purple), 0.3));
}

.radar-chart__data {
  transition: all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.radar-chart__point {
  filter: drop-shadow(0 0 3px rgba(192, 38, 211, 0.6));
  transition: all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.radar-chart__label {
  font-family: inherit;
  letter-spacing: 0.02em;
  text-shadow: 0 0 4px rgba(0, 240, 255, 0.4);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .radar-chart__data,
  .radar-chart__point {
    transition: none;
  }
}
</style>
```

### Usage

```vue
<RadarChart
  :stats="{ focus: 85, speed: 60, consistency: 72, depth: 90, endurance: 45 }"
  :size="240"
  show-values
/>
```

### Stats Computation Guide

Stats are derived from `user_stats` table data:

| Stat | Source | Formula |
|------|--------|---------|
| Focus | `total_focus_minutes`, `pomodoros_completed` | `min(100, avg_focus_per_pomodoro / 25 * 100)` |
| Speed | `tasks_completed`, session count | `min(100, tasks_per_session / 5 * 100)` |
| Consistency | `current_streak`, `longest_streak` | `min(100, current_streak / 30 * 100)` |
| Depth | Long pomodoro sessions (>45min) | `min(100, long_sessions / total_sessions * 100)` |
| Endurance | `total_focus_minutes` | `min(100, total_hours / 100 * 100)` |

### Intensity Variants

| Intensity | Grid opacity | Fill opacity | Point glow | Label glow |
|-----------|-------------|-------------|------------|------------|
| `minimal` | 0.1 | 0.1 | None | None |
| `moderate` | 0.15 | 0.2 | Soft purple | Soft cyan |
| `intense` | 0.25 | 0.3 | Strong purple + pulse | Strong cyan + glow |

---

## Component 4: Level Badge with Tier Glow

Hexagonal badge displaying player level with tier-colored glow.

### Props Interface

```typescript
interface LevelBadgeTieredProps {
  level: number
  size?: 'sm' | 'md' | 'lg' | 'xl'  // default: 'md'
  showTierLabel?: boolean             // default: false
  showXpBar?: boolean                 // default: false, XP bar below badge
  currentXp?: number                  // required if showXpBar
  maxXp?: number                      // required if showXpBar
  showPulse?: boolean                 // default: false
  intensity?: 'minimal' | 'moderate' | 'intense'
}
```

### Tier Mapping

```typescript
function getTierForLevel(level: number): { tier: string; color: string; rgb: string; glow: string } {
  if (level <= 10) return {
    tier: 'Bronze', color: '#cd7f32',
    rgb: 'var(--tier-bronze)', glow: 'var(--tier-glow-bronze)'
  }
  if (level <= 20) return {
    tier: 'Silver', color: '#c0c0c0',
    rgb: 'var(--tier-silver)', glow: 'var(--tier-glow-silver)'
  }
  if (level <= 30) return {
    tier: 'Gold', color: '#ffd700',
    rgb: 'var(--tier-gold)', glow: 'var(--tier-glow-gold)'
  }
  return {
    tier: 'Platinum', color: '#e5e4e2',
    rgb: 'var(--tier-platinum)', glow: 'var(--tier-glow-platinum)'
  }
}
```

### Complete Implementation

```vue
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  level: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showTierLabel?: boolean
  showXpBar?: boolean
  currentXp?: number
  maxXp?: number
  showPulse?: boolean
  intensity?: 'minimal' | 'moderate' | 'intense'
}>(), {
  size: 'md',
  showTierLabel: false,
  showXpBar: false,
  showPulse: false,
  intensity: 'moderate',
})

const tier = computed(() => {
  if (props.level <= 10) return { name: 'Bronze', color: '#cd7f32', cssVar: '--tier-bronze', glowVar: '--tier-glow-bronze' }
  if (props.level <= 20) return { name: 'Silver', color: '#c0c0c0', cssVar: '--tier-silver', glowVar: '--tier-glow-silver' }
  if (props.level <= 30) return { name: 'Gold', color: '#ffd700', cssVar: '--tier-gold', glowVar: '--tier-glow-gold' }
  return { name: 'Platinum', color: '#e5e4e2', cssVar: '--tier-platinum', glowVar: '--tier-glow-platinum' }
})

const sizeMap = {
  sm: { badge: 32, font: 'var(--text-sm)', hex: 18 },
  md: { badge: 48, font: 'var(--text-lg)', hex: 26 },
  lg: { badge: 64, font: 'var(--text-2xl)', hex: 36 },
  xl: { badge: 96, font: '2.5rem', hex: 52 },
}

const dims = computed(() => sizeMap[props.size])

const xpPercent = computed(() => {
  if (!props.showXpBar || !props.maxXp) return 0
  return Math.min(100, ((props.currentXp || 0) / props.maxXp) * 100)
})
</script>

<template>
  <div class="level-badge-tiered" :class="[`tier-${tier.name.toLowerCase()}`, { 'level-badge-tiered--pulse': showPulse }]">
    <!-- Hexagonal badge -->
    <div
      class="badge-hex"
      :style="{
        width: `${dims.badge}px`,
        height: `${dims.badge}px`,
        fontSize: dims.font,
        '--tier-color': tier.color,
      }"
      :title="`Level ${level} (${tier.name})`"
    >
      <span class="badge-hex__number">{{ level }}</span>
      <div class="badge-hex__glow" />
    </div>

    <!-- Tier label -->
    <span v-if="showTierLabel" class="badge-tier-label" :style="{ color: tier.color }">
      {{ tier.name }}
    </span>

    <!-- XP bar below badge -->
    <div v-if="showXpBar" class="badge-xp-bar">
      <div class="badge-xp-bar__fill" :style="{ width: `${xpPercent}%`, background: tier.color }" />
    </div>
  </div>
</template>

<style scoped>
.level-badge-tiered {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.badge-hex {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-bold);
  color: var(--tier-color);
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.8), rgba(30, 30, 40, 0.9));
  clip-path: polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%);
  user-select: none;
  cursor: default;
  transition: transform 0.2s ease;
}

.badge-hex:hover {
  transform: scale(1.08);
}

.badge-hex__number {
  position: relative;
  z-index: 1;
  text-shadow: 0 0 8px var(--tier-color);
  letter-spacing: 0.05em;
}

.badge-hex__glow {
  position: absolute;
  inset: -6px;
  clip-path: polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%);
  background: radial-gradient(circle, color-mix(in srgb, var(--tier-color) 20%, transparent) 0%, transparent 70%);
  pointer-events: none;
}

/* Tier-specific border glow */
.tier-bronze .badge-hex { box-shadow: var(--tier-glow-bronze); }
.tier-silver .badge-hex { box-shadow: var(--tier-glow-silver); }
.tier-gold .badge-hex { box-shadow: var(--tier-glow-gold); }
.tier-platinum .badge-hex { box-shadow: var(--tier-glow-platinum); }

/* Pulse animation for level-up */
.level-badge-tiered--pulse .badge-hex {
  animation: tier-badge-pulse 1.5s ease-in-out infinite;
}

.badge-tier-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.badge-xp-bar {
  width: 100%;
  max-width: 80px;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.badge-xp-bar__fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease-out;
}

@keyframes tier-badge-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); filter: brightness(1.3); }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .level-badge-tiered--pulse .badge-hex { animation: none; }
  .badge-hex { transition: none; }
  .badge-xp-bar__fill { transition: none; }
}
</style>
```

### Usage

```vue
<LevelBadgeTiered :level="25" size="lg" show-tier-label show-xp-bar :current-xp="800" :max-xp="2000" />
<LevelBadgeTiered :level="5" size="sm" />  <!-- Compact, header use -->
```

---

## Component 5: Streak Counter with Fire Effect

Enhanced streak display with CSS flame effect and milestone badges.

### Props Interface

```typescript
interface StreakCounterEnhancedProps {
  currentStreak: number
  isActiveToday: boolean
  streakAtRisk?: boolean       // default: false
  showMilestone?: boolean      // default: true
  compact?: boolean            // default: false
  intensity?: 'minimal' | 'moderate' | 'intense'
}
```

### Milestone Badges

```typescript
const STREAK_MILESTONES = [7, 14, 30, 60, 100, 365] as const

function getCurrentMilestone(streak: number): number | null {
  const milestones = [...STREAK_MILESTONES].reverse()
  return milestones.find(m => streak >= m) || null
}

function getNextMilestone(streak: number): number {
  return STREAK_MILESTONES.find(m => streak < m) || 365
}
```

### Complete Implementation

```vue
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  currentStreak: number
  isActiveToday: boolean
  streakAtRisk?: boolean
  showMilestone?: boolean
  compact?: boolean
  intensity?: 'minimal' | 'moderate' | 'intense'
}>(), {
  streakAtRisk: false,
  showMilestone: true,
  compact: false,
  intensity: 'moderate',
})

const MILESTONES = [7, 14, 30, 60, 100, 365] as const

const currentMilestone = computed(() => {
  const reversed = [...MILESTONES].reverse()
  return reversed.find(m => props.currentStreak >= m) || null
})

const nextMilestone = computed(() =>
  MILESTONES.find(m => props.currentStreak < m) || 365
)

const streakTier = computed(() => {
  if (props.currentStreak >= 100) return 'legendary'
  if (props.currentStreak >= 30) return 'epic'
  if (props.currentStreak >= 7) return 'hot'
  return 'normal'
})

const flameIntensity = computed(() => {
  if (props.intensity === 'minimal') return 'none'
  if (props.currentStreak >= 100) return 'legendary'
  if (props.currentStreak >= 30) return 'intense'
  if (props.currentStreak >= 7) return 'moderate'
  return 'low'
})
</script>

<template>
  <div
    class="streak-enhanced"
    :class="[
      `streak-enhanced--${streakTier}`,
      {
        'streak-enhanced--compact': compact,
        'streak-enhanced--at-risk': streakAtRisk,
        'streak-enhanced--active': isActiveToday,
      }
    ]"
    :title="`${currentStreak} day streak${streakAtRisk ? ' (at risk!)' : ''}`"
  >
    <!-- Flame effect (CSS-only) -->
    <div
      v-if="flameIntensity !== 'none' && isActiveToday"
      class="streak-enhanced__flame"
      :class="`flame--${flameIntensity}`"
      aria-hidden="true"
    />

    <!-- Streak number -->
    <span class="streak-enhanced__number">{{ currentStreak }}</span>

    <!-- Day label -->
    <span v-if="!compact" class="streak-enhanced__label">
      day{{ currentStreak !== 1 ? 's' : '' }}
    </span>

    <!-- Milestone badge -->
    <span
      v-if="showMilestone && currentMilestone && !compact"
      class="streak-enhanced__milestone"
    >
      {{ currentMilestone }}d
    </span>

    <!-- At-risk warning -->
    <div v-if="streakAtRisk && !compact" class="streak-enhanced__warning" title="Complete a task today!">
      !
    </div>
  </div>
</template>

<style scoped>
.streak-enhanced {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  background: rgba(var(--color-slate-800), 0.6);
  border-radius: var(--radius-md);
  border: 1px solid rgba(var(--neon-orange), 0.2);
}

.streak-enhanced--compact {
  padding: var(--space-1);
  gap: var(--space-1);
}

/* Flame effect (CSS-only, behind the number) */
.streak-enhanced__flame {
  position: absolute;
  bottom: 50%;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 0;
}

.streak-enhanced__flame::before,
.streak-enhanced__flame::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  transform: translateX(-50%);
}

.flame--low::before {
  width: 16px;
  height: 22px;
  background: radial-gradient(ellipse at bottom, rgba(255, 107, 53, 0.6), transparent);
  filter: blur(3px);
  animation: streak-flicker 1.5s ease-in-out infinite alternate;
}

.flame--moderate::before {
  width: 20px;
  height: 28px;
  background: radial-gradient(ellipse at bottom, rgba(255, 107, 53, 0.7), rgba(255, 0, 100, 0.3), transparent);
  filter: blur(3px);
  animation: streak-flicker 1s ease-in-out infinite alternate;
}

.flame--intense::before {
  width: 24px;
  height: 34px;
  background: radial-gradient(ellipse at bottom, #ff6b35, #ff0064, transparent);
  filter: blur(4px);
  animation: streak-flicker 0.6s ease-in-out infinite alternate;
}
.flame--intense::after {
  width: 14px;
  height: 20px;
  background: radial-gradient(ellipse at bottom, rgba(255, 255, 100, 0.7), transparent);
  filter: blur(2px);
  animation: streak-flicker 0.4s ease-in-out infinite alternate-reverse;
}

.flame--legendary::before {
  width: 30px;
  height: 42px;
  background: radial-gradient(ellipse at bottom, #ff00ff, #ff0064, transparent);
  filter: blur(5px);
  animation: streak-flicker 0.4s ease-in-out infinite alternate;
}
.flame--legendary::after {
  width: 18px;
  height: 26px;
  background: radial-gradient(ellipse at bottom, rgba(0, 255, 255, 0.7), transparent);
  filter: blur(3px);
  animation: streak-flicker 0.3s ease-in-out infinite alternate-reverse;
}

.streak-enhanced__number {
  position: relative;
  z-index: 1;
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--streak-text-color);
  text-shadow: 0 0 8px rgba(255, 107, 53, 0.4);
}

.streak-enhanced--compact .streak-enhanced__number {
  font-size: var(--text-sm);
}

/* Tier-specific number styling */
.streak-enhanced--epic .streak-enhanced__number {
  color: #ff4500;
  text-shadow: 0 0 10px rgba(255, 69, 0, 0.6);
}

.streak-enhanced--legendary .streak-enhanced__number {
  background: linear-gradient(90deg, #00ffff, #ff00ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.streak-enhanced--legendary {
  border-color: rgba(255, 0, 255, 0.4);
  box-shadow: 0 0 12px rgba(255, 0, 255, 0.2);
}

.streak-enhanced__label {
  font-size: var(--text-sm);
  color: var(--gamification-text-secondary);
}

.streak-enhanced__milestone {
  font-size: var(--text-xs);
  padding: 1px 4px;
  background: rgba(var(--neon-orange), 0.15);
  color: rgb(var(--neon-orange));
  border-radius: var(--radius-sm);
  font-weight: var(--font-semibold);
}

/* At-risk: orange pulse warning */
.streak-enhanced--at-risk {
  border-color: rgba(251, 191, 36, 0.5);
  animation: streak-at-risk-pulse 1.5s ease-in-out infinite;
}

.streak-enhanced__warning {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgb(251, 191, 36);
  color: black;
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes streak-flicker {
  from { transform: translateX(-50%) scale(1); opacity: 0.8; }
  to { transform: translateX(-50%) scale(1.15) rotate(2deg); opacity: 1; }
}

@keyframes streak-at-risk-pulse {
  0%, 100% { border-color: rgba(251, 191, 36, 0.3); }
  50% { border-color: rgba(251, 191, 36, 0.7); box-shadow: 0 0 8px rgba(251, 191, 36, 0.2); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .streak-enhanced__flame::before,
  .streak-enhanced__flame::after { animation: none; }
  .streak-enhanced--at-risk { animation: none; }
  .streak-enhanced__warning { animation: none; }
}
</style>
```

### Usage

```vue
<StreakCounterEnhanced :current-streak="45" :is-active-today="true" />
<StreakCounterEnhanced :current-streak="6" :is-active-today="false" streak-at-risk compact />
```

---

## Component 6: Corruption Meter (Horizontal Bar)

A horizontal bar showing the 5 corruption tiers with a position indicator.

### Props Interface

```typescript
interface CorruptionMeterProps {
  level: number               // 0-100
  showTierLabels?: boolean    // default: true
  showLevelText?: boolean     // default: true
  compact?: boolean           // default: false
  animated?: boolean          // default: true
  intensity?: 'minimal' | 'moderate' | 'intense'
}
```

### Complete Implementation

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getCorruptionTier, CORRUPTION_TIERS } from '@/types/challenges'

const props = withDefaults(defineProps<{
  level: number
  showTierLabels?: boolean
  showLevelText?: boolean
  compact?: boolean
  animated?: boolean
  intensity?: 'minimal' | 'moderate' | 'intense'
}>(), {
  showTierLabels: true,
  showLevelText: true,
  compact: false,
  animated: true,
  intensity: 'moderate',
})

const currentTier = computed(() => getCorruptionTier(props.level))

// Glitch effect on level change
const showGlitch = ref(false)
watch(() => props.level, () => {
  if (props.animated && props.intensity !== 'minimal') {
    showGlitch.value = true
    setTimeout(() => { showGlitch.value = false }, 300)
  }
})

const tierColors = ['#00f0ff', '#39ff14', '#ffff00', '#ff8800', '#ff3333']
const tierNames = ['Clean', 'Mild', 'Moderate', 'Heavy', 'Critical']

// Position of the indicator (percentage along the bar)
const indicatorPercent = computed(() => Math.min(100, Math.max(0, props.level)))

// Active tier index (0-4)
const activeTierIndex = computed(() => {
  const idx = CORRUPTION_TIERS.findIndex(t => props.level >= t.minLevel && props.level <= t.maxLevel)
  return idx >= 0 ? idx : 0
})
</script>

<template>
  <div
    class="corruption-meter"
    :class="{
      'corruption-meter--compact': compact,
      'corruption-meter--glitch': showGlitch,
    }"
    role="meter"
    :aria-valuenow="level"
    :aria-valuemin="0"
    :aria-valuemax="100"
    :aria-label="`Corruption: ${level}% (${currentTier.tier})`"
  >
    <!-- Active tier name -->
    <div v-if="showLevelText && !compact" class="corruption-meter__header">
      <span class="corruption-meter__tier-name" :style="{ color: tierColors[activeTierIndex] }">
        {{ tierNames[activeTierIndex] }}
      </span>
      <span class="corruption-meter__level-value">{{ level }}%</span>
    </div>

    <!-- Bar -->
    <div class="corruption-meter__bar">
      <!-- Gradient fill -->
      <div class="corruption-meter__gradient" />

      <!-- Tier boundary lines -->
      <div class="corruption-meter__boundaries">
        <div class="corruption-meter__boundary" style="left: 20%" />
        <div class="corruption-meter__boundary" style="left: 40%" />
        <div class="corruption-meter__boundary" style="left: 60%" />
        <div class="corruption-meter__boundary" style="left: 80%" />
      </div>

      <!-- Position indicator -->
      <div
        class="corruption-meter__indicator"
        :style="{ left: `${indicatorPercent}%` }"
      />
    </div>

    <!-- Tier labels below -->
    <div v-if="showTierLabels && !compact" class="corruption-meter__labels">
      <span
        v-for="(name, i) in tierNames"
        :key="name"
        class="corruption-meter__label"
        :class="{ 'corruption-meter__label--active': i === activeTierIndex }"
        :style="{ color: i === activeTierIndex ? tierColors[i] : undefined }"
      >
        {{ name }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.corruption-meter {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
}

.corruption-meter--compact {
  gap: var(--space-1);
}

.corruption-meter__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.corruption-meter__tier-name {
  font-size: var(--text-sm);
  font-weight: var(--font-bold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.corruption-meter__level-value {
  font-size: var(--text-xs);
  color: var(--gamification-text-secondary);
  font-weight: var(--font-semibold);
}

.corruption-meter__bar {
  position: relative;
  height: 12px;
  border-radius: 6px;
  overflow: visible;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.corruption-meter--compact .corruption-meter__bar {
  height: 8px;
}

.corruption-meter__gradient {
  position: absolute;
  inset: 0;
  border-radius: 6px;
  background: linear-gradient(90deg,
    #00f0ff 0%,     /* Clean: cyan */
    #39ff14 20%,    /* Mild: green */
    #ffff00 40%,    /* Moderate: yellow */
    #ff8800 60%,    /* Heavy: orange */
    #ff3333 80%,    /* Critical: red */
    #cc0000 100%
  );
  opacity: 0.8;
}

.corruption-meter__boundaries {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.corruption-meter__boundary {
  position: absolute;
  top: 0;
  width: 2px;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
}

/* Diamond-shaped indicator */
.corruption-meter__indicator {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  background: white;
  border: 2px solid rgba(0, 0, 0, 0.6);
  transform: translate(-50%, -50%) rotate(45deg);
  z-index: 3;
  transition: left 0.5s ease-out;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.5);
}

.corruption-meter__labels {
  display: flex;
  justify-content: space-between;
}

.corruption-meter__label {
  font-size: 10px;
  color: var(--gamification-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  width: 20%;
  text-align: center;
  opacity: 0.5;
  transition: opacity 0.3s ease;
}

.corruption-meter__label--active {
  opacity: 1;
  font-weight: var(--font-semibold);
}

/* Glitch effect on change */
.corruption-meter--glitch .corruption-meter__bar {
  animation: corruption-glitch 0.3s ease-out;
}

@keyframes corruption-glitch {
  0% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  50% { transform: translateX(3px); }
  75% { transform: translateX(-1px); }
  100% { transform: translateX(0); }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .corruption-meter__indicator { transition: left 0s; }
  .corruption-meter--glitch .corruption-meter__bar { animation: none; }
}
</style>
```

### Usage

```vue
<CorruptionMeter :level="corruptionLevel" />
<CorruptionMeter :level="75" compact :show-tier-labels="false" />
```

---

## Component 7: Mission/Challenge Card (Dossier Style)

Enhanced challenge card with cyberpunk dossier styling.

### Props Interface

```typescript
interface MissionCardProps {
  challenge: Challenge     // from '@/types/challenges'
  compact?: boolean        // default: false
  showNarrative?: boolean  // default: true
  intensity?: 'minimal' | 'moderate' | 'intense'
}
```

### Complete Implementation

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { Challenge } from '@/types/challenges'

const props = withDefaults(defineProps<{
  challenge: Challenge
  compact?: boolean
  showNarrative?: boolean
  intensity?: 'minimal' | 'moderate' | 'intense'
}>(), {
  compact: false,
  showNarrative: true,
  intensity: 'moderate',
})

const emit = defineEmits<{
  click: [challenge: Challenge]
}>()

const progressPercent = computed(() =>
  Math.min(100, Math.round((props.challenge.objectiveCurrent / props.challenge.objectiveTarget) * 100))
)

const timeRemaining = computed(() => {
  const now = new Date()
  const expires = new Date(props.challenge.expiresAt)
  const diff = expires.getTime() - now.getTime()
  if (diff <= 0) return 'Expired'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
})

const isUrgent = computed(() => {
  const diff = new Date(props.challenge.expiresAt).getTime() - Date.now()
  return diff > 0 && diff < 2 * 60 * 60 * 1000 // < 2 hours
})

const difficultyConfig = computed(() => {
  const map: Record<string, { color: string; label: string }> = {
    easy: { color: '#22c55e', label: 'EASY' },
    normal: { color: '#00f0ff', label: 'NORMAL' },
    hard: { color: '#ff8800', label: 'HARD' },
    boss: { color: '#ff3333', label: 'BOSS' },
  }
  return map[props.challenge.difficulty] || map.normal
})

const statusClass = computed(() => {
  switch (props.challenge.status) {
    case 'completed': return 'mission-card--completed'
    case 'failed':
    case 'expired': return 'mission-card--failed'
    default: return 'mission-card--active'
  }
})
</script>

<template>
  <div
    class="mission-card"
    :class="[statusClass, { 'mission-card--compact': compact, 'mission-card--urgent': isUrgent }]"
    @click="emit('click', challenge)"
  >
    <!-- Top row: difficulty + time -->
    <div class="mission-card__top">
      <span class="mission-card__difficulty" :style="{ color: difficultyConfig.color, borderColor: difficultyConfig.color }">
        {{ difficultyConfig.label }}
      </span>
      <span v-if="challenge.status === 'active'" class="mission-card__time" :class="{ 'mission-card__time--urgent': isUrgent }">
        {{ timeRemaining }}
      </span>
      <span v-else-if="challenge.status === 'completed'" class="mission-card__status-badge mission-card__status-badge--complete">
        COMPLETE
      </span>
      <span v-else class="mission-card__status-badge mission-card__status-badge--failed">
        FAILED
      </span>
    </div>

    <!-- Title -->
    <h4 class="mission-card__title">{{ challenge.title }}</h4>

    <!-- Description (terminal style) -->
    <p v-if="!compact" class="mission-card__description">
      {{ challenge.description }}
    </p>

    <!-- Progress bar -->
    <div class="mission-card__progress">
      <div class="mission-card__progress-track">
        <div
          class="mission-card__progress-fill"
          :style="{ width: `${progressPercent}%` }"
          :class="{
            'mission-card__progress-fill--complete': progressPercent >= 100,
          }"
        />
      </div>
      <span class="mission-card__progress-text">
        {{ challenge.objectiveCurrent }}/{{ challenge.objectiveTarget }}
      </span>
    </div>

    <!-- Bottom row: rewards -->
    <div class="mission-card__rewards">
      <span class="mission-card__reward mission-card__reward--xp">
        +{{ challenge.rewardXp }} XP
      </span>
      <span v-if="challenge.penaltyXp > 0 && challenge.status === 'active'" class="mission-card__reward mission-card__reward--penalty">
        -{{ challenge.penaltyXp }} XP
      </span>
    </div>

    <!-- Narrative flavor -->
    <p v-if="showNarrative && !compact && challenge.narrativeFlavor" class="mission-card__narrative">
      "{{ challenge.narrativeFlavor }}"
    </p>
  </div>
</template>

<style scoped>
.mission-card {
  position: relative;
  padding: var(--space-3) var(--space-4);
  background: rgba(var(--color-slate-900), 0.9);
  border: 1px solid rgba(var(--neon-cyan), 0.3);
  clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
  cursor: pointer;
  transition: all 0.2s ease;
}

.mission-card:hover {
  border-color: rgba(var(--neon-cyan), 0.6);
  box-shadow: 0 0 12px rgba(var(--neon-cyan), 0.15);
  transform: translateY(-1px);
}

.mission-card--compact {
  padding: var(--space-2) var(--space-3);
}

/* Status states */
.mission-card--completed {
  border-color: rgba(var(--neon-lime), 0.4);
}
.mission-card--completed:hover {
  border-color: rgba(var(--neon-lime), 0.6);
  box-shadow: 0 0 12px rgba(var(--neon-lime), 0.15);
}

.mission-card--failed {
  border-color: rgba(255, 50, 50, 0.3);
  opacity: 0.7;
}

.mission-card--urgent {
  animation: urgent-pulse 2s ease-in-out infinite;
}

.mission-card__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
}

.mission-card__difficulty {
  font-size: 10px;
  font-weight: var(--font-bold);
  letter-spacing: 0.15em;
  padding: 2px 8px;
  border: 1px solid;
  text-transform: uppercase;
}

.mission-card__time {
  font-size: var(--text-xs);
  color: var(--gamification-text-secondary);
}

.mission-card__time--urgent {
  color: #ff6b35;
  font-weight: var(--font-semibold);
  animation: pulse 1s ease-in-out infinite;
}

.mission-card__status-badge {
  font-size: 10px;
  font-weight: var(--font-bold);
  letter-spacing: 0.1em;
  padding: 2px 6px;
  border-radius: 2px;
}

.mission-card__status-badge--complete {
  background: rgba(var(--neon-lime), 0.2);
  color: rgb(var(--neon-lime));
}

.mission-card__status-badge--failed {
  background: rgba(255, 50, 50, 0.2);
  color: #ff5555;
}

.mission-card__title {
  font-size: var(--text-sm);
  font-weight: var(--font-bold);
  color: var(--gamification-text-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 var(--space-1);
}

.mission-card__description {
  font-size: var(--text-xs);
  color: rgba(var(--neon-cyan), 0.6);
  font-family: 'Space Mono', 'Fira Code', monospace;
  line-height: 1.5;
  margin: 0 0 var(--space-2);
}

.mission-card__progress {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.mission-card__progress-track {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.mission-card__progress-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--xp-bar-gradient);
  transition: width 0.3s ease;
}

.mission-card__progress-fill--complete {
  background: linear-gradient(90deg, rgb(var(--neon-lime)), rgba(var(--neon-cyan), 0.9));
  box-shadow: 0 0 6px rgba(var(--neon-lime), 0.4);
}

.mission-card__progress-text {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--gamification-text-primary);
  min-width: 40px;
  text-align: right;
}

.mission-card__rewards {
  display: flex;
  gap: var(--space-3);
  font-size: var(--text-xs);
}

.mission-card__reward {
  font-weight: var(--font-semibold);
}

.mission-card__reward--xp {
  color: rgba(var(--tier-gold), 1);
}

.mission-card__reward--penalty {
  color: #ff5555;
}

.mission-card__narrative {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  font-style: italic;
  color: rgba(var(--neon-cyan), 0.5);
  line-height: 1.4;
}

@keyframes urgent-pulse {
  0%, 100% { border-color: rgba(var(--neon-cyan), 0.3); }
  50% { border-color: rgba(255, 107, 53, 0.6); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .mission-card { transition: none; }
  .mission-card--urgent { animation: none; }
  .mission-card__time--urgent { animation: none; }
  .mission-card__progress-fill { transition: none; }
}
</style>
```

### Usage

```vue
<MissionCard :challenge="dailyChallenge" />
<MissionCard :challenge="bossChallenge" compact />
```

---

## Component 8: Boss Fight Panel

Dramatic boss fight display with phased HP, countdown timer, and narrative commentary.

### Props Interface

```typescript
interface BossFightPanelEnhancedProps {
  boss: Challenge          // Boss challenge from store
  compact?: boolean        // default: false
  intensity?: 'minimal' | 'moderate' | 'intense'
}
```

### Complete Implementation

```vue
<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { Challenge } from '@/types/challenges'

const props = withDefaults(defineProps<{
  boss: Challenge
  compact?: boolean
  intensity?: 'minimal' | 'moderate' | 'intense'
}>(), {
  compact: false,
  intensity: 'moderate',
})

// HP computation
const maxHp = computed(() => {
  const ctx = props.boss.aiContext as { total_hp?: number } | undefined
  return ctx?.total_hp ?? props.boss.objectiveTarget * 10
})

const damageDealt = computed(() => props.boss.objectiveCurrent * 10)
const currentHp = computed(() => Math.max(0, maxHp.value - damageDealt.value))
const hpPercent = computed(() => maxHp.value > 0 ? (currentHp.value / maxHp.value) * 100 : 0)
const isDefeated = computed(() => props.boss.status === 'completed' || currentHp.value <= 0)

// Phase (1 = full HP, 2 = 66-33%, 3 = <33%)
const phase = computed(() => {
  if (hpPercent.value > 66) return 1
  if (hpPercent.value > 33) return 2
  return 3
})

// ARIA commentary based on phase
const ariaCommentary = computed(() => {
  if (isDefeated.value) return 'Target neutralized. Well executed, Netrunner.'
  switch (phase.value) {
    case 1: return `${props.boss.title} engages. Show it what you are made of.`
    case 2: return 'The target is weakening. Maintain pressure, Netrunner.'
    case 3: return 'Critical damage detected! One final push. Do not relent!'
    default: return ''
  }
})

// Countdown timer
const timeLeft = ref('')
let countdownInterval: ReturnType<typeof setInterval> | null = null

function updateCountdown() {
  const diff = new Date(props.boss.expiresAt).getTime() - Date.now()
  if (diff <= 0) { timeLeft.value = 'TIME UP'; return }
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  timeLeft.value = d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`
}

onMounted(() => {
  updateCountdown()
  countdownInterval = setInterval(updateCountdown, 1000)
})

onUnmounted(() => {
  if (countdownInterval) clearInterval(countdownInterval)
})

const isTimeUrgent = computed(() => {
  const diff = new Date(props.boss.expiresAt).getTime() - Date.now()
  return diff > 0 && diff < 24 * 60 * 60 * 1000 // < 24 hours
})
</script>

<template>
  <div
    class="boss-panel"
    :class="[
      `boss-panel--phase-${phase}`,
      {
        'boss-panel--compact': compact,
        'boss-panel--defeated': isDefeated,
      }
    ]"
  >
    <!-- Dramatic header -->
    <div class="boss-panel__header">
      <h3 class="boss-panel__name" :class="{ 'boss-panel__name--glitch': intensity === 'intense' && !isDefeated }">
        {{ isDefeated ? 'DEFEATED' : boss.title }}
      </h3>
      <div v-if="!isDefeated" class="boss-panel__timer" :class="{ 'boss-panel__timer--urgent': isTimeUrgent }">
        {{ timeLeft }}
      </div>
    </div>

    <!-- Phase indicator -->
    <div v-if="!compact && !isDefeated" class="boss-panel__phase">
      <span
        v-for="p in 3"
        :key="p"
        class="boss-panel__phase-dot"
        :class="{ 'boss-panel__phase-dot--active': p === phase }"
      />
      <span class="boss-panel__phase-label">Phase {{ phase }}/3</span>
    </div>

    <!-- HP Bar (uses HpBar component pattern) -->
    <div class="boss-panel__hp">
      <div class="boss-panel__hp-labels">
        <span>HP</span>
        <span>{{ currentHp }} / {{ maxHp }}</span>
      </div>
      <div class="boss-panel__hp-bar">
        <div class="boss-panel__hp-bar-marker" style="left: 33%" />
        <div class="boss-panel__hp-bar-marker" style="left: 66%" />
        <div
          class="boss-panel__hp-bar-fill"
          :style="{ width: `${hpPercent}%` }"
          :class="{
            'boss-panel__hp-bar-fill--high': hpPercent > 50,
            'boss-panel__hp-bar-fill--mid': hpPercent <= 50 && hpPercent > 25,
            'boss-panel__hp-bar-fill--low': hpPercent <= 25,
          }"
        />
      </div>
    </div>

    <!-- Damage dealt counter -->
    <div class="boss-panel__damage">
      You dealt <strong>{{ damageDealt }}</strong> damage
    </div>

    <!-- XP Reward -->
    <div class="boss-panel__reward">
      Reward: <strong>{{ boss.rewardXp }} XP</strong>
    </div>

    <!-- ARIA Commentary -->
    <p v-if="!compact" class="boss-panel__commentary">
      "{{ ariaCommentary }}"
    </p>

    <!-- Victory banner -->
    <div v-if="isDefeated" class="boss-panel__victory">
      VICTORY
    </div>
  </div>
</template>

<style scoped>
.boss-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: linear-gradient(135deg, rgba(139, 0, 0, 0.15), rgba(20, 20, 30, 0.95));
  border: 2px solid rgba(255, 60, 60, 0.4);
  clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
}

.boss-panel--compact {
  padding: var(--space-3);
  gap: var(--space-2);
}

.boss-panel--defeated {
  border-color: rgba(var(--neon-lime), 0.4);
  background: linear-gradient(135deg, rgba(0, 100, 0, 0.1), rgba(20, 20, 30, 0.95));
}

.boss-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.boss-panel__name {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: #ff4444;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  text-shadow: 0 0 20px rgba(255, 50, 50, 0.5);
  margin: 0;
}

.boss-panel--defeated .boss-panel__name {
  color: rgb(var(--neon-lime));
  text-shadow: 0 0 20px rgba(var(--neon-lime), 0.5);
}

/* Glitch text effect for intense mode */
.boss-panel__name--glitch {
  animation: boss-glitch-text 4s ease-in-out infinite;
}

.boss-panel__timer {
  font-size: var(--text-sm);
  color: var(--gamification-text-secondary);
  font-weight: var(--font-semibold);
}

.boss-panel__timer--urgent {
  color: #ff6b35;
  animation: pulse 1s ease-in-out infinite;
}

.boss-panel__phase {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.boss-panel__phase-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
}

.boss-panel__phase-dot--active {
  background: #ff4444;
  box-shadow: 0 0 6px rgba(255, 60, 60, 0.6);
}

.boss-panel__phase-label {
  font-size: var(--text-xs);
  color: var(--gamification-text-secondary);
}

/* HP bar */
.boss-panel__hp {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.boss-panel__hp-labels {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-xs);
  color: var(--gamification-text-secondary);
  font-weight: var(--font-semibold);
  text-transform: uppercase;
}

.boss-panel__hp-bar {
  position: relative;
  height: 20px;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(255, 60, 60, 0.4);
  overflow: hidden;
}

.boss-panel__hp-bar-marker {
  position: absolute;
  top: 0;
  width: 1px;
  height: 100%;
  background: rgba(255, 255, 255, 0.2);
  z-index: 2;
}

.boss-panel__hp-bar-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  transition: width 0.5s ease-out;
}

.boss-panel__hp-bar-fill--high {
  background: linear-gradient(90deg, #ef4444, #ff6b6b);
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
}

.boss-panel__hp-bar-fill--mid {
  background: linear-gradient(90deg, #f97316, #fbbf24);
  box-shadow: 0 0 8px rgba(249, 115, 22, 0.5);
}

.boss-panel__hp-bar-fill--low {
  background: linear-gradient(90deg, #22c55e, #4ade80);
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
  animation: boss-hp-critical 1s ease-in-out infinite;
}

.boss-panel__damage,
.boss-panel__reward {
  font-size: var(--text-xs);
  color: var(--gamification-text-secondary);
  text-align: center;
}

.boss-panel__damage strong {
  color: rgba(var(--tier-gold), 1);
}

.boss-panel__reward strong {
  color: rgba(var(--neon-cyan), 1);
}

.boss-panel__commentary {
  font-size: var(--text-xs);
  font-style: italic;
  color: rgba(var(--neon-cyan), 0.6);
  text-align: center;
  line-height: 1.4;
}

.boss-panel__victory {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-3);
  background: linear-gradient(135deg, rgba(var(--neon-lime), 0.3), rgba(var(--neon-cyan), 0.2));
  border-radius: var(--radius-md);
  color: rgb(var(--neon-lime));
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  text-transform: uppercase;
  letter-spacing: 0.2em;
  text-shadow: 0 0 20px rgba(var(--neon-lime), 0.6);
  animation: victory-glow 1s ease-in-out infinite alternate;
}

@keyframes boss-glitch-text {
  0%, 94%, 100% { transform: none; text-shadow: 0 0 20px rgba(255, 50, 50, 0.5); }
  95% { transform: translateX(2px) skewX(2deg); text-shadow: -2px 0 #ff0000, 2px 0 #00ffff; }
  96% { transform: translateX(-1px) skewX(-1deg); }
  97% { transform: none; }
}

@keyframes boss-hp-critical {
  0%, 100% { box-shadow: 0 0 8px rgba(34, 197, 94, 0.5); }
  50% { box-shadow: 0 0 16px rgba(34, 197, 94, 0.8); }
}

@keyframes victory-glow {
  from { box-shadow: 0 0 10px rgba(var(--neon-lime), 0.3); }
  to { box-shadow: 0 0 30px rgba(var(--neon-lime), 0.5); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .boss-panel__name--glitch { animation: none; }
  .boss-panel__hp-bar-fill { transition: none; }
  .boss-panel__hp-bar-fill--low { animation: none; }
  .boss-panel__timer--urgent { animation: none; }
  .boss-panel__victory { animation: none; }
}
</style>
```

### Usage

```vue
<BossFightPanelEnhanced :boss="activeBoss" />
<BossFightPanelEnhanced :boss="activeBoss" compact />
```

---

## Component 9: Floating XP Pop-up

Composable + component for floating "+50 XP" notifications that animate upward and fade.

### Composable: `useXpPopup`

```typescript
// src/composables/useXpPopup.ts
import { ref, type Ref } from 'vue'

export interface XpPopupInstance {
  id: number
  amount: number
  x: number
  y: number
  label?: string  // e.g., "Streak Bonus"
}

let nextId = 0

export function useXpPopup() {
  const popups: Ref<XpPopupInstance[]> = ref([])

  /**
   * Show a floating XP pop-up.
   * @param amount - XP amount to display (e.g., 50)
   * @param options.x - X position (px from left). Default: center of viewport
   * @param options.y - Y position (px from top). Default: header area
   * @param options.label - Optional sub-label (e.g., "Streak Bonus")
   */
  function showXpPopup(amount: number, options?: { x?: number; y?: number; label?: string }) {
    const id = nextId++
    const popup: XpPopupInstance = {
      id,
      amount,
      x: options?.x ?? window.innerWidth / 2,
      y: options?.y ?? 80,
      label: options?.label,
    }

    // Stagger vertically if multiple popups exist
    const existingCount = popups.value.length
    if (existingCount > 0) {
      popup.y -= existingCount * 30
    }

    popups.value.push(popup)

    // Auto-remove after animation completes
    setTimeout(() => {
      popups.value = popups.value.filter(p => p.id !== id)
    }, 1500)
  }

  return { popups, showXpPopup }
}
```

### Component: `XpPopup.vue`

```vue
<script setup lang="ts">
import type { XpPopupInstance } from '@/composables/useXpPopup'

defineProps<{
  popups: XpPopupInstance[]
}>()
</script>

<template>
  <Teleport to="body">
    <div
      v-for="popup in popups"
      :key="popup.id"
      class="xp-popup"
      :style="{
        left: `${popup.x}px`,
        top: `${popup.y}px`,
      }"
    >
      <span class="xp-popup__amount">+{{ popup.amount }} XP</span>
      <span v-if="popup.label" class="xp-popup__label">{{ popup.label }}</span>
    </div>
  </Teleport>
</template>

<style scoped>
.xp-popup {
  position: fixed;
  pointer-events: none;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translateX(-50%);
  animation: xp-float 1.5s ease-out forwards;
}

.xp-popup__amount {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: rgba(var(--tier-gold), 1);
  text-shadow:
    0 0 8px rgba(var(--tier-gold), 0.8),
    0 0 16px rgba(var(--tier-gold), 0.4),
    0 1px 3px rgba(0, 0, 0, 0.6);
  white-space: nowrap;
}

.xp-popup__label {
  font-size: var(--text-xs);
  color: rgba(var(--neon-cyan), 0.9);
  text-shadow: 0 0 4px rgba(var(--neon-cyan), 0.4);
  margin-top: 2px;
}

@keyframes xp-float {
  0% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
  30% {
    opacity: 1;
    transform: translateX(-50%) translateY(-20px) scale(1.2);
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) translateY(-60px) scale(0.8);
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .xp-popup {
    animation: xp-float-reduced 1.5s ease-out forwards;
  }
  @keyframes xp-float-reduced {
    0% { opacity: 1; }
    100% { opacity: 0; }
  }
}
</style>
```

### Usage

```vue
<script setup lang="ts">
import { useXpPopup } from '@/composables/useXpPopup'
import XpPopup from '@/components/gamification/XpPopup.vue'

const { popups, showXpPopup } = useXpPopup()

function onTaskComplete() {
  showXpPopup(50, { label: 'Task Complete' })
}
</script>

<template>
  <XpPopup :popups="popups" />
  <button @click="onTaskComplete">Complete Task</button>
</template>
```

---

## Component 10: DiceBear Avatar Integration

Local avatar generation using DiceBear. No CDN dependency.

### Setup

```bash
npm install @dicebear/core @dicebear/collection
```

### Composable: `useAvatar`

```typescript
// src/composables/useAvatar.ts
import { computed, type Ref } from 'vue'

// DiceBear imports (tree-shaken per style)
import { createAvatar } from '@dicebear/core'
import { pixelArt } from '@dicebear/collection'

export function useAvatar(seed: Ref<string> | string, options?: {
  size?: number
  style?: 'pixel-art' | 'bottts'
}) {
  const resolvedSeed = typeof seed === 'string' ? seed : seed
  const size = options?.size ?? 128

  const avatarSvg = computed(() => {
    const seedValue = typeof resolvedSeed === 'string' ? resolvedSeed : resolvedSeed.value
    try {
      const avatar = createAvatar(pixelArt, {
        seed: seedValue,
        size,
      })
      return avatar.toString()
    } catch {
      return null
    }
  })

  const avatarDataUri = computed(() => {
    if (!avatarSvg.value) return null
    return `data:image/svg+xml;utf8,${encodeURIComponent(avatarSvg.value)}`
  })

  return { avatarSvg, avatarDataUri }
}
```

### Component: `PlayerAvatar.vue`

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useAvatar } from '@/composables/useAvatar'

const props = withDefaults(defineProps<{
  userId: string
  size?: number               // px, default: 64
  tierLevel?: number          // for border glow color, default: 1
  showFrame?: boolean         // augmented-ui frame, default: true
  intensity?: 'minimal' | 'moderate' | 'intense'
}>(), {
  size: 64,
  tierLevel: 1,
  showFrame: true,
  intensity: 'moderate',
})

const { avatarSvg, avatarDataUri } = useAvatar(
  computed(() => props.userId),
  { size: props.size }
)

const tierGlow = computed(() => {
  if (props.tierLevel <= 10) return 'var(--tier-glow-bronze)'
  if (props.tierLevel <= 20) return 'var(--tier-glow-silver)'
  if (props.tierLevel <= 30) return 'var(--tier-glow-gold)'
  return 'var(--tier-glow-platinum)'
})

const tierBorderColor = computed(() => {
  if (props.tierLevel <= 10) return 'rgba(var(--tier-bronze), 0.6)'
  if (props.tierLevel <= 20) return 'rgba(var(--tier-silver), 0.6)'
  if (props.tierLevel <= 30) return 'rgba(var(--tier-gold), 0.6)'
  return 'rgba(var(--tier-platinum), 0.6)'
})
</script>

<template>
  <div
    class="player-avatar"
    :class="{ 'player-avatar--framed': showFrame }"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      '--avatar-glow': tierGlow,
      '--avatar-border-color': tierBorderColor,
    }"
    :title="`Player avatar`"
  >
    <!-- DiceBear avatar -->
    <img
      v-if="avatarDataUri"
      :src="avatarDataUri"
      :width="size"
      :height="size"
      alt="Player avatar"
      class="player-avatar__img"
    />
    <!-- Fallback: geometric pattern -->
    <div v-else class="player-avatar__fallback">
      <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`">
        <rect width="100%" height="100%" fill="rgba(var(--neon-cyan), 0.1)" />
        <circle :cx="size/2" :cy="size/2" :r="size/4" fill="rgba(var(--neon-cyan), 0.3)" />
        <polygon :points="`${size/2},${size*0.15} ${size*0.85},${size*0.85} ${size*0.15},${size*0.85}`" fill="rgba(var(--neon-magenta), 0.2)" />
      </svg>
    </div>

    <!-- Corner-cut frame overlay -->
    <div v-if="showFrame" class="player-avatar__frame" />
  </div>
</template>

<style scoped>
.player-avatar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  user-select: none;
}

.player-avatar--framed {
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  border: 2px solid var(--avatar-border-color, rgba(var(--neon-cyan), 0.4));
  box-shadow: var(--avatar-glow, var(--neon-glow-cyan));
}

.player-avatar__img {
  display: block;
  image-rendering: pixelated; /* Crisp pixel art */
}

.player-avatar__fallback {
  display: flex;
  align-items: center;
  justify-content: center;
}

.player-avatar__frame {
  position: absolute;
  inset: 0;
  border: 1px solid var(--avatar-border-color, rgba(var(--neon-cyan), 0.3));
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  pointer-events: none;
}
</style>
```

### Usage

```vue
<PlayerAvatar :user-id="authStore.userId" :tier-level="currentLevel" :size="96" />
<PlayerAvatar user-id="guest" :size="32" :show-frame="false" />
```

---

## Component 11: Loot Drop / Reward Reveal

Card flip animation revealing a reward item with rarity glow.

### Props Interface

```typescript
type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

interface LootRevealProps {
  itemName: string
  itemDescription?: string
  rarity: Rarity
  xpReward?: number
  revealed?: boolean          // default: false, triggers reveal
  intensity?: 'minimal' | 'moderate' | 'intense'
}
```

### Rarity Colors

```typescript
const RARITY_CONFIG: Record<Rarity, { color: string; glow: string; label: string }> = {
  common:    { color: '#ffffff', glow: '0 0 8px rgba(255,255,255,0.3)',   label: 'Common' },
  uncommon:  { color: '#22c55e', glow: '0 0 12px rgba(34,197,94,0.5)',    label: 'Uncommon' },
  rare:      { color: '#3b82f6', glow: '0 0 16px rgba(59,130,246,0.5)',   label: 'Rare' },
  epic:      { color: '#a855f7', glow: '0 0 20px rgba(168,85,247,0.6)',   label: 'Epic' },
  legendary: { color: '#fbbf24', glow: '0 0 24px rgba(251,191,36,0.7), 0 0 48px rgba(251,191,36,0.3)', label: 'Legendary' },
}
```

### Complete Implementation

```vue
<script setup lang="ts">
import { ref, watch, computed } from 'vue'

type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

const props = withDefaults(defineProps<{
  itemName: string
  itemDescription?: string
  rarity: Rarity
  xpReward?: number
  revealed?: boolean
  intensity?: 'minimal' | 'moderate' | 'intense'
}>(), {
  revealed: false,
  intensity: 'moderate',
})

const emit = defineEmits<{
  revealed: []
}>()

const RARITY_CONFIG = {
  common:    { color: '#ffffff', glow: '0 0 8px rgba(255,255,255,0.3)', label: 'Common' },
  uncommon:  { color: '#22c55e', glow: '0 0 12px rgba(34,197,94,0.5)', label: 'Uncommon' },
  rare:      { color: '#3b82f6', glow: '0 0 16px rgba(59,130,246,0.5)', label: 'Rare' },
  epic:      { color: '#a855f7', glow: '0 0 20px rgba(168,85,247,0.6)', label: 'Epic' },
  legendary: { color: '#fbbf24', glow: '0 0 24px rgba(251,191,36,0.7), 0 0 48px rgba(251,191,36,0.3)', label: 'Legendary' },
} as const

const config = computed(() => RARITY_CONFIG[props.rarity])

const isFlipped = ref(false)
const showParticles = ref(false)

watch(() => props.revealed, (val) => {
  if (val && !isFlipped.value) {
    isFlipped.value = true
    setTimeout(() => {
      showParticles.value = true
      emit('revealed')
    }, 400) // After flip midpoint
    setTimeout(() => {
      showParticles.value = false
    }, 2000)
  }
})

function triggerReveal() {
  if (!isFlipped.value) {
    isFlipped.value = true
    setTimeout(() => {
      showParticles.value = true
      emit('revealed')
    }, 400)
    setTimeout(() => {
      showParticles.value = false
    }, 2000)
  }
}
</script>

<template>
  <div class="loot-reveal" :class="`loot-reveal--${rarity}`" @click="triggerReveal">
    <div class="loot-card" :class="{ 'loot-card--flipped': isFlipped }">
      <!-- Card back -->
      <div class="loot-card__back">
        <div class="loot-card__back-pattern">?</div>
      </div>

      <!-- Card front (revealed) -->
      <div
        class="loot-card__front"
        :style="{ '--rarity-color': config.color, '--rarity-glow': config.glow }"
      >
        <span class="loot-card__rarity-label">{{ config.label }}</span>
        <h4 class="loot-card__name">{{ itemName }}</h4>
        <p v-if="itemDescription" class="loot-card__description">{{ itemDescription }}</p>
        <span v-if="xpReward" class="loot-card__xp">+{{ xpReward }} XP</span>
      </div>
    </div>

    <!-- Particle burst on reveal -->
    <div v-if="showParticles && intensity !== 'minimal'" class="loot-particles" aria-hidden="true">
      <span v-for="i in 12" :key="i" class="loot-particle" :style="{ '--angle': `${i * 30}deg`, '--delay': `${i * 0.05}s`, '--rarity-color': config.color }" />
    </div>
  </div>
</template>

<style scoped>
.loot-reveal {
  position: relative;
  width: 180px;
  height: 240px;
  perspective: 800px;
  cursor: pointer;
}

.loot-card {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  transform-style: preserve-3d;
}

.loot-card--flipped {
  transform: rotateY(180deg);
}

.loot-card__back,
.loot-card__front {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.loot-card__back {
  background: linear-gradient(135deg, rgba(var(--color-slate-800), 0.9), rgba(var(--color-slate-900), 0.95));
  border: 2px solid rgba(var(--neon-cyan), 0.3);
}

.loot-card__back-pattern {
  font-size: 3rem;
  font-weight: var(--font-bold);
  color: rgba(var(--neon-cyan), 0.5);
  text-shadow: 0 0 20px rgba(var(--neon-cyan), 0.3);
}

.loot-card__front {
  transform: rotateY(180deg);
  background: linear-gradient(135deg, rgba(var(--color-slate-800), 0.95), rgba(0, 0, 0, 0.9));
  border: 2px solid var(--rarity-color);
  box-shadow: var(--rarity-glow);
}

.loot-card__rarity-label {
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  color: var(--rarity-color);
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin-bottom: var(--space-2);
}

.loot-card__name {
  font-size: var(--text-base);
  font-weight: var(--font-bold);
  color: var(--gamification-text-primary);
  text-align: center;
  margin: 0 0 var(--space-2);
}

.loot-card__description {
  font-size: var(--text-xs);
  color: var(--gamification-text-secondary);
  text-align: center;
  line-height: 1.4;
}

.loot-card__xp {
  margin-top: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--font-bold);
  color: rgba(var(--tier-gold), 1);
  text-shadow: 0 0 6px rgba(var(--tier-gold), 0.5);
}

/* Particle burst */
.loot-particles {
  position: absolute;
  top: 50%;
  left: 50%;
  pointer-events: none;
}

.loot-particle {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--rarity-color);
  box-shadow: 0 0 4px var(--rarity-color);
  animation: particle-burst 0.8s ease-out var(--delay) forwards;
  opacity: 0;
}

@keyframes particle-burst {
  0% {
    opacity: 1;
    transform: translate(0, 0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(
      calc(cos(var(--angle)) * 80px),
      calc(sin(var(--angle)) * 80px)
    ) scale(0);
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .loot-card { transition: none; }
  .loot-card--flipped { transform: none; }
  .loot-card--flipped .loot-card__back { display: none; }
  .loot-card--flipped .loot-card__front { transform: none; }
  .loot-particle { animation: none; }
}
</style>
```

### Usage

```vue
<LootReveal
  item-name="Neon Grid Theme"
  item-description="A glowing cyan grid background"
  rarity="rare"
  :xp-reward="100"
  :revealed="showReward"
  @revealed="onRewardRevealed"
/>
```

---

## General Patterns

### Reduced Motion Fallback Pattern

Every component MUST include:

```css
@media (prefers-reduced-motion: reduce) {
  /* Disable all animations */
  .animated-element { animation: none; }
  /* Remove transitions */
  .transitioning-element { transition: none; }
  /* Ensure content is still visible */
  .fading-element { opacity: 1; }
}
```

### Intensity Level Pattern

Components should accept `intensity` prop and adjust visuals:

```typescript
const props = withDefaults(defineProps<{
  intensity?: 'minimal' | 'moderate' | 'intense'
}>(), {
  intensity: 'moderate',
})
```

| Level | Animations | Glows | Particles | Sound cue |
|-------|-----------|-------|-----------|-----------|
| `minimal` | Disabled | Subtle/none | Disabled | Disabled |
| `moderate` | Standard | Medium | Standard | Enabled |
| `intense` | Enhanced + shake | Strong + bleed | Extra particles | Enhanced |

### File Organization

All new gamification components go in `src/components/gamification/`.
All new composables go in `src/composables/`.

```
src/components/gamification/
  HpBar.vue
  XpBarEnhanced.vue
  RadarChart.vue
  LevelBadgeTiered.vue
  StreakCounterEnhanced.vue
  CorruptionMeter.vue
  MissionCard.vue
  BossFightPanelEnhanced.vue
  XpPopup.vue
  PlayerAvatar.vue
  LootReveal.vue

src/composables/
  useXpPopup.ts
  useAvatar.ts
```

### Sound Cue Integration Points

Components expose integration points for sound effects but do NOT implement audio directly. Sound is handled by the settings store:

```typescript
// Pattern for adding sound cue integration
const emit = defineEmits<{
  soundCue: [type: 'damage' | 'levelup' | 'achievement' | 'loot-reveal' | 'xp-gain']
}>()
```

The parent component maps these to actual audio playback based on `gamificationSettings.soundEnabled`.
