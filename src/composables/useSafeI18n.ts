/**
 * Safe i18n composable that works in both main app and Storybook
 *
 * In Storybook, the global i18n scope may not be available due to how
 * Storybook creates multiple Vue app instances. This composable provides
 * a standalone translation function that doesn't depend on vue-i18n's
 * composition API, avoiding "Unexpected return type in composer" errors.
 */
import { ref, computed } from 'vue'

type Messages = Record<string, any>

// Inline translations for auth components
// This bypasses vue-i18n's message compiler which transforms JSON imports to AST objects
const messages: Record<string, Messages> = {
  en: {
    auth: {
      displayName: 'Display Name',
      displayNamePlaceholder: 'Enter your display name',
      email: 'Email',
      emailPlaceholder: 'Enter your email',
      password: 'Password',
      passwordPlaceholder: 'Enter your password',
      confirmPassword: 'Confirm Password',
      confirmPasswordPlaceholder: 'Confirm your password',
      passwordMismatch: 'Passwords do not match',
      createAccount: 'Create Account',
      creatingAccount: 'Creating Account...',
      or: 'or',
      haveAccount: 'Already have an account?',
      signIn: 'Sign In',
      sending: 'Sending...',
      sendResetLink: 'Send Reset Link',
      backToLogin: 'Back to Login',
      login: {
        title: 'Sign In',
        subtitle: 'Welcome back! Sign in to access your tasks',
        email: 'Email',
        emailPlaceholder: 'Enter your email',
        password: 'Password',
        passwordPlaceholder: 'Enter your password',
        forgotPassword: 'Forgot password?',
        or: 'or',
        noAccount: "Don't have an account?",
        signUp: 'Sign Up',
        signingIn: 'Signing In...',
        signIn: 'Sign In'
      },
      signup: {
        title: 'Create Account',
        subtitle: 'Join FlowState to boost your productivity'
      },
      resetPassword: {
        title: 'Reset Password',
        subtitle: 'Enter your email to receive a password reset link',
        emailSent: 'Email Sent!',
        checkEmail: 'Check your inbox for the password reset link',
        didntReceive: "Didn't receive the email?",
        resend: 'Resend'
      }
    }
  },
  he: {
    auth: {
      displayName: 'שם תצוגה',
      displayNamePlaceholder: 'הזן את שם התצוגה שלך',
      email: 'אימייל',
      emailPlaceholder: 'הזן את האימייל שלך',
      password: 'סיסמה',
      passwordPlaceholder: 'הזן את הסיסמה שלך',
      confirmPassword: 'אימות סיסמה',
      confirmPasswordPlaceholder: 'אמת את הסיסמה שלך',
      passwordMismatch: 'הסיסמאות לא תואמות',
      createAccount: 'צור חשבון',
      creatingAccount: 'יוצר חשבון...',
      or: 'או',
      haveAccount: 'כבר יש לך חשבון?',
      signIn: 'התחבר',
      sending: 'שולח...',
      sendResetLink: 'שלח קישור לאיפוס',
      backToLogin: 'חזור להתחברות',
      login: {
        title: 'התחברות',
        subtitle: 'ברוך שובך! התחבר כדי לגשת למשימות שלך',
        email: 'אימייל',
        emailPlaceholder: 'הזן את האימייל שלך',
        password: 'סיסמה',
        passwordPlaceholder: 'הזן את הסיסמה שלך',
        forgotPassword: 'שכחת סיסמה?',
        or: 'או',
        noAccount: 'אין לך חשבון?',
        signUp: 'הירשם',
        signingIn: 'מתחבר...',
        signIn: 'התחבר'
      },
      signup: {
        title: 'צור חשבון',
        subtitle: 'הצטרף ל-FlowState כדי להגביר את הפרודוקטיביות שלך'
      },
      resetPassword: {
        title: 'איפוס סיסמה',
        subtitle: 'הזן את האימייל שלך כדי לקבל קישור לאיפוס סיסמה',
        emailSent: 'האימייל נשלח!',
        checkEmail: 'בדוק את תיבת הדואר שלך לקישור לאיפוס סיסמה',
        didntReceive: 'לא קיבלת את האימייל?',
        resend: 'שלח שוב'
      }
    }
  }
}

// Shared reactive locale - defaults to 'en', syncs with global if available
const currentLocale = ref('en')

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Messages, path: string): string {
  const value = path.split('.').reduce((acc, key) => acc?.[key], obj)
  return typeof value === 'string' ? value : path
}

/**
 * Safe i18n hook that works in both main app and Storybook
 *
 * Uses a standalone implementation that doesn't rely on vue-i18n's
 * composition API, which fails in Storybook's multi-app environment.
 */
export function useSafeI18n() {
  const locale = computed({
    get: () => currentLocale.value,
    set: (val: string) => { currentLocale.value = val }
  })

  /**
   * Translation function - returns translated string or key if not found
   */
  function t(key: string, params?: Record<string, string | number>): string {
    const msgLocale = messages[currentLocale.value] || messages.en
    let translation = getNestedValue(msgLocale, key)

    // Handle interpolation if params provided
    if (params && translation !== key) {
      Object.entries(params).forEach(([paramKey, value]) => {
        translation = translation.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(value))
      })
    }

    return translation
  }

  return { t, locale }
}

/**
 * Set the locale for useSafeI18n (can be called from app initialization)
 */
export function setSafeI18nLocale(newLocale: string) {
  if (messages[newLocale]) {
    currentLocale.value = newLocale
  }
}

export default useSafeI18n
