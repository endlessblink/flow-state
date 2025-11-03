<template>
  <div class="page">
    <h1 class="page-title">Canvas Components</h1>
    <p class="page-description">Verified canvas components from actual code</p>

    <ComponentShowcase
      title="Canvas Controls Toolbar (CanvasView.vue:8-87)"
      :code="canvasControlsCode"
    >
      <div class="canvas-demo">
        <div class="canvas-controls">
          <!-- Section Controls -->
          <div class="control-group">
            <button class="control-btn active" title="Toggle Sections">
              <Grid3X3 :size="16" />
            </button>
            <button class="control-btn" title="Add Section">
              <Plus :size="16" />
            </button>
            <button class="control-btn" title="Auto Arrange">
              <Layout :size="16" />
            </button>
          </div>

          <!-- Selection Controls -->
          <div class="control-group">
            <button class="control-btn" title="Multi-Select Mode">
              <CheckSquare :size="16" />
            </button>
          </div>

          <!-- Display Controls -->
          <div class="control-group">
            <button class="control-btn active" title="Toggle Priority">
              <Flag :size="16" />
            </button>
            <button class="control-btn" title="Toggle Status">
              <PlayCircle :size="16" />
            </button>
            <button class="control-btn active" title="Toggle Duration">
              <Clock :size="16" />
            </button>
            <button class="control-btn" title="Toggle Schedule">
              <Calendar :size="16" />
            </button>
          </div>

          <!-- View Controls -->
          <div class="control-group">
            <button class="control-btn" title="Fit View">
              <Maximize :size="16" />
            </button>
            <button class="control-btn" title="Zoom In">
              <ZoomIn :size="16" />
            </button>
            <button class="control-btn" title="Zoom Out">
              <ZoomOut :size="16" />
            </button>
            <div class="zoom-level">100%</div>
          </div>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="InboxPanel Header (InboxPanel.vue:2-11)"
      :code="inboxHeaderCode"
    >
      <div class="inbox-demo">
        <div class="inbox-header">
          <button class="collapse-btn">
            <ChevronLeft :size="16" />
          </button>
          <h3 class="inbox-title">Inbox</h3>
          <span class="count-badge">3</span>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="Inbox Task Card (InboxPanel.vue:57-81)"
      :code="inboxTaskCode"
    >
      <div class="inbox-demo">
        <div class="inbox-task-card">
          <div class="priority-stripe priority-high"></div>
          <div class="task-content">
            <div class="task-title">עבודה על פרויקט חדש</div>
            <div class="task-meta">
              <span class="priority-tag high">high</span>
              <span class="duration-badge">60m</span>
            </div>
          </div>
        </div>
      </div>
    </ComponentShowcase>
  </div>
</template>

<script setup lang="ts">
import ComponentShowcase from '../components/ComponentShowcase.vue'
import { Grid3X3, Plus, Layout, CheckSquare, Flag, PlayCircle, Clock, Calendar, Maximize, ZoomIn, ZoomOut, ChevronLeft } from 'lucide-vue-next'

const canvasControlsCode = `<div class="canvas-controls">
  <!-- Section Controls -->
  <div class="control-group">
    <button class="control-btn" :class="{ active: showSections }">
      <Grid3X3 :size="16" />
    </button>
    <button class="control-btn" @click="addSection">
      <Plus :size="16" />
    </button>
    <button class="control-btn" @click="autoArrange">
      <Layout :size="16" />
    </button>
  </div>

  <!-- Selection Controls -->
  <div class="control-group">
    <button class="control-btn" :class="{ active: multiSelectMode }">
      <CheckSquare :size="16" />
    </button>
  </div>

  <!-- Display Controls -->
  <div class="control-group">
    <button class="control-btn" :class="{ active: showPriority }">
      <Flag :size="16" />
    </button>
    <button class="control-btn" :class="{ active: showStatus }">
      <PlayCircle :size="16" />
    </button>
    <button class="control-btn" :class="{ active: showDuration }">
      <Clock :size="16" />
    </button>
    <button class="control-btn" :class="{ active: showSchedule }">
      <Calendar :size="16" />
    </button>
  </div>

  <!-- View Controls -->
  <div class="control-group">
    <button class="control-btn" @click="fitView">
      <Maximize :size="16" />
    </button>
    <button class="control-btn" @click="zoomIn">
      <ZoomIn :size="16" />
    </button>
    <button class="control-btn" @click="zoomOut">
      <ZoomOut :size="16" />
    </button>
    <div class="zoom-level">{{ Math.round(zoom * 100) }}%</div>
  </div>
</div>`

