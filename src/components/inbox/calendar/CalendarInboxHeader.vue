<template>
  <div class="inbox-header">
    <button
      class="collapse-btn"
      :title="isCollapsed ? 'Expand Inbox' : 'Collapse Inbox'"
      @click="$emit('update:isCollapsed', !isCollapsed)"
    >
      <ChevronLeft v-if="!isCollapsed" :size="16" />
      <ChevronRight v-else :size="16" />
    </button>
    <h3 v-if="!isCollapsed" class="inbox-title">
      {{ $t('smart_views.inbox') }}
    </h3>

    <!-- Expanded state count -->
    <NBadge v-if="!isCollapsed" :value="inboxCount" type="info" />

    <!-- Quick Today Filter -->
    <button
      v-if="!isCollapsed"
      class="today-quick-filter"
      :class="{ active: showTodayOnly }"
      :title="`Show tasks due today (${todayCount})`"
      @click="$emit('update:showTodayOnly', !showTodayOnly)"
    >
      <CalendarDays :size="14" />
      <span>{{ $t('calendar.today') }}</span>
      <span v-if="todayCount > 0" class="count-badge">{{ todayCount }}</span>
    </button>

    <!-- TASK-1075: Search Toggle Button -->
    <button
      v-if="!isCollapsed"
      class="search-toggle-btn"
      :class="{ active: isSearchExpanded || searchQuery }"
      title="Search tasks"
      @click="toggleSearch"
    >
      <Search :size="14" />
    </button>
  </div>

  <!-- TASK-1075: Search Input Row -->
  <Transition name="slide-down">
    <div v-if="!isCollapsed && isSearchExpanded" class="search-input-row">
      <div class="search-input-wrapper">
        <Search :size="14" class="search-icon" />
        <input
          ref="searchInputRef"
          type="text"
          class="search-input"
          :value="searchQuery"
          placeholder="Search tasks..."
          @input="handleSearchInput"
          @keydown.escape="toggleSearch"
        >
        <button
          v-if="searchQuery"
          class="clear-search-btn"
          title="Clear search"
          @click="clearSearch"
        >
          <X :size="12" />
        </button>
      </div>
    </div>
  </Transition>

  <!-- Collapsed state task count indicators -->
  <div v-if="isCollapsed" class="collapsed-badges-container">
    <BaseBadge
      v-if="!hasActiveFilters"
      variant="count"
      size="sm"
      rounded
    >
      {{ baseCount }}
    </BaseBadge>
    <div v-else class="dual-badges">
      <BaseBadge
        variant="count"
        size="sm"
        rounded
        class="total-count"
      >
        {{ baseCount }}
      </BaseBadge>
      <BaseBadge
        variant="info"
        size="sm"
        rounded
        class="filtered-count"
      >
        {{ inboxCount }}
      </BaseBadge>
    </div>
  </div>

  <!-- Canvas Group Filter -->
  <div v-if="!isCollapsed && canvasGroupOptions.length > 1" class="canvas-group-filter">
    <CustomSelect
      :model-value="Array.from(selectedCanvasGroups)[0] || ''"
      :options="canvasGroupOptions"
      placeholder="Show from: All Tasks"
      @update:model-value="$emit('update:selectedCanvasGroups', new Set($event ? [String($event)] : []))"
    />
  </div>

  <!-- Additional Filters -->
  <div v-if="!isCollapsed" class="advanced-filters-section">
    <button
      class="toggle-filters-btn"
      :class="{ active: showAdvancedFilters }"
      @click="$emit('update:showAdvancedFilters', !showAdvancedFilters)"
    >
      <Filter :size="14" />
      <span>{{ showAdvancedFilters ? $t('filters.hide_filters_simple') : $t('filters.more_filters') }}</span>
      <ChevronDown :size="14" class="toggle-icon" :class="{ rotated: showAdvancedFilters }" />
    </button>

    <Transition name="slide-down">
      <InboxFilters
        v-if="showAdvancedFilters"
        :unscheduled-only="unscheduledOnly"
        :selected-priorities="selectedPriorities"
        :selected-projects="selectedProjects"
        :selected-durations="selectedDurations"
        :hide-done-tasks="hideDoneTasks"
        :sort-by="sortBy"
        :tasks="baseTasks"
        :projects="rootProjects"
        @update:unscheduled-only="$emit('update:unscheduledOnly', $event)"
        @update:selected-priorities="$emit('update:selectedPriorities', $event)"
        @update:selected-projects="$emit('update:selectedProjects', $event)"
        @update:selected-durations="$emit('update:selectedDurations', $event)"
        @update:hide-done-tasks="$emit('toggleHideDoneTasks')"
        @update:sort-by="$emit('update:sortBy', $event)"
        @clear-all="$emit('clearAllFilters')"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight, CalendarDays, Filter, ChevronDown, Search, X } from 'lucide-vue-next'
