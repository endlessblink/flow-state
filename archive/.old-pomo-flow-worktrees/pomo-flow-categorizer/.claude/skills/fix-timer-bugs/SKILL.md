---
name: Fix Timer State Bugs
description: DEBUG Pomodoro timer state issues, incorrect countdown behavior, and timer synchronization problems. Fix when timer won't start, time display is wrong, or timer gets stuck. Use for timer state management, countdown logic, and session persistence.
---

# Fix Timer State Bugs

## Instructions

### Timer Debugging Protocol
When Pomodoro timer behavior is incorrect, systematically debug:

#### 1. Timer State Issues
- **Check reactive timer state** (timeRemaining, isActive, isBreak)
- **Verify countdown logic** and interval management
- **Debug timer start/pause/stop state transitions**
- **Check for multiple timer instances** or race conditions

#### 2. Time Display Problems
- **Verify time formatting** (minutes:seconds display)
- **Check for timezone issues** or time synchronization
- **Debug timer precision** and update frequency
- **Validate timer completion** detection

#### 3. Session Persistence
- **Check timer state persistence** across page refreshes
- **Debug session storage** and state hydration
- **Verify timer resumption** after browser close/reopen
- **Check for conflicting timer state** from multiple tabs

## Common Timer Issues & Solutions

### Timer Not Starting
```typescript
// ❌ BAD: Forgetting to start interval
const startTimer = () => {
  isActive.value = true
  // Missing setInterval call
}

// ✅ GOOD: Proper timer implementation
const startTimer = () => {
  if (timerInterval.value) return // Prevent multiple intervals

  isActive.value = true
  timerInterval.value = setInterval(() => {
    if (timeRemaining.value > 0) {
      timeRemaining.value--
    } else {
      stopTimer()
      handleTimerComplete()
    }
  }, 1000)
}
```

### Timer State Synchronization
```typescript
const debugTimerState = () => {
  watch([timeRemaining, isActive, isBreak], ([time, active, isBreakPhase]) => {
    console.log('⏱️ Timer state:', {
      time: formatTime(time),
      active,
      phase: isBreakPhase ? 'break' : 'work',
      timestamp: new Date().toISOString()
    })

    // Check for invalid state combinations
    if (active && time <= 0) {
      console.error('Invalid timer state: active but no time remaining')
    }

    if (!active && timerInterval.value) {
      console.warn('Timer interval not cleared when inactive')
    }
  }, { immediate: true })
}
```

### Timer Cleanup Issues
```typescript
const setupTimerCleanup = () => {
  onUnmounted(() => {
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
      console.log('✅ Timer interval cleaned up')
    }
  })

  // Cleanup on page visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pauseTimer()
      console.log('⏸️ Timer paused due to page hidden')
    }
  })
}
```

### Timer Persistence Debugging
```typescript
const debugTimerPersistence = () => {
  const saveTimerState = () => {
    const state = {
      timeRemaining: timeRemaining.value,
      isActive: isActive.value,
      isBreak: isBreak.value,
      savedAt: Date.now()
    }

    localStorage.setItem('timerState', JSON.stringify(state))
    console.log('💾 Timer state saved:', state)
  }

  const loadTimerState = () => {
    try {
      const saved = localStorage.getItem('timerState')
      if (saved) {
        const state = JSON.parse(saved)
        const elapsed = Date.now() - state.savedAt

        // Adjust time based on elapsed time
        if (state.isActive && !document.hidden) {
          timeRemaining.value = Math.max(0, state.timeRemaining - Math.floor(elapsed / 1000))
        } else {
          timeRemaining.value = state.timeRemaining
        }

        isActive.value = false // Always start paused after reload
        isBreak.value = state.isBreak

        console.log('📂 Timer state loaded:', { state, elapsed })
      }
    } catch (error) {
      console.error('❌ Failed to load timer state:', error)
    }
  }

  return { saveTimerState, loadTimerState }
}
```

This skill activates when you mention timer issues, countdown problems, Pomodoro timer bugs, or time synchronization problems.