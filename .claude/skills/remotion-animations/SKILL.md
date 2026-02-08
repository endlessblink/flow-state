---
name: remotion-animations
description: "Remotion animation integration for FlowState's Cyberflow RPG. Encodes Remotion setup in Vue 3 projects, key animation sequences (level-up celebration, boss defeat, mission complete), composition patterns, asset pipeline for cyberpunk SVGs/graphics, performance optimization with lazy-loading, and CSS-only fallback patterns. Use when building cinematic game animations."
---

# Remotion Animation Integration for FlowState Cyberflow RPG

## 1. Remotion Overview & Vue Integration Strategy

Remotion is a React framework for programmatic video and animation. Since FlowState is Vue 3, a bridge strategy is required.

### Option A: Iframe Bridge (Recommended for isolation)

- Build Remotion compositions as a separate React mini-app
- Embed via iframe in Vue components
- Communicate via postMessage API
- Pros: Full isolation, no React in Vue bundle, easy to disable
- Cons: Slight overhead, iframe communication latency

### Option B: React-in-Vue Bridge

- Use `@veact/core` or manual React mounting in Vue
- Mount Remotion `<Player>` component inside a Vue wrapper
- Pros: Direct control, no iframe
- Cons: React + ReactDOM added to bundle (~45KB gzipped)

### Option C: Remotion Lambda / Pre-rendered Videos

- Pre-render animations as MP4/WebM using Remotion CLI
- Serve as video files, play with HTML5 `<video>` tag
- Pros: Zero runtime dependency, best performance
- Cons: No dynamic data in animations, larger file sizes

### Recommendation for FlowState

Start with **Option C (pre-rendered)** for static animations (boss defeat explosion, generic level-up) and **Option B (React-in-Vue bridge)** for dynamic ones (showing actual level number, XP amount, boss name). Research the latest Remotion docs before implementing to verify the best current approach.

---

## 2. Remotion Project Setup

### Installation

```bash
# Install Remotion packages (in a sub-directory or as workspace)
npm install remotion @remotion/cli @remotion/player react react-dom

# For the bridge approach
npm install @types/react @types/react-dom
```

### Project Structure

```
src/
  remotion/                    # Remotion compositions (React)
    assets/                    # SVG sprites, cyberpunk backgrounds, particles
    compositions/
      LevelUpAnimation.tsx
      BossDefeatAnimation.tsx
      MissionCompleteAnimation.tsx
      XpBurstAnimation.tsx
    index.ts                   # Export all compositions
    Root.tsx                   # Remotion root (for CLI rendering)
  components/gamification/cyber/
    RemotionBridge.vue         # Vue wrapper for Remotion Player
    CyberLevelUp.vue           # Uses RemotionBridge
    CyberBossDefeat.vue        # Uses RemotionBridge
    CyberMissionComplete.vue   # Uses RemotionBridge
  composables/
    useGameAnimations.ts       # Animation trigger composable
```

### Vite Configuration for React JSX

```typescript
// vite.config.ts - add React plugin for .tsx files in remotion/ folder
import vue from '@vitejs/plugin-vue'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    vue(),
    react({ include: /remotion\/.*\.tsx$/ }), // Only for remotion files
  ]
})
```

**Important:** Verify that `@vitejs/plugin-react` co-exists with `@vitejs/plugin-vue` in the same Vite config. If conflicts arise, use `@vitejs/plugin-react` with explicit `include` patterns to restrict it to the `src/remotion/` directory only.

### Remotion Root (for CLI rendering)

```tsx
// src/remotion/Root.tsx
import { Composition } from 'remotion'
import { LevelUpAnimation } from './compositions/LevelUpAnimation'
import { BossDefeatAnimation } from './compositions/BossDefeatAnimation'
import { MissionCompleteAnimation } from './compositions/MissionCompleteAnimation'
import { XpBurstAnimation } from './compositions/XpBurstAnimation'

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LevelUpAnimation"
        component={LevelUpAnimation}
        durationInFrames={90}
        fps={30}
        width={800}
        height={400}
        defaultProps={{
          oldLevel: 4,
          newLevel: 5,
          xpEarned: 500,
          tierColor: '#FFD700',
        }}
      />
      <Composition
        id="BossDefeatAnimation"
        component={BossDefeatAnimation}
        durationInFrames={150}
        fps={30}
        width={800}
        height={400}
        defaultProps={{
          bossName: 'ENTROPY WARDEN',
          damageDealt: 1500,
          totalHp: 1500,
          rewards: { xp: 1000, items: ['Neural Enhancer', 'Code Fragment'] },
          ariaMessage: 'Boss defeated. Rewards collected.',
        }}
      />
      <Composition
        id="MissionCompleteAnimation"
        component={MissionCompleteAnimation}
        durationInFrames={60}
        fps={30}
        width={800}
        height={400}
        defaultProps={{
          missionTitle: 'Clear 5 Tasks',
          xpReward: 200,
          corruptionDecrease: 10,
          ariaMessage: 'Mission complete. XP awarded.',
        }}
      />
      <Composition
        id="XpBurstAnimation"
        component={XpBurstAnimation}
        durationInFrames={30}
        fps={30}
        width={200}
        height={100}
        defaultProps={{
          xpAmount: 50,
        }}
      />
    </>
  )
}
```

### Index Exports

```typescript
// src/remotion/index.ts
export { LevelUpAnimation } from './compositions/LevelUpAnimation'
export { BossDefeatAnimation } from './compositions/BossDefeatAnimation'
export { MissionCompleteAnimation } from './compositions/MissionCompleteAnimation'
export { XpBurstAnimation } from './compositions/XpBurstAnimation'
```

---

## 3. RemotionBridge.vue -- The Vue-to-React Bridge

