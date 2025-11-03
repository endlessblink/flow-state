<template>
  <button
    type="button"
    @click="handleGoogleSignIn"
    :disabled="isLoading"
    class="google-signin-button"
    :class="{ 'is-loading': isLoading }"
    data-testid="google-signin-button"
  >
    <!-- Google Logo -->
    <svg
      v-if="!isLoading"
      class="google-logo"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>

    <!-- Loading Spinner -->
    <div v-if="isLoading" class="loading-spinner">
      <div class="spinner"></div>
    </div>

    <span class="button-text">
      {{ isLoading ? loadingText : buttonText }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

interface Props {
  buttonText?: string
  loadingText?: string
}

const props = withDefaults(defineProps<Props>(), {
  buttonText: 'Continue with Google',
  loadingText: 'Signing in...'
})

interface Emits {
  success: [user: any]
  error: [error: Error]
}

const emit = defineEmits<Emits>()

// ===== State =====
const authStore = useAuthStore()
const isLoading = ref(false)

// ===== Methods =====
async function handleGoogleSignIn() {
  if (isLoading.value) return

  console.log('🔵 Google Sign-In button clicked')
  isLoading.value = true

  try {
    console.log('🔵 Calling authStore.signInWithGoogle()...')
    await authStore.signInWithGoogle()

    console.log('✅ Google Sign-In successful, user:', authStore.user?.email)
    console.log('✅ Emitting success event with user:', authStore.user)

    // Success - emit event
    emit('success', authStore.user)
  } catch (error: any) {
    console.error('❌ Google sign-in error:', error)
    emit('error', error)
  } finally {
    isLoading.value = false
    console.log('🔵 Google Sign-In complete, loading:', isLoading.value)
  }
}
</script>

<style scoped>
.google-signin-button {
  /* Layout */
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  width: 100%;
  height: var(--btn-lg);
  padding: 0 var(--space-4);

  /* Typography */
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);

  /* Visual - Google branding guidelines */
  background: var(--surface-default);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);

  /* Interaction */
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);

  /* Remove default button styles */
  outline: none;
  -webkit-appearance: none;
  -moz-appearance: none;
}

.google-signin-button:hover:not(:disabled) {
  background: var(--surface-hover);
  border-color: var(--border-hover);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.google-signin-button:active:not(:disabled) {
  transform: scale(0.98);
}

.google-signin-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.google-signin-button.is-loading {
  pointer-events: none;
}

/* Google Logo */
.google-logo {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

/* Loading Spinner */
.loading-spinner {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.spinner {
  width: 100%;
  height: 100%;
  border: 2px solid var(--border-default);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Button Text */
.button-text {
  user-select: none;
}

/* Focus Styles */
.google-signin-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Responsive */
@media (max-width: 640px) {
  .google-signin-button {
    font-size: var(--text-xs);
  }
}
</style>
