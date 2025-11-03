<template>
  <BaseModal
    :is-open="uiStore.isAuthModalOpen"
    :show-footer="false"
    size="md"
    @close="handleClose"
    :close-on-overlay-click="true"
    :close-on-escape="true"
  >
    <template #title>
      <div class="auth-modal-title">
        <!-- Title handled by individual forms -->
      </div>
    </template>

    <!-- Modal Body -->
    <div class="auth-modal-body">
      <!-- Login Form -->
      <LoginForm
        v-if="uiStore.authModalMode === 'login'"
        @success="handleAuthSuccess"
        @switchToSignup="() => uiStore.setAuthModalMode('signup')"
        @forgotPassword="handleForgotPassword"
      >
        <template #google-signin>
          <GoogleSignInButton
            @success="handleAuthSuccess"
            @error="handleGoogleError"
          />
        </template>
      </LoginForm>

      <!-- Signup Form -->
      <SignupForm
        v-else-if="uiStore.authModalMode === 'signup'"
        @success="handleAuthSuccess"
        @switchToLogin="() => uiStore.setAuthModalMode('login')"
      >
        <template #google-signin>
          <GoogleSignInButton
            @success="handleAuthSuccess"
            @error="handleGoogleError"
          />
        </template>
      </SignupForm>

      <!-- Reset Password View -->
      <ResetPasswordView
        v-else-if="uiStore.authModalMode === 'reset'"
        :prefilled-email="resetEmail"
        @success="handleResetSuccess"
        @switchToLogin="() => uiStore.setAuthModalMode('login')"
      />
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import BaseModal from '@/components/base/BaseModal.vue'
import LoginForm from './LoginForm.vue'
import SignupForm from './SignupForm.vue'
import GoogleSignInButton from './GoogleSignInButton.vue'
import ResetPasswordView from './ResetPasswordView.vue'

// ===== Stores =====
const uiStore = useUIStore()
const authStore = useAuthStore()
const router = useRouter()

// ===== State =====
const resetEmail = ref('')

// ===== Watchers =====
// Auto-close modal when user becomes authenticated
watch(() => authStore.isAuthenticated, (isAuth) => {
  console.log('👁️ Auth state changed in modal, isAuthenticated:', isAuth, 'modalOpen:', uiStore.isAuthModalOpen)
  if (isAuth && uiStore.isAuthModalOpen) {
    console.log('✅ User is now authenticated, auto-closing modal')
    const redirectPath = uiStore.authModalRedirectPath
    uiStore.closeAuthModal()

    // Redirect if needed
    if (redirectPath && redirectPath !== router.currentRoute.value.fullPath) {
      console.log('🔄 Redirecting to:', redirectPath)
      router.push(redirectPath)
    }
  }
})

// ===== Methods =====
function handleAuthSuccess(user: any) {
  console.log('✅ Authentication successful:', user?.email)

  // Close modal
  const redirectPath = uiStore.authModalRedirectPath
  uiStore.closeAuthModal()

  // Redirect if needed
  if (redirectPath) {
    router.push(redirectPath)
  }
}

function handleForgotPassword(email: string) {
  resetEmail.value = email
  uiStore.setAuthModalMode('reset')
}

async function handleResetSuccess() {
  // Switch back to login after successful reset email
  uiStore.setAuthModalMode('login')
}

function handleGoogleError(error: Error) {
  console.error('Google sign-in error:', error)
  // Error is already handled by GoogleSignInButton and auth store
}

function handleClose() {
  uiStore.closeAuthModal()
}
</script>

<style scoped>
.auth-modal-title {
  /* Title is handled by individual forms */
  display: none;
}

.auth-modal-body {
  padding: var(--space-6) 0;
  min-height: 400px;
}

/* Responsive */
@media (max-width: 640px) {
  .auth-modal-body {
    padding: var(--space-4) 0;
    min-height: 350px;
  }
}
</style>