```vue
<template>
  <div
    ref="containerRef"
    class="remotion-container"
    :class="{ active: isPlaying }"
    role="img"
    :aria-label="ariaLabel"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

const props = withDefaults(defineProps<{
  compositionId: string
  inputProps?: Record<string, any>
  durationInFrames: number
  fps?: number
  width?: number
  height?: number
  ariaLabel?: string
  onComplete?: () => void
}>(), {
  fps: 30,
  width: 800,
  height: 400,
  ariaLabel: 'Animation',
  inputProps: () => ({}),
})

const emit = defineEmits<{
  complete: []
  error: [error: Error]
}>()

const containerRef = ref<HTMLElement>()
const isPlaying = ref(false)
let reactRoot: any = null

async function mountPlayer() {
  if (!containerRef.value) return

  try {
    // Dynamically import React and Remotion (code-split)
    const [React, ReactDOM, { Player }] = await Promise.all([
      import('react'),
      import('react-dom/client'),
      import('@remotion/player'),
    ])

    const compositions = await import('@/remotion')
    const Component = (compositions as Record<string, React.FC<any>>)[props.compositionId]

    if (!Component) {
      console.warn(`[RemotionBridge] Composition "${props.compositionId}" not found`)
      emit('error', new Error(`Composition "${props.compositionId}" not found`))
      return
    }

    reactRoot = ReactDOM.createRoot(containerRef.value)

    // Track completion via frame counting
    const completionTimeout = setTimeout(() => {
      isPlaying.value = false
      emit('complete')
      props.onComplete?.()
    }, (props.durationInFrames / props.fps) * 1000)

    reactRoot.render(
      React.createElement(Player, {
        component: Component,
        inputProps: props.inputProps,
        durationInFrames: props.durationInFrames,
        fps: props.fps,
        compositionWidth: props.width,
        compositionHeight: props.height,
        autoPlay: true,
        loop: false,
        controls: false,
        style: { width: '100%', height: '100%' },
        renderLoading: () => null,
      })
    )

    isPlaying.value = true

    // Store timeout for cleanup
    ;(containerRef.value as any).__completionTimeout = completionTimeout
  } catch (err) {
    console.error('[RemotionBridge] Failed to mount Remotion player:', err)
    emit('error', err instanceof Error ? err : new Error(String(err)))
  }
}

function unmountPlayer() {
  if (reactRoot) {
    reactRoot.unmount()
    reactRoot = null
  }
  if (containerRef.value) {
    const timeout = (containerRef.value as any).__completionTimeout
    if (timeout) clearTimeout(timeout)
  }
  isPlaying.value = false
}

onMounted(mountPlayer)
onBeforeUnmount(unmountPlayer)

// Re-mount if composition changes
watch(() => props.compositionId, () => {
  unmountPlayer()
  mountPlayer()
})
</script>

<style scoped>
.remotion-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.remotion-container.active {
  pointer-events: auto;
}
</style>
```

---

## 4. Key Animation Compositions

### TypeScript Interfaces

```typescript
// src/remotion/types.ts

export interface LevelUpProps {
  oldLevel: number
  newLevel: number
  xpEarned: number
  tierColor: string // bronze/silver/gold/platinum hex
}

export interface BossDefeatProps {
  bossName: string
  damageDealt: number
  totalHp: number
  rewards: { xp: number; items: string[] }
  ariaMessage: string
}

export interface MissionCompleteProps {
  missionTitle: string
  xpReward: number
  corruptionDecrease: number
  ariaMessage: string
}

export interface XpBurstProps {
  xpAmount: number
}
```

### A. Level-Up Celebration (`LevelUpAnimation.tsx`)

**Duration:** 90 frames (3 seconds at 30fps)

**Sequence:**
1. Frame 0-10: Screen dims, focus zoom
2. Frame 10-30: "LEVEL UP" text scales in with spring physics, neon glow intensifies
3. Frame 20-40: Level number morphs (old -> new) with digital counter effect
4. Frame 30-60: Particle burst radiates outward (12 particles in circle)
5. Frame 40-70: Stats summary fades in ("+500 XP", new perks)
6. Frame 60-90: Everything fades out gracefully

```tsx
// src/remotion/compositions/LevelUpAnimation.tsx
import React from 'react'
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion'
import type { LevelUpProps } from '../types'

// Particle component for burst effect
const Particle: React.FC<{
  angle: number
  delay: number
  color: string
}> = ({ angle, delay, color }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 20, stiffness: 80, mass: 0.5 },
  })

  const distance = interpolate(progress, [0, 1], [0, 300])
  const opacity = interpolate(frame - delay, [0, 15, 30], [0, 1, 0], {
    extrapolateRight: 'clamp',
  })

  const x = Math.cos((angle * Math.PI) / 180) * distance
  const y = Math.sin((angle * Math.PI) / 180) * distance

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 20px ${color}, 0 0 40px ${color}`,
        transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
        opacity,
      }}
    />
  )
}

