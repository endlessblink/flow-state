<template>
  <NPopover
    v-model:show="showMenu"
    trigger="click"
    placement="bottom-start"
    :show-arrow="false"
    raw
    to="body"
  >
    <template #trigger>
      <button class="sort-trigger" :title="t('filters.sort_label')">
        <component :is="activeIcon" :size="13" />
        <span>{{ activeLabel }}</span>
        <ChevronDown :size="11" class="chevron-icon" :class="{ open: showMenu }" />
      </button>
    </template>

    <div class="sort-dropdown-menu">
      <button
        v-for="option in visibleOptions"
        :key="option.value"
        class="sort-option"
        :class="{ active: sortBy === option.value }"
        @click="selectSort(option.value)"
      >
        <component :is="option.icon" :size="14" />
        <span class="sort-option-label">{{ option.label }}</span>
        <Check v-if="sortBy === option.value" :size="13" class="sort-check" />
      </button>

      <div class="sort-divider" />

      <button class="sort-option direction-option" @click="toggleDirection">
        <ArrowUpNarrowWide v-if="sortDirection === 'asc'" :size="14" />
        <ArrowDownNarrowWide v-else :size="14" />
        <span class="sort-option-label">
          {{ sortDirection === 'asc' ? t('filters.sort_ascending') : t('filters.sort_descending') }}
        </span>
      </button>
    </div>
  </NPopover>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NPopover } from 'naive-ui'
import {
  Clock,
  Flag,
  CalendarDays,
  LayoutGrid,
  ChevronDown,
  Check,
  ArrowUpNarrowWide,
  ArrowDownNarrowWide,
} from 'lucide-vue-next'
import type { SortByType, SortDirection } from '@/composables/inbox/useUnifiedInboxState'

interface Props {
  sortBy: SortByType
  sortDirection: SortDirection
  context?: string
}

const props = withDefaults(defineProps<Props>(), {
  context: undefined,
})

const emit = defineEmits<{
  'update:sortBy': [value: SortByType]
  'update:sortDirection': [value: SortDirection]
}>()

const { t } = useI18n()

const showMenu = ref(false)

const allOptions = computed(() => [
  { value: 'newest' as SortByType, label: t('filters.sort_newest'), icon: Clock },
  { value: 'priority' as SortByType, label: t('filters.sort_priority'), icon: Flag },
  { value: 'dueDate' as SortByType, label: t('filters.sort_due'), icon: CalendarDays },
  { value: 'canvasOrder' as SortByType, label: t('filters.sort_canvas'), icon: LayoutGrid },
])

const visibleOptions = computed(() =>
  props.context === 'canvas'
    ? allOptions.value.filter((o) => o.value !== 'canvasOrder')
    : allOptions.value,
)

const activeOption = computed(
  () => allOptions.value.find((o) => o.value === props.sortBy) ?? allOptions.value[0],
)

const activeIcon = computed(() => activeOption.value.icon)
const activeLabel = computed(() => activeOption.value.label)

function selectSort(value: SortByType) {
  emit('update:sortBy', value)
  showMenu.value = false
}

function toggleDirection() {
  emit('update:sortDirection', props.sortDirection === 'asc' ? 'desc' : 'asc')
  // keep menu open so user can see the change
}
</script>

<style scoped>
/* Trigger button */
.sort-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  height: 28px;
  padding: var(--space-1) var(--space-2);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
  white-space: nowrap;
  flex-shrink: 0;
}

.sort-trigger:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.chevron-icon {
  transition: transform var(--duration-normal) var(--ease-out);
  flex-shrink: 0;
}

.chevron-icon.open {
  transform: rotate(180deg);
}

/* Popover menu */
.sort-dropdown-menu {
  display: flex;
  flex-direction: column;
  padding: var(--space-1);
  background: var(--surface-elevated);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  min-width: 180px;
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(12px);
  z-index: var(--z-popover);
  position: relative;
}

/* Menu items */
.sort-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-1_5) var(--space-2);
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  text-align: start;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.sort-option:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.sort-option.active {
  background: var(--brand-primary-subtle);
  color: var(--brand-primary);
  font-weight: var(--font-medium);
}

.sort-option-label {
  flex: 1;
  text-align: start;
}

.sort-check {
  flex-shrink: 0;
  margin-inline-start: auto;
}

.direction-option {
  color: var(--text-tertiary);
}

/* Divider */
.sort-divider {
  height: 1px;
  background: var(--border-subtle);
  margin: var(--space-1) 0;
}
</style>
