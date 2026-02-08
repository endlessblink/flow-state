<script setup lang="ts">
/**
 * CyberArmoryView - ARMORY Tab Container
 * FEATURE-1118 Cyberflow RPG Hub
 *
 * Full expanded view of achievements (Trophy Wall) and shop (Supply Depot).
 * Used as the main content of the ARMORY tab in the RPG hub.
 */
import { Trophy, ShoppingBag } from 'lucide-vue-next'
import CyberAchievements from './CyberAchievements.vue'
import CyberShop from './CyberShop.vue'
</script>

<template>
  <div class="cyber-armory">
    <!-- Section 1: Trophy Wall (Achievements) -->
    <section class="armory-section">
      <div class="armory-section-header">
        <Trophy :size="16" class="armory-section-icon" />
        <h2 class="armory-section-title">TROPHY WALL</h2>
      </div>

      <div class="armory-section-content">
        <CyberAchievements :show-all="true" />
      </div>
    </section>

    <!-- Divider -->
    <div class="armory-divider" />

    <!-- Section 2: Supply Depot (Shop) -->
    <section class="armory-section">
      <div class="armory-section-header">
        <ShoppingBag :size="16" class="armory-section-icon" />
        <h2 class="armory-section-title">SUPPLY DEPOT</h2>
      </div>

      <div class="armory-section-content">
        <CyberShop :show-all="true" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.cyber-armory {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  height: 100%;
  overflow-y: auto;
  padding: var(--space-6);
  scrollbar-width: thin;
  scrollbar-color: var(--cf-cyan-20) transparent;
}

.cyber-armory::-webkit-scrollbar {
  width: 8px;
}

.cyber-armory::-webkit-scrollbar-track {
  background: transparent;
}

.cyber-armory::-webkit-scrollbar-thumb {
  background: var(--cf-cyan-20);
  border-radius: 4px;
}

.cyber-armory::-webkit-scrollbar-thumb:hover {
  background: var(--cf-cyan-50);
}

/* ===================================================================
   SECTION LAYOUT
   =================================================================== */

.armory-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.armory-section-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding-bottom: var(--space-2);
}

.armory-section-icon {
  color: var(--cf-cyan);
  filter: drop-shadow(0 0 4px rgba(0, 240, 255, 0.5));
}

.armory-section-title {
  font-family: var(--font-cyber-title);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin: 0;
  text-shadow: 0 0 8px rgba(0, 240, 255, 0.3);
}

.armory-section-content {
  flex: 1;
  min-height: 0;
}

/* ===================================================================
   DIVIDER
   =================================================================== */

.armory-divider {
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--border-subtle) 20%,
    var(--border-subtle) 80%,
    transparent 100%
  );
  margin: var(--space-4) 0;
}

/* ===================================================================
   RESPONSIVE - Stack more tightly on small screens
   =================================================================== */

@media (max-width: 768px) {
  .cyber-armory {
    padding: var(--space-4);
    gap: var(--space-6);
  }

  .armory-section-title {
    font-size: var(--text-xs);
  }
}
</style>
