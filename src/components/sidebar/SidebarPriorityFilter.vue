<template>
  <section class="sidebar-priority-filter" :aria-label="t('filters.priority_filter')">
    <div class="sidebar-priority-divider" />
    <h3 class="sidebar-priority-title">
      <Flag :size="16" />{{ t('task.priority') }}
    </h3>
    <div class="sidebar-priority-options">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="sidebar-priority-option"
        :class="{ 'is-active': priorityFilter === option.value }"
        :aria-pressed="priorityFilter === option.value"
        @click="priorityFilter = option.value"
      >
        <span class="priority-dot" :class="option.dotClass" />{{ option.label }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Flag } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBoardPriorityFilter } from '@/composables/board/useBoardPriorityFilter'

const { t } = useI18n()
const priorityFilter = useBoardPriorityFilter()
const options = computed(() => [
  { value: '', label: t('filters.all_priorities'), dotClass: 'all' },
  { value: 'immediate', label: t('task.priority_immediate'), dotClass: 'immediate' },
  { value: 'high', label: t('task.priority_high'), dotClass: 'high' },
  { value: 'medium', label: t('task.priority_medium'), dotClass: 'medium' },
  { value: 'low', label: t('task.priority_low'), dotClass: 'low' },
  { value: 'relaxed', label: t('task.priority_relaxed'), dotClass: 'relaxed' },
  { value: 'none', label: t('task.priority_none_full'), dotClass: 'none' },
])
</script>

<style scoped>
.sidebar-priority-filter { margin-top: var(--space-4); }
.sidebar-priority-divider { height: 1px; margin-bottom: var(--space-3); background: var(--glass-border); }
.sidebar-priority-title { display: flex; align-items: center; gap: var(--space-2); margin: 0 0 var(--space-2); color: var(--text-muted); font-size: var(--text-xs); font-weight: var(--font-bold); letter-spacing: .05em; text-transform: uppercase; }
.sidebar-priority-options { display: grid; gap: 2px; }
.sidebar-priority-option { display: flex; align-items: center; gap: var(--space-2); width: 100%; padding: var(--space-2) var(--space-2_5); border: 0; border-radius: var(--radius-md); color: var(--text-secondary); background: transparent; font: inherit; font-size: var(--text-sm); text-align: start; cursor: pointer; }
.sidebar-priority-option:hover { color: var(--text-primary); background: var(--glass-bg-soft); }
.sidebar-priority-option.is-active { color: var(--brand-primary); background: var(--brand-primary-subtle); }
.priority-dot { width: 8px; height: 8px; flex: 0 0 auto; border-radius: 50%; background: var(--text-tertiary); }
.priority-dot.immediate { background: var(--danger); }
.priority-dot.high { background: var(--warning); }
.priority-dot.medium { background: var(--brand-primary); }
.priority-dot.low { background: var(--success); }
.priority-dot.relaxed { background: var(--text-muted); }
.priority-dot.all { background: linear-gradient(135deg, var(--danger) 0 25%, var(--warning) 25% 50%, var(--brand-primary) 50% 75%, var(--success) 75%); }
.priority-dot.none { border: 1px solid var(--text-tertiary); background: transparent; }
</style>
