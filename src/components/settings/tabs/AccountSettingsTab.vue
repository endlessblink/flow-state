<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { LogOut, Key, Eye, EyeOff, Check, AlertCircle, Loader2 } from 'lucide-vue-next'
import SettingsSection from '../SettingsSection.vue'
import { supabase } from '@/services/auth/supabase'

const emit = defineEmits<{ closeModal: [] }>()
const authStore = useAuthStore()

// Change password state
const showChangePassword = ref(false)
const newPassword = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const passwordError = ref('')
const passwordSuccess = ref(false)
const isChangingPassword = ref(false)

// TASK-337: Computed properties for proper auth state handling
const isAuthReady = computed(() =>
  authStore.isInitialized && authStore.isAuthenticated && supabase !== null
)

// OAuth detection - only show password change for email users
const canChangePassword = computed(() => {
  const providers = authStore.user?.app_metadata?.providers as string[] | undefined
  // Users can change password if they signed up with email (have 'email' provider)
  return providers?.includes('email') ?? false
})

const handleSignOut = async () => {
  await authStore.signOut()
  emit('closeModal')
}

const handleChangePassword = async () => {
  // TASK-337: Null check for supabase client (Guest Mode protection)
  if (!supabase) {
    passwordError.value = 'Password change unavailable in Guest Mode'
    return
  }

  passwordError.value = ''
  passwordSuccess.value = false

  if (newPassword.value.length < 6) {
    passwordError.value = 'Password must be at least 6 characters'
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Passwords do not match'
    return
  }

  isChangingPassword.value = true

  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword.value
    })

    if (error) {
      passwordError.value = error.message
    } else {
      // TASK-337: Refresh session after password change
      await supabase.auth.refreshSession()

      passwordSuccess.value = true
      newPassword.value = ''
      confirmPassword.value = ''
      setTimeout(() => {
        showChangePassword.value = false
        passwordSuccess.value = false
      }, 2000)
    }
  } catch (err: unknown) {
    passwordError.value = err instanceof Error ? err.message : 'Failed to change password'
  } finally {
    isChangingPassword.value = false
  }
}
</script>

<template>
  <div class="account-settings-tab">
    <SettingsSection title="👤 Account Settings">
      <!-- TASK-337: Fixed template structure - single v-if block for authenticated content -->
      <template v-if="isAuthReady">
        <div class="account-info">
          <div class="user-details">
            <div class="user-email">
              {{ authStore.user?.email }}
            </div>
            <div class="user-status">
              Logged in via Supabase
            </div>
          </div>

          <div class="account-actions">
            <!-- Only show Change Password for email auth users -->
            <button
              v-if="canChangePassword"
              class="change-password-btn"
              @click="showChangePassword = !showChangePassword"
            >
              <Key :size="16" />
              <span>Change Password</span>
            </button>
            <button class="logout-btn" @click="handleSignOut">
              <LogOut :size="16" />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        <!-- Change Password Form -->
        <div v-if="showChangePassword" class="change-password-form">
          <div class="form-group">
            <label class="form-label">New Password</label>
            <div class="password-input-wrapper">
              <input
                v-model="newPassword"
                :type="showPassword ? 'text' : 'password'"
                class="form-input"
                placeholder="Enter new password"
              >
              <button class="toggle-visibility" @click="showPassword = !showPassword">
                <Eye v-if="!showPassword" :size="16" />
                <EyeOff v-else :size="16" />
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Confirm Password</label>
            <input
              v-model="confirmPassword"
              :type="showPassword ? 'text' : 'password'"
              class="form-input"
              placeholder="Confirm new password"
            >
          </div>

          <div v-if="passwordError" class="password-error">
            <AlertCircle :size="14" />
            {{ passwordError }}
          </div>

          <div v-if="passwordSuccess" class="password-success">
            <Check :size="14" />
            Password changed successfully!
          </div>

          <button
            class="save-password-btn"
            :disabled="isChangingPassword || !newPassword || !confirmPassword"
            @click="handleChangePassword"
          >
            {{ isChangingPassword ? 'Changing...' : 'Save New Password' }}
          </button>
        </div>
      </template>

      <!-- Loading state while auth initializes -->
      <div v-else-if="!authStore.isInitialized" class="loading-state">
        <Loader2 :size="20" class="animate-spin" />
        <span>Loading account info...</span>
      </div>

      <!-- Guest Mode - shows when not authenticated -->
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
  background: var(--color-danger-bg-light);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: var(--color-danger);
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

.account-actions {
  display: flex;
  gap: var(--space-2);
}

.change-password-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal);
}

.change-password-btn:hover {
  background: var(--glass-bg-strong);
  color: var(--text-primary);
}

.change-password-form {
  margin-top: var(--space-4);
  padding: var(--space-4);
  background: var(--glass-bg-soft);
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.form-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  padding-right: var(--space-10);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.toggle-visibility {
  position: absolute;
  right: var(--space-2);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-1);
}

.toggle-visibility:hover {
  color: var(--text-primary);
}

.password-error {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-danger);
  font-size: var(--text-sm);
}

.password-success {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-success);
  font-size: var(--text-sm);
}

.save-password-btn {
  background: var(--color-primary);
  border: none;
  color: white;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal);
}

.save-password-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
}

.save-password-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* TASK-337: Loading state styles */
.loading-state {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4);
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
