<template>
  <div class="canvas-empty-state" aria-label="Canvas is empty">
    <!-- Ambient background dots — subtle grid suggestion -->
    <div class="ambient-grid" aria-hidden="true">
      <span v-for="i in 24" :key="i" class="grid-dot" :style="gridDotStyle(i)" />
    </div>

    <!-- Main content card -->
    <div class="empty-card">
      <!-- SVG Illustration: floating task cards with connecting lines -->
      <div class="illustration" aria-hidden="true">
        <svg
          class="canvas-illustration"
          viewBox="0 0 320 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <!-- Connecting lines -->
          <line class="connector connector-1" x1="80" y1="72" x2="160" y2="100" stroke-dasharray="4 3" />
          <line class="connector connector-2" x1="240" y1="68" x2="160" y2="100" stroke-dasharray="4 3" />
          <line class="connector connector-3" x1="160" y1="100" x2="160" y2="148" stroke-dasharray="4 3" />

          <!-- Dot nodes at line intersections -->
          <circle class="node-dot node-dot-1" cx="80" cy="72" r="4" />
          <circle class="node-dot node-dot-2" cx="240" cy="68" r="4" />
          <circle class="node-dot node-dot-3" cx="160" cy="148" r="4" />

          <!-- Center anchor node -->
          <circle class="node-center" cx="160" cy="100" r="6" />

          <!-- Task card: top-left — floats up -->
          <g class="task-card-group float-a">
            <rect x="28" y="44" width="104" height="56" rx="8" class="task-card-rect" />
            <!-- Check circle -->
            <circle cx="46" cy="60" r="6" class="task-check-ring" />
            <path d="M43 60 L45.5 62.5 L49 58" class="task-check-mark" />
            <!-- Title bar -->
            <rect x="56" y="55" width="60" height="5" rx="2.5" class="task-bar-title" />
            <!-- Sub bar -->
            <rect x="56" y="64" width="44" height="4" rx="2" class="task-bar-sub" />
            <!-- Tag pill -->
            <rect x="36" y="78" width="32" height="14" rx="7" class="task-tag-a" />
            <rect x="74" y="78" width="24" height="14" rx="7" class="task-tag-b" />
          </g>

          <!-- Task card: top-right — floats up delayed -->
          <g class="task-card-group float-b">
            <rect x="188" y="40" width="104" height="56" rx="8" class="task-card-rect" />
            <circle cx="206" cy="56" r="6" class="task-check-ring" />
            <path d="M203 56 L205.5 58.5 L209 54" class="task-check-mark" />
            <rect x="216" y="51" width="60" height="5" rx="2.5" class="task-bar-title" />
            <rect x="216" y="60" width="36" height="4" rx="2" class="task-bar-sub" />
            <rect x="196" y="74" width="40" height="14" rx="7" class="task-tag-c" />
            <rect x="242" y="74" width="22" height="14" rx="7" class="task-tag-b" />
          </g>

          <!-- Task card: bottom-center — floats down -->
          <g class="task-card-group float-c">
            <rect x="108" y="152" width="104" height="40" rx="8" class="task-card-rect-muted" />
            <rect x="120" y="163" width="52" height="5" rx="2.5" class="task-bar-title-muted" />
            <rect x="120" y="173" width="36" height="4" rx="2" class="task-bar-sub-muted" />
          </g>

          <!-- Drag cursor hint — small hand icon near center-left -->
          <g class="drag-hint float-hint">
            <circle cx="112" cy="100" r="12" class="drag-hint-bg" />
            <!-- Simplified hand/cursor icon -->
            <path d="M109 104 L109 97 Q109 95.5 110.5 95.5 Q112 95.5 112 97 L112 101 Q112.5 99.5 114 99.5 Q115.5 99.5 115.5 101 L115.5 102 Q116 101 117 101 Q118 101 118 102.5 L118 105.5 Q118 108 115 108 L112 108 Q109 108 109 104 Z" class="drag-hand" />
          </g>
        </svg>

        <!-- Floating sparkle dots around illustration -->
        <span class="sparkle sparkle-1" />
        <span class="sparkle sparkle-2" />
        <span class="sparkle sparkle-3" />
        <span class="sparkle sparkle-4" />
      </div>

      <!-- Copy -->
      <div class="empty-copy">
        <h2 class="empty-title">Your spatial canvas awaits</h2>
        <p class="empty-description">
          Arrange tasks in space. See the big picture. Think visually.
        </p>
      </div>

      <!-- Feature pills -->
      <div class="feature-pills" aria-label="Canvas features">
        <div class="feature-pill">
          <Move :size="13" class="pill-icon" />
          <span>Drag tasks freely</span>
        </div>
        <div class="feature-pill">
          <FolderOpen :size="13" class="pill-icon" />
          <span>Group by theme</span>
        </div>
        <div class="feature-pill">
          <Workflow :size="13" class="pill-icon" />
          <span>See connections</span>
        </div>
        <div class="feature-pill">
          <LayoutGrid :size="13" class="pill-icon" />
          <span>Prioritize spatially</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="empty-actions">
        <button class="action-btn action-primary" @click="$emit('addTask')">
          <Plus :size="15" />
          <span>Add Task</span>
          <kbd class="key-hint">N</kbd>
        </button>
        <button class="action-btn action-secondary" @click="$emit('createGroup')">
          <FolderPlus :size="15" />
          <span>Create Group</span>
          <kbd class="key-hint">G</kbd>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Move, FolderOpen, Workflow, LayoutGrid, Plus, FolderPlus } from 'lucide-vue-next'

