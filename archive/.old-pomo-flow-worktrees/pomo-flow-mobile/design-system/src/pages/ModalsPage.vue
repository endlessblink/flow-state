<template>
  <div class="page">
    <h1 class="page-title">Modal Components</h1>
    <p class="page-description">Verified modal components from actual code</p>

    <ComponentShowcase
      title="QuickTaskCreate Modal (QuickTaskCreate.vue:2-72)"
      :code="quickCreateCode"
    >
      <div class="modal-demo">
        <div class="quick-create-modal">
          <input type="text" placeholder="Task name" class="title-input" value="Task name" />
          <input type="text" placeholder="Description" class="description-input" value="Description" />

          <div class="properties-row">
            <div class="property-chip time-chip">
              <Calendar :size="14" />
              2:00 AM-6:30 AM
            </div>
            <div class="property-chip priority-chip">
              <Flag :size="14" />
              Medium
            </div>
            <div class="property-chip duration-chip">
              <Clock :size="14" />
              <input type="number" value="270" class="duration-input" />
              <span>mins</span>
            </div>
          </div>

          <div class="project-row">
            <Inbox :size="14" />
            <select class="project-select">
              <option>Inbox</option>
            </select>
          </div>

          <div class="actions-row">
            <button class="cancel-btn">Cancel</button>
            <button class="create-btn">Add task</button>
          </div>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="TaskContextMenu (TaskContextMenu.vue:2-126)"
      :code="taskContextMenuCode"
    >
      <div class="context-menu-demo">
        <div class="context-menu">
          <button class="menu-item">
            <span class="menu-text">Edit</span>
            <span class="menu-shortcut">Ctrl+E</span>
          </button>

          <div class="menu-divider"></div>

          <div class="menu-section">
            <div class="section-header">
              <div class="section-label">
                <span class="section-title">Date</span>
              </div>
              <span class="section-shortcut">T</span>
            </div>
            <div class="icon-row">
              <button class="icon-btn today-icon">
                <Calendar :size="16" :stroke-width="1.5" class="calendar-stroke" />
              </button>
              <button class="icon-btn sun-icon">
                <Sun :size="16" :stroke-width="1.5" class="sun-stroke" />
              </button>
              <button class="icon-btn moon-icon">
                <Moon :size="16" :stroke-width="1.5" class="moon-stroke" />
              </button>
              <button class="icon-btn next-week-icon">
                <ArrowRight :size="16" :stroke-width="1.5" class="arrow-stroke" />
              </button>
              <button class="icon-btn more-icon">
                <MoreHorizontal :size="16" :stroke-width="1.5" />
              </button>
            </div>
          </div>

          <div class="menu-divider"></div>

          <div class="menu-section">
            <div class="section-header">
              <div class="section-label">
                <span class="section-title">Priority</span>
              </div>
              <span class="section-shortcut">Y</span>
            </div>
            <div class="icon-row">
              <button class="icon-btn">
                <div class="priority-rect red"></div>
              </button>
              <button class="icon-btn active">
                <div class="priority-rect orange"></div>
              </button>
              <button class="icon-btn">
                <div class="priority-rect blue"></div>
              </button>
            </div>
          </div>

          <div class="menu-divider"></div>

          <button class="menu-item pomodoro-action">
            <span class="menu-text">Start Timer</span>
            <span class="menu-shortcut">Space</span>
          </button>

          <div class="menu-divider"></div>

          <button class="menu-item">
            <span class="menu-text">Duplicate</span>
          </button>

          <div class="menu-divider"></div>

          <button class="menu-item danger">
            <span class="menu-text">Delete</span>
            <span class="menu-shortcut">Delete</span>
          </button>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="Modal Footer Buttons (TaskEditModal.vue:237-244)"
      :code="modalFooterCode"
    >
      <div class="modal-demo">
        <div class="modal-footer">
          <button class="cancel-btn">Cancel</button>
          <button class="save-btn">Save Changes</button>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="Modal Footer - Button States"
      :code="footerStatesCode"
    >
      <div class="states-demo">
        <div class="state-group">
          <span class="state-label">Cancel Default:</span>
          <button class="cancel-btn">Cancel</button>
        </div>
        <div class="state-group">
          <span class="state-label">Cancel Hover:</span>
          <button class="cancel-btn hover-state">Cancel</button>
        </div>
        <div class="state-group">
          <span class="state-label">Save Default:</span>
          <button class="save-btn">Save Changes</button>
        </div>
        <div class="state-group">
          <span class="state-label">Save Hover:</span>
          <button class="save-btn hover-state">Save Changes</button>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="Form Inputs (TaskEditModal.vue:16-34)"
      :code="formInputsCode"
    >
      <div class="modal-demo">
        <div class="form-demo">
          <div class="form-group">
            <label class="form-label">TITLE</label>
            <input type="text" class="form-input" value="לילמוד קומפי / פייטון" />
          </div>
          <div class="form-group">
            <label class="form-label">DESCRIPTION</label>
            <textarea class="form-textarea" rows="3" placeholder="Describe what needs to be done..."></textarea>
          </div>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="Form Input States"
      :code="formInputStatesCode"
    >
      <div class="states-demo">
        <div class="state-group">
          <span class="state-label">Default:</span>
          <input type="text" class="form-input" placeholder="Enter text..." style="max-width: 300px;" />
        </div>
        <div class="state-group">
          <span class="state-label">Focus:</span>
          <input type="text" class="form-input focus-state" value="Typing..." style="max-width: 300px;" />
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="Priority Button Group (TaskEditModal.vue:48-79)"
      :code="priorityButtonsCode"
    >
      <div class="modal-demo">
        <div class="form-group">
          <label class="form-label">PRIORITY</label>
          <div class="icon-button-group">
            <button class="icon-btn">
              <Flag :size="16" class="priority-low" />
              <span class="btn-label">Low</span>
            </button>
            <button class="icon-btn">
              <AlertCircle :size="16" class="priority-medium" />
              <span class="btn-label">Medium</span>
            </button>
            <button class="icon-btn active">
              <Zap :size="16" class="priority-high" />
              <span class="btn-label">High</span>
            </button>
          </div>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="Status Button Group (TaskEditModal.vue:84-126)"
      :code="statusButtonsCode"
    >
      <div class="modal-demo">
        <div class="form-group">
          <label class="form-label">STATUS</label>
          <div class="icon-button-group">
            <button class="icon-btn">
              <Circle :size="16" class="status-planned" />
              <span class="btn-label">Plan</span>
            </button>
            <button class="icon-btn active">
              <PlayCircle :size="16" class="status-progress" />
              <span class="btn-label">Active</span>
            </button>
            <button class="icon-btn">
              <CheckCircle :size="16" class="status-done" />
              <span class="btn-label">Done</span>
            </button>
            <button class="icon-btn">
              <Archive :size="16" class="status-backlog" />
              <span class="btn-label">Later</span>
            </button>
          </div>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="Add Subtask Button (TaskEditModal.vue:150-153)"
      :code="addSubtaskCode"
    >
      <div class="modal-demo">
        <button class="add-subtask-btn">
          <Plus :size="14" />
          Add Subtask
        </button>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="Pomodoro Stats Cards (TaskEditModal.vue:220-233)"
      :code="pomodoroStatsCode"
    >
      <div class="modal-demo">
        <div class="pomodoro-stats">
          <div class="stat-item">
            <span class="stat-value">0</span>
            <span class="stat-label">Task Sessions</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">0</span>
            <span class="stat-label">Subtask Sessions</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">0</span>
            <span class="stat-label">Total Sessions</span>
          </div>
        </div>
      </div>
    </ComponentShowcase>
  </div>
