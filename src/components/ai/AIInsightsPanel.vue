<template>
  <div class="insights-panel">
    <div class="insights-scroll">
      <!-- Section A: Memory Observations -->
      <section class="insights-section">
        <div class="section-header">
          <div class="section-title-row">
            <Brain :size="18" class="section-icon" />
            <h3 class="section-title">
              Memory Observations
            </h3>
            <div v-if="observations.length > 0" class="view-toggle">
              <button
                class="toggle-btn"
                :class="{ active: viewMode === 'list' }"
                title="List view"
                @click="viewMode = 'list'"
              >
                <List :size="14" />
              </button>
              <button
                class="toggle-btn"
                :class="{ active: viewMode === 'graph' }"
                title="Graph view"
                @click="viewMode = 'graph'"
              >
                <Network :size="14" />
              </button>
            </div>
          </div>
          <span v-if="observations.length > 0" class="section-count">
            {{ observations.length }} observation{{ observations.length !== 1 ? 's' : '' }} from your work patterns
          </span>
        </div>

        <!-- List View -->
        <div v-if="observations.length > 0 && viewMode === 'list'" class="obs-list">
          <div v-for="(obs, i) in observations" :key="i" class="obs-card">
            <div class="obs-main">
              <span class="obs-entity">{{ formatEntity(obs.entity) }}</span>
              <span class="obs-relation">{{ formatRelation(obs.relation) }}</span>
              <span class="obs-value">{{ obs.value }}</span>
            </div>
            <div class="obs-meta">
              <div class="confidence-bar">
                <div class="confidence-fill" :style="{ width: (obs.confidence * 100) + '%' }" />
              </div>
              <span class="obs-source">{{ obs.source.replace(/_/g, ' ') }}</span>
            </div>
          </div>
        </div>

        <!-- Graph View -->
        <div v-else-if="observations.length > 0 && viewMode === 'graph'" class="graph-container">
          <svg
            ref="graphSvg"
            class="graph-svg"
            viewBox="0 0 700 400"
            preserveAspectRatio="xMidYMid meet"
          >
            <!-- Edges -->
            <g class="graph-edges">
              <path
                v-for="(edge, i) in graphEdges"
                :key="'e' + i"
                :d="getEdgePath(edge)"
                class="graph-edge"
                :style="{ opacity: 0.15 + edge.confidence * 0.35 }"
              />
              <text
                v-for="(edge, i) in graphEdges"
                :key="'el' + i"
                :x="getEdgeMidpoint(edge).x"
                :y="getEdgeMidpoint(edge).y"
                class="edge-label"
              >
                {{ edge.label }}
              </text>
            </g>

            <!-- Nodes -->
            <g
              v-for="node in graphNodes"
              :key="node.id"
              class="graph-node"
              :class="{ hovered: hoveredNode === node.id }"
              @mouseenter="(e: MouseEvent) => handleNodeHover(node.id, e)"
              @mouseleave="handleNodeLeave"
            >
              <!-- Glow circle -->
              <circle
                :cx="node.x"
                :cy="node.y"
                :r="node.radius + 4"
                :fill="node.color"
                :opacity="hoveredNode === node.id ? 0.2 : 0.08"
              />
              <!-- Main circle -->
              <circle
                :cx="node.x"
                :cy="node.y"
                :r="node.radius"
                :fill="node.type === 'center' ? node.color : 'transparent'"
                :stroke="node.color"
                :stroke-width="node.type === 'center' ? 0 : 2"
                class="node-circle"
              />
              <!-- Label -->
              <text
                :x="node.x"
                :y="node.y + (node.type === 'center' ? 1 : node.radius + 14)"
                class="node-label"
                :class="{ 'center-label': node.type === 'center' }"
              >
                {{ node.label }}
              </text>
            </g>
          </svg>

          <!-- Tooltip -->
          <div
            v-if="tooltipObs"
            class="graph-tooltip"
            :style="{ left: tooltipPos.x + 'px', top: tooltipPos.y + 'px' }"
          >
            <div class="tooltip-relation">
              {{ formatRelation(tooltipObs.relation) }}
            </div>
            <div class="tooltip-value">
              {{ tooltipObs.value }}
            </div>
            <div class="tooltip-meta">
              {{ Math.round(tooltipObs.confidence * 100) }}% confidence · {{ tooltipObs.source.replace(/_/g, ' ') }}
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <Brain :size="32" class="empty-icon" />
          <p class="empty-text">
            No observations yet
          </p>
          <p class="empty-hint">
            Use the Weekly Plan and Pomodoro timer to let FlowState learn your patterns.
          </p>
        </div>

        <button
          v-if="observations.length > 0"
          class="action-btn danger-btn"
          @click="handleClearMemories"
        >
          <Trash2 :size="14" />
          Clear Memories
        </button>
      </section>

      <!-- Section B: Learned Metrics -->
      <section class="insights-section">
        <div class="section-header">
          <div class="section-title-row">
            <TrendingUp :size="18" class="section-icon" />
            <h3 class="section-title">
              Learned Metrics
            </h3>
          </div>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <span class="metric-label">Avg Work/Day</span>
            <span class="metric-value">
              {{ profile?.avgWorkMinutesPerDay ? Math.round(profile.avgWorkMinutesPerDay) + ' min' : '--' }}
            </span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Avg Tasks/Day</span>
            <span class="metric-value">
              {{ profile?.avgTasksCompletedPerDay ? profile.avgTasksCompletedPerDay.toFixed(1) : '--' }}
            </span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Plan Accuracy</span>
            <span class="metric-value">
              {{ profile?.avgPlanAccuracy ? profile.avgPlanAccuracy.toFixed(0) + '%' : '--' }}
            </span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Peak Days</span>
            <span class="metric-value">
              {{ profile?.peakProductivityDays?.length ? profile.peakProductivityDays.map(capitalize).join(', ') : '--' }}
            </span>
          </div>
        </div>

        <div class="metrics-actions">
          <button class="action-btn primary-btn" :disabled="isRecalculating" @click="handleRecalculate">
            <Loader2 v-if="isRecalculating" :size="14" class="spin" />
            <RefreshCw v-else :size="14" />
            Recalculate
          </button>
          <button class="action-btn ghost-btn" :disabled="isResetting" @click="handleResetProfile">
            <Loader2 v-if="isResetting" :size="14" class="spin" />
            <RotateCcw v-else :size="14" />
            Reset Profile
          </button>
        </div>
        <p v-if="statusMessage" class="status-message" :class="[statusType]">
          {{ statusMessage }}
        </p>
      </section>

      <!-- Section C: Weekly History -->
      <section v-if="weeklyHistory.length > 0" class="insights-section">
        <div class="section-header">
          <div class="section-title-row">
            <BarChart3 :size="18" class="section-icon" />
            <h3 class="section-title">
              Weekly History
            </h3>
          </div>
          <span class="section-count">Last {{ weeklyHistory.length }} week{{ weeklyHistory.length !== 1 ? 's' : '' }}</span>
        </div>

        <div class="history-list">
          <div v-for="(week, i) in weeklyHistory" :key="i" class="history-row">
            <span class="history-week">{{ formatWeekStart(week.weekStart) }}</span>
            <div class="history-bars">
              <div class="bar-track">
                <div class="bar-planned" :style="{ width: barWidth(week.plannedCount) }" />
                <div class="bar-completed" :style="{ width: barWidth(week.completedCount) }" />
              </div>
            </div>
            <span class="history-stats">
              {{ week.completedCount }}/{{ week.plannedCount }}
              <span class="history-accuracy">{{ week.accuracy.toFixed(0) }}%</span>
            </span>
          </div>
        </div>

        <div class="history-legend">
          <span class="legend-item">
            <span class="legend-dot legend-planned" />
            Planned
          </span>
          <span class="legend-item">
            <span class="legend-dot legend-completed" />
            Completed
          </span>
        </div>
      </section>

      <!-- Learning disabled notice -->
      <div v-if="!aiLearningEnabled" class="learning-disabled-notice">
        <AlertTriangle :size="16" />
        <span>AI learning is disabled. Enable it in Settings to start building your work profile.</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * FEATURE-1317 Phase 2B: AI Insights Panel
 *
 * Read-only dashboard showing AI-learned work patterns:
 * - Memory observations (knowledge graph)
 * - Learned capacity metrics
 * - Weekly planning history
 */