defineEmits<{
  (e: 'addTask'): void
  (e: 'createGroup'): void
}>()

function gridDotStyle(i: number): Record<string, string> {
  // Distribute 24 dots in a loose 6×4 grid with slight randomness baked per-index
  const col = (i - 1) % 6
  const row = Math.floor((i - 1) / 6)
  const jitterX = ((i * 17 + 3) % 7) - 3   // deterministic pseudo-random: -3..+3%
  const jitterY = ((i * 13 + 7) % 9) - 4   // -4..+4%
  return {
    left: `${10 + col * 16 + jitterX}%`,
    top: `${12 + row * 22 + jitterY}%`,
    animationDelay: `${((i * 0.37) % 2.8).toFixed(2)}s`,
  }
}
</script>

<style scoped>
/* ============================================================
   LAYOUT SHELL
   ============================================================ */
.canvas-empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  pointer-events: none;
  overflow: hidden;
}

/* ============================================================
   AMBIENT GRID DOTS
   ============================================================ */
.ambient-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.grid-dot {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--glass-border-medium);
  opacity: 0;
  animation: dot-pulse 3.2s ease-in-out infinite;
}

@keyframes dot-pulse {
  0%, 100% { opacity: 0; transform: scale(0.8); }
  50%       { opacity: 0.55; transform: scale(1); }
}

/* ============================================================
   MAIN CARD
   ============================================================ */
.empty-card {
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-8);
  max-width: 520px;
  width: 100%;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border-soft);
  border-radius: var(--radius-xl);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
  box-shadow:
    0 0 0 1px var(--glass-border-faint),
    0 24px 48px rgba(0, 0, 0, 0.28),
    0 0 80px rgba(45, 212, 191, 0.04);
  animation: card-arrive 0.6s var(--spring-smooth) both;
}

@keyframes card-arrive {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* ============================================================
   ILLUSTRATION
   ============================================================ */
.illustration {
  position: relative;
  width: 100%;
  max-width: 340px;
  height: 200px;
}

.canvas-illustration {
  width: 100%;
  height: 100%;
  overflow: visible;
}

/* Connector lines */
.connector {
  stroke: rgba(45, 212, 191, 0.25);
  stroke-width: 1.5;
  stroke-linecap: round;
  animation: line-draw 1.4s var(--spring-smooth) both;
}
.connector-1 { animation-delay: 0.2s; }
.connector-2 { animation-delay: 0.35s; }
.connector-3 { animation-delay: 0.5s; }

@keyframes line-draw {
  from { opacity: 0; stroke-dashoffset: 60; }
  to   { opacity: 1; stroke-dashoffset: 0; }
}

/* Node dots */
.node-dot {
  fill: rgba(45, 212, 191, 0.18);
  stroke: rgba(45, 212, 191, 0.5);
  stroke-width: 1;
  animation: node-pop 0.4s var(--spring-smooth) both;
}
.node-dot-1 { animation-delay: 0.55s; }
.node-dot-2 { animation-delay: 0.65s; }
.node-dot-3 { animation-delay: 0.75s; }

.node-center {
  fill: rgba(45, 212, 191, 0.28);
  stroke: var(--brand-primary);
  stroke-width: 1.5;
  animation: node-pop 0.5s var(--spring-smooth) 0.45s both,
             node-pulse 2.8s ease-in-out 1.2s infinite;
}

@keyframes node-pop {
  from { opacity: 0; r: 0; }
  to   { opacity: 1; }
}

@keyframes node-pulse {
  0%, 100% { fill: rgba(45, 212, 191, 0.28); }
  50%       { fill: rgba(45, 212, 191, 0.45); }
}

/* Task card rects */
.task-card-rect {
  fill: rgba(45, 40, 70, 0.55);
  stroke: var(--glass-border-soft);
  stroke-width: 1;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.25));
}

