<!-- TASK-040: i18n restored Dec 23, 2025 -->
<template>
  <div class="login-form">
    <div class="form-header">
      <div class="auth-brand-icon">
        🍅
      </div>
      <h2 class="form-title">
        <span class="gradient-text">{{ t('auth.login.title') }}</span>
      </h2>
      <p class="form-subtitle">
        {{ t('auth.login.subtitle') }}
      </p>
    </div>

    <form class="auth-form" @submit.prevent="handleSubmit">
      <!-- Error Display -->
      <div v-if="errorMessage" class="error-message" role="alert">
        <AlertCircle class="error-icon" />
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Email Input -->
      <BaseInput
        v-model="email"
        type="email"
        :label="t('auth.login.email')"
        :placeholder="t('auth.login.emailPlaceholder')"
        required
        :disabled="isLoading"
        data-testid="email-input"
        autocomplete="email"
        @keydown.enter="handleSubmit"
      />

      <!-- Password Input -->
      <div class="password-input-wrapper">
        <BaseInput
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          :label="t('auth.login.password')"
          :placeholder="t('auth.login.passwordPlaceholder')"
          required
          :disabled="isLoading"
          data-testid="password-input"
          autocomplete="current-password"
          @keydown.enter="handleSubmit"
        >
          <template #suffix>
            <button
              type="button"
              class="password-toggle"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              tabindex="-1"
              @click="showPassword = !showPassword"
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
          class="forgot-password-link"
          :disabled="isLoading"
          @click="$emit('forgotPassword', email)"
        >
          {{ t('auth.login.forgotPassword') }}
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
        {{ isLoading ? t('auth.login.signingIn') : t('auth.login.signIn') }}
      </BaseButton>

      <!-- Divider -->
      <div class="divider">
        <span>{{ t('auth.login.or') }}</span>
      </div>

      <!-- Google Sign-In (will be separate component) -->
      <slot name="google-signin" />

      <!-- Sign Up Link -->
      <div class="form-footer">
        <span class="footer-text">
          {{ t('auth.login.noAccount') }}
        </span>
        <button
          type="button"
          class="switch-mode-link"
          :disabled="isLoading"
          @click="$emit('switchToSignup')"
        >
          {{ t('auth.login.signUp') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSafeI18n } from '@/composables/useSafeI18n'
import { useAuthStore, type User } from '@/stores/auth'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import { EyeIcon, EyeOffIcon, AlertCircle } from 'lucide-vue-next'

interface Props {
  redirectTo?: string
}

const _props = defineProps<Props>()

const emit = defineEmits<Emits>()

interface Emits {
  success: [user: User]
  switchToSignup: []
  forgotPassword: [email: string]
}

// ===== i18n =====
const { t } = useSafeI18n()

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
    await authStore.signInWithPassword(email.value.trim(), password.value)

    // Success - emit event
    if (authStore.user) {
      emit('success', authStore.user as User)
    }

    // Clear form
    email.value = ''
    password.value = ''
  } catch (_error: unknown) {
    // Error message is already set by auth store
    errorMessage.value = authStore.errorMessage || 'Sign in failed. Please try again.'
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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.auth-brand-icon {
  font-size: var(--space-10);
  filter: drop-shadow(0 0 10px var(--brand-primary-alpha-30));
  margin-bottom: var(--space-2);
}

.form-title {
  font-size: var(--space-7);
  font-weight: 700;
  margin-bottom: var(--space-1);
  letter-spacing: -0.02em;
}

.gradient-text {
  background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.form-subtitle {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  margin: 0;
  line-height: var(--leading-normal);
  max-width: 250px;
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
  padding: var(--space-2) var(--space-4);
  background: var(--danger-bg-subtle);
  border: 1px solid var(--danger-border-subtle);
  border-radius: var(--radius-md);
  color: var(--priority-high-text);
  font-size: var(--font-size-sm);
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
  color: var(--brand-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  transition: all var(--duration-normal);
}

.forgot-password-link:hover:not(:disabled) {
  background: var(--glass-bg-soft);
  color: var(--brand-hover);
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
  margin: var(--space-4) 0;
}

.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--glass-border), transparent);
}

.divider span {
  position: relative;
  display: inline-block;
  padding: 0 var(--space-4);
  background: #1c1a30; /* Matches modal bg - purple-tinted */
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* Footer */
.form-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--glass-border);
}

.footer-text {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.switch-mode-link {
  background: none;
  border: none;
  color: var(--brand-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  transition: all var(--duration-normal);
}

.switch-mode-link:hover:not(:disabled) {
  background: var(--glass-bg-soft);
  color: var(--brand-hover);
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
