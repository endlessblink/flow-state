<template>
  <div class="workspace-empty-state">
    <div class="empty-inner">
      <div class="empty-icon">
        <component :is="iconComponent" :size="48" :stroke-width="1.2" />
      </div>

      <h3 class="empty-title">
        {{ $t(`workspaces.empty.${variant}.title`) }}
      </h3>
      <p class="empty-description">
        {{ $t(`workspaces.empty.${variant}.description`) }}
      </p>

      <div v-if="hasPendingInvites" class="pending-invite-badge">
        <BaseBadge variant="info" size="sm" rounded>
          {{ $t('workspaces.empty.pendingInvite', pendingInviteCount) }}
        </BaseBadge>
      </div>

      <div class="empty-actions">
        <template v-if="variant === 'welcome'">
          <button class="empty-btn primary" @click="$emit('createTask')">
            <ListChecks :size="16" />
            {{ $t('workspaces.empty.createTask') }}
          </button>
          <button class="empty-btn secondary" @click="$emit('inviteMember')">
            <Users :size="16" />
            {{ $t('workspaces.empty.inviteTeam') }}
          </button>
        </template>

        <template v-else-if="variant === 'noTasks'">
          <button class="empty-btn primary" @click="$emit('createTask')">
            <ListChecks :size="16" />
            {{ $t('workspaces.empty.createTask') }}
          </button>
        </template>

        <template v-else-if="variant === 'noMembers'">
          <button class="empty-btn secondary" @click="$emit('inviteMember')">
            <Users :size="16" />
            {{ $t('workspaces.empty.inviteTeam') }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Rocket, ListChecks, Users } from 'lucide-vue-next'
import BaseBadge from '@/components/base/BaseBadge.vue'

const props = withDefaults(defineProps<Props>(), {
  hasPendingInvites: false,
  pendingInviteCount: 0,
})

defineEmits<{
  'createTask': []
  'inviteMember': []
}>()

const { t: _t } = useI18n()

interface Props {
  variant: 'welcome' | 'noTasks' | 'noMembers'
  hasPendingInvites?: boolean
  pendingInviteCount?: number
}

const iconComponent = computed(() => {
  switch (props.variant) {
    case 'welcome': return Rocket
    case 'noTasks': return ListChecks
    case 'noMembers': return Users
    default: return Rocket
  }
})
</script>

<style scoped>
.workspace-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 300px;
  padding: var(--space-8);
}

.empty-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 400px;
  animation: fade-up var(--duration-normal, 0.4s) var(--ease-out, ease-out) both;
}

@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .empty-inner {
    animation: none;
  }
}

.empty-icon {
  color: var(--text-muted);
  opacity: 0.5;
  margin-bottom: var(--space-4);
}

.empty-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-2);
}

.empty-description {
  font-size: var(--text-sm);
  color: var(--text-muted);
  line-height: 1.6;
  margin: 0 0 var(--space-4);
}

.pending-invite-badge {
  margin-bottom: var(--space-4);
}

.empty-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
  flex-wrap: wrap;
}

.empty-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.empty-btn.primary {
  background: var(--glass-bg-soft);
  border: 1px solid var(--brand-primary);
  color: var(--brand-primary);
  backdrop-filter: blur(8px);
}

.empty-btn.primary:hover {
  background: var(--brand-primary-alpha-10, var(--brand-primary-subtle));
}

.empty-btn.secondary {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  backdrop-filter: blur(8px);
}

.empty-btn.secondary:hover {
  background: var(--surface-hover);
  border-color: var(--glass-border-hover);
}
</style>
