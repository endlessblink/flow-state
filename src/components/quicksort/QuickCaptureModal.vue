<template>
  <BaseModal
    :is-open="quickCapture.isModalOpen.value"
    :title="modalTitle"
    :description="modalDescription"
    size="md"
    :show-footer="false"
    :close-on-overlay-click="false"
    close-on-escape
    @close="handleClose"
    @after-open="handleAfterOpen"
  >
    <!-- CAPTURE PHASE -->
    <div v-if="quickCapture.phase.value === 'capture'" class="capture-phase">
      <!-- Input for adding tasks -->
      <div class="capture-input-wrapper">
        <input
          ref="captureInputRef"
          v-model="newTaskTitle"
          type="text"
          class="capture-input"
          :class="[titleAlignmentClasses]"
          :style="titleAlignmentStyles"
          placeholder="Type task and press Enter..."
          maxlength="200"
          @keydown="handleCaptureKeydown"
        >
        <span class="input-hint">
          <kbd>Enter</kbd> add
        </span>
      </div>

      <!-- List of pending tasks -->
      <div v-if="quickCapture.pendingTasks.value.length > 0" class="pending-tasks-list">
        <div class="pending-tasks-header">
          <span class="pending-count">Added ({{ quickCapture.pendingTasks.value.length }})</span>
        </div>

        <TransitionGroup name="task-list" tag="ul" class="task-list">
          <li
            v-for="task in quickCapture.pendingTasks.value"
            :key="task.id"
            class="pending-task-item"
          >
            <span class="task-title-text">{{ task.title }}</span>
            <button
              class="remove-task-btn"
              title="Remove"
              @click="quickCapture.removeTask(task.id)"
            >
              <X :size="14" />
            </button>
          </li>
        </TransitionGroup>
      </div>

      <!-- Empty state -->
      <div v-else class="empty-state">
        <Inbox :size="32" class="empty-icon" />
        <p>Start typing to capture tasks</p>
      </div>

      <!-- Actions -->
      <div class="capture-actions">
        <BaseButton
          variant="secondary"
          @click="handleClose"
        >
          Cancel
        </BaseButton>
        <BaseButton
          variant="primary"
          :disabled="!quickCapture.canStartSorting.value"
          @click="handleStartSorting"
        >
          <span>Sort Now</span>
          <span v-if="quickCapture.pendingTasks.value.length > 0" class="count-badge">
            {{ quickCapture.pendingTasks.value.length }}
          </span>
          <kbd class="shortcut-badge">Tab</kbd>
        </BaseButton>
      </div>
    </div>

    <!-- SORT PHASE -->
    <div v-else-if="quickCapture.phase.value === 'sort'" class="sort-phase">
      <!-- Current task being sorted -->
      <div class="current-task-card">
        <div class="task-progress">
          {{ quickCapture.sortProgress.value.current }} / {{ quickCapture.sortProgress.value.total }}
        </div>
        <h3 class="current-task-title">
          {{ quickCapture.currentTask.value?.title }}
        </h3>
      </div>

      <!-- Project selection -->
      <div class="project-selection">
        <p class="selection-label">Assign to project:</p>

        <div class="project-grid">
          <button
            v-for="(project, index) in visibleProjects"
            :key="project.id"
            class="project-btn"
            @click="handleAssignProject(project.id)"
          >
            <span class="project-emoji">
              {{ getProjectEmoji(project) }}
            </span>
            <span class="project-name">{{ project.name }}</span>
            <kbd class="project-key">{{ index + 1 }}</kbd>
          </button>
        </div>
      </div>

      <!-- Sort actions -->
      <div class="sort-actions">
        <button class="skip-btn" @click="handleSkip">
          <SkipForward :size="16" />
          Skip (S)
        </button>
        <button class="cancel-sort-btn" @click="handleCancelSort">
          <X :size="16" />
          Cancel
        </button>
      </div>
    </div>

    <!-- DONE PHASE -->
    <div v-else-if="quickCapture.phase.value === 'done'" class="done-phase">
      <div class="success-icon">
        <CheckCircle :size="48" />
      </div>

      <h3 class="done-title">
        All {{ quickCapture.sortSummary.value.total }} tasks sorted!
      </h3>

      <!-- Summary by project -->
      <div v-if="quickCapture.summaryEntries.value.length > 0" class="summary-list">
        <div
          v-for="entry in quickCapture.summaryEntries.value"
          :key="entry.projectId ?? 'uncategorized'"
          class="summary-item"
        >
          <span class="summary-project">{{ entry.projectName }}</span>
          <span class="summary-count">{{ entry.count }}</span>
        </div>
      </div>

      <!-- Done actions -->
      <div class="done-actions">
        <BaseButton
          variant="secondary"
          @click="handleAddMore"
        >
          <Plus :size="16" />
          Add More
        </BaseButton>
        <BaseButton
          variant="primary"
          @click="handleDone"
        >
          Done
          <kbd class="shortcut-badge">Enter</kbd>
        </BaseButton>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { X, Inbox, CheckCircle, Plus, SkipForward } from 'lucide-vue-next'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import { useQuickCapture } from '@/composables/useQuickCapture'
