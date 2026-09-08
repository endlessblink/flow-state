<template>
  <section
    class="task-focus-timeline"
    tabindex="0"
    :aria-label="t('kanban.focus_timeline')"
    @keydown.left.prevent="movePrevious"
    @keydown.right.prevent="moveNext"
  >
    <div v-if="activeTask" class="task-focus-window">
      <div class="task-focus-track">
        <button
          v-if="visiblePreviousTask"
          class="task-card task-focus-card task-focus-card--previous"
          type="button"
          :data-task-id="visiblePreviousTask.id"
          :aria-label="t('kanban.focus_previous_named', { title: visiblePreviousTask.title })"
          @click="movePrevious"
          @contextmenu.prevent="$emit('contextMenu', $event, visiblePreviousTask)"
        >
          <span class="task-focus-card-index">{{ t('kanban.task_number', { number: activeIndex }) }}</span>
          <strong>{{ visiblePreviousTask.title }}</strong>
          <span>{{ taskMeta(visiblePreviousTask) }}</span>
        </button>
        <div v-else class="task-focus-spacer" aria-hidden="true" />

        <span class="task-focus-connector" :class="{ 'is-muted': !visiblePreviousTask }" aria-hidden="true" />

        <article class="task-focus-card task-focus-card--active">
          <span class="task-focus-card-index">
            {{ t('kanban.task_number_now', { number: activeIndex + 1 }) }}
          </span>
          <TaskCard
            :task="activeTask"
            @select="$emit('selectTask', $event)"
            @start-timer="$emit('startTimer', $event)"
            @edit="$emit('editTask', $event)"
            @delete="$emit('deleteTask', $event)"
            @context-menu="(event, task) => $emit('contextMenu', event, task)"
          />
        </article>

        <span class="task-focus-connector" :class="{ 'is-muted': !visibleNextTask }" aria-hidden="true" />

        <button
          v-if="visibleNextTask"
          class="task-card task-focus-card task-focus-card--next"
          type="button"
          :data-task-id="visibleNextTask.id"
          :aria-label="t('kanban.focus_next_named', { title: visibleNextTask.title })"
          @click="moveNext"
          @contextmenu.prevent="$emit('contextMenu', $event, visibleNextTask)"
        >
          <span class="task-focus-card-index">{{ t('kanban.task_number', { number: activeIndex + 2 }) }}</span>
          <strong>{{ visibleNextTask.title }}</strong>
          <span>{{ taskMeta(visibleNextTask) }}</span>
        </button>
        <div v-else class="task-focus-spacer" aria-hidden="true" />
      </div>

      <nav class="task-focus-controls" :aria-label="t('kanban.focus_navigation')">
        <button
          type="button"
          :disabled="!visiblePreviousTask"
          :aria-label="t('kanban.previous_task')"
          @click="movePrevious"
        >
          <ChevronRight v-if="isRtl" :size="19" />
          <ChevronLeft v-else :size="19" />
        </button>
        <span>{{ t('kanban.focus_position', { current: activeIndex + 1, total: tasks.length }) }}</span>
        <button
          type="button"
          :disabled="!visibleNextTask"
          :aria-label="t('kanban.next_task')"
          @click="moveNext"
        >
          <ChevronLeft v-if="isRtl" :size="19" />
          <ChevronRight v-else :size="19" />
        </button>
        <button
          class="task-focus-reorder-toggle"
          type="button"
          :class="{ 'is-active': showReorder }"
          :aria-expanded="showReorder"
          aria-controls="task-focus-reorder-list"
          :aria-label="t('kanban.reorder_tasks')"
          @click="toggleReorder"
        >
          <ListRestart :size="18" />
        </button>
      </nav>

      <div
        v-if="showReorder"
        id="task-focus-reorder-list"
        class="task-focus-reorder-list"
        :aria-label="t('kanban.reorder_tasks')"
      >
        <button
          v-for="(task, index) in reorderTaskItems"
          :key="task.id"
          type="button"
          class="task-focus-reorder-item"
          :class="{ 'is-dragging': draggedTaskId === task.id }"
          :data-reorder-task-id="task.id"
          draggable="true"
          @dragstart="startReorder(task.id)"
          @dragover.prevent="moveDraggedTo(task.id)"
          @dragend="finishReorder"
          @keydown.alt.left.stop.prevent="moveReorderTask(task.id, -1)"
          @keydown.alt.right.stop.prevent="moveReorderTask(task.id, 1)"
        >
          <GripVertical :size="16" aria-hidden="true" />
          <span>{{ index + 1 }}</span>
          <strong>{{ task.title }}</strong>
        </button>
      </div>
    </div>

    <div v-else class="task-focus-empty">
      <p>{{ t('kanban.no_tasks_project') }}</p>
      <button type="button" @click="$emit('addTask')">
        <Plus :size="17" />{{ t('kanban.add_task') }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight, GripVertical, ListRestart, Plus } from 'lucide-vue-next'