import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useWorkProfile } from '@/composables/useWorkProfile'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import type { MemoryObservation } from '@/utils/supabaseMappers'
import {
  Brain, TrendingUp, BarChart3, Trash2, RefreshCw,
  RotateCcw, Loader2, AlertTriangle, Network, List,
} from 'lucide-vue-next'

const { profile, loadProfile, reloadProfile, computeCapacityMetrics, resetLearnedData } = useWorkProfile()
const settingsStore = useSettingsStore()
const authStore = useAuthStore()

const isRecalculating = ref(false)
const isResetting = ref(false)
const statusMessage = ref('')
const statusType = ref<'success' | 'warning' | 'error'>('success')
let statusTimer: ReturnType<typeof setTimeout> | null = null

function showStatus(message: string, type: 'success' | 'warning' | 'error' = 'success') {
  statusMessage.value = message
  statusType.value = type
  if (statusTimer) clearTimeout(statusTimer)
  statusTimer = setTimeout(() => { statusMessage.value = '' }, 5000)
}

const aiLearningEnabled = computed(() => settingsStore.aiLearningEnabled)

const observations = computed<MemoryObservation[]>(() =>
  (profile.value?.memoryGraph || [])
    .sort((a, b) => b.confidence - a.confidence)
)

const weeklyHistory = computed(() =>
  (profile.value?.weeklyHistory || []).slice().reverse()
)

