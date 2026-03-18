---
name: cyberflow-state-machine
description: "Game state machine and animation choreography for FlowState's Cyberflow RPG. Encodes level-up sequences, boss defeat sequences, mission complete sequences, corruption tier transitions, Vue composable state machine patterns, interruptibility rules, event queue management, and sound cue integration points. Use when implementing multi-step game animations or state transitions."
---

# Cyberflow State Machine & Animation Choreography

## 1. State Machine Architecture

### Core Concept

Game events (XP gain, level up, boss defeat) trigger multi-step animation sequences. These sequences must be:

- **Orchestrated** — steps happen in order with precise timing
- **Interruptible** — user can dismiss early, new events can preempt
- **Queued** — multiple events don't fight for screen space
- **Intensity-aware** — sequence complexity varies by intensity level (minimal/moderate/intense)

### Vue Composable Pattern

```typescript
// useGameSequencer.ts — Central animation sequencer

import { ref, computed, watch, shallowRef } from 'vue'
import type { Component } from 'vue'

type SequenceStep = {
  id: string
  component: Component | null  // Vue component to render
  duration: number             // ms, 0 = wait for manual dismiss
  overlay: boolean             // blocks background interaction
  priority: number             // higher = more important
  intensity: 'minimal' | 'moderate' | 'intense'  // minimum intensity to show
}

type GameSequence = {
  id: string
  steps: SequenceStep[]
  priority: number
  onComplete?: () => void
}

export function useGameSequencer() {
  const queue = ref<GameSequence[]>([])
  const currentSequence = shallowRef<GameSequence | null>(null)
  const currentStepIndex = ref(0)
  const isPlaying = ref(false)

  const currentStep = computed(() =>
    currentSequence.value?.steps[currentStepIndex.value] ?? null
  )

  function enqueue(sequence: GameSequence) {
    // Insert by priority (higher priority = earlier in queue)
    const insertIndex = queue.value.findIndex(s => s.priority < sequence.priority)
    if (insertIndex === -1) {
      queue.value.push(sequence)
    } else {
      queue.value.splice(insertIndex, 0, sequence)
    }

    // If nothing playing, start immediately
    if (!isPlaying.value) {
      playNext()
    }
  }

  function playNext() {
    if (queue.value.length === 0) {
      currentSequence.value = null
      isPlaying.value = false
      return
    }

    currentSequence.value = queue.value.shift()!
    currentStepIndex.value = 0
    isPlaying.value = true
    playCurrentStep()
  }

  function playCurrentStep() {
    const step = currentStep.value
    if (!step) {
      // Sequence complete
      currentSequence.value?.onComplete?.()
      playNext()
      return
    }

    // Auto-advance after duration (if not 0)
    if (step.duration > 0) {
      setTimeout(() => {
        advanceStep()
      }, step.duration)
    }
  }

  function advanceStep() {
    if (!currentSequence.value) return
    currentStepIndex.value++
    if (currentStepIndex.value >= currentSequence.value.steps.length) {
      currentSequence.value.onComplete?.()
      playNext()
    } else {
      playCurrentStep()
    }
  }

  function dismiss() {
    // Skip to end of current sequence
    currentSequence.value?.onComplete?.()
    playNext()
  }

  function interrupt(newSequence: GameSequence) {
    // Only interrupt if new sequence has higher priority
    if (currentSequence.value && newSequence.priority > currentSequence.value.priority) {
      // Re-queue current at front
      if (currentSequence.value) {
        queue.value.unshift(currentSequence.value)
      }
      currentSequence.value = newSequence
      currentStepIndex.value = 0
      playCurrentStep()
    } else {
      enqueue(newSequence)
    }
  }

  return {
    currentStep,
    isPlaying,
    queueLength: computed(() => queue.value.length),
    enqueue,
    dismiss,
    interrupt,
    advanceStep
  }
}
```

---

## 2. Level-Up Sequence (COMPLETE Choreography)

**Priority:** 90 (high — level-ups are rare and important)
**Trigger:** `gamificationStore.awardXp()` returns `{ leveledUp: true }`

### Sequence Steps by Intensity

**`intense` (full experience):**

