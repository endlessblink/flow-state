<template>
  <div v-if="workspaceStore.activeWorkspaceId" class="activity-feed-section">
    <button class="section-header" @click="isExpanded = !isExpanded">
      <svg
        class="section-icon"
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M7 1.5V7L10 9"
          stroke="currentColor"
          stroke-width="1.25"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle
          cx="7"
          cy="7"
          r="5.5"
          stroke="currentColor"
          stroke-width="1.25"
        />
      </svg>
      <span class="section-title">{{ $t('workspaces.activity.title') }}</span>
      <svg
        class="chevron"
        :class="{ expanded: isExpanded }"
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3 4L5 6L7 4"
          stroke="currentColor"
          stroke-width="1.25"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <Transition name="expand">
      <div v-if="isExpanded" class="activity-list">
        <div v-if="isLoading && activities.length === 0" class="activity-empty">
          {{ $t('workspaces.activity.loading') }}
        </div>
        <div v-else-if="activities.length === 0" class="activity-empty">
          {{ $t('workspaces.activity.empty') }}
        </div>
        <template v-else>
          <div
            v-for="item in activities"
            :key="item.id"
            class="activity-item"
          >
            <div class="activity-icon" :class="item.action">
              <svg v-if="item.action === 'task_created'" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M6 2.5V9.5M2.5 6H9.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
              </svg>
              <svg v-else-if="item.action === 'task_completed'" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <svg v-else-if="item.action === 'comment_added'" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 3C2 2.45 2.45 2 3 2H9C9.55 2 10 2.45 10 3V7C10 7.55 9.55 8 9 8H4L2 10V3Z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <svg v-else-if="item.action === 'member_joined'" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <circle cx="6" cy="4" r="2" stroke="currentColor" stroke-width="1.1" />
                <path d="M2.5 10C2.5 8.07 4.07 6.5 6 6.5C7.93 6.5 9.5 8.07 9.5 10" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" />
              </svg>
            </div>
            <div class="activity-content">
              <span class="activity-text">
                <span class="activity-user">{{ item.userName || item.userId.substring(0, 8) }}</span>
                {{ $t(`workspaces.activity.actions.${item.action}`) }}
                <span v-if="item.metadata.title" class="activity-entity">"{{ item.metadata.title }}"</span>
              </span>
              <span class="activity-time">{{ formatRelativeTime(item.createdAt) }}</span>
            </div>
          </div>
        </template>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useWorkspaceActivity } from '@/composables/supabase/useWorkspaceActivity'

const workspaceStore = useWorkspaceStore()
const { activities, isLoading, fetchFeed, subscribeToFeed } = useWorkspaceActivity()

const isExpanded = ref(false)
let unsubscribe: (() => void) | null = null

function formatRelativeTime(date: Date): string {
  const now = Date.now()
  const diff = now - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

// Load feed and subscribe when workspace changes
watch(
  () => workspaceStore.activeWorkspaceId,
  async (wsId) => {
    // Cleanup previous subscription
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }

    if (!wsId) {
      activities.value = []
      return
    }

    await fetchFeed(wsId, 20)
    unsubscribe = subscribeToFeed(wsId)
  },
  { immediate: true }
)

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
})
</script>

<style scoped>
.activity-feed-section {
  padding: 0 var(--space-3);
  margin-block-start: var(--space-2);
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-1_5) var(--space-2);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: color 0.15s ease, background 0.15s ease;
  text-align: start;
}

.section-header:hover {
  color: var(--text-primary);
  background: var(--glass-bg-soft);
}

.section-icon {
  flex-shrink: 0;
  opacity: 0.6;
}

.section-title {
  flex: 1;
}

.chevron {
  flex-shrink: 0;
  opacity: 0.4;
  transition: transform 0.2s ease;
}

.chevron.expanded {
  transform: rotate(180deg);
}

.activity-list {
  padding: var(--space-1) 0;
  max-height: 200px;
  overflow-y: auto;
}

.activity-empty {
  padding: var(--space-3) var(--space-2);
  color: var(--text-muted, var(--text-secondary));
  font-size: 0.75rem;
  text-align: center;
  opacity: 0.6;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-1_5) var(--space-2);
  border-radius: var(--radius-sm);
  transition: background 0.1s ease;
}

.activity-item:hover {
  background: var(--glass-bg-soft);
}

.activity-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-block-start: 1px;
}

.activity-icon.task_created {
  background: rgba(78, 205, 196, 0.15);
  color: var(--brand-primary);
}

.activity-icon.task_completed {
  background: rgba(78, 205, 196, 0.25);
  color: var(--brand-primary);
}

.activity-icon.comment_added {
  background: rgba(255, 193, 7, 0.15);
  color: var(--color-warning, #ffc107);
}

.activity-icon.member_joined {
  background: rgba(124, 77, 255, 0.15);
  color: var(--color-info, #7c4dff);
}

.activity-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.activity-text {
  font-size: 0.75rem;
  color: var(--text-secondary);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.activity-user {
  color: var(--text-primary);
  font-weight: 500;
}

.activity-entity {
  color: var(--text-primary);
  font-style: italic;
}

.activity-time {
  font-size: 0.6875rem;
  color: var(--text-muted, var(--text-secondary));
  opacity: 0.5;
}

/* Expand transition */
.expand-enter-active,
.expand-leave-active {
  transition: opacity 0.15s ease;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
}
</style>
