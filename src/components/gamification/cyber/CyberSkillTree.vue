<script setup lang="ts">
/**
 * CyberSkillTree - Visual Skill Tree with Character Silhouette
 * FEATURE-1118 Cyberflow RPG Hub: Replaces old Armory (CyberArmoryView)
 *
 * Layout: No-scroll viewport-filling grid.
 * Left (~30%): CSS character silhouette with 4 equipment slots.
 * Right (~70%): Horizontal skill tree branches per shop category.
 * Bottom: Selected item detail bar with purchase action.
 *
 * Slots on the character silhouette:
 *   HEAD  -> badge_style
 *   BODY  -> theme
 *   HANDS -> animation
 *   AURA  -> sound
 *
 * All data sourced from useGamificationStore. Uses Cyberflow design tokens.
 */
import { computed, ref, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useGamificationStore } from '@/stores/gamification'
import { useCyberflowTheme } from '@/composables/useCyberflowTheme'
import type { ShopItemWithOwnership, ShopCategory } from '@/types/gamification'
import {
  Palette,
  Hexagon,
  Sparkles,
  Radio,
  Lock,
  Check,
  Zap,
  Crown,
  Shirt,
  Hand,
  Waves,
  ChevronRight,
} from 'lucide-vue-next'

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
const gamificationStore = useGamificationStore()
const { availableXp, currentLevel, shopItemsWithOwnership } = storeToRefs(gamificationStore)
const { cyberflowClasses } = useCyberflowTheme()

// ---------------------------------------------------------------------------
// Local State
// ---------------------------------------------------------------------------
const selectedItem = ref<ShopItemWithOwnership | null>(null)
const activeSlotFilter = ref<ShopCategory | null>(null)
const purchasingId = ref<string | null>(null)

// ---------------------------------------------------------------------------
// Category Config
// ---------------------------------------------------------------------------
interface CategoryMeta {
  key: ShopCategory
  label: string
  icon: typeof Palette
  color: string       // CSS variable reference
  colorHex: string    // Raw hex for inline glow
  slotLabel: string   // Silhouette slot display label
  slotIcon: typeof Crown
}

const categories: CategoryMeta[] = [
  {
    key: 'theme',
    label: 'THEMES',
    icon: Palette,
    color: 'var(--cf-cyan)',
    colorHex: '#00f0ff',
    slotLabel: 'BODY',
    slotIcon: Shirt,
  },
  {
    key: 'animation',
    label: 'EFFECTS',
    icon: Sparkles,
    color: 'var(--cf-magenta)',
    colorHex: '#ff0099',
    slotLabel: 'HANDS',
    slotIcon: Hand,
  },
  {
    key: 'badge_style',
    label: 'BADGES',
    icon: Hexagon,
    color: 'var(--cf-gold)',
    colorHex: '#ffd700',
    slotLabel: 'HEAD',
    slotIcon: Crown,
  },
  {
    key: 'sound',
    label: 'AUDIO',
    icon: Radio,
    color: 'var(--cf-lime)',
    colorHex: '#39ff14',
    slotLabel: 'AURA',
    slotIcon: Waves,
  },
]

/** Slot display order on the character: HEAD, BODY, HANDS, AURA (top to bottom) */
const slotOrder: ShopCategory[] = ['badge_style', 'theme', 'animation', 'sound']

// ---------------------------------------------------------------------------
// Computed
// ---------------------------------------------------------------------------

/** Items grouped by category, sorted ascending by price */
const itemsByCategory = computed(() => {
  const map = new Map<ShopCategory, ShopItemWithOwnership[]>()
  for (const cat of categories) {
    const items = shopItemsWithOwnership.value
      .filter(i => i.category === cat.key && i.isAvailable)
      .sort((a, b) => a.priceXp - b.priceXp)
    map.set(cat.key, items)
  }
  return map
})

/** First owned item per category (simplistic "equipped" logic) */
const equippedByCategory = computed(() => {
  const map = new Map<ShopCategory, ShopItemWithOwnership | null>()
  for (const cat of categories) {
    const owned = shopItemsWithOwnership.value.find(
      i => i.category === cat.key && i.isOwned
    )
    map.set(cat.key, owned ?? null)
  }
  return map
})