| Step | Duration | Component | Description |
|------|----------|-----------|-------------|
| 1 | 300ms | `DimOverlay` | Screen dims to 70% opacity |
| 2 | 2000ms | `LevelUpFlash` | Golden flash + "LEVEL UP" text scales in with spring |
| 3 | 1500ms | `LevelCounter` | Old level -> new level number morphs (digital counter) |
| 4 | 2000ms | `ParticleBurst` | 16 particles radiate outward in circle, tier-colored |
| 5 | 1500ms | `StatsReveal` | "+XP earned" and any new perks fade in |
| 6 | 0 (dismiss) | `ARIACongrats` | ARIA message with "dismiss" button |
| 7 | 500ms | `FadeOut` | Everything fades, overlay lifts |

**Total intense duration:** ~8 seconds + user dismiss time

**`moderate` (simple notification):**

| Step | Duration | Component | Description |
|------|----------|-----------|-------------|
| 1 | 3000ms | `LevelUpToast` | Animated toast: "Level Up! Lv.X -> Lv.Y" with gold accent |

**`minimal`:** No visual sequence. Only store state updates.

### Implementation

```typescript
function createLevelUpSequence(oldLevel: number, newLevel: number, xpEarned: number): GameSequence | null {
  const intensity = settingsStore.gamificationIntensity

  if (intensity === 'minimal') return null // No sequence

  if (intensity === 'moderate') {
    return {
      id: `level-up-${newLevel}`,
      priority: 90,
      steps: [{
        id: 'toast',
        component: defineAsyncComponent(() => import('./LevelUpToast.vue')),
        duration: 3000,
        overlay: false,
        priority: 90,
        intensity: 'moderate'
      }]
    }
  }

  // intense
  return {
    id: `level-up-${newLevel}`,
    priority: 90,
    steps: [
      { id: 'dim', component: DimOverlay, duration: 300, overlay: true, priority: 90, intensity: 'intense' },
      { id: 'flash', component: LevelUpFlash, duration: 2000, overlay: true, priority: 90, intensity: 'intense' },
      { id: 'counter', component: LevelCounter, duration: 1500, overlay: true, priority: 90, intensity: 'intense' },
      { id: 'particles', component: ParticleBurst, duration: 2000, overlay: true, priority: 90, intensity: 'intense' },
      { id: 'stats', component: StatsReveal, duration: 1500, overlay: true, priority: 90, intensity: 'intense' },
      { id: 'aria', component: ARIACongrats, duration: 0, overlay: true, priority: 90, intensity: 'intense' },
      { id: 'fadeout', component: FadeOut, duration: 500, overlay: true, priority: 90, intensity: 'intense' },
    ],
    onComplete: () => {
      // Sound cue: sfx_level_up_complete
      // Analytics: track level_up_animation_completed
    }
  }
}
```

---

## 3. Boss Defeat Sequence

**Priority:** 95 (highest — boss defeats are the rarest, most dramatic event)
**Trigger:** `challengesStore.completeChallenge(boss)` where boss HP reaches 0

### Steps (intense only — moderate/minimal get a toast)

| Step | Duration | Description | Visual |
|------|----------|-------------|--------|
| 1 | 500ms | Screen shake | CSS transform + transition |
| 2 | 2000ms | Boss name glitches violently | Glitch text intensifies to max |
| 3 | 1500ms | HP bar drains to 0 | Animated HP depletion + red flash |
| 4 | 1000ms | "TERMINATED" text slams in | Scale from 3x to 1x, neon glow, screen shake |
| 5 | 2500ms | Explosion particles | Radial burst from center, 24 particles |
| 6 | 2000ms | Loot cards flip in | 1-3 reward cards flip face-up (staggered 300ms) |
| 7 | 2000ms | XP counter rolls up | "+200 XP" counter increments rapidly |
| 8 | 0 (dismiss) | Victory ARIA message | ARIA victory speech in terminal style |
| 9 | 500ms | Fade out | All clears |

**Total intense duration:** ~12 seconds + dismiss

### Screen Shake Implementation