</template>

<script setup lang="ts">
import ComponentShowcase from '../components/ComponentShowcase.vue'
import { Calendar, Flag, Clock, Inbox, Sun, Moon, ArrowRight, MoreHorizontal, AlertCircle, Zap, Circle, PlayCircle, CheckCircle, Archive, Plus } from 'lucide-vue-next'

const quickCreateCode = `<div class="quick-create-modal">
  <input
    v-model="taskTitle"
    type="text"
    placeholder="Task name"
    class="title-input"
  />

  <input
    v-model="taskDescription"
    type="text"
    placeholder="Description"
    class="description-input"
  />

  <div class="properties-row">
    <div class="property-chip time-chip">
      <Calendar :size="14" />
      {{ formatTimeRange }}
    </div>
    <div class="property-chip priority-chip" @click="cyclePriority">
      <Flag :size="14" />
      {{ priority }}
    </div>
    <div class="property-chip duration-chip">
      <Clock :size="14" />
      <input v-model.number="duration" type="number" />
      <span>mins</span>
    </div>
  </div>

  <div class="project-row">
    <Inbox :size="14" />
    <select v-model="projectId" class="project-select">
      <option value="">Inbox</option>
      <option v-for="project in projects">{{ project.name }}</option>
    </select>
  </div>

  <div class="actions-row">
    <button class="cancel-btn" @click="close">Cancel</button>
    <button class="create-btn" @click="handleCreate">Add task</button>
  </div>
</div>`