/** Which categories to render in the tree (filtered by slot click, or all) */
const visibleCategories = computed(() => {
  if (activeSlotFilter.value) {
    return categories.filter(c => c.key === activeSlotFilter.value)
  }
  return categories
})

function getCategoryMeta(key: ShopCategory): CategoryMeta {
  return categories.find(c => c.key === key)!
}

// ---------------------------------------------------------------------------
// Node state helpers
// ---------------------------------------------------------------------------
type NodeState = 'owned' | 'available' | 'locked'

function getNodeState(item: ShopItemWithOwnership): NodeState {
  if (item.isOwned) return 'owned'
  if (currentLevel.value >= item.requiredLevel && availableXp.value >= item.priceXp) return 'available'
  return 'locked'
}

function canAfford(item: ShopItemWithOwnership): boolean {
  return availableXp.value >= item.priceXp
}

function meetsLevel(item: ShopItemWithOwnership): boolean {
  return currentLevel.value >= item.requiredLevel
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
function selectNode(item: ShopItemWithOwnership) {
  selectedItem.value = item
}

function toggleSlotFilter(category: ShopCategory) {
  if (activeSlotFilter.value === category) {
    activeSlotFilter.value = null
  } else {
    activeSlotFilter.value = category
  }
  // Clear selection if it no longer matches the active filter
  if (activeSlotFilter.value && selectedItem.value?.category !== activeSlotFilter.value) {
    selectedItem.value = null
  }
}

async function handlePurchase() {
  if (!selectedItem.value || selectedItem.value.isOwned || purchasingId.value) return
  if (!canAfford(selectedItem.value) || !meetsLevel(selectedItem.value)) return

  purchasingId.value = selectedItem.value.id
  try {
    const result = await gamificationStore.purchaseItem(selectedItem.value.id)
    if (result.success) {
      // Re-resolve the item so isOwned updates in the detail panel
      await nextTick()
      const updated = shopItemsWithOwnership.value.find(i => i.id === selectedItem.value?.id)
      if (updated) selectedItem.value = updated
    }
  } finally {
    purchasingId.value = null
  }
}

// ---------------------------------------------------------------------------
// Keyboard navigation for tree nodes (roving tabindex)
// ---------------------------------------------------------------------------
function handleNodeKeydown(
  event: KeyboardEvent,
  item: ShopItemWithOwnership,
  items: ShopItemWithOwnership[],
  index: number,
) {
  let target: number | null = null
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    target = Math.min(index + 1, items.length - 1)
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    target = Math.max(index - 1, 0)
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    selectNode(item)
    return
  }

  if (target !== null && target !== index) {
    event.preventDefault()
    const nodesContainer = (event.currentTarget as HTMLElement)?.parentElement
    const nodeEls = nodesContainer?.querySelectorAll<HTMLElement>('.st-node')
    if (nodeEls?.[target]) {
      nodeEls[target].focus()
    }
  }
}
</script>