import { useTaskStore, type Project } from '@/stores/tasks'
import { useHebrewAlignment } from '@/composables/useHebrewAlignment'

const quickCapture = useQuickCapture()
const taskStore = useTaskStore()

// Template refs
const captureInputRef = ref<HTMLInputElement>()

// Local state
const newTaskTitle = ref('')

// Hebrew alignment
const { getAlignmentClasses, applyInputAlignment } = useHebrewAlignment()
const titleAlignmentClasses = computed(() => getAlignmentClasses(newTaskTitle.value))
const titleAlignmentStyles = computed(() => applyInputAlignment(newTaskTitle.value))

// Computed
const modalTitle = computed(() => {
  switch (quickCapture.phase.value) {
    case 'capture': return 'Quick Capture'
    case 'sort': return 'Sort Tasks'
    case 'done': return 'Complete!'
    default: return 'Quick Capture'
  }
})

const modalDescription = computed(() => {
  switch (quickCapture.phase.value) {
    case 'capture': return 'Rapidly add tasks, then sort them all at once'
    case 'sort': return 'Assign each task to a project'
    case 'done': return ''
    default: return ''
  }
})

// Get top 9 projects for quick assignment (1-9 keys)
const visibleProjects = computed(() => {
  return taskStore.projects.slice(0, 9)
})

// Get project emoji or first letter
function getProjectEmoji(project: Project): string {
  if (project.emoji) return project.emoji
  return project.name.charAt(0).toUpperCase()
}

// Handlers
function handleAfterOpen() {
  nextTick(() => {
    captureInputRef.value?.focus()
  })
}

function handleClose() {
  // If in capture phase with tasks, confirm before closing
  if (quickCapture.phase.value === 'capture' && quickCapture.pendingTasks.value.length > 0) {
    if (!confirm(`Discard ${quickCapture.pendingTasks.value.length} unsorted tasks?`)) {
      return
    }
  }
  quickCapture.closeModal()
}

function handleCaptureKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    if (newTaskTitle.value.trim()) {
      quickCapture.addTask(newTaskTitle.value)
      newTaskTitle.value = ''
    }
  } else if (event.key === 'Tab') {
    event.preventDefault()
    if (quickCapture.canStartSorting.value) {
      handleStartSorting()
    }
  } else if (event.key === 'Backspace' && !newTaskTitle.value) {
    // Remove last task when backspace on empty input
    quickCapture.removeLastTask()
  }
}

function handleStartSorting() {
  if (quickCapture.startSorting()) {
    // Focus will be managed by sort phase
  }
}

async function handleAssignProject(projectId: string) {
  await quickCapture.assignProject(projectId)
}

async function handleSkip() {
  await quickCapture.skipTask()
}

function handleCancelSort() {
  quickCapture.cancelSort()
}

function handleAddMore() {
  quickCapture.addMoreTasks()
  nextTick(() => {
    captureInputRef.value?.focus()
  })
}

function handleDone() {
  quickCapture.closeModal()
}

