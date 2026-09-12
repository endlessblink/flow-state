<template>
  <div class="catalog-view-summary" role="group" :aria-label="t('catalog_controls.summary_label')">
    <button
      type="button"
      class="summary-pill summary-pill--global"
      data-testid="global-order-summary"
      @click="emit('openGlobalOrder')"
    >
      {{ globalOrderText }}
    </button>
    <button
      type="button"
      class="summary-pill"
      data-testid="catalog-view-summary"
      @click="emit('openCatalogView')"
    >
      {{ catalogViewText }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  sortBy: string
  sortDirection: 'asc' | 'desc'
  scopeLabel: string
  groupBy: string
  filterStatus: string
  hideDoneTasks: boolean
}>()

const emit = defineEmits<{
  (event: 'openGlobalOrder'): void
  (event: 'openCatalogView'): void
}>()

const { t } = useI18n()

const sortLabels: Record<string, string> = {
  dueDate: 'catalog_controls.due_date',
  priority: 'filters.sort_priority',
  title: 'filters.sort_title',
  created: 'filters.sort_created',
  manual: 'catalog_controls.manual',
}

const groupLabels: Record<string, string> = {
  none: 'filters.no_grouping',
  project: 'filters.group_project',
  status: 'filters.group_status',
  priority: 'filters.group_priority',
  dueDate: 'filters.group_due_date',
  lane: 'catalog_controls.lane',
}

const statusLabels: Record<string, string> = {
  todo: 'task.status_todo',
  done: 'task.status_done',
}

const sortLabel = computed(() => t(sortLabels[props.sortBy] ?? sortLabels.dueDate))
const directionArrow = computed(() => props.sortDirection === 'asc' ? '↑' : '↓')
const globalOrderText = computed(() => `${t('catalog_controls.global_order')}: ${sortLabel.value} ${directionArrow.value}`)
const catalogDetails = computed(() => {
  const details = [props.scopeLabel]
  const groupLabel = t(groupLabels[props.groupBy] ?? groupLabels.none)
  details.push(props.groupBy === 'none'
    ? groupLabel
    : t('catalog_controls.grouped_by', { group: groupLabel.toLocaleLowerCase() }))
  if (props.filterStatus !== 'all') {
    details.push(t('catalog_controls.status', {
      status: t(statusLabels[props.filterStatus] ?? 'filters.all_status'),
    }))
  }
  if (props.hideDoneTasks) details.push(t('catalog_controls.completed_hidden'))
  return details
})
const catalogViewText = computed(() => `${t('catalog_controls.catalog_view')}: ${catalogDetails.value.join(' · ')}`)
</script>

<style scoped>
.catalog-view-summary {
  display: flex;
  flex: 1 1 320px;
  min-width: 0;
  max-width: 620px;
  gap: var(--space-2);
  pointer-events: auto;
  overflow: hidden;
}

.summary-pill {
  min-width: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--glass-bg-subtle);
  color: var(--text-secondary);
  font: inherit;
  font-size: var(--text-xs);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.summary-pill:hover,
.summary-pill:focus-visible {
  border-color: var(--state-hover-border);
  background: var(--glass-bg-soft);
  color: var(--text-primary);
}

.summary-pill--global {
  flex: 0 0 auto;
}

.summary-pill:not(.summary-pill--global) {
  flex: 1 1 auto;
}

</style>