<template>
  <div
    class="cyber-skill-tree"
    :class="cyberflowClasses"
  >
    <!-- ================================================================ -->
    <!-- HEADER BAR                                                       -->
    <!-- ================================================================ -->
    <header class="st-header">
      <div class="st-header-left">
        <Zap :size="18" class="st-header-icon" />
        <h1 class="st-title">UPGRADES</h1>
      </div>
      <div class="st-xp-badge" aria-label="Available XP">
        <span class="st-xp-value">{{ availableXp.toLocaleString() }}</span>
        <span class="st-xp-unit">XP</span>
      </div>
    </header>

    <!-- ================================================================ -->
    <!-- MAIN CONTENT: Silhouette + Tree                                  -->
    <!-- ================================================================ -->
    <div class="st-body">

      <!-- LEFT: Character Silhouette Panel -->
      <aside class="st-character" aria-label="Character equipment slots">
        <div class="st-silhouette">

          <!-- Geometric character outline -->
          <div class="st-sil-figure" aria-hidden="true">
            <div class="st-sil-head" />
            <div class="st-sil-neck" />
            <div class="st-sil-torso" />
            <div class="st-sil-arm st-sil-arm--left" />
            <div class="st-sil-arm st-sil-arm--right" />
            <div class="st-sil-legs" />
            <div
              class="st-sil-aura"
              :class="{ 'st-sil-aura--active': equippedByCategory.get('sound') }"
            />
          </div>

          <!-- Equipment Slot Buttons (top to bottom: HEAD, BODY, HANDS, AURA) -->
          <div class="st-slots">
            <button
              v-for="catKey in slotOrder"
              :key="catKey"
              class="st-slot"
              :class="{
                'st-slot--active': activeSlotFilter === catKey,
                'st-slot--equipped': equippedByCategory.get(catKey),
              }"
              :style="{
                '--slot-color': getCategoryMeta(catKey).color,
                '--slot-hex': getCategoryMeta(catKey).colorHex,
              }"
              :aria-label="`${getCategoryMeta(catKey).slotLabel} slot: ${equippedByCategory.get(catKey)?.name || 'Empty'}. Click to filter tree.`"
              :aria-pressed="activeSlotFilter === catKey"
              @click="toggleSlotFilter(catKey)"
            >
              <div class="st-slot-icon-wrap">
                <component
                  :is="getCategoryMeta(catKey).slotIcon"
                  :size="18"
                  class="st-slot-icon"
                />
              </div>
              <div class="st-slot-info">
                <span class="st-slot-label">{{ getCategoryMeta(catKey).slotLabel }}</span>
                <span class="st-slot-item">
                  {{ equippedByCategory.get(catKey)?.name || 'EMPTY' }}
                </span>
              </div>
            </button>
          </div>
        </div>
      </aside>

      <!-- RIGHT: Skill Tree Branches -->
      <main class="st-tree" role="tree" aria-label="Skill tree">
        <div
          v-for="cat in visibleCategories"
          :key="cat.key"
          class="st-branch"
          role="treeitem"
          :aria-label="`${cat.label} branch`"
          :style="{ '--branch-color': cat.color, '--branch-hex': cat.colorHex }"
        >
          <!-- Branch label -->
          <div class="st-branch-label">
            <component :is="cat.icon" :size="16" class="st-branch-icon" />
            <span class="st-branch-name">{{ cat.label }}</span>
          </div>

          <!-- Nodes row (horizontal) -->
          <div class="st-nodes" role="group">
            <template
              v-for="(item, idx) in itemsByCategory.get(cat.key) ?? []"
              :key="item.id"
            >
              <!-- Connection line between nodes -->
              <div
                v-if="idx > 0"
                class="st-connector"
                :class="{ 'st-connector--lit': getNodeState(item) === 'owned' }"
                aria-hidden="true"
              />

              <!-- Node diamond -->
              <button
                class="st-node"
                :class="[
                  `st-node--${getNodeState(item)}`,
                  { 'st-node--selected': selectedItem?.id === item.id },
                ]"
                :aria-label="`${item.name}, ${item.priceXp} XP, ${getNodeState(item)}`"
                :tabindex="idx === 0 ? 0 : -1"
                @click="selectNode(item)"
                @keydown="handleNodeKeydown($event, item, itemsByCategory.get(cat.key) ?? [], idx)"
              >
                <component
                  :is="cat.icon"
                  :size="20"
                  class="st-node-icon"
                />
                <!-- Owned check -->
                <span v-if="item.isOwned" class="st-node-badge st-node-badge--owned">
                  <Check :size="10" />
                </span>
                <!-- Lock indicator -->
                <span v-if="!meetsLevel(item) && !item.isOwned" class="st-node-badge st-node-badge--lock">
                  <Lock :size="10" />
                </span>
              </button>
            </template>

            <!-- Empty branch -->
            <span
              v-if="(itemsByCategory.get(cat.key) ?? []).length === 0"
              class="st-branch-empty"
            >
              NO ITEMS
            </span>
          </div>
        </div>

        <!-- Legend -->
        <div class="st-legend" aria-hidden="true">
          <div class="st-legend-item">
            <span class="st-legend-swatch st-legend-swatch--owned" />
            <span>OWNED</span>
          </div>
          <div class="st-legend-item">
            <span class="st-legend-swatch st-legend-swatch--available" />
            <span>AVAILABLE</span>
          </div>
          <div class="st-legend-item">
            <span class="st-legend-swatch st-legend-swatch--locked" />
            <span>LOCKED</span>
          </div>
        </div>
      </main>
    </div>

    <!-- ================================================================ -->
    <!-- BOTTOM: Selected Item Detail Bar                                 -->
    <!-- ================================================================ -->
    <footer
      class="st-detail"
      :class="{ 'st-detail--active': selectedItem }"
      role="status"
      aria-live="polite"
    >
      <template v-if="selectedItem">
        <div class="st-detail-info">
          <component
            :is="getCategoryMeta(selectedItem.category).icon"
            :size="22"
            class="st-detail-cat-icon"
            :style="{ color: getCategoryMeta(selectedItem.category).color }"
          />
          <div class="st-detail-text">
            <span class="st-detail-name">{{ selectedItem.name }}</span>
            <span class="st-detail-desc">{{ selectedItem.description }}</span>
          </div>

          <!-- Price -->
          <div
            v-if="!selectedItem.isOwned"
            class="st-detail-price"
            :class="{ 'st-detail-price--expensive': !canAfford(selectedItem) }"
          >
            <span class="st-detail-price-val">{{ selectedItem.priceXp.toLocaleString() }}</span>
            <span class="st-detail-price-unit">XP</span>
          </div>

          <!-- Level requirement -->
          <div
            v-if="!selectedItem.isOwned && !meetsLevel(selectedItem)"
            class="st-detail-lvl"
          >
            <Lock :size="12" />
            <span>LVL {{ selectedItem.requiredLevel }}</span>
          </div>
        </div>

        <!-- Action -->
        <div class="st-detail-action">
          <!-- Owned -->
          <div v-if="selectedItem.isOwned" class="st-status-badge st-status-badge--owned">
            <Check :size="14" />
            <span>OWNED</span>
          </div>

          <!-- Locked -->
          <div v-else-if="!meetsLevel(selectedItem)" class="st-status-badge st-status-badge--locked">
            <Lock :size="14" />
            <span>LOCKED</span>
          </div>

          <!-- Purchase -->
          <button
            v-else
            class="st-buy"
            :class="{
              'st-buy--can-afford': canAfford(selectedItem),
              'st-buy--busy': purchasingId === selectedItem.id,
            }"
            :disabled="!canAfford(selectedItem) || purchasingId === selectedItem.id"
            @click="handlePurchase"
          >
            <Zap v-if="canAfford(selectedItem)" :size="16" />
            <Lock v-else :size="16" />
            <span>
              {{ purchasingId === selectedItem.id
                ? 'PROCESSING...'
                : canAfford(selectedItem)
                  ? 'ACQUIRE'
                  : 'NEED MORE XP' }}
            </span>
          </button>
        </div>
      </template>

      <!-- No selection -->
      <div v-else class="st-detail-placeholder">
        <ChevronRight :size="14" />
        <span>SELECT A NODE TO VIEW DETAILS</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* =====================================================================
   ROOT LAYOUT
   Fills parent height, three-row grid: header | body | footer.
   No scroll anywhere.
   ===================================================================== */