// Global keyboard handler for sort phase
function handleGlobalKeydown(event: KeyboardEvent) {
  // Only handle in sort phase
  if (quickCapture.phase.value !== 'sort') {
    // Handle Enter in done phase
    if (quickCapture.phase.value === 'done' && event.key === 'Enter') {
      event.preventDefault()
      handleDone()
    }
    return
  }

  // Handle number keys 1-9 for project assignment
  if (event.key >= '1' && event.key <= '9') {
    event.preventDefault()
    const index = parseInt(event.key) - 1
    if (index < visibleProjects.value.length) {
      handleAssignProject(visibleProjects.value[index].id)
    }
  }

  // Handle S for skip
  if (event.key.toLowerCase() === 's') {
    event.preventDefault()
    handleSkip()
  }

  // Handle Escape to cancel sort
  if (event.key === 'Escape') {
    event.preventDefault()
    handleCancelSort()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<style scoped>
/* Capture Phase */
.capture-phase {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.capture-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.capture-input {
  flex: 1;
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  padding: var(--space-3) var(--space-4);
  padding-right: var(--space-16);
  border-radius: var(--radius-lg);
  font-size: var(--text-base);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.capture-input:focus {
  outline: none;
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px var(--brand-primary-alpha-20);
}

.capture-input::placeholder {
  color: var(--text-muted);
}

.input-hint {
  position: absolute;
  right: var(--space-3);
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.input-hint kbd {
  padding: var(--space-0_5) var(--space-1_5);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-family: var(--font-mono);
}

/* Pending tasks list */
.pending-tasks-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.pending-tasks-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pending-count {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.task-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-height: 200px;
  overflow-y: auto;
}

.pending-task-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  transition: all var(--duration-normal);
}

.pending-task-item:hover {
  background: var(--glass-bg-medium);
}

.task-title-text {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.remove-task-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-1);
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--duration-normal);
}

.remove-task-btn:hover {
  background: var(--danger-bg);
  color: var(--danger);
}

/* Task list transitions */
.task-list-enter-active,
.task-list-leave-active {
  transition: all var(--duration-normal) var(--spring-smooth);
}

.task-list-enter-from,
.task-list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-8);
  color: var(--text-muted);
}

.empty-icon {
  opacity: 0.5;
}

/* Capture actions */
.capture-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-subtle);
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 var(--space-1);
  background: var(--bg-primary);
  color: var(--brand-primary);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  margin-left: var(--space-1);
}

.shortcut-badge {
  margin-left: var(--space-2);
  padding: var(--space-0_5) var(--space-1_5);
  background: var(--overlay-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  opacity: 0.8;
}

/* Sort Phase */
.sort-phase {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.current-task-card {
  background: linear-gradient(
    135deg,
    var(--glass-bg-medium) 0%,
    var(--glass-bg-heavy) 100%
  );
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
  text-align: center;
}

.task-progress {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-bottom: var(--space-2);
}

.current-task-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
  line-height: var(--leading-tight);
}

/* Project selection */
.project-selection {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.selection-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  margin: 0;
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
}

.project-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-3);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  position: relative;
}

.project-btn:hover {
  background: var(--glass-bg-medium);
  border-color: var(--brand-primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.project-btn:active {
  transform: translateY(0);
}

.project-emoji {
  font-size: var(--text-2xl);
  line-height: 1;
}

.project-name {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.project-key {
  position: absolute;
  top: var(--space-1);
  right: var(--space-1);
  padding: var(--space-0_5) var(--space-1);
  background: var(--overlay-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-muted);
}

/* Sort actions */
.sort-actions {
  display: flex;
  justify-content: center;
  gap: var(--space-3);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-subtle);
}

.skip-btn,
.cancel-sort-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-4);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.skip-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

.cancel-sort-btn:hover {
  background: var(--danger-bg);
  border-color: var(--danger);
  color: var(--danger);
}

/* Done Phase */
.done-phase {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) 0;
}

.success-icon {
  color: var(--success);
  animation: bounceIn 0.5s var(--spring-bounce);
}

@keyframes bounceIn {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.done-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.summary-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-3);
  width: 100%;
  max-width: 400px;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1_5) var(--space-3);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
}

.summary-project {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.summary-count {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--brand-primary);
}

/* Done actions */
.done-actions {
  display: flex;
  gap: var(--space-3);
  padding-top: var(--space-4);
  width: 100%;
  justify-content: center;
}

/* Responsive */
@media (max-width: 480px) {
  .project-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .capture-actions,
  .done-actions {
    flex-direction: column;
  }
}
</style>
