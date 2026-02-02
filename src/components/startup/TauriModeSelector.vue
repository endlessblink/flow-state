<script setup lang="ts">
/**
 * TauriModeSelector
 *
 * Allows users to choose between Cloud Mode (VPS) and Local Mode (Docker/Supabase).
 * Cloud Mode is the default for easy first-time experience.
 */

import { ref, onMounted } from 'vue'

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
          <span class="logo-icon">🍅</span>
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
            <div class="mode-icon">☁️</div>
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
            <div class="mode-icon">🖥️</div>
            <div class="mode-info">
              <h3 class="mode-name">Local Mode</h3>
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
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--overlay-component-bg, rgba(28, 25, 45, 0.98));
  backdrop-filter: var(--overlay-component-backdrop, blur(20px));
}

.mode-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-6, 24px);
  padding: var(--space-8, 32px);
  max-width: 600px;
  width: 90%;
}

.logo-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3, 12px);
}

.logo {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg-heavy, rgba(255, 255, 255, 0.06));
  border: var(--overlay-component-border, 1px solid rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-xl, 20px);
}

.logo-icon {
  font-size: 40px;
}

.app-name {
  font-size: var(--text-2xl, 24px);
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
}

.mode-title {
  font-size: var(--text-xl, 20px);
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: var(--space-4, 16px) 0 0;
}

.mode-description {
  font-size: var(--text-sm, 14px);
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  margin: 0;
}

.mode-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-4, 16px);
  width: 100%;
}

.mode-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
  padding: var(--space-4, 16px);
  background: var(--glass-bg-heavy, rgba(255, 255, 255, 0.06));
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-lg, 16px);
  cursor: pointer;
  transition: all var(--duration-fast, 150ms) var(--ease-out, ease-out);
}

.mode-card:hover {
  border-color: rgba(255, 255, 255, 0.2);
  background: var(--glass-bg-medium, rgba(255, 255, 255, 0.08));
}

.mode-card.selected {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.1);
}

.mode-card-header {
  display: flex;
  gap: var(--space-3, 12px);
  align-items: flex-start;
}

.mode-icon {
  font-size: 32px;
  line-height: 1;
}

.mode-info {
  flex: 1;
}

.mode-name {
  font-size: var(--text-base, 16px);
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0 0 var(--space-1, 4px);
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
}

.mode-badge {
  font-size: var(--text-xs, 12px);
  font-weight: 500;
  color: #10b981;
  background: rgba(16, 185, 129, 0.2);
  padding: 2px 8px;
  border-radius: var(--radius-full, 9999px);
}

.mode-subtitle {
  font-size: var(--text-sm, 14px);
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  margin: 0;
}

.mode-features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.mode-features li {
  font-size: var(--text-sm, 14px);
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  padding-left: var(--space-1, 4px);
}

.btn-continue {
  width: 100%;
  padding: var(--space-3, 12px) var(--space-6, 24px);
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  border: none;
  border-radius: var(--radius-md, 8px);
  font-size: var(--text-base, 16px);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--duration-fast, 150ms) var(--ease-out, ease-out);
}

.btn-continue:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.mode-help {
  font-size: var(--text-xs, 12px);
  color: var(--text-muted, rgba(255, 255, 255, 0.5));
  margin: 0;
  text-align: center;
}
</style>