.cyber-skill-tree {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
  background: var(--cf-dark-1, #050508);
  color: var(--text-primary);
  font-family: var(--font-cyber-ui, 'Rajdhani', sans-serif);
  position: relative;
}

/* Subtle grid overlay for depth */
.cyber-skill-tree::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(0, 240, 255, 0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 240, 255, 0.015) 1px, transparent 1px);
  background-size: 48px 48px;
  pointer-events: none;
  z-index: 0;
}

/* =====================================================================
   HEADER
   ===================================================================== */
.st-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3, 12px) var(--space-5, 20px);
  border-bottom: 1px solid rgba(0, 240, 255, 0.1);
  background: rgba(5, 5, 8, 0.85);
  backdrop-filter: blur(8px);
  position: relative;
  z-index: 2;
}

.st-header-left {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
}

.st-header-icon {
  color: var(--cf-cyan, #00f0ff);
  filter: drop-shadow(0 0 6px rgba(0, 240, 255, 0.6));
}

.st-title {
  font-family: var(--font-cyber-title, 'Orbitron', sans-serif);
  font-size: var(--text-sm, 0.875rem);
  font-weight: 700;
  letter-spacing: 0.2em;
  color: var(--text-primary);
  margin: 0;
  text-shadow: 0 0 12px rgba(0, 240, 255, 0.25);
}

.st-xp-badge {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 6px 14px;
  background: rgba(57, 255, 20, 0.06);
  border: 1px solid rgba(57, 255, 20, 0.25);
  border-radius: var(--radius-sm, 6px);
}

.st-xp-value {
  font-family: var(--font-cyber-data, 'Space Mono', monospace);
  font-size: var(--text-base, 1rem);
  font-weight: 700;
  color: var(--cf-lime, #39ff14);
  text-shadow: 0 0 10px rgba(57, 255, 20, 0.5);
}

.st-xp-unit {
  font-family: var(--font-cyber-data, 'Space Mono', monospace);
  font-size: var(--text-xs, 0.75rem);
  color: rgba(57, 255, 20, 0.45);
  letter-spacing: 0.1em;
}

/* =====================================================================
   BODY - Two-column layout
   ===================================================================== */
.st-body {
  display: grid;
  grid-template-columns: minmax(180px, 28%) 1fr;
  gap: 0;
  overflow: hidden;
  position: relative;
  z-index: 1;
}

/* =====================================================================
   LEFT PANEL: CHARACTER SILHOUETTE
   ===================================================================== */
.st-character {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-4, 16px) var(--space-3, 12px);
  border-right: 1px solid rgba(0, 240, 255, 0.06);
  background: rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.st-silhouette {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-5, 20px);
  width: 100%;
  max-width: 200px;
}

/* ----- Geometric body outline ----- */
.st-sil-figure {
  position: relative;
  width: 100px;
  height: 155px;
  flex-shrink: 0;
}

.st-sil-head {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.02);
}

