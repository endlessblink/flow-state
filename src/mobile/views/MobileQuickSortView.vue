<template>
  <div class="mobile-quick-sort">
    <!-- Grain Texture Overlay -->
    <div class="grain-overlay" aria-hidden="true" />

    <!-- Compact Header (title + stats) -->
    <header class="qs-header">
      <div class="header-content">
        <h1 class="qs-title">
          <Zap :size="18" class="zap-icon" />
          <span>Quick Sort</span>
        </h1>
      </div>
      <div class="header-stats">
        <span class="stat-badge">{{ progress.current }}/{{ progress.total }}</span>
      </div>
    </header>

    <!-- Progress Bar -->
    <div v-if="!isComplete && activePhase === 'sort'" class="progress-track">
      <div
        class="progress-fill"
        :style="{ width: `${progress.percentage}%` }"
      />
      <div class="progress-glow" :style="{ left: `${progress.percentage}%` }" />
    </div>

    <!-- Phase Toggle -->
    <div class="phase-toggle">
      <button
        class="phase-btn"
        :class="{ active: activePhase === 'sort' }"
        @click="activePhase = 'sort'"
      >
        <Zap :size="16" />
        Sort
        <span v-if="uncategorizedCount > 0" class="count-badge">{{ uncategorizedCount }}</span>
      </button>
      <button
        class="phase-btn"
        :class="{ active: activePhase === 'capture' }"
        @click="activePhase = 'capture'"
      >
        <Plus :size="16" />
        Capture
      </button>
    </div>

    <!-- Task Context Bar (visible only in sort phase, reactive to task changes) -->
    <div v-if="activePhase === 'sort' && !isComplete && currentTask" class="task-context-bar">
      <!-- Due Date -->
      <div class="context-item">
        <CalendarDays :size="14" />
        <span v-if="taskDueDate" :class="{ 'overdue-text': isTaskOverdue }">{{ taskDueDate }}</span>
        <span v-else class="context-empty">No date</span>
      </div>

      <!-- Priority -->
      <div class="context-divider" />
      <div class="context-item">
        <span
          class="priority-indicator"
          :class="`priority-${currentTask.priority || 'none'}`"
        />
        <span class="capitalize">{{ currentTask.priority || 'None' }}</span>
      </div>

      <!-- Project -->
      <div class="context-divider" />
      <div class="context-item">
        <FolderOpen :size="14" />
        <span v-if="currentTaskProject" class="project-text">
          <span v-if="currentTaskProject.emoji" class="project-emoji">{{ currentTaskProject.emoji }}</span>
          {{ currentTaskProject.name }}
        </span>
        <span v-else class="context-empty">No project</span>
      </div>
    </div>

    <!-- Main Content -->
    <main class="qs-main">
      <!-- CAPTURE PHASE -->
      <div v-if="activePhase === 'capture'" class="capture-phase">
        <div class="capture-input-area">
          <div class="capture-card">
            <input
              ref="captureInputRef"
              v-model="newTaskTitle"
              type="text"
              class="capture-input"
              placeholder="What needs to be done?"
              autofocus
              @keydown.enter="handleQuickAdd"
            >

            <!-- Quick Actions -->
            <div class="quick-actions">
              <button
                class="quick-action-btn"
                :class="{ active: newTaskPriority === 'high' }"
                @click="newTaskPriority = newTaskPriority === 'high' ? undefined : 'high'"
              >
                <Flag :size="16" class="priority-high" />
                High
              </button>
              <button
                class="quick-action-btn"
                :class="{ active: newTaskDue === 'today' }"
                @click="newTaskDue = newTaskDue === 'today' ? undefined : 'today'"
              >
                <Calendar :size="16" />
                Today
              </button>
              <button
                class="quick-action-btn"
                :class="{ active: newTaskDue === 'tomorrow' }"
                @click="newTaskDue = newTaskDue === 'tomorrow' ? undefined : 'tomorrow'"
              >
                <CalendarPlus :size="16" />
                Tomorrow
              </button>
            </div>

            <button
              class="add-task-btn"
              :disabled="!newTaskTitle.trim()"
              @click="handleQuickAdd"
            >
              <Plus :size="20" />
              Add Task
            </button>
          </div>
        </div>

        <!-- Recently Added -->
        <div v-if="recentlyAdded.length > 0" class="recently-added">
          <h3 class="section-title">
            Just Added
          </h3>
          <TransitionGroup name="task-list" tag="ul" class="recent-list">
            <li
              v-for="task in recentlyAdded"
              :key="task.id"
              class="recent-item"
            >
              <CheckCircle :size="16" class="check-icon" />
              <span class="recent-title">{{ task.title }}</span>
            </li>
          </TransitionGroup>
        </div>
      </div>

      <!-- SORT PHASE -->
      <div v-else-if="!isComplete" class="sort-phase">
        <!-- Process Flow Indicator - Shows clear hierarchy -->
        <div class="process-flow-indicator">
          <div class="flow-step active">
            <span class="flow-icon">👀</span>
            <span class="flow-label">Review</span>
          </div>
          <div class="flow-arrow">
            →
          </div>
          <div class="flow-step">
            <span class="flow-icon">✏️</span>
            <span class="flow-label">Edit</span>
          </div>
          <div class="flow-arrow">
            →
          </div>
          <div class="flow-step">
            <span class="flow-icon">💾</span>
            <span class="flow-label">Save</span>
          </div>
        </div>

        <!-- Swipe Instructions - 4-direction hints -->
        <div v-if="!hasSwipedOnce" class="swipe-hints">
          <div class="hint hint-up">
            <ChevronUp :size="20" />
            <span>Edit</span>
          </div>
          <div class="hint-row">
            <div class="hint hint-left">
              <ChevronLeft :size="20" />
              <span>Delete</span>
            </div>
            <div class="hint hint-right">
              <span>Save</span>
              <ChevronRight :size="20" />
            </div>
          </div>
          <div class="hint hint-down">
            <ChevronDown :size="20" />
            <span>Skip</span>
          </div>
        </div>

        <!-- Card Stack -->
        <div class="card-stack">
          <!-- Background cards (depth effect) -->
          <div
            v-for="(task, idx) in stackPreview"
            :key="task.id"
            class="stack-card"
            :style="{
              transform: `scale(${1 - idx * 0.05}) translateY(${idx * 8}px)`,
              opacity: 1 - idx * 0.3,
              zIndex: 10 - idx
            }"
          />

          <!-- Active Card -->
          <MobileQuickSortCard
            v-if="currentTask"
            :task="currentTask"
            @swipe-right="onSwipeRight"
            @swipe-left="onSwipeLeft"
            @swipe-up="onSwipeUp"
            @swipe-down="onSwipeDown"
          />
        </div>

        <!-- Quick Edit Actions (Thumb Zone) -->
        <MobileQuickSortFilters
          :current-task="currentTask"
          :is-today="isToday"
          :is-tomorrow="isTomorrow"
          :is-weekend="isWeekend"
          :ai-action="aiAction"
          :is-a-i-busy="isAIBusy"
          :is-task-dirty="isTaskDirty"
          @set-priority="setPriority"
          @set-date="setDueDate"
          @ai-suggest="handleAISuggest"
          @mark-done="handleMarkDone"
          @save="handleSave"
          @assign="openProjectSheet"
          @delete="showDeleteConfirm = true"
        />
      </div>

      <!-- COMPLETION CELEBRATION -->
      <div v-else class="completion-phase">
        <div class="celebration-container">
          <div ref="confettiRef" class="confetti-burst" />

          <div class="celebration-icon">
            <PartyPopper :size="80" />
          </div>

          <h2 class="celebration-title">
            All Sorted!
          </h2>
          <p class="celebration-subtitle">
            You've processed all your tasks
          </p>

          <div v-if="sessionSummary" class="session-summary">
            <div class="summary-stat">
              <span class="stat-number">{{ sessionSummary.tasksProcessed }}</span>
              <span class="stat-label">Tasks</span>
            </div>
            <div class="summary-stat">
              <span class="stat-number">{{ formatDuration(sessionSummary.timeSpent) }}</span>
              <span class="stat-label">Time</span>
            </div>
            <div v-if="sessionSummary.efficiency > 0" class="summary-stat">
              <span class="stat-number">{{ sessionSummary.efficiency.toFixed(1) }}</span>
              <span class="stat-label">Tasks/min</span>
            </div>
          </div>

          <button class="return-btn" @click="router.push('/tasks')">
            <ArrowLeft :size="20" />
            Go to Inbox
          </button>
        </div>
      </div>
    </main>

    <!-- Project Selector Bottom Sheet -->
    <Teleport to="body">
      <Transition name="sheet">
        <div v-if="showProjectSheet" class="sheet-overlay" @click="showProjectSheet = false; projectSearch = ''">
          <div class="project-sheet" @click.stop>
            <div class="sheet-handle" />
            <h3 class="sheet-title">
              Where does this belong?
            </h3>

            <!-- Search Input (sticky) -->
            <div class="project-search-wrapper">
              <Search :size="16" class="search-icon" />
              <input
                v-model="projectSearch"
                type="text"
                class="project-search"
                placeholder="Search projects..."
              >
            </div>

            <div class="project-list">
              <!-- Keep in Inbox option - allows sorting without project assignment -->
              <button
                v-if="!projectSearch"
                class="project-option inbox-option"
                @click="handleSortWithoutProject"
              >
                <span class="project-indicator inbox-indicator">
                  📥
                </span>
                <span class="project-name">Keep in Inbox</span>
                <span class="option-hint">Sort without assigning</span>
              </button>

              <!-- Recent Projects (if no search and has recents) -->
              <div v-if="!projectSearch && recentProjects.length > 0" class="recent-projects-section">
                <span class="section-label">Recent</span>
                <div class="recent-projects-grid">
                  <button
                    v-for="project in recentProjects"
                    :key="project.id"
                    class="recent-project-chip"
                    @click="handleAssignProject(project.id)"
                  >
                    <span class="chip-emoji">{{ project.emoji || project.name.charAt(0) }}</span>
                    <span class="chip-name">{{ project.name }}</span>
                  </button>
                </div>
              </div>

              <div v-if="!projectSearch" class="project-divider">
                <span>{{ recentProjects.length > 0 ? 'All projects' : 'Or assign to project' }}</span>
              </div>

              <!-- Filtered/All Projects List -->
              <button
                v-for="{ project, depth } in filteredProjects"
                :key="project.id"
                class="project-option"
                :style="{ paddingLeft: `${16 + Math.min(depth, 2) * 24}px` }"
                @click="handleAssignProject(project.id)"
              >
                <span v-if="depth > 0" class="hierarchy-line" :style="{ width: `${Math.min(depth, 2) * 24}px` }">
                  <span class="hierarchy-connector" />
                </span>
                <span
                  class="project-indicator"
                  :style="{ backgroundColor: Array.isArray(project.color) ? project.color[0] : project.color }"
                >
                  {{ project.emoji || project.name.charAt(0) }}
                </span>
                <span class="project-name">{{ project.name }}</span>
                <span v-if="depth > 2" class="depth-indicator">+{{ depth - 2 }}</span>
              </button>

              <!-- No results message -->
              <div v-if="projectSearch && filteredProjects.length === 0" class="no-results">
                No projects match "{{ projectSearch }}"
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showDeleteConfirm" class="confirm-overlay">
          <div class="confirm-modal">
            <Trash2 :size="32" class="confirm-icon" />
            <h3>Delete this task?</h3>
            <p>This action cannot be undone</p>
            <div class="confirm-actions">
              <button class="cancel-btn" @click="cancelDelete">
                Cancel
              </button>
              <button class="delete-btn" @click="confirmDelete">
                Delete
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Quick Edit Panel -->
    <Teleport to="body">
      <Transition name="sheet">
        <div v-if="showQuickEditPanel" class="sheet-overlay" @click="showQuickEditPanel = false">
          <div class="quick-edit-sheet" @click.stop>
            <div class="sheet-handle" />
            <h3 class="sheet-title">
              Quick Edit
            </h3>

            <!-- Priority Section -->
            <div class="edit-section">
              <span class="edit-label">Priority</span>
              <div class="priority-pills">
                <button class="pill" :class="{ active: currentTask?.priority === 'low' }" @click="setPriorityAndClose('low')">
                  Low
                </button>
                <button class="pill" :class="{ active: currentTask?.priority === 'medium' }" @click="setPriorityAndClose('medium')">
                  Med
                </button>
                <button class="pill" :class="{ active: currentTask?.priority === 'high' }" @click="setPriorityAndClose('high')">
                  High
                </button>
              </div>
            </div>

            <!-- Date Section -->
            <div class="edit-section">
              <span class="edit-label">Due Date</span>
              <div class="date-pills">
                <button class="pill" @click="setDueDateAndClose('today')">
                  Today
                </button>
                <button class="pill" @click="setDueDateAndClose('tomorrow')">
                  Tmrw
                </button>
                <button class="pill" @click="setDueDateAndClose('in3days')">
                  +3d
                </button>
                <button class="pill" @click="setDueDateAndClose('weekend')">
                  Wknd
                </button>
              </div>
            </div>

            <!-- Assign to Project button -->
            <button class="assign-project-btn" @click="openProjectSheet">
              <FolderOpen :size="20" />
              Assign to Project
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- AI Results Bottom Sheet (TASK-1221) -->
    <Teleport to="body">
      <Transition name="sheet">
        <div v-if="showAISheet" class="sheet-overlay" @click.self="closeAISheet">
          <div class="ai-sheet" @click.stop>
            <div class="sheet-handle" />

            <!-- AI Error -->
            <div v-if="aiState === 'error'" class="ai-sheet-body">
              <h3 class="sheet-title">
                AI Error
              </h3>
              <p class="ai-error-text" dir="auto">
                {{ aiError }}
              </p>
              <div class="sheet-actions">
                <button class="sheet-btn primary" @click="closeAISheet">
                  Close
                </button>
              </div>
            </div>

            <!-- Smart Suggest Results -->
            <div v-else-if="aiAction === 'suggest'" class="ai-sheet-body">
              <h3 class="sheet-title">
                AI Suggestions
              </h3>
              <div class="ai-suggestions-list">
                <div
                  v-for="s in currentSuggestions"
                  :key="s.field"
                  class="ai-suggestion-item"
                >
                  <div class="ai-suggestion-top">
                    <span class="ai-field-name">{{ s.field }}</span>
                    <span class="ai-confidence">{{ Math.round(s.confidence * 100) }}%</span>
                  </div>
                  <div class="ai-suggestion-change">
                    <span class="ai-from">{{ s.currentValue || 'none' }}</span>
                    <span class="ai-arrow">&rarr;</span>
                    <span class="ai-to" dir="auto">{{ s.suggestedValue }}</span>
                  </div>
                  <p v-if="s.reasoning" class="ai-reason" dir="auto">
                    {{ s.reasoning }}
                  </p>
                </div>
                <div v-if="suggestedProjectId" class="ai-suggestion-item">
                  <div class="ai-suggestion-top">
                    <span class="ai-field-name">project</span>
                  </div>
                  <div class="ai-suggestion-change">
                    <span class="ai-from">{{ currentTaskProject?.name || 'none' }}</span>
                    <span class="ai-arrow">&rarr;</span>
                    <span class="ai-to" dir="auto">{{ suggestedProjectName || 'Suggested' }}</span>
                  </div>
                </div>
              </div>
              <div class="sheet-actions">
                <button class="sheet-btn primary" @click="handleApplySuggestions">
                  Apply All
                </button>
                <button class="sheet-btn secondary" @click="closeAISheet">
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Celebration Overlay -->
    <Transition name="celebration">
      <div v-if="showCelebration" class="mini-celebration">
        <CheckCircle :size="32" />
        <span>Sorted!</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import {
  Zap, X, Plus, CheckCircle, Calendar, CalendarPlus, CalendarDays, Flag,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, SkipForward, PartyPopper,
  ArrowLeft, Trash2, FolderOpen, Search, Save, Pencil,
  Sparkles, Loader2
} from 'lucide-vue-next'

