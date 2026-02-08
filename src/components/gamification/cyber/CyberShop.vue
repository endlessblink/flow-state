<script setup lang="ts">
/**
 * CyberShop - Visual Novel Shop Catalog
 * FEATURE-1118 Cyberflow RPG Hub: Bottom-right panel
 *
 * Icon-dominant item cards with big category icons, rarity glow borders,
 * compact layout. Visual novel aesthetic: show, don't tell.
 */
import { computed, ref } from 'vue'
import { useGamificationStore } from '@/stores/gamification'
import { useCyberflowTheme } from '@/composables/useCyberflowTheme'
import type { ShopItemWithOwnership, ShopCategory } from '@/types/gamification'
import { ChevronRight, ShoppingBag, Check, Lock, Palette, Hexagon, Sparkles, Radio } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  showAll?: boolean
}>(), {
  showAll: false
})

const emit = defineEmits<{
  openShop: []
}>()

const gamificationStore = useGamificationStore()
const { cyberflowClasses } = useCyberflowTheme()

// Purchase state tracking
const purchasingId = ref<string | null>(null)

// XP balance
const availableXp = computed(() => gamificationStore.availableXp)
const currentLevel = computed(() => gamificationStore.currentLevel)

// Get 3 featured items (available, not owned, sorted by price)
const featuredItems = computed((): ShopItemWithOwnership[] => {
  const all = gamificationStore.shopItemsWithOwnership

  // Prioritize: available + affordable + not owned, then available + not owned
  const available = all
    .filter(item => item.isAvailable)
    .sort((a, b) => {
      // Owned items last
      if (a.isOwned !== b.isOwned) return a.isOwned ? 1 : -1
      // Then by price ascending
      return a.priceXp - b.priceXp
    })

  return props.showAll ? available : available.slice(0, 3)
})

const hasItems = computed(() => gamificationStore.shopItems.length > 0)

// Rarity color mapping based on price tiers
function getItemRarity(item: ShopItemWithOwnership): 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' {
  if (item.priceXp >= 2000) return 'legendary'
  if (item.priceXp >= 1000) return 'epic'
  if (item.priceXp >= 500) return 'rare'
  if (item.priceXp >= 200) return 'uncommon'
  return 'common'
}

// Category icon components (Lucide icons)
const categoryIcons: Record<ShopCategory, any> = {
  theme: Palette,
  badge_style: Hexagon,
  animation: Sparkles,
  sound: Radio
}

function getCategoryIcon(category: ShopCategory) {
  return categoryIcons[category] || Palette
}

function canAfford(item: ShopItemWithOwnership): boolean {
  return availableXp.value >= item.priceXp
}

function meetsLevel(item: ShopItemWithOwnership): boolean {
  return currentLevel.value >= item.requiredLevel
}

async function handlePurchase(item: ShopItemWithOwnership) {
  if (item.isOwned || !canAfford(item) || !meetsLevel(item) || purchasingId.value) return

  purchasingId.value = item.id
  try {
    await gamificationStore.purchaseItem(item.id)
  } finally {
    purchasingId.value = null
  }
}
</script>

