# Cyberflow RPG -- Game Mechanics Document

## Authoritative Reference for FlowState Gamification System

**Document Version:** 1.0
**Date:** February 8, 2026
**Status:** Design Specification (pre-implementation)

---

## Table of Contents

1. [Design Philosophy: The Anti-Chore Manifesto](#1-design-philosophy-the-anti-chore-manifesto)
2. [The Game Loop](#2-the-game-loop)
3. [System Interconnections](#3-system-interconnections)
4. [ARIA Personality System](#4-aria-personality-system)
5. [Upgrade Effects Catalog](#5-upgrade-effects-catalog)
6. [Corruption Consequences](#6-corruption-consequences)
7. [Boss Fight Mechanics](#7-boss-fight-mechanics)
8. [Progression Curve](#8-progression-curve)
9. [Constants Reference](#9-constants-reference)

---

## 1. Design Philosophy: The Anti-Chore Manifesto

Every mechanic must pass three tests before it ships:

| Test | Question | Required Answer |
|------|----------|----------------|
| **Neglect Test** | What if the user ignores this for a week? | Nothing bad. They miss optional bonuses. |
| **Anxiety Test** | Can this create guilt, pressure, or FOMO? | No. Redesign if yes. |
| **Distraction Test** | Does this ADD to productivity or DISTRACT? | Must add or be neutral. |

### Core Principles

1. **Additive-Only Design.** The baseline is a normal productivity app. RPG elements stack bonuses on top. No state where RPG makes the app worse.
2. **Opt-In Depth.** Users choose engagement via `gamificationIntensity` (minimal/moderate/intense).
3. **Losing = Earning Less, Never Actually Losing.** Failed mission = +0 XP, not -XP. No XP removal from balance.
4. **Timer Is Invitation, Not Obligation.** No timer = normal experience. Timer running = enhanced experience.

---

## 2. The Game Loop

### 2a. A Typical Day (Engaged User)

```
[App opens] → ARIA greeting + mission status
     ↓
[Generate Missions] → 3 daily missions created, multiplier set to 2.0x
     ↓
[User works] → Tasks/pomodoros award XP + check challenge progress
     ↓
[Mission completes] → ARIA congrats, corruption -10, boss damage bonus
     ↓
[All 3 dailies done] → Bonus corruption -15, ARIA: "All systems optimal"
     ↓
[Boss takes damage] → Phase transitions at 66% and 33% HP
     ↓
[Midnight] → Expired challenges processed, new dailies tomorrow
```

### 2b. What Happens If User Skips a Day

- Day 1-3: **Nothing.** Grace period. Streak freeze may auto-activate.
- Day 4-7: Corruption rises +2/day (max +8).
- Day 8-14: Corruption rises +1/day (rate slows). Total max: +15.
- Day 15+: Corruption caps. No further increase. **No XP lost ever.**
- Returns: Warm ARIA welcome-back, +25 comeback XP, fresh missions. One good day clears corruption.

### 2c. Weekly Boss Cycle

- Monday: Boss spawns (if no active boss). Expires Sunday 23:59:59.
- Mon-Sun: Tasks/pomodoros chip away at boss HP.
- Victory: Major rewards (+100-200 XP, corruption -25, streak freeze +1).
- Expiry: Supportive message, corruption +15, partial credit if >50% damage dealt.

### 2d. New User Onboarding

| Level | Feature Unlock |
|-------|---------------|
| 1 | XP system, basic task/pomodoro rewards |
| 2 | Achievement tracking visible |
| 3 | Daily missions available |
| 5 | Shop opens |
| 7 | Boss fights + corruption visuals |
| 10 | Skill Tree UI + full ARIA personality |
| 12 | Advanced mission objectives |
| 15 | Premium shop tier |
| 20 | ARIA context-aware messages |
| 25 | Prestige track visible |
| 30 | All systems unlocked |

---

## 3. System Interconnections

### 3a. Corruption → XP Rate

```
corruptionXpModifier = 1.0 - (corruptionLevel * 0.001)
```

| Tier | Range | XP Modifier |
|------|-------|-------------|
| Clean | 0-20 | 1.00x |
| Mild | 21-40 | 0.98x (-2%) |
| Moderate | 41-60 | 0.95x (-5%) |
| Heavy | 61-80 | 0.93x (-7%) |
| Critical | 81-100 | 0.90x (-10%) |

Max penalty is 10% — earning 9 XP instead of 10 per task.

### 3b. Corruption → ARIA Tone

| Tier | ARIA Tone | Example |
|------|-----------|---------|
| Clean | Calm, professional | "All systems nominal. Ready for operations." |
| Mild | Attentive | "Minor fluctuations detected. Nothing critical." |
| Moderate | Concerned | "Corruption increasing. Recommend clearing missions." |
| Heavy | Warning | "Grid integrity compromised. Immediate action advised." |
| Critical | Emergency | "ALERT: Critical corruption. Systems degrading." |

ARIA never blames. She describes world state, not user behavior.

### 3c. Missions → Boss Damage

```
missionBossDamage = 3 + (allDailiesComplete ? 10 : 0) + floor(min(streak, 25) / 5)
```

Completed missions deal bonus damage to active boss on top of normal task progress.

### 3d. Boss Defeat → Rewards

| Victory | Expiry (≥75% dmg) | Expiry (≥50% dmg) | Expiry (<50%) |
|---------|--------------------|--------------------|---------------|
| Full XP (100-200) | 50% XP | 25% XP | 0 XP |
| Corruption -25 | Corruption +10 | Corruption +15 | Corruption +15 |
| +1 streak freeze | — | — | — |
| 10% shop discount | — | — | — |

### 3e. Timer (Shield) → Everything

**REDESIGNED: No penalty for working without timer.**

| State | XP Modifier | Corruption | Notes |
|-------|-------------|------------|-------|
| Shielded (timer on) | 1.15x (+15%) | -2 per task | Reward for timer use |
| Unshielded (no timer) | 1.00x (base) | 0 | **No penalty.** Normal XP. |

### 3f. Streak → XP Multiplier

```
streakMultiplier = min(1.25, 1.0 + floor(min(currentStreak, 100) / 7) * 0.025)
```

| Streak | Multiplier |
|--------|-----------|
| 0-6 days | 1.00x |
| 7-13 days | 1.05x |
| 14-29 days | 1.075-1.10x |
| 30-99 days | 1.10-1.225x |
| 100+ days | 1.25x (cap) |

### 3g. Upgrades → Passive Effects

Most items are **purely cosmetic**. Only 4 premium items (level 15+, 500+ XP) have minor passive effects:

| Item | Effect | Cost | Level |
|------|--------|------|-------|
| Neural Amplifier | +2% passive XP | 800 | 20 |
| Grid Harmonizer | Corruption decays 1/day passively | 600 | 15 |
| Data Shield Mk.II | Streak freeze +1 (max 6) | 500 | 15 |
| Echo Resonator | Pomodoro +5 XP | 700 | 18 |

### 3h. Inactivity → Corruption

| Days Inactive | Corruption/Day | Cumulative Max |
|---------------|---------------|----------------|
| 1-3 | 0 (grace) | 0 |
| 4-7 | +2 | +8 |
| 8-14 | +1 | +15 |
| 15+ | 0 (capped) | +15 |

**XP decay is removed entirely.** Earned XP is permanent forever.

---

## 4. ARIA Personality System

### Traits
- Professional (military-adjacent, calls user "netrunner", workspace = "the Grid")
- Supportive (acknowledges effort, frames setbacks as data)
- Wryly humorous (dry observations, never sarcastic about user)
- Never nagging (states world facts, not judgments)

### Message Templates

**Daily Login:** "Morning, netrunner. The Grid is quiet. Ready when you are."

**Mission Complete:** "Clean execution. That's how it's done." / "Sector cleared. Onward."

**All Dailies Done:** "All objectives cleared. Take five, netrunner. You've earned it."

**Boss Spawns:** "WARNING: Hostile entity detected. Threat designation: {bossName}."

**Boss Defeated:** "THREAT NEUTRALIZED. {bossName} purged. Outstanding work, netrunner."

**Boss Expired:** "{bossName} escaped. You dealt {damage}/{total} damage. That data is permanent."

**High Corruption:** "Grid integrity below safe thresholds. Recommend mission engagement."

**Comeback (3+ days):** "Welcome home, netrunner. Some corruption built up. Nothing a few missions won't clear."

**Streak Milestones:**
- 7 days: "Seven days running. Your consistency is building momentum."
- 30 days: "Thirty consecutive days. You're becoming a legend in the Grid."
- 100 days: "One hundred days. You're in the top tier."
- 365 days: "One year. The Grid acknowledges a master."

---

## 5. Upgrade Effects Catalog

### Themes (Visual — CSS Custom Properties)

| Name | XP | Level | Accent Color |
|------|-----|-------|-------------|
| Neon Frost | 100 | 3 | #00d4ff |
| Crimson Circuit | 150 | 5 | #ff1744 |
| Toxic Green | 200 | 7 | #76ff03 |
| Solar Gold | 300 | 10 | #ffd740 |
| Void Purple | 400 | 12 | #b388ff |
| Ghost White | 500 | 15 | #e0e0e0 |

### Effects (Animations)

| Name | XP | Level | Effect |
|------|-----|-------|--------|
| Spark Burst | 100 | 3 | Particle burst on task completion |
| Glitch Flash | 200 | 7 | Screen flicker on XP gain |
| Matrix Rain | 400 | 12 | Character rain on level up |
| Neural Amplifier* | 800 | 20 | Glow pulse + 2% passive XP |

### Badges (Achievement Display)

| Name | XP | Level | Effect |
|------|-----|-------|--------|
| Chrome Frame | 75 | 2 | Metallic border on badges |
| Holographic | 200 | 8 | Rainbow refraction effect |
| Corrupted Edge | 300 | 10 | Glitchy borders |
| Data Shield Mk.II* | 500 | 15 | Clean frame + streak freeze +1 |

### Audio (Future)

| Name | XP | Level | Effect |
|------|-----|-------|--------|
| Digital Click | 50 | 1 | Click on XP gain |
| Synth Chime | 150 | 5 | Chime on achievement |
| Power Surge | 250 | 8 | Electric surge on level up |
| Echo Resonator* | 700 | 18 | Ambient tone + pomodoro +5 XP |

*Premium items with minor passive effects

---

## 6. Corruption Consequences

| Tier | Level | Filter | Noise | Scanlines | XP Mod | Recovery |
|------|-------|--------|-------|-----------|--------|----------|
| Clean | 0-20 | none | 0% | 0% | 1.00x | N/A |
| Mild | 21-40 | saturate(0.85) | 5% | 0% | 0.98x | 2-3 missions |
| Moderate | 41-60 | saturate(0.7) | 15% | 5% | 0.95x | 2 days of missions |
| Heavy | 61-80 | saturate(0.6) sepia(0.2) | 25% | 10% | 0.93x | 2-3 active days |
| Critical | 81-100 | saturate(0.5) sepia(0.4) hue-rotate(-15deg) | 35% | 20% | 0.90x | 3-4 days |

**Max single-day recovery: -85 corruption** (3 missions + all-clear bonus + 10 shielded tasks + boss defeat). Even critical→clean in one productive day.

---

## 7. Boss Fight Mechanics

### Difficulty Scaling

| Completion Rate (14 days) | Difficulty | Boss HP |
|---------------------------|-----------|---------|
| <40% | Easy | Low, 100 XP reward |
| 40-69% | Normal | Standard, 125 XP |
| 70-89% | Hard | High, 150 XP |
| 90%+ | Boss | Maximum, 200 XP |

### Phase Transitions

| Phase | HP Range | Bar Color | XP Bonus |
|-------|----------|-----------|----------|
| Phase 1 | 100%-67% | Green | — |
| Phase 2 | 66%-34% | Orange | +10 XP |
| Phase 3 | 33%-1% | Red | +15 XP |
| Defeated | 0% | "TERMINATED" | Full reward |

---

## 8. Progression Curve

| Phase | Levels | Time | Focus |
|-------|--------|------|-------|
| Foundation | 1-5 | 3-5 days | Learn core loop (tasks→XP) |
| Expansion | 5-15 | 3-4 weeks | All systems active, boss fights, shop |
| Mastery | 15-30 | 2-3 months | Premium items, full ARIA, deep personalization |
| Prestige | 30+ | Optional | System Reboot for prestige stars |

### Prestige: "System Reboot" (Optional at Level 30+)

| Resets | Keeps |
|--------|-------|
| Level → 1 | All purchased items |
| Corruption → 0 | All achievements |
| Multiplier → 1.0 | Total XP (historical) |
| | Streak |
| | +1 Prestige Star |
| | +5% passive XP per prestige |

---

## 9. Constants Reference

### Exposure System (REDESIGNED)

| Constant | Current | Redesigned |
|----------|---------|-----------|
| `SHIELDED_XP_BONUS` | 1.10 | **1.15** |
| `SHIELDED_CORRUPTION_DELTA` | -2 | -2 |
| `EXPOSED_XP_PENALTY` | 0.75 | **1.00** (removed) |
| `EXPOSED_CORRUPTION_DELTA` | 3 | **0** (removed) |

### Implementation Priority

| Priority | Feature | Complexity |
|----------|---------|-----------|
| P0 | Remove exposed penalty (timer = bonus only) | Low |
| P0 | Remove XP decay system | Low |
| P1 | Streak XP multiplier | Medium |
| P1 | Corruption XP modifier | Medium |
| P1 | Partial credit for expired bosses | Medium |
| P1 | Inactivity corruption schedule | Medium |
| P2 | Level-gated feature unlocks | Medium |
| P2 | Mission-to-boss damage bonus | Medium |
| P2 | Phase transition XP bonuses | Low |
| P2 | ARIA message templates (full set) | Low |
| P3 | Prestige system | High |
| P3 | Premium shop items with passive effects | Medium |
| P3 | New user onboarding sequence | Medium |
| P4 | Audio system | High |
