<template>
  <BaseModal
    :is-open="isOpen"
    title="Add existing tasks to lane"
    size="md"
    @close="$emit('close')"
  >
    <div class="lane-add-tasks">
      <BaseInput
        v-model="search"
        placeholder="Search tasks…"
        aria-label="Search tasks to add to this lane"
        class="search-input"
      />

      <div v-if="candidates.length === 0" class="empty">
        {{ allCandidates.length === 0
          ? 'Every task is already in this lane (or you have no other tasks).'
          : 'No tasks match your search.' }}
      </div>

      <ul v-else class="task-list" role="listbox" aria-label="Tasks you can add">
        <li v-for="task in candidates" :key="task.id" class="task-row">
          <label class="task-label">
            <input
              type="checkbox"
              class="task-check"
              :checked="selected.has(task.id)"
              @change="toggle(task.id)"
            >
            <span class="task-title" dir="auto">{{ task.title }}</span>
            <BaseBadge variant="info" class="project-badge">
              {{ projectName(task.projectId) }}
            </BaseBadge>
          </label>
        </li>
      </ul>
    </div>

    <template #footer>
      <BaseButton variant="ghost" @click="$emit('close')">Cancel</BaseButton>
      <BaseButton
        variant="primary"
        :disabled="selected.size === 0"
        :aria-label="`Add ${selected.size} to lane`"
        @click="confirm"
      >
        Add {{ selected.size }} to lane
      </BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'

const props = defineProps<{ isOpen: boolean; laneId: string }>()
const emit = defineEmits<{ add: [ids: string[]]; close: [] }>()

const taskStore = useTaskStore()
const projectStore = useProjectStore()

const search = ref('')
const selected = ref<Set<string>>(new Set())

// Reset state each time the modal opens
watch(() => props.isOpen, (open) => {
  if (open) {
    search.value = ''
    selected.value = new Set()
  }
})

// All assignable tasks NOT already in this lane (cross-project). Use _rawTasks so the
// active smart-view/status filter doesn't hide otherwise-assignable tasks.
const allCandidates = computed(() =>
  taskStore._rawTasks.filter(t =>
    !(t as Record<string, unknown>)._soft_deleted &&
    !t.isCompletionRecord &&
    !t.parentTaskId &&
    t.laneId !== props.laneId
  )
)

const candidates = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = q
    ? allCandidates.value.filter(t => (t.title || '').toLowerCase().includes(q))
    : allCandidates.value
  return list.slice(0, 200) // safety cap for very large lists
})

const projectName = (projectId: string | null | undefined) =>
  projectStore.getProjectDisplayName(projectId)

const toggle = (id: string) => {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

const confirm = () => {
  if (selected.value.size === 0) return
  emit('add', [...selected.value])
}
</script>

<style scoped>
.lane-add-tasks {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-height: 200px;
}

.search-input {
  width: 100%;
}

.empty {
  padding: var(--space-6) var(--space-3);
  text-align: center;
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.task-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 360px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.task-row {
  border-radius: var(--radius-md);
}

.task-label {
  display: flex;
  align-items: center;
  gap: var(--space-2_5);
  padding: var(--space-2) var(--space-2_5);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--duration-fast);
}

.task-label:hover {
  background: var(--glass-bg-soft);
}

.task-check {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--brand-primary);
}

.task-title {
  flex: 1;
  min-width: 0;
  color: var(--text-primary);
  font-size: var(--text-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-badge {
  flex-shrink: 0;
}
</style>
