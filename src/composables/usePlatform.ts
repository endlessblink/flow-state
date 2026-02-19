/**
 * Reactive platform detection composable for Vue templates
 * FEATURE-1345: Capacitor Android App
 *
 * Usage:
 *   const { isTauri, isCapacitor, isNative } = usePlatform()
 *   <div v-if="isTauri">Desktop only</div>
 */
import { computed } from 'vue'
import {
  detectPlatform,
  isTauri as isTauriFn,
  isCapacitor as isCapacitorFn,
  isPWA as isPWAFn,
  isNative as isNativeFn,
} from '@/utils/platform'
import type { Platform } from '@/utils/platform'

export function usePlatform() {
  const platform = computed<Platform>(() => detectPlatform())

  return {
    platform,
    isTauri: computed(() => isTauriFn()),
    isCapacitor: computed(() => isCapacitorFn()),
    isPWA: computed(() => isPWAFn()),
    isBrowser: computed(() => !isNativeFn() && !isPWAFn()),
    isNative: computed(() => isNativeFn()),
    isMobileNative: computed(() => isCapacitorFn()),
    isDesktopNative: computed(() => isTauriFn()),
    /** Service workers only available in browser/PWA */
    supportsServiceWorker: computed(() => !isNativeFn()),
    /** Web Push only available in browser/PWA with PushManager */
    supportsWebPush: computed(
      () => !isNativeFn() && typeof window !== 'undefined' && 'PushManager' in window,
    ),
  }
}
