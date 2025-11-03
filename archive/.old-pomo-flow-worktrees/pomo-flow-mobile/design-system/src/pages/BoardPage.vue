<template>
  <div class="page">
    <h1 class="page-title">Board Components</h1>
    <p class="page-description">Verified board components from actual code</p>

    <ComponentShowcase
      title="Kanban Column Header (KanbanColumn.vue:3-8)"
      :code="columnHeaderCode"
    >
      <div class="board-demo">
        <div class="column-header">
          <span class="column-title">PLANNED</span>
          <span class="task-count">1</span>
          <button class="add-task-btn">
            <Plus :size="12" />
          </button>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase
      title="Task Card (TaskCard.vue:2-71)"
      :code="taskCardCode"
    >
      <div class="board-demo">
        <div class="task-card">
          <h3 class="task-title">עבודה על פרויקט חדש</h3>
          <p class="task-description">Task description...</p>

          <div class="task-meta-row">
            <span class="due-date">
              <Calendar :size="14" />
              07/10/2025
            </span>
            <div class="progress-indicator">
              <svg class="progress-circle" width="20" height="20">
                <circle cx="10" cy="10" r="8" fill="none" stroke="var(--border-medium)" stroke-width="2"/>
                <circle cx="10" cy="10" r="8" fill="none" stroke="var(--color-break)" stroke-width="2" stroke-dasharray="50.27" stroke-dashoffset="40" transform="rotate(-90 10 10)"/>
              </svg>
              <span class="progress-text">%</span>
            </div>
          </div>

          <div class="task-footer">
            <span class="pomodoro-count">🍅 1 session</span>
            <div class="task-actions">
              <button class="start-timer-btn">
                <Play :size="14" />
              </button>
              <button class="edit-task-btn">
                <Edit :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </ComponentShowcase>
  </div>
</template>

<script setup lang="ts">
import ComponentShowcase from '../components/ComponentShowcase.vue'
import { Plus, Calendar, Play, Edit } from 'lucide-vue-next'

const columnHeaderCode = `<div class="column-header">
  <span class="column-title">{{ title }}</span>
  <button class="add-task-btn" @click="addTask">
    <Plus :size="12" />
  </button>
</div>`

const taskCardCode = `<div class="task-card" @click="selectTask">
  <h3 class="task-title">{{ task.title }}</h3>
  <p class="task-description">{{ task.description }}</p>

  <div class="task-meta-row">
    <span class="due-date">
      <Calendar :size="14" />
      {{ task.dueDate }}
    </span>
    <div class="progress-indicator">
      <svg class="progress-circle" width="20" height="20">
        <!-- Progress circle SVG -->
      </svg>
      <span class="progress-text">{{ task.progress }}%</span>
    </div>
  </div>

  <div class="task-footer">
    <span class="pomodoro-count">🍅 {{ completedPomodoros }} sessions</span>
    <div class="task-actions">
      <button class="start-timer-btn">
        <Play :size="14" />
      </button>
      <button class="edit-task-btn">
        <Edit :size="14" />
      </button>
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

/* Board Demo */
.board-demo {
  padding: var(--space-8);
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
}

/* VERIFIED: Column Header from KanbanColumn.vue:133-179 */
.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
  padding: var(--space-3) var(--space-2);
  background: linear-gradient(
    90deg,
    var(--glass-bg-tint) 0%,
    var(--surface-hover) 100%
  );
  border-radius: var(--radius-md);
  max-width: 300px;
}

.column-title {
  color: var(--text-secondary);
  font-weight: var(--font-semibold);
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex: 1;
}

.task-count {
  color: var(--text-muted);
  font-size: var(--text-xs);
  background: var(--glass-bg-tint);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  min-width: 20px;
  text-align: center;
  margin-right: var(--space-2);
}

.add-task-btn {
  background: var(--glass-bg-tint);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  width: 24px;
  height: 24px;
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.add-task-btn:hover {
  background: var(--glass-bg-heavy);
  border-color: var(--glass-border-medium);
  color: var(--text-primary);
  transform: scale(1.1);
}

/* VERIFIED: Task Card from TaskCard.vue:145-241 */
.task-card {
  background: var(--surface-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-3);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-sm);
  position: relative;
  max-width: 300px;
}

.task-card:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  backdrop-filter: var(--state-active-glass);
  -webkit-backdrop-filter: var(--state-active-glass);
  transform: translateY(-2px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.task-title {
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  margin: 0 0 var(--space-2) 0;
  line-height: var(--leading-tight);
}

.task-description {
  color: var(--text-muted);
  font-size: var(--text-xs);
  margin: 0 0 var(--space-3) 0;
  line-height: var(--leading-normal);
}

.task-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.due-date {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.progress-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.progress-text {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-muted);
}

.task-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pomodoro-count {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.task-actions {
  display: flex;
  gap: var(--space-2);
  opacity: 0;
  transition: opacity var(--duration-fast);
}

.task-card:hover .task-actions {
  opacity: 1;
}

.start-timer-btn,
.edit-task-btn {
  background: var(--glass-bg-tint);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.start-timer-btn:hover {
  background: var(--color-work);
  border-color: var(--color-work);
  color: white;
}

.edit-task-btn:hover {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
  color: white;
}
</style>