```css
@keyframes screen-shake {
  0%, 100% { transform: translate(0, 0); }
  10% { transform: translate(-4px, 2px); }
  20% { transform: translate(3px, -3px); }
  30% { transform: translate(-2px, 4px); }
  40% { transform: translate(4px, -1px); }
  50% { transform: translate(-3px, 3px); }
  60% { transform: translate(2px, -4px); }
  70% { transform: translate(-4px, 1px); }
  80% { transform: translate(3px, 2px); }
  90% { transform: translate(-1px, -3px); }
}

.screen-shake {
  animation: screen-shake 0.5s ease-in-out;
}
```

---

## 4. Mission Complete Sequence

**Priority:** 70 (medium — happens several times per day)
**Trigger:** `challengesStore.completeChallenge(daily)`

### Steps

| Step | Duration | Description |
|------|----------|-------------|
| 1 | 800ms | Mission card flips to "COMPLETE" state (3D flip) |
| 2 | 1000ms | Progress bar fills to 100% with glow burst |
| 3 | 1200ms | XP reward floats up and counts |
| 4 | 800ms | Corruption meter decreases (animated) |
| 5 | 1500ms | ARIA approval message types in |
| 6 | 500ms | Fade out |

**Total:** ~6 seconds

### 3D Card Flip

```css
.mission-card-flip {
  perspective: 1000px;
}
.mission-card-flip__inner {
  transition: transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  transform-style: preserve-3d;
}
.mission-card-flip--flipped .mission-card-flip__inner {
  transform: rotateY(180deg);
}
```

---

## 5. Corruption Tier Transition

**Priority:** 60 (background visual change)
**Trigger:** `challengesStore.updateCorruption(delta)` crosses a tier boundary

### Tier Boundaries

| Tier | Range | CSS Class |
|------|-------|-----------|
| Clean | 0-20 | `corruption-clean` |
| Mild | 21-40 | `corruption-mild` |
| Moderate | 41-60 | `corruption-moderate` |
| Heavy | 61-80 | `corruption-heavy` |
| Critical | 81-100 | `corruption-critical` |

### Transition Sequence (intense only)

**Corruption INCREASING (crossing UP):**

| Step | Duration | Description |
|------|----------|-------------|
| 1 | 300ms | Glitch burst (brief screen tear) |
| 2 | 500ms | Old corruption filter -> new corruption filter (CSS transition) |
| 3 | 1500ms | ARIA warning message ("Grid integrity declining, netrunner...") |
| 4 | 300ms | Settle to new steady state |

**Corruption DECREASING (crossing DOWN):**

| Step | Duration | Description |
|------|----------|-------------|
| 1 | 200ms | Brief cyan flash (purification) |
| 2 | 500ms | Old corruption filter -> new corruption filter |
| 3 | 1000ms | ARIA positive message ("Grid sectors restored...") |

### Glitch Burst Implementation

```css
@keyframes glitch-burst {
  0% { clip-path: inset(0); }
  10% { clip-path: inset(20% 0 30% 0); transform: translateX(4px); }
  20% { clip-path: inset(50% 0 10% 0); transform: translateX(-4px); }
  30% { clip-path: inset(10% 0 60% 0); transform: translateX(2px); }
  40% { clip-path: inset(70% 0 5% 0); transform: translateX(-2px); }
  50% { clip-path: inset(0); transform: none; }
  100% { clip-path: inset(0); transform: none; }
}

.glitch-burst {
  animation: glitch-burst 0.3s ease-out;
}
```

---

## 6. XP Award Micro-Sequence

