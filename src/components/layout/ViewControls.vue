<template>
  <section
    ref="toolbar"
    class="catalog-toolbar"
    data-testid="catalog-toolbar"
    role="toolbar"
    :aria-label="$t('catalog_controls.toolbar_label')"
  >
    <div class="catalog-toolbar__primary">
      <div class="control-wrapper" data-control="group">
        <span class="control-label">{{ $t('catalog_controls.group_by') }}</span>
        <CustomSelect
          :model-value="groupBy"
          :options="groupByOptions"
          :aria-label="$t('catalog_controls.group_by')"
          @update:model-value="$emit('update:groupBy', $event as string)"
        />
      </div>

      <div class="control-wrapper control-wrapper--global" data-control="sort">
        <span class="control-label">{{ $t('catalog_controls.global_order') }}</span>
        <CustomSelect
          :model-value="sortBy"
          :options="sortOptions"
          :aria-label="$t('catalog_controls.global_order')"
          @update:model-value="$emit('update:sortBy', $event as string)"
        />
        <span class="control-note" data-testid="global-order-note">{{ $t('catalog_controls.global_order_note') }}</span>
      </div>
    </div>

    <button
      class="view-options-toggle"
      data-testid="catalog-view-options"
      :aria-expanded="showFilters"
      :aria-label="$t('catalog_controls.view_options')"
      :class="{ active: showFilters }"
      @click="showFilters = !showFilters"
    >
      <SlidersHorizontal :size="16" :stroke-width="1.5" />
      <span>{{ $t('catalog_controls.view_options') }}</span>
      <ChevronDown class="view-options-toggle__chevron" :class="{ open: showFilters }" :size="14" />
    </button>

    <Transition name="slide-down">
      <div v-if="showFilters" class="catalog-toolbar__secondary">
        <div v-if="showTreeControls" class="tree-controls">
          <BaseButton variant="secondary" size="sm" @click="$emit('expandAll')">
            <ChevronsDown :size="16" />{{ $t('common.expand') }}
          </BaseButton>
          <BaseButton variant="secondary" size="sm" @click="$emit('collapseAll')">
            <ChevronsUp :size="16" />{{ $t('common.collapse') }}
          </BaseButton>
        </div>

        <div class="control-wrapper" data-control="status">
          <span class="control-label">{{ $t('catalog_controls.status_label') }}</span>
          <CustomSelect
            :model-value="filterStatus"
            :options="filterOptions"
            :aria-label="$t('catalog_controls.status_label')"
            @update:model-value="$emit('update:filterStatus', $event as string)"
          />
        </div>

        <div v-if="density" class="control-wrapper" data-control="density">
          <span class="control-label">{{ $t('catalog_controls.density') }}</span>
          <CustomSelect
            :model-value="density"
            :options="densityOptions"
            :aria-label="$t('catalog_controls.density')"
            @update:model-value="$emit('update:density', $event as string)"
          />
        </div>

        <button
          v-if="hideDoneTasks !== undefined"
          class="done-toggle"
          :aria-pressed="hideDoneTasks"
          :aria-label="hideDoneTasks ? $t('catalog_controls.show_completed') : $t('catalog_controls.hide_completed')"
          :class="{ active: hideDoneTasks }"
          @click="$emit('update:hideDoneTasks', !hideDoneTasks)"
        >
          <EyeOff v-if="hideDoneTasks" :size="16" :stroke-width="1.5" />
          <Eye v-else :size="16" :stroke-width="1.5" />
          <span>{{ hideDoneTasks ? $t('catalog_controls.show_completed') : $t('catalog_controls.hide_completed') }}</span>
        </button>

        <slot name="secondary-actions" />
      </div>
    </Transition>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, ChevronsDown, ChevronsUp, Eye, EyeOff, SlidersHorizontal } from 'lucide-vue-next'
import BaseButton from '@/components/base/BaseButton.vue'
import CustomSelect from '@/components/common/CustomSelect.vue'
import type { CatalogFocusTarget } from '@/stores/catalogView'

interface Props {
  sortBy: string
  groupBy: string
  filterStatus: string
  hideDoneTasks?: boolean
  showTreeControls?: boolean
  density?: 'compact' | 'comfortable' | 'spacious'
  expanded?: boolean
  focusTarget?: CatalogFocusTarget | null
}

