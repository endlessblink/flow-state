<!-- TASK-040: i18n restored Dec 23, 2025 -->
<template>
  <div class="language-settings">
    <!-- Language Selection -->
    <div class="setting-group">
      <h3 class="setting-title">
        {{ $t('settings.language', 'Language') }}
      </h3>
      <div class="language-options">
        <button
          v-for="lang in availableLanguages"
          :key="lang.code"
          class="language-option"
          :class="[
            { active: currentLanguage.code === lang.code }
          ]"
          :aria-label="`Switch to ${lang.name}`"
          @click="handleLanguageChange(lang.code)"
        >
          <span class="language-native">{{ lang.nativeName }}</span>
          <span class="language-english">{{ lang.name }}</span>
        </button>
      </div>
    </div>

    <!-- Text Direction -->
    <div class="setting-group">
      <h3 class="setting-title">
        {{ $t('settings.direction', 'Text Direction') }}
      </h3>
      <div class="direction-options">
        <button
          v-for="option in directionOptions"
          :key="option.value"
          class="direction-option"
          :class="[
            { active: directionPreference === option.value }
          ]"
          :aria-label="`Set text direction to ${option.label}`"
          @click="handleDirectionChange(option.value)"
        >
          <div class="direction-icon">
            <component :is="option.icon" :size="16" />
          </div>
          <div class="direction-info">
            <span class="direction-label">{{ option.label }}</span>
            <span class="direction-description">{{ option.description }}</span>
          </div>
          <div v-if="directionPreference === option.value" class="active-indicator">
            <Check :size="16" />
          </div>
        </button>
      </div>
    </div>

    <!-- Current Status -->
    <div class="setting-group">
      <h3 class="setting-title">
        {{ $t('settings.general', 'General Settings') }}
      </h3>
      <div class="status-info">
        <div class="status-item">
          <span class="status-label">Language:</span>
          <span class="status-value">{{ currentLanguage.nativeName }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">Text Direction:</span>
          <span class="status-value">{{ currentDirectionLabel }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">Auto-detected:</span>
          <span class="status-value">{{ isAutoDetected ? 'Yes' : 'No' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight, Check } from 'lucide-vue-next'
import { useUIStore } from '@/stores/ui'
import { useDirection } from '@/i18n/useDirection'

const { t } = useI18n({ useScope: 'global' })

interface Language {
  code: 'en' | 'he'
  name: string
  nativeName: string
}

interface DirectionOption {
  value: 'ltr' | 'rtl' | 'auto'
  label: string
  description: string
  icon: typeof ChevronLeft
}

const uiStore = useUIStore()
const { direction: _direction, isRTL: _isRTL, directionPreference } = useDirection()

// Available languages
const availableLanguages = computed(() => uiStore.availableLanguages as Language[])

// Current language
const currentLanguage = computed(() => uiStore.currentLanguage as Language)

// Direction options
const directionOptions = computed<DirectionOption[]>(() => [
  {
    value: 'auto',
    label: t('settings.auto', 'Auto'),
    description: t('settings.autoDescription', 'Automatically detect from language'),
    icon: ChevronLeft
  },
  {
    value: 'ltr',
    label: t('settings.ltr', 'LTR'),
    description: t('settings.ltrDescription', 'Left to right text direction'),
    icon: ChevronLeft
  },
  {
    value: 'rtl',
    label: t('settings.rtl', 'RTL'),
    description: t('settings.rtlDescription', 'Right to left text direction'),
    icon: ChevronRight
  }
])

// Current direction label
const currentDirectionLabel = computed(() => {
  const option = directionOptions.value.find(opt => opt.value === directionPreference.value)
  return option?.label || t('settings.auto', 'Auto')
})

// Auto-detection status
const isAutoDetected = computed(() => directionPreference.value === 'auto')

// Handle language change
const handleLanguageChange = (languageCode: 'en' | 'he') => {
  uiStore.setLanguage(languageCode)

  // If direction is auto, the change will be automatic
  // If direction is manual, we keep the user's preference
}

// Handle direction change
const handleDirectionChange = (direction: 'ltr' | 'rtl' | 'auto') => {
  uiStore.setDirectionPreference(direction)
}
</script>

<style scoped>
.language-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.setting-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

/* Language Options */
.language-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.language-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-lg);
  background: var(--glass-bg-light);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  text-align: start;
}

.language-option:hover {
  border-color: var(--border-hover);
  background: var(--surface-hover);
  transform: translateY(-1px);
}

.language-option.active {
  border-color: var(--brand-primary);
  background: rgba(78, 205, 196, 0.08);
  box-shadow: 0 0 0 1px var(--brand-primary) inset;
}

.language-native {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  direction: auto;
}

.language-english {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

/* Direction Options */
.direction-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.direction-option {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-lg);
  background: var(--glass-bg-light);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  text-align: start;
}

.direction-option:hover {
  border-color: var(--border-hover);
  background: var(--surface-hover);
  transform: translateY(-1px);
}

.direction-option.active {
  border-color: var(--brand-primary);
  background: rgba(78, 205, 196, 0.08);
  box-shadow: 0 0 0 1px var(--brand-primary) inset;
}

.direction-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background: var(--surface-primary);
  color: var(--text-secondary);
  flex-shrink: 0;
}

.direction-info {
  flex: 1;
  min-width: 0;
}

.direction-label {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  display: block;
}

.direction-description {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  display: block;
  margin-top: var(--space-1);
}

.active-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  background: var(--brand-primary);
  color: white;
  flex-shrink: 0;
}

/* Status Info */
.status-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--glass-bg-light);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-medium);
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
}

.status-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: var(--font-medium);
}

.status-value {
  font-size: var(--text-sm);
  color: var(--text-primary);
  font-weight: var(--font-medium);
}

/* RTL Support */
:dir(rtl) .language-option,
:dir(rtl) .direction-option {
  text-align: end;
}

:dir(rtl) .language-native,
:dir(rtl) .language-english {
  text-align: end;
}

:dir(rtl) .direction-info {
  text-align: end;
}

:dir(rtl) .status-item {
  flex-direction: row-reverse;
}

/* Responsive Design */
@media (max-width: 768px) {
  .language-settings {
    gap: var(--space-4);
  }

  .setting-group {
    gap: var(--space-2);
  }

  .language-option,
  .direction-option {
    padding: var(--space-3);
  }

  .status-info {
    padding: var(--space-3);
  }
}

/* High Contrast Mode */
@media (prefers-contrast: high) {
  .language-option,
  .direction-option {
    border-width: 2px;
  }

  .status-info {
    border-width: 2px;
  }
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .language-option,
  .direction-option {
    transition: none;
  }

  .language-option:hover,
  .direction-option:hover {
    transform: none;
  }
}
</style>