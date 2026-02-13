# Cyberflow Arena — 3D Wave-Based Productivity Combat Skill

**Version:** 1.0.0
**Category:** Game Development
**Related Skills:** cyberflow-rpg, cyberflow-design-system, cyberflow-state-machine, game-ui-components

## Overview

Development skill for FlowState's **Cyberflow Arena** — a 3D top-down cyberpunk arena where overdue/today's tasks become enemies you fight. Based on Ruiner's visual fidelity and game feel. Uses TresJS (Vue 3 Three.js wrapper) for 3D rendering.

**Core Concept**: Every morning, your overdue + today's-due tasks spawn as enemies in a cyberpunk arena. You fight them by completing tasks in real life. Completing a task = killing its enemy. Pomodoro sessions = focused DPS. Manual click-to-shoot for interactive engagement. This is a "fight your backlog" morning ritual.

## When to Activate

Invoke this skill when:
- Building or modifying arena 3D scene (TresJS components)
- Working on combat mechanics (click-to-shoot, projectiles, damage)
- Implementing enemy behavior (spawning, movement, death)
- Adding VFX (screen shake, damage numbers, sparks, post-processing)
- Working on the arena HUD/overlay UI
- Debugging arena game loop or rendering
- Modifying arena store state machine or event system
- Integrating arena with task/timer stores

## Automatic Skill Chaining

1. **After arena UI work** → Use `Skill(qa-testing)` to verify build passes
2. **After combat logic changes** → Test with dev server, verify in browser
3. **After VFX changes** → Test at 30+ FPS with 12 enemies active
4. **After store changes** → Run `npm run test` for existing test suite

---

## Game Design Bible

### Core Loop

```
Morning: Open FlowState → Navigate to Cyberflow → ARENA tab
  → ARIA: "Netrunner, X hostile signatures detected..."
  → Arena loads with BRIEFING overlay (threat analysis)
  → Player clicks "ENGAGE HOSTILES" → wave begins

During Day: Work normally in Board/Canvas/Calendar
  → Each task completed → corresponding enemy dies (visible from any view)
  → Each pomodoro session → focused DPS beam on targeted enemy
  → Overdue tasks → their enemies visually corrupt + gain power

Manual Combat: Click on enemies to shoot projectiles
  → Visible cyan energy bolt travels from player to target
  → Impact creates sparks + damage number popup
  → Manual shots deal 3-5x more than auto-attack (incentivizes interaction)
  → Screen shake on kills, hitstop on boss hits

Victory: Clear all enemies
  → ARIA: "Sector Cleared" → stats + XP → EXIT ARENA
```

### What Spawns as Enemies (CRITICAL)

**ONLY these tasks become enemies:**
1. **Overdue tasks** (any task past its due date) — scariest enemies
2. **Tasks due today** (due date = today) — core wave

**NOT enemies:** Future tasks, done tasks, tasks with no due date, backlog.

**Maximum 15 enemies** for performance. Priority: overdue first (sorted by days overdue DESC), then today's tasks.

### Task → Enemy Mapping

| Task Property | Enemy Property |
|---|---|
| `priority: 'low'` | **Grunt** tier — small, 50 HP, green glow |
| `priority: 'medium'` | **Standard** tier — medium, 100 HP, amber glow |
| `priority: 'high'` | **Elite** tier — large, 200 HP, red glow |
| `priority: 'critical'` or highest priority task | **Boss** tier — massive, 500 HP, pulsing crimson |
| `estimatedPomodoros` | HP multiplier (more pomodoros = more HP) |
| `projectId` | Faction color (color-coded to project) |
| Days overdue (1-7+) | Progressive corruption (size, glow, stats — see table) |

### Overdue Scaling

| Days Overdue | Enemy Effect |
|---|---|
| 0 (due today) | Normal enemy |
| 1 day | +10% size, orange corruption glow |
| 2-3 days | +30% size, +50% HP, red corruption glow |
| 4-7 days | +60% size, +100% HP, armor VFX, glitch effects |
| 7+ days | Mini-boss tier, massive, pulsing red, fast approach |

### Combat Model

**Auto-battle (passive, always running):**
- Player auto-attacks nearest enemy every 4 seconds
- Base damage: 15 HP per auto-attack
- This is background damage — slow, chip damage

**Click-to-shoot (manual, primary interaction):**
- Click on any enemy to fire a visible projectile
- Projectile: cyan energy bolt, ~200ms travel time
- Damage: 50 HP per shot (3.3x auto-attack)
- Impact VFX: sparks + screen shake (minor)
- No cooldown between clicks (skill-based)
- THIS is what makes the game feel like a game