import MobileQuickSortCard from '../components/MobileQuickSortCard.vue'
import MobileQuickSortFilters from '../components/MobileQuickSortFilters.vue'
import { useMobileQuickSortLogic } from '../composables/useMobileQuickSortLogic'

const {
  router,
  activePhase,
  showProjectSheet,
  showCelebration,
  hasSwipedOnce,
  sessionSummary,
  showDeleteConfirm,
  showQuickEditPanel,
  showAISheet,
  newTaskTitle,
  newTaskPriority,
  newTaskDue,
  recentlyAdded,
  captureInputRef,
  projectSearch,
  recentProjectIds,
  confettiRef,
  currentTask,
  uncategorizedTasks,
  progress,
  isComplete,
  isTaskDirty,
  aiState,
  aiAction,
  aiError,
  isAIBusy,
  currentSuggestions,
  suggestedProjectId,
  suggestedProjectName,
  projectsWithDepth,
  recentProjects,
  filteredProjects,
  uncategorizedCount,
  stackPreview,
  isToday,
  isTomorrow,
  isWeekend,
  taskDueDate,
  isTaskOverdue,
  currentTaskProject,
  handleQuickAdd,
  handleAssignProject,
  handleSortWithoutProject,
  handleEditTask,
  handleSkip,
  handleSave,
  handleMarkDone,
  setPriority,
  setDueDate,
  handleAISuggest,
  closeAISheet,
  handleApplySuggestions,
  cancelDelete,
  confirmDelete,
  setPriorityAndClose,
  setDueDateAndClose,
  openProjectSheet,
  formatDuration,
  onSwipeRight,
  onSwipeLeft,
  onSwipeUp,
  onSwipeDown
} = useMobileQuickSortLogic()
</script>

