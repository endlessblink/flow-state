<script setup lang="ts">
/**
 * Shop Modal Component
 * FEATURE-1118: Purchase themes and cosmetics with XP
 */
import { computed, ref } from 'vue'
import { useGamificationStore } from '@/stores/gamification'
import type { ShopCategory, ShopItemWithOwnership } from '@/types/gamification'
import { X, ShoppingBag, Check, Lock, Palette, Award, Sparkles, Volume2 } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const gamificationStore = useGamificationStore()

const selectedCategory = ref<ShopCategory | 'all'>('all')
const previewingItem = ref<string | null>(null)
const purchasing = ref(false)

const categories: { id: ShopCategory | 'all'; label: string; icon: any }[] = [
  { id: 'all', label: 'All', icon: ShoppingBag },
  { id: 'theme', label: 'Themes', icon: Palette },
  { id: 'badge_style', label: 'Badges', icon: Award },
  { id: 'animation', label: 'Animations', icon: Sparkles },
  { id: 'sound', label: 'Sounds', icon: Volume2 }
]

const availableXp = computed(() => gamificationStore.availableXp)
const currentLevel = computed(() => gamificationStore.currentLevel)
const equippedTheme = computed(() => gamificationStore.equippedTheme)

const filteredItems = computed(() => {
  const items = gamificationStore.shopItemsWithOwnership

  if (selectedCategory.value === 'all') {
    return items
  }

  return items.filter(item => item.category === selectedCategory.value)
})

function canAfford(item: ShopItemWithOwnership): boolean {
  return availableXp.value >= item.priceXp
}

function canPurchase(item: ShopItemWithOwnership): boolean {
  return !item.isOwned && canAfford(item) && currentLevel.value >= item.requiredLevel
}

function previewTheme(item: ShopItemWithOwnership) {
  if (item.category !== 'theme') return

  previewingItem.value = item.id
  gamificationStore.applyTheme(item.id)
}

function cancelPreview() {
  if (previewingItem.value) {
    previewingItem.value = null
    gamificationStore.applyTheme(equippedTheme.value)
  }
}

async function purchaseItem(item: ShopItemWithOwnership) {
  if (!canPurchase(item)) return

  purchasing.value = true
  try {
    const result = await gamificationStore.purchaseItem(item.id)
    if (result.success && item.category === 'theme') {
      // Auto-equip purchased theme
      await gamificationStore.equipTheme(item.id)
    }
  } finally {
    purchasing.value = false
    previewingItem.value = null
  }
}

async function equipTheme(itemId: string) {
  await gamificationStore.equipTheme(itemId)
}

function getCategoryIcon(category: ShopCategory) {
  const map: Record<ShopCategory, any> = {
    theme: Palette,
    badge_style: Award,
    animation: Sparkles,
    sound: Volume2
  }
  return map[category] || ShoppingBag
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="modal-overlay"
        @click.self="cancelPreview(); $emit('close')"
      >
        <div class="modal-container">
          <div class="modal-header">
            <div class="header-title">
              <ShoppingBag
                :size="24"
                class="header-icon"
              />
              <h2>Shop</h2>
            </div>
            <div class="header-balance">
              <span class="balance-label">Available:</span>
              <span class="balance-amount">{{ availableXp.toLocaleString() }} XP</span>
            </div>
            <button
              class="close-btn"
              @click="cancelPreview(); $emit('close')"
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
            </button>
          </div>

          <div class="shop-items">
            <div
              v-for="item in filteredItems"
              :key="item.id"
              class="shop-item"
              :class="{
                'shop-item--owned': item.isOwned,
                'shop-item--equipped': item.isOwned && item.category === 'theme' && equippedTheme === item.id,
                'shop-item--previewing': previewingItem === item.id,
                'shop-item--locked': currentLevel < item.requiredLevel
              }"
              @mouseenter="item.category === 'theme' && !item.isOwned ? previewTheme(item) : null"
              @mouseleave="cancelPreview"
            >
              <div class="item-icon">
                <component
                  :is="getCategoryIcon(item.category)"
                  :size="24"
                />
              </div>

              <div class="item-info">
                <span class="item-name">{{ item.name }}</span>
                <span class="item-description">{{ item.description }}</span>

                <div
                  v-if="currentLevel < item.requiredLevel"
                  class="item-lock"
                >
                  <Lock :size="12" />
                  <span>Requires Level {{ item.requiredLevel }}</span>
                </div>
              </div>

              <div class="item-action">
                <template v-if="item.isOwned">
                  <button
                    v-if="item.category === 'theme' && equippedTheme !== item.id"
                    class="equip-btn"
                    @click="equipTheme(item.id)"
                  >
                    Equip
                  </button>
                  <span
                    v-else
                    class="owned-badge"
                  >
                    <Check :size="14" />
                    {{ item.category === 'theme' && equippedTheme === item.id ? 'Equipped' : 'Owned' }}
                  </span>
                </template>
                <template v-else>
                  <button
                    class="buy-btn"
                    :class="{ 'buy-btn--disabled': !canPurchase(item) }"
                    :disabled="!canPurchase(item) || purchasing"
                    @click="purchaseItem(item)"
                  >
                    <span class="price">{{ item.priceXp.toLocaleString() }} XP</span>
                  </button>
                </template>
              </div>
            </div>

            <div
              v-if="filteredItems.length === 0"
              class="empty-state"
            >
              <ShoppingBag :size="32" />
              <span>No items in this category</span>
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
  backdrop-filter: blur(var(--blur-xs));
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
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--purple-border-medium);
}