export const LevelUpAnimation: React.FC<LevelUpProps> = ({
  oldLevel,
  newLevel,
  xpEarned,
  tierColor,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Background dim (frame 0-10)
  const bgOpacity = interpolate(frame, [0, 10, 60, 90], [0, 0.7, 0.7, 0], {
    extrapolateRight: 'clamp',
  })

  // "LEVEL UP" text spring (frame 10-30)
  const titleScale = spring({
    frame: frame - 10,
    fps,
    config: { damping: 10, stiffness: 100, mass: 0.8 },
  })

  const titleOpacity = interpolate(frame, [10, 15, 60, 90], [0, 1, 1, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  })

  // Level number morph (frame 20-40)
  const levelProgress = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const displayLevel = Math.round(
    interpolate(levelProgress, [0, 1], [oldLevel, newLevel])
  )

  // Stats fade in (frame 40-70)
  const statsOpacity = interpolate(frame, [40, 50, 60, 90], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Generate 12 particles
  const particles = Array.from({ length: 12 }, (_, i) => ({
    angle: (360 / 12) * i,
    delay: 30 + i * 2,
    color: tierColor,
  }))

  return (
    <AbsoluteFill>
      {/* Background overlay */}
      <AbsoluteFill
        style={{
          backgroundColor: `rgba(0, 0, 0, ${bgOpacity})`,
        }}
      />

      {/* Particle burst (frame 30-60) */}
      <Sequence from={30} durationInFrames={40}>
        {particles.map((p, i) => (
          <Particle key={i} angle={p.angle} delay={0} color={p.color} />
        ))}
      </Sequence>

      {/* LEVEL UP text */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 64,
            fontWeight: 'bold',
            color: tierColor,
            textShadow: `0 0 20px ${tierColor}, 0 0 40px ${tierColor}, 0 0 80px ${tierColor}`,
            transform: `scale(${titleScale})`,
            opacity: titleOpacity,
            letterSpacing: '0.2em',
          }}
        >
          LEVEL UP
        </div>

        {/* Level number */}
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 96,
            fontWeight: 'bold',
            color: '#ffffff',
            textShadow: `0 0 30px ${tierColor}`,
            opacity: titleOpacity,
            marginTop: 10,
          }}
        >
          {displayLevel}
        </div>

        {/* Stats summary */}
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 24,
            color: tierColor,
            opacity: statsOpacity,
            marginTop: 20,
            textAlign: 'center',
          }}
        >
          +{xpEarned} XP
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
```

### B. Boss Defeat (`BossDefeatAnimation.tsx`)

**Duration:** 150 frames (5 seconds at 30fps)

**Sequence:**
1. Frame 0-20: Boss name glitches intensely (clip-path flicker)
2. Frame 20-50: HP bar drains to 0 with red flash
3. Frame 50-80: "TERMINATED" text slams in with screen shake
4. Frame 80-100: Explosion particle effect (radial burst)
5. Frame 100-130: Loot reward cards flip in (staggered)
6. Frame 130-150: Victory summary + ARIA message

```tsx
// src/remotion/compositions/BossDefeatAnimation.tsx
import React from 'react'
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion'
import type { BossDefeatProps } from '../types'

// Glitch text effect
const GlitchText: React.FC<{ text: string; intensity: number }> = ({
  text,
  intensity,
}) => {
  const frame = useCurrentFrame()
  const glitchOffset = Math.sin(frame * 13.7) * intensity * 5

  return (
    <div style={{ position: 'relative' }}>
      {/* Red channel offset */}
      <div
        style={{
          position: 'absolute',
          color: 'rgba(255, 0, 0, 0.7)',
          transform: `translate(${glitchOffset}px, ${-glitchOffset * 0.5}px)`,
          clipPath:
            intensity > 0.5
              ? `inset(${Math.random() * 30}% 0 ${Math.random() * 30}% 0)`
              : 'none',
        }}
      >
        {text}
      </div>
      {/* Cyan channel offset */}
      <div
        style={{
          position: 'absolute',
          color: 'rgba(0, 255, 255, 0.7)',
          transform: `translate(${-glitchOffset}px, ${glitchOffset * 0.3}px)`,
        }}
      >
        {text}
      </div>
      {/* Main text */}
      <div style={{ position: 'relative', color: '#ffffff' }}>{text}</div>
    </div>
  )
}

// Loot card component
const LootCard: React.FC<{
  item: string
  index: number
  totalCards: number
}> = ({ item, index, totalCards }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const flipProgress = spring({
    frame: frame - index * 8,
    fps,
    config: { damping: 12, stiffness: 80 },
  })

  const rotateY = interpolate(flipProgress, [0, 1], [90, 0])
  const opacity = interpolate(flipProgress, [0, 0.3, 1], [0, 1, 1])

  const xOffset = (index - (totalCards - 1) / 2) * 140

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: `translate(${xOffset}px, -50%) perspective(600px) rotateY(${rotateY}deg)`,
        opacity,
        width: 120,
        height: 160,
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        border: '2px solid #00ffff',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        boxShadow: '0 0 20px rgba(0, 255, 255, 0.3)',
      }}
    >
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: 14,
          color: '#00ffff',
          textAlign: 'center',
        }}
      >
        {item}
      </span>
    </div>
  )
}

export const BossDefeatAnimation: React.FC<BossDefeatProps> = ({
  bossName,
  damageDealt,
  totalHp,
  rewards,
  ariaMessage,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Background pulse
  const bgOpacity = interpolate(frame, [0, 10, 130, 150], [0, 0.85, 0.85, 0], {
    extrapolateRight: 'clamp',
  })

  // Glitch intensity for boss name (frame 0-20)
  const glitchIntensity = interpolate(frame, [0, 10, 20], [0.2, 1, 0], {
    extrapolateRight: 'clamp',
  })

  // HP bar drain (frame 20-50)
  const hpPercent = interpolate(frame, [20, 50], [100, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Red flash on HP drain
  const redFlash = interpolate(frame, [45, 50, 55], [0, 0.5, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // TERMINATED text slam (frame 50-80)
  const terminatedScale = spring({
    frame: frame - 50,
    fps,
    config: { damping: 8, stiffness: 200, mass: 1.2 },
  })

  // Screen shake (frame 50-70)
  const shakeX =
    frame >= 50 && frame <= 70 ? Math.sin(frame * 23) * (70 - frame) * 0.5 : 0
  const shakeY =
    frame >= 50 && frame <= 70 ? Math.cos(frame * 17) * (70 - frame) * 0.3 : 0

  // Victory text (frame 130-150)
  const victoryOpacity = interpolate(frame, [130, 140, 145, 150], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Boss name visibility
  const bossNameOpacity = interpolate(frame, [0, 5, 18, 22], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{ transform: `translate(${shakeX}px, ${shakeY}px)` }}
    >
      {/* Dark background */}
      <AbsoluteFill
        style={{ backgroundColor: `rgba(10, 0, 0, ${bgOpacity})` }}
      />

      {/* Red flash overlay */}
      <AbsoluteFill
        style={{ backgroundColor: `rgba(255, 0, 0, ${redFlash})` }}
      />

      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Boss name with glitch (frame 0-20) */}
        <Sequence from={0} durationInFrames={25}>
          <AbsoluteFill
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: bossNameOpacity,
            }}
          >
            <div style={{ fontFamily: 'monospace', fontSize: 48, fontWeight: 'bold' }}>
              <GlitchText text={bossName} intensity={glitchIntensity} />
            </div>
          </AbsoluteFill>
        </Sequence>

        {/* HP Bar (frame 20-55) */}
        <Sequence from={20} durationInFrames={35}>
          <AbsoluteFill
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 400,
                height: 24,
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid rgba(255,0,0,0.5)',
              }}
            >
              <div
                style={{
                  width: `${hpPercent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #ff0000, #ff4444)',
                  borderRadius: 12,
                  transition: 'none',
                  boxShadow: '0 0 10px rgba(255,0,0,0.5)',
                }}
              />
            </div>
          </AbsoluteFill>
        </Sequence>

        {/* TERMINATED text (frame 50-80) */}
        <Sequence from={50} durationInFrames={80}>
          <AbsoluteFill
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 80,
                fontWeight: 'bold',
                color: '#ff0040',
                textShadow:
                  '0 0 30px #ff0040, 0 0 60px #ff0040, 0 0 100px #ff0040',
                transform: `scale(${terminatedScale})`,
                letterSpacing: '0.15em',
              }}
            >
              TERMINATED
            </div>
          </AbsoluteFill>
        </Sequence>

        {/* Loot cards (frame 100-130) */}
        <Sequence from={100} durationInFrames={40}>
          <AbsoluteFill>
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <LootCard item={`+${rewards.xp} XP`} index={0} totalCards={rewards.items.length + 1} />
              {rewards.items.map((item, i) => (
                <LootCard
                  key={item}
                  item={item}
                  index={i + 1}
                  totalCards={rewards.items.length + 1}
                />
              ))}
            </div>
          </AbsoluteFill>
        </Sequence>

        {/* Victory summary (frame 130-150) */}
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            fontFamily: 'monospace',
            fontSize: 18,
            color: '#00ffff',
            opacity: victoryOpacity,
            textAlign: 'center',
          }}
        >
          {ariaMessage}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
```

### C. Mission Complete (`MissionCompleteAnimation.tsx`)

**Duration:** 60 frames (2 seconds at 30fps)

**Sequence:**
1. Frame 0-10: Mission card flips to "COMPLETE" side
2. Frame 10-30: Progress bar fills to 100% with glow
3. Frame 20-40: "+XP" counter rolls up
4. Frame 30-50: Corruption meter decreases (if applicable)
5. Frame 40-60: ARIA approval message types in

```tsx
// src/remotion/compositions/MissionCompleteAnimation.tsx
import React from 'react'
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion'
import type { MissionCompleteProps } from '../types'

export const MissionCompleteAnimation: React.FC<MissionCompleteProps> = ({
  missionTitle,
  xpReward,
  corruptionDecrease,
  ariaMessage,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Card flip (frame 0-10)
  const flipProgress = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 120 },
  })
  const rotateY = interpolate(flipProgress, [0, 1], [180, 0])

  // Progress bar fill (frame 10-30)
  const progressFill = interpolate(frame, [10, 30], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // XP counter roll (frame 20-40)
  const xpDisplay = Math.round(
    interpolate(frame, [20, 40], [0, xpReward], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  )

  // Corruption decrease (frame 30-50)
  const corruptionOpacity = interpolate(frame, [30, 35, 45, 50], [0, 1, 1, 0.8], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // ARIA message typewriter (frame 40-60)
  const messageChars = Math.round(
    interpolate(frame, [40, 58], [0, ariaMessage.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  )

  // Overall opacity fade out at end
  const overallOpacity = interpolate(frame, [55, 60], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Background
  const bgOpacity = interpolate(frame, [0, 5, 55, 60], [0, 0.75, 0.75, 0], {
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ opacity: overallOpacity }}>
      <AbsoluteFill
        style={{ backgroundColor: `rgba(0, 10, 20, ${bgOpacity})` }}
      />

      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        {/* Mission card */}
        <div
          style={{
            width: 400,
            padding: '24px 32px',
            background: 'linear-gradient(135deg, #0a1628 0%, #1a2744 100%)',
            border: '2px solid #00ffaa',
            borderRadius: 12,
            transform: `perspective(600px) rotateY(${rotateY}deg)`,
            boxShadow: '0 0 30px rgba(0, 255, 170, 0.2)',
          }}
        >
          {/* Title */}
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 14,
              color: '#00ffaa',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              marginBottom: 8,
            }}
          >
            MISSION COMPLETE
          </div>

          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 22,
              color: '#ffffff',
              fontWeight: 'bold',
              marginBottom: 16,
            }}
          >
            {missionTitle}
          </div>

          {/* Progress bar */}
          <div
            style={{
              width: '100%',
              height: 8,
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 4,
              overflow: 'hidden',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: `${progressFill}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #00ffaa, #00ff88)',
                borderRadius: 4,
                boxShadow: progressFill >= 100 ? '0 0 15px #00ffaa' : 'none',
              }}
            />
          </div>

          {/* XP reward */}
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 28,
              color: '#FFD700',
              textShadow: '0 0 15px rgba(255, 215, 0, 0.5)',
              textAlign: 'center',
            }}
          >
            +{xpDisplay} XP
          </div>

          {/* Corruption decrease */}
          {corruptionDecrease > 0 && (
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 18,
                color: '#00ff88',
                textAlign: 'center',
                marginTop: 8,
                opacity: corruptionOpacity,
              }}
            >
              Corruption -{corruptionDecrease}%
            </div>
          )}
        </div>

        {/* ARIA message typewriter */}
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 16,
            color: '#00ccff',
            maxWidth: 400,
            textAlign: 'center',
            minHeight: 24,
          }}
        >
          {ariaMessage.slice(0, messageChars)}
          {messageChars < ariaMessage.length && (
            <span style={{ opacity: frame % 6 < 3 ? 1 : 0 }}>_</span>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
```

### D. XP Burst (micro-animation, for `moderate` intensity level)

**Duration:** 30 frames (1 second)
- Simple: "+XP" rises and fades with gold glow
- Used inline, not full-screen

```tsx
// src/remotion/compositions/XpBurstAnimation.tsx
import React from 'react'
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion'
import type { XpBurstProps } from '../types'

export const XpBurstAnimation: React.FC<XpBurstProps> = ({ xpAmount }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const scale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 150 },
  })

  const yOffset = interpolate(frame, [0, 30], [0, -40])
  const opacity = interpolate(frame, [0, 5, 20, 30], [0, 1, 1, 0], {
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          fontFamily: 'monospace',
          fontSize: 32,
          fontWeight: 'bold',
          color: '#FFD700',
          textShadow: '0 0 15px rgba(255, 215, 0, 0.8), 0 0 30px rgba(255, 215, 0, 0.4)',
          transform: `scale(${scale}) translateY(${yOffset}px)`,
          opacity,
        }}
      >
        +{xpAmount} XP
      </div>
    </AbsoluteFill>
  )
}
```

---

## 5. Triggering Animations from Vue

```typescript
// src/composables/useGameAnimations.ts
import { ref, type Ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'

interface AnimationState {
  id: string
  props: Record<string, any>
  durationInFrames: number
}

export function useGameAnimations() {
  const settings = useSettingsStore()
  const showAnimation: Ref<boolean> = ref(false)
  const currentAnimation: Ref<AnimationState | null> = ref(null)

  function getTierColor(level: number): string {
    if (level >= 50) return '#E5E4E2' // platinum
    if (level >= 30) return '#FFD700' // gold
    if (level >= 15) return '#C0C0C0' // silver
    return '#CD7F32' // bronze
  }

  function triggerLevelUp(oldLevel: number, newLevel: number, xpEarned: number) {
    // Only show Remotion animations at "intense" gamification level
    if (settings.gamificationIntensity !== 'intense') return

    currentAnimation.value = {
      id: 'LevelUpAnimation',
      props: {
        oldLevel,
        newLevel,
        xpEarned,
        tierColor: getTierColor(newLevel),
      },
      durationInFrames: 90,
    }
    showAnimation.value = true
  }

  function triggerBossDefeat(
    bossName: string,
    totalHp: number,
    rewards: { xp: number; items: string[] }
  ) {
    if (settings.gamificationIntensity !== 'intense') return

    currentAnimation.value = {
      id: 'BossDefeatAnimation',
      props: {
        bossName,
        damageDealt: totalHp,
        totalHp,
        rewards,
        ariaMessage: `${bossName} has been defeated. ${rewards.xp} XP earned.`,
      },
      durationInFrames: 150,
    }
    showAnimation.value = true
  }

  function triggerMissionComplete(
    missionTitle: string,
    xpReward: number,
    corruptionDecrease: number = 0
  ) {
    if (settings.gamificationIntensity !== 'intense') return

    currentAnimation.value = {
      id: 'MissionCompleteAnimation',
      props: {
        missionTitle,
        xpReward,
        corruptionDecrease,
        ariaMessage: `Mission "${missionTitle}" accomplished. ${xpReward} XP awarded.`,
      },
      durationInFrames: 60,
    }
    showAnimation.value = true
  }

  function triggerXpBurst(xpAmount: number) {
    // XP burst is available at moderate+ intensity
    const intensity = settings.gamificationIntensity
    if (intensity === 'minimal') return

    currentAnimation.value = {
      id: 'XpBurstAnimation',
      props: { xpAmount },
      durationInFrames: 30,
    }
    showAnimation.value = true
  }

  function onAnimationComplete() {
    showAnimation.value = false
    currentAnimation.value = null
  }

  return {
    showAnimation,
    currentAnimation,
    triggerLevelUp,
    triggerBossDefeat,
    triggerMissionComplete,
    triggerXpBurst,
    onAnimationComplete,
  }
}
```

### Usage in a Vue component

```vue
<template>
  <div>
    <!-- Regular app content -->
    <slot />

    <!-- Remotion animation overlay -->
    <Teleport to="body">
      <div
        v-if="showAnimation && currentAnimation"
        class="animation-overlay"
        @click="onAnimationComplete"
      >
        <RemotionBridge
          :composition-id="currentAnimation.id"
          :input-props="currentAnimation.props"
          :duration-in-frames="currentAnimation.durationInFrames"
          @complete="onAnimationComplete"
          @error="onAnimationError"
        />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { useGameAnimations } from '@/composables/useGameAnimations'
import RemotionBridge from '@/components/gamification/cyber/RemotionBridge.vue'

const { showAnimation, currentAnimation, onAnimationComplete } = useGameAnimations()

function onAnimationError(error: Error) {
  console.warn('[GameAnimations] Falling back to CSS animation:', error.message)
  onAnimationComplete()
  // Could trigger CSS fallback here
}
</script>

<style scoped>
.animation-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer; /* Click to dismiss */
}
</style>
```

---

## 6. CSS-Only Fallbacks

For every Remotion animation, provide a pure CSS alternative. These are used when:
- Remotion fails to load (network error, bundle issue)
- Gamification intensity is set to `moderate` (partial animations)
- React/Remotion bundle is not yet loaded (first trigger)

### Level-Up CSS Fallback

```css
/* Level-Up CSS Fallback */
.level-up-css {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  animation: level-up-flash 2s ease-out forwards;
}