<style scoped>
/* ================================
   MOBILE QUICK SORT - "DECISIVE FLOW"
   Neo-brutalist meets fluid glass
   ================================ */

.mobile-quick-sort {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  color: var(--text-primary);
  overflow: hidden;
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
}

/* Grain texture overlay */
.grain-overlay {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  opacity: 0.03;
  pointer-events: none;
  z-index: var(--z-base);
}

/* ================================
   HEADER
   ================================ */

.qs-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--glass-border-light);
  z-index: var(--z-sticky);
  flex-shrink: 0;
}

.header-content {
  flex: 1;
}

.qs-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  margin: 0;
  letter-spacing: -0.02em;
}

.zap-icon {
  color: var(--brand-primary);
}

.qs-subtitle {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: var(--space-1) 0 0;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.header-stats {
  display: flex;
  align-items: center;
}

.stat-badge {
  padding: var(--space-1_5) var(--space-3);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

/* ================================
   PROGRESS BAR
   ================================ */

.progress-track {
  position: relative;
  height: var(--space-0_5);
  background: var(--glass-bg-weak);
  z-index: var(--z-sticky);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--brand-primary), var(--brand-active));
  transition: width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.progress-glow {
  position: absolute;
  top: 50%;
  width: var(--space-5);
  height: var(--space-5);
  background: var(--brand-primary);
  border-radius: var(--radius-full);
  filter: blur(var(--blur-sm));
  transform: translate(-50%, -50%);
  transition: left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* ================================
   PHASE TOGGLE
   ================================ */

.phase-toggle {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  z-index: var(--z-sticky);
}

.phase-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2_5) var(--space-4);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.phase-btn.active {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.phase-btn:active {
  transform: scale(0.98);
}

.count-badge {
  padding: var(--space-0_5) var(--space-2);
  background: var(--glass-border-hover);
  color: var(--text-primary);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  min-width: 1.5rem;
  text-align: center;
}

/* When Sort tab is active, make badge more prominent */
.phase-btn.active .count-badge {
  background: var(--overlay-component-bg-lighter);
  color: var(--brand-primary);
  border: 1px solid var(--brand-primary);
}

/* ================================
   TASK CONTEXT BAR (REACTIVE)
   ================================ */

.task-context-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-1_5);
  padding: var(--space-2_5) var(--space-4);
  margin: 0 var(--space-5);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  z-index: var(--z-sticky);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.context-item {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  color: var(--text-secondary);
  flex: 1;
  min-width: 0;
  justify-content: center;
}

.context-item:first-child {
  justify-content: flex-start;
}

.context-item:last-child {
  justify-content: flex-end;
}

.context-divider {
  width: 1px;
  height: var(--space-3);
  background: var(--border-subtle);
  opacity: 0.5;
}

.context-empty {
  color: var(--text-muted);
  opacity: 0.6;
}

.overdue-text {
  color: var(--color-priority-high);
  font-weight: var(--font-semibold);
}

.priority-indicator {
  width: var(--space-2);
  height: var(--space-2);
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.priority-indicator.priority-high {
  background: var(--color-priority-high);
}

.priority-indicator.priority-medium {
  background: var(--color-priority-medium);
}

.priority-indicator.priority-low {
  background: var(--color-priority-low);
}

.priority-indicator.priority-none {
  background: var(--text-muted);
  opacity: 0.3;
}

.project-text {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-emoji {
  font-size: var(--text-sm);
  line-height: 1;
}

/* ================================
   MAIN CONTENT
   ================================ */

.qs-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: var(--z-base);
}

/* ================================
   CAPTURE PHASE
   ================================ */

.capture-phase {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: var(--space-5);
  overflow-y: auto;
  touch-action: pan-y; /* Capture phase needs vertical scroll */
}

.capture-input-area {
  margin-bottom: var(--space-6);
}

.capture-card {
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-2xl);
  padding: var(--space-5);
}

.capture-input {
  width: 100%;
  padding: var(--space-4);
  background: var(--overlay-component-bg-lighter);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: var(--text-lg);
  font-weight: var(--font-medium);
  outline: none;
  transition: all var(--duration-normal) ease;
}

.capture-input::placeholder {
  color: var(--text-muted);
}

.capture-input:focus {
  border-color: var(--state-hover-border);
  box-shadow: 0 0 0 3px var(--state-hover-bg);
}

.quick-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-4);
  flex-wrap: wrap;
}

