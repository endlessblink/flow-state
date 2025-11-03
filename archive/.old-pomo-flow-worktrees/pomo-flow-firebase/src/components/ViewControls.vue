<template>
  <div class="view-controls">
    <!-- View Type Toggle -->
    <div class="view-type-toggle">
      <BaseButton
        :variant="viewType === 'table' ? 'active' : 'secondary'"
        size="sm"
        @click="$emit('update:viewType', 'table')"
      >
        <LayoutList :size="16" />
        Table
      </BaseButton>
      <BaseButton
        :variant="viewType === 'list' ? 'active' : 'secondary'"
        size="sm"
        @click="$emit('update:viewType', 'list')"
      >
        <List :size="16" />
        List
      </BaseButton>
    </div>

    <!-- Density Control (Table View Only) -->
    <div v-if="viewType === 'table'" class="density-control">
      <button
        v-for="option in densityOptions"
        :key="option.value"
        class="density-option"
        :class="{ active: density === option.value }"
        :title="option.label"
        @click="$emit('update:density', option.value)"
      >
        <component :is="option.icon" :size="16" />
      </button>
    </div>

    <!-- Expand/Collapse Controls (List View Only) -->
    <div v-if="viewType === 'list'" class="tree-controls">
      <BaseButton variant="secondary" size="sm" @click="$emit('expandAll')">
        <ChevronsDown :size="16" />
        Expand All
      </BaseButton>
      <BaseButton variant="secondary" size="sm" @click="$emit('collapseAll')">
        <ChevronsUp :size="16" />
        Collapse All
      </BaseButton>
    </div>

    <!-- Sort Control -->
    <div class="control-wrapper">
      <CustomSelect
        :model-value="sortBy"
        :options="sortOptions"
        @update:model-value="$emit('update:sortBy', $event)"
      />
    </div>

    <!-- Filter Control -->
    <div class="control-wrapper">
      <CustomSelect
        :model-value="filterStatus"
        :options="filterOptions"
        @update:model-value="$emit('update:filterStatus', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { AlignJustify, List, LayoutList, ChevronsDown, ChevronsUp } from 'lucide-vue-next'
import BaseButton from '@/components/base/BaseButton.vue'
import CustomSelect from '@/components/CustomSelect.vue'

export type ViewType = 'table' | 'list'
export type DensityType = 'compact' | 'comfortable' | 'spacious'

interface Props {
  viewType: ViewType
  density: DensityType
  sortBy: string
  filterStatus: string
}

defineProps<Props>()

defineEmits<{
  'update:viewType': [value: ViewType]
  'update:density': [value: DensityType]
  'update:sortBy': [value: string]
  'update:filterStatus': [value: string]
  expandAll: []
  collapseAll: []
}>()

const densityOptions = [
  { value: 'compact' as DensityType, label: 'Compact', icon: AlignJustify },
  { value: 'comfortable' as DensityType, label: 'Comfortable', icon: List },
  { value: 'spacious' as DensityType, label: 'Spacious', icon: LayoutList }
]

const sortOptions = [
  { label: 'Due Date', value: 'dueDate' },
  { label: 'Priority', value: 'priority' },
  { label: 'Title', value: 'title' },
  { label: 'Created', value: 'created' }
]

const filterOptions = [
  { label: 'All Status', value: 'all' },
  { label: 'To Do', value: 'planned' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Done', value: 'done' }
]
</script>

<style scoped>
.view-controls {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) 0;
}

.view-type-toggle {
  display: flex;
  gap: var(--space-1);
}

.tree-controls {
  display: flex;
  gap: var(--space-1);
}

.density-control {
  display: flex;
  gap: 2px;
  background-color: var(--surface-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 2px;
}

.density-option {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2);
  background-color: transparent;
  border: none;
  border-radius: calc(var(--radius-md) - 2px);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.density-option:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

.density-option.active {
  background-color: var(--color-primary);
  color: var(--color-primary-contrast);
}

.control-wrapper {
  min-width: 140px;
}
</style>
