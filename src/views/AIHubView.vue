<template>
  <div class="ai-hub-view">
    <!-- Tab bar -->
    <div class="hub-tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="hub-tab"
        :class="{ active: activeTab === tab.key }"
        @click="setTab(tab.key)"
      >
        <component :is="tab.icon" :size="16" />
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab content -->
    <div class="hub-content">
      <AIChatView v-if="activeTab === 'chat'" />
      <WeeklyPlanView v-else-if="activeTab === 'plan'" />
      <AIInsightsPanel v-else-if="activeTab === 'insights'" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * FEATURE-1317 Phase 2B: Unified AI Hub View
 *
 * Combines AI Chat, Weekly Plan, and Insights into a single tabbed view.
 * Tab state is persisted in the URL query param (?tab=chat|plan|insights).
 */

import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { MessageSquare, CalendarDays, Brain } from 'lucide-vue-next'
import AIChatView from '@/views/AIChatView.vue'
import WeeklyPlanView from '@/views/WeeklyPlanView.vue'
import AIInsightsPanel from '@/components/ai/AIInsightsPanel.vue'

type TabKey = 'chat' | 'plan' | 'insights'

const router = useRouter()
const route = useRoute()

const tabs = [
  { key: 'chat' as TabKey, label: 'Chat', icon: MessageSquare },
  { key: 'plan' as TabKey, label: 'Weekly Plan', icon: CalendarDays },
  { key: 'insights' as TabKey, label: 'Insights', icon: Brain },
]

const validTabs: TabKey[] = ['chat', 'plan', 'insights']

const activeTab = computed<TabKey>(() => {
  const queryTab = route.query.tab as string
  if (validTabs.includes(queryTab as TabKey)) return queryTab as TabKey
  return 'chat'
})

function setTab(key: TabKey) {
  router.replace({ path: '/ai', query: { tab: key } })
}
</script>

<style scoped>
.ai-hub-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Tab bar */
.hub-tab-bar {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-4);
  background: var(--glass-bg-soft);
  border-bottom: 1px solid var(--glass-border);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
  flex-shrink: 0;
}

.hub-tab {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  white-space: nowrap;
}

.hub-tab:hover {
  color: var(--text-primary);
  background: var(--state-hover-bg);
}

.hub-tab.active {
  color: var(--brand-primary);
  border-bottom-color: var(--brand-primary);
  font-weight: var(--font-semibold);
}

/* Tab content */
.hub-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
