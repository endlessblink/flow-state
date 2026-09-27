<template>
  <section
    id="task-focus-reorder-list"
    class="task-focus-queue"
    :aria-label="t('kanban.reorder_tasks')"
  >
    <header class="task-focus-queue__header">
      <div>
        <h3>{{ t('kanban.up_next') }}</h3>
        <p v-if="!sortIsManual" class="task-focus-queue__hint">
          {{ t('kanban.reorder_switches_manual') }}
        </p>
        <p v-else class="task-focus-queue__hint">
          {{ t('kanban.reorder_hint') }}
        </p>
      </div>
      <span class="task-focus-queue__count">{{ draftTasks.length }}</span>
    </header>

    <!-- eslint-disable vue/prefer-true-attribute-shorthand -- WebKitGTK parity (BUG-1335) requires explicit booleans -->
    <draggable
      v-model="draftTasks"
      item-key="id"
      tag="ol"
      class="task-focus-queue__list"
      handle=".task-focus-queue__handle"
      :animation="150"
      :force-fallback="true"
      :fallback-on-body="true"
      :fallback-tolerance="4"
      ghost-class="task-focus-queue__row--ghost"
      chosen-class="task-focus-queue__row--chosen"
      drag-class="task-focus-queue__row--drag"
      :move="allowDragMove"
      @start="isDragging = true"
      @end="finishDrag"
    >
      <template #item="{ element: task, index }">
        <li
          class="task-focus-queue__row"
          :class="{ 'is-current': task.id === activeTaskId, 'starts-section': startsSection(index) }"
          :data-section-label="startsSection(index) ? sectionOf(task).label : undefined"
          :data-reorder-task-id="task.id"
          tabindex="0"
          @keydown.alt.up.stop.prevent="move(task.id, -1)"
          @keydown.alt.down.stop.prevent="move(task.id, 1)"
        >
          <button
            type="button"
            class="task-focus-queue__handle"
            :aria-label="t('kanban.drag_to_reorder', { title: task.title })"
            tabindex="-1"
          >
            <GripVertical :size="16" aria-hidden="true" />
          </button>
          <span class="task-focus-queue__position">{{ index + 1 }}</span>
          <button
            type="button"
            class="task-focus-queue__title"
            dir="auto"
            :title="task.title"
            @click="$emit('jumpTo', task.id)"
          >
            <span
              v-if="task.priority"
              class="task-focus-queue__priority"
              :class="`is-${task.priority}`"
              aria-hidden="true"
            />
            <span class="task-focus-queue__text">{{ task.title }}</span>
            <span v-if="task.id === activeTaskId" class="task-focus-queue__now">{{ t('kanban.now') }}</span>
          </button>
          <div class="task-focus-queue__actions">
            <button
              type="button"
              :disabled="!canMakeNext(task.id)"
              :aria-label="t('kanban.make_next_named', { title: task.title })"
              :title="t('kanban.make_next')"
              @click="makeNext(task.id)"
            >
              <CornerDownRight :size="15" aria-hidden="true" />
            </button>
            <button
              type="button"
              :disabled="!canMove(task.id, -1)"
              :aria-label="t('kanban.move_up_named', { title: task.title })"
              :title="t('kanban.move_up')"
              @click="move(task.id, -1)"
            >
              <ArrowUp :size="15" aria-hidden="true" />
            </button>
            <button
              type="button"
              :disabled="!canMove(task.id, 1)"
              :aria-label="t('kanban.move_down_named', { title: task.title })"
              :title="t('kanban.move_down')"
              @click="move(task.id, 1)"
            >
              <ArrowDown :size="15" aria-hidden="true" />
            </button>
          </div>
        </li>
      </template>
    </draggable>
    <!-- eslint-enable vue/prefer-true-attribute-shorthand -->
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import draggable from 'vuedraggable'
import { ArrowDown, ArrowUp, CornerDownRight, GripVertical } from 'lucide-vue-next'
import type { Task } from '@/stores/tasks'
import { getSharedOrderSection } from '@/utils/taskOrdering'
import { moveIdAfter, moveIdBy } from './taskFocusReorder'

const props = defineProps<{
  tasks: Task[]
  activeTaskId: string | null
  sortIsManual: boolean
}>()

const emit = defineEmits<{
  reorder: [taskIds: string[]]
  jumpTo: [taskId: string]
}>()

const { t } = useI18n()