**Focused attack (pomodoro active):**
- When a pomodoro is running for a specific task
- Continuous DPS beam on that task's enemy
- 5x auto-attack damage (75 HP/sec)
- Magenta beam instead of cyan
- Most effective way to "kill" big enemies

### Ability System

| # | Ability | Effect | Charge Cost | Cooldown |
|---|---|---|---|---|
| 1 | **EMP Blast** | AOE damage to all enemies within radius | 1 charge | 30s |
| 2 | **Firewall** | Shield — freeze corruption gain for 60s | 1 charge | 45s |
| 3 | **Overclock** | 2x damage for 30s (all sources) | 1 charge | 60s |
| 4 | **Purge** | Instant kill weakest enemy | 2 charges | 90s |

- Abilities activated by pressing **1/2/3/4** keys (NOT Q/W/E/R — conflicts with WASD)
- Charges earned from task completions (1 completion = 1 charge)
- Cooldowns are real-time, not game-time

### Defeat Condition

- **Corruption reaches 100%**: Game over overlay, stats shown, can retry
- Corruption increases when enemies reach the center (+5% per enemy)
- Enemy approach speed: **0.05–0.15 units/sec** (NOT 1.5 — that was the original bug)
- With 10 enemies at 0.1 units/sec from spawn distance 8, they reach center in ~80 seconds
- This gives the player time to interact, not instant game over

---

## Visual Style: Ruiner Reference

### Color Palette (MANDATORY)

| Name | Hex | Usage |
|---|---|---|
| **Deep Crimson** | `#aa0000` | Boss glow, danger zones |
| **Neon Magenta** | `#f60056` | Focused attack beam, critical hits |
| **Deep Purple** | `#770a7f` | Elite enemy glow, ability VFX |
| **Near-Black Purple** | `#490948` | Background, fog tint |
| **Electric Blue** | `#2a00b9` | Player accent, UI borders |
| **Cyan Accent** | `#14b8ff` | Player beam, auto-attack, UI highlights |
| **Arena Background** | `#050510` | Scene clear color |
| **Fog Color** | `#0a0520` | Scene fog |

### Camera Setup

```
Type: PerspectiveCamera
Position: { x: 0, y: 15, z: 10 }  (isometric top-down, Ruiner-style)
Look-at: Player position (smooth lerp, 0.08 factor)
FOV: 50
Near: 0.1, Far: 100
```

**CRITICAL**: Camera MUST follow the player with smooth lerp:
```typescript
// In useArenaRenderer.ts — inside onBeforeRender
const targetX = player.position.x
const targetZ = player.position.z
cameraPosition.x += (targetX - cameraPosition.x) * 0.08
cameraPosition.z += (targetZ + 10 - cameraPosition.z) * 0.08
// Y stays fixed at 15
```

### Post-Processing Pipeline

Using `@tresjs/post-processing`:

| Effect | Base Intensity | During Combat | Boss Phase |
|---|---|---|---|
| **Bloom** | intensity 1.0, threshold 0.4, radius 0.85 | 1.5 | 2.0 |
| **Chromatic Aberration** | offset [0.002, 0.002] | [0.004, 0.004] | [0.008, 0.008] |
| **Vignette** | darkness 0.5 | 0.6 | 0.8 |
| **Film Noise** | opacity 0.04 | 0.06 | 0.08 |

### Lighting Setup

```
Ambient: color=fogColor, intensity=0.3
Directional: position=[5,15,5], intensity=0.6, color=#8888ff, castShadow
Point Light 1: position=[-8,4,-8], color=#ff0066, intensity=2, distance=20  (magenta)
Point Light 2: position=[8,4,-8], color=#00ffff, intensity=2, distance=20   (cyan)
Point Light 3: position=[0,4,8], color=#8800ff, intensity=1.5, distance=20  (purple)
Fog: color=fogColor, near=10, far=40
```

---

## VFX Recipes

### Screen Shake
```typescript
function triggerScreenShake(intensity: number = 5, duration: number = 200) {
  const startTime = Date.now()
  const shake = () => {
    const elapsed = Date.now() - startTime
    if (elapsed > duration) {
      cameraOffset.x = 0; cameraOffset.z = 0; return
    }
    const decay = 1 - elapsed / duration
    cameraOffset.x = (Math.random() - 0.5) * intensity * decay * 0.1
    cameraOffset.z = (Math.random() - 0.5) * intensity * decay * 0.1
    requestAnimationFrame(shake)
  }
  shake()
}
```

**When to shake:**
- Enemy killed: intensity 5, duration 200ms
- Boss hit: intensity 3, duration 100ms
- Ability used: intensity 8, duration 300ms
- Player damaged: intensity 4, duration 150ms

