<template>
  <div class="design-system-app" :class="{ 'dark-theme': isDark }">
    <!-- Sidebar Navigation -->
    <nav class="sidebar">
      <div class="sidebar-header">
        <h1 class="logo">🍅 Design System</h1>
        <button @click="toggleTheme" class="theme-toggle" :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'">
          {{ isDark ? '☀️' : '🌙' }}
        </button>
      </div>

      <div class="nav-links">
        <router-link to="/tokens" class="nav-link">
          <span class="nav-icon">🎨</span>
          <span>Design Tokens</span>
        </router-link>
        <router-link to="/icons" class="nav-link">
          <span class="nav-icon">✨</span>
          <span>Icons</span>
        </router-link>
        <router-link to="/base" class="nav-link">
          <span class="nav-icon">🔘</span>
          <span>Base Components</span>
        </router-link>
        <router-link to="/ui" class="nav-link">
          <span class="nav-icon">🖥️</span>
          <span>UI Components</span>
        </router-link>
        <router-link to="/board" class="nav-link">
          <span class="nav-icon">📋</span>
          <span>Board Components</span>
        </router-link>
        <router-link to="/calendar" class="nav-link">
          <span class="nav-icon">📅</span>
          <span>Calendar Components</span>
        </router-link>
        <router-link to="/canvas" class="nav-link">
          <span class="nav-icon">🎯</span>
          <span>Canvas Components</span>
        </router-link>
        <router-link to="/modals" class="nav-link">
          <span class="nav-icon">🪟</span>
          <span>Modals</span>
        </router-link>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const isDark = ref(true)

const toggleTheme = () => {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark-theme', isDark.value)
  document.documentElement.classList.toggle('light-theme', !isDark.value)
}
</script>

<style scoped>
.design-system-app {
  display: flex;
  height: 100vh;
  background: var(--surface-primary);
  color: var(--text-primary);
  overflow: hidden;
  transition: background var(--duration-normal);
}

.sidebar {
  width: 280px;
  background: var(--surface-secondary);
  border-right: 1px solid var(--border-primary);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  transition: background var(--duration-normal);
}

.sidebar-header {
  padding: var(--space-6);
  border-bottom: 1px solid var(--border-primary);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0;
}

.theme-toggle {
  background: var(--surface-tertiary);
  border: 1px solid var(--border-medium);
  color: var(--text-primary);
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast);
}

.theme-toggle:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  transform: scale(1.05);
}

.nav-links {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.nav-link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--text-secondary);
  font-weight: var(--font-medium);
  transition: all var(--duration-fast);
  border: 1px solid transparent;
}

.nav-link:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  color: var(--text-primary);
}

.nav-link.router-link-active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  color: var(--brand-primary);
  box-shadow: var(--state-hover-glow);
}

.nav-icon {
  font-size: 1.25rem;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-8);
  background: var(--surface-primary);
  transition: background var(--duration-normal);
}
</style>
