import { ref, watch } from 'vue'
import { useFavicon as useVueFavicon } from '@vueuse/core'
import { useTimerStore } from '@/stores/timer'

/**
 * Creates a favicon data URI from an emoji character
 */
function createEmojiIcon(emoji: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64

  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  // Draw emoji
  ctx.font = '48px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, 32, 32)

  return canvas.toDataURL('image/png')
}

/**
 * Composable that manages dynamic favicon based on timer state
 * - Shows 🍅 when timer is idle or paused
 * - Shows 🔥 when actively working (not break)
 * - Shows 🧎 when on break
 */
export function useFavicon() {
  const timerStore = useTimerStore()

  const tomatoIcon = createEmojiIcon('🍅')
  const fireIcon = createEmojiIcon('🔥')
  const meditationIcon = createEmojiIcon('🧎')

  // Reactive favicon href
  const faviconHref = ref(tomatoIcon)

  // Use VueUse's useFavicon
  const favicon = useVueFavicon(faviconHref)

  // Watch timer state and update favicon
  watch(
    () => ({
      isActive: timerStore.isTimerActive,
      isBreak: timerStore.currentSession?.isBreak
    }),
    ({ isActive, isBreak }) => {
      // Show fire when actively working (not on break)
      if (isActive && !isBreak) {
        faviconHref.value = fireIcon
      }
      // Show meditation when on break
      else if (isActive && isBreak) {
        faviconHref.value = meditationIcon
      }
      // Show tomato when idle or paused
      else {
        faviconHref.value = tomatoIcon
      }
    },
    { immediate: true, deep: true }
  )

  return { favicon }
}
