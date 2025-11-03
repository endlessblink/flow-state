<template>
  <div class="project-tree-item">
    <!-- The project itself -->
    <BaseNavItem
      :data-testid="`project-sidebar-item`"
      :data-project-name="project.name.toLowerCase()"
      :active="taskStore.activeProjectId === project.id"
      :project-id="project.id"
      :has-children="hasChildren"
      :expanded="isExpanded"
      :color-dot="project.color"
      :color-type="project.colorType"
      :emoji="project.emoji"
      :count="taskStore.getProjectTaskCount(project.id)"
      :nested="nested"
      @click="$emit('click', project)"
      @toggle-expand="toggleExpand"
      @contextmenu.prevent="$emit('contextmenu', $event, project)"
      @project-drop="$emit('project-drop', $event)"
    >
      {{ project.name }}
    </BaseNavItem>

    <!-- Recursively render children if expanded -->
    <div
      v-if="hasChildren && isExpanded"
      class="nested-children"
    >
      <ProjectTreeItem
        v-for="child in children"
        :key="child.id"
        :project="child"
        :expanded-projects="expandedProjects"
        nested
        @click="(project) => $emit('click', project)"
        @toggle-expand="(projectId) => $emit('toggle-expand', projectId)"
        @contextmenu="(event, project) => $emit('contextmenu', event, project)"
        @project-drop="(data) => $emit('project-drop', data)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onRenderTracked, onRenderTriggered, watchEffect } from 'vue'
import { useTaskStore, type Project } from '@/stores/tasks'
import BaseNavItem from './base/BaseNavItem.vue'

interface Props {
  project: Project
  expandedProjects: string[]
  nested?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  nested: false
})

const emit = defineEmits<{
  click: [project: Project]
  'toggle-expand': [projectId: string]
  contextmenu: [event: MouseEvent, project: Project]
  'project-drop': [data: any]
}>()

const taskStore = useTaskStore()

// DEBUG: Monitor component re-renders (disabled in production)
// onRenderTracked((e) => {
//   console.log(`🔍 ProjectTreeItem RenderTracked: ${props.project.name}`, {
//     key: e.key,
//     type: e.type,
//     target: e.target
//   })
// })

// onRenderTriggered((e) => {
//   console.log(`🔍 ProjectTreeItem RenderTriggered: ${props.project.name}`, {
//     key: e.key,
//     type: e.type,
//     target: e.target
//   })
// })

// DEBUG: Watch prop changes (disabled in production)
// watchEffect(() => {
//   console.log(`🔍 ProjectTreeItem Props Changed: ${props.project.name}`, {
//     projectId: props.project.id,
//     project: props.project,
//     expandedProjects: props.expandedProjects,
//     isNested: props.nested
//   })
// })

// DEBUG: Watch store changes that affect this component (disabled in production)
// watchEffect(() => {
//   console.log(`🔍 TaskStore Projects Changed: ${props.project.name}`, {
//     totalProjects: taskStore.projects.length,
//     hasChildren: taskStore.projects.some(p => p.parentId === props.project.id)
//   })
// })

// Check if this project has children
const hasChildren = computed(() => {
  return taskStore.projects.some(p => p.parentId === props.project.id)
})

// Check if this project is expanded
const isExpanded = computed(() => {
  return props.expandedProjects.includes(props.project.id)
})

// Get children of this project
const children = computed(() => {
  return taskStore.projects.filter(p => p.parentId === props.project.id)
})

// Toggle expansion
const toggleExpand = () => {
  emit('toggle-expand', props.project.id)
}

// Component lifecycle logging (disabled in production)
// onMounted(() => {
//   console.log(`🔍 ProjectTreeItem mounted: ${props.project.name}`, {
//     projectId: props.project.id,
//     hasChildren: hasChildren.value,
//     isExpanded: isExpanded.value,
//     childrenCount: children.value.length
//   })
// })
</script>

<style scoped>
.project-tree-item {
  display: flex;
  flex-direction: column;
}

.nested-children {
  margin-left: var(--space-6);
  margin-top: var(--space-1);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
</style>
