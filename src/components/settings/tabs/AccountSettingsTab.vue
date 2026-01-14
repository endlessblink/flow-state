<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { LogOut } from 'lucide-vue-next'
import SettingsSection from '../SettingsSection.vue'

const emit = defineEmits<{ 'close-modal': [] }>()
const authStore = useAuthStore()
const handleSignOut = async () => {
  await authStore.signOut()
  emit('close-modal')
}
</script>

<template>
  <div class="account-settings-tab">
    <SettingsSection title="👤 Account Settings">
      <div v-if="authStore.isAuthenticated" class="account-info">
        <div class="user-details">
          <div class="user-email">
            {{ authStore.user?.email }}
          </div>
          <div class="user-status">
            Logged in via Supabase
          </div>
        </div>
        
        <button class="logout-btn" @click="handleSignOut">
          <LogOut :size="16" />
          <span>Log Out</span>
        </button>
      </div>

      <div v-else class="guest-info">
        <div class="guest-status">
          <div class="status-badge">
            Guest Mode
          </div>
          <p class="setting-description">
            You are currently using local storage. Create an account to sync your tasks across devices.
          </p>
        </div>
      </div>
    </SettingsSection>
  </div>
</template>

<style scoped>
.account-settings-tab {
  display: flex;
  flex-direction: column;
}

.account-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4);
  background: var(--glass-bg-soft);
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border);
}

.user-email {
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.user-status {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #ef4444;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal);
}

.logout-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  transform: translateY(-1px);
}

.status-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-3);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

.setting-description {
  font-size: var(--text-xs);
  color: var(--text-muted);
  line-height: 1.4;
}
</style>