.task-card-rect-muted {
  fill: rgba(45, 40, 70, 0.35);
  stroke: var(--glass-border-faint);
  stroke-width: 1;
}

/* Check mark elements */
.task-check-ring {
  fill: rgba(45, 212, 191, 0.12);
  stroke: rgba(45, 212, 191, 0.55);
  stroke-width: 1.2;
}

.task-check-mark {
  stroke: var(--brand-primary);
  stroke-width: 1.3;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
}

/* Title / sub bars */
.task-bar-title        { fill: var(--glass-border-strong); }
.task-bar-sub          { fill: var(--glass-border-medium); }
.task-bar-title-muted  { fill: var(--glass-border-light); }
.task-bar-sub-muted    { fill: var(--glass-border-faint); }

/* Tag pills */
.task-tag-a { fill: rgba(45, 212, 191, 0.18); stroke: rgba(45, 212, 191, 0.35); stroke-width: 0.8; }
.task-tag-b { fill: rgba(139, 92, 246, 0.18); stroke: rgba(139, 92, 246, 0.35); stroke-width: 0.8; }
.task-tag-c { fill: rgba(99, 102, 241, 0.18); stroke: rgba(99, 102, 241, 0.35); stroke-width: 0.8; }

/* Drag hint */
.drag-hint-bg {
  fill: rgba(45, 212, 191, 0.1);
  stroke: rgba(45, 212, 191, 0.3);
  stroke-width: 1;
}

.drag-hand {
  fill: rgba(45, 212, 191, 0.7);
}

/* Float animations for card groups */
.task-card-group {
  animation: card-group-in 0.6s var(--spring-smooth) both;
  will-change: transform;
}

.float-a {
  animation-name: card-group-in;
  animation-delay: 0.1s;
  animation: card-group-in 0.6s var(--spring-smooth) 0.1s both, float-a 5.5s ease-in-out 0.8s infinite;
}
.float-b {
  animation: card-group-in 0.6s var(--spring-smooth) 0.22s both, float-b 6s ease-in-out 1.1s infinite;
}
.float-c {
  animation: card-group-in 0.6s var(--spring-smooth) 0.34s both, float-c 5s ease-in-out 1.4s infinite;
}
.drag-hint {
  animation: card-group-in 0.5s var(--spring-smooth) 0.7s both, float-hint 4.2s ease-in-out 1.5s infinite;
}

@keyframes card-group-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes float-a {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-5px); }
}

@keyframes float-b {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-7px); }
}

@keyframes float-c {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(4px); }
}

@keyframes float-hint {
  0%, 100% { transform: translateX(0); }
  50%       { transform: translateX(4px); }
}

/* Sparkle dots */
.sparkle {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  animation: sparkle-glow 3s ease-in-out infinite;
}

.sparkle-1 {
  width: 6px; height: 6px;
  background: var(--brand-primary);
  top: 18%; left: 12%;
  opacity: 0;
  animation-delay: 0s;
  box-shadow: 0 0 8px rgba(45, 212, 191, 0.8);
}
.sparkle-2 {
  width: 4px; height: 4px;
  background: rgba(139, 92, 246, 0.9);
  top: 22%; right: 14%;
  opacity: 0;
  animation-delay: 1s;
  box-shadow: 0 0 6px rgba(139, 92, 246, 0.8);
}
.sparkle-3 {
  width: 5px; height: 5px;
  background: var(--brand-primary);
  bottom: 20%; left: 20%;
  opacity: 0;
  animation-delay: 1.8s;
  box-shadow: 0 0 7px rgba(45, 212, 191, 0.7);
}
.sparkle-4 {
  width: 3px; height: 3px;
  background: rgba(99, 102, 241, 0.9);
  bottom: 28%; right: 18%;
  opacity: 0;
  animation-delay: 0.6s;
  box-shadow: 0 0 5px rgba(99, 102, 241, 0.8);
}