<template>
  <div
    class="cyber-shop"
    :class="cyberflowClasses"
    data-augmented-ui="tl-clip br-clip border"
  >
    <!-- Panel Header with XP Balance -->
    <div class="cs-header">
      <ShoppingBag :size="16" class="cs-header-icon" />
      <span class="cs-header-text">SHOP</span>
      <div class="cs-credits">
        <span class="cs-credits-value">{{ availableXp.toLocaleString() }}</span>
        <span class="cs-credits-label">XP</span>
      </div>
    </div>

    <!-- Featured Items -->
    <div
      v-if="hasItems && featuredItems.length > 0"
      class="cs-items"
    >
      <div
        v-for="item in featuredItems"
        :key="item.id"
        class="cs-item"
        :class="[
          `cs-item--${getItemRarity(item)}`,
          {
            'cs-item--owned': item.isOwned,
            'cs-item--locked': !meetsLevel(item)
          }
        ]"
      >
        <!-- Large Category Icon -->
        <div class="cs-icon-wrap">
          <component
            :is="getCategoryIcon(item.category)"
            :size="40"
            class="cs-icon"
          />

          <!-- Owned Badge Overlay -->
          <div v-if="item.isOwned" class="cs-owned-badge">
            <Check :size="14" />
          </div>
        </div>

        <!-- Item Info -->
        <div class="cs-info">
          <span class="cs-name">{{ item.name }}</span>
          <span class="cs-desc">{{ item.description }}</span>
        </div>

        <!-- Price / Status -->
        <div class="cs-footer">
          <template v-if="item.isOwned">
            <div class="cs-status cs-status--owned">
              <Check :size="12" />
            </div>
          </template>
          <template v-else-if="!meetsLevel(item)">
            <div class="cs-status cs-status--locked">
              <Lock :size="12" />
              <span>LVL {{ item.requiredLevel }}</span>
            </div>
          </template>
          <template v-else>
            <div class="cs-price" :class="{ 'cs-price--cant-afford': !canAfford(item) }">
              <span class="cs-price-value">{{ item.priceXp.toLocaleString() }}</span>
              <span class="cs-price-label">XP</span>
            </div>
            <button
              class="cs-buy"
              :disabled="!canAfford(item) || purchasingId === item.id"
              @click="handlePurchase(item)"
            >
              {{ purchasingId === item.id ? '...' : 'BUY' }}
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="cs-empty">
      <ShoppingBag :size="32" class="cs-empty-icon" />
      <span class="cs-empty-text">SHOP OFFLINE</span>
    </div>

    <!-- Browse Shop Button -->
    <button
      v-if="!showAll && hasItems"
      class="cs-browse"
      @click="emit('openShop')"
    >
      <span>BROWSE SHOP</span>
      <ChevronRight :size="14" />
    </button>
  </div>
</template>

<style scoped>
.cyber-shop {
  --aug-border-all: 1px;
  --aug-border-bg: var(--cf-magenta-50, rgba(255, 0, 153, 0.5));
  --aug-tl1: 16px;
  --aug-br1: 16px;
  background: var(--cf-dark-2);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  height: 100%;
}

/* Header */
.cs-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.cs-header-icon {
  color: var(--cf-magenta);
  filter: drop-shadow(0 0 6px var(--cf-magenta));
}

.cs-header-text {
  font-family: var(--font-cyber-title);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--cf-cyan);
  letter-spacing: 0.1em;
  flex: 1;
}

.cs-credits {
  display: flex;
  align-items: baseline;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(57, 255, 20, 0.05);
  border-radius: var(--radius-sm);
  border: 1px solid rgba(57, 255, 20, 0.2);
}

.cs-credits-value {
  font-family: var(--font-cyber-data);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--cf-lime);
  text-shadow: 0 0 8px var(--cf-lime);
}

.cs-credits-label {
  font-family: var(--font-cyber-data);
  font-size: var(--text-xs);
  color: rgba(57, 255, 20, 0.5);
}

/* Items Container */
.cs-items {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
  overflow-y: auto;
}

/* Individual Item Card (~60px tall) */
.cs-item {
  background: var(--cf-dark-3);
  padding: var(--space-2);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  border-radius: var(--radius-lg);
  border: 2px solid var(--border-subtle);
  transition: all 0.2s ease;
  min-height: 60px;
}

.cs-item:hover {
  transform: translateY(-1px);
  border-color: rgba(255, 255, 255, 0.15);
}

/* Rarity border glow */
.cs-item--common {
  border-color: rgba(255, 255, 255, 0.15);
}

.cs-item--uncommon {
  border-color: var(--cf-lime);
  box-shadow: 0 0 8px rgba(57, 255, 20, 0.2);
}

.cs-item--rare {
  border-color: rgba(0, 150, 255, 1);
  box-shadow: 0 0 12px rgba(0, 150, 255, 0.3);
}

.cs-item--epic {
  border-color: rgba(147, 51, 234, 1);
  box-shadow: 0 0 12px rgba(147, 51, 234, 0.4);
}

.cs-item--legendary {
  border-color: var(--cf-gold);
  box-shadow: 0 0 16px rgba(255, 215, 0, 0.4);
}

