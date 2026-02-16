<template>
  <!-- TASK-157: Simplified Todoist-style Catalog header -->
  <div class="view-controls view-controls--minimal">
    <!-- View Type Toggle -->
    <div class="view-type-toggle view-type-toggle--minimal">
      <button
        class="view-type-btn"
        :class="{ active: viewType === 'table' }"
        @click="$emit('update:viewType', 'table')"
      >
        <LayoutList :size="18" :stroke-width="1.5" />
        Table
      </button>
      <button
        class="view-type-btn"
        :class="{ active: viewType === 'list' }"
        @click="$emit('update:viewType', 'list')"
      >
        <List :size="18" :stroke-width="1.5" />
        List
      </button>
    </div>

    <!-- Filter Toggle (collapsed by default) -->
    <button
      class="filter-toggle"
      :class="{ active: showFilters }"
      title="Toggle filters"
      @click="showFilters = !showFilters"
    >
      <SlidersHorizontal :size="20" :stroke-width="1.5" />
    </button>

    <!-- Hide Done Tasks Toggle (always visible as icon) -->
    <button
      v-if="hideDoneTasks !== undefined"
      class="done-toggle"
      :class="{ active: hideDoneTasks }"
      :title="hideDoneTasks ? 'Show completed tasks' : 'Hide completed tasks'"
      @click="$emit('update:hideDoneTasks', !hideDoneTasks)"
    >
      <EyeOff v-if="hideDoneTasks" :size="20" :stroke-width="1.5" />
      <Eye v-else :size="20" :stroke-width="1.5" />
    </button>
  </div>

  <!-- Collapsible Filter Bar -->
  <Transition name="slide-down">
    <div v-if="showFilters" class="filter-bar">
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
          Expand
        </BaseButton>
        <BaseButton variant="secondary" size="sm" @click="$emit('collapseAll')">
          <ChevronsUp :size="16" />
          Collapse
        </BaseButton>
      </div>

      <!-- Group By Control -->
      <div class="control-wrapper">
        <CustomSelect
          :model-value="groupBy"
          :options="groupByOptions"
          @update:model-value="$emit('update:groupBy', $event as string)"
        />
      </div>

      <!-- Sort Control -->
      <div class="control-wrapper">
        <CustomSelect
          :model-value="sortBy"
          :options="sortOptions"
          @update:model-value="$emit('update:sortBy', $event as string)"
        />
      </div>

      <!-- Filter Control -->
      <div class="control-wrapper">
        <CustomSelect
          :model-value="filterStatus"
          :options="filterOptions"
          @update:model-value="$emit('update:filterStatus', $event as string)"
        />
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { AlignJustify, List, LayoutList, ChevronsDown, ChevronsUp, Eye, EyeOff, SlidersHorizontal } from 'lucide-vue-next'
import BaseButton from '@/components/base/BaseButton.vue'
import CustomSelect from '@/components/common/CustomSelect.vue'

export type ViewType = 'table' | 'list'
export type DensityType = 'compact' | 'comfortable' | 'spacious'

defineProps<Props>()

// Use explicit function signature to avoid emit type inference issues
const _emit = defineEmits<{
  (e: 'update:viewType', value: ViewType): void
  (e: 'update:density', value: DensityType): void
  (e: 'update:sortBy', value: string): void
  (e: 'update:groupBy', value: string): void
  (e: 'update:filterStatus', value: string): void
  (e: 'update:hideDoneTasks', value: boolean): void
  (e: 'expandAll'): void
  (e: 'collapseAll'): void
}>()

// TASK-157: Filters hidden by default for cleaner look
const showFilters = ref(false)

interface Props {
  viewType: ViewType
  density: DensityType
  sortBy: string
  groupBy: string
  filterStatus: string
  hideDoneTasks?: boolean
}

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

const groupByOptions = [
  { label: 'No Grouping', value: 'none' },
  { label: 'Project', value: 'project' },
  { label: 'Status', value: 'status' },
  { label: 'Priority', value: 'priority' },
  { label: 'Due Date', value: 'dueDate' }
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
  gap: var(--space-0_5);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: var(--space-0_5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.density-option {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2);
  background: transparent;
  border: 1px solid transparent;
  border-radius: calc(var(--radius-md) - 2px);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.density-option:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  color: var(--text-primary);
}

.density-option.active {
  /* Outlined active state (not filled) - consistent with BaseButton variant-active */
  background: transparent;
  border-color: var(--brand-primary);
  color: var(--text-primary);
  box-shadow: 0 0 0 1px var(--brand-primary) inset;
}

.control-wrapper {
  min-width: 140px;
}

.hide-done-toggle {
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-md);
  position: relative;
  user-select: none;
}

.hide-done-toggle.icon-only {
  padding: var(--space-2);
  /* Match height of other controls roughly */
  height: 38px;
  width: 38px;
  justify-content: center;
}

.hide-done-toggle:hover {
  background: linear-gradient(
    135deg,
    var(--state-hover-bg) 0%,
    var(--glass-bg-soft) 100%
  );
  border-color: var(--state-hover-border);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.hide-done-toggle.active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  color: var(--state-active-text);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

/* TASK-157: Minimal Catalog Header Styles */
.view-controls--minimal {
  padding: var(--space-2) 0;
  gap: var(--space-2);
}

.view-type-toggle--minimal {
  background: transparent;
  border: none;
  gap: var(--space-1);
}

.view-type-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.view-type-btn:hover {
  background: var(--glass-bg-heavy);
  color: var(--text-primary);
}

.view-type-btn.active {
  background: var(--color-indigo-bg-medium);
  color: var(--color-indigo);
}

.filter-toggle,
.done-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.filter-toggle:hover,
.done-toggle:hover {
  background: var(--glass-bg-heavy);
  color: var(--text-primary);
}

.filter-toggle.active,
.done-toggle.active {
  background: var(--color-indigo-bg-medium);
  color: var(--color-indigo);
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--border-subtle);
}

/* Slide-down transition */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all var(--duration-normal) var(--ease-out);
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.slide-down-enter-to,
.slide-down-leave-from {
  max-height: 60px;
}
</style>