function formatEntity(entity: string): string {
  if (entity.startsWith('project:')) return entity.replace('project:', '')
  if (entity.startsWith('day:')) return capitalize(entity.replace('day:', ''))
  if (entity.startsWith('tasktype:')) return entity.replace('tasktype:', '')
  return entity
}

function formatRelation(relation: string): string {
  return relation.replace(/_/g, ' ')
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function barWidth(count: number): string {
  const maxCount = Math.max(
    ...weeklyHistory.value.map(w => Math.max(w.plannedCount, w.completedCount)),
    1
  )
  return ((count / maxCount) * 100) + '%'
}

async function handleRecalculate() {
  if (!authStore.isAuthenticated) {
    showStatus('Sign in to use this feature', 'warning')
    return
  }
  isRecalculating.value = true
  try {
    await loadProfile()
    const result = await computeCapacityMetrics()
    await reloadProfile()
    if (result.dataSources.length === 0) {
      showStatus('No data found in the last 28 days. Complete some tasks or timer sessions first.', 'warning')
    } else {
      const parts: string[] = []
      if (result.avgMinutesPerDay !== null) parts.push(`${Math.round(result.avgMinutesPerDay)} min/day`)
      if (result.avgTasksPerDay !== null) parts.push(`${result.avgTasksPerDay.toFixed(1)} tasks/day`)
      const sources = result.dataSources.join(' + ')
      const obsCount = (profile.value?.memoryGraph || []).length
      showStatus(`Updated from ${sources}: ${parts.join(', ')} · ${obsCount} observations generated`, 'success')
    }
  } catch (e) {
    console.warn('[AIInsights] Recalculate failed:', e)
    showStatus('Recalculation failed — check console for details', 'error')
  } finally {
    isRecalculating.value = false
  }
}

async function handleResetProfile() {
  if (!authStore.isAuthenticated) {
    showStatus('Sign in to use this feature', 'warning')
    return
  }
  isResetting.value = true
  try {
    await resetLearnedData()
    await reloadProfile()
    showStatus('Profile data cleared', 'success')
  } catch (e) {
    console.warn('[AIInsights] Reset failed:', e)
    showStatus('Reset failed — check console for details', 'error')
  } finally {
    isResetting.value = false
  }
}

async function handleClearMemories() {
  if (!authStore.isAuthenticated) {
    showStatus('Sign in to use this feature', 'warning')
    return
  }
  try {
    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()
    await db.saveWorkProfile({ memoryGraph: [] })
    await reloadProfile()
    showStatus('Memories cleared', 'success')
  } catch (e) {
    console.warn('[AIInsights] Clear memories failed:', e)
    showStatus('Clear failed — check console for details', 'error')
  }
}

// --- Graph View ---
const viewMode = ref<'list' | 'graph'>('list')
const graphSvg = ref<SVGSVGElement | null>(null)
const hoveredNode = ref<string | null>(null)
const tooltipObs = ref<MemoryObservation | null>(null)
const tooltipPos = ref({ x: 0, y: 0 })

interface GraphNode {
  id: string
  label: string
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  type: 'center' | 'entity'
  pinned?: boolean
}

interface GraphEdge {
  source: string
  target: string
  label: string
  obs: MemoryObservation
  confidence: number
}

const graphNodes = ref<GraphNode[]>([])
const graphEdges = ref<GraphEdge[]>([])
let animFrame: number | null = null

const RELATION_COLORS: Record<string, string> = {
  'peak_productivity': '#4ECDC4',
  'completion_rate': '#4ECDC4',
  'avg_completion_speed': '#4ECDC4',
  'reliable_planner': '#4ECDC4',
  'most_active': '#3db8af',
  'overdue_pattern': '#ff9f43',
  'backlog_heavy': '#ff9f43',
  'high_wip': '#ff9f43',
  'underestimates': '#ff9f43',
  'capacity_gap': '#ff9f43',
  'stale': '#ff5555',
  'frequently_missed': '#ff5555',
  'overestimates': '#ff9f43',
  'overplans': '#ff9f43',
}

function getNodeColor(obs: MemoryObservation): string {
  return RELATION_COLORS[obs.relation] || '#4ECDC4'
}

function buildGraph() {
  if (observations.value.length === 0) return

  const W = 700
  const H = 400
  const cx = W / 2
  const cy = H / 2

  const nodeMap = new Map<string, GraphNode>()
  const edges: GraphEdge[] = []

  // Center node: "You"
  nodeMap.set('user', {
    id: 'user',
    label: 'You',
    x: cx,
    y: cy,
    vx: 0,
    vy: 0,
    radius: 28,
    color: '#4ECDC4',
    type: 'center',
    pinned: true,
  })

  // Build entity nodes from observations
  for (const obs of observations.value) {
    const entityId = obs.entity
    if (!nodeMap.has(entityId)) {
      const angle = Math.random() * Math.PI * 2
      const dist = 120 + Math.random() * 80
      nodeMap.set(entityId, {
        id: entityId,
        label: formatEntity(entityId),
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        radius: 12 + obs.confidence * 14,
        color: getNodeColor(obs),
        type: 'entity',
      })
    }

    // Edge from entity's source to entity
    const sourceId = entityId === 'user' ? 'user' : 'user'
    if (entityId !== 'user') {
      edges.push({
        source: sourceId,
        target: entityId,
        label: formatRelation(obs.relation),
        obs,
        confidence: obs.confidence,
      })
    }
  }

  graphNodes.value = Array.from(nodeMap.values())
  graphEdges.value = edges
}

function runForceSimulation() {
  const nodes = graphNodes.value
  if (nodes.length === 0) return

  const W = 700
  const H = 400
  const centerX = W / 2
  const centerY = H / 2

  // Force simulation tick
  for (let iter = 0; iter < 3; iter++) {
    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        let dx = b.x - a.x
        let dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const minDist = a.radius + b.radius + 40
        if (dist < minDist) {
          const force = (minDist - dist) / dist * 0.15
          dx *= force
          dy *= force
          if (!a.pinned) { a.vx -= dx; a.vy -= dy }
          if (!b.pinned) { b.vx += dx; b.vy += dy }
        }
      }
    }

    // Attraction along edges
    for (const edge of graphEdges.value) {
      const source = nodes.find(n => n.id === edge.source)
      const target = nodes.find(n => n.id === edge.target)
      if (!source || !target) continue
      const dx = target.x - source.x
      const dy = target.y - source.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const ideal = 140 + (1 - edge.confidence) * 60
      const force = (dist - ideal) / dist * 0.04
      if (!source.pinned) { source.vx += dx * force; source.vy += dy * force }
      if (!target.pinned) { target.vx -= dx * force; target.vy -= dy * force }
    }

    // Centering gravity
    for (const node of nodes) {
      if (node.pinned) continue
      node.vx += (centerX - node.x) * 0.005
      node.vy += (centerY - node.y) * 0.005
    }

    // Apply velocity with damping
    for (const node of nodes) {
      if (node.pinned) continue
      node.vx *= 0.85
      node.vy *= 0.85
      node.x += node.vx
      node.y += node.vy
      // Clamp to bounds
      node.x = Math.max(node.radius + 4, Math.min(W - node.radius - 4, node.x))
      node.y = Math.max(node.radius + 4, Math.min(H - node.radius - 4, node.y))
    }
  }

  animFrame = requestAnimationFrame(runForceSimulation)
}

