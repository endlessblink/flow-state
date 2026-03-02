<template>
  <div :class="cyberflowClasses" class="cyberflow-view">
    <!-- Compact Header -->
    <div class="cf-header">
      <div class="cf-header-left">
        <span class="cf-title-text" data-augmented-ui="tl-clip br-clip border">CYBERFLOW</span>
        <span class="cf-status">// ONLINE</span>
      </div>
    </div>

    <!-- Section Navigation -->
    <CyberSectionNav
      :active-section="activeSection"
      @update:active-section="activeSection = $event"
    />

    <!-- Section Content -->
    <div class="cf-content">
      <!-- OVERVIEW Tab -->
      <CyberDashboardHub
        v-if="activeSection === 'overview'"
        @navigate="handleNavigate"
        @open-character="characterDrawerOpen = true"
      />

      <!-- MISSIONS Tab -->
      <CyberMissionBriefing v-else-if="activeSection === 'missions'" />

      <!-- BOSS Tab -->
      <CyberBossFight v-else-if="activeSection === 'boss'" />

      <!-- UPGRADES Tab (Skill Tree) -->
      <CyberSkillTree v-else-if="activeSection === 'upgrades'" />

      <!-- ACHIEVEMENTS Tab -->
      <CyberAchievements v-else-if="activeSection === 'achievements'" show-all />
    </div>

    <!-- Character Drawer (overlay, not a tab) -->
    <CyberCharacterDrawer
      :open="characterDrawerOpen"
      @close="characterDrawerOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useCyberflowTheme } from '@/composables/useCyberflowTheme'
import CyberSectionNav from '@/components/gamification/cyber/CyberSectionNav.vue'
import CyberDashboardHub from '@/components/gamification/cyber/CyberDashboardHub.vue'
import CyberMissionBriefing from '@/components/gamification/cyber/CyberMissionBriefing.vue'
import CyberBossFight from '@/components/gamification/cyber/CyberBossFight.vue'
import CyberSkillTree from '@/components/gamification/cyber/CyberSkillTree.vue'
import CyberAchievements from '@/components/gamification/cyber/CyberAchievements.vue'
import CyberCharacterDrawer from '@/components/gamification/cyber/CyberCharacterDrawer.vue'


const { cyberflowClasses } = useCyberflowTheme()

type SectionId = 'overview' | 'missions' | 'boss' | 'upgrades' | 'achievements'

// Active section tab state
const activeSection = ref<SectionId>('overview')

// Character drawer state
const characterDrawerOpen = ref(false)

// Handle navigation from dashboard cards
function handleNavigate(section: 'missions' | 'boss' | 'upgrades' | 'achievements') {
  activeSection.value = section
}
</script>

<style scoped>
/* =============================================================================
   CYBERFLOW VIEW - CYBERPUNK COMMAND CENTER
   Hub-and-spoke tab-based layout
   ============================================================================= */

.cyberflow-view {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: var(--space-3) var(--space-4);
  background: var(--app-background-gradient);
  color: rgb(var(--color-slate-100));
}

/* =============================================================================
   COMPACT HEADER
   ============================================================================= */

.cf-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
  flex-shrink: 0;
}

.cf-header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.cf-title-text {
  font-family: 'Orbitron', 'Rajdhani', sans-serif;
  font-size: var(--text-xl);
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--neon-cyan));
  text-shadow: var(--neon-glow-cyan);
  padding: var(--space-1) var(--space-3);
  background: rgba(var(--color-slate-900), 0.8);
  border: 1px solid rgba(var(--neon-cyan), 0.4);
  --aug-tl1: 8px;
  --aug-br1: 8px;
  --aug-border-all: 1px;
  --aug-border-bg: rgba(var(--neon-cyan), 0.5);
}

.cf-status {
  font-family: 'Share Tech Mono', 'Courier New', monospace;
  font-size: var(--text-xs);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(var(--neon-lime), 0.7);
}

/* =============================================================================
   CONTENT AREA
   ============================================================================= */

.cf-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  padding-top: var(--space-3);
  scrollbar-width: thin;
  scrollbar-color: var(--cf-cyan-20) transparent;
}

/* Section wrapper for tabs with multiple sub-components */
.cf-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* =============================================================================
   RESPONSIVE
   ============================================================================= */

@media (max-width: 768px) {
  .cyberflow-view {
    padding: var(--space-4);
  }

  .cf-title-text {
    font-size: var(--text-base);
  }

  .cf-status {
    display: none;
  }

  .cf-content {
    padding-top: var(--space-4);
  }
}

/* =============================================================================
   REDUCED MOTION SUPPORT
   ============================================================================= */

@media (prefers-reduced-motion: reduce) {
  /* No animations in compact header */
}
</style>
