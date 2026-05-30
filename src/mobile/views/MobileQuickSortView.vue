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
      <MobileQuickSortCapture
        v-if="activePhase === 'capture'"
        :title="newTaskTitle"
        :priority="newTaskPriority"
        :due="newTaskDue"
        :recently-added="recentlyAdded"
        @update:title="newTaskTitle = $event"
        @update:priority="newTaskPriority = $event"
        @update:due="newTaskDue = $event"
        @quick-add="handleQuickAdd"
      />

      <!-- SORT PHASE -->
      <div v-else-if="!isComplete" class="sort-phase">
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
            @swipeRight="onSwipeRight"
            @swipeLeft="onSwipeLeft"
            @swipeUp="onSwipeUp"
            @swipeDown="onSwipeDown"
          />
        </div>

        <!-- Action Buttons (right under card) -->
        <MobileQuickSortFilters
          :current-task="currentTask"
          :is-today="isToday"
          :is-tomorrow="isTomorrow"
          :is-weekend="isWeekend"
          :is-task-dirty="isTaskDirty"
          @mark-done="handleMarkDone"
          @save="handleSave"
          @assign="openProjectSheet"
          @delete="showDeleteConfirm = true"
        />
      </div>

      <!-- COMPLETION CELEBRATION -->
      <MobileQuickSortComplete
        v-else
        :session-summary="sessionSummary"
        @go-to-inbox="router.push('/tasks')"
      />
    </main>

    <!-- Project Sheet -->
    <MobileQuickSortProjectSheet
      :show="showProjectSheet"
      :recent-projects="recentProjects"
      :filtered-projects="filteredProjects"
      :project-search="projectSearch"
      @close="showProjectSheet = false; projectSearch = ''"
      @assign-project="handleAssignProject"
      @sort-without-project="handleSortWithoutProject"
      @update:project-search="projectSearch = $event"
    />

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

    <!-- Task Edit Bottom Sheet (swipe-up) -->
    <TaskEditBottomSheet
      :is-open="showEditSheet"
      :task="currentTask"
      @close="showEditSheet = false"
      @save="handleEditSheetSave"
    />

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
                <button class="pill" @click="setDueDateAndClose('nextweek')">
                  +7
                </button>
                <button class="pill date-picker-trigger" @click="($refs.mobileDatePicker as HTMLInputElement)?.showPicker()">
                  <Calendar :size="14" />
                </button>
                <input
                  ref="mobileDatePicker"
                  type="date"
                  class="date-picker-hidden"
                  :value="currentTask?.dueDate || ''"
                  @input="setDueDateDirect(($event.target as HTMLInputElement).value)"
                />
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

    <!-- Celebration Overlay -->
    <Transition name="celebration">
      <div
        v-if="showCelebration"
        class="mini-celebration"
        aria-live="assertive"
        aria-atomic="true"
      >
        <div class="celebration-ring" />
        <CheckCircle :size="28" class="celebration-icon" />
        <span class="celebration-text">{{ celebrationLabel }}</span>
        <span class="celebration-sparkle" aria-hidden="true">✨</span>
      </div>
    </Transition>

    <!-- Nothing Set Reminder Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showNothingSetReminder" class="confirm-overlay">
          <div class="confirm-modal reminder-modal">
            <AlertCircle :size="32" class="reminder-icon" />
            <h3>No details set</h3>
            <p>This task has no priority, due date, or project. Save it anyway?</p>
            <div class="confirm-actions">
              <button class="reminder-set-btn" @click="cancelSave">
                Let me set something
              </button>
              <button class="reminder-save-btn" @click="confirmSaveAnyway">
                Save anyway
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import {
  Zap, Plus, CheckCircle, CalendarDays, Calendar,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  Trash2, FolderOpen, AlertCircle
} from 'lucide-vue-next'

