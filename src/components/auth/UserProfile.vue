<template>
  <div ref="wrapperRef" class="user-profile-wrapper">
    <div ref="profileRef" class="user-profile">
      <div class="avatar-circle">
        <img
          v-if="authStore.photoURL"
          :src="authStore.photoURL"
          alt="User avatar"
          class="avatar-image"
          crossorigin="anonymous"
          referrerpolicy="no-referrer"
        >
        <span v-else class="avatar-initial">
          {{ userInitial }}
        </span>
      </div>
    </div>

    <!-- Dropdown Menu - Teleported to body to escape overflow constraints -->
    <Teleport to="body">
      <Transition name="dropdown">
        <div
          v-if="isDropdownOpen"
          class="user-dropdown"
          role="menu"
          :style="dropdownStyle"
        >
          <!-- User Info -->
          <div class="dropdown-header">
            <div class="user-info">
              <div class="user-name">
                {{ displayName }}
              </div>
              <div class="user-email">
                {{ authStore.user?.email }}
              </div>
            </div>
          </div>

          <!-- Divider -->
          <div class="dropdown-divider" />

          <!-- Menu Items -->
          <button
            class="dropdown-item"
            role="menuitem"
            @click="handleSettings"
          >
            <Settings :size="16" />
            <span>Settings</span>
          </button>

          <button
            class="dropdown-item"
            role="menuitem"
            @click="handleSignOut"
          >
            <LogOut :size="16" />
            <span>Sign Out</span>
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, type CSSProperties } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { Settings, LogOut } from 'lucide-vue-next'

// ===== Stores =====
const authStore = useAuthStore()
const uiStore = useUIStore()

// ===== State =====
const isDropdownOpen = ref(false)
const wrapperRef = ref<HTMLElement | null>(null)
const profileRef = ref<HTMLElement | null>(null)

// ===== Computed =====
const userInitial = computed(() => {
  const email = authStore.user?.email || ''
  return email.charAt(0).toUpperCase()
})

const displayName = computed(() => {
  return authStore.displayName
})

const dropdownStyle = computed((): CSSProperties => {
  if (!wrapperRef.value) return {}

  const rect = wrapperRef.value.getBoundingClientRect()
  return {
    position: 'fixed',
    top: `${rect.bottom + 12}px`,
    left: `${rect.left}px`
  }
})

// ===== Methods =====
const toggleDropdown = (event?: Event) => {
  if (import.meta.env.DEV) {
    console.log('[AUTH:UI] Dropdown toggle clicked, current state:', isDropdownOpen.value)
  }

  if (event) {
    event.stopPropagation()
    event.preventDefault()
  }

  isDropdownOpen.value = !isDropdownOpen.value
}

const closeDropdown = () => {
  if (isDropdownOpen.value) {
    if (import.meta.env.DEV) {
      console.log('[AUTH:UI] Closing dropdown')
    }
    isDropdownOpen.value = false
  }
}

const handleSettings = () => {
  if (import.meta.env.DEV) {
    console.log('[AUTH:UI] Settings clicked')
  }
  closeDropdown()
  uiStore.openSettingsModal()
}

const handleSignOut = async () => {
  if (import.meta.env.DEV) {
    console.log('[AUTH:UI] Sign out clicked')
  }
  closeDropdown()

  try {
    await authStore.signOut()
    if (import.meta.env.DEV) {
      console.log('[AUTH:UI] Signed out successfully')
    }
  } catch (error) {
    console.error('[AUTH:UI] Sign out error:', error)
  }
}

// ===== Click Outside Handler =====
const handleClickOutside = (event: MouseEvent) => {
  if (wrapperRef.value && !wrapperRef.value.contains(event.target as Node)) {
    closeDropdown()
  }
}

// ===== Direct DOM Event Binding =====
let pointerHandler: ((e: Event) => void) | null = null