import { NBadge } from 'naive-ui'
import BaseBadge from '@/components/base/BaseBadge.vue'
import CustomSelect from '@/components/common/CustomSelect.vue'
import InboxFilters from '@/components/canvas/InboxFilters.vue'
import { type Task } from '@/stores/tasks'
import { type DurationCategory } from '@/utils/durationCategories'
import type { SortByType } from '@/composables/inbox/useUnifiedInboxState'

const { t } = useI18n()

defineProps<{
  isCollapsed: boolean
  inboxCount: number
  showTodayOnly: boolean
  todayCount: number
  hasActiveFilters: boolean
  baseCount: number
  canvasGroupOptions: any[]
  selectedCanvasGroups: Set<string>
  showAdvancedFilters: boolean
  unscheduledOnly: boolean
  selectedPriorities: Set<string>
  selectedProjects: Set<string>
  selectedDurations: Set<DurationCategory>
  hideDoneTasks: boolean
  baseTasks: Task[]
  rootProjects: any[]
  searchQuery: string // TASK-1075
  sortBy?: SortByType // TASK-1303
}>()

const emit = defineEmits<{
  (e: 'update:isCollapsed', value: boolean): void
  (e: 'update:showTodayOnly', value: boolean): void
  (e: 'update:selectedCanvasGroups', value: Set<string>): void
  (e: 'update:showAdvancedFilters', value: boolean): void
  (e: 'update:unscheduledOnly', value: boolean): void
  (e: 'update:selectedPriorities', value: Set<string>): void
  (e: 'update:selectedProjects', value: Set<string>): void
  (e: 'update:selectedDurations', value: Set<DurationCategory>): void
  (e: 'update:searchQuery', value: string): void // TASK-1075
  (e: 'update:sortBy', value: SortByType): void // TASK-1303
  (e: 'toggleHideDoneTasks'): void
  (e: 'clearAllFilters'): void
}>()
// TASK-1075: Search state
const isSearchExpanded = ref(false)
const searchInputRef = ref<HTMLInputElement | null>(null)

const toggleSearch = async () => {
  isSearchExpanded.value = !isSearchExpanded.value
  if (isSearchExpanded.value) {
    await nextTick()
    searchInputRef.value?.focus()
  } else {
    emit('update:searchQuery', '')
  }
}

const handleSearchInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:searchQuery', target.value)
}

const clearSearch = () => {
  emit('update:searchQuery', '')
  searchInputRef.value?.focus()
}

</script>

<style scoped>
.inbox-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
  min-width: 0;
}

/* Glass morphism override for NBadge — no solid fills */
.inbox-header :deep(.n-badge-sup) {
  background: var(--brand-primary-subtle) !important;
  border: 1px solid var(--brand-primary-dim) !important;
  color: var(--brand-primary) !important;
  backdrop-filter: blur(8px);
  font-weight: var(--font-medium);
}

.collapse-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-muted);
  padding: var(--space-1);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--duration-normal) var(--spring-smooth);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.collapse-btn:hover {
  background: var(--state-hover-bg);
  color: var(--text-primary);
}

.inbox-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.today-quick-filter {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: var(--glass-bg-light);
  backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  white-space: nowrap;
  flex-shrink: 0;
}

.today-quick-filter:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.today-quick-filter.active {
  background: var(--brand-bg-subtle);
  border-color: var(--brand-border-subtle);
  color: var(--brand-primary);
}

.today-quick-filter .count-badge {
  background: var(--brand-primary-subtle);
  border: 1px solid var(--brand-primary-dim);
  color: var(--brand-primary);
  font-size: var(--text-xs);
  padding: 0 var(--space-1);
  border-radius: var(--radius-full);
  min-width: 16px;
  text-align: center;
}

.collapsed-badges-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  margin-top: var(--space-2);
}

.dual-badges {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.toggle-filters-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: var(--text-xs);
  cursor: pointer;
  padding: var(--space-1) 0;
  width: 100%;
}

.toggle-filters-btn:hover {
  color: var(--text-primary);
}

.toggle-icon {
  transition: transform var(--duration-normal);
  margin-left: auto;
}

.toggle-icon.rotated {
  transform: rotate(180deg);
}

/* TASK-1075: Search Styles */
.search-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: var(--space-1);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
  flex-shrink: 0;
}

.search-toggle-btn:hover {
  background: var(--surface-hover);
  color: var(--text-secondary);
  border-color: var(--border-hover);
}

.search-toggle-btn.active {
  background: var(--brand-primary-subtle);
  color: var(--brand-primary);
  border-color: var(--brand-primary-dim);
}

.search-input-row {
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--border-light);
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1_5) var(--space-2);
  background: var(--surface-1);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  transition: all var(--duration-normal) var(--ease-out);
}

.search-input-wrapper:focus-within {
  border-color: var(--brand-primary);
  background: var(--surface-2);
  box-shadow: 0 0 0 2px var(--brand-primary-subtle);
}

.search-icon {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--text-sm);
  outline: none;
  min-width: 0;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.clear-search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--surface-hover);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  flex-shrink: 0;
}

.clear-search-btn:hover {
  background: var(--surface-active);
  color: var(--text-primary);
}

/* Slide-down animation */
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
  opacity: 1;
  max-height: 60px;
}
</style>
