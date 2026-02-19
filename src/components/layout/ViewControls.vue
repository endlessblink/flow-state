<template>
  <!-- TASK-157: Simplified Todoist-style Catalog header -->
  <div class="view-controls view-controls--minimal">
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
      <!-- Expand/Collapse Controls -->
      <div class="tree-controls">
        <BaseButton variant="secondary" size="sm" @click="$emit('expandAll')">
          <ChevronsDown :size="16" />
          {{ $t('common.expand') }}
        </BaseButton>
        <BaseButton variant="secondary" size="sm" @click="$emit('collapseAll')">
          <ChevronsUp :size="16" />
          {{ $t('common.collapse') }}
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
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronsDown, ChevronsUp, Eye, EyeOff, SlidersHorizontal } from 'lucide-vue-next'
import BaseButton from '@/components/base/BaseButton.vue'
import CustomSelect from '@/components/common/CustomSelect.vue'

defineProps<Props>()

// Use explicit function signature to avoid emit type inference issues
const _emit = defineEmits<{
  (e: 'update:sortBy', value: string): void
  (e: 'update:groupBy', value: string): void
  (e: 'update:filterStatus', value: string): void
  (e: 'update:hideDoneTasks', value: boolean): void
  (e: 'expandAll'): void
  (e: 'collapseAll'): void
}>()

const { t } = useI18n()

// TASK-157: Filters hidden by default for cleaner look
const showFilters = ref(false)

interface Props {
  sortBy: string
  groupBy: string
  filterStatus: string
  hideDoneTasks?: boolean
}

const sortOptions = computed(() => [
  { label: t('filters.sort_due_date'), value: 'dueDate' },
  { label: t('filters.sort_priority'), value: 'priority' },
  { label: t('filters.sort_title'), value: 'title' },
  { label: t('filters.sort_created'), value: 'created' }
])

const groupByOptions = computed(() => [
  { label: t('filters.no_grouping'), value: 'none' },
  { label: t('filters.group_project'), value: 'project' },
  { label: t('filters.group_status'), value: 'status' },
  { label: t('filters.group_priority'), value: 'priority' },
  { label: t('filters.group_due_date'), value: 'dueDate' }
])

const filterOptions = computed(() => [
  { label: t('filters.all_status'), value: 'all' },
  { label: t('task.status_todo'), value: 'planned' },
  { label: t('task.status_in_progress'), value: 'in_progress' },
  { label: t('task.status_done'), value: 'done' }
])
</script>

<style scoped>
.view-controls {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) 0;
}

.tree-controls {
  display: flex;
  gap: var(--space-1);
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
  height: var(--space-9_5);
  width: var(--space-9_5);
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

.filter-toggle,
.done-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--space-8);
  height: var(--space-8);
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
