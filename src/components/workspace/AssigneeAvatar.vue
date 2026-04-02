<template>
  <div
    class="assignee-avatar"
    :class="{ 'has-tooltip': showTooltip && tooltipText }"
    :style="containerStyle"
    :aria-label="tooltipText"
    role="img"
  >
    <!-- Avatar image -->
    <img
      v-if="member?.avatarUrl"
      :src="member.avatarUrl"
      :alt="tooltipText"
      class="avatar-image"
      @error="onImageError"
    />

    <!-- Initials fallback -->
    <span
      v-else-if="member"
      class="avatar-initials"
      :style="initialsStyle"
      aria-hidden="true"
    >
      {{ initials }}
    </span>

    <!-- Unknown member fallback: generic user icon -->
    <span
      v-else
      class="avatar-fallback"
      aria-hidden="true"
    >
      <User :size="iconSize" />
    </span>

    <!-- TASK-1559: Online presence indicator -->
    <span
      v-if="presenceStatus !== 'offline'"
      class="presence-dot"
      :class="presenceStatus"
      :aria-label="presenceStatus === 'online' ? 'Online' : 'Idle'"
    />

    <!-- Tooltip -->
    <span
      v-if="showTooltip && tooltipText"
      class="avatar-tooltip"
      role="tooltip"
    >
      {{ tooltipText }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { User } from 'lucide-vue-next'
import { useWorkspaceStore } from '@/stores/workspace'
import { useWorkspacePresence } from '@/composables/workspace/useWorkspacePresence'
import type { PresenceStatus } from '@/types/workspace'

const props = withDefaults(defineProps<{
  userId: string
  size?: number
  showTooltip?: boolean
}>(), {
  size: 20,
  showTooltip: true,
})

const workspaceStore = useWorkspaceStore()

// Track image load errors so we fall back to initials
const imageError = ref(false)
function onImageError() {
  imageError.value = true
}

// Find the member across all loaded workspace member lists, or from activeMembers
const member = computed(() => {
  // First try activeMembers (most common path)
  const fromActive = workspaceStore.activeMembers.find(m => m.userId === props.userId)
  if (fromActive) return fromActive

  // Fallback: scan all workspace member lists
  for (const memberList of workspaceStore.members.values()) {
    const found = memberList.find(m => m.userId === props.userId)
    if (found) return found
  }

  return null
})

// Display name with email fallback
const displayName = computed(() => {
  if (!member.value) return ''
  return member.value.displayName || member.value.email || ''
})

const tooltipText = computed(() => displayName.value || props.userId)

// Derive 1-2 letter initials from displayName
const initials = computed(() => {
  const name = displayName.value
  if (!name) return '?'

  const trimmed = name.trim()
  const atIdx = trimmed.indexOf('@')

  // Email address: use first 2 chars before the @
  if (atIdx > 0) {
    return trimmed.slice(0, Math.min(2, atIdx)).toUpperCase()
  }

  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return trimmed.slice(0, 2).toUpperCase()
})

// Deterministic color index from userId
// Maps userId string to one of 8 palette slots (0-7)
function hashUserId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0
  }
  return h % 8
}

// 8-slot muted palette — all expressed as CSS custom properties or
// composites that stay legible on glass morphism cards.
// Colors use opacity to keep them subtle on dark surfaces.
const AVATAR_PALETTE: Array<{ bg: string; text: string }> = [
  // teal (brand)
  { bg: 'rgba(78, 205, 196, 0.18)', text: 'var(--brand-primary)' },
  // blue
  { bg: 'var(--blue-bg-subtle)', text: 'var(--color-info)' },
  // amber / in-progress
  { bg: 'var(--status-in-progress-bg)', text: 'var(--status-in-progress-text)' },
  // green / done
  { bg: 'var(--status-done-bg)', text: 'var(--status-done-text)' },
  // purple
  { bg: 'var(--purple-bg-subtle)', text: 'hsl(260, 60%, 75%)' },
  // orange
  { bg: 'var(--orange-bg-subtle)', text: 'var(--status-on-hold-text)' },
  // planned blue
  { bg: 'var(--status-planned-bg)', text: 'var(--status-planned-text)' },
  // backlog gray
  { bg: 'var(--status-backlog-bg)', text: 'var(--status-backlog-text)' },
]

const paletteEntry = computed(() => AVATAR_PALETTE[hashUserId(props.userId)])

// Container sizing + shape
const containerStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  minWidth: `${props.size}px`,
  fontSize: `${Math.max(8, Math.round(props.size * 0.42))}px`,
}))

// Initials background derived from palette
const initialsStyle = computed(() => ({
  background: paletteEntry.value.bg,
  color: paletteEntry.value.text,
  border: `1px solid ${paletteEntry.value.text}`,
  opacity: imageError.value ? '1' : undefined,
}))

// Lucide icon size — slightly smaller than the container
const iconSize = computed(() => Math.max(10, Math.round(props.size * 0.6)))

// TASK-1559: Online presence indicator
const { getUserPresenceStatus } = useWorkspacePresence()
const presenceStatus = computed<PresenceStatus>(() => getUserPresenceStatus(props.userId))
</script>

<style scoped>
.assignee-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  overflow: visible; /* tooltip needs to escape */
  flex-shrink: 0;
  cursor: default;
  user-select: none;
}

/* ---- Avatar image ---- */
.avatar-image {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-full);
  object-fit: cover;
  border: 1px solid var(--glass-border);
  display: block;
}

/* ---- Initials pill ---- */
.avatar-initials {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1;
  /* font-size is set inline via containerStyle */
  backdrop-filter: blur(4px);
  transition: opacity var(--duration-fast, 150ms) ease-out;
}

/* ---- Generic user icon fallback ---- */
.avatar-fallback {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
}

/* ---- Tooltip ---- */
.avatar-tooltip {
  /* Hidden by default */
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  padding: 3px var(--space-2, 8px);
  background: var(--surface-secondary);
  color: var(--text-primary);
  font-size: var(--text-xs, 11px);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  box-shadow: var(--overlay-component-shadow, 0 4px 12px rgba(0,0,0,0.4));
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity var(--duration-fast, 150ms) ease-out,
    visibility var(--duration-fast, 150ms) ease-out;
  z-index: 9999;
}

/* Show tooltip on hover */
.has-tooltip:hover .avatar-tooltip {
  opacity: 1;
  visibility: visible;
}

/* ---- TASK-1559: Online presence indicator ---- */
.presence-dot {
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  border: 1.5px solid var(--surface-primary, #121214);
  z-index: 1;
  pointer-events: none;
}

.presence-dot.online {
  background: var(--color-success, #22c55e);
  box-shadow: 0 0 4px rgba(34, 197, 94, 0.4);
}

.presence-dot.idle {
  background: var(--color-warning, #f59e0b);
  box-shadow: 0 0 4px rgba(245, 158, 11, 0.3);
}

/* Subtle ring on hover so the avatar feels interactive */
.has-tooltip:hover .avatar-initials,
.has-tooltip:hover .avatar-image,
.has-tooltip:hover .avatar-fallback {
  box-shadow: 0 0 0 2px var(--brand-primary-dim, rgba(78, 205, 196, 0.3));
}
</style>