.st-sil-neck {
  position: absolute;
  top: 28px;
  left: 50%;
  transform: translateX(-50%);
  width: 8px;
  height: 10px;
  background: rgba(255, 255, 255, 0.04);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.st-sil-torso {
  position: absolute;
  top: 36px;
  left: 50%;
  transform: translateX(-50%);
  width: 44px;
  height: 50px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px 4px 6px 6px;
  background: rgba(255, 255, 255, 0.015);
  clip-path: polygon(12% 0, 88% 0, 100% 100%, 0 100%);
}

.st-sil-arm {
  position: absolute;
  top: 40px;
  width: 10px;
  height: 48px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.015);
  border-radius: 4px;
}

.st-sil-arm--left {
  left: 10px;
  transform: rotate(8deg);
}

.st-sil-arm--right {
  right: 10px;
  transform: rotate(-8deg);
}

.st-sil-legs {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 34px;
  height: 52px;
}

.st-sil-legs::before,
.st-sil-legs::after {
  content: '';
  position: absolute;
  bottom: 0;
  width: 13px;
  height: 50px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 0 0 3px 3px;
  background: rgba(255, 255, 255, 0.01);
}

.st-sil-legs::before {
  left: 0;
}

.st-sil-legs::after {
  right: 0;
}

/* Aura ring around the figure */
.st-sil-aura {
  position: absolute;
  inset: -16px;
  border-radius: 50%;
  border: 1px dashed rgba(255, 255, 255, 0.04);
  transition: all 0.5s ease;
  pointer-events: none;
}

.st-sil-aura--active {
  border-color: rgba(57, 255, 20, 0.2);
  box-shadow:
    0 0 20px rgba(57, 255, 20, 0.06),
    inset 0 0 16px rgba(57, 255, 20, 0.03);
  animation: aura-breathe 3s ease-in-out infinite;
}

@keyframes aura-breathe {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.04); }
}

/* ----- Equipment Slot Buttons ----- */
.st-slots {
  display: flex;
  flex-direction: column;
  gap: var(--space-1_5, 6px);
  width: 100%;
}

.st-slot {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  padding: 7px 10px;
  background: rgba(255, 255, 255, 0.015);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-sm, 6px);
  cursor: pointer;
  transition: all 0.2s ease;
  color: inherit;
  text-align: left;
  width: 100%;
  font-family: inherit;
}

.st-slot:hover {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.12);
}

.st-slot--active {
  border-color: var(--slot-color);
  background: color-mix(in srgb, var(--slot-color) 6%, transparent);
  box-shadow: 0 0 10px color-mix(in srgb, var(--slot-color) 15%, transparent);
}

.st-slot-icon-wrap {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-xs, 2px);
  background: rgba(255, 255, 255, 0.02);
  flex-shrink: 0;
}

.st-slot-icon {
  color: var(--text-muted);
  transition: color 0.2s ease, filter 0.2s ease;
}

.st-slot--equipped .st-slot-icon {
  color: var(--slot-color);
  filter: drop-shadow(0 0 4px var(--slot-hex));
}