const taskContextMenuCode = `<div class="context-menu">
  <!-- Edit -->
  <button class="menu-item" @click="handleEdit">
    <span class="menu-text">Edit</span>
    <span class="menu-shortcut">Ctrl+E</span>
  </button>

  <div class="menu-divider"></div>

  <!-- Date Section -->
  <div class="menu-section">
    <div class="section-header">
      <span class="section-title">Date</span>
      <span class="section-shortcut">T</span>
    </div>
    <div class="icon-row">
      <button class="icon-btn">
        <Calendar :size="16" :stroke-width="1.5" />
      </button>
      <button class="icon-btn">
        <Sun :size="16" :stroke-width="1.5" />
      </button>
      <button class="icon-btn">
        <Moon :size="16" :stroke-width="1.5" />
      </button>
      <button class="icon-btn">
        <ArrowRight :size="16" :stroke-width="1.5" />
      </button>
      <button class="icon-btn">
        <MoreHorizontal :size="16" :stroke-width="1.5" />
      </button>
    </div>
  </div>

  <div class="menu-divider"></div>

  <!-- Priority Section -->
  <div class="menu-section">
    <div class="section-header">
      <span class="section-title">Priority</span>
      <span class="section-shortcut">Y</span>
    </div>
    <div class="icon-row">
      <button class="icon-btn">
        <div class="priority-rect red"></div>
      </button>
      <button class="icon-btn active">
        <div class="priority-rect orange"></div>
      </button>
      <button class="icon-btn">
        <div class="priority-rect blue"></div>
      </button>
    </div>
  </div>

  <div class="menu-divider"></div>

  <button class="menu-item">
    <span class="menu-text">Start Timer</span>
    <span class="menu-shortcut">Space</span>
  </button>

  <div class="menu-divider"></div>

  <button class="menu-item">
    <span class="menu-text">Duplicate</span>
  </button>

  <div class="menu-divider"></div>

  <button class="menu-item danger">
    <span class="menu-text">Delete</span>
    <span class="menu-shortcut">Delete</span>
  </button>
</div>`

const modalFooterCode = `<div class="modal-footer">
  <button class="cancel-btn" @click="close">
    Cancel
  </button>
  <button class="save-btn" @click="saveTask">
    Save Changes
  </button>
</div>`

const footerStatesCode = `<!-- Cancel Button -->
<button class="cancel-btn">Cancel</button>
<!-- Hover state automatic -->

<!-- Save Button -->
<button class="save-btn">Save Changes</button>
<!-- Hover state automatic -->`

const formInputsCode = `<div class="form-group">
  <label class="form-label">TITLE</label>
  <input
    v-model="editedTask.title"
    class="form-input"
    type="text"
    placeholder="Enter task title..."
  />
</div>

<div class="form-group">
  <label class="form-label">DESCRIPTION</label>
  <textarea
    v-model="editedTask.description"
    class="form-textarea"
    rows="3"
    placeholder="Describe what needs to be done..."
  ></textarea>
</div>`

