<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="isVisible"
        class="onboarding-overlay"
        tabindex="-1"
        @click.self="dismiss"
        @keydown="handleKeydown"
      >
        <div class="onboarding-modal">
          <!-- Close button (top-right, subtle) -->
          <button class="close-btn" aria-label="Close" @click="dismiss">
            <X :size="18" />
          </button>

          <!-- Content -->
          <div class="onboarding-body">
            <!-- Hero -->
            <div class="hero">
              <AppLogo size="xl" />
              <h2 class="heading">Welcome to FlowState</h2>
              <p class="subtitle">{{ isMobile ? 'Capture tasks on the go' : 'Your all-in-one productivity workspace' }}</p>
            </div>

            <!-- Feature highlights — different for mobile vs desktop -->
            <div class="features">
              <!-- Mobile features -->
              <template v-if="isMobile">
                <div class="feature">
                  <Inbox :size="18" class="feature-icon" />
                  <span>Quick inbox capture and today view</span>
                </div>
                <div class="feature">
                  <Timer :size="18" class="feature-icon" />
                  <span>Built-in Pomodoro timer</span>
                </div>
                <div class="feature">
                  <ArrowUpDown :size="18" class="feature-icon" />
                  <span>Swipe to prioritize with Quick Sort</span>
                </div>
              </template>

              <!-- Desktop features -->
              <template v-else>
                <div class="feature">
                  <LayoutGrid :size="18" class="feature-icon" />
                  <span>Board, Calendar, and Canvas views</span>
                </div>
                <div class="feature">
                  <Timer :size="18" class="feature-icon" />
                  <span>Built-in Pomodoro timer</span>
                </div>
                <div class="feature">
                  <Shield :size="18" class="feature-icon" />
                  <span>Works offline, 100% private</span>
                </div>
              </template>
            </div>

            <!-- Mobile: hint about desktop -->
            <p v-if="isMobile" class="desktop-hint">
              Full Board, Calendar, and Canvas views available on desktop
            </p>
          </div>

          <!-- Footer: primary CTA + optional sign-up -->
          <div class="onboarding-footer">
            <button class="primary-btn" @click="dismiss">
              Get Started
            </button>
            <button
              v-if="!isAuthenticated"
              class="secondary-btn"
              @click="openSignUp"
            >
              <UserPlus :size="14" />
              Sign up to sync across devices
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { X, LayoutGrid, Timer, Shield, UserPlus, Inbox, ArrowUpDown } from 'lucide-vue-next'
import AppLogo from '@/components/base/AppLogo.vue'
import { useOnboardingWizard } from '@/composables/app/useOnboardingWizard'
import { useMobileDetection } from '@/composables/useMobileDetection'

const { isMobile } = useMobileDetection()

const {
  isVisible,
  isAuthenticated,
  dismiss,
  openSignUp,
  handleKeydown,
} = useOnboardingWizard()
</script>

<style scoped>
/* Overlay */
.onboarding-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  backdrop-filter: var(--blur-md);
  -webkit-backdrop-filter: var(--blur-md);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  z-index: var(--z-modal);
}

/* Modal */
.onboarding-modal {
  position: relative;
  background: var(--overlay-component-bg);
  backdrop-filter: var(--overlay-component-backdrop);
  -webkit-backdrop-filter: var(--overlay-component-backdrop);
  border: var(--overlay-component-border);
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 400px;
  box-shadow: var(--overlay-component-shadow);
  overflow: hidden;
}

/* Close button */
.close-btn {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--space-8);
  height: var(--space-8);
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) var(--ease-out);
  z-index: 1;
}

.close-btn:hover {
  background: var(--glass-bg-hover);
  color: var(--text-secondary);
}

/* Body */
.onboarding-body {
  padding: var(--space-8) var(--space-6) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

/* Hero */
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  text-align: center;
}

.heading {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--text-primary);
}

.subtitle {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

/* Features */
.features {
  display: flex;
  flex-direction: column;
  gap: var(--space-2_5);
}

.feature {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.feature-icon {
  color: var(--brand-primary);
  flex-shrink: 0;
}

/* Desktop hint (mobile only) */
.desktop-hint {
  margin: 0;
  font-size: var(--text-meta);
  color: var(--text-muted);
  text-align: center;
  font-style: italic;
}

/* Footer */
.onboarding-footer {
  padding: var(--space-4) var(--space-6) var(--space-5);
  border-top: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.primary-btn {
  width: 100%;
  padding: var(--space-2_5);
  background: var(--glass-bg-soft);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-md);
  color: var(--brand-primary);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: all var(--duration-fast) var(--ease-out);
}

.primary-btn:hover {
  background: var(--glass-bg-hover);
  border-color: var(--brand-primary-hover);
}

.secondary-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1_5);
  width: 100%;
  padding: var(--space-2);
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: var(--text-meta);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) var(--ease-out);
}

.secondary-btn:hover {
  color: var(--text-secondary);
  background: var(--glass-bg-hover);
}

/* ==========================================
   MODAL ENTER/EXIT TRANSITIONS
   ========================================== */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity var(--duration-normal) var(--ease-out);
}

.modal-fade-enter-active .onboarding-modal,
.modal-fade-leave-active .onboarding-modal {
  transition: transform var(--duration-normal) var(--ease-out);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .onboarding-modal {
  transform: scale(0.95);
}

.modal-fade-leave-to .onboarding-modal {
  transform: scale(0.95);
}

/* ==========================================
   MOBILE RESPONSIVE
   ========================================== */
@media (max-width: 640px) {
  .onboarding-overlay {
    padding: var(--space-3);
  }

  .onboarding-modal {
    max-width: 100%;
  }

  .onboarding-body {
    padding: var(--space-6) var(--space-4) var(--space-4);
  }

  .onboarding-footer {
    padding: var(--space-3) var(--space-4) var(--space-4);
  }
}
</style>
