<template>
  <div class="user-profile-wrapper" ref="wrapperRef">
    <div class="user-profile" ref="profileRef">
      <div class="avatar-circle">
        <img
          v-if="authStore.user?.photoURL"
          :src="authStore.user.photoURL"
          alt="User avatar"
          class="avatar-image"
          crossorigin="anonymous"
          referrerpolicy="no-referrer"
        />
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
              <div class="user-name">{{ displayName }}</div>
              <div class="user-email">{{ authStore.user?.email }}</div>
            </div>
          </div>

          <!-- Divider -->
          <div class="dropdown-divider"></div>

          <!-- Menu Items -->
          <button
            class="dropdown-item"
            @click="handleSettings"
            role="menuitem"
          >
            <Settings :size="16" />
            <span>Settings</span>
          </button>

          <button
            class="dropdown-item"
            @click="handleSignOut"
            role="menuitem"
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
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
  return authStore.user?.displayName || authStore.user?.email?.split('@')[0] || 'User'
})

const dropdownStyle = computed(() => {
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
  console.log('🔵🔵🔵 CLICK DETECTED on UserProfile! 🔵🔵🔵')
  console.log('Event:', event)
  console.log('Target:', event?.target)
  console.log('Current dropdown state:', isDropdownOpen.value)

  if (event) {
    event.stopPropagation()
    event.preventDefault()
  }

  isDropdownOpen.value = !isDropdownOpen.value

  console.log('New dropdown state:', isDropdownOpen.value)
}

const closeDropdown = () => {
  if (isDropdownOpen.value) {
    console.log('Closing dropdown')
    isDropdownOpen.value = false
  }
}

const handleSettings = () => {
  console.log('⚙️ Settings clicked')
  closeDropdown()
  uiStore.openSettingsModal()
}

const handleSignOut = async () => {
  console.log('🔴 Sign out clicked from user profile')
  closeDropdown()

  try {
    await authStore.signOut()
    console.log('✅ Signed out successfully')
  } catch (error) {
    console.error('❌ Sign out error:', error)
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
  console.log('🔵 UserProfile component mounted')
  console.log('  📊 Auth state:')
  console.log('    • isAuthenticated:', authStore.isAuthenticated)
  console.log('    • user email:', authStore.user?.email)
  console.log('    • user displayName:', authStore.user?.displayName)
  console.log('    • user photoURL:', authStore.user?.photoURL)

  // NUCLEAR OPTION: Direct DOM event listener with capture phase
  // Using ONLY pointerdown to prevent double-toggle (pointerdown + click both firing)
  if (profileRef.value) {
    console.log('🔧 Attaching DIRECT DOM event listener to avatar')

    // Use ONLY pointer events - handles mouse, touch, and pen input
    // This prevents the double-toggle issue where both pointerdown and click fire
    pointerHandler = (e: Event) => {
      console.log('💥 POINTER HANDLER FIRED!')
      toggleDropdown(e)
    }
    profileRef.value.addEventListener('pointerdown', pointerHandler, { capture: true })

    console.log('✅ Event listener attached successfully')
  } else {
    console.error('❌ profileRef is null - cannot attach event listeners!')
  }

  // Click outside to close
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  console.log('🔴 UserProfile component unmounting - cleaning up event listener')

  if (profileRef.value && pointerHandler) {
    profileRef.value.removeEventListener('pointerdown', pointerHandler, { capture: true } as any)
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
  transition: all 0.2s ease;
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

/* Dropdown Menu - Glass Morphism - Teleported to body */
.user-dropdown {
  position: fixed;  /* Fixed positioning since it's teleported to body */
  /* Position is set dynamically via :style binding */
  width: 240px;  /* Fixed width */
  max-width: 240px;  /* Prevent expansion */
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  border: 1px solid var(--glass-border-hover);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl), 0 8px 32px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  z-index: 99999;  /* Extremely high to ensure it's above all UI elements */
  overflow: hidden;
  pointer-events: auto !important;
}

/* Dropdown Header */
.dropdown-header {
  padding: var(--space-4);
  background: linear-gradient(
    135deg,
    var(--glass-bg-heavy) 0%,
    var(--glass-bg-tint) 100%
  );
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
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    var(--glass-border) 50%,
    rgba(255, 255, 255, 0) 100%
  );
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
