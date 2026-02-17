import type { Meta, StoryObj } from '@storybook/vue3'
import { LayoutGrid, Timer, Shield, UserPlus, Inbox, ArrowUpDown, X } from 'lucide-vue-next'
import AppLogo from '@/components/base/AppLogo.vue'

// ============================================================================
// INLINE STYLES (Design Token-Based)
// ============================================================================

const overlayStyle = `position: relative; width: 100%; min-height: 500px; background: var(--overlay-bg); display: flex; align-items: center; justify-content: center; border-radius: var(--radius-xl); padding: var(--space-4);`

const modalStyle = `position: relative; background: var(--overlay-component-bg); backdrop-filter: var(--overlay-component-backdrop); -webkit-backdrop-filter: var(--overlay-component-backdrop); border: var(--overlay-component-border); border-radius: var(--radius-xl); width: 100%; max-width: 400px; box-shadow: var(--overlay-component-shadow); overflow: hidden;`

const closeBtnStyle = `position: absolute; top: var(--space-3); right: var(--space-3); display: flex; align-items: center; justify-content: center; width: var(--space-8); height: var(--space-8); background: transparent; border: none; color: var(--text-muted); cursor: pointer; border-radius: var(--radius-md); z-index: 1;`

const bodyStyle = `padding: var(--space-8) var(--space-6) var(--space-5); display: flex; flex-direction: column; gap: var(--space-5);`

const heroStyle = `display: flex; flex-direction: column; align-items: center; gap: var(--space-2); text-align: center;`

const headingStyle = `margin: 0; font-size: var(--text-xl); font-weight: 600; color: var(--text-primary);`

const subtitleStyle = `margin: 0; font-size: var(--text-sm); color: var(--text-secondary);`

const featuresStyle = `display: flex; flex-direction: column; gap: var(--space-2_5);`

const featureStyle = `display: flex; align-items: center; gap: var(--space-3); font-size: var(--text-sm); color: var(--text-secondary);`

const desktopHintStyle = `margin: 0; font-size: var(--text-meta); color: var(--text-muted); text-align: center; font-style: italic;`

const footerStyle = `padding: var(--space-4) var(--space-6) var(--space-5); border-top: 1px solid var(--glass-border); display: flex; flex-direction: column; gap: var(--space-3);`

const primaryBtnStyle = `width: 100%; padding: var(--space-2_5); background: var(--glass-bg-soft); border: 1px solid var(--brand-primary); border-radius: var(--radius-md); color: var(--brand-primary); font-size: var(--text-sm); font-weight: 600; cursor: pointer; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);`

const secondaryBtnStyle = `display: flex; align-items: center; justify-content: center; gap: var(--space-1_5); width: 100%; padding: var(--space-2); background: transparent; border: none; color: var(--text-muted); font-size: var(--text-meta); cursor: pointer; border-radius: var(--radius-md);`

const iconStyle = `color: var(--brand-primary); flex-shrink: 0;`

// ============================================================================
// META
// ============================================================================

