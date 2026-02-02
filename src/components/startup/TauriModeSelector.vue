<script setup lang="ts">
/**
 * TauriModeSelector
 *
 * Allows user to choose between Cloud Mode (VPS) and Local Mode (Docker).
 */

defineEmits<{
  select: [mode: 'cloud' | 'local']
}>()
</script>

<template>
  <div class="mode-selector-screen">
    <div class="mode-content">
      <div class="header">
        <h1 class="title">
          Select Operation Mode
        </h1>
        <p class="subtitle">
          How would you like to run FlowState?
        </p>
      </div>

      <div class="modes-container">
        <!-- Cloud Mode -->
        <button class="mode-card" @click="$emit('select', 'cloud')">
          <div class="mode-icon">
            ☁️
          </div>
          <div class="mode-info">
            <h3>Cloud Mode</h3>
            <p>Connect to remote server (VPS)</p>
          </div>
          <div class="mode-badge">
            Recommended
          </div>
        </button>

        <!-- Local Mode -->
        <button class="mode-card" @click="$emit('select', 'local')">
          <div class="mode-icon">
            🐳
          </div>
          <div class="mode-info">
            <h3>Local Mode</h3>
            <p>Run locally with Docker</p>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mode-selector-screen {
  position: fixed;
  inset: 0;
  z-index: 10000;
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
  gap: var(--space-8, 32px);
  padding: var(--space-8, 32px);
  max-width: 600px;
  width: 100%;
}

.header {
  text-align: center;
}

.title {
  font-size: var(--text-2xl, 24px);
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0 0 var(--space-2, 8px);
}

.subtitle {
  font-size: var(--text-base, 16px);
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  margin: 0;
}

.modes-container {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4, 16px);
  width: 100%;
}

@media (min-width: 640px) {
  .modes-container {
    grid-template-columns: 1fr 1fr;
  }
}

.mode-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-4, 16px);
  padding: var(--space-6, 24px);
  background: var(--glass-bg-heavy, rgba(255, 255, 255, 0.06));
  border: var(--overlay-component-border, 1px solid rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-xl, 20px);
  cursor: pointer;
  transition: all var(--duration-normal, 200ms) var(--ease-out, ease-out);
  position: relative;
  overflow: hidden;
}

.mode-card:hover {
  background: var(--glass-bg-medium, rgba(255, 255, 255, 0.08));
  transform: translateY(-4px);
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.3);
  border-color: rgba(255, 255, 255, 0.2);
}

.mode-icon {
  font-size: 48px;
}

.mode-info h3 {
  font-size: var(--text-lg, 18px);
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0 0 var(--space-1, 4px);
}

.mode-info p {
  font-size: var(--text-sm, 14px);
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  margin: 0;
}

.mode-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  background: linear-gradient(135deg, #ef4444, #f97316);
  color: white;
  font-size: 10px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
