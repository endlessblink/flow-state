<template>
  <nav class="mobile-nav">
    <router-link to="/tasks" class="nav-item" active-class="active">
      <InboxIcon />
      <span>Inbox</span>
    </router-link>

    <router-link to="/mobile-quick-sort" class="nav-item" active-class="active">
      <Zap />
      <span>Sort</span>
    </router-link>

    <router-link to="/timer" class="nav-item" active-class="active">
      <TimerIcon />
      <span>Timer</span>
    </router-link>

    <router-link to="/today" class="nav-item" active-class="active">
      <CalendarCheck />
      <span>Today</span>
    </router-link>

    <div class="nav-item" @click="toggleMenu">
      <MenuIcon />
      <span>Menu</span>
    </div>

    <!-- Mobile Menu Overlay -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showMenu" class="mobile-menu-overlay" @click="closeMenu">
          <div class="mobile-menu-content" @click.stop>
            <div class="menu-header">
              <h3>Menu</h3>
              <button class="close-btn" @click="closeMenu">
                <X :size="20" />
              </button>
            </div>
            
            <div class="menu-items">
              <!-- Auth Actions -->
              <div v-if="!authStore.isAuthenticated" class="menu-item" @click="handleSignIn">
                <LogIn :size="20" />
                <span>Sign In</span>
              </div>
              <div v-else class="menu-item" @click="handleSignOut">
                <LogOut :size="20" />
                <span>Sign Out ({{ authStore.user?.email }})</span>
              </div>

              <!-- Other Actions -->
              <div class="menu-item" @click="handleSettings">
                <Settings :size="20" />
                <span>Settings</span>
              </div>

              <!-- Clear Cache -->
              <div class="menu-item danger" @click="handleClearCache">
                <RefreshCw :size="20" />
                <span>Clear Cache & Reload</span>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </nav>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Inbox as InboxIcon, CalendarCheck, Menu as MenuIcon, LogIn, LogOut, Settings, X, Timer as TimerIcon, Zap, RefreshCw } from 'lucide-vue-next'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'

const uiStore = useUIStore()
const authStore = useAuthStore()

const showMenu = ref(false)

const toggleMenu = () => {
  showMenu.value = !showMenu.value
}

const closeMenu = () => {
  showMenu.value = false
}

const handleSignIn = () => {
  closeMenu()
  uiStore.openAuthModal('login')
}

const handleSignOut = async () => {
  closeMenu()
  await authStore.signOut()
}

const handleSettings = () => {
  closeMenu()
  uiStore.openSettingsModal()
}

const handleClearCache = async () => {
  closeMenu()

  try {
    // Clear all caches (but keep SW running so page doesn't die)
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(name => caches.delete(name)))
      console.log('[Cache] Cleared', cacheNames.length, 'caches')
    }

    // Tell SW to skip waiting and activate new version if available
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' })
    }

    // Small delay to let cache clearing complete
    await new Promise(resolve => setTimeout(resolve, 200))

    // Reload - the SW will fetch fresh from network
    window.location.reload()
  } catch (error) {
    console.error('Failed to clear cache:', error)
    window.location.reload()
  }
}
</script>

<style scoped>
.mobile-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: var(--space-16);
  background: var(--surface-primary);
  border-top: 1px solid var(--border-subtle);
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 1000;
  box-shadow: 0 -4px var(--space-5) rgba(0,0,0,0.1);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 100%;
  color: var(--text-tertiary);
  text-decoration: none;
  font-size: var(--text-xs);
  gap: var(--space-1);
  transition: color var(--duration-normal) ease;
  cursor: pointer;
}

.nav-item.active {
  color: var(--brand-primary);
}

.nav-item :deep(svg) {
  width: var(--space-6);
  height: var(--space-6);
  stroke-width: 2px;
}

/* Menu Overlay */
.mobile-menu-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  z-index: 2000;
  display: flex;
  justify-content: flex-end;
  align-items: flex-end;
}

.mobile-menu-content {
  background: var(--surface-primary);
  width: 100%;
  border-top-left-radius: var(--radius-xl);
  border-top-right-radius: var(--radius-xl);
  padding: var(--space-5);
  box-shadow: 0 -4px var(--space-5) rgba(0,0,0,0.2);
  animation: slideUp var(--duration-slow) cubic-bezier(0.16, 1, 0.3, 1);
  padding-bottom: calc(var(--space-5) + env(safe-area-inset-bottom));
}

.menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-6);
}

.menu-header h3 {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-1);
}

.menu-items {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--surface-secondary);
  border-radius: var(--radius-lg);
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  transition: background var(--duration-normal);
}

.menu-item:active {
  background: var(--surface-tertiary);
}

.menu-item.danger {
  color: var(--color-warning);
}

.menu-item.danger svg {
  color: var(--color-warning);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-slow) ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

/* RTL Support */
[dir="rtl"] .menu-item {
  flex-direction: row-reverse;
}

[dir="rtl"] .menu-header {
  flex-direction: row-reverse;
}
</style>