.header-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.header-icon {
  color: rgba(var(--neon-cyan), 0.9);
}

.header-title h2 {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: var(--gamification-text-primary);
  margin: 0;
}

.header-balance {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
  padding: var(--space-2) var(--space-3);
  background: rgba(var(--neon-cyan), 0.1);
  border-radius: var(--radius-md);
}

.balance-label {
  font-size: var(--text-sm);
  color: var(--gamification-text-secondary);
}

.balance-amount {
  font-size: var(--text-base);
  font-weight: var(--font-bold);
  color: rgba(var(--neon-cyan), 1);
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
  transition: all var(--duration-normal) var(--spring-smooth);
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
  transition: all var(--duration-normal) var(--spring-smooth);
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

.shop-items {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  overflow-y: auto;
  flex: 1;
}

.shop-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--gamification-card-bg);
  border: 1px solid var(--purple-border-medium);
  border-radius: var(--radius-md);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.shop-item:hover {
  border-color: var(--purple-border-medium);
}

.shop-item--owned {
  border-color: var(--border-medium);
  background: rgba(var(--neon-cyan), 0.05);
}

.shop-item--equipped {
  border-color: rgba(var(--neon-cyan), 0.5);
  box-shadow: 0 0 var(--space-3) rgba(var(--neon-cyan), 0.2);
}

.shop-item--previewing {
  border-color: rgba(var(--neon-magenta), 0.5);
  box-shadow: 0 0 var(--space-3) rgba(var(--neon-magenta), 0.2);
}

.shop-item--locked {
  opacity: 0.6;
}

.item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--space-12);
  height: var(--space-12);
  background: var(--purple-bg-subtle);
  border-radius: var(--radius-md);
  color: rgba(var(--neon-cyan), 0.8);
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
  min-width: 0;
}

.item-name {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--gamification-text-primary);
}

.item-description {
  font-size: var(--text-sm);
  color: var(--gamification-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-lock {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--tier-rare);
}

.item-action {
  display: flex;
  align-items: center;
}

.buy-btn {
  padding: var(--space-2) var(--space-3);
  background: rgba(var(--neon-cyan), 0.15);
  border: 1px solid rgba(var(--neon-cyan), 0.4);
  border-radius: var(--radius-md);
  color: rgba(var(--neon-cyan), 1);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.buy-btn:hover:not(:disabled) {
  background: rgba(var(--neon-cyan), 0.25);
  box-shadow: 0 0 var(--space-3) rgba(var(--neon-cyan), 0.3);
}

.buy-btn--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.equip-btn {
  padding: var(--space-2) var(--space-3);
  background: rgba(var(--neon-magenta), 0.15);
  border: 1px solid rgba(var(--neon-magenta), 0.4);
  border-radius: var(--radius-md);
  color: rgba(var(--neon-magenta), 1);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.equip-btn:hover {
  background: rgba(var(--neon-magenta), 0.25);
  box-shadow: 0 0 var(--space-3) rgba(var(--neon-magenta), 0.3);
}

.owned-badge {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  background: rgba(var(--neon-cyan), 0.1);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: rgba(var(--neon-cyan), 0.8);
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
  transition: opacity var(--duration-normal) var(--ease-out);
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform var(--duration-normal) var(--spring-smooth);
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
