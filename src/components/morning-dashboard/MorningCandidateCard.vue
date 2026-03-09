<script setup lang="ts">
import { computed } from 'vue'
import { Check } from 'lucide-vue-next'
import { useProjectStore } from '@/stores/projects'
import OverflowTooltip from '@/components/base/OverflowTooltip.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'

const props = defineProps<{
  task: {
    id: string
    title: string
    priority: 'low' | 'medium' | 'high' | null
    dueDate: string
    projectId: string
    estimatedDuration?: number
  }
  isFocused: boolean
  disabled: boolean
}>()

defineEmits<{
  toggle: []
  'context-menu': [event: MouseEvent]
  edit: []
}>()

const projectStore = useProjectStore()

const projectName = computed(() => {
  if (!props.task.projectId) return ''
  return projectStore.getProjectDisplayName(props.task.projectId) || ''
})

const projectColor = computed(() => {
  if (!props.task.projectId) return ''
  const project = projectStore.getProjectById(props.task.projectId)
  if (!project) return 'var(--text-muted)'
  if (project.colorType === 'hex' && typeof project.color === 'string') {
    return project.color
  }
  return 'var(--text-muted)'
})

const priorityVariant = computed(() => {
  switch (props.task.priority) {
    case 'high': return 'danger'
    case 'medium': return 'warning'
    case 'low': return 'info'
    default: return 'default'
  }
})

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
</script>

<template>
  <div
    class="candidate-card"
    :class="{ focused: isFocused, disabled: disabled }"
    @click="$emit('toggle')"
    @contextmenu.prevent="$emit('context-menu', $event)"
    @dblclick="$emit('edit')"
  >
    <div class="card-check">
      <div class="check-circle" :class="{ checked: isFocused }">
        <Check v-if="isFocused" :size="12" />
      </div>
    </div>

    <div class="card-content">
      <OverflowTooltip :text="task.title" class="card-title">
        {{ task.title }}
      </OverflowTooltip>
      <div class="card-meta">
        <span v-if="projectName" class="meta-project">
          <span class="project-dot" :style="{ background: projectColor }" />
          {{ projectName }}
        </span>
        <BaseBadge v-if="task.priority" :variant="priorityVariant" size="sm">
          {{ task.priority }}
        </BaseBadge>
        <span v-if="task.estimatedDuration" class="meta-duration">
          {{ formatDuration(task.estimatedDuration) }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.candidate-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--surface-primary);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
  user-select: none;
}

.candidate-card:hover:not(.disabled) {
  border-color: var(--brand-primary);
  background: var(--glass-bg-soft);
}

.candidate-card.focused {
  border-color: var(--brand-primary);
  background: rgba(78, 205, 196, 0.06);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(78, 205, 196, 0.15);
}

.candidate-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.card-check {
  flex-shrink: 0;
}

.check-circle {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--glass-border);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.check-circle.checked {
  border-color: var(--brand-primary);
  background: var(--brand-primary);
  color: var(--surface-primary);
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
  flex: 1;
}

.card-title {
  font-size: 0.8rem;
  color: var(--text-primary);
  line-height: 1.3;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.meta-project {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 0.65rem;
  color: var(--text-muted);
  max-width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.meta-duration {
  font-size: 0.65rem;
  color: var(--text-muted);
  padding: 0 var(--space-1);
  background: var(--glass-bg-soft);
  border-radius: var(--radius-sm);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .candidate-card {
    transition: none;
  }

  .candidate-card.focused {
    transform: none;
  }
}
</style>
