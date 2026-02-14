<template>
  <article
    ref="cardRef"
    class="task-card"
    :class="[
      { 'collapsed': progressiveDisclosureEnabled && !isExpanded },
      { 'completed': task.status === 'done' },
      { 'focused': isFocused },
      { 'selected': isSelected },
      { 'timer-active': isTimerActive },
      { 'is-flashing': isFlashing },
      density ? `task-card--${density}` : ''
    ]"
    :tabindex="disabled ? -1 : 0"
    role="button"
    :aria-label="taskAriaLabel"
    :aria-describedby="`task-meta-${task.id}`"
    :aria-pressed="isPressed"
    :aria-expanded="progressiveDisclosureEnabled ? isExpanded : undefined"
    :aria-disabled="disabled"
    data-draggable="true"
    :data-status="task.status"
    :data-priority="task.priority || 'none'"
    @click="handleCardClick"
    @keydown="handleKeydown"
    @contextmenu.prevent="handleRightClick"
    @focus="handleFocus"
    @blur="handleBlur"
  >
    <!-- Status icon and title row -->
    <div class="card-header" :dir="isRtl ? 'rtl' : undefined">
      <!-- Priority Dot -->
      <TaskCardStatus
        :priority="task.priority"
        :status="task.status"
        @cycle="cycleStatus"
      />

      <!-- Title and metadata in flex layout -->
      <div class="title-section">
        <h3
          :id="`task-title-${task.id}`"
          class="task-title"
          :class="[titleAlignmentClasses, { 'completed-title': task.status === 'done' }]"
          :dir="isRtl ? 'rtl' : 'ltr'"
        >
          {{ task.title }}
        </h3>

        <!-- Metadata Badges -->
        <TaskCardBadges
          v-if="!progressiveDisclosureEnabled || isExpanded"
          v-bind="{
            task,
            density,
            formattedDueDate,
            formattedDuration,
            completedSubtasks,
            hasDependencies,
            durationBadgeClass,
            projectVisual
          }"
        />
      </div>

      <!-- Action Buttons -->
      <TaskCardActions
        @focus-mode="enterFocusMode"
        @start-timer="$emit('startTimer', task.id)"
        @edit="$emit('edit', task.id)"
      />
    </div>

    <!-- Progressive Disclosure Content (only when expanded) -->
    <Transition name="expand">
      <div v-show="!progressiveDisclosureEnabled || isExpanded" class="card-details">
        <!-- No additional details needed currently -->
      </div>
    </Transition>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import type { Task } from '@/stores/tasks'
import { useTaskCardState } from '@/composables/tasks/card/useTaskCardState'
import { useTaskCardActions } from '@/composables/tasks/card/useTaskCardActions'
import { useTimerStore } from '@/stores/timer'

// Sub-components
import TaskCardStatus from './card/TaskCardStatus.vue'
import TaskCardBadges from './card/TaskCardBadges.vue'
import TaskCardActions from './card/TaskCardActions.vue'

import './TaskCard.css'

interface Props {
  task: Task
  density?: 'ultrathin' | 'compact' | 'comfortable' | 'spacious'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  density: 'comfortable',
  disabled: false
})

const emit = defineEmits<{
  select: [taskId: string]
  startTimer: [taskId: string]
  edit: [taskId: string]
  delete: [taskId: string]
  contextMenu: [event: MouseEvent, task: Task]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
}>()

// --- Logic ---
const router = useRouter()
const timerStore = useTimerStore()
const state = useTaskCardState(props)
const actions = useTaskCardActions(props, emit as any, state)

// Timer active state
const isTimerActive = computed(() => {
  return timerStore.isTimerActive && timerStore.currentTaskId === props.task.id
})

const {
  isExpanded, isFocused, isPressed, cardRef,
  isSelected, hasDependencies, completedSubtasks,
  formattedDueDate, formattedDuration, durationBadgeClass,
  titleAlignmentClasses, isRtl, projectVisual, taskAriaLabel,
  progressiveDisclosureEnabled
} = state

const {
  handleCardClick, handleKeydown, handleFocus,
  handleBlur, handleRightClick, cycleStatus
} = actions

// Focus mode navigation
const enterFocusMode = () => {
  router.push(`/focus/${props.task.id}`)
}

// TASK-1074: Flash animation when date is set via context menu
const isFlashing = ref(false)
const handleTaskFlash = (event: Event) => {
  const customEvent = event as CustomEvent<{ taskId: string }>
  console.log('[FLASH] TaskCard received event:', customEvent.detail.taskId, 'my id:', props.task?.id)
  if (customEvent.detail.taskId === props.task?.id) {
    console.log('[FLASH] TaskCard match! Setting isFlashing=true')
    isFlashing.value = true
    setTimeout(() => { isFlashing.value = false }, 600)
  }
}
onMounted(() => {
  window.addEventListener('task-action-flash', handleTaskFlash)
})
onUnmounted(() => {
  window.removeEventListener('task-action-flash', handleTaskFlash)
})
</script>