function startSimulation() {
  buildGraph()
  if (animFrame) cancelAnimationFrame(animFrame)
  animFrame = requestAnimationFrame(runForceSimulation)
}

function stopSimulation() {
  if (animFrame) {
    cancelAnimationFrame(animFrame)
    animFrame = null
  }
}

function handleNodeHover(nodeId: string, event: MouseEvent) {
  hoveredNode.value = nodeId
  // Find observation for this node
  const obs = observations.value.find(o => o.entity === nodeId)
  tooltipObs.value = obs || null
  const svgRect = graphSvg.value?.getBoundingClientRect()
  if (svgRect) {
    tooltipPos.value = { x: event.clientX - svgRect.left, y: event.clientY - svgRect.top - 10 }
  }
}

function handleNodeLeave() {
  hoveredNode.value = null
  tooltipObs.value = null
}

function getEdgePath(edge: GraphEdge): string {
  const source = graphNodes.value.find(n => n.id === edge.source)
  const target = graphNodes.value.find(n => n.id === edge.target)
  if (!source || !target) return ''
  return `M ${source.x} ${source.y} L ${target.x} ${target.y}`
}

function getEdgeMidpoint(edge: GraphEdge): { x: number; y: number } {
  const source = graphNodes.value.find(n => n.id === edge.source)
  const target = graphNodes.value.find(n => n.id === edge.target)
  if (!source || !target) return { x: 0, y: 0 }
  return { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 - 8 }
}

