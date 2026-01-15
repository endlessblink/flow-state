<template>
  <section v-if="dependencies.length > 0" class="form-section collapsible">
    <div class="section-toggle-wrapper">
      <button class="section-toggle" type="button" @click="isExpanded = !isExpanded">
        <component
          :is="ChevronDown"
          :size="16"
          class="chevron-icon"
          :class="{ 'rotated': !isExpanded }"
        />
        Waiting On
        <span class="count-badge">{{ dependencies.length }}</span>
      </button>
    </div>

    <div v-show="isExpanded" class="section-content">
      <div class="dependencies-list">
        <div 
          v-for="dep in dependencies" 
          :key="dep.id" 
          class="dependency-item"
        >
          <div class="dependency-icon">
            <component 
              :is="getStatusIcon(dep.status)" 
              :size="14"
              :class="getStatusClass(dep.status)"
            />
          </div>
          <span class="dependency-title">{{ dep.title }}</span>
          <span class="dependency-status">{{ getStatusLabel(dep.status) }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { 
  ChevronDown, Circle, PlayCircle, CheckCircle, Archive, AlertCircle 
} from 'lucide-vue-next'
import { type Task } from '@/stores/tasks'

defineProps<{
  dependencies: Task[]
}>()

const isExpanded = ref(true)

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'planned': return Circle
    case 'in_progress': return PlayCircle
    case 'done': return CheckCircle
    case 'backlog': return Archive
    default: return AlertCircle
  }
}

const getStatusClass = (status: string) => {
  switch (status) {
    case 'planned': return 'status-planned'
    case 'in_progress': return 'status-progress'
    case 'done': return 'status-done'
    case 'backlog': return 'status-backlog'
    default: return 'status-planned'
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'in_progress': return 'Active'
    default: return status.charAt(0).toUpperCase() + status.slice(1)
  }
}
</script>

<style scoped>
.collapsible {
  margin-bottom: var(--space-4);
}

.section-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  background: transparent;
  border: none;
  padding: var(--space-2) 0;
  cursor: pointer;
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.section-toggle:hover { color: var(--text-secondary); }

.chevron-icon {
  transition: transform var(--duration-normal);
  color: var(--text-muted);
}
.chevron-icon.rotated { transform: rotate(-90deg); }

.count-badge {
  font-size: var(--text-xs);
  background: var(--glass-bg-weak);
  padding: 1px var(--space-1_5);
  border-radius: var(--radius-md);
  color: var(--text-tertiary);
  margin-left: var(--space-1);
}

.section-content {
  animation: slideDown var(--duration-normal);
  padding-left: var(--space-2);
}

@keyframes slideDown {
  from { opacity: 0; max-height: 0; }
  to { opacity: 1; max-height: 500px; }
}

.dependencies-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.dependency-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--glass-bg-subtle);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
}

.dependency-title {
  flex: 1;
  color: var(--text-secondary);
  font-weight: var(--font-medium);
}

.dependency-status {
  color: var(--text-tertiary);
  font-size: var(--text-xs);
  text-transform: uppercase;
}

.status-planned { color: var(--text-muted); }
.status-progress { color: var(--color-active); }
.status-done { color: var(--color-success); }
.status-backlog { color: var(--text-tertiary); }
</style>