.quick-action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-size: var(--text-meta);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.quick-action-btn.active {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.quick-action-btn:active {
  transform: scale(0.95);
}

.priority-high {
  color: var(--color-priority-high);
}

.add-task-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  margin-top: var(--space-4);
  padding: var(--space-4);
  background: transparent;
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-lg);
  color: var(--brand-primary);
  font-size: var(--text-base);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-task-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.add-task-btn:not(:disabled):active {
  transform: scale(0.98);
}

/* Recently Added */
.recently-added {
  flex: 1;
}

.section-title {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: var(--space-3);
}

.recent-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-bg-weak);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-2);
}

.check-icon {
  color: var(--color-success);
}

.recent-title {
  flex: 1;
  font-size: var(--text-base);
  color: var(--text-secondary);
}

/* Task list transitions */
.task-list-enter-active {
  transition: all var(--duration-slow) ease;
}

.task-list-leave-active {
  transition: all var(--duration-normal) ease;
}

.task-list-enter-from {
  opacity: 0;
  transform: translateY(calc(-1 * var(--space-2_5)));
}

.task-list-leave-to {
  opacity: 0;
  transform: translateX(calc(-1 * var(--space-5)));
}

/* ================================
   SORT PHASE
   ================================ */

.sort-phase {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: var(--space-3) var(--space-4);
  padding-bottom: 0;
  overflow: hidden;
  min-height: 0; /* Allow flex shrinking */
}

/* Process Flow Indicator - Shows sorting hierarchy */
.process-flow-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  margin-bottom: var(--space-3);
  background: var(--glass-bg-subtle);
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border-light);
}