const formInputStatesCode = `<!-- Default -->
<input type="text" class="form-input" placeholder="Enter text..." />

<!-- Focus (automatic with purple glow) -->
<input type="text" class="form-input" value="Typing..." />`

const priorityButtonsCode = `<div class="icon-button-group">
  <button
    class="icon-btn"
    :class="{ active: priority === 'low' }"
    @click="priority = 'low'"
  >
    <Flag :size="16" class="priority-low" />
    <span class="btn-label">Low</span>
  </button>
  <button
    class="icon-btn"
    :class="{ active: priority === 'medium' }"
    @click="priority = 'medium'"
  >
    <AlertCircle :size="16" class="priority-medium" />
    <span class="btn-label">Medium</span>
  </button>
  <button
    class="icon-btn"
    :class="{ active: priority === 'high' }"
    @click="priority = 'high'"
  >
    <Zap :size="16" class="priority-high" />
    <span class="btn-label">High</span>
  </button>
</div>`

const statusButtonsCode = `<div class="icon-button-group">
  <button class="icon-btn" :class="{ active: status === 'planned' }">
    <Circle :size="16" class="status-planned" />
    <span class="btn-label">Plan</span>
  </button>
  <button class="icon-btn" :class="{ active: status === 'in_progress' }">
    <PlayCircle :size="16" class="status-progress" />
    <span class="btn-label">Active</span>
  </button>
  <button class="icon-btn" :class="{ active: status === 'done' }">
    <CheckCircle :size="16" class="status-done" />
    <span class="btn-label">Done</span>
  </button>
  <button class="icon-btn" :class="{ active: status === 'backlog' }">
    <Archive :size="16" class="status-backlog" />
    <span class="btn-label">Later</span>
  </button>
</div>`

const addSubtaskCode = `<button class="add-subtask-btn" @click="addSubtask">
  <Plus :size="14" />
  Add Subtask
</button>`

