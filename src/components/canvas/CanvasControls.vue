<!--
  CanvasControls Component
  Extracted from CanvasView.vue lines 50-173
  Safe to extract - no Vue Flow dependencies
-->
<template>
  <div class="canvas-controls">
  
    <!-- Section Controls -->
    <div class="control-group">
      <button
        @click="$emit('sections:toggle')"
        class="control-btn"
        :class="{ active: showSections }"
        title="Toggle Sections"
      >
        <Grid3X3 :size="16" />
      </button>
      <div class="dropdown-container">
        <button @click="$emit('sections:add')" class="control-btn" title="Add Section">
          <Plus :size="16" />
        </button>
        <div v-if="showSectionTypeDropdown" class="section-type-dropdown">
          <div class="dropdown-section">
            <div class="dropdown-label">Priority</div>
            <button
              @click="$emit('sections:create', 'priority-high')"
              class="dropdown-item priority-high"
            >
              <AlertTriangle :size="14" />
              <span>High Priority</span>
            </button>
            <button
              @click="$emit('sections:create', 'priority-medium')"
              class="dropdown-item priority-medium"
            >
              <Flag :size="14" />
              <span>Medium Priority</span>
            </button>
            <button
              @click="$emit('sections:create', 'priority-low')"
              class="dropdown-item priority-low"
            >
              <Circle :size="14" />
              <span>Low Priority</span>
            </button>
          </div>
          <div class="dropdown-section">
            <div class="dropdown-label">Status</div>
            <button
              @click="$emit('sections:create', 'status-planned')"
              class="dropdown-item status-planned"
            >
              <Calendar :size="14" />
              <span>Planned</span>
            </button>
            <button
              @click="$emit('sections:create', 'status-in_progress')"
              class="dropdown-item status-in_progress"
            >
              <PlayCircle :size="14" />
              <span>In Progress</span>
            </button>
            <button
              @click="$emit('sections:create', 'status-done')"
              class="dropdown-item status-done"
            >
              <CheckCircle :size="14" />
              <span>Done</span>
            </button>
          </div>
        </div>
      </div>
      <button @click="$emit('sections:auto-arrange')" class="control-btn" title="Auto Arrange">
        <Layout :size="16" />
      </button>
    </div>

    <!-- Selection Controls -->
    <div class="control-group">
      <button
        @click="$emit('selection:toggle-multi')"
        class="control-btn"
        :class="{ active: multiSelectMode }"
        title="Multi-Select Mode"
      >
        <CheckSquare :size="16" />
      </button>
    </div>

    <!-- Display Controls -->
    <div class="control-group">
      <button
        @click="$emit('display:toggle-priority')"
        class="control-btn"
        :class="{ active: showPriorityIndicator }"
        title="Toggle Priority"
      >
        <Flag :size="16" />
      </button>
      <button
        @click="$emit('display:toggle-status')"
        class="control-btn"
        :class="{ active: showStatusBadge }"
        title="Toggle Status"
      >
        <PlayCircle :size="16" />
      </button>
      <button
        @click="$emit('display:toggle-duration')"
        class="control-btn"
        :class="{ active: showDurationBadge }"
        title="Toggle Duration"
      >
        <Clock :size="16" />
      </button>
      <button
        @click="$emit('display:toggle-schedule')"
        class="control-btn"
        :class="{ active: showScheduleBadge }"
        title="Toggle Schedule"
      >
        <Calendar :size="16" />
      </button>
      <button
        class="hide-done-toggle control-btn icon-only"
        :class="{ active: hideDoneTasks }"
        @click="$emit('display:toggle-done')"
        :title="hideDoneTasks ? 'Show completed tasks' : 'Hide completed tasks'"
      >
        <EyeOff v-if="hideDoneTasks" :size="16" />
        <Eye v-else :size="16" />
      </button>
    </div>

    <!-- View Controls -->
    <div class="control-group">
      <button @click="$emit('view:fit')" class="control-btn" title="Fit View (F)">
        <Maximize :size="16" />
      </button>
      <button @click="$emit('zoom:in')" class="control-btn" title="Zoom In (+)">
        <ZoomIn :size="16" />
      </button>
      <button @click="$emit('zoom:out')" class="control-btn" title="Zoom Out (-)">
        <ZoomOut :size="16" />
      </button>
      <div class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</div>
      <div class="zoom-dropdown-container">
        <button @click="$emit('zoom:toggle-dropdown')" class="control-btn zoom-dropdown-trigger" title="Zoom Presets">
          <ChevronDown :size="14" />
        </button>
        <div v-if="showZoomDropdown" class="zoom-dropdown">
          <button
            v-for="preset in zoomPresets"
            :key="preset.value"
            @click="$emit('zoom:apply-preset', preset.value)"
            class="zoom-preset-btn"
            :class="{ active: Math.abs(zoomLevel - preset.value) < 0.01 }"
          >
            {{ preset.label }}
          </button>
          <div class="zoom-divider"></div>
          <button @click="$emit('zoom:reset')" class="zoom-preset-btn">
            Reset (100%)
          </button>
          <button @click="$emit('zoom:fit-content')" class="zoom-preset-btn">
            Fit to Content
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
    PlayCircle,
    Grid3X3,
  Plus,
  AlertTriangle,
  Flag,
  Circle,
  Calendar,
  CheckCircle,
  Layout,
  CheckSquare,
  Clock,
  Eye,
  EyeOff,
  Maximize,
  ZoomIn,
  ZoomOut,
  ChevronDown
} from 'lucide-vue-next'