.flow-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-0_5);
  opacity: 0.5;
  transition: all var(--duration-normal) ease;
}

.flow-step.active {
  opacity: 1;
}

.flow-step.active .flow-label {
  color: var(--brand-primary);
  font-weight: var(--font-semibold);
}

.flow-icon {
  font-size: var(--text-base);
}

.flow-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.flow-arrow {
  color: var(--text-muted);
  font-size: var(--text-xs);
  opacity: 0.3;
}

/* Swipe hints - 4 direction layout */
.swipe-hints {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-4);
  margin-bottom: var(--space-3);
  animation: fadeInOut 3s ease-in-out infinite;
}

.swipe-hints .hint-row {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

@keyframes fadeInOut {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}

.hint {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.hint.hint-up,
.hint.hint-down {
  flex-direction: column;
  gap: 0;
}

.hint.hint-left {
  color: var(--color-danger);
}

.hint.hint-right {
  color: var(--brand-primary);
}

/* Card Stack */
.card-stack {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  perspective: 1000px;
  min-height: var(--kanban-column-min-height);
  max-height: 320px; /* Component-specific card layout dimension */
}

.stack-card {
  position: absolute;
  width: 92%;
  max-width: 360px; /* Component-specific card width */
  height: 240px; /* Component-specific card height */
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border-light);
  border-radius: var(--radius-2xl);
}

/* Main Task Card */
.task-card {
  position: relative;
  width: 92%;
  max-width: 360px; /* Component-specific card width */
  min-height: 180px; /* Component-specific card height */
  max-height: 260px; /* Component-specific card height */
  background: linear-gradient(
    145deg,
    var(--canvas-task-bg),
    var(--surface-secondary)
  );
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-2xl);
  box-shadow:
    var(--shadow-2xl),
    var(--shadow-dark-lg),
    inset 0 1px 0 var(--glass-bg-weak);
  z-index: var(--z-sticky);
  touch-action: none; /* 4-directional swipe needs full touch control */
  user-select: none;
  overflow: hidden;
}

.task-card.swiping {
  cursor: grabbing;
}

.task-card.swipe-up,
.task-card.swipe-down {
  cursor: grabbing;
}

/* Swipe Indicators */
.swipe-indicator {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-2xl);
  pointer-events: none;
  transition: opacity var(--duration-instant) ease;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-sticky); /* Above blurred content */
}

/* Left swipe = Delete (destructive - red) */
.swipe-indicator.left {
  border: var(--space-0_5) solid var(--color-danger);
  background: var(--danger-bg-subtle);
}

/* Right swipe = Save (positive action - teal) */
.swipe-indicator.right {
  border: var(--space-0_5) solid var(--brand-primary);
  background: var(--brand-bg-subtle);
}

/* Up swipe = Edit (info - blue) */
.swipe-indicator.up {
  border: var(--space-0_5) solid var(--color-info);
  background: var(--blue-bg-subtle);
}

/* Down swipe = Skip (muted) */
.swipe-indicator.down {
  border: var(--space-0_5) solid var(--glass-border-hover);
  background: var(--glass-bg-medium);
}

.swipe-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  color: inherit;
}

/* Left swipe content = Delete (red) */
.swipe-indicator.left .swipe-content {
  color: var(--color-danger);
}

/* Right swipe content = Save (teal) */
.swipe-indicator.right .swipe-content {
  color: var(--brand-primary);
}

/* Up swipe content = Edit (blue) */
.swipe-indicator.up .swipe-content {
  color: var(--color-info);
}

/* Down swipe content = Skip (muted) */
.swipe-indicator.down .swipe-content {
  color: var(--text-secondary);
}

.swipe-content span {
  font-size: var(--text-sm);
  font-weight: var(--font-bold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Card Content */
.card-content {
  position: relative;
  padding: var(--space-6);
  padding-bottom: var(--space-8);
  height: 100%;
  display: flex;
  flex-direction: column;
  z-index: 1; /* Below swipe indicators */
  will-change: filter, opacity;
}

.priority-strip {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: var(--space-1);
  border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
}

.priority-strip.priority-high {
  background: linear-gradient(90deg, var(--color-priority-high), var(--priority-high-text));
}

.priority-strip.priority-medium {
  background: linear-gradient(90deg, var(--color-priority-medium), var(--priority-medium-text));
}

.priority-strip.priority-low {
  background: linear-gradient(90deg, var(--color-priority-low), var(--priority-low-text));
}

.priority-strip.priority-none {
  background: transparent;
}

.task-title {
  font-size: var(--text-xl); /* 20px */
  font-weight: var(--font-bold);
  line-height: var(--leading-tight);
  margin: 0 0 var(--space-3);
  color: var(--text-primary);
  letter-spacing: -0.01em;
  overflow-wrap: anywhere; /* Break long URLs/strings that have no spaces */
  word-break: break-word;
  /* Hard height cap — reliable fallback for all browsers */
  max-height: 5.2em; /* ~3 lines at line-height 1.25 + small buffer */
  overflow: hidden;
  /* Progressive enhancement: show ellipsis where supported */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  /* RTL support */
  text-align: start;
  unicode-bidi: plaintext;
}

.task-description {
  flex: 1;
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  color: var(--text-secondary);
  margin: 0;
  overflow: hidden;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.task-meta {
  display: flex;
  gap: var(--space-3);
  margin-top: auto;
  padding-top: var(--space-3);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-1_5) var(--space-2_5);
  background: var(--glass-bg-weak);
  border-radius: var(--radius-md);
  font-size: var(--text-meta);
  color: var(--text-muted);
}

.meta-item.priority-high {
  color: var(--color-priority-high);
  background: var(--priority-high-bg);
}

.meta-item.priority-medium {
  color: var(--color-priority-medium);
  background: var(--priority-medium-bg);
}

.meta-item.priority-low {
  color: var(--color-priority-low);
  background: var(--priority-low-bg);
}

.capitalize {
  text-transform: capitalize;
}

/* ================================
   THUMB ZONE (Bottom Controls)
   ================================ */

.thumb-zone {
  padding: var(--space-4) var(--space-5);
  padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom, var(--space-6)));
  background: linear-gradient(to top, var(--overlay-bg), var(--overlay-component-bg-lighter), transparent);
  margin-top: auto;
  flex-shrink: 0;
  touch-action: pan-x pan-y; /* Allow horizontal scroll on date pills + vertical scroll */
}

