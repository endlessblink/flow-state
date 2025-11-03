<template>
  <div class="reset-password-view">
    <div class="form-header">
      <h2 class="form-title">{{ $t('auth.resetPassword.title', 'Reset Password') }}</h2>
      <p class="form-subtitle">
        {{ $t('auth.resetPassword.subtitle', "We'll send you an email with instructions to reset your password") }}
      </p>
    </div>

    <form v-if="!emailSent" @submit.prevent="handleSubmit" class="auth-form">
      <!-- Error Display -->
      <div v-if="errorMessage" class="error-message" role="alert">
        <AlertCircle class="error-icon" />
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Email Input -->
      <BaseInput
        v-model="email"
        type="email"
        :label="$t('auth.email', 'Email')"
        :placeholder="$t('auth.emailPlaceholder', 'your@email.com')"
        required
        :disabled="isLoading"
        @keydown.enter="handleSubmit"
        data-testid="reset-email-input"
        autocomplete="email"
      />

      <!-- Submit Button -->
      <BaseButton
        type="submit"
        variant="primary"
        size="lg"
        :loading="isLoading"
        :disabled="!isFormValid || isLoading"
        class="submit-button"
        data-testid="send-reset-button"
      >
        {{ isLoading ? $t('auth.sending', 'Sending...') : $t('auth.sendResetLink', 'Send Reset Link') }}
      </BaseButton>

      <!-- Back to Login Link -->
      <div class="form-footer">
        <button
          type="button"
          @click="$emit('switchToLogin')"
          class="back-link"
          :disabled="isLoading"
        >
          ← {{ $t('auth.backToLogin', 'Back to login') }}
        </button>
      </div>
    </form>

    <!-- Success Message -->
    <div v-else class="success-message">
      <div class="success-icon-wrapper">
        <CheckCircle class="success-icon" />
      </div>
      <h3 class="success-title">{{ $t('auth.resetPassword.emailSent', 'Email Sent!') }}</h3>
      <p class="success-text">
        {{ $t('auth.resetPassword.checkEmail', 'Check your email for a link to reset your password.') }}
      </p>
      <p class="success-subtext">
        {{ $t('auth.resetPassword.didntReceive', "Didn't receive the email?") }}
        <button @click="handleSubmit" class="resend-link" :disabled="isLoading">
          {{ $t('auth.resetPassword.resend', 'Resend') }}
        </button>
      </p>
      <BaseButton
        variant="secondary"
        size="lg"
        @click="$emit('switchToLogin')"
        class="back-button"
      >
        {{ $t('auth.backToLogin', 'Back to login') }}
      </BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import { AlertCircle, CheckCircle } from 'lucide-vue-next'

interface Props {
  prefilledEmail?: string
}

const props = defineProps<Props>()

interface Emits {
  success: []
  switchToLogin: []
}

const emit = defineEmits<Emits>()

// ===== State =====
const authStore = useAuthStore()
const email = ref('')
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const emailSent = ref(false)

// ===== Lifecycle =====
onMounted(() => {
  if (props.prefilledEmail) {
    email.value = props.prefilledEmail
  }
})

// ===== Computed =====
const isFormValid = computed(() => {
  return email.value.trim() !== '' && isValidEmail(email.value)
})

// ===== Methods =====
function isValidEmail(value: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(value)
}

async function handleSubmit() {
  if (!isFormValid.value || isLoading.value) return

  errorMessage.value = null
  isLoading.value = true

  try {
    await authStore.sendPasswordResetEmail(email.value.trim())

    // Success - show confirmation
    emailSent.value = true
    emit('success')
  } catch (error: any) {
    // Error message is already set by auth store
    errorMessage.value = authStore.error || 'Failed to send reset email. Please try again.'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.reset-password-view {
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
}

.form-header {
  text-align: center;
  margin-bottom: var(--space-8);
}

.form-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0 0 var(--space-2) 0;
}

.form-subtitle {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* Error Message */
.error-message {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
  border-radius: var(--radius-lg);
  color: var(--color-danger);
  font-size: var(--text-sm);
  animation: slideIn 0.2s var(--spring-smooth);
}

.error-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Submit Button */
.submit-button {
  width: 100%;
  margin-top: var(--space-2);
}

/* Footer */
.form-footer {
  display: flex;
  justify-content: center;
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-default);
}

.back-link {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) var(--spring-smooth);
}

.back-link:hover:not(:disabled) {
  color: var(--text-primary);
  background: var(--surface-hover);
}

.back-link:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Success Message */
.success-message {
  text-align: center;
  padding: var(--space-8) 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.success-icon-wrapper {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--color-success) 15%, transparent);
  border-radius: 50%;
  margin-bottom: var(--space-2);
  animation: scaleIn 0.3s var(--spring-bounce);
}

.success-icon {
  width: 32px;
  height: 32px;
  color: var(--color-success);
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.5);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.success-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.success-text {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
  max-width: 320px;
  line-height: 1.6;
}

.success-subtext {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: var(--space-2) 0 0 0;
}

.resend-link {
  background: none;
  border: none;
  color: var(--color-primary);
  font-weight: var(--font-medium);
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}

.resend-link:hover:not(:disabled) {
  color: var(--color-primary-hover);
}

.resend-link:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.back-button {
  width: 100%;
  margin-top: var(--space-4);
}

/* Responsive */
@media (max-width: 640px) {
  .reset-password-view {
    max-width: 100%;
  }

  .form-title {
    font-size: var(--text-xl);
  }

  .success-message {
    padding: var(--space-6) 0;
  }
}
</style>
