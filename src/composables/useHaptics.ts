
/**
 * useHaptics.ts
 *
 * A composable for handling haptic feedback.
 */

export function useHaptics() {
    const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
        if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return

        const durations = { light: 10, medium: 20, heavy: 40 }
        navigator.vibrate(durations[type])
    }

    return { triggerHaptic }
}