.quick-edit-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  margin-bottom: var(--space-2);
}

.edit-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  min-width: 52px;
}

.priority-pills,
.date-pills {
  display: flex;
  gap: var(--space-1_5);
  flex: 1;
}

.date-pills-scroll {
  display: flex;
  gap: var(--space-2_5);
  flex: 1;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding-bottom: var(--space-px); /* Prevent cut-off on scroll */
  padding-inline-end: var(--space-4);
  scroll-snap-type: x proximity;
}

.date-pills-scroll::-webkit-scrollbar {
  display: none;
}

.date-row {
  overflow: visible;
}

.pill {
  flex: 0 0 auto;
  padding: var(--space-2) var(--space-2_5);
  min-height: var(--dropdown-trigger-height-compact);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  white-space: nowrap;
}

.pill.active {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.priority-pills .pill {
  flex: 1;
}

.pill.active {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.pill.clear {
  flex: 0;
  padding: var(--space-2);
  color: var(--text-muted);
}

.pill:active {
  transform: scale(0.95);
}

/* Action Row - 4 buttons: Done, Save, Assign, Delete */
.action-row {
  display: flex;
  gap: var(--space-2);
  padding-top: var(--space-3);
  margin-top: var(--space-2);
}

.action-btn {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: var(--space-1_5);
  padding: var(--space-2_5) var(--space-2);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.action-btn.done {
  color: var(--color-success);
  border-color: var(--success-border);
}

.action-btn.done:active {
  background: var(--success-bg-subtle);
}

.action-btn.assign {
  color: var(--brand-primary);
  border-color: var(--state-hover-border);
}

.action-btn.assign:active {
  background: var(--state-hover-bg);
}

.action-btn.save {
  color: var(--brand-primary);
  border-color: var(--state-hover-border);
  position: relative;
}

.action-btn.save:active {
  background: var(--state-hover-bg);
}

.dirty-dot {
  width: var(--space-2);
  height: var(--space-2);
  border-radius: var(--radius-full);
  background: var(--brand-primary);
  animation: dirty-pulse 2s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes dirty-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.8); }
}

.action-btn.delete {
  flex: 0 0 auto;
  padding: var(--space-2_5);
  color: var(--color-danger);
  border-color: var(--danger-border-subtle);
}

.action-btn.delete:active {
  background: var(--danger-bg-subtle);
}

.action-btn:active {
  transform: scale(0.95);
}

/* ================================
   COMPLETION PHASE
   ================================ */

.completion-phase {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
}

.celebration-container {
  text-align: center;
  max-width: 320px; /* Component-specific container width */
}

.confetti-burst {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.celebration-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--space-32);
  height: var(--space-32);
  background: linear-gradient(135deg, var(--state-active-bg), var(--state-hover-bg));
  border: var(--task-card-selection-border) solid var(--state-hover-border);
  border-radius: var(--radius-full);
  color: var(--brand-primary);
  margin-bottom: var(--space-6);
  animation: celebratePop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes celebratePop {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

.celebration-title {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  margin: 0 0 var(--space-2);
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-hover));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.celebration-subtitle {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin: 0 0 var(--space-8);
}

.session-summary {
  display: flex;
  justify-content: center;
  gap: var(--space-6);
  margin-bottom: var(--space-8);
}

.summary-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-number {
  font-size: var(--text-2xl); /* 24px */
  font-weight: var(--font-bold);
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.return-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-6);
  background: var(--glass-bg-weak);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.return-btn:active {
  transform: scale(0.98);
  background: var(--glass-bg-light);
}

/* ================================
   PROJECT SHEET
   ================================ */

.sheet-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  backdrop-filter: blur(var(--blur-xs));
  -webkit-backdrop-filter: blur(var(--blur-xs));
  display: flex;
  align-items: flex-end;
  z-index: var(--z-dropdown);
}

.project-sheet {
  width: 100%;
  max-height: 70vh;
  background: var(--surface-primary);
  border-top-left-radius: var(--radius-2xl);
  border-top-right-radius: var(--radius-2xl);
  padding: var(--space-4) var(--space-5);
  padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom));
  overflow-y: auto;
}

.sheet-handle {
  width: var(--dropdown-trigger-height-compact);
  height: var(--space-1);
  background: var(--glass-border-strong);
  border-radius: var(--radius-full);
  margin: 0 auto var(--space-5);
}

.sheet-title {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  margin: 0 0 var(--space-4);
  text-align: center;
}

/* Project Search */
.project-search-wrapper {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  margin-bottom: var(--space-3);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  z-index: var(--z-base);
}

.search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.project-search {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-base);
  outline: none;
}

.project-search::placeholder {
  color: var(--text-muted);
}

/* Recent Projects Section */
.recent-projects-section {
  margin-bottom: var(--space-3);
}

.section-label {
  display: block;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: var(--space-2);
}

.recent-projects-grid {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding-bottom: var(--space-1);
}

.recent-projects-grid::-webkit-scrollbar {
  display: none;
}

.recent-project-chip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
  padding: var(--space-2) var(--space-3);
  background: var(--brand-bg-subtle);
  border: 1px solid var(--brand-border-subtle);
  border-radius: var(--radius-full);
  color: var(--text-primary);
  font-size: var(--text-meta);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
  white-space: nowrap;
  box-shadow: var(--shadow-xs);
}

.recent-project-chip:active {
  transform: scale(0.95);
  background: var(--state-active-bg);
  box-shadow: var(--shadow-sm);
}

.chip-emoji {
  font-size: var(--text-base);
}