/* Owned state */
.cs-item--owned {
  border-color: var(--cf-cyan);
  opacity: 0.7;
}

/* Locked state */
.cs-item--locked {
  opacity: 0.5;
}

/* Icon Wrapper */
.cs-icon-wrap {
  position: relative;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.03);
  border-radius: var(--radius-sm);
}

/* Icon (40px) */
.cs-icon {
  color: var(--text-secondary);
}

.cs-item--uncommon .cs-icon { color: var(--cf-lime); }
.cs-item--rare .cs-icon { color: rgba(0, 150, 255, 1); }
.cs-item--epic .cs-icon { color: rgba(147, 51, 234, 1); }
.cs-item--legendary .cs-icon { color: var(--cf-gold); }

/* Owned Badge Overlay */
.cs-owned-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--cf-cyan);
  border-radius: 50%;
  color: var(--cf-dark-1);
  box-shadow: 0 0 8px var(--cf-cyan);
}

/* Item Info */
.cs-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cs-name {
  font-family: var(--font-cyber-data);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cs-desc {
  font-family: var(--font-cyber-ui);
  font-size: var(--text-xs);
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Footer: Price + Buy */
.cs-footer {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

/* Price Badge */
.cs-price {
  display: flex;
  align-items: baseline;
  gap: 3px;
  padding: 4px 8px;
  background: rgba(57, 255, 20, 0.1);
  border-radius: var(--radius-sm);
  border: 1px solid rgba(57, 255, 20, 0.3);
}

.cs-price-value {
  font-family: var(--font-cyber-data);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--cf-lime);
}

.cs-price-label {
  font-family: var(--font-cyber-data);
  font-size: var(--text-xs);
  color: rgba(57, 255, 20, 0.6);
}

.cs-price--cant-afford {
  background: rgba(255, 0, 153, 0.1);
  border-color: rgba(255, 0, 153, 0.3);
}

.cs-price--cant-afford .cs-price-value {
  color: var(--cf-magenta);
}

.cs-price--cant-afford .cs-price-label {
  color: rgba(255, 0, 153, 0.6);
}

/* Buy Button */
.cs-buy {
  padding: 6px 12px;
  background: rgba(0, 240, 255, 0.1);
  border: 1px solid rgba(0, 240, 255, 0.4);
  border-radius: var(--radius-sm);
  color: var(--cf-cyan);
  font-family: var(--font-cyber-title);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cs-buy:hover:not(:disabled) {
  background: rgba(0, 240, 255, 0.2);
  border-color: var(--cf-cyan);
  box-shadow: 0 0 12px rgba(0, 240, 255, 0.3);
}

.cs-buy:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* Status badges (owned / locked) */
.cs-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-cyber-data);
  font-size: var(--text-xs);
  font-weight: 600;
}

.cs-status--owned {
  color: var(--cf-cyan);
}

.cs-status--locked {
  color: var(--cf-orange);
}

/* Empty State */
.cs-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
}

.cs-empty-icon {
  color: var(--text-muted);
  opacity: 0.3;
}

.cs-empty-text {
  font-family: var(--font-cyber-data);
  font-size: var(--text-sm);
  color: var(--text-muted);
  letter-spacing: 0.05em;
}

/* Browse Shop Button */
.cs-browse {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: rgba(255, 0, 153, 0.05);
  border: 1px solid rgba(255, 0, 153, 0.3);
  border-radius: var(--radius-sm);
  color: var(--cf-magenta);
  font-family: var(--font-cyber-title);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cs-browse:hover {
  background: rgba(255, 0, 153, 0.1);
  border-color: var(--cf-magenta);
  box-shadow: 0 0 12px rgba(255, 0, 153, 0.3);
}

/* Responsive */
@media (max-width: 768px) {
  .cs-item {
    flex-wrap: wrap;
  }

  .cs-footer {
    width: 100%;
    justify-content: flex-end;
  }
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .cs-item {
    transition: none;
  }

  .cs-buy {
    transition: none;
  }

  .cs-browse {
    transition: none;
  }
}
</style>