const inboxHeaderCode = `<div class="inbox-header">
  <button class="collapse-btn" @click="toggleCollapse">
    <ChevronLeft :size="16" />
  </button>
  <h3 class="inbox-title">Inbox</h3>
  <n-badge :value="inboxTasks.length" type="info" />
</div>`

const inboxTaskCode = `<div class="inbox-task-card" draggable="true">
  <div class="priority-stripe" :class="'priority-' + task.priority"></div>
  <div class="task-content">
    <div class="task-title">{{ task.title }}</div>
    <div class="task-meta">
      <n-tag :type="priorityType" size="small" round>
        {{ task.priority }}
      </n-tag>
      <span class="duration-badge">{{ task.estimatedDuration }}m</span>
    </div>
  </div>
</div>`
</script>

<style scoped>
.page {
  max-width: 1400px;
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  margin-bottom: var(--space-2);
}

.page-description {
  color: var(--text-muted);
  margin-bottom: var(--space-8);
}

/* Canvas Demo Container */
.canvas-demo {
  padding: var(--space-8);
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  display: flex;
  justify-content: center;
}

/* VERIFIED: Canvas Controls from CanvasView.vue:1119-1260 */
.canvas-controls {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  background: var(--bg-secondary);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  box-shadow: 0 4px 12px var(--shadow-strong);
}

.control-group {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.control-group:not(:last-child) {
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-secondary);
}

.control-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.control-btn:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  backdrop-filter: var(--state-active-glass);
  -webkit-backdrop-filter: var(--state-active-glass);
  color: var(--text-primary);
  box-shadow: var(--state-hover-shadow);
}

.control-btn.active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  -webkit-backdrop-filter: var(--state-active-glass);
  color: var(--text-primary);
  box-shadow: var(--state-hover-glow);
}

.zoom-level {
  display: flex;
  align-items: center;
  padding: 0 var(--space-3);
  font-size: var(--text-sm);
  color: var(--text-muted);
  font-weight: var(--font-medium);
}

/* Inbox Demo */
.inbox-demo {
  padding: var(--space-6);
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
}

/* VERIFIED: Inbox Header from InboxPanel.vue:210-250 */
.inbox-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
  max-width: 320px;
}

.collapse-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-muted);
  padding: var(--space-2);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--duration-normal) var(--spring-smooth);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}

.collapse-btn:hover {
  background: var(--glass-bg-heavy);
  border-color: var(--glass-border-medium);
  color: var(--text-primary);
  transform: scale(1.05);
}

.inbox-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
  flex: 1;
}

.count-badge {
  background: var(--brand-primary);
  color: white;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  min-width: 20px;
  text-align: center;
}

/* VERIFIED: Inbox Task Card from InboxPanel.vue:275-337 */
.inbox-task-card {
  position: relative;
  padding: var(--space-4);
  cursor: move;
  background: var(--surface-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-sm);
  max-width: 320px;
}

.inbox-task-card:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  backdrop-filter: var(--state-active-glass);
  transform: translateY(-2px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.priority-stripe {
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
}

.priority-stripe.priority-high {
  background: var(--color-priority-high);
}

.priority-stripe.priority-medium {
  background: var(--color-work);
}

.priority-stripe.priority-low {
  background: var(--color-priority-low);
}

.task-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.task-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  line-height: var(--leading-tight);
  transition: color var(--duration-normal);
}

.task-meta {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  transition: opacity var(--duration-normal);
}

.priority-tag {
  font-size: var(--text-xs);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-weight: var(--font-medium);
}

.priority-tag.high {
  background: var(--danger-bg-light);
  color: var(--color-priority-high);
  border: 1px solid var(--danger-border-subtle);
}

.priority-tag.low {
  background: var(--blue-bg-light);
  color: var(--color-priority-low);
  border: 1px solid var(--blue-border-medium);
}

.duration-badge {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-weight: var(--font-medium);
}
</style>