.chip-name {
  max-width: 120px; /* Component-specific chip width */
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Depth indicator for deeply nested items */
.depth-indicator {
  font-size: var(--text-xs);
  color: var(--text-muted);
  background: var(--glass-bg-weak);
  padding: var(--space-0_5) var(--space-1_5);
  border-radius: var(--radius-sm);
  margin-left: auto;
}

/* No results message */
.no-results {
  padding: var(--space-8) var(--space-4);
  text-align: center;
  color: var(--text-muted);
  font-size: var(--text-sm);
  background: var(--glass-bg-subtle);
  border-radius: var(--radius-lg);
  margin: var(--space-4) 0;
}

.project-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.project-option {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-weak);
  border: 1px solid var(--glass-border-light);
  border-radius: var(--radius-xl);
  color: var(--text-primary);
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
}

.hierarchy-line {
  position: absolute;
  left: var(--space-4);
  top: 50%;
  transform: translateY(-50%);
  height: 100%;
  display: flex;
  align-items: center;
}

.hierarchy-connector {
  width: var(--space-3);
  height: var(--space-px);
  background: var(--border-subtle);
  margin-left: auto;
  border-radius: var(--radius-none);
}

.project-option:active {
  background: var(--glass-bg-light);
  transform: scale(0.98);
}

.project-indicator {
  width: var(--project-indicator-size-md);
  height: var(--project-indicator-size-md);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  font-size: var(--text-xl);
}

.project-name {
  flex: 1;
  text-align: left;
}

/* Inbox option - special styling */
.inbox-option {
  background: var(--brand-bg-subtle);
  border-color: var(--brand-border-subtle);
  flex-wrap: wrap;
}

.inbox-indicator {
  background: transparent !important;
}

.option-hint {
  width: 100%;
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin-top: var(--space-1);
  padding-left: calc(var(--project-indicator-size-md) + var(--space-3));
}

/* Project divider */
.project-divider {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: var(--space-4) 0;
  color: var(--text-muted);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.project-divider::before,
.project-divider::after {
  content: '';
  flex: 1;
  height: var(--space-px);
  background: var(--border-subtle);
}

/* Sheet transition */
.sheet-enter-active,
.sheet-leave-active {
  transition: all var(--duration-slow) cubic-bezier(0.16, 1, 0.3, 1);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .project-sheet,
.sheet-leave-to .project-sheet,
.sheet-enter-from .ai-sheet,
.sheet-leave-to .ai-sheet {
  transform: translateY(100%);
}

/* ================================
   MINI CELEBRATION
   ================================ */

.mini-celebration {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-6) var(--space-8);
  background: var(--success-border-active);
  border-radius: var(--radius-2xl);
  color: white;
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  z-index: var(--z-modal);
  pointer-events: none;
}

.celebration-enter-active {
  animation: miniCelebrate 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.celebration-leave-active {
  animation: miniCelebrate var(--duration-slow) ease reverse;
}

@keyframes miniCelebrate {
  0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
  50% { transform: translate(-50%, -50%) scale(1.1); }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}

/* ================================
   DELETE CONFIRMATION MODAL
   ================================ */

.confirm-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-dark);
  backdrop-filter: blur(var(--blur-xs));
  -webkit-backdrop-filter: blur(var(--blur-xs));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
}

.confirm-modal {
  background: linear-gradient(145deg, var(--canvas-task-bg), var(--surface-secondary));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-2xl);
  padding: var(--space-8);
  text-align: center;
  max-width: 320px; /* Component-specific modal width */
  margin: var(--space-4);
}

.confirm-icon {
  color: var(--color-danger);
  margin: 0 auto var(--space-4);
}

.confirm-modal h3 {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  margin: 0 0 var(--space-2);
}

.confirm-modal p {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  margin: 0 0 var(--space-6);
}

.confirm-actions {
  display: flex;
  gap: var(--space-3);
}

.confirm-actions button {
  flex: 1;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.cancel-btn {
  background: var(--glass-bg-weak);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
}

.cancel-btn:active {
  background: var(--glass-bg-light);
}

.delete-btn {
  background: var(--color-danger);
  border: none;
  color: white;
}

.delete-btn:active {
  opacity: 0.9;
  transform: scale(0.98);
}

/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: all var(--duration-normal) ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .confirm-modal,
.modal-leave-to .confirm-modal {
  transform: scale(0.95);
}

/* ================================
   QUICK EDIT PANEL
   ================================ */

.quick-edit-sheet {
  width: 100%;
  max-height: 60vh;
  background: var(--surface-secondary);
  border-top-left-radius: var(--radius-2xl);
  border-top-right-radius: var(--radius-2xl);
  padding: var(--space-4) var(--space-5);
  padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom));
}

.edit-section {
  margin-bottom: var(--space-5);
}

.edit-section .edit-label {
  display: block;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: var(--space-2);
}

.edit-section .priority-pills,
.edit-section .date-pills {
  display: flex;
  gap: var(--space-2);
}

.edit-section .pill {
  flex: 1;
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.edit-section .pill.active {
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.edit-section .pill:active {
  transform: scale(0.98);
}

.assign-project-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--state-hover-bg);
  border: 1px solid var(--state-hover-border);
  border-radius: var(--radius-lg);
  color: var(--brand-primary);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
  margin-top: var(--space-4);
}

.assign-project-btn:active {
  background: var(--state-active-bg);
  transform: scale(0.98);
}

/* ================================
   SMALL SCREEN ADAPTATIONS
   ================================ */

@media (max-height: 700px) {
  .card-stack {
    max-height: 200px;
    min-height: 160px;
  }

  .task-card {
    max-height: 180px;
    min-height: 140px;
  }

  .stack-card {
    height: 160px;
  }

  .card-content {
    padding: var(--space-4);
    padding-bottom: var(--space-5);
  }

  .task-title {
    font-size: var(--text-lg);
    max-height: 3.8em; /* ~3 lines */
    -webkit-line-clamp: 2;
  }

  .process-flow-indicator {
    display: none;
  }
}