const meta: Meta = {
  title: '🎯 Modals/OnboardingWizard',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `FEATURE-1201: Single-screen welcome modal for first-time visitors.

**Design decision:** UX research showed multi-step wizards have ~10-19% completion rates with 72% user abandonment. A single welcome screen with a clear CTA gets users to their first task faster.

**Features:**
- Clean welcome screen: logo, 3 feature highlights, "Get Started" CTA
- Mobile-aware: shows mobile-specific features (inbox, timer, quick sort) + desktop hint
- Auth-aware: shows "Sign up to sync" link for guests
- Keyboard: Enter or Escape to dismiss
- Persists dismissal in localStorage (\`flowstate-onboarding-v2\`)
- Backward-compatible with legacy \`flowstate-welcome-seen\` key
- Replaces the old WelcomeModal`
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

// ============================================================================
// STORY: Desktop — Welcome (Guest)
// ============================================================================

export const DesktopGuest: Story = {
  name: 'Desktop (Guest)',
  render: () => ({
    components: { AppLogo, LayoutGrid, Timer, Shield, UserPlus, X },
    setup() {
      return {
        overlayStyle, modalStyle, closeBtnStyle, bodyStyle, heroStyle,
        headingStyle, subtitleStyle, featuresStyle, featureStyle, iconStyle,
        footerStyle, primaryBtnStyle, secondaryBtnStyle
      }
    },
    template: `
      <div :style="overlayStyle">
        <div :style="modalStyle">
          <button :style="closeBtnStyle" aria-label="Close"><X :size="18" /></button>
          <div :style="bodyStyle">
            <div :style="heroStyle">
              <AppLogo size="xl" />
              <h2 :style="headingStyle">Welcome to FlowState</h2>
              <p :style="subtitleStyle">Your all-in-one productivity workspace</p>
            </div>
            <div :style="featuresStyle">
              <div :style="featureStyle">
                <LayoutGrid :size="18" :style="iconStyle" />
                <span>Board, Calendar, and Canvas views</span>
              </div>
              <div :style="featureStyle">
                <Timer :size="18" :style="iconStyle" />
                <span>Built-in Pomodoro timer</span>
              </div>
              <div :style="featureStyle">
                <Shield :size="18" :style="iconStyle" />
                <span>Works offline, 100% private</span>
              </div>
            </div>
          </div>
          <div :style="footerStyle">
            <button :style="primaryBtnStyle">Get Started</button>
            <button :style="secondaryBtnStyle">
              <UserPlus :size="14" /> Sign up to sync across devices
            </button>
          </div>
        </div>
      </div>
    `
  })
}

// ============================================================================
// STORY: Desktop — Welcome (Signed In)
// ============================================================================

export const DesktopSignedIn: Story = {
  name: 'Desktop (Signed In)',
  render: () => ({
    components: { AppLogo, LayoutGrid, Timer, Shield, X },
    setup() {
      return {
        overlayStyle, modalStyle, closeBtnStyle, bodyStyle, heroStyle,
        headingStyle, subtitleStyle, featuresStyle, featureStyle, iconStyle,
        footerStyle, primaryBtnStyle
      }
    },
    template: `
      <div :style="overlayStyle">
        <div :style="modalStyle">
          <button :style="closeBtnStyle" aria-label="Close"><X :size="18" /></button>
          <div :style="bodyStyle">
            <div :style="heroStyle">
              <AppLogo size="xl" />
              <h2 :style="headingStyle">Welcome to FlowState</h2>
              <p :style="subtitleStyle">Your all-in-one productivity workspace</p>
            </div>
            <div :style="featuresStyle">
              <div :style="featureStyle">
                <LayoutGrid :size="18" :style="iconStyle" />
                <span>Board, Calendar, and Canvas views</span>
              </div>
              <div :style="featureStyle">
                <Timer :size="18" :style="iconStyle" />
                <span>Built-in Pomodoro timer</span>
              </div>
              <div :style="featureStyle">
                <Shield :size="18" :style="iconStyle" />
                <span>Works offline, 100% private</span>
              </div>
            </div>
          </div>
          <div :style="footerStyle">
            <button :style="primaryBtnStyle">Get Started</button>
          </div>
        </div>
      </div>
    `
  })
}

// ============================================================================
// STORY: Mobile — Welcome (Guest)
// ============================================================================

export const MobileGuest: Story = {
  name: 'Mobile (Guest)',
  parameters: {
    viewport: { defaultViewport: 'mobile1' }
  },
  render: () => ({
    components: { AppLogo, Inbox, Timer, ArrowUpDown, UserPlus, X },
    setup() {
      return {
        overlayStyle, modalStyle, closeBtnStyle, bodyStyle, heroStyle,
        headingStyle, subtitleStyle, featuresStyle, featureStyle, iconStyle,
        desktopHintStyle, footerStyle, primaryBtnStyle, secondaryBtnStyle
      }
    },
    template: `
      <div :style="overlayStyle">
        <div :style="modalStyle" style="max-width: 100%;">
          <button :style="closeBtnStyle" aria-label="Close"><X :size="18" /></button>
          <div :style="bodyStyle" style="padding: var(--space-6) var(--space-4) var(--space-4);">
            <div :style="heroStyle">
              <AppLogo size="xl" />
              <h2 :style="headingStyle">Welcome to FlowState</h2>
              <p :style="subtitleStyle">Capture tasks on the go</p>
            </div>
            <div :style="featuresStyle">
              <div :style="featureStyle">
                <Inbox :size="18" :style="iconStyle" />
                <span>Quick inbox capture and today view</span>
              </div>
              <div :style="featureStyle">
                <Timer :size="18" :style="iconStyle" />
                <span>Built-in Pomodoro timer</span>
              </div>
              <div :style="featureStyle">
                <ArrowUpDown :size="18" :style="iconStyle" />
                <span>Swipe to prioritize with Quick Sort</span>
              </div>
            </div>
            <p :style="desktopHintStyle">Full Board, Calendar, and Canvas views available on desktop</p>
          </div>
          <div :style="footerStyle" style="padding: var(--space-3) var(--space-4) var(--space-4);">
            <button :style="primaryBtnStyle">Get Started</button>
            <button :style="secondaryBtnStyle">
              <UserPlus :size="14" /> Sign up to sync across devices
            </button>
          </div>
        </div>
      </div>
    `
  })
}
