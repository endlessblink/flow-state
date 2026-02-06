# Cyberflow RPG Research Findings

Compiled research on gamification patterns, RPG systems, AI game master techniques, and anti-gaming prevention for FEATURE-1132.

## Gamification Patterns

### Daily Challenge Systems (Industry Examples)

| Game/App | Challenge Count | Refresh Time | Rollover? | Penalties |
|----------|-----------------|--------------|-----------|-----------|
| Duolingo | 3-5 quests | Midnight local | No | Streak freeze |
| Habitica | 3 dailies | User-defined | No | HP damage |
| Pokemon Go | 3 field research | Midnight local | Yes (1 day) | None |
| Fortnite | 3 daily + 1 weekly | 00:00 UTC | No | None |

**Key Insight:** 3 dailies is the sweet spot - enough variety, not overwhelming.

### Difficulty Scaling Approaches

1. **Fixed Tiers** - User selects difficulty (Habitica)
2. **Adaptive** - System adjusts based on performance (Duolingo)
3. **Composite** - Mix of fixed + adaptive (Our approach)

**Our Approach:**
- Calculate difficulty from last 14 days completion rate
- Apply target scaling to objectives (50%-200% of average)
- Allow users to skip/replace 1 challenge per day (future feature)

### Streak Psychology

**Positive Reinforcement:**
- Visual streak counter with fire animation
- Milestone rewards (7, 30, 100 days)
- Streak freeze as safety net

**Negative Consequences (gentle):**
- Visual indicator of "at risk" streak
- Corruption increase on broken streak
- No permanent loss (can rebuild)

## RPG Character Stats (Derived Metrics)

Stats computed from user behavior, not stored separately:

| Stat | Calculation | Purpose |
|------|-------------|---------|
| Focus | Pomodoro completion rate | Session discipline |
| Speed | Task completion vs due date | Time management |
| Resilience | Current/longest streak ratio | Consistency |
| Versatility | Unique projects this week | Variety |

**Boss Fight Mechanics:**
- Boss HP = sum of challenge objective targets × difficulty multiplier
- Player damage = each objective completion
- Time limit = 7 days
- Reward: 2-3x normal XP + exclusive cosmetic unlock

## AI Game Master Techniques

### Persona Design (ARIA)

**Voice Characteristics:**
- Ship's computer aesthetic (HAL 9000 meets Cortana)
- Uses "netrunner" for player, "Grid" for workspace
- Technical jargon: "data packets" (tasks), "sectors" (projects)
- Emotionally supportive but not sycophantic

**Sample Prompts:**

```
[Daily Mission Generated]
"Netrunner, I've detected instability in Sector-{projectName}.
{overdueCount} corrupted data packets require cleanup.
Objective: Clear {target} overdue hacks within 24 cycles.
Grid integrity reward: {xp} XP. Failure accelerates decay."

[Boss Fight Initiated]
"Warning: Major data anomaly detected in the Grid.
Designation: THE PROCRASTINATOR
HP: {hp} | Time remaining: 7 cycles
Engage elimination protocol. The Grid's survival depends on you."

[Challenge Completed]
"Excellent work, netrunner. Sector integrity restored.
+{xp} XP credited. Corruption level: {corruption}% (-10%)
{optional: Achievement unlocked: {achievementName}}"
```

### JSON Generation Contract

**System Prompt Structure:**
```
You are ARIA, the Game Master AI for a cyberpunk productivity RPG.

Generate {count} daily missions based on the user's context.
ONLY use these objective_types: complete_tasks, complete_pomodoros,
clear_overdue, focus_time_minutes, complete_high_priority,
complete_project_tasks, complete_before_hour, complete_variety

Respond ONLY with valid JSON in this format:
{
  "daily_missions": [
    {
      "title": "string (max 50 chars)",
      "description": "string (max 150 chars, cyberpunk flavor)",
      "objective_type": "string (from allowed list)",
      "objective_target": number,
      "reward_xp": number (10-100),
      "penalty_xp": number (0-20),
      "difficulty": "easy|normal|hard",
      "narrative_flavor": "string (ARIA voice, max 100 chars)"
    }
  ],
  "boss_fight": null | {
    "title": "string (villain name)",
    "description": "string (boss backstory)",
    "objectives": [...],
    "total_hp": number,
    "reward_xp": number,
    "special_reward": "string (cosmetic unlock)"
  }
}
```

