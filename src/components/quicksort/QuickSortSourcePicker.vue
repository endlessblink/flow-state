<template>
  <section class="source-picker" :class="`mode-${mode}`">
    <template v-if="mode === 'active'">
      <div class="active-pools">
        <span class="active-label">{{ t('quick_sort.active_pools') }}</span>
        <span v-for="source in modelValue" :key="source" class="active-chip">
          {{ t(`quick_sort.sources.${source}.label`) }}
        </span>
      </div>
      <BaseButton type="button" class="change-button" variant="ghost" size="sm" @click="emit('request-change')">
        <SlidersHorizontal :size="14" />
        {{ t('quick_sort.change_task_pools') }}
      </BaseButton>
    </template>

    <template v-else>
      <div class="picker-heading">
        <div class="heading-icon"><Layers3 :size="22" /></div>
        <div>
          <h2>{{ t('quick_sort.choose_tasks') }}</h2>
          <p>{{ t('quick_sort.choose_tasks_description') }}</p>
        </div>
      </div>

      <div class="source-grid" role="group" :aria-label="t('quick_sort.choose_tasks')">
        <BaseButton
          v-for="option in options"
          :key="option.id"
          class="source-card"
          :class="{ selected: modelValue.includes(option.id) }"
          :variant="modelValue.includes(option.id) ? 'active' : 'secondary'"
          :pressed="modelValue.includes(option.id)"
          @click="toggle(option.id)"
        >
          <span class="source-icon"><component :is="option.icon" :size="18" /></span>
          <span class="source-copy">
            <span class="source-title">{{ t(`quick_sort.sources.${option.id}.label`) }}</span>
            <span class="source-description">{{ t(`quick_sort.sources.${option.id}.description`) }}</span>
          </span>
          <span class="source-count">{{ counts[option.id] }}</span>
          <Check v-if="modelValue.includes(option.id)" :size="15" class="selected-check" />
        </BaseButton>
      </div>

      <div class="picker-footer">
        <div class="selection-summary" aria-live="polite">
          <strong>{{ combinedCount }}</strong>
          <span>{{ t('quick_sort.selected_count') }}</span>
        </div>
        <p v-if="modelValue.length === 0" class="picker-note">{{ t('quick_sort.no_sources_selected') }}</p>
        <p v-else-if="combinedCount === 0" class="picker-note">{{ t('quick_sort.no_matching_tasks') }}</p>
        <BaseButton
          class="start-button"
          variant="primary"
          size="lg"
          :disabled="disabled || modelValue.length === 0 || combinedCount === 0"
          @click="emit('start', [...modelValue])"
        >
          <Zap :size="17" />
          {{ t('quick_sort.start_sorting') }}
        </BaseButton>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  AlertTriangle, CalendarClock, CalendarDays, CalendarRange,
  Check, CircleSlash2, Inbox, Layers3, SlidersHorizontal, Zap
} from 'lucide-vue-next'
import type { Component } from 'vue'
import type { QuickSortSource } from '@/utils/quickSortTaskFilters'
import BaseButton from '@/components/base/BaseButton.vue'

const props = withDefaults(defineProps<{
  modelValue: QuickSortSource[]
  counts: Record<QuickSortSource, number>
  combinedCount: number
  mode?: 'select' | 'active'
  disabled?: boolean
}>(), {
  mode: 'select',
  disabled: false
})

const emit = defineEmits<{
  'update:modelValue': [sources: QuickSortSource[]]
  start: [sources: QuickSortSource[]]
  'request-change': []
}>()

const { t } = useI18n()

const options: Array<{ id: QuickSortSource, icon: Component }> = [
  { id: 'uncategorized', icon: Inbox },
  { id: 'overdue', icon: AlertTriangle },
  { id: 'today', icon: CalendarDays },
  { id: 'next-3-days', icon: CalendarClock },
  { id: 'next-7-days', icon: CalendarRange },
  { id: 'no-due-date', icon: CircleSlash2 }
]

function toggle(source: QuickSortSource) {
  const selected = props.modelValue
  emit('update:modelValue', selected.includes(source)
    ? selected.filter(candidate => candidate !== source)
    : [...selected, source])
}
</script>

<style scoped>
.source-picker {
  width: min(100%, 680px);
  margin: auto;
  padding: var(--space-6);
  color: var(--text-primary);
}

.picker-heading {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
  text-align: start;
}

.heading-icon {
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-xl);
  color: var(--brand-primary);
  background: var(--state-hover-bg);
  border: 1px solid var(--state-hover-border);
}

.picker-heading h2 { margin: 0 0 var(--space-1); font-size: var(--text-2xl); }
.picker-heading p { margin: 0; color: var(--text-secondary); line-height: 1.5; }

.source-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.source-card {
  position: relative;
  display: block;
  width: 100%;
  min-height: 82px;
  padding: var(--space-4);
  text-align: start;
  color: var(--text-primary);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  cursor: pointer;
  transition: border-color var(--duration-fast), background var(--duration-fast), transform var(--duration-fast);
}

.source-card :deep(.button-content) {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  white-space: normal;
}

.source-card:hover { border-color: var(--state-hover-border); transform: translateY(-1px); }
.source-card.selected { background: var(--state-hover-bg); border-color: var(--brand-primary); }
.source-icon { display: grid; place-items: center; color: var(--brand-primary); }
.source-copy { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
.source-title { font-size: var(--text-sm); font-weight: var(--font-semibold); }
.source-description { font-size: var(--text-xs); color: var(--text-muted); line-height: 1.35; }
.source-count { min-width: 28px; padding: 3px 7px; text-align: center; font-size: var(--text-xs); font-weight: var(--font-bold); color: var(--text-secondary); background: var(--glass-bg-medium); border-radius: var(--radius-full); }
.selected-check { position: absolute; top: 7px; inset-inline-end: 7px; color: var(--brand-primary); }

.picker-footer { display: flex; align-items: center; gap: var(--space-4); margin-top: var(--space-6); }
.selection-summary { display: flex; align-items: baseline; gap: var(--space-2); margin-inline-end: auto; color: var(--text-secondary); }
.selection-summary strong { font-size: var(--text-2xl); color: var(--brand-primary); }
.picker-note { margin: 0; font-size: var(--text-xs); color: var(--text-muted); }

.start-button { flex: 0 0 auto; }

.mode-active {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-2) var(--space-5);
  margin: 0;
  border-bottom: 1px solid var(--border-subtle);
}

.active-pools { display: flex; align-items: center; gap: var(--space-2); min-width: 0; overflow-x: auto; scrollbar-width: none; }
.active-pools::-webkit-scrollbar { display: none; }
.active-label { color: var(--text-muted); font-size: var(--text-xs); white-space: nowrap; }
.active-chip { padding: 4px 9px; color: var(--brand-primary); background: var(--state-hover-bg); border: 1px solid var(--state-hover-border); border-radius: var(--radius-full); font-size: var(--text-xs); white-space: nowrap; }
.change-button { flex: 0 0 auto; margin-inline-start: auto; }

@media (max-width: 520px) {
  .source-picker:not(.mode-active) {
    flex: 1;
    min-height: 0;
    padding: var(--space-4);
    padding-bottom: calc(var(--space-8) + env(safe-area-inset-bottom));
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .source-grid { grid-template-columns: 1fr; }
  .source-card { min-height: 70px; padding: var(--space-3); }
  .picker-footer { flex-wrap: wrap; }
  .start-button { width: 100%; }
  .mode-active { padding: var(--space-2) var(--space-3); }
  .active-label { display: none; }
  .change-button { padding: var(--space-2); }
}
</style>
