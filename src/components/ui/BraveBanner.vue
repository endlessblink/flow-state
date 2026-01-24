<script setup lang="ts">
/**
 * BraveBanner - Warning banner for Brave browser users when Shields blocks resources
 *
 * Shows instructions on how to disable Shields for the site to fix
 * authentication, WebSocket, and other blocked resource issues.
 */
import { useBraveProtection } from '@/utils/braveProtection'

const {
  shouldShowWarning,
  instructions,
  dismissWarning,
  blockedCount
} = useBraveProtection()
</script>

<template>
  <Transition name="slide-down">
    <div
      v-if="shouldShowWarning"
      class="brave-banner"
      role="alert"
    >
      <div class="brave-banner__content">
        <div class="brave-banner__icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
          </svg>
        </div>

        <div class="brave-banner__text">
          <strong>Brave Shields Blocking Resources</strong>
          <p>
            Brave's privacy features are blocking {{ blockedCount }} request(s) needed for the app to work.
            To fix sign-in and data loading issues:
          </p>
          <ol class="brave-banner__instructions">
            <li v-for="(instruction, index) in instructions" :key="index">
              {{ instruction }}
            </li>
          </ol>
        </div>

        <button
          class="brave-banner__close"
          @click="dismissWarning"
          aria-label="Dismiss warning"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M6.225 4.811a1 1 0 00-1.414 1.414L10.586 12 4.81 17.775a1 1 0 101.414 1.414L12 13.414l5.775 5.775a1 1 0 001.414-1.414L13.414 12l5.775-5.775a1 1 0 00-1.414-1.414L12 10.586 6.225 4.81z"/>
          </svg>
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.brave-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  background: linear-gradient(135deg, #fb542b 0%, #ff7654 100%);
  color: white;
  padding: var(--space-3) var(--space-4);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.brave-banner__content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.brave-banner__icon {
  flex-shrink: 0;
  padding: var(--space-1);
}

.brave-banner__text {
  flex: 1;
}

.brave-banner__text strong {
  display: block;
  font-size: 1rem;
  margin-bottom: var(--space-1);
}

.brave-banner__text p {
  margin: 0 0 var(--space-2);
  opacity: 0.95;
  font-size: 0.875rem;
}

.brave-banner__instructions {
  margin: 0;
  padding-left: var(--space-4);
  font-size: 0.875rem;
  opacity: 0.95;
}

.brave-banner__instructions li {
  margin-bottom: var(--space-1);
}

.brave-banner__close {
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: var(--radius-sm);
  padding: var(--space-1);
  cursor: pointer;
  color: white;
  transition: background 0.2s;
}

.brave-banner__close:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Slide down animation */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
