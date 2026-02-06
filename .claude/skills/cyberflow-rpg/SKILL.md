---
name: cyberflow-rpg
description: "Cyberflow RPG Game Master skill — AI-driven challenge system for FlowState gamification. Use for developing, debugging, or extending the RPG challenge engine, ARIA game master, corruption system, boss fights, and narrative features. Triggers on 'challenge', 'boss fight', 'corruption', 'ARIA', 'game master', 'RPG', 'cyberflow', 'daily mission', 'weekly boss'."
---

# Cyberflow RPG — Game Master Development Skill

**Version:** 1.0.0
**Category:** Feature Development
**Related Skills:** dev-debugging, dev-implement-ui-ux, chief-architect, qa-testing

## Overview

Development skill for FlowState's AI-driven RPG gamification layer (FEATURE-1132). The system transforms passive XP tracking into an interactive cyberpunk RPG where:
- User = **Netrunner** navigating the CyberGrid
- AI = **ARIA** (Autonomous Runtime Intelligence Agent), the Game Master
- Tasks = hacks, Projects = sectors, Productivity = fuel
- Neglect = visual **corruption/rust** on the UI

## When to Activate

Invoke this skill when:
- Building or modifying challenge generation (daily/weekly/boss)
- Working on the ARIA Game Master AI persona or prompts
- Implementing corruption/decay visual system
- Adding RPG character stats or boss fight mechanics
- Extending challenge objective types
- Debugging challenge progress tracking
- Modifying gamification hooks for challenge integration

## Automatic Skill Chaining

1. **After challenge UI work** → Use `Skill(qa-testing)` to verify
2. **After AI prompt changes** → Test with all 3 providers (Ollama, Groq, OpenRouter)
3. **After database changes** → Apply migration to local Supabase, verify RLS
4. **After visual corruption CSS** → Test at corruption levels 0, 25, 50, 75, 100

---

## Architecture Reference

### Existing Gamification System (FEATURE-1118, DONE)

| Component | File | Purpose |
|-----------|------|---------|
| Types | `src/types/gamification.ts` | XP, achievements, shop, streaks, levels |
| Store | `src/stores/gamification.ts` | All gamification state + logic (1267 lines) |
| Settings | `src/stores/settings.ts` | `gamificationEnabled`, intensity, notifications |
| Components | `src/components/gamification/` | 9 Vue components (XpBar, LevelBadge, etc.) |
| Migration | `supabase/migrations/20260131000000_gamification.sql` | 7 tables, 32 achievements, 11 shop items |
| Header | `src/layouts/AppHeader.vue` | XP bar, level badge, streak, panel dropdown |
| Layout | `src/layouts/MainLayout.vue` | GamificationToasts |

### AI Service Layer

| Component | File | Purpose |
|-----------|------|---------|
| Router | `src/services/ai/router.ts` | Multi-provider routing (Ollama→Groq→OpenRouter) |
| Types | `src/services/ai/types.ts` | ChatMessage, GenerateOptions, StreamChunk |
| Providers | `src/services/ai/providers/` | Ollama, GroqProxy, OpenRouterProxy |
| Chat Store | `src/stores/aiChat.ts` | Chat panel state, message queue |
| Chat Composable | `src/composables/useAIChat.ts` | High-level chat API, context building |
| Chat UI | `src/components/ai/AIChatPanel.vue` | Chat panel component |

### Challenge System (FEATURE-1132)

| Component | File | Purpose |
|-----------|------|---------|
| Types | `src/types/challenges.ts` | Challenge, ChallengeObjective, BossFight |
| Store | `src/stores/challenges.ts` | Challenge CRUD, progress tracking, expiry |
| Game Master | `src/services/ai/gamemaster.ts` | ARIA persona, prompt engineering, JSON parsing |
| Templates | `src/services/ai/challengeTemplates.ts` | Fallback templates when AI unavailable |
| Corruption | `src/components/gamification/CorruptionOverlay.vue` | CSS corruption visuals |
| Challenge Card | `src/components/gamification/ChallengeCard.vue` | Individual challenge display |
| Dailies Panel | `src/components/gamification/DailyChallengesPanel.vue` | 3 daily missions UI |
| Boss Panel | `src/components/gamification/BossFightPanel.vue` | Weekly boss HP bar + timer |
| ARIA Message | `src/components/gamification/ARIAMessage.vue` | Styled game master messages |
| Celebration | `src/components/gamification/ChallengeComplete.vue` | Victory animation + rewards |

### Database Tables

**Existing (gamification):** `user_gamification`, `xp_logs`, `achievements`, `user_achievements`, `shop_items`, `user_purchases`, `user_stats`

**New (challenges):**
- `user_challenges` — Active challenges with objectives, rewards, penalties
- `challenge_history` — Completed/failed challenge analytics
- `user_gamification` ALTER — Add `corruption_level`, `active_multiplier`, `character_class`, challenge counters

---

## ARIA Game Master Persona

### System Prompt Template

ARIA speaks as a ship's AI computer in cyberpunk style:
- Short, punchy sentences
- Technical jargon mixed with game terms
- References to "sectors" (projects), "hacks" (tasks), "the Grid" (workspace)
- Urgency for overdue items ("corrupted data packets detected")
- Encouragement on completion ("Grid integrity restored, netrunner")

### Challenge Generation Contract

