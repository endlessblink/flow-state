<template>
  <div class="login-form">
    <div class="form-header">
      <h2 class="form-title">{{ safeT('auth.login.title', 'Sign In') }}</h2>
      <p class="form-subtitle">{{ safeT('auth.login.subtitle', 'Welcome back! Sign in to access your tasks') }}</p>
    </div>

    <form @submit.prevent="handleSubmit" class="auth-form">
      <!-- Error Display -->
      <div v-if="errorMessage" class="error-message" role="alert">
        <AlertCircle class="error-icon" />
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Email Input -->
      <BaseInput
        v-model="email"
        type="email"
        :label="safeT('auth.email', 'Email')"
        :placeholder="safeT('auth.emailPlaceholder', 'Enter your email')"
        required
        :disabled="isLoading"
        @keydown.enter="handleSubmit"
        data-testid="email-input"
        autocomplete="email"
      />

      <!-- Password Input -->
      <div class="password-input-wrapper">
        <BaseInput
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          :label="safeT('auth.password', 'Password')"
          :placeholder="safeT('auth.passwordPlaceholder', 'Enter your password')"
          required
          :disabled="isLoading"
          @keydown.enter="handleSubmit"
          data-testid="password-input"
          autocomplete="current-password"
        >
          <template #suffix>
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="password-toggle"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              tabindex="-1"
            >
              <EyeIcon v-if="!showPassword" class="icon" />
              <EyeOffIcon v-else class="icon" />
            </button>
          </template>
        </BaseInput>
      </div>

      <!-- Forgot Password Link -->
      <div class="form-actions">
        <button
          type="button"
          @click="$emit('forgotPassword', email)"
          class="forgot-password-link"
          :disabled="isLoading"
        >
          {{ safeT('auth.forgotPassword', 'Forgot password?') }}
        </button>
      </div>

      <!-- Submit Button -->
      <BaseButton
        type="submit"
        variant="primary"
        size="lg"
        :loading="isLoading"
        :disabled="!isFormValid || isLoading"
        class="submit-button"
        data-testid="login-button"
      >
        {{ isLoading ? t('auth.signingIn') : t('auth.signIn') }}
      </BaseButton>

      <!-- Divider -->
      <div class="divider">
        <span>{{ t('auth.or') }}</span>
      </div>

      <!-- Google Sign-In (will be separate component) -->
      <slot name="google-signin" />

      <!-- Sign Up Link -->
      <div class="form-footer">
        <span class="footer-text">
          {{ t('auth.noAccount') }}
        </span>
        <button
          type="button"
          @click="$emit('switchToSignup')"
          class="switch-mode-link"
          :disabled="isLoading"
        >
          {{ t('auth.signUp') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import { EyeIcon, EyeOffIcon, AlertCircle } from 'lucide-vue-next'

interface Props {
  redirectTo?: string
}

const props = defineProps<Props>()

interface Emits {
  success: [user: any]
  switchToSignup: []
  forgotPassword: [email: string]
}

const emit = defineEmits<Emits>()

// ===== i18n Setup =====
const { t } = useI18n()

// Safe translation function with fallbacks
const safeT = (key: string, fallback?: string): string => {
  try {
    const result = t(key)
    return typeof result === 'string' ? result : fallback || key
  } catch (error) {
    console.warn(`Translation error for key: ${key}`, error)
    return fallback || key
  }
}

// ===== State =====
const authStore = useAuthStore()
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

// ===== Computed =====
const isFormValid = computed(() => {
  return email.value.trim() !== '' &&
         password.value.trim() !== '' &&
         isValidEmail(email.value)
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
    await authStore.signInWithEmail(email.value.trim(), password.value)

    // Success - emit event
    emit('success', authStore.user)

    // Clear form
    email.value = ''
    password.value = ''
  } catch (error: any) {
    // Error message is already set by auth store
    errorMessage.value = authStore.error || 'Sign in failed. Please try again.'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.login-form {
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

/* Password Input */
.password-input-wrapper {
  position: relative;
}

.password-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2);
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  transition: color var(--duration-fast) var(--spring-smooth);
  border-radius: var(--radius-md);
}

.password-toggle:hover {
  color: var(--text-primary);
  background: var(--surface-hover);
}

.password-toggle .icon {
  width: 18px;
  height: 18px;
}

/* Form Actions */
.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: calc(var(--space-2) * -1);
}

.forgot-password-link {
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) var(--spring-smooth);
}

.forgot-password-link:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
}

.forgot-password-link:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Submit Button */
.submit-button {
  width: 100%;
  margin-top: var(--space-2);
}

/* Divider */
.divider {
  position: relative;
  text-align: center;
  margin: var(--space-2) 0;
}

.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--border-default);
}

.divider span {
  position: relative;
  display: inline-block;
  padding: 0 var(--space-3);
  background: var(--surface-default);
  color: var(--text-muted);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Footer */
.form-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-default);
}

.footer-text {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.switch-mode-link {
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) var(--spring-smooth);
}

.switch-mode-link:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
}

.switch-mode-link:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 640px) {
  .login-form {
    max-width: 100%;
  }

  .form-title {
    font-size: var(--text-xl);
  }
}
</style>
