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
      </nav>
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
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-vue-next'
import type { Task } from '@/stores/tasks'
import TaskCard from './TaskCard.vue'
import './TaskFocusTimeline.css'

const props = defineProps<{ tasks: Task[] }>()

defineEmits<{
  selectTask: [taskId: string]
  startTimer: [taskId: string]
  editTask: [taskId: string]
  deleteTask: [taskId: string]
  contextMenu: [event: MouseEvent, task: Task]
  addTask: []
}>()

const { locale, t } = useI18n()
const activeIndex = ref(0)
const activeTask = computed(() => props.tasks[activeIndex.value])
const visiblePreviousTask = computed(() => props.tasks[activeIndex.value - 1])
const visibleNextTask = computed(() => props.tasks[activeIndex.value + 1])
const isRtl = computed(() => /^(he|ar|fa|ur)(-|$)/i.test(locale.value))

watch(() => props.tasks, (tasks, previousTasks) => {
  const previousActiveId = previousTasks?.[activeIndex.value]?.id
  const retainedIndex = previousActiveId ? tasks.findIndex(task => task.id === previousActiveId) : -1
  activeIndex.value = retainedIndex >= 0 ? retainedIndex : Math.min(activeIndex.value, Math.max(tasks.length - 1, 0))
})

const movePrevious = () => {
  if (activeIndex.value > 0) activeIndex.value -= 1
}

const moveNext = () => {
  if (activeIndex.value < props.tasks.length - 1) activeIndex.value += 1
}

const taskMeta = (task: Task) => task.priority ? t(`kanban.priority_${task.priority}`) : t('kanban.no_priority')
</script>