.st-slot-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
}

.st-slot-label {
  font-family: var(--font-cyber-title, 'Orbitron', sans-serif);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: var(--text-muted);
  text-transform: uppercase;
}

.st-slot-item {
  font-family: var(--font-cyber-data, 'Space Mono', monospace);
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.st-slot--equipped .st-slot-item {
  color: var(--slot-color);
}

/* =====================================================================
   RIGHT PANEL: SKILL TREE BRANCHES
   ===================================================================== */
.st-tree {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-5, 20px);
  padding: var(--space-5, 20px) var(--space-6, 24px);
  overflow: hidden;
  position: relative;
}

/* Each branch is a horizontal row */
.st-branch {
  display: flex;
  align-items: center;
  gap: var(--space-4, 16px);
}

.st-branch-label {
  display: flex;
  align-items: center;
  gap: var(--space-1_5, 6px);
  width: 96px;
  flex-shrink: 0;
}

.st-branch-icon {
  color: var(--branch-color);
  filter: drop-shadow(0 0 4px var(--branch-hex));
  flex-shrink: 0;
}

.st-branch-name {
  font-family: var(--font-cyber-title, 'Orbitron', sans-serif);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--branch-color);
  text-shadow: 0 0 8px color-mix(in srgb, var(--branch-color) 30%, transparent);
}

/* Nodes container */
.st-nodes {
  display: flex;
  align-items: center;
  gap: 0;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  padding: var(--space-2, 8px) var(--space-1, 4px);
}

.st-nodes::-webkit-scrollbar {
  display: none;
}