const props = withDefaults(defineProps<Props>(), { density: 'comfortable', expanded: false, focusTarget: null })
const _emit = defineEmits<{
  (e: 'update:sortBy', value: string): void
  (e: 'update:groupBy', value: string): void
  (e: 'update:filterStatus', value: string): void
  (e: 'update:hideDoneTasks', value: boolean): void
  (e: 'expandAll'): void
  (e: 'collapseAll'): void
  (e: 'update:density', value: string): void
  (e: 'update:expanded', value: boolean): void
  (e: 'focusHandled'): void
}>()

const { t } = useI18n()
const toolbar = ref<HTMLElement | null>(null)
const showFilters = computed({ get: () => props.expanded, set: value => _emit('update:expanded', value) })

watch([() => props.expanded, () => props.focusTarget], async ([expanded, focusTarget]) => {
  if (!focusTarget) return
  if (!expanded && (focusTarget === 'status' || focusTarget === 'density')) {
    showFilters.value = true
    return
  }
  await nextTick()
  const trigger = toolbar.value?.querySelector<HTMLElement>(`[data-control="${focusTarget}"] .select-trigger`)
  if (!trigger) return
  trigger.focus()
  _emit('focusHandled')
})

const sortOptions = computed(() => [
  { label: t('filters.sort_due_date'), value: 'dueDate' }, { label: t('filters.sort_priority'), value: 'priority' },
  { label: t('filters.sort_title'), value: 'title' }, { label: t('filters.sort_created'), value: 'created' },
  { label: t('catalog_controls.manual'), value: 'manual' },
])
const groupByOptions = computed(() => [
  { label: t('filters.no_grouping'), value: 'none' }, { label: t('filters.group_project'), value: 'project' },
  { label: t('filters.group_status'), value: 'status' }, { label: t('filters.group_priority'), value: 'priority' },
  { label: t('filters.group_due_date'), value: 'dueDate' }, { label: t('catalog_controls.lane'), value: 'lane' },
])
const filterOptions = computed(() => [
  { label: t('filters.all_status'), value: 'all' }, { label: t('task.status_todo'), value: 'todo' }, { label: t('task.status_done'), value: 'done' },
])
const densityOptions = computed(() => [
  { label: t('catalog_controls.density_compact'), value: 'compact' },
  { label: t('catalog_controls.density_comfortable'), value: 'comfortable' },
  { label: t('catalog_controls.density_spacious'), value: 'spacious' },
])
</script>

<style scoped>
.catalog-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: var(--space-3) var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
}
.catalog-toolbar__primary, .catalog-toolbar__secondary, .tree-controls { display: flex; align-items: end; gap: var(--space-3); }
.catalog-toolbar__primary { flex-wrap: wrap; }
.catalog-toolbar__secondary { grid-column: 1 / -1; flex-wrap: wrap; padding-top: var(--space-3); border-top: 1px solid var(--border-subtle); }
.control-wrapper { display: grid; grid-template-rows: auto auto; min-width: 148px; gap: var(--space-1); }
.control-wrapper--global { grid-template-rows: auto auto auto; min-width: 180px; }
.control-note { color: var(--text-muted); font-size: var(--text-xs); line-height: 1.35; white-space: normal; }
.control-label { color: var(--text-muted); font-size: var(--text-xs); font-weight: var(--font-semibold); }
.view-options-toggle, .done-toggle {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); min-height: 36px;
  padding: 0 var(--space-3); border: 1px solid var(--glass-border); border-radius: var(--radius-md);
  background: transparent; color: var(--text-secondary); cursor: pointer; font: inherit; font-size: var(--text-sm);
  transition: background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out);
}
.view-options-toggle:hover, .done-toggle:hover, .view-options-toggle.active, .done-toggle.active { color: var(--text-primary); border-color: var(--state-hover-border); background: var(--state-hover-bg); }
.view-options-toggle.active, .done-toggle.active { color: var(--brand-primary); }
.view-options-toggle__chevron { transition: transform var(--duration-fast) var(--ease-out); }
.view-options-toggle__chevron.open { transform: rotate(180deg); }
.slide-down-enter-active, .slide-down-leave-active { transition: opacity var(--duration-normal) var(--ease-out), transform var(--duration-normal) var(--ease-out); }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-4px); }
@media (max-width: 1300px) {
  .catalog-toolbar, .catalog-toolbar__primary { align-items: stretch; }
  .catalog-toolbar { grid-template-columns: 1fr; }
  .view-options-toggle { justify-self: start; }
}
</style>