// The panel owns a draft order. Incoming task updates (realtime, sync) must
// not reshuffle rows under the user's cursor, so the draft only follows props
// while idle; after a local change it waits until the saved order arrives.
const draftIds = ref<string[]>(props.tasks.map(task => task.id))
const isDragging = ref(false)
const pendingIds = ref<string[] | null>(null)
let pendingTimer: ReturnType<typeof setTimeout> | null = null

const tasksById = computed(() => new Map(props.tasks.map(task => [task.id, task])))

const draftTasks = computed<Task[]>({
  get: () => draftIds.value.map(id => tasksById.value.get(id)).filter((task): task is Task => !!task),
  set: (tasks) => { draftIds.value = tasks.map(task => task.id) },
})

const sameOrder = (first: string[], second: string[]) =>
  first.length === second.length && first.every((id, index) => id === second[index])

const clearPending = () => {
  pendingIds.value = null
  if (pendingTimer) clearTimeout(pendingTimer)
  pendingTimer = null
}

watch(() => props.tasks.map(task => task.id), (incoming) => {
  if (isDragging.value) return
  if (pendingIds.value) {
    if (!sameOrder(incoming, pendingIds.value)) {
      // Keep the user's order visible but reflect added/removed tasks.
      const incomingSet = new Set(incoming)
      const kept = draftIds.value.filter(id => incomingSet.has(id))
      const added = incoming.filter(id => !kept.includes(id))
      draftIds.value = [...kept, ...added]
      return
    }
    clearPending()
  }
  draftIds.value = incoming
})

const commit = (nextIds: string[]) => {
  if (sameOrder(nextIds, props.tasks.map(task => task.id))) {
    draftIds.value = nextIds
    return
  }
  draftIds.value = nextIds
  pendingIds.value = nextIds
  if (pendingTimer) clearTimeout(pendingTimer)
  // Never stay detached from the real order: resync after a save window.
  pendingTimer = setTimeout(() => {
    clearPending()
    draftIds.value = props.tasks.map(task => task.id)
  }, 4000)
  emit('reorder', nextIds)
}

const finishDrag = () => {
  isDragging.value = false
  commit([...draftIds.value])
}

const focusRow = async (taskId: string) => {
  await nextTick()
  const selectorId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(taskId) : taskId.replace(/"/g, '\\"')
  document.querySelector<HTMLElement>(`[data-reorder-task-id="${selectorId}"]`)?.focus()
}

// BUG-2106: the order is synced with Canvas day groups, so moves stay inside
// a task's day; changing the day is done by changing the date.
const OTHER_SECTION = { rank: Number.POSITIVE_INFINITY, key: '__other__', label: '' }
const sectionOf = (task: Task) => getSharedOrderSection(task) ?? OTHER_SECTION
const sectionKeyOfId = (taskId: string) => {
  const task = tasksById.value.get(taskId)
  return task ? sectionOf(task).key : OTHER_SECTION.key
}
const startsSection = (index: number) => {
  const current = draftTasks.value[index]
  if (!current) return false
  const previous = draftTasks.value[index - 1]
  const label = sectionOf(current).label
  return !!label && (!previous || sectionOf(previous).key !== sectionOf(current).key)
}
const canMove = (taskId: string, offset: number) => {
  const index = draftIds.value.indexOf(taskId)
  const neighbour = draftIds.value[index + offset]
  return index >= 0 && !!neighbour && sectionKeyOfId(neighbour) === sectionKeyOfId(taskId)
}
const allowDragMove = (event: { draggedContext?: { element?: Task }, relatedContext?: { element?: Task } }) => {
  const dragged = event.draggedContext?.element
  const related = event.relatedContext?.element
  if (!dragged || !related) return true
  return sectionOf(dragged).key === sectionOf(related).key
}

const move = (taskId: string, offset: number) => {
  if (!canMove(taskId, offset)) return
  const nextIds = moveIdBy(draftIds.value, taskId, offset)
  if (nextIds === draftIds.value) return
  commit(nextIds)
  void focusRow(taskId)
}

const canMakeNext = (taskId: string) => {
  if (!props.activeTaskId || taskId === props.activeTaskId) return false
  if (sectionKeyOfId(taskId) !== sectionKeyOfId(props.activeTaskId)) return false
  const activeIndex = draftIds.value.indexOf(props.activeTaskId)
  return draftIds.value.indexOf(taskId) !== activeIndex + 1
}

const makeNext = (taskId: string) => {
  if (!props.activeTaskId || !canMakeNext(taskId)) return
  const nextIds = moveIdAfter(draftIds.value, taskId, props.activeTaskId)
  if (nextIds === draftIds.value) return
  commit(nextIds)
  void focusRow(taskId)
}

onBeforeUnmount(clearPending)
</script>
