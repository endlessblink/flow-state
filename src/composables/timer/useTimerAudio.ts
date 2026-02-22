/**
 * useTimerAudio — Sound playback for timer start/end events
 * Extracted from src/stores/timer.ts (TASK-1406)
 */

export interface TimerAudioDeps {
  isEnabled: () => boolean // maps to settings.playNotificationSounds
}

export function useTimerAudio(deps: TimerAudioDeps) {
  const playStartSound = () => {
    if (!deps.isEnabled()) return
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const audioContext = new AudioContextClass()

      // BUG-1112: Create a quick rising tone to indicate timer start
      const osc = audioContext.createOscillator()
      const gain = audioContext.createGain()

      osc.connect(gain)
      gain.connect(audioContext.destination)

      osc.type = 'sine'
      // Rising pitch: C5 to E5
      osc.frequency.setValueAtTime(523.25, audioContext.currentTime)
      osc.frequency.linearRampToValueAtTime(659.25, audioContext.currentTime + 0.15)

      // BUG-1112: Increased volume from 0.1 to 0.25 for audibility
      gain.gain.setValueAtTime(0, audioContext.currentTime)
      gain.gain.linearRampToValueAtTime(0.25, audioContext.currentTime + 0.02)
      gain.gain.setValueAtTime(0.25, audioContext.currentTime + 0.1)
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)

      osc.start()
      osc.stop(audioContext.currentTime + 0.2)

      // Close audio context after sound completes
      setTimeout(() => audioContext.close(), 300)
    } catch (_e) {
      console.warn('🍅 [TIMER] Audio playback error:', _e)
    }
  }

  const playEndSound = () => {
    if (!deps.isEnabled()) return
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const audioContext = new AudioContextClass()

      // BUG-1112: Create a more noticeable completion sound
      // Play a pleasant 3-note chime that's clearly audible
      const notes = [523.25, 659.25, 783.99] // C5, E5, G5 (C major chord)
      const noteDuration = 0.25 // seconds per note
      const totalDuration = notes.length * noteDuration + 0.3 // Extra time for decay

      notes.forEach((freq, index) => {
        const osc = audioContext.createOscillator()
        const gain = audioContext.createGain()

        osc.connect(gain)
        gain.connect(audioContext.destination)

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, audioContext.currentTime)

        const startTime = audioContext.currentTime + (index * noteDuration)
        // BUG-1112: Increased volume from 0.1 to 0.3 for audibility
        gain.gain.setValueAtTime(0, startTime)
        gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02) // Quick attack
        gain.gain.setValueAtTime(0.3, startTime + noteDuration * 0.7)
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + noteDuration)

        osc.start(startTime)
        osc.stop(startTime + noteDuration)
      })

      // Close audio context after sound completes
      setTimeout(() => audioContext.close(), totalDuration * 1000)
    } catch (_e) {
      console.warn('🍅 [TIMER] Audio playback error:', _e)
    }
  }

  return { playStartSound, playEndSound }
}