### Fallback Templates (When AI Unavailable)

```typescript
const DAILY_TEMPLATES = {
  complete_tasks: [
    {
      titleTemplate: "Grid Maintenance Protocol",
      descriptionTemplate: "Clear {target} data packets from the CyberGrid.",
      narrativeTemplate: "Routine maintenance keeps the Grid stable, netrunner."
    },
    {
      titleTemplate: "Hack Quota",
      descriptionTemplate: "Complete {target} hacks to maintain system efficiency.",
      narrativeTemplate: "The Grid demands productivity. Let's move."
    },
    // 18 more...
  ],
  complete_pomodoros: [
    {
      titleTemplate: "Deep Dive Session",
      descriptionTemplate: "Execute {target} focused dive cycles.",
      narrativeTemplate: "Sustained focus amplifies your neural output."
    },
    // 19 more...
  ],
  // etc for each objective type
}
```

## Anti-Gaming Prevention

### Objective Design Constraints

| Objective Type | Min Target | Max Target | Rationale |
|----------------|------------|------------|-----------|
| complete_tasks | 1 | 10 | Prevent task-splitting abuse |
| complete_pomodoros | 1 | 6 | 25min each = 2.5hr max |
| clear_overdue | 1 | 5 | Limited by actual overdue count |
| focus_time_minutes | 15 | 120 | Healthy focus limits |
| complete_high_priority | 1 | 3 | Usually fewer high-priority |
| complete_project_tasks | 1 | 5 | Per-project cap |
| complete_before_hour | 1 | 3 | Morning motivation |
| complete_variety | 2 | 4 | Cross-project engagement |

### Fraud Detection (Future ROAD item)

- Task creation → completion in <30 seconds = suspicious
- 10+ tasks completed in 5 minutes = rate limit
- Same exact task content repeated = dedupe
- Pattern: create/complete/delete = no XP

### XP Economy Balance

**Income Sources:**
| Action | Base XP | Max with Multipliers |
|--------|---------|---------------------|
| Task complete | 10 | 25 (high priority + streak) |
| Pomodoro complete | 25 | 40 (consecutive bonus) |
| Daily challenge | 25-50 | 100 (2x active multiplier) |
| Weekly boss | 100-200 | 400 (2x multiplier + bonus) |
| Achievement | 50-300 | 600 (rare achievements) |

**Expenses (XP Shop):**
| Item Type | Price Range |
|-----------|-------------|
| Theme unlock | 200-500 XP |
| Badge style | 100-300 XP |
| Animation | 150-400 XP |
| Sound pack | 100-250 XP |

**Balance Goal:** Active user earns ~200-400 XP/day, levels up every 2-5 days.

## Corruption Visual System

### Implementation Notes

**Performance-Safe Approach:**
```css
/* Single overlay element, not per-component */
.corruption-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9998; /* Below modals */

  /* CSS custom properties drive all effects */
  filter: var(--corruption-filter);
  mix-blend-mode: multiply;
}

/* Pseudo-elements for effects */
.corruption-overlay::before {
  /* Noise texture */
  content: '';
  background: url('/noise.svg');
  opacity: var(--corruption-noise-opacity);
}

.corruption-overlay::after {
  /* Scan lines */
  content: '';
  background: repeating-linear-gradient(
    transparent,
    transparent 2px,
    rgba(255, 0, 0, var(--corruption-scanline-opacity)) 2px,
    rgba(255, 0, 0, var(--corruption-scanline-opacity)) 4px
  );
}
```

**JavaScript Driver:**
```typescript
watch(() => gamificationStore.corruption, (level) => {
  const tier = getCorruptionTier(level)
  document.documentElement.style.setProperty('--corruption-filter', tier.filter)
  document.documentElement.style.setProperty('--corruption-noise-opacity', tier.noiseOpacity)
  // etc.
}, { immediate: true })
```

### Accessibility Considerations

- Respect `prefers-reduced-motion` - disable glitch animations
- Corruption effects must not impair readability
- Provide "disable visual effects" toggle in settings
- Never use rapid flashing (epilepsy risk)