**Priority:** 30 (low — happens frequently, shouldn't block)
**Trigger:** Any XP gain event
**Non-blocking:** Plays without overlay, doesn't prevent interaction

### Steps (all happen simultaneously, no queue blocking)

1. Header XP bar animates fill increase (CSS transition on width)
2. Floating "+XP" pop-up rises from trigger source
3. If XP bar fills completely -> triggers Level-Up sequence (which IS queued)

### Implementation

```typescript
function handleXpGain(amount: number, source: 'task' | 'pomodoro' | 'challenge' | 'streak') {
  if (intensity === 'minimal') return

  // Non-blocking: directly animate, don't use sequencer
  animateXpBar(gamificationStore.levelInfo.progressPercent)

  if (intensity === 'intense') {
    showXpPopup(amount, source)
  }
}
```

---

## 7. Achievement Unlock Sequence

**Priority:** 80 (important but not as rare as boss/level-up)
**Trigger:** `gamificationStore.checkAchievements()` finds newly completed

### Steps (intense)

| Step | Duration | Component | Description |
|------|----------|-----------|-------------|
| 1 | 500ms | `AchievementBadge` | Achievement badge draws on (SVG stroke-dashoffset animation) |
| 2 | 1000ms | `BadgeGlow` | Badge glows with tier color (bronze/silver/gold/platinum) |
| 3 | 1500ms | `AchievementText` | Achievement name + description type in |
| 4 | 1000ms | `XpRewardCounter` | XP reward counter |
| 5 | 0 (dismiss) | `DismissButton` | "Awesome!" dismiss button |

---

## 8. Interruptibility Rules (CRITICAL)

### Priority Hierarchy

| Priority | Event | Can Interrupt |
|----------|-------|---------------|
| 95 | Boss Defeat | Everything |
| 90 | Level Up | Everything except Boss Defeat |
| 80 | Achievement Unlock | <=70 priority |
| 70 | Mission Complete | <=60 priority |
| 60 | Corruption Transition | Nothing (queued) |
| 30 | XP Award | N/A (non-blocking) |

### Rules

1. **Higher priority ALWAYS interrupts lower** — Boss defeat interrupts mission complete
2. **Same priority queues** — Two achievements queue sequentially
3. **User dismiss skips ENTIRE sequence** — Click/ESC jumps to next in queue
4. **Queue max: 5** — If queue exceeds 5, lowest priority items are silently dropped
5. **Non-blocking events never queue** — XP pop-ups are fire-and-forget
6. **Timeout safety** — If a sequence hangs for >30s, auto-dismiss

### Keyboard Shortcuts

- `Escape` — dismiss current sequence
- `Space` — advance to next step (if manually dismissible)
- `Enter` — same as Space

---

## 9. Sound Cue Integration Points

Mark where sound effects SHOULD play (for future audio implementation):

| Cue ID | Trigger | Description |
|--------|---------|-------------|
| `sfx_xp_gain` | XP awarded | Short "ding" or digital chime |
| `sfx_level_up_buildup` | Level-up step 2 (flash) | Rising tone |
| `sfx_level_up_hit` | Level-up step 3 (number change) | Impact/hit |
| `sfx_boss_shake` | Boss defeat step 1 (shake) | Heavy rumble |
| `sfx_boss_terminated` | Boss defeat step 4 (TERMINATED) | Dramatic slam |
| `sfx_boss_explosion` | Boss defeat step 5 (particles) | Explosion |
| `sfx_mission_complete` | Mission complete step 2 (bar fills) | Completion chime |
| `sfx_achievement_unlock` | Achievement step 1 (badge draws) | Unlock sound |
| `sfx_corruption_increase` | Corruption up transition | Dark static/buzz |
| `sfx_corruption_decrease` | Corruption down transition | Clean/purify tone |

### Future Audio Composable Interface

```typescript
// useSoundEffects.ts (placeholder for future)
export function useSoundEffects() {
  const settings = useSettingsStore()

  function play(cueId: string, volume = 0.5) {
    if (!settings.gamificationEnabled) return
    if (settings.gamificationIntensity !== 'intense') return
    if (!settings.soundEffectsEnabled) return // Future setting

    // Future: use Howler.js or Web Audio API
    console.debug(`[SFX] Would play: ${cueId} at volume ${volume}`)
  }

  return { play }
}
```

---

## 10. Event Bus Integration

How the game sequencer connects to store events:

```typescript
// In MainLayout.vue or a dedicated GameEventHandler.vue
const gamification = useGamificationStore()
const challenges = useChallengesStore()
const sequencer = useGameSequencer()

// Watch for level-ups
watch(() => gamification.currentLevel, (newLevel, oldLevel) => {
  if (newLevel > oldLevel) {
    const sequence = createLevelUpSequence(oldLevel, newLevel, /* xp */)
    if (sequence) sequencer.enqueue(sequence)
  }
})

// Watch for challenge completions
watch(() => challenges.activeChallenges, (newVal, oldVal) => {
  // Detect newly completed challenges
  const justCompleted = findNewlyCompleted(newVal, oldVal)
  for (const challenge of justCompleted) {
    if (challenge.type === 'boss') {
      sequencer.enqueue(createBossDefeatSequence(challenge))
    } else {
      sequencer.enqueue(createMissionCompleteSequence(challenge))
    }
  }
}, { deep: true })

// Watch for corruption tier changes
watch(() => challenges.corruptionTier, (newTier, oldTier) => {
  if (newTier !== oldTier) {
    sequencer.enqueue(createCorruptionTransition(oldTier, newTier))
  }
})

// Watch for achievements
watch(() => gamification.achievementsWithProgress, (newVal, oldVal) => {
  const justEarned = findNewlyEarned(newVal, oldVal)
  for (const achievement of justEarned) {
    sequencer.enqueue(createAchievementSequence(achievement))
  }
}, { deep: true })
```

---

## 11. Rendering in MainLayout

```vue
<!-- In MainLayout.vue -->
<template>
  <div class="main-layout">
    <AppHeader />
    <main><router-view /></main>

    <!-- Game animation layer -->
    <Teleport to="body">
      <div
        v-if="sequencer.isPlaying.value"
        class="game-overlay"
        @click="sequencer.dismiss"
        @keydown.escape="sequencer.dismiss"
      >
        <component
          :is="sequencer.currentStep.value?.component"
          v-bind="sequencer.currentStep.value?.props"
          @advance="sequencer.advanceStep"
        />
      </div>
    </Teleport>

    <!-- Non-blocking XP pop-ups (separate layer) -->
    <Teleport to="body">
      <XpPopupContainer />
    </Teleport>
  </div>
</template>
```

### Game Overlay CSS

```css
.game-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}
```

---

## 12. Testing Game Sequences

```typescript
// Mock sequence for testing
const testSequence: GameSequence = {
  id: 'test-level-up',
  priority: 90,
  steps: [
    { id: 'step1', component: null, duration: 100, overlay: false, priority: 90, intensity: 'intense' },
    { id: 'step2', component: null, duration: 100, overlay: false, priority: 90, intensity: 'intense' },
  ],
  onComplete: () => console.log('Test complete')
}

// Test checklist:
// [ ] Sequence plays steps in order
// [ ] Auto-advance respects duration
// [ ] Manual dismiss skips to end
// [ ] Higher priority interrupts lower
// [ ] Queue processes in priority order
// [ ] Queue max (5) drops lowest priority
// [ ] 30s timeout auto-dismisses
// [ ] Reduced motion skips animations but still shows static content
// [ ] Intensity filtering: minimal shows nothing, moderate shows toasts, intense shows full
```

---

## 13. Relevant Store References

### gamification.ts

Key state and methods used by sequences:

- `currentLevel` — watched for level-up detection
- `awardXp(amount, source)` — returns `{ leveledUp, newLevel, oldLevel, xpEarned }`
- `levelInfo` — `{ currentLevel, currentXp, xpForNextLevel, progressPercent }`
- `achievementsWithProgress` — watched for unlock detection
- `checkAchievements()` — evaluates all achievement criteria

### challenges.ts

Key state and methods:

- `activeChallenges` — watched for completion detection
- `completeChallenge(id)` — triggers mission/boss completion
- `corruption` — current corruption value (0-100)
- `corruptionTier` — computed from corruption value
- `updateCorruption(delta)` — triggers tier transition check

### settings.ts

Controls that gate animation behavior:

- `gamificationEnabled` — master toggle, if false NO sequences play
- `gamificationIntensity` — `'minimal' | 'moderate' | 'intense'`
  - `minimal`: no visual sequences at all
  - `moderate`: toast notifications only
  - `intense`: full choreographed sequences

---

## 14. Accessibility Considerations

- All overlay sequences must be dismissible via Escape
- ARIA live regions announce game events for screen readers
- `prefers-reduced-motion` media query should skip CSS animations but still show static content/toasts
- Focus trap within overlay when overlay is active
- Return focus to previously focused element after sequence completes

```css
@media (prefers-reduced-motion: reduce) {
  .screen-shake,
  .glitch-burst,
  .mission-card-flip__inner {
    animation: none !important;
    transition: none !important;
  }
}
```