### Damage Numbers
```
Spawn: At enemy position, float upward (y += 2 over 800ms)
Fade: opacity 1 → 0 over 800ms
Size: scale 1.0 → 0.5 over 800ms
Color: White for normal, #ffcc00 for crits, #ff4466 for player damage
Font: 'JetBrains Mono', monospace, bold
```

**Implementation**: HTML overlay positioned via CSS `transform` matching 3D→2D projection.

### Hit Sparks
```
On projectile impact:
  - 8-12 particle sprites
  - Spread: random cone, 30° angle
  - Speed: 2-4 units/sec
  - Lifetime: 200-400ms
  - Color: cyan (#14b8ff) for normal, magenta (#f60056) for focused
  - Size: 0.05-0.15 units, shrink to 0 over lifetime
```

### Death Explosion
```
On enemy kill:
  - Flash: enemy mesh white for 100ms
  - Burst: 20-30 particles, sphere spread
  - Screen shake: intensity 5, 200ms
  - Bloom spike: +0.5 for 300ms
  - Damage number: "ELIMINATED" in green (#00ff88)
  - Sound: bass impact + digital dissolve (future)
```

### Projectile Visual
```
Shape: Elongated cylinder (0.03 radius, 0.4 length) OR sphere (0.08 radius)
Color: #14b8ff (cyan) for normal, #f60056 (magenta) for focused
Emissive: Same color, intensity 3.0
Trail: Transparent cylinder behind, fading opacity
Speed: 20 units/sec (covers arena in <1 second)
On impact: Destroy projectile, spawn hit sparks, apply damage
```

---

## TresJS Patterns (CRITICAL)

### useLoop() for Game Loop

```typescript
import { useLoop } from '@tresjs/core'

// MUST be called inside a component that's a child of <TresCanvas>
const { onBeforeRender } = useLoop()

onBeforeRender(({ delta }) => {
  // delta is in seconds (not ms!)
  // Move enemies: enemy.position.x += enemy.speed * delta
  // Update projectiles: projectile.position.z += projectile.speed * delta
  // Camera follow: lerp toward player position
})
```

### Entity as TresJS Component

```vue
<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ enemy: EnemyEntity }>()
</script>

<template>
  <TresGroup :position="[props.enemy.position.x, 0, props.enemy.position.z]">
    <!-- Body mesh -->
    <TresMesh @click="handleShoot">
      <TresSphereGeometry :args="[size, 16, 16]" />
      <TresMeshStandardMaterial :color="glowColor" :emissive="glowColor" :emissive-intensity="0.6" />
    </TresMesh>
    <!-- Health bar (billboard sprite or HTML overlay) -->
  </TresGroup>
</template>
```

### Click-to-Shoot Pattern

```vue
<!-- On ArenaEnemy.vue -->
<TresMesh @click="onEnemyClick">
  <!-- geometry + material -->
</TresMesh>

<script setup>
function onEnemyClick(event: any) {
  event.stopPropagation?.() // Prevent canvas click-through
  arenaStore.shootEnemy(props.enemy.id)
  // Store creates projectile entity, game loop moves it, on arrival → damage
}
</script>
```

### Projectile Entity Pattern

```typescript
// In arena store
interface Projectile {
  id: string
  fromX: number; fromZ: number
  toX: number; toZ: number
  targetEnemyId: string
  speed: number  // units per second
  progress: number // 0 to 1
  color: string
}

// Game loop updates projectile.progress += (speed * delta) / distance
// When progress >= 1 → impact: damage enemy, spawn VFX, remove projectile
```

---

## Architecture: File Map

### Existing Files (to rewrite from scratch)

```
src/types/arena.ts                              # Game types, entity interfaces, config
src/stores/arena.ts                             # Pinia store: state machine, entities, combat
src/services/arena/arenaGenerator.ts            # Task→enemy mapping (overdue + today ONLY)
src/services/arena/arenaCombat.ts               # Damage calc, auto-attack, focus fire
src/services/arena/arenaAbilities.ts            # Ability definitions + effects
src/services/arena/arenaEventBus.ts             # Typed event bus (MUST have consumers)
src/services/arena/arenaStateMachine.ts         # Game phase transitions
src/composables/arena/useArenaSync.ts           # Watch task/timer stores → update game
src/composables/arena/useArenaRenderer.ts       # Camera follow, screen shake, scene config
src/composables/arena/useArenaGameLoop.ts       # WASD input, enemy movement, auto-attack, projectiles
src/components/gamification/arena/ArenaView.vue       # Main container + briefing/victory overlays
src/components/gamification/arena/ArenaScene.vue      # TresJS canvas + camera + lights
src/components/gamification/arena/ArenaEnemy.vue      # Single enemy (clickable, tier-visual)
src/components/gamification/arena/ArenaPlayer.vue     # Player character (WASD-controlled)
src/components/gamification/arena/ArenaEnvironment.vue # Floor, grid, arena boundary
src/components/gamification/arena/ArenaPostProcessing.vue # Bloom, aberration, vignette
src/components/gamification/arena/ArenaHUD.vue        # Health, corruption, wave, mini combat feed
src/components/gamification/arena/ArenaAbilityBar.vue # Ability buttons (1/2/3/4)
src/components/gamification/arena/ArenaGameEngine.vue # Invisible: drives game loop
```