import MobileQuickSortCard from '../components/MobileQuickSortCard.vue'
import MobileQuickSortFilters from '../components/MobileQuickSortFilters.vue'
import MobileQuickSortProjectSheet from '../components/MobileQuickSortProjectSheet.vue'
import MobileQuickSortCapture from '../components/MobileQuickSortCapture.vue'
import MobileQuickSortComplete from '../components/MobileQuickSortComplete.vue'
import TaskEditBottomSheet from '../components/TaskEditBottomSheet.vue'
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
  newTaskTitle,
  newTaskPriority,
  newTaskDue,
  recentlyAdded,
  projectSearch,
  currentTask,
  progress,
  isComplete,
  isTaskDirty,
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
  handleEditSheetSave,
  showEditSheet,
  handleSave,
  handleMarkDone,
  cancelDelete,
  confirmDelete,
  setPriorityAndClose,
  setDueDateAndClose,
  setDueDateDirect,
  openProjectSheet,
  onSwipeRight,
  onSwipeLeft,
  onSwipeUp,
  onSwipeDown,
  showNothingSetReminder,
  confirmSaveAnyway,
  cancelSave,
  celebrationLabel
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
  overflow: hidden; /* WebKitGTK-safe: SOP-060 — was overflow:clip, not supported in WebKitGTK */
  overflow-x: visible;
  scrollbar-width: none; /* BUG-1453: hide scrollbar from overflow-x during card drag */
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
}

.mobile-quick-sort::-webkit-scrollbar {
  display: none; /* BUG-1453: hide scrollbar for Safari/Chrome */
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

.capitalize {
  text-transform: capitalize;
}

/* ================================
   MAIN CONTENT
   ================================ */

.qs-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden; /* WebKitGTK-safe: SOP-060 — was overflow:clip, not supported in WebKitGTK */
  overflow-x: visible;
  z-index: var(--z-base);
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
  overflow-y: auto; /* BUG-1406: Allow scroll to reach action buttons behind nav bar */
  overflow-x: visible; /* BUG-1453: Card must visually escape bounds during swipe drag */
  scrollbar-width: none; /* BUG-1453: hide horizontal scrollbar during card drag */
  min-height: 0; /* Allow flex shrinking */
  touch-action: pan-y; /* BUG-1453: Prevent Android compositor from hijacking horizontal card swipes */
}

.sort-phase::-webkit-scrollbar {
  display: none;
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
  margin-bottom: var(--space-2);
  animation: fadeInOut 3s ease-in-out infinite;
}

.swipe-hints .hint-row {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

@keyframes fadeInOut {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.9; }
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

.hint.hint-down {
  color: var(--text-secondary);
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
  /* BUG-1453: perspective removed — it creates a containing block for position:fixed,
     trapping the card inside this container during swipe drag. Stack cards only use
     2D transforms (scale + translateY) so perspective had no visual effect. */
  min-height: 200px;
  margin-bottom: var(--space-3);
}

.stack-card {
  position: absolute;
  width: 95%;
  max-width: 400px; /* Component-specific card width */
  min-height: 200px; /* Component-specific card height - matches active card */
  height: auto;
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border-light);
  border-radius: var(--radius-2xl);
  pointer-events: none; /* BUG-1453: decorative only, must not intercept mouse/touch from active card */
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
  background: var(--glass-bg-strong);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-2xl);
  z-index: var(--z-modal);
  pointer-events: none;
  /* Particle dots scattered via box-shadow */
}

.mini-celebration::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  /* 8 particle dots that scatter outward during the enter animation */
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--brand-primary) 70%, transparent),
    0 0 0 3px color-mix(in srgb, var(--brand-primary) 50%, transparent),
    0 0 0 3px color-mix(in srgb, var(--brand-primary) 40%, transparent);
  animation: particleBurst 0.55s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
  pointer-events: none;
}

.celebration-ring {
  position: absolute;
  inset: -4px;
  border-radius: var(--radius-2xl);
  border: 2px solid var(--brand-primary);
  opacity: 0;
  animation: ringPulse 0.7s ease-out forwards;
  pointer-events: none;
}