const pomodoroStatsCode = `<div class="pomodoro-stats">
  <div class="stat-item">
    <span class="stat-value">{{ taskSessions }}</span>
    <span class="stat-label">Task Sessions</span>
  </div>
  <div class="stat-item">
    <span class="stat-value">{{ subtaskSessions }}</span>
    <span class="stat-label">Subtask Sessions</span>
  </div>
  <div class="stat-item">
    <span class="stat-value">{{ totalSessions }}</span>
    <span class="stat-label">Total Sessions</span>
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

/* Modal Demo */
.modal-demo {
  padding: var(--space-8);
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  display: flex;
  justify-content: center;
}

/* VERIFIED: QuickTaskCreate Modal from QuickTaskCreate.vue:190-360 */
.quick-create-modal {
  background: var(--surface-secondary);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-2xl);
  padding: var(--space-6);
  width: 480px;
  max-width: 90vw;
}

.title-input {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  padding: var(--space-2) 0;
  margin-bottom: var(--space-2);
  outline: none;
}

.title-input::placeholder {
  color: var(--text-muted);
}

.description-input {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  padding: var(--space-2) 0;
  margin-bottom: var(--space-4);
  outline: none;
}

.description-input::placeholder {
  color: var(--text-subtle);
}

.properties-row {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}

.property-chip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--surface-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  transition: all var(--duration-fast) var(--spring-smooth);
}

.priority-chip {
  cursor: pointer;
  text-transform: capitalize;
}

.priority-chip:hover {
  background: var(--surface-elevated);
  border-color: var(--border-medium);
}

.duration-input {
  width: 60px;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-sm);
  text-align: center;
  outline: none;
}

.project-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--surface-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-4);
}

.project-select {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-sm);
  outline: none;
  cursor: pointer;
}

.actions-row {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-subtle);
}

.cancel-btn {
  background: transparent;
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.cancel-btn:hover {
  background: var(--surface-hover);
  border-color: var(--border-medium);
}

.create-btn {
  background: var(--brand-primary);
  border: 1px solid var(--brand-primary);
  color: white;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.create-btn:hover:not(:disabled) {
  background: var(--brand-hover);
  border-color: var(--brand-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

.create-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Context Menu Demo */
.context-menu-demo {
  padding: var(--space-8);
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  display: flex;
  justify-content: center;
}

/* VERIFIED: TaskContextMenu from TaskContextMenu.vue:310-545 */
.context-menu {
  position: relative;
  background: linear-gradient(
    135deg,
    var(--glass-bg-medium) 0%,
    var(--glass-bg-heavy) 100%
  );
  backdrop-filter: blur(32px) saturate(200%);
  border: 1px solid var(--glass-border-strong);
  border-radius: var(--radius-xl);
  box-shadow:
    0 24px 48px var(--shadow-strong),
    0 12px 24px var(--shadow-strong),
    inset 0 1px 0 var(--glass-bg-medium);
  padding: var(--space-2) 0;
  min-width: 240px;
}

.menu-item {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-primary);
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  transition: all var(--duration-fast) var(--spring-smooth);
}

.menu-item:hover {
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(8px);
}

.menu-item.danger {
  color: var(--color-danger);
}

.menu-item.danger:hover {
  background: linear-gradient(
    135deg,
    var(--danger-bg-subtle) 0%,
    var(--danger-bg-light) 100%
  );
}

.menu-text {
  flex: 1;
}

.menu-shortcut {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.menu-divider {
  height: 1px;
  background: var(--border-subtle);
  margin: var(--space-1) var(--space-2);
}

.menu-section {
  padding: var(--space-2) var(--space-4);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
}

.section-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.section-title {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.section-shortcut {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.icon-row {
  display: flex;
  gap: 0.5rem;
}

.icon-btn {
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  border: 1px solid var(--glass-border);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-btn:hover {
  background: var(--glass-bg-heavy);
  border-color: var(--glass-border-medium);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.icon-btn.active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  box-shadow: var(--state-hover-glow);
}

.priority-rect {
  width: 12px;
  height: 8px;
  border-radius: var(--radius-xs);
}

.priority-rect.red {
  background: var(--color-danger);
}

.priority-rect.orange {
  background: var(--color-break);
}

.priority-rect.blue {
  background: var(--brand-primary);
}

.calendar-stroke {
  color: var(--color-work);
}

.sun-stroke {
  color: var(--color-break);
}

.moon-stroke {
  color: var(--color-focus);
}

.arrow-stroke {
  color: var(--brand-primary);
}

/* States Demo */
.states-demo {
  padding: var(--space-6);
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.state-group {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.state-label {
  font-size: var(--text-sm);
  color: var(--text-muted);
  min-width: 120px;
  font-weight: var(--font-medium);
}

/* VERIFIED: Modal Footer from TaskEditModal.vue:996-1050 */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-6);
  border-top: 1px solid var(--glass-bg-heavy);
  background: linear-gradient(
    180deg,
    transparent 0%,
    var(--glass-bg-weak) 100%
  );
}

.cancel-btn {
  background: var(--glass-bg-tint);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.cancel-btn:hover,
.cancel-btn.hover-state {
  background: var(--glass-bg-heavy);
  border-color: var(--border-secondary);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.save-btn {
  background: linear-gradient(
    135deg,
    var(--calendar-today-badge-start) 0%,
    var(--calendar-today-badge-end) 100%
  );
  border: 1px solid var(--purple-border-medium);
  color: white;
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  transition: all var(--duration-normal) var(--spring-bounce);
  box-shadow:
    var(--shadow-lg),
    0 0 20px var(--purple-border-subtle);
}

.save-btn:hover,
.save-btn.hover-state {
  background: linear-gradient(
    135deg,
    var(--purple-gradient-hover-start) 0%,
    var(--purple-gradient-hover-end) 100%
  );
  transform: translateY(-2px);
  box-shadow:
    var(--shadow-xl),
    0 0 30px var(--purple-border-medium);
}

/* Form Demo */
.form-demo {
  background: var(--surface-secondary);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  max-width: 600px;
}

/* VERIFIED: Form Elements from TaskEditModal.vue:552-699 */
.form-group {
  margin-bottom: var(--space-4);
}

.form-label {
  display: block;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-2);
}

.form-input,
.form-textarea {
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  width: 100%;
  font-size: var(--text-sm);
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: inset var(--shadow-sm);
}

.form-input:focus,
.form-textarea:focus,
.form-input.focus-state {
  outline: none;
  border-color: var(--calendar-creating-border);
  background: linear-gradient(
    135deg,
    var(--glass-bg-heavy) 0%,
    var(--glass-bg-tint) 100%
  );
  box-shadow:
    0 0 0 3px var(--calendar-creating-bg),
    inset var(--shadow-sm);
}

.form-input::placeholder,
.form-textarea::placeholder {
  color: var(--text-muted);
  opacity: 0.7;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
  font-family: var(--font-primary);
  line-height: var(--leading-normal);
}

/* VERIFIED: Icon Button Group from TaskEditModal.vue:588-665 */
.icon-button-group {
  display: flex;
  gap: var(--space-2);
}

.icon-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  flex: 1;
  padding: var(--space-3) var(--space-2);
  background: linear-gradient(
    135deg,
    var(--glass-bg-tint) 0%,
    var(--glass-bg-weak) 100%
  );
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--glass-bg-heavy);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  color: var(--text-muted);
}

.icon-btn:hover {
  background: linear-gradient(
    135deg,
    var(--glass-bg-heavy) 0%,
    var(--glass-bg-tint) 100%
  );
  border-color: var(--border-secondary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.icon-btn.active {
  background: linear-gradient(
    135deg,
    var(--purple-bg-start) 0%,
    var(--purple-bg-end) 100%
  );
  border-color: var(--purple-border-medium);
  color: var(--text-primary);
  box-shadow: var(--purple-shadow-subtle);
}

.btn-label {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

/* Priority Icon Colors */
.priority-low {
  color: var(--text-subtle);
}

.priority-medium {
  color: var(--color-priority-medium);
}

.priority-high {
  color: var(--color-priority-high);
}

.icon-btn.active .priority-low {
  color: var(--text-muted);
}

.icon-btn.active .priority-medium {
  color: var(--color-break);
}

.icon-btn.active .priority-high {
  color: var(--color-priority-high);
}

/* Status Icon Colors */
.status-planned {
  color: var(--text-subtle);
}

.status-progress {
  color: var(--color-priority-medium);
}

.status-done {
  color: var(--color-work);
}

.status-backlog {
  color: var(--text-subtle);
}

.icon-btn.active .status-planned {
  color: var(--text-muted);
}

.icon-btn.active .status-progress {
  color: var(--color-break);
}

.icon-btn.active .status-done {
  color: var(--color-work);
}

.icon-btn.active .status-backlog {
  color: var(--text-muted);
}

/* VERIFIED: Add Subtask Button from TaskEditModal.vue:722-751 */
.add-subtask-btn {
  background: linear-gradient(
    135deg,
    var(--calendar-today-badge-start) 0%,
    var(--calendar-today-badge-end) 100%
  );
  border: 1px solid var(--purple-border-medium);
  color: white;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  transition: all var(--duration-normal) var(--spring-bounce);
  box-shadow: var(--purple-shadow-subtle);
}

.add-subtask-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--purple-shadow-strong);
}

/* VERIFIED: Pomodoro Stats from TaskEditModal.vue:958-994 */
.pomodoro-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.stat-item {
  text-align: center;
  padding: var(--space-4);
  background: linear-gradient(
    135deg,
    var(--glass-bg-tint) 0%,
    var(--glass-bg-weak) 100%
  );
  border: 1px solid var(--glass-bg-heavy);
  border-radius: var(--radius-lg);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.stat-item:hover {
  border-color: var(--border-medium);
  transform: translateY(-2px);
}

.stat-value {
  display: block;
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--brand-primary);
  margin-bottom: var(--space-1);
}

.stat-label {
  display: block;
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-weight: var(--font-medium);
}
</style>