@keyframes sparkle-glow {
  0%, 100% { opacity: 0; transform: scale(0.6); }
  40%, 60% { opacity: 0.9; transform: scale(1); }
}

/* ============================================================
   COPY
   ============================================================ */
.empty-copy {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  text-align: center;
  animation: fade-up 0.5s var(--spring-smooth) 0.3s both;
}

.empty-title {
  margin: 0;
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.empty-description {
  margin: 0;
  font-size: var(--text-base);
  color: var(--text-secondary);
  line-height: 1.55;
  max-width: 340px;
}

/* ============================================================
   FEATURE PILLS
   ============================================================ */
.feature-pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: center;
  animation: fade-up 0.5s var(--spring-smooth) 0.42s both;
}

.feature-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px var(--space-3);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border-light);
  border-radius: var(--radius-xl);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  backdrop-filter: blur(var(--blur-xs));
  -webkit-backdrop-filter: blur(var(--blur-xs));
  transition: all var(--duration-normal) var(--spring-smooth);
}

.feature-pill:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-soft);
  color: var(--text-primary);
}

.pill-icon {
  color: var(--brand-primary);
  flex-shrink: 0;
}

/* ============================================================
   ACTIONS
   ============================================================ */
.empty-actions {
  display: flex;
  gap: var(--space-3);
  animation: fade-up 0.5s var(--spring-smooth) 0.54s both;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  position: relative;
}

/* Primary: teal glass */
.action-primary {
  background: rgba(45, 212, 191, 0.08);
  border: 1px solid rgba(45, 212, 191, 0.4);
  color: var(--brand-primary);
}

.action-primary:hover {
  background: rgba(45, 212, 191, 0.15);
  border-color: rgba(45, 212, 191, 0.65);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(45, 212, 191, 0.2), 0 0 0 1px rgba(45, 212, 191, 0.2);
}

/* Secondary: purple glass */
.action-secondary {
  background: var(--purple-bg-subtle);
  border: 1px solid var(--purple-border-subtle);
  color: rgba(167, 139, 250, 0.9);
}

.action-secondary:hover {
  background: rgba(139, 92, 246, 0.15);
  border-color: var(--purple-border-light);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(139, 92, 246, 0.2), 0 0 0 1px rgba(139, 92, 246, 0.2);
}

.action-btn:active {
  transform: translateY(0);
  box-shadow: none;
}

/* Keyboard hint badges */
.key-hint {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: var(--glass-bg-tint);
  border: 1px solid var(--glass-border-light);
  border-radius: var(--radius-sm);
  font-family: ui-monospace, monospace;
  font-size: 10px;
  font-style: normal;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: inherit;
  opacity: 0.6;
  line-height: 1;
}

/* ============================================================
   SHARED ANIMATION
   ============================================================ */
@keyframes fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ============================================================
   REDUCED MOTION
   ============================================================ */
@media (prefers-reduced-motion: reduce) {
  .grid-dot,
  .sparkle,
  .float-a,
  .float-b,
  .float-c,
  .drag-hint,
  .node-center,
  .connector {
    animation: none !important;
    opacity: 1;
  }

  .empty-card,
  .empty-copy,
  .feature-pills,
  .empty-actions,
  .task-card-group {
    animation: none !important;
    opacity: 1;
    transform: none;
  }
}

/* ============================================================
   PAUSE ANIMATIONS DURING ZOOM/PAN
   Ancestor .is-zooming is set on .vue-flow during gestures.
   Pausing prevents GPU compositing contention with viewport transforms.
   ============================================================ */
:global(.is-zooming) .canvas-empty-state .grid-dot,
:global(.is-zooming) .canvas-empty-state .sparkle,
:global(.is-zooming) .canvas-empty-state .task-card-group,
:global(.is-zooming) .canvas-empty-state .drag-hint,
:global(.is-zooming) .canvas-empty-state .node-center,
:global(.is-zooming) .canvas-empty-state .connector {
  animation-play-state: paused !important;
}
</style>
