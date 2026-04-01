<template>
  <div class="invite-container">
    <div class="invite-card">
      <template v-if="isLoading">
        <div class="loading-state">
          <div class="spinner" />
          <p>{{ $t('workspaces.invite.processing') }}</p>
        </div>
      </template>

      <template v-else-if="error">
        <div class="error-state">
          <h2>{{ $t('workspaces.invite.failed') }}</h2>
          <p>{{ error }}</p>
          <BaseButton variant="primary" @click="$router.push('/')">
            {{ $t('workspaces.invite.goHome') }}
          </BaseButton>
        </div>
      </template>

      <template v-else-if="!authStore.isAuthenticated">
        <div class="login-prompt">
          <h2>{{ $t('workspaces.invite.title') }}</h2>
          <p>{{ $t('workspaces.invite.loginRequired') }}</p>
          <BaseButton variant="primary" @click="showLogin">
            {{ $t('workspaces.invite.joinWorkspace') }}
          </BaseButton>
        </div>
      </template>

      <template v-else-if="success">
        <div class="success-state">
          <h2>{{ $t('workspaces.invite.success') }}</h2>
          <p>{{ $t('workspaces.invite.redirecting') }}</p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useWorkspaceStore } from '@/stores/workspace'
import { useUIStore } from '@/stores/ui'
import BaseButton from '@/components/base/BaseButton.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const workspaceStore = useWorkspaceStore()
const uiStore = useUIStore()

const isLoading = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

const token = route.params.token as string

function showLogin() {
  // TASK-1555: Persist invite token so post-signup redirect returns here
  localStorage.setItem('flowstate-pending-invite', token)
  uiStore.openAuthModal('signup', `/invite/${token}`)
}

async function acceptInvite() {
  if (!token || !authStore.isAuthenticated) return

  isLoading.value = true
  error.value = null

  try {
    const result = await workspaceStore.acceptInvite(token)

    if (result.success && result.workspaceId) {
      success.value = true
      localStorage.removeItem('flowstate-pending-invite')
      await workspaceStore.switchWorkspace(result.workspaceId)
      setTimeout(() => router.push('/board'), 1500)
    } else {
      error.value = result.error || 'Failed to accept invite'
    }
  } catch (e: any) {
    error.value = e.message || 'Unexpected error'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  if (authStore.isAuthenticated) {
    acceptInvite()
  }
  // TASK-1555: Clean up persisted token reference on mount (we have it from route params)
  if (token) {
    localStorage.removeItem('flowstate-pending-invite')
  }
})

watch(() => authStore.isAuthenticated, (isAuth) => {
  if (isAuth && !success.value && !isLoading.value) {
    acceptInvite()
  }
})
</script>

<style scoped>
.invite-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: var(--space-4);
  background: var(--bg-primary);
}

.invite-card {
  max-width: 400px;
  width: 100%;
  padding: var(--space-8);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  text-align: center;
}

.invite-card h2 {
  margin: 0 0 var(--space-3);
  color: var(--text-primary);
  font-size: 1.25rem;
}

.invite-card p {
  margin: 0 0 var(--space-4);
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--glass-border);
  border-top-color: var(--brand-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.success-state h2 {
  color: var(--brand-primary);
}

.error-state h2 {
  color: var(--color-danger, #ff6b6b);
}
</style>
