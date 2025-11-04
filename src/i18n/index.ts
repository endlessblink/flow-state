import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import he from './locales/he.json'

export type MessageSchema = typeof en

// RTL languages
const rtlLanguages = ['ar', 'he', 'fa', 'ur']

// Get saved locale or default to browser language
const getSavedLocale = (): string => {
  const saved = localStorage.getItem('app-locale')
  if (saved && ['en', 'he'].includes(saved)) {
    return saved
  }

  // Detect from browser
  const browserLang = navigator.language.split('-')[0]
  return ['en', 'he'].includes(browserLang) ? browserLang : 'en'
}

// Get direction for a locale
export const getLocaleDirection = (locale: string): 'ltr' | 'rtl' => {
  return rtlLanguages.includes(locale) ? 'rtl' : 'ltr'
}

const i18n = createI18n({
  legacy: false, // Use Composition API mode
  locale: getSavedLocale(),
  fallbackLocale: 'en',
  messages: {
    en,
    he
  },
  globalInjection: true, // Makes $t available in templates
  missingWarn: process.env.NODE_ENV !== 'production',
  fallbackWarn: process.env.NODE_ENV !== 'production'
})

export default i18n