### Integration Points (DO NOT MODIFY these files)

```
src/stores/tasks.ts          # READ ONLY — query overdue + today tasks
src/stores/timer.ts          # READ ONLY — detect active pomodoro, currentTaskId
src/stores/gamification.ts   # Call awardXp() on kills
src/stores/settings.ts       # arenaEnabled toggle
```

### CyberflowView Integration

```
src/views/CyberflowView.vue                   # Add 'arena' to SectionId
src/components/gamification/cyber/CyberSectionNav.vue # Add arena tab
```

---

## Known Problems from V1 (ALL must be fixed in rewrite)

### P0 — Game-Breaking

1. **Approach speed 1.5 units/sec** → enemies reach center in 5-6 seconds → instant corruption 100%
   - FIX: Speed 0.05-0.15 units/sec, scale with enemy tier
2. **No projectile entity** → clicks subtract HP invisibly → "nothing shoots"
   - FIX: Create Projectile type, spawn on click, game loop moves it, impact on arrival
3. **Camera doesn't follow player** → WASD moves character off-screen
   - FIX: Camera lerps toward player position in onBeforeRender
4. **All enemies spawn simultaneously** → wall of red, overwhelming
   - FIX: Stagger spawning (1 enemy per 2 seconds)

### P1 — Major UX

5. **Manual shoot = same damage as auto-attack** → no incentive to click
   - FIX: Manual = 50 HP, auto = 15 HP (3.3x multiplier)
6. **Ability hotkeys Q/W/E/R conflict with WASD**
   - FIX: Use 1/2/3/4 keys
7. **Hebrew RTL text breaks combat feed layout**
   - FIX: `direction: ltr; unicode-bidi: isolate` on feed entries
8. **HUD pointer-events blocks 3D clicks**
   - FIX: `pointer-events: none` on container, `pointer-events: auto` only on interactive elements

### P2 — Gameplay Feel

9. **Shield/Overclock abilities have no actual effect** → cosmetic only
   - FIX: Implement buff system in store (active buffs with duration)
10. **No defeat state** when corruption = 100% or HP = 0
    - FIX: Add 'defeat' phase to state machine
11. **Event bus is write-only** → screen shake, particles never trigger
    - FIX: Subscribe to events in composables that drive VFX
12. **JSON config file never imported** (dead code)
    - FIX: Remove JSON file, keep config in TypeScript

---

## Performance Targets

| Metric | Target |
|---|---|
| FPS with 15 enemies + post-processing | > 30 FPS |
| FPS with 5 enemies (typical) | > 55 FPS |
| Memory usage | < 200MB additional |
| Initial load time | < 2 seconds |
| Projectile render count | Max 10 simultaneous |
| Particle count | Max 200 simultaneous |

---

## Testing Strategy

### Manual Testing Checklist (MUST pass before claiming done)

- [ ] WASD moves player visibly on screen
- [ ] Camera follows player smoothly
- [ ] Clicking enemy fires visible projectile
- [ ] Projectile travels and impacts with sparks
- [ ] Damage number appears on impact
- [ ] Enemy health bar decreases on hit
- [ ] Enemy death explosion + "ELIMINATED" text
- [ ] Screen shake on kill
- [ ] Briefing overlay shows correct enemy count
- [ ] Only overdue + today tasks appear as enemies
- [ ] Corruption bar works (not instant 100%)
- [ ] Abilities 1/2/3/4 fire correctly
- [ ] Victory screen shows after all enemies killed
- [ ] Defeat screen shows at corruption 100%
- [ ] 30+ FPS with 10 enemies active

### Build Verification
```bash
npm run build    # Must pass with zero TS errors
npm run test     # Must not break existing tests
```

---

## References

- **Ruiner** (2017, Reikon Games) — Primary visual/gameplay reference
- **TresJS docs**: https://tresjs.org
- **@tresjs/post-processing**: https://postprocessing.tresjs.org
- **Three.js docs**: https://threejs.org/docs
- **Existing gamification**: `src/stores/gamification.ts`, `src/components/gamification/`
