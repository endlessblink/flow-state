/**
 * Gamification Components Index
 * FEATURE-1118: Cyberflow gamification system
 * FEATURE-1132: AI Game Master Challenge System
 */

// Core gamification (FEATURE-1118)
export { default as XpBar } from './XpBar.vue'
export { default as LevelBadge } from './LevelBadge.vue'
export { default as StreakCounter } from './StreakCounter.vue'
export { default as AchievementBadge } from './AchievementBadge.vue'
export { default as AchievementToast } from './AchievementToast.vue'
export { default as GamificationPanel } from './GamificationPanel.vue'
export { default as AchievementsModal } from './AchievementsModal.vue'
export { default as ShopModal } from './ShopModal.vue'
export { default as GamificationToasts } from './GamificationToasts.vue'

// Tooltip system (TASK-1287)
export { default as GamificationTooltipWrapper } from './GamificationTooltipWrapper.vue'
export { default as ChallengePips } from './ChallengePips.vue'

// RPG HUD (header widget)
export { default as GamificationHUD } from './GamificationHUD.vue'

// Challenge system (FEATURE-1132)
export { default as ChallengeCard } from './ChallengeCard.vue'
export { default as DailyChallengesPanel } from './DailyChallengesPanel.vue'
export { default as BossFightPanel } from './BossFightPanel.vue'
export { default as ARIAMessage } from './ARIAMessage.vue'
export { default as ChallengeComplete } from './ChallengeComplete.vue'
export { default as CorruptionOverlay } from './CorruptionOverlay.vue'

// Arena game mode (TASK-1301)
export { default as ArenaView } from './arena/ArenaView.vue'
export { default as ArenaScene } from './arena/ArenaScene.vue'
export { default as ArenaHUD } from './arena/ArenaHUD.vue'
