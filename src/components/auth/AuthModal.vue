<template>
  <BaseModal
    :is-open="uiStore.authModalOpen"
    :show-footer="false"
    size="md"
    close-on-overlay-click
    close-on-escape
    @close="handleClose"
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
        v-if="uiStore.authModalView === 'login'"
        @success="handleAuthSuccess"
        @switch-to-signup="uiStore.switchAuthView('signup')"
        @forgot-password="handleForgotPassword"
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
        v-else-if="uiStore.authModalView === 'signup'"
        @success="handleAuthSuccess"
        @switch-to-login="uiStore.switchAuthView('login')"
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
        v-else-if="uiStore.authModalView === 'reset-password'"
        :prefilled-email="resetEmail"
        @success="handleResetSuccess"
        @switch-to-login="uiStore.switchAuthView('login')"
      />
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { useAuthStore, type User } from '@/stores/auth'
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
// BUG-340: Fixed Tauri WebView reactivity issue - use nextTick + immediate close
watch(() => authStore.isAuthenticated, async (isAuth, oldIsAuth) => {
  console.log('👁️ Auth state changed in modal, isAuthenticated:', isAuth, 'was:', oldIsAuth, 'modalOpen:', uiStore.authModalOpen)

  // Only act on transition from false -> true (sign-in), not on initial load
  if (isAuth && !oldIsAuth && uiStore.authModalOpen) {
    console.log('✅ User just signed in, auto-closing modal')
    const redirectPath = uiStore.authModalRedirect

    // BUG-340: Use nextTick to ensure Vue reactivity catches up in Tauri WebView
    await nextTick()

    uiStore.closeAuthModal()
    console.log('✅ Modal closed, authModalOpen is now:', uiStore.authModalOpen)

    // Redirect if needed
    if (redirectPath && router.currentRoute.value && redirectPath !== router.currentRoute.value.fullPath) {
      console.log('🔄 Redirecting to:', redirectPath)
      router.push(redirectPath)
    }
  }
}, { flush: 'post' })

// BUG-1085: Fallback watcher to catch race conditions where modal stays open after auth
// This handles edge cases on mobile PWA where the primary watcher timing fails
watch(
  () => [authStore.isAuthenticated, uiStore.authModalOpen] as const,
  ([isAuth, modalOpen]) => {
    if (isAuth && modalOpen) {
      console.warn('⚠️ [AuthModal] BUG-1085 fallback: Modal still open after auth, forcing close')
      uiStore.closeAuthModal()
    }
  },
  { immediate: true }
)

// ===== Methods =====
async function handleAuthSuccess(user: User) {
  console.log('✅ Authentication successful:', user?.email)
  console.log('🔍 Auth modal state before close:', {
    isOpen: uiStore.authModalOpen,
    redirectPath: uiStore.authModalRedirect,
    authStoreUser: authStore.user?.email,
    isAuthenticated: authStore.isAuthenticated
  })

  // BUG-340: Use nextTick to ensure Vue reactivity catches up in Tauri WebView
  await nextTick()

  // Close modal immediately - don't wait for reactive state
  const redirectPath = uiStore.authModalRedirect
  uiStore.closeAuthModal()

  // BUG-340: Force another tick to ensure UI updates in Tauri
  await nextTick()

  console.log('✅ Auth modal closed. New state:', {
    isOpen: uiStore.authModalOpen,
    isAuthenticated: authStore.isAuthenticated
  })

  // Redirect if needed
  if (redirectPath) {
    console.log('🔄 Redirecting to:', redirectPath)
    await router.push(redirectPath)
  }
}

function handleForgotPassword(email: string) {
  resetEmail.value = email
  uiStore.switchAuthView('reset-password')
}

async function handleResetSuccess() {
  // Switch back to login after successful reset email
  uiStore.switchAuthView('login')
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
  padding: var(--space-4) 0;
  /* Allow content to define height */
}

/* Responsive */
@media (max-width: 640px) {
  .auth-modal-body {
    padding: var(--space-3) 0;
  }
}
</style>