.level-up-css__text {
  font-family: var(--font-cyber-title, 'Orbitron', monospace);
  font-size: 4rem;
  color: var(--cf-gold, #FFD700);
  text-shadow:
    0 0 20px var(--cf-gold, #FFD700),
    0 0 40px var(--cf-gold, #FFD700),
    0 0 80px var(--cf-gold, #FFD700);
  animation: level-up-scale 1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.level-up-css__level {
  font-family: var(--font-cyber-title, 'Orbitron', monospace);
  font-size: 5rem;
  color: #ffffff;
  text-shadow: 0 0 30px var(--cf-gold, #FFD700);
  animation: level-up-scale 1s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both;
}

.level-up-css__xp {
  font-family: monospace;
  font-size: 1.5rem;
  color: var(--cf-gold, #FFD700);
  animation: level-up-fade-in 0.5s ease-out 1s both;
}

@keyframes level-up-flash {
  0% { background: rgba(255, 215, 0, 0.3); }
  30% { background: rgba(255, 215, 0, 0.15); }
  100% { background: transparent; }
}

@keyframes level-up-scale {
  0% { transform: scale(0.5); opacity: 0; }
  60% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes level-up-fade-in {
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}
```

### Boss Defeat CSS Fallback

```css
/* Boss Defeat CSS Fallback */
.boss-defeat-css {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  animation: boss-defeat-bg 4s ease-out forwards;
}

.boss-defeat-css__name {
  font-family: var(--font-cyber-title, 'Orbitron', monospace);
  font-size: 2.5rem;
  color: #ff0040;
  animation: boss-glitch 0.8s steps(3) forwards;
}

.boss-defeat-css__terminated {
  font-family: var(--font-cyber-title, 'Orbitron', monospace);
  font-size: 4.5rem;
  font-weight: bold;
  color: #ff0040;
  text-shadow:
    0 0 30px #ff0040,
    0 0 60px #ff0040,
    0 0 100px #ff0040;
  letter-spacing: 0.15em;
  animation: boss-slam 0.6s cubic-bezier(0.22, 1, 0.36, 1) 1s both;
}

.boss-defeat-css__rewards {
  font-family: monospace;
  font-size: 1.2rem;
  color: #00ffff;
  animation: level-up-fade-in 0.5s ease-out 2s both;
}

@keyframes boss-defeat-bg {
  0% { background: rgba(10, 0, 0, 0); }
  15% { background: rgba(10, 0, 0, 0.85); }
  85% { background: rgba(10, 0, 0, 0.85); }
  100% { background: transparent; }
}

@keyframes boss-glitch {
  0% { transform: translate(0); clip-path: inset(0 0 0 0); }
  25% { transform: translate(-5px, 3px); clip-path: inset(20% 0 40% 0); }
  50% { transform: translate(5px, -3px); clip-path: inset(60% 0 10% 0); }
  75% { transform: translate(-3px, -2px); clip-path: inset(30% 0 30% 0); }
  100% { transform: translate(0); clip-path: inset(0 0 0 0); opacity: 0; }
}

@keyframes boss-slam {
  0% { transform: scale(3); opacity: 0; }
  50% { transform: scale(0.9); opacity: 1; }
  70% { transform: scale(1.05); }
  100% { transform: scale(1); opacity: 1; }
}

/* Screen shake via parent container */
.boss-defeat-css.shaking {
  animation: screen-shake 0.3s ease-in-out 1.2s 3;
}

@keyframes screen-shake {
  0%, 100% { transform: translate(0); }
  25% { transform: translate(-5px, 3px); }
  50% { transform: translate(5px, -2px); }
  75% { transform: translate(-3px, 4px); }
}
```

### Mission Complete CSS Fallback

```css
/* Mission Complete CSS Fallback */
.mission-complete-css {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  animation: mission-bg 2s ease-out forwards;
}

.mission-complete-css__card {
  width: 400px;
  max-width: 90vw;
  padding: 24px 32px;
  background: linear-gradient(135deg, #0a1628 0%, #1a2744 100%);
  border: 2px solid #00ffaa;
  border-radius: 12px;
  box-shadow: 0 0 30px rgba(0, 255, 170, 0.2);
  animation: mission-flip 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  transform-style: preserve-3d;
}

.mission-complete-css__label {
  font-family: monospace;
  font-size: 0.875rem;
  color: #00ffaa;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin-bottom: 8px;
}

.mission-complete-css__title {
  font-family: monospace;
  font-size: 1.375rem;
  color: #ffffff;
  font-weight: bold;
  margin-bottom: 16px;
}

.mission-complete-css__bar {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 16px;
}

.mission-complete-css__bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #00ffaa, #00ff88);
  border-radius: 4px;
  animation: mission-bar-fill 1s ease-out 0.4s both;
  box-shadow: 0 0 15px #00ffaa;
}

.mission-complete-css__xp {
  font-family: monospace;
  font-size: 1.75rem;
  color: #FFD700;
  text-shadow: 0 0 15px rgba(255, 215, 0, 0.5);
  text-align: center;
  animation: level-up-fade-in 0.5s ease-out 0.8s both;
}

@keyframes mission-bg {
  0% { background: rgba(0, 10, 20, 0); }
  10% { background: rgba(0, 10, 20, 0.75); }
  85% { background: rgba(0, 10, 20, 0.75); }
  100% { background: transparent; }
}

@keyframes mission-flip {
  0% { transform: perspective(600px) rotateY(180deg); opacity: 0; }
  60% { transform: perspective(600px) rotateY(-10deg); opacity: 1; }
  100% { transform: perspective(600px) rotateY(0deg); opacity: 1; }
}

@keyframes mission-bar-fill {
  0% { width: 0%; }
  100% { width: 100%; }
}
```

### CSS Fallback Vue Component

```vue
<!-- src/components/gamification/cyber/CssFallbackAnimation.vue -->
<template>
  <Teleport to="body">
    <!-- Level Up -->
    <div v-if="type === 'level-up'" class="level-up-css" @animationend="onEnd">
      <div class="level-up-css__text">LEVEL UP</div>
      <div class="level-up-css__level">{{ props.newLevel }}</div>
      <div class="level-up-css__xp">+{{ props.xpEarned }} XP</div>
    </div>

    <!-- Boss Defeat -->
    <div v-if="type === 'boss-defeat'" class="boss-defeat-css shaking" @animationend="onEnd">
      <div class="boss-defeat-css__name">{{ props.bossName }}</div>
      <div class="boss-defeat-css__terminated">TERMINATED</div>
      <div class="boss-defeat-css__rewards">+{{ props.rewards?.xp }} XP</div>
    </div>

    <!-- Mission Complete -->
    <div v-if="type === 'mission-complete'" class="mission-complete-css" @animationend="onEnd">
      <div class="mission-complete-css__card">
        <div class="mission-complete-css__label">MISSION COMPLETE</div>
        <div class="mission-complete-css__title">{{ props.missionTitle }}</div>
        <div class="mission-complete-css__bar">
          <div class="mission-complete-css__bar-fill" />
        </div>
        <div class="mission-complete-css__xp">+{{ props.xpReward }} XP</div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  type: 'level-up' | 'boss-defeat' | 'mission-complete'
  [key: string]: any
}>()

const emit = defineEmits<{ complete: [] }>()

function onEnd(e: AnimationEvent) {
  // Only fire on the outermost container animation ending
  if (e.target === e.currentTarget) {
    emit('complete')
  }
}
</script>
```

---

## 7. Asset Pipeline

### Directory Structure

```
src/remotion/assets/
  backgrounds/
    cyber-grid.svg          # Neon grid background
    data-rain.svg           # Matrix-style rain overlay
    circuit-board.svg       # Circuit pattern for cards
  particles/
    spark.svg               # Single spark particle
    hex-fragment.svg        # Hexagonal fragment for explosions
    glow-dot.svg            # Radial glow dot
  decorations/
    frame-corners.svg       # Cyberpunk frame corners
    scanlines.svg           # CRT scanline overlay
    hp-bar-frame.svg        # HP bar decorative frame
```

### Asset Optimization

All SVGs must be SVGO-optimized before committing:

```bash
# Install svgo if not present
npm install -D svgo

# Optimize all SVGs
npx svgo src/remotion/assets/**/*.svg --multipass --pretty
```

### Color Tokens

Import from existing cyberflow design tokens where possible. In TSX files where CSS variables are unavailable, use hardcoded equivalents:

```typescript
// src/remotion/colors.ts
export const CYBER_COLORS = {
  gold: '#FFD700',
  neonCyan: '#00FFFF',
  neonGreen: '#00FFAA',
  neonPink: '#FF0040',
  neonBlue: '#00CCFF',
  darkBg: '#0a1628',
  cardBg: '#1a2744',
  hpRed: '#FF4444',
  corruptionPurple: '#9B59B6',
  platinum: '#E5E4E2',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
} as const
```

### Asset Generation

Nano Banana Pro (or similar AI image tools) can generate base concepts that are then refined as SVG. Workflow:
1. Generate concept art at low resolution
2. Trace to SVG in Inkscape or similar
3. Simplify paths and optimize with SVGO
4. Use CSS variables for colors where possible

---

## 8. Performance Optimization

### Lazy-Loading Strategy

Remotion Player is ONLY imported when an animation is triggered. React, ReactDOM, and Remotion are separate chunks that never load unless needed.

```typescript
// In RemotionBridge.vue - all imports are dynamic
const [React, ReactDOM, { Player }] = await Promise.all([
  import('react'),
  import('react-dom/client'),
  import('@remotion/player'),
])
```

### Intensity Gating

- **minimal**: No animations at all. Nothing loaded.
- **moderate**: CSS-only fallback animations + XpBurst micro-animation only.
- **intense**: Full Remotion animations for level-up, boss defeat, mission complete.

```typescript
// Never load Remotion bundle unless intensity is 'intense'
function shouldUseRemotion(): boolean {
  const settings = useSettingsStore()
  return settings.gamificationIntensity === 'intense'
}
```

### Preload Hints

When the user enters the Cyberflow/Performance page at `intense` level, preload the Remotion chunk to warm the import cache:

```typescript
// src/composables/useRemotionPreloader.ts
import { watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useRoute } from 'vue-router'

export function useRemotionPreloader() {
  const settings = useSettingsStore()
  const route = useRoute()

  watch(
    [() => settings.gamificationIntensity, () => route.name],
    ([intensity, routeName]) => {
      if (intensity === 'intense' && routeName === 'performance') {
        // Warm the cache - browsers will keep this in memory
        import('@remotion/player')
        import('react')
        import('react-dom/client')
      }
    },
    { immediate: true }
  )
}
```

### Memory Management

Auto-cleanup after animation completes to prevent React tree from persisting in memory:

```typescript
// In RemotionBridge.vue onBeforeUnmount
function unmountPlayer() {
  if (reactRoot) {
    reactRoot.unmount()
    reactRoot = null
  }
  if (containerRef.value) {
    const timeout = (containerRef.value as any).__completionTimeout
    if (timeout) clearTimeout(timeout)
  }
  isPlaying.value = false
}
```

### Bundle Size Expectations

| Package | Gzipped Size | Loaded When |
|---------|-------------|-------------|
| react + react-dom | ~45KB | First Remotion animation trigger |
| @remotion/player | ~25KB | First Remotion animation trigger |
| Compositions (all) | ~5-10KB | First Remotion animation trigger |
| Total lazy chunk | ~75-80KB | Never at minimal/moderate |

---

## 9. Remotion CLI for Pre-rendering (Option C)

For static animations that don't need dynamic data, pre-render to video:

### Render Commands

```bash
# Render a composition to WebM video
npx remotion render src/remotion/index.ts BossDefeatAnimation out/boss-defeat.webm --codec=vp9

# Render with specific input props
npx remotion render src/remotion/index.ts LevelUpAnimation out/level-up.webm \
  --props='{"oldLevel":5,"newLevel":6,"xpEarned":500,"tierColor":"#FFD700"}'

# Render to MP4 (wider compatibility)
npx remotion render src/remotion/index.ts MissionCompleteAnimation out/mission-complete.mp4 \
  --codec=h264

# Render a still frame for visual testing
npx remotion still src/remotion/index.ts LevelUpAnimation out/frame-30.png --frame=30
```

### Storage and Playback

Pre-rendered videos stored in `public/animations/` and played via HTML5 video:

```html
<video
  v-if="showBossDefeat"
  autoplay
  muted
  playsinline
  class="fullscreen-animation"
  @ended="onAnimationComplete"
>
  <source src="/animations/boss-defeat.webm" type="video/webm" />
  <source src="/animations/boss-defeat.mp4" type="video/mp4" />
</video>
```

```css
.fullscreen-animation {
  position: fixed;
  inset: 0;
  z-index: 99999;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.8);
}
```

### Pre-render Script

```bash
#!/bin/bash
# scripts/render-animations.sh
set -e

OUT_DIR="public/animations"
mkdir -p "$OUT_DIR"

echo "Rendering Level Up animation..."
npx remotion render src/remotion/index.ts LevelUpAnimation "$OUT_DIR/level-up.webm" --codec=vp9

echo "Rendering Boss Defeat animation..."
npx remotion render src/remotion/index.ts BossDefeatAnimation "$OUT_DIR/boss-defeat.webm" --codec=vp9

echo "Rendering Mission Complete animation..."
npx remotion render src/remotion/index.ts MissionCompleteAnimation "$OUT_DIR/mission-complete.webm" --codec=vp9

echo "All animations rendered to $OUT_DIR"
```

---

## 10. Testing Remotion Animations

### Remotion Studio (Visual Preview)

```bash
# Preview all compositions in Remotion Studio
npx remotion studio src/remotion/index.ts
```

This opens a browser-based editor where you can:
- Scrub through frames
- Adjust input props live
- Preview at different resolutions
- Export individual frames

### Still Frame Testing

```bash
# Render key frames for visual regression testing
npx remotion still src/remotion/index.ts LevelUpAnimation out/test/level-up-frame-0.png --frame=0
npx remotion still src/remotion/index.ts LevelUpAnimation out/test/level-up-frame-20.png --frame=20
npx remotion still src/remotion/index.ts LevelUpAnimation out/test/level-up-frame-45.png --frame=45
npx remotion still src/remotion/index.ts LevelUpAnimation out/test/level-up-frame-90.png --frame=90
```

### Integration Test (Vue + Remotion Bridge)

```typescript
// src/components/gamification/cyber/__tests__/RemotionBridge.test.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import RemotionBridge from '../RemotionBridge.vue'

// Mock React and Remotion since they're dynamically imported
vi.mock('react', () => ({
  default: { createElement: vi.fn() },
}))
vi.mock('react-dom/client', () => ({
  default: { createRoot: vi.fn(() => ({ render: vi.fn(), unmount: vi.fn() })) },
}))
vi.mock('@remotion/player', () => ({
  Player: vi.fn(),
}))

describe('RemotionBridge', () => {
  it('renders container element', () => {
    const wrapper = mount(RemotionBridge, {
      props: {
        compositionId: 'LevelUpAnimation',
        durationInFrames: 90,
      },
    })
    expect(wrapper.find('.remotion-container').exists()).toBe(true)
  })

  it('emits complete after duration', async () => {
    vi.useFakeTimers()
    const wrapper = mount(RemotionBridge, {
      props: {
        compositionId: 'LevelUpAnimation',
        durationInFrames: 90,
        fps: 30,
      },
    })

    // Wait for dynamic imports + duration (90 frames / 30fps = 3 seconds)
    await vi.advanceTimersByTimeAsync(3100)

    expect(wrapper.emitted('complete')).toBeTruthy()
    vi.useRealTimers()
  })
})
```

---

## 11. Research Notes and Pre-Implementation Checklist

Before implementing Remotion in FlowState, the developer should verify:

1. **Remotion version compatibility**: Check latest Remotion docs for any Vue compatibility improvements. Remotion 5.x or later may have better non-React support or a headless player API.

2. **Vite plugin coexistence**: Verify that `@vitejs/plugin-react` (with `include` restriction to `src/remotion/`) co-exists with `@vitejs/plugin-vue` without conflicts. Test with `npm run build` before committing.

3. **Bundle size audit**: After installing React + Remotion, run `npx vite-bundle-visualizer` to verify the lazy-loaded chunks don't bloat the main bundle. All React/Remotion code should be in separate async chunks.

4. **Lottie alternative**: Consider if `@lottiefiles/lottie-player` or `lottie-web` might be lighter for simpler animations (XP burst, progress bars). Lottie has zero React dependency and ~25KB gzipped. Use Remotion only for complex multi-sequence animations.

5. **Tauri compatibility**: Test that Remotion Player renders correctly inside Tauri's WebView2/WebKit. Some canvas-based rendering may behave differently in embedded browsers.

6. **Accessibility**: All animations must respect `prefers-reduced-motion`. When the OS setting is enabled, skip all animations regardless of gamification intensity setting.

```typescript
// Respect OS-level motion preferences
function shouldAnimate(): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return false
  }
  return useSettingsStore().gamificationIntensity !== 'minimal'
}
```

7. **SSR safety**: Remotion uses browser APIs. Ensure all Remotion imports are behind dynamic `import()` calls, never at top-level, to prevent SSR/build-time errors.
