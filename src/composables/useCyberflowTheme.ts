import { computed } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { useSettingsStore } from '@/stores/settings'

/**
 * Composable for managing Cyberflow RPG theme and intensity settings.
 *
 * Provides reactive access to gamification settings, CSS classes, and helpers
 * for conditionally showing features based on intensity level.
 *
 * @example
 * ```vue
 * <script setup>
 * const { cyberflowClasses, showAtIntensity } = useCyberflowTheme()
 * </script>
 *
 * <template>
 *   <div :class="cyberflowClasses">
 *     <div v-if="showAtIntensity('moderate')">Moderate+ feature</div>
 *   </div>
 * </template>
 * ```
 */
export function useCyberflowTheme() {
  const settings = useSettingsStore()

  /**
   * Whether gamification is enabled at all
   */
  const isEnabled = computed(() => settings.gamificationEnabled)

  /**
   * Current intensity level ('minimal' | 'moderate' | 'intense')
   */
  const intensity = computed(() => settings.gamificationIntensity)

  /**
   * CSS classes to apply to cyberflow-themed containers.
   * Returns ['cyberflow', 'cf-moderate'] or [] if disabled.
   */
  const cyberflowClasses = computed(() => {
    if (!settings.gamificationEnabled) return []
    return ['cyberflow', `cf-${settings.gamificationIntensity}`]
  })

  /**
   * Whether the user prefers reduced motion (OS-level setting).
   * Reactively updates if the user changes their system preference.
   */
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  /**
   * True if intensity is set to 'minimal'
   */
  const isMinimal = computed(() => intensity.value === 'minimal')

  /**
   * True if intensity is set to 'moderate'
   */
  const isModerate = computed(() => intensity.value === 'moderate')

  /**
   * True if intensity is set to 'intense'
   */
  const isIntense = computed(() => intensity.value === 'intense')

  /**
   * Whether to show a feature based on minimum intensity requirement.
   *
   * @param minLevel - Minimum intensity level required ('minimal' | 'moderate' | 'intense')
   * @returns True if gamification is enabled and current intensity meets or exceeds minLevel
   *
   * @example
   * ```typescript
   * // Only show at 'moderate' or higher
   * if (showAtIntensity('moderate')) {
   *   // Show particle effects, etc.
   * }
   * ```
   */
  function showAtIntensity(minLevel: 'minimal' | 'moderate' | 'intense'): boolean {
    if (!isEnabled.value) return false
    const levels = ['minimal', 'moderate', 'intense']
    return levels.indexOf(intensity.value) >= levels.indexOf(minLevel)
  }

  return {
    isEnabled,
    intensity,
    cyberflowClasses,
    prefersReducedMotion,
    isMinimal,
    isModerate,
    isIntense,
    showAtIntensity
  }
}
