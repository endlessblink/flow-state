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
}>(), {
  size: 200,
})

const labels = ['Focus', 'Speed', 'Consistency', 'Depth', 'Endurance'] as const
const statKeys = ['focus', 'speed', 'consistency', 'depth', 'endurance'] as const

const center = computed(() => props.size / 2)
const maxRadius = computed(() => props.size * 0.35)
const labelRadius = computed(() => props.size * 0.45)
const angleStep = (2 * Math.PI) / 5

const animationProgress = ref(0)

onMounted(() => {
  requestAnimationFrame(() => {
    animationProgress.value = 1
  })
})

function getPoint(index: number, radius: number): { x: number; y: number } {
  const angle = index * angleStep - Math.PI / 2
  return {
    x: center.value + Math.cos(angle) * radius,
    y: center.value + Math.sin(angle) * radius,
  }
}

function getPentagonPoints(radius: number): string {
  return Array.from({ length: 5 }, (_, i) => {
    const pt = getPoint(i, radius)
    return `${pt.x},${pt.y}`
  }).join(' ')
}

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

const gridLevels = 5
</script>

<template>
  <svg
    :width="size"
    :height="size"
    :viewBox="`0 0 ${size} ${size}`"
    class="stats-radar"
    role="img"
    :aria-label="`Player stats: Focus ${stats.focus}, Speed ${stats.speed}, Consistency ${stats.consistency}, Depth ${stats.depth}, Endurance ${stats.endurance}`"
  >
    <!-- Concentric pentagon grid lines -->
    <polygon
      v-for="level in gridLevels"
      :key="`grid-${level}`"
      :points="getPentagonPoints((level * maxRadius) / gridLevels)"
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
      class="stats-radar__data"
    />

    <!-- Data point circles -->
    <circle
      v-for="(point, i) in dataPointsArray"
      :key="`pt-${i}`"
      :cx="point.x"
      :cy="point.y"
      r="4"
      class="stats-radar__point"
    />

    <!-- Labels -->
    <text
      v-for="(label, i) in labels"
      :key="`label-${i}`"
      :x="getLabelPoint(i).x"
      :y="getLabelPoint(i).y"
      font-size="11"
      font-weight="600"
      text-anchor="middle"
      dominant-baseline="middle"
      class="stats-radar__label"
      :style="{ fontSize: size < 160 ? 'var(--text-2xs)' : 'var(--text-xs)' }"
    >
      {{ label }}
    </text>
  </svg>
</template>

<style scoped>
.stats-radar {
  filter: drop-shadow(0 0 4px var(--cf-purple-50));
}

.stats-radar__data {
  fill: var(--cf-purple-20);
  stroke: var(--cf-magenta);
  stroke-width: 2;
  transition: all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.stats-radar__point {
  fill: var(--cf-magenta);
  stroke: rgba(var(--color-slate-50), 0.8);
  stroke-width: 1.5;
  filter: drop-shadow(0 0 var(--space-0_5) var(--cf-magenta-50));
  transition: all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.stats-radar__label {
  fill: var(--cf-cyan);
  font-family: var(--font-cyber-data);
  letter-spacing: 0.02em;
  text-shadow: 0 0 4px var(--cf-cyan-50);
}

@media (prefers-reduced-motion: reduce) {
  .stats-radar__data,
  .stats-radar__point {
    transition: none;
  }
}
</style>