watch(viewMode, (mode) => {
  if (mode === 'graph') {
    nextTick(() => startSimulation())
  } else {
    stopSimulation()
  }
})

watch(observations, () => {
  if (viewMode.value === 'graph') {
    nextTick(() => startSimulation())
  }
})

onMounted(async () => {
  await loadProfile()
})

onUnmounted(() => {
  stopSimulation()
})
</script>

<style scoped>
.insights-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.insights-scroll {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
}

/* Section */
.insights-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
}

.section-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.section-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.section-icon {
  color: var(--brand-primary);
  flex-shrink: 0;
}

.section-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.section-count {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* Observations */
.obs-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.obs-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
}

.obs-main {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  flex-wrap: wrap;
  font-size: var(--text-sm);
}

.obs-entity {
  font-weight: var(--font-semibold);
  color: var(--brand-primary);
}

.obs-relation {
  color: var(--text-muted);
  font-style: italic;
}

.obs-value {
  color: var(--text-secondary);
}

.obs-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.confidence-bar {
  width: 60px;
  height: 4px;
  background: var(--glass-bg-medium);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.confidence-fill {
  height: 100%;
  background: var(--brand-primary);
  border-radius: var(--radius-full);
  transition: width var(--duration-normal) ease;
}

.obs-source {
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-transform: capitalize;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-8);
  text-align: center;
}

.empty-icon {
  color: var(--text-muted);
  opacity: 0.4;
}

.empty-text {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  margin: 0;
}

.empty-hint {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: 0;
  max-width: 300px;
}

/* Metrics grid */
.metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.metric-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
}

.metric-label {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.metric-value {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--text-primary);
}

.metrics-actions {
  display: flex;
  gap: var(--space-2);
}

/* Weekly history */
.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.history-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.history-week {
  font-size: var(--text-xs);
  color: var(--text-muted);
  min-width: 56px;
  flex-shrink: 0;
}

.history-bars {
  flex: 1;
  min-width: 0;
}

.bar-track {
  position: relative;
  height: 20px;
  background: var(--glass-bg-medium);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.bar-planned {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--state-active-bg);
  border: 1px solid var(--brand-primary-dim);
  border-radius: var(--radius-sm);
}