.celebration-icon {
  color: var(--brand-primary);
}

.celebration-text {
  color: var(--brand-primary);
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  letter-spacing: -0.01em;
}

.celebration-sparkle {
  position: absolute;
  top: -12px;
  right: -12px;
  font-size: var(--text-xl);
  animation: sparkleSpin 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.celebration-enter-active {
  animation: miniCelebrate 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.celebration-leave-active {
  animation: miniCelebrateFade var(--duration-slow) ease forwards;
}

@keyframes miniCelebrate {
  0%   { transform: translate(-50%, -50%) scale(0.4) rotate(-4deg); opacity: 0; }
  60%  { transform: translate(-50%, -50%) scale(1.08) rotate(2deg); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; }
}

@keyframes miniCelebrateFade {
  0%   { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(0.85); opacity: 0; }
}

@keyframes ringPulse {
  0%   { transform: scale(1); opacity: 0.8; }
  60%  { transform: scale(1.25); opacity: 0.4; }
  100% { transform: scale(1.5); opacity: 0; }
}

@keyframes particleBurst {
  0%   { box-shadow:
    0 0 0 3px color-mix(in srgb, var(--brand-primary) 70%, transparent),
    0 0 0 3px color-mix(in srgb, var(--brand-primary) 50%, transparent),
    0 0 0 3px color-mix(in srgb, var(--brand-primary) 40%, transparent); }
  100% { box-shadow:
    -24px -24px 0 3px color-mix(in srgb, var(--brand-primary) 0%, transparent),
     24px -24px 0 3px color-mix(in srgb, var(--brand-primary) 0%, transparent),
     24px  24px 0 3px color-mix(in srgb, var(--brand-primary) 0%, transparent); }
}

@keyframes sparkleSpin {
  0%   { transform: scale(0) rotate(-45deg); opacity: 0; }
  70%  { transform: scale(1.3) rotate(10deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
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

/* Nothing Set Reminder Modal overrides */
.reminder-modal {
  border-color: var(--brand-primary);
}

.reminder-icon {
  color: var(--brand-primary);
  margin: 0 auto var(--space-4);
}

/* "Let me set something" — primary teal glass */
.reminder-set-btn {
  flex: 1;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
  background: var(--glass-bg-soft);
  border: 1px solid var(--brand-primary);
  color: var(--brand-primary);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.reminder-set-btn:active {
  background: var(--glass-bg-medium);
  transform: scale(0.98);
}

/* "Save anyway" — ghost/secondary */
.reminder-save-btn {
  flex: 1;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
  background: var(--glass-bg-weak);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
}

.reminder-save-btn:active {
  background: var(--glass-bg-light);
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

.date-picker-trigger {
  padding: var(--space-1_5) var(--space-2_5);
}

.date-picker-hidden {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
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

/* Sheet transition (for Quick Edit Panel) */
.sheet-enter-active,
.sheet-leave-active {
  transition: all var(--duration-slow) cubic-bezier(0.16, 1, 0.3, 1);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .quick-edit-sheet,
.sheet-leave-to .quick-edit-sheet {
  transform: translateY(100%);
}

/* ================================
   SMALL SCREEN ADAPTATIONS
   ================================ */

@media (max-height: 700px) {
  .card-stack {
    min-height: 160px;
  }

  .stack-card {
    height: 160px; /* Matches card height on short screens */
  }

  .process-flow-indicator {
    display: none;
  }
}

/* ================================
   ACCESSIBILITY - REDUCED MOTION
   ================================ */

@media (prefers-reduced-motion: reduce) {
  .progress-fill,
  .progress-glow,
  .mini-celebration,
  .mini-celebration::before,
  .celebration-ring,
  .celebration-sparkle {
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
  text-align: end;
}

[dir="rtl"] .qs-title {
  flex-direction: row-reverse;
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

[dir="rtl"] .assign-project-btn {
  flex-direction: row-reverse;
}
</style>

