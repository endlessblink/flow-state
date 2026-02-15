<script setup lang="ts">
/**
 * TauriModeSelector
 *
 * Allows users to choose between Cloud Mode (VPS) and Local Mode (Docker/Supabase).
 * Cloud Mode is the default for easy first-time experience.
 */

import { ref, onMounted } from 'vue'
import AppLogo from '@/components/base/AppLogo.vue'

const emit = defineEmits<{
  select: [mode: 'cloud' | 'local']
}>()

const selectedMode = ref<'cloud' | 'local'>('cloud')

onMounted(() => {
  // Default to Cloud Mode for "just works" experience
  selectedMode.value = 'cloud'
})

function selectMode(mode: 'cloud' | 'local') {
  selectedMode.value = mode
}

function confirm() {
  // Save preference to localStorage
  localStorage.setItem('flowstate-tauri-mode', selectedMode.value)
  emit('select', selectedMode.value)
}
</script>

<template>
  <div class="mode-selector">
    <div class="mode-content">
      <!-- Logo -->
      <div class="logo-container">
        <div class="logo">
          <AppLogo size="xl" />
        </div>
        <h1 class="app-name">
          FlowState
        </h1>
      </div>

      <!-- Title -->
      <h2 class="mode-title">
        Choose Your Setup
      </h2>
      <p class="mode-description">
        Select how you want to connect to your data
      </p>

      <!-- Mode Cards -->
      <div class="mode-cards">
        <!-- Cloud Mode (Recommended) -->
        <div
          class="mode-card"
          :class="{ selected: selectedMode === 'cloud' }"
          @click="selectMode('cloud')"
        >
          <div class="mode-card-header">
            <div class="mode-icon">
              ☁️
            </div>
            <div class="mode-info">
              <h3 class="mode-name">
                Cloud Mode
                <span class="mode-badge">Recommended</span>
              </h3>
              <p class="mode-subtitle">
                Connect to in-theflow.com
              </p>
            </div>
          </div>
          <ul class="mode-features">
            <li>✓ Works immediately</li>
            <li>✓ No setup required</li>
            <li>✓ Sync across devices</li>
            <li>✓ Automatic backups</li>
          </ul>
        </div>

        <!-- Local Mode -->
        <div
          class="mode-card"
          :class="{ selected: selectedMode === 'local' }"
          @click="selectMode('local')"
        >
          <div class="mode-card-header">
            <div class="mode-icon">
              🖥️
            </div>
            <div class="mode-info">
              <h3 class="mode-name">
                Local Mode
              </h3>
              <p class="mode-subtitle">
                Run your own database
              </p>
            </div>
          </div>
          <ul class="mode-features">
            <li>✓ Full data control</li>
            <li>✓ Works offline</li>
            <li>⚠️ Requires Docker</li>
            <li>⚠️ Manual setup</li>
          </ul>
        </div>
      </div>

      <!-- Continue Button -->
      <button class="btn-continue" @click="confirm">
        Continue with {{ selectedMode === 'cloud' ? 'Cloud' : 'Local' }} Mode
      </button>

      <!-- Help Text -->
      <p class="mode-help">
        You can change this later in Settings > Storage
      </p>
    </div>
  </div>
</template>

<style scoped>
.mode-selector {
  position: fixed;
  inset: 0;
  z-index: var(--z-tooltip);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--overlay-component-bg);
  backdrop-filter: var(--overlay-component-backdrop);
}

.mode-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-8);
  max-width: 600px;
  width: 90%;
}

.logo-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.logo {
  width: var(--space-20);
  height: var(--space-20);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg-heavy);
  border: var(--overlay-component-border);
  border-radius: var(--radius-xl);
}

.logo-icon {
  font-size: var(--space-10);
}

.app-name {
  font-size: var(--text-2xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.mode-title {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: var(--space-4) 0 0;
}

.mode-description {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.mode-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-4);
  width: 100%;
}

.mode-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--glass-bg-heavy);
  border: var(--space-0_5) solid var(--glass-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.mode-card:hover {
  border-color: var(--border-hover);
  background: var(--glass-bg-medium);
}

.mode-card.selected {
  border-color: var(--color-success);
  background: var(--success-bg-subtle);
}

.mode-card-header {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
}

.mode-icon {
  font-size: var(--space-8);
  line-height: 1;
}

.mode-info {
  flex: 1;
}

.mode-name {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--space-1);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.mode-badge {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--color-success);
  background: var(--success-bg-subtle);
  padding: var(--space-0_5) var(--space-2);
  border-radius: var(--radius-full);
}

.mode-subtitle {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.mode-features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.mode-features li {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  padding-left: var(--space-1);
}

.btn-continue {
  width: 100%;
  padding: var(--space-3) var(--space-6);
  background: linear-gradient(135deg, var(--color-success), var(--color-success-dark));
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.btn-continue:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.mode-help {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: 0;
  text-align: center;
}
</style>