/* Connection lines */
.st-connector {
  width: 20px;
  height: 2px;
  background: rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.st-connector--lit {
  background: var(--branch-color);
  box-shadow: 0 0 6px var(--branch-hex);
}

/* ----- Node (rotated diamond) ----- */
.st-node {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(255, 255, 255, 0.08);
  background: var(--cf-dark-3, #12121a);
  cursor: pointer;
  transition: all 0.2s ease;
  color: inherit;
  padding: 0;
  font-family: inherit;

  /* Diamond shape */
  transform: rotate(45deg);
  border-radius: 6px;
}

.st-node-icon {
  /* Counter-rotate so the icon is upright */
  transform: rotate(-45deg);
  color: var(--text-muted);
  transition: color 0.2s ease;
  pointer-events: none;
}

/* --- OWNED --- */
.st-node--owned {
  border-color: var(--branch-color);
  background: color-mix(in srgb, var(--branch-color) 12%, var(--cf-dark-3, #12121a));
  box-shadow:
    0 0 8px color-mix(in srgb, var(--branch-hex) 35%, transparent),
    inset 0 0 6px color-mix(in srgb, var(--branch-hex) 8%, transparent);
}

.st-node--owned .st-node-icon {
  color: var(--branch-color);
}

/* --- AVAILABLE --- */
.st-node--available {
  border-color: var(--branch-color);
  border-style: dashed;
  animation: node-pulse 2.5s ease-in-out infinite;
}

.st-node--available .st-node-icon {
  color: var(--branch-color);
  opacity: 0.65;
}

@keyframes node-pulse {
  0%, 100% {
    box-shadow: 0 0 4px color-mix(in srgb, var(--branch-hex) 15%, transparent);
  }
  50% {
    box-shadow: 0 0 14px color-mix(in srgb, var(--branch-hex) 35%, transparent);
  }
}

/* --- LOCKED --- */
.st-node--locked {
  border-color: rgba(255, 255, 255, 0.04);
  opacity: 0.35;
  cursor: default;
}

.st-node--locked .st-node-icon {
  color: var(--text-disabled);
}

/* --- SELECTED outline --- */
.st-node--selected {
  outline: 2px solid var(--branch-color);
  outline-offset: 4px;
  box-shadow: 0 0 18px var(--branch-hex);
}

/* Focus visible ring */
.st-node:focus-visible {
  outline: 2px solid var(--cf-cyan, #00f0ff);
  outline-offset: 4px;
}

/* Hover (non-locked) */
.st-node:not(.st-node--locked):hover {
  transform: rotate(45deg) scale(1.15);
  border-color: var(--branch-color);
  box-shadow: 0 0 18px color-mix(in srgb, var(--branch-hex) 45%, transparent);
}

/* Node badge overlays (owned check, lock) */
.st-node-badge {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--cf-dark-1, #050508);
  transform: rotate(-45deg);
  pointer-events: none;
}

.st-node-badge--owned {
  bottom: -3px;
  right: -3px;
  width: 16px;
  height: 16px;
  background: var(--branch-color);
  box-shadow: 0 0 6px var(--branch-hex);
}

.st-node-badge--lock {
  top: -3px;
  right: -3px;
  width: 14px;
  height: 14px;
  background: rgba(255, 107, 53, 0.85);
}

/* Branch empty state */
.st-branch-empty {
  font-family: var(--font-cyber-data, 'Space Mono', monospace);
  font-size: var(--text-xs, 0.75rem);
  color: var(--text-disabled);
  letter-spacing: 0.1em;
  padding-left: var(--space-2, 8px);
}

/* ----- Legend ----- */
.st-legend {
  display: flex;
  gap: var(--space-5, 20px);
  padding-top: var(--space-2, 8px);
  margin-top: auto;
}

.st-legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-1_5, 6px);
  font-family: var(--font-cyber-data, 'Space Mono', monospace);
  font-size: 9px;
  color: var(--text-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.st-legend-swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  transform: rotate(45deg);
  flex-shrink: 0;
}

.st-legend-swatch--owned {
  background: var(--cf-cyan, #00f0ff);
  box-shadow: 0 0 6px rgba(0, 240, 255, 0.5);
}

.st-legend-swatch--available {
  border: 1.5px dashed var(--cf-cyan, #00f0ff);
  background: transparent;
}

.st-legend-swatch--locked {
  background: rgba(255, 255, 255, 0.08);
  opacity: 0.5;
}

/* =====================================================================
   BOTTOM: SELECTED ITEM DETAIL BAR
   ===================================================================== */
.st-detail {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3, 12px) var(--space-5, 20px);
  border-top: 1px solid rgba(0, 240, 255, 0.08);
  background: rgba(10, 10, 18, 0.92);
  backdrop-filter: blur(8px);
  min-height: 54px;
  position: relative;
  z-index: 2;
  gap: var(--space-3, 12px);
}

.st-detail-info {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  flex: 1;
  min-width: 0;
}

.st-detail-cat-icon {
  flex-shrink: 0;
  filter: drop-shadow(0 0 4px currentColor);
}

.st-detail-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  gap: 1px;
}

.st-detail-name {
  font-family: var(--font-cyber-data, 'Space Mono', monospace);
  font-size: var(--text-sm, 0.875rem);
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.st-detail-desc {
  font-family: var(--font-cyber-ui, 'Rajdhani', sans-serif);
  font-size: var(--text-xs, 0.75rem);
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Price */
.st-detail-price {
  display: flex;
  align-items: baseline;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(57, 255, 20, 0.06);
  border: 1px solid rgba(57, 255, 20, 0.2);
  border-radius: var(--radius-sm, 6px);
  flex-shrink: 0;
}

.st-detail-price-val {
  font-family: var(--font-cyber-data, 'Space Mono', monospace);
  font-size: var(--text-sm, 0.875rem);
  font-weight: 700;
  color: var(--cf-lime, #39ff14);
}

.st-detail-price-unit {
  font-family: var(--font-cyber-data, 'Space Mono', monospace);
  font-size: 9px;
  color: rgba(57, 255, 20, 0.45);
}

.st-detail-price--expensive {
  background: rgba(255, 0, 153, 0.06);
  border-color: rgba(255, 0, 153, 0.2);
}

.st-detail-price--expensive .st-detail-price-val {
  color: var(--cf-magenta, #ff0099);
}

.st-detail-price--expensive .st-detail-price-unit {
  color: rgba(255, 0, 153, 0.45);
}

/* Level requirement */
.st-detail-lvl {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-cyber-data, 'Space Mono', monospace);
  font-size: var(--text-xs, 0.75rem);
  color: var(--cf-orange, #ff6b35);
  flex-shrink: 0;
}

/* Action area */
.st-detail-action {
  flex-shrink: 0;
}

/* Status badges */
.st-status-badge {
  display: flex;
  align-items: center;
  gap: var(--space-1_5, 6px);
  padding: 8px 16px;
  border-radius: var(--radius-sm, 6px);
  font-family: var(--font-cyber-title, 'Orbitron', sans-serif);
  font-size: var(--text-xs, 0.75rem);
  font-weight: 600;
  letter-spacing: 0.1em;
}

.st-status-badge--owned {
  background: rgba(0, 240, 255, 0.06);
  border: 1px solid rgba(0, 240, 255, 0.25);
  color: var(--cf-cyan, #00f0ff);
}

.st-status-badge--locked {
  background: rgba(255, 107, 53, 0.06);
  border: 1px solid rgba(255, 107, 53, 0.25);
  color: var(--cf-orange, #ff6b35);
}

/* Purchase button */
.st-buy {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  padding: 10px 24px;
  border: 2px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-sm, 6px);
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-muted);
  font-family: var(--font-cyber-title, 'Orbitron', sans-serif);
  font-size: var(--text-xs, 0.75rem);
  font-weight: 700;
  letter-spacing: 0.14em;
  cursor: pointer;
  transition: all 0.25s ease;
  white-space: nowrap;
}

.st-buy--can-afford {
  border-color: var(--cf-cyan, #00f0ff);
  color: var(--cf-cyan, #00f0ff);
  background: rgba(0, 240, 255, 0.05);
  box-shadow: 0 0 12px rgba(0, 240, 255, 0.12);
  animation: buy-glow 2.5s ease-in-out infinite;
}

@keyframes buy-glow {
  0%, 100% {
    box-shadow: 0 0 10px rgba(0, 240, 255, 0.12);
  }
  50% {
    box-shadow:
      0 0 16px rgba(0, 240, 255, 0.25),
      0 0 32px rgba(0, 240, 255, 0.08);
  }
}

.st-buy--can-afford:hover {
  background: rgba(0, 240, 255, 0.1);
  box-shadow:
    0 0 20px rgba(0, 240, 255, 0.35),
    0 0 40px rgba(0, 240, 255, 0.12);
  transform: translateY(-1px);
}

.st-buy--can-afford:active {
  transform: translateY(0) scale(0.98);
}

.st-buy:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.st-buy--busy {
  animation: none;
  opacity: 0.6;
}

/* Placeholder text when nothing selected */
.st-detail-placeholder {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  font-family: var(--font-cyber-data, 'Space Mono', monospace);
  font-size: var(--text-xs, 0.75rem);
  color: var(--text-disabled);
  letter-spacing: 0.06em;
  width: 100%;
  justify-content: center;
}

/* =====================================================================
   ACCESSIBILITY: REDUCED MOTION
   ===================================================================== */
@media (prefers-reduced-motion: reduce) {
  .st-sil-aura--active {
    animation: none;
  }

  .st-node {
    transition: none;
  }

  .st-node--available {
    animation: none;
    border-style: solid;
  }

  .st-node:not(.st-node--locked):hover {
    transform: rotate(45deg);
  }

  .st-buy,
  .st-buy--can-afford {
    animation: none;
    transition: none;
  }

  .st-buy--can-afford:hover {
    transform: none;
  }

  .st-slot {
    transition: none;
  }
}

/* =====================================================================
   RESPONSIVE: Narrow viewports
   ===================================================================== */
@media (max-width: 700px) {
  .st-body {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .st-character {
    border-right: none;
    border-bottom: 1px solid rgba(0, 240, 255, 0.06);
    padding: var(--space-3, 12px);
  }

  .st-silhouette {
    flex-direction: row;
    max-width: 100%;
    gap: var(--space-4, 16px);
  }

  .st-sil-figure {
    display: none;
  }

  .st-slots {
    flex-direction: row;
    flex-wrap: wrap;
    gap: var(--space-1_5, 6px);
  }

  .st-slot {
    flex: 1 1 auto;
    min-width: 110px;
    padding: 5px 8px;
  }

  .st-tree {
    padding: var(--space-3, 12px);
    gap: var(--space-3, 12px);
  }

  .st-branch-label {
    width: 68px;
  }

  .st-branch-name {
    font-size: 8px;
  }

  .st-detail {
    flex-direction: column;
    gap: var(--space-2, 8px);
    padding: var(--space-2, 8px) var(--space-3, 12px);
  }

  .st-detail-action {
    width: 100%;
  }

  .st-buy {
    width: 100%;
    justify-content: center;
  }

  .st-status-badge {
    width: 100%;
    justify-content: center;
  }
}
</style>
