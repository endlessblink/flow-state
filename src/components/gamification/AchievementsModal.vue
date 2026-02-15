<script setup lang="ts">
/**
 * Achievements Modal Component
 * FEATURE-1118: Full achievements list with category filtering
 */
import { computed, ref } from 'vue'
import { useGamificationStore } from '@/stores/gamification'
import AchievementBadge from './AchievementBadge.vue'
import type { AchievementCategory } from '@/types/gamification'
import { X, Trophy, Target, Flame, Compass, Lock } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const gamificationStore = useGamificationStore()

const selectedCategory = ref<AchievementCategory | 'all'>('all')

const categories: { id: AchievementCategory | 'all'; label: string; icon: any }[] = [
  { id: 'all', label: 'All', icon: Trophy },
  { id: 'productivity', label: 'Productivity', icon: Target },
  { id: 'consistency', label: 'Consistency', icon: Flame },
  { id: 'mastery', label: 'Mastery', icon: Trophy },
  { id: 'exploration', label: 'Exploration', icon: Compass },
  { id: 'secret', label: 'Secret', icon: Lock }
]

const filteredAchievements = computed(() => {
  const all = gamificationStore.achievementsWithProgress

  if (selectedCategory.value === 'all') {
    // Sort: earned first, then by tier (platinum > gold > silver > bronze)
    return [...all].sort((a, b) => {
      if (a.isEarned !== b.isEarned) return a.isEarned ? -1 : 1
      const tierOrder = { platinum: 0, gold: 1, silver: 2, bronze: 3 }
      return tierOrder[a.tier] - tierOrder[b.tier]
    })
  }

  return all
    .filter(a => a.category === selectedCategory.value)
    .sort((a, b) => {
      if (a.isEarned !== b.isEarned) return a.isEarned ? -1 : 1
      return 0
    })
})

const earnedCount = computed(() => gamificationStore.unlockedAchievementsCount)
const totalCount = computed(() => gamificationStore.achievements.length)

const categoryStats = computed(() => {
  const stats: Record<string, { earned: number; total: number }> = {
    all: { earned: earnedCount.value, total: totalCount.value }
  }

  for (const cat of categories.slice(1)) {
    const inCategory = gamificationStore.achievementsWithProgress.filter(
      a => a.category === cat.id
    )
    stats[cat.id] = {
      earned: inCategory.filter(a => a.isEarned).length,
      total: inCategory.length
    }
  }

  return stats
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="modal-overlay"
        @click.self="$emit('close')"
      >
        <div class="modal-container">
          <div class="modal-header">
            <div class="header-title">
              <Trophy
                :size="24"
                class="header-icon"
              />
              <h2>Achievements</h2>
              <span class="header-count">{{ earnedCount }}/{{ totalCount }}</span>
            </div>
            <button
              class="close-btn"
              @click="$emit('close')"
            >
              <X :size="20" />
            </button>
          </div>

          <div class="category-tabs">
            <button
              v-for="cat in categories"
              :key="cat.id"
              class="category-tab"
              :class="{ active: selectedCategory === cat.id }"
              @click="selectedCategory = cat.id"
            >
              <component
                :is="cat.icon"
                :size="16"
              />
              <span>{{ cat.label }}</span>
              <span class="tab-count">
                {{ categoryStats[cat.id].earned }}/{{ categoryStats[cat.id].total }}
              </span>
            </button>
          </div>

          <div class="achievements-list">
            <AchievementBadge
              v-for="achievement in filteredAchievements"
              :key="achievement.id"
              :achievement="achievement"
              size="md"
              show-progress
              show-description
            />

            <div
              v-if="filteredAchievements.length === 0"
              class="empty-state"
            >
              <Lock :size="32" />
              <span>No achievements in this category yet</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--overlay-bg);
  backdrop-filter: blur(var(--space-1));
  z-index: var(--z-modal);
}

.modal-container {
  display: flex;
  flex-direction: column;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  background: var(--gamification-panel-bg);
  border: 1px solid var(--gamification-panel-border);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--purple-border-medium);
}

.header-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.header-icon {
  color: rgba(var(--tier-gold), 0.9);
}

.header-title h2 {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: var(--gamification-text-primary);
  margin: 0;
}

.header-count {
  padding: var(--space-1) var(--space-2_5);
  background: rgba(var(--tier-gold), 0.15);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: rgba(var(--tier-gold), 0.9);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--gamification-text-secondary);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.close-btn:hover {
  background: var(--purple-bg-subtle);
  color: var(--gamification-text-primary);
}

.category-tabs {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  overflow-x: auto;
  border-bottom: 1px solid var(--border-medium);
}

.category-tab {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: 1px solid var(--purple-border-medium);
  border-radius: var(--radius-md);
  color: var(--gamification-text-secondary);
  font-size: var(--text-sm);
  white-space: nowrap;
  cursor: pointer;
  transition: all var(--duration-normal) ease;
}

.category-tab:hover {
  background: var(--purple-bg-subtle);
  border-color: var(--purple-border-strong);
}

.category-tab.active {
  background: rgba(var(--neon-cyan), 0.15);
  border-color: rgba(var(--neon-cyan), 0.4);
  color: rgba(var(--neon-cyan), 1);
}

.tab-count {
  font-size: var(--text-xs);
  opacity: 0.7;
}

.achievements-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  overflow-y: auto;
  flex: 1;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8);
  color: var(--gamification-text-secondary);
  text-align: center;
}

/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--duration-normal) ease;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform var(--duration-normal) ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95) translateY(var(--space-2_5));
}
</style>