/* ================================
   AI QUICK ACTIONS (TASK-1221)
   ================================ */

.ai-row {
  border-top: 1px solid var(--glass-border);
  padding-top: var(--space-2);
}

.pill.ai-pill {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  gap: var(--space-1);
}

.pill.ai-pill:active {
  background: var(--brand-bg-subtle);
}

.pill.ai-pill.is-loading {
  opacity: 0.7;
}

.pill.ai-pill:disabled {
  opacity: 0.4;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spin {
  animation: spin 1s linear infinite;
}

/* AI Results Bottom Sheet (TASK-1221) */
.ai-sheet {
  width: 100%;
  max-height: 70vh;
  overflow-y: auto;
  background: var(--surface-primary);
  border-top-left-radius: var(--radius-2xl);
  border-top-right-radius: var(--radius-2xl);
  padding: var(--space-4) var(--space-5);
  padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom));
}

.ai-sheet-body {
  padding: 0;
}

.ai-error-text {
  color: var(--danger);
  font-size: var(--text-sm);
  margin: 0 0 var(--space-3) 0;
}

.ai-suggestions-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.ai-suggestion-item {
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
}

.ai-suggestion-top {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-1);
}

.ai-field-name {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  text-transform: capitalize;
}

.ai-confidence {
  font-size: var(--text-xs);
  color: var(--brand-primary);
  font-weight: var(--font-semibold);
}

.ai-suggestion-change {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
}

.ai-from {
  color: var(--text-muted);
  text-decoration: line-through;
}

.ai-arrow {
  color: var(--brand-primary);
}

.ai-to {
  color: var(--text-primary);
  font-weight: var(--font-semibold);
}

.ai-reason {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: var(--space-1) 0 0 0;
  font-style: italic;
}

/* AI Batch List */
.ai-batch-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1_5);
  margin-bottom: var(--space-3);
  max-height: 300px;
  overflow-y: auto;
}

.ai-batch-item {
  padding: var(--space-1_5) var(--space-2);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
}

.ai-batch-name {
  font-size: var(--text-sm);
  color: var(--text-primary);
  display: block;
  margin-bottom: var(--space-0_5);
}

.ai-batch-tags {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.ai-tag {
  font-size: 10px;
  padding: 1px var(--space-1);
  background: var(--glass-bg-medium);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
}

/* AI Explain Results */
.ai-explain-desc {
  font-size: var(--text-sm);
  color: var(--text-primary);
  margin: 0 0 var(--space-2) 0;
  line-height: 1.5;
}

.ai-explain-steps {
  margin: 0 0 var(--space-3) 0;
  padding-left: var(--space-5);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.ai-explain-steps li {
  margin-bottom: var(--space-1);
}

/* Sheet Action Buttons */
.sheet-actions {
  display: flex;
  gap: var(--space-2);
}

.sheet-btn {
  flex: 1;
  padding: var(--space-2_5) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal);
  backdrop-filter: blur(8px);
}

.sheet-btn.primary {
  background: var(--glass-bg-soft);
  border: 1px solid var(--brand-primary);
  color: var(--brand-primary);
}

.sheet-btn.primary:active {
  background: rgba(78, 205, 196, 0.15);
}

.sheet-btn.secondary {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
}

.sheet-btn.secondary:active {
  background: var(--glass-bg-medium);
}

/* AI Sort Feedback */
.ai-sort-feedback {
  background: var(--brand-bg-subtle) !important;
  border-color: var(--brand-primary) !important;
  color: var(--brand-primary) !important;
}

/* ================================
   ACCESSIBILITY - REDUCED MOTION
   ================================ */

@media (prefers-reduced-motion: reduce) {
  .task-card,
  .progress-fill,
  .progress-glow,
  .celebration-icon,
  .mini-celebration,
  .dirty-dot,
  .spin {
    animation: none !important;
    transition: none !important;
  }

  .swipe-hints {
    animation: none;
    opacity: 0.5;
  }
}

/* ================================
   RTL LAYOUT SUPPORT
   ================================ */

[dir="rtl"] .qs-header {
  flex-direction: row-reverse;
}

[dir="rtl"] .header-content {
  text-align: right;
}

[dir="rtl"] .qs-title {
  flex-direction: row-reverse;
}

[dir="rtl"] .card-content {
  text-align: right;
}

[dir="rtl"] .task-meta {
  flex-direction: row-reverse;
}

[dir="rtl"] .meta-item {
  flex-direction: row-reverse;
}

[dir="rtl"] .quick-edit-row {
  flex-direction: row-reverse;
}

[dir="rtl"] .priority-pills,
[dir="rtl"] .date-pills,
[dir="rtl"] .date-pills-scroll {
  flex-direction: row-reverse;
}

[dir="rtl"] .action-row {
  flex-direction: row-reverse;
}

[dir="rtl"] .action-btn {
  flex-direction: row-reverse;
}

[dir="rtl"] .quick-actions {
  flex-direction: row-reverse;
}

[dir="rtl"] .quick-action-btn {
  flex-direction: row-reverse;
}

[dir="rtl"] .recent-item {
  flex-direction: row-reverse;
}

[dir="rtl"] .capture-input {
  text-align: right;
  direction: rtl;
}

[dir="rtl"] .project-option {
  flex-direction: row-reverse;
}

[dir="rtl"] .project-name {
  text-align: right;
}

[dir="rtl"] .swipe-hints .hint-row {
  flex-direction: row-reverse;
}

[dir="rtl"] .hint-left {
  flex-direction: row-reverse;
}

[dir="rtl"] .hint-right {
  flex-direction: row-reverse;
}

[dir="rtl"] .phase-btn {
  flex-direction: row-reverse;
}

[dir="rtl"] .add-task-btn {
  flex-direction: row-reverse;
}

[dir="rtl"] .return-btn {
  flex-direction: row-reverse;
}

[dir="rtl"] .assign-project-btn {
  flex-direction: row-reverse;
}
</style>