import type { Task } from '@/stores/tasks'
import TaskCard from './TaskCard.vue'
import './TaskFocusTimeline.css'

const props = defineProps<{ tasks: Task[] }>()

const emit = defineEmits<{
  selectTask: [taskId: string]
  startTimer: [taskId: string]
  editTask: [taskId: string]
  deleteTask: [taskId: string]
  contextMenu: [event: MouseEvent, task: Task]
  addTask: []
  reorderTasks: [taskIds: string[]]
}>()

const { locale, t } = useI18n()
const activeIndex = ref(0)
const showReorder = ref(false)
const reorderIds = ref<string[]>([])
const draggedTaskId = ref<string | null>(null)
const activeTask = computed(() => props.tasks[activeIndex.value])
const visiblePreviousTask = computed(() => props.tasks[activeIndex.value - 1])
const visibleNextTask = computed(() => props.tasks[activeIndex.value + 1])
const isRtl = computed(() => /^(he|ar|fa|ur)(-|$)/i.test(locale.value))
const reorderTaskItems = computed(() => {
  const tasksById = new Map(props.tasks.map(task => [task.id, task]))
  return reorderIds.value.map(id => tasksById.get(id)).filter((task): task is Task => !!task)
})

watch(() => props.tasks, (tasks, previousTasks) => {
  const previousActiveId = previousTasks?.[activeIndex.value]?.id
  const retainedIndex = previousActiveId ? tasks.findIndex(task => task.id === previousActiveId) : -1
  activeIndex.value = retainedIndex >= 0 ? retainedIndex : Math.min(activeIndex.value, Math.max(tasks.length - 1, 0))
  reorderIds.value = tasks.map(task => task.id)
})

const toggleReorder = () => {
  showReorder.value = !showReorder.value
  if (showReorder.value) reorderIds.value = props.tasks.map(task => task.id)
}

const startReorder = (taskId: string) => {
  draggedTaskId.value = taskId
}

const moveDraggedTo = (targetTaskId: string) => {
  if (!draggedTaskId.value || draggedTaskId.value === targetTaskId) return
  const nextIds = [...reorderIds.value]
  const sourceIndex = nextIds.indexOf(draggedTaskId.value)
  const targetIndex = nextIds.indexOf(targetTaskId)
  if (sourceIndex < 0 || targetIndex < 0) return
  const [taskId] = nextIds.splice(sourceIndex, 1)
  nextIds.splice(targetIndex, 0, taskId)
  reorderIds.value = nextIds
}

const finishReorder = () => {
  if (!draggedTaskId.value) return
  draggedTaskId.value = null
  emit('reorderTasks', [...reorderIds.value])
}

const moveReorderTask = async (taskId: string, offset: number) => {
  const currentIndex = reorderIds.value.indexOf(taskId)
  const targetIndex = currentIndex + offset
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= reorderIds.value.length) return
  const nextIds = [...reorderIds.value]
  ;[nextIds[currentIndex], nextIds[targetIndex]] = [nextIds[targetIndex], nextIds[currentIndex]]
  reorderIds.value = nextIds
  emit('reorderTasks', nextIds)
  await nextTick()
  document.querySelector<HTMLElement>(`[data-reorder-task-id="${CSS.escape(taskId)}"]`)?.focus()
}

const movePrevious = () => {
  if (activeIndex.value > 0) activeIndex.value -= 1
}

const moveNext = () => {
  if (activeIndex.value < props.tasks.length - 1) activeIndex.value += 1
}

const taskMeta = (task: Task) => task.priority ? t(`kanban.priority_${task.priority}`) : t('kanban.no_priority')
</script>
