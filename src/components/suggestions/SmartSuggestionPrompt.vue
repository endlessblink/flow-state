<template>
  <Teleport to="body">
    <Transition name="slide-up">
      <div
        v-if="currentSuggestion"
        class="suggestion-overlay"
        role="dialog"
        aria-modal="false"
        :aria-labelledby="`suggestion-title-${currentSuggestion.id}`"
        :aria-describedby="`suggestion-desc-${currentSuggestion.id}`"
      >
        <div class="suggestion-toast">
          <!-- Header -->
          <div class="suggestion-header">
            <div class="suggestion-icon">
              <Calendar :size="20" />
            </div>
            <h3
              :id="`suggestion-title-${currentSuggestion.id}`"
              class="suggestion-title"
            >
              {{ currentSuggestion.title }}
            </h3>
            <button
              class="close-btn"
              aria-label="Dismiss suggestion"
              @click="handleDismiss"
            >
              <X :size="16" />
            </button>
          </div>

          <!-- Body -->
          <p
            :id="`suggestion-desc-${currentSuggestion.id}`"
            class="suggestion-description"
          >
            {{ currentSuggestion.description }}
          </p>

          <!-- AI Badge (for future AI suggestions) -->
          <div
            v-if="currentSuggestion.source === 'ai'"
            class="ai-badge"
          >
            <Sparkles :size="12" />
            <span>AI Suggestion</span>
            <span v-if="currentSuggestion.confidence < 1" class="confidence">
              {{ Math.round(currentSuggestion.confidence * 100) }}% confident
            </span>
          </div>

          <!-- Actions -->
          <div class="suggestion-actions">
            <BaseButton
              v-for="action in primaryActions"
              :key="action.id"
              :variant="action.primary ? 'primary' : 'secondary'"
              size="sm"
              :loading="loadingActionId === action.id"
              @click="handleAction(action.id)"
            >
              <component
                :is="getActionIcon(action.icon)"
                v-if="action.icon"
                :size="14"
              />
              {{ action.label }}
            </BaseButton>

            <!-- Settings/Disable button -->
            <button
              class="settings-btn"
              title="Don't show these suggestions again"
              @click="handleDisableFeature"
            >
              <Settings :size="14" />
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Calendar, X, Settings, Sparkles, ArrowRight, Check } from 'lucide-vue-next'
import BaseButton from '@/components/base/BaseButton.vue'
import { useSmartSuggestionsSingleton } from '@/composables/suggestions/useSmartSuggestions'

const suggestionSystem = useSmartSuggestionsSingleton()

const loadingActionId = ref<string | null>(null)

// Get current suggestion to display
const currentSuggestion = computed(() => suggestionSystem.currentSuggestion.value)

// Filter to primary actions (not the dismiss action)
const primaryActions = computed(() => {
  if (!currentSuggestion.value) return []
  return currentSuggestion.value.actions.filter(a => a.id !== 'dismiss')
})

// Map icon names to components
const getActionIcon = (iconName?: string) => {
  const icons: Record<string, unknown> = {
    ArrowRight,
    Check,
    X
  }
  return iconName ? icons[iconName] : null
}

// Handle action click
const handleAction = async (actionId: string) => {
  if (!currentSuggestion.value) return

  loadingActionId.value = actionId

  try {
    await suggestionSystem.executeAction(currentSuggestion.value.id, actionId)
  } catch (error) {
    console.error('[SmartSuggestionPrompt] Action failed:', error)
  } finally {
    loadingActionId.value = null
  }
}

// Handle dismiss click
const handleDismiss = () => {
  if (!currentSuggestion.value) return
  suggestionSystem.dismissSuggestion(currentSuggestion.value.id)
}

// Handle disable feature click
const handleDisableFeature = () => {
  suggestionSystem.disableDayGroupSuggestions()
  if (currentSuggestion.value) {
    suggestionSystem.removeSuggestion(currentSuggestion.value.id)
  }
}
</script>

<style scoped>
.suggestion-overlay {
  position: fixed;
  bottom: var(--space-6);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  pointer-events: none;
}

.suggestion-toast {
  pointer-events: auto;
  background: linear-gradient(135deg, #1c1a38 0%, #1a1f42 50%, #14122a 100%);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-xl, 16px);
  padding: var(--space-4, 16px);
  min-width: 320px;
  max-width: 420px;
  box-shadow:
    0 20px 40px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
}

/* Header */
.suggestion-header {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  margin-bottom: var(--space-3, 12px);
}

.suggestion-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, var(--color-work, #3b82f6) 0%, #2563eb 100%);
  border-radius: var(--radius-lg, 12px);
  color: white;
  flex-shrink: 0;
}

.suggestion-title {
  flex: 1;
  margin: 0;
  font-size: var(--text-base, 1rem);
  font-weight: var(--font-semibold, 600);
  color: var(--text-primary, #fff);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.close-btn:hover {
  background: var(--glass-bg-hover, rgba(255, 255, 255, 0.08));
  color: var(--text-primary, #fff);
}

/* Description */
.suggestion-description {
  margin: 0 0 var(--space-4, 16px);
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  line-height: 1.5;
}

/* AI Badge */
.ai-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1, 4px);
  padding: var(--space-1, 4px) var(--space-2, 8px);
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, var(--color-indigo-bg-heavy) 100%);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: var(--radius-full, 9999px);
  font-size: var(--text-xs, 0.75rem);
  color: #a78bfa;
  margin-bottom: var(--space-3, 12px);
}

.ai-badge .confidence {
  opacity: 0.7;
  margin-left: var(--space-1, 4px);
}

/* Actions */
.suggestion-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  flex-wrap: wrap;
}

.suggestion-actions :deep(.base-button) {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1, 4px);
}

.settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
  background: transparent;
  color: var(--text-tertiary, rgba(255, 255, 255, 0.4));
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  margin-left: auto;
}

.settings-btn:hover {
  background: var(--glass-bg-hover, rgba(255, 255, 255, 0.08));
  border-color: var(--glass-border-hover, rgba(255, 255, 255, 0.15));
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
}

/* Transitions */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all var(--duration-slow) cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}

/* Responsive */
@media (max-width: 480px) {
  .suggestion-overlay {
    left: var(--space-4, 16px);
    right: var(--space-4, 16px);
    transform: none;
    bottom: var(--space-4, 16px);
  }

  .suggestion-toast {
    min-width: unset;
    max-width: unset;
    width: 100%;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .slide-up-enter-active,
  .slide-up-leave-active {
    transition: opacity var(--duration-fast) var(--ease-out);
  }

  .slide-up-enter-from,
  .slide-up-leave-to {
    transform: translateX(-50%);
  }
}
</style>
