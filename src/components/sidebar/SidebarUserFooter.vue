<template>
  <div class="sidebar-footer">
    <button v-if="!authStore.user" class="sidebar-login-btn" @click="uiStore.openAuthModal('login')">
      <span style="font-weight: 600;">{{ $t('sidebar.sign_in') }}</span>
    </button>
    <div v-else class="user-profile-row">
      <div class="user-avatar-circle">
        {{ (authStore.user?.email ? authStore.user.email[0].toUpperCase() : 'U') }}
      </div>
      <div class="user-info-col">
        <span class="user-email" :title="authStore.user?.email || ''">{{ authStore.user?.email || 'Authenticated' }}</span>
        <span class="user-status">{{ $t('common.online') }}</span>
      </div>
      <button class="settings-mini-btn" :title="$t('common.settings')" :aria-label="$t('common.settings')" @click="uiStore.openSettingsModal()">
        <Settings :size="16" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { Settings } from 'lucide-vue-next'

const uiStore = useUIStore()
const authStore = useAuthStore()
</script>

<style scoped>
.sidebar-footer {
  margin-top: auto;
  padding: var(--space-4);
  border-top: 1px solid var(--glass-border);
  background: var(--glass-bg-soft);
}

.sidebar-login-btn {
  width: 100%;
  padding: var(--space-2_5);
  background: var(--glass-bg-soft);
  color: var(--brand-primary);
  border: 1px solid var(--brand-primary-alpha-40);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-login-btn:hover {
  background: var(--brand-primary-alpha-10);
  border-color: var(--brand-primary);
  box-shadow: 0 0 15px var(--brand-primary-alpha-20);
}

.user-profile-row {
  display: flex;
  align-items: center;
  gap: var(--space-2_5);
  padding: var(--space-1);
}

.user-avatar-circle {
  width: 32px;
  height: 32px;
  background: var(--brand-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: var(--text-sm);
  flex-shrink: 0;
}

.user-info-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.user-email {
  font-size: var(--text-sm);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-primary);
}

.user-status {
  font-size: var(--text-xs);
  color: var(--success);
}

.settings-mini-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
}

.settings-mini-btn:hover {
  background: var(--glass-border);
  color: var(--text-primary);
}
</style>