interface Props {
  showSections: boolean
  showSectionTypeDropdown: boolean
  multiSelectMode: boolean
  showPriorityIndicator: boolean
  showStatusBadge: boolean
  showDurationBadge: boolean
  showScheduleBadge: boolean
  hideDoneTasks: boolean
  zoomLevel: number
  showZoomDropdown: boolean
  zoomPresets: Array<{ value: number; label: string }>
}

interface Emits {
  (e: 'test:keyboard'): void
  (e: 'sections:toggle'): void
  (e: 'sections:add'): void
  (e: 'sections:create', type: string): void
  (e: 'sections:auto-arrange'): void
  (e: 'selection:toggle-multi'): void
  (e: 'display:toggle-priority'): void
  (e: 'display:toggle-status'): void
  (e: 'display:toggle-duration'): void
  (e: 'display:toggle-schedule'): void
  (e: 'display:toggle-done'): void
  (e: 'view:fit'): void
  (e: 'zoom:in'): void
  (e: 'zoom:out'): void
  (e: 'zoom:toggle-dropdown'): void
  (e: 'zoom:apply-preset', value: number): void
  (e: 'zoom:reset'): void
  (e: 'zoom:fit-content'): void
}

defineProps<Props>()
defineEmits<Emits>()
</script>

<style scoped>
.canvas-controls {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  align-items: center;
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.control-btn {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  color: var(--text-primary);
}

.control-btn:hover {
  background: var(--accent-primary);
  color: white;
  border-color: var(--accent-primary);
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.control-btn.active {
  background: var(--accent-primary);
  color: white;
  border-color: var(--accent-primary);
}

.control-btn.icon-only {
  padding: 0;
}

.dropdown-container {
  position: relative;
}

.section-type-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1000;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 200px;
  padding: 0.5rem;
  margin-top: 0.5rem;
}

.dropdown-section {
  margin-bottom: 0.5rem;
}

.dropdown-section:last-child {
  margin-bottom: 0;
}

.dropdown-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
  padding: 0 0.5rem;
}

.dropdown-item {
  width: 100%;
  padding: 0.5rem;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.dropdown-item:hover {
  background: var(--bg-secondary);
}

.dropdown-item.priority-high {
  color: var(--danger-color);
}

.dropdown-item.priority-medium {
  color: var(--warning-color);
}

.dropdown-item.priority-low {
  color: var(--success-color);
}

.dropdown-item.status-planned {
  color: var(--info-color);
}

.dropdown-item.status-in_progress {
  color: var(--warning-color);
}

.dropdown-item.status-done {
  color: var(--success-color);
}

.zoom-level {
  padding: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  min-width: 50px;
  text-align: center;
}

.zoom-dropdown-container {
  position: relative;
}

.zoom-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 1000;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 150px;
  padding: 0.5rem;
  margin-top: 0.5rem;
}

.zoom-preset-btn {
  width: 100%;
  padding: 0.5rem;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.zoom-preset-btn:hover {
  background: var(--bg-secondary);
}

.zoom-preset-btn.active {
  background: var(--accent-primary);
  color: white;
}

.zoom-divider {
  height: 1px;
  background: var(--border-color);
  margin: 0.5rem 0;
}

.hide-done-toggle.active {
  background: var(--warning-color);
  color: white;
  border-color: var(--warning-color);
}

@media (max-width: 768px) {
  .canvas-controls {
    padding: 0.75rem;
    gap: 0.75rem;
  }

  .control-btn {
    width: 32px;
    height: 32px;
  }

  .control-group {
    gap: 0.25rem;
  }
}
</style>