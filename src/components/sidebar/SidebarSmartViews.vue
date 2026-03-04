<template>
  <div>
    <!-- Smart Views - Using DateDropZone for drag and drop functionality -->
    <div class="smart-views-grid">
      <!-- Today -->
      <SidebarSmartItem
        :active="taskStore.activeSmartView === 'today'"
        :count="todayTaskCount"
        drop-type="date"
        drop-value="today"
        color="azure"
        compact
        @click="selectSmartView('today')"
      >
        <template #icon>
          <Calendar :size="14" />
        </template>
        {{ $t('smart_views.today') }}
      </SidebarSmartItem>

      <!-- This Week -->
      <SidebarSmartItem
        :active="taskStore.activeSmartView === 'week'"
        :count="weekTaskCount"
        drop-type="date"
        drop-value="weekend"
        color="azure-dark"
        compact
        @click="selectSmartView('week')"
      >
        <template #icon>
          <Calendar :size="14" />
        </template>
        {{ $t('smart_views.week') }}
      </SidebarSmartItem>
    </div>

    <div class="sidebar-sub-divider" />

    <div class="smart-views-grid secondary">
      <!-- All Active -->
      <SidebarSmartItem
        :active="taskStore.activeSmartView === 'all_active'"
        :count="allActiveCount"
        drop-type="date"
        drop-value="nodate"
        color="blue"
        compact
        @click="selectSmartView('all_active')"
      >
        <template #icon>
          <List :size="14" />
        </template>
        {{ $t('smart_views.all_active') }}
      </SidebarSmartItem>

      <!-- Uncategorized (Inbox) -->
      <SidebarSmartItem
        :active="taskStore.activeSmartView === 'uncategorized'"
        :count="uncategorizedCount"
        drop-type="date"
        drop-value="nodate"
        color="orange"
        compact
        @click="selectSmartView('uncategorized')"
      >
        <template #icon>
          <Inbox :size="14" />
        </template>
        {{ $t('smart_views.inbox') }}
      </SidebarSmartItem>
    </div>

    <!-- Quick Sort Button (shows when uncategorized filter is active) -->
    <Transition name="fade">
      <button
        v-if="taskStore.activeSmartView === 'uncategorized' && uncategorizedCount > 0"
        class="quick-sort-button-full"
        title="Start Quick Sort to categorize these tasks"
        @click="handleStartQuickSort"
      >
        <Zap :size="16" />
        <span>{{ $t('sidebar.categorize_inbox') }} ({{ uncategorizedCount }})</span>
      </button>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useTaskStore } from '@/stores/tasks'
import { Calendar, List, Inbox, Zap } from 'lucide-vue-next'
import SidebarSmartItem from '@/components/layout/SidebarSmartItem.vue'

const router = useRouter()
const route = useRoute()
const taskStore = useTaskStore()

// Smart View Counts
const todayTaskCount = computed(() => taskStore.smartViewTaskCounts.today)
const weekTaskCount = computed(() => taskStore.smartViewTaskCounts.week)
const allActiveCount = computed(() => taskStore.smartViewTaskCounts.allActive)
const uncategorizedCount = computed(() => taskStore.getUncategorizedTaskCount())

// Routing-aware smart view selection
const selectSmartView = (view: string) => {
  taskStore.setActiveProject(null)

  // Check if view is a duration filter
  if (['quick', 'short', 'medium', 'long', 'unestimated'].includes(view)) {
    taskStore.setActiveDurationFilter(view as Parameters<typeof taskStore.setActiveDurationFilter>[0])
    taskStore.setSmartView(null)
  } else {
    // It's a smart view
    taskStore.setSmartView(view as Parameters<typeof taskStore.setSmartView>[0])
    taskStore.setActiveDurationFilter(null)
  }

  // BUG-1430: Only navigate to /tasks if current view doesn't support smart view filters
  const filterableViews = ['/', '/board', '/calendar', '/tasks', '/catalog']
  if (!filterableViews.includes(route.path)) {
    router.push('/tasks')
  }
}

const handleStartQuickSort = () => {
  router.push('/quick-sort')
}
</script>

<style scoped>
.smart-views-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
  padding: var(--space-4) var(--space-4) var(--space-2) var(--space-4);
}

.smart-views-grid.secondary {
  padding-top: var(--space-2);
  padding-bottom: var(--space-4);
}

.sidebar-sub-divider {
  height: 1px;
  background: var(--glass-border);
  margin: var(--space-1) var(--space-4);
  opacity: 0.3;
}

.quick-sort-button-full {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: calc(100% - 32px);
  margin: 0 16px var(--space-4) 16px;
  padding: var(--space-2);
  background: var(--brand-primary);
  color: var(--text-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal);
  box-shadow: var(--shadow-sm);
}

.quick-sort-button-full:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
  filter: brightness(1.1);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-slow) var(--ease-out);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