.bar-completed {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--state-hover-border);
  border-radius: var(--radius-sm);
}

.history-stats {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  min-width: 64px;
  text-align: end;
  flex-shrink: 0;
}

.history-accuracy {
  color: var(--brand-primary);
  font-weight: var(--font-semibold);
  margin-inline-start: var(--space-1);
}

.history-legend {
  display: flex;
  gap: var(--space-4);
  justify-content: flex-end;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
}

.legend-planned {
  background: var(--state-active-bg);
  border: 1px solid var(--brand-primary-dim);
}

.legend-completed {
  background: var(--state-hover-border);
}

/* Buttons */
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  white-space: nowrap;
}

.primary-btn {
  background: var(--glass-bg-soft);
  border: 1px solid var(--brand-primary);
  color: var(--brand-primary);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.primary-btn:hover:not(:disabled) {
  background: var(--brand-primary-subtle);
  border-color: var(--brand-primary-hover);
}

.primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ghost-btn {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border-hover);
  color: var(--text-secondary);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.ghost-btn:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-strong);
  color: var(--text-primary);
}

.danger-btn {
  background: var(--glass-bg-soft);
  border: 1px solid var(--color-danger);
  color: var(--color-danger);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.danger-btn:hover {
  background: var(--danger-bg-subtle);
}

/* Learning disabled notice */
.learning-disabled-notice {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--color-warning-alpha-10);
  border: 1px solid var(--color-priority-medium-border-medium);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  color: var(--color-warning);
}

/* Status message */
.status-message {
  font-size: var(--text-xs);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  margin: 0;
}

.status-message.success {
  color: var(--brand-primary);
  background: var(--brand-primary-subtle);
  border: 1px solid var(--brand-border-subtle);
}

.status-message.warning {
  color: var(--color-warning);
  background: var(--color-warning-alpha-10);
  border: 1px solid var(--color-priority-medium-border-medium);
}

.status-message.error {
  color: var(--color-danger);
  background: var(--danger-bg-subtle);
  border: 1px solid var(--danger-border-subtle);
}

/* Spinner */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* View toggle */
.view-toggle {
  display: flex;
  gap: 2px;
  margin-inline-start: auto;
  background: var(--glass-bg-medium);
  border-radius: var(--radius-md);
  padding: 2px;
}

.toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.toggle-btn:hover {
  color: var(--text-primary);
  background: var(--glass-bg-soft);
}

.toggle-btn.active {
  color: var(--brand-primary);
  background: var(--glass-bg-soft);
}

/* Graph visualization */
.graph-container {
  position: relative;
  width: 100%;
  min-height: 300px;
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.graph-svg {
  width: 100%;
  height: auto;
  display: block;
}

.graph-edge {
  stroke: var(--brand-primary);
  stroke-width: 1.5;
  fill: none;
}

.edge-label {
  font-size: 9px;
  fill: var(--text-muted);
  text-anchor: middle;
  pointer-events: none;
}

.graph-node {
  cursor: pointer;
}

.graph-node .node-circle {
  transition: stroke-width 0.15s ease;
}

.graph-node.hovered .node-circle {
  stroke-width: 3;
}

.node-label {
  font-size: 11px;
  fill: var(--text-secondary);
  text-anchor: middle;
  pointer-events: none;
  font-weight: 500;
}

.node-label.center-label {
  fill: var(--surface-primary);
  font-size: 13px;
  font-weight: 700;
}

.graph-tooltip {
  position: absolute;
  transform: translate(-50%, -100%);
  background: var(--overlay-component-bg);
  border: 1px solid var(--glass-border-hover);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  pointer-events: none;
  z-index: 10;
  max-width: 280px;
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
}

.tooltip-relation {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--brand-primary);
  text-transform: capitalize;
}

.tooltip-value {
  font-size: var(--text-xs);
  color: var(--text-primary);
  margin-top: 2px;
}

.tooltip-meta {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 4px;
}

/* Responsive */
@media (max-width: 640px) {
  .insights-scroll {
    padding: var(--space-4);
  }

  .metrics-grid {
    grid-template-columns: 1fr;
  }
}
</style>