**Input to AI:** JSON context object with:
```typescript
{
  stats: { tasksCompleted, overdueCount, focusTimeToday, pomodorosToday },
  streak: { current, longest, isActive },
  corruption: { level, trend },
  recentChallenges: { completed: number, failed: number, types: string[] },
  projects: { name, taskCount, overdueCount }[],
  timeContext: { hour, dayOfWeek, isWeekend },
  patterns: { averageTasksPerDay, preferredHours, topProjects },
  difficulty: 'easy' | 'normal' | 'hard' | 'boss' // pre-calculated
}
```

**Output from AI:** JSON with daily_missions[] and optional weekly_boss
- Each mission has: title, description, objective_type, objective_target, reward_xp, penalty_xp, difficulty, narrative
- Must use ONLY valid objective_types from ChallengeObjective union type
- objective_target must be achievable (scaled to user's average)

### Difficulty Scaling

| Completion Rate | Difficulty | Target Scale |
|----------------|------------|--------------|
| <40% | easy | 50% of average |
| 40-70% | normal | 100% of average |
| 70-90% | hard | 150% of average |
| 90%+ | boss | 200% of average |

### Fallback Templates

When AI is unavailable, use template-based generation with real user data:
- 20+ templates per objective type
- Templates reference actual project names and counts
- Cyberpunk flavor text is pre-written (no AI needed)
- Same difficulty scaling applies

---

## Corruption Visual System

### Levels

| Range | Name | CSS Effects |
|-------|------|-------------|
| 0-20 | Clean | Normal neon glow, full saturation |
| 21-40 | Mild | `saturate(0.85)`, occasional 2px glitch flicker |
| 41-60 | Moderate | `saturate(0.7)`, noise overlay 0.3 opacity, badges dim |
| 61-80 | Heavy | `sepia(0.2)`, rust texture overlay, stutter animations |
| 81-100 | Critical | `sepia(0.4) hue-rotate(-15deg)`, red scan lines, warning pulse |

### Corruption Delta Rules

**Increases:** +5 failed daily, +15 failed boss, +2/day inactive (after 3 days)
**Decreases:** -10 completed daily, -25 completed boss, -5 streak milestone, -15 all-3-dailies bonus

### CSS Implementation

Drive via CSS custom properties on `<html>` element, updated by corruption store watcher.

---

## Key Patterns & Gotchas

### Timezone Safety
ALL date comparisons MUST use `getLocalDateString()` from gamification store — NEVER raw Date.getTime(). This was a critical bug in FEATURE-1118.

### Race Conditions
- Challenge progress updates must be atomic (read-update-check in single operation)
- Use the `purchaseInProgress` mutex pattern from gamification store for any multi-step DB operations

### AI Provider Routing
- Use `taskType: 'planning'` for challenge generation (prefers cloud providers for better JSON output)
- Always wrap AI calls in try/catch with fallback to template generation
- Parse JSON from AI response defensively (strip markdown code fences, handle partial JSON)

### Corruption Overlay Performance
- Use CSS filters on a single overlay div, NOT per-component
- Corruption animation (glitch, scan lines) should use `will-change: transform` and requestAnimationFrame
- Debounce corruption level changes (batch multiple challenge completions)

### Challenge Expiry
- Check on app init AND set a setTimeout for midnight refresh
- Use `getLocalDateString()` for expiry comparison
- Expired challenges: update status='expired' in DB, apply penalty, update corruption, then generate new ones

---

## Implementation Checklist

### Phase 1: Database + Types
- [ ] Create migration `supabase/migrations/YYYYMMDDHHMMSS_challenges.sql`
- [ ] Create `src/types/challenges.ts` with Challenge, ChallengeObjective types
- [ ] Add corruption/multiplier fields to UserGamification type

### Phase 2: AI Game Master
- [ ] Create `src/services/ai/gamemaster.ts` with ARIA persona
- [ ] Create `src/services/ai/challengeTemplates.ts` for fallback
- [ ] Test with all 3 AI providers

### Phase 3: Challenge Store
- [ ] Create `src/stores/challenges.ts` with CRUD, progress, expiry
- [ ] Wire corruption state to gamification store
- [ ] Test progress tracking with mock events

### Phase 4: Corruption Visuals
- [ ] Create `src/assets/corruption-tokens.css`
- [ ] Create `CorruptionOverlay.vue` component
- [ ] Add to MainLayout.vue
- [ ] Test all 5 corruption tiers

### Phase 5: UI Components
- [ ] Create ChallengeCard.vue
- [ ] Create DailyChallengesPanel.vue
- [ ] Create BossFightPanel.vue
- [ ] Create ARIAMessage.vue
- [ ] Create ChallengeComplete.vue

### Phase 6: Integration
- [ ] Hook task completion → challenge progress
- [ ] Hook pomodoro completion → challenge progress
- [ ] Add daily refresh logic to app initialization
- [ ] Integrate with GamificationPanel.vue

---

## Testing Commands

```bash
# Unit tests
npm run test -- --grep "challenges"

# Type check
npm run typecheck

# Dev server with Doppler (needed for AI providers)
doppler run -- npm run dev

# Playwright visual test for corruption
npm run test:e2e -- --grep "corruption"
```

## Related Documentation

- `docs/MASTER_PLAN.md` - FEATURE-1132 tracking
- `docs/sop/SOP-032-store-auth-initialization.md` - Store initialization patterns
- `docs/claude-md-extension/design-system.md` - Design tokens for corruption CSS
