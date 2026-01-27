<template>
  <div class="signup-form">
    <div class="form-header">
      <div class="auth-brand-icon">
        🍅
      </div>
      <h2 class="form-title">
        <span class="gradient-text">{{ t('auth.signup.title') }}</span>
      </h2>
      <p class="form-subtitle">
        {{ t('auth.signup.subtitle') }}
      </p>
    </div>

    <form class="auth-form" @submit.prevent="handleSubmit">
      <!-- Error Display -->
      <div v-if="errorMessage" class="error-message" role="alert">
        <AlertCircle class="error-icon" />
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Display Name Input (Optional) -->
      <BaseInput
        v-model="displayName"
        type="text"
        :label="t('auth.displayName')"
        :placeholder="t('auth.displayNamePlaceholder')"
        :disabled="isLoading"
        data-testid="displayname-input"
        autocomplete="name"
      />

      <!-- Email Input -->
      <BaseInput
        v-model="email"
        type="email"
        :label="t('auth.email')"
        :placeholder="t('auth.emailPlaceholder')"
        required
        :disabled="isLoading"
        data-testid="email-input"
        autocomplete="email"
      />

      <!-- Password Input -->
      <div class="password-input-wrapper">
        <BaseInput
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          :label="t('auth.password')"
          :placeholder="t('auth.passwordPlaceholder')"
          required
          :disabled="isLoading"
          data-testid="password-input"
          autocomplete="new-password"
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

        <!-- Password Strength Indicator -->
        <div v-if="password" class="password-strength">
          <div class="strength-bar">
            <div
              class="strength-fill"
              :class="`strength-${passwordStrength.level}`"
              :style="{ width: `${passwordStrength.percent}%` }"
            />
          </div>
          <span class="strength-text" :class="`strength-${passwordStrength.level}`">
            {{ passwordStrength.text }}
          </span>
        </div>
      </div>

      <!-- Confirm Password Input -->
      <BaseInput
        v-model="confirmPassword"
        :type="showConfirmPassword ? 'text' : 'password'"
        :label="t('auth.confirmPassword')"
        :placeholder="t('auth.confirmPasswordPlaceholder')"
        required
        :disabled="isLoading"
        data-testid="confirm-password-input"
        autocomplete="new-password"
      >
        <template #suffix>
          <button
            type="button"
            class="password-toggle"
            :aria-label="showConfirmPassword ? 'Hide password' : 'Show password'"
            tabindex="-1"
            @click="showConfirmPassword = !showConfirmPassword"
          >
            <EyeIcon v-if="!showConfirmPassword" class="icon" />
            <EyeOffIcon v-else class="icon" />
          </button>
        </template>
      </BaseInput>

      <!-- Password Match Indicator -->
      <div v-if="confirmPassword && password !== confirmPassword" class="validation-error">
        <AlertCircle class="error-icon-small" />
        <span>{{ t('auth.passwordMismatch') }}</span>
      </div>

      <!-- Submit Button -->
      <BaseButton
        type="submit"
        variant="primary"
        size="lg"
        :loading="isLoading"
        :disabled="!isFormValid || isLoading"
        class="submit-button"
        data-testid="signup-button"
      >
        {{ isLoading ? t('auth.creatingAccount') : t('auth.createAccount') }}
      </BaseButton>

      <!-- Divider -->
      <div class="divider">
        <span>{{ t('auth.or') }}</span>
      </div>

      <!-- Google Sign-In (will be separate component) -->
      <slot name="google-signin" />

      <!-- Sign In Link -->
      <div class="form-footer">
        <span class="footer-text">
          {{ t('auth.haveAccount') }}
        </span>
        <button
          type="button"
          class="switch-mode-link"
          :disabled="isLoading"
          @click="$emit('switchToLogin')"
        >
          {{ t('auth.signIn') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore, type User } from '@/stores/auth'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import { EyeIcon, EyeOffIcon, AlertCircle } from 'lucide-vue-next'

interface Emits {
  success: [user: User]
  switchToLogin: []
}

const emit = defineEmits<Emits>()

// ===== i18n =====
import { useSafeI18n } from '@/composables/useSafeI18n'
const { t } = useSafeI18n()

// ===== State =====
const authStore = useAuthStore()
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const displayName = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

// ===== Computed =====
const isFormValid = computed(() => {
  return email.value.trim() !== '' &&
         password.value.trim() !== '' &&
         confirmPassword.value.trim() !== '' &&
         password.value === confirmPassword.value &&
         isValidEmail(email.value) &&
         password.value.length >= 8
})

const passwordStrength = computed(() => {
  const pwd = password.value
  if (!pwd) return { level: 'none', percent: 0, text: '' }

  let score = 0
  let text = ''
  let level = 'weak'

  // Length check
  if (pwd.length >= 8) score += 25
  if (pwd.length >= 12) score += 15

  // Character variety checks
  if (/[a-z]/.test(pwd)) score += 15 // lowercase
  if (/[A-Z]/.test(pwd)) score += 15 // uppercase
  if (/[0-9]/.test(pwd)) score += 15 // numbers
  if (/[^a-zA-Z0-9]/.test(pwd)) score += 15 // special chars

  // Determine level and text
  if (score < 40) {
    level = 'weak'
    text = 'Weak'
  } else if (score < 70) {
    level = 'medium'
    text = 'Medium'
  } else {
    level = 'strong'
    text = 'Strong'
  }

  return { level, percent: Math.min(score, 100), text }
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
    await authStore.signUpWithEmail(
      email.value.trim(),
      password.value,
      displayName.value.trim() ? { full_name: displayName.value.trim() } : undefined
    )

    // Success - emit event
    // Success - emit event
    if (authStore.user) {
      emit('success', authStore.user)
    }

    // Clear form
    email.value = ''
    password.value = ''
    confirmPassword.value = ''
    displayName.value = ''
  } catch (_error: unknown) {
    // Error message is already set by auth store
    errorMessage.value = authStore.errorMessage || 'Sign up failed. Please try again.'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.signup-form {
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
  font-size: 40px;
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

/* Validation Error */
.validation-error {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: calc(var(--space-2) * -1);
  color: var(--priority-high-text);
  font-size: var(--font-size-xs);
}

.error-icon-small {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
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

/* Password Strength Indicator */
.password-strength {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.strength-bar {
  flex: 1;
  height: 4px;
  background: var(--surface-hover);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  transition: all var(--duration-normal) var(--spring-smooth);
  border-radius: var(--radius-full);
}

.strength-fill.strength-weak {
  background: var(--priority-high-text);
}

.strength-fill.strength-medium {
  background: var(--status-in-progress-text);
}

.strength-fill.strength-strong {
  background: var(--status-done-text);
}

.strength-text {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  white-space: nowrap;
}

.strength-text.strength-weak {
  color: var(--priority-high-text);
}

.strength-text.strength-medium {
  color: var(--status-in-progress-text);
}

.strength-text.strength-strong {
  color: var(--status-done-text);
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
  .signup-form {
    max-width: 100%;
  }

  .form-title {
    font-size: var(--text-xl);
  }
}
</style>