onMounted(() => {
  if (import.meta.env.DEV) {
    console.log('[AUTH:UI] UserProfile mounted, isAuthenticated:', authStore.isAuthenticated)
  }

  // NUCLEAR OPTION: Direct DOM event listener with capture phase
  // Using ONLY pointerdown to prevent double-toggle (pointerdown + click both firing)
  if (profileRef.value) {
    // Use ONLY pointer events - handles mouse, touch, and pen input
    // This prevents the double-toggle issue where both pointerdown and click fire
    pointerHandler = (e: Event) => {
      toggleDropdown(e)
    }
    profileRef.value.addEventListener('pointerdown', pointerHandler, { capture: true })
  } else {
    console.error('[AUTH:UI] profileRef is null - cannot attach event listeners!')
  }

  // Click outside to close
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  if (profileRef.value && pointerHandler) {
    profileRef.value.removeEventListener('pointerdown', pointerHandler, { capture: true })
  }

  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
/* Wrapper - Create new stacking context */
.user-profile-wrapper {
  position: relative;
  isolation: isolate;
  z-index: 9999 !important; /* NUCLEAR OPTION: Extremely high z-index */
  pointer-events: auto !important;
}

/* Profile container */
.user-profile {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer !important;
  pointer-events: auto !important;
  z-index: 10000 !important;

  /* Make it very obvious this is clickable */
  transition: all var(--duration-normal) var(--ease-out);
}

.user-profile:hover {
  transform: scale(1.1);
}

.user-profile:active {
  transform: scale(0.95);
}

/* Avatar */
.avatar-circle {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--brand-primary) 0%, var(--purple-bg-end) 100%);
  box-shadow: var(--shadow-md), inset 0 0 0 2px var(--glass-border);  /* Use inset shadow for border */
  cursor: pointer !important;
  pointer-events: auto !important;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.user-profile:hover .avatar-circle {
  border-color: var(--brand-primary);
  box-shadow: var(--shadow-lg), 0 0 20px var(--purple-bg-subtle);
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none; /* Let clicks pass through to parent */
}

.avatar-initial {
  font-size: var(--text-base);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  user-select: none;
  pointer-events: none; /* Let clicks pass through to parent */
}

/* Dropdown Menu - Standardized overlay styling */
.user-dropdown {
  position: fixed;  /* Fixed positioning since it's teleported to body */
  /* Position is set dynamically via :style binding */
  width: 240px;  /* Fixed width */
  max-width: 240px;  /* Prevent expansion */
  background: var(--overlay-component-bg);
  backdrop-filter: var(--overlay-component-backdrop);
  -webkit-backdrop-filter: var(--overlay-component-backdrop);
  border: var(--overlay-component-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--overlay-component-shadow);
  z-index: 99999;  /* Extremely high to ensure it's above all UI elements */
  overflow: hidden;
  pointer-events: auto !important;
}

/* Dropdown Header */
.dropdown-header {
  padding: var(--space-4);
  background: var(--glass-bg-heavy);
  border-bottom: 1px solid var(--glass-border);
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.user-name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: var(--text-xs);
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Divider */
.dropdown-divider {
  height: 1px;
  background: var(--glass-border);
  margin: 0;
}

/* Dropdown Items */
.dropdown-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  text-align: left;
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.dropdown-item:hover {
  background: var(--state-hover-bg);
  color: var(--text-primary);
}

.dropdown-item:active {
  background: var(--state-active-bg);
  transform: scale(0.98);
}

.dropdown-item svg {
  flex-shrink: 0;
  color: var(--text-muted);
  transition: color var(--duration-fast) ease;
}

.dropdown-item:hover svg {
  color: var(--text-secondary);
}

/* Dropdown Transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity var(--duration-fast) ease,
              transform var(--duration-fast) var(--spring-smooth);
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

/* Responsive */
@media (max-width: 640px) {
  .avatar-circle {
    width: 36px;
    height: 36px;
  }

  .avatar-initial {
    font-size: var(--text-sm);
  }

  .user-dropdown {
    min-width: 200px;
  }
}
</style>
