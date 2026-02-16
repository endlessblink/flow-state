import type { Meta, StoryObj } from '@storybook/vue3'
import { X, CheckCircle, LayoutGrid, Timer, Shield, Settings } from 'lucide-vue-next'
import AppLogo from '@/components/base/AppLogo.vue'

// ============================================================================
// INLINE STYLES (Design Token-Based — faithful to WelcomeModal.vue)
// ============================================================================

const containerStyle = `position: relative; width: 100%; height: 500px; background: var(--overlay-backdrop-bg); display: flex; align-items: center; justify-content: center; border-radius: var(--radius-xl);`

const modalStyle = `background: var(--overlay-component-bg); border: var(--overlay-component-border); border-radius: var(--radius-xl); width: 100%; max-width: 420px; box-shadow: var(--overlay-component-shadow); overflow: hidden; backdrop-filter: var(--overlay-component-backdrop); -webkit-backdrop-filter: var(--overlay-component-backdrop);`

const headerStyle = `display: flex; align-items: center; justify-content: space-between; padding: var(--space-5) var(--space-6); border-bottom: 1px solid var(--glass-border);`

const headerContentStyle = `display: flex; align-items: center; gap: var(--space-3);`

const titleStyle = `margin: 0; font-size: var(--text-lg); font-weight: 600; color: var(--text-primary);`

const subtitleStyle = `margin: var(--space-0_5) 0 0; font-size: var(--text-meta); color: var(--text-secondary);`

const closeBtnStyle = `display: flex; align-items: center; justify-content: center; width: var(--space-8); height: var(--space-8); border: none; background: transparent; color: var(--text-secondary); border-radius: var(--radius-md); cursor: pointer;`

const bodyStyle = `padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-5);`

const statusBannerStyle = `display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2_5) var(--space-3_5); background: transparent; border: 1px solid var(--brand-primary); border-radius: var(--radius-md); font-size: var(--text-sm); color: var(--brand-primary);`

const featuresStyle = `display: flex; flex-direction: column; gap: var(--space-3);`

const featureStyle = `display: flex; align-items: center; gap: var(--space-3); font-size: var(--text-sm); color: var(--text-secondary);`

const featureIconStyle = `color: var(--brand-primary); flex-shrink: 0;`

const footerStyle = `padding: var(--space-5) var(--space-6); border-top: 1px solid var(--glass-border); display: flex; flex-direction: column; gap: var(--space-3);`

const primaryBtnStyle = `width: 100%; padding: var(--space-3); background: transparent; border: 1px solid var(--brand-primary); border-radius: var(--radius-md); color: var(--brand-primary); font-size: var(--text-sm); font-weight: 600; cursor: pointer;`

const secondaryActionsStyle = `display: flex; gap: var(--space-2); justify-content: center;`

const secondaryBtnStyle = `display: flex; align-items: center; gap: var(--space-1_5); padding: var(--space-2) var(--space-3_5); background: transparent; border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-secondary); font-size: var(--text-meta); cursor: pointer;`

// ============================================================================
// META
// ============================================================================

const meta: Meta = {
  title: '🎯 Modals/WelcomeModal',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `First-time user onboarding modal with glass morphism design.

**Features:**
- Clean, minimal layout with AppLogo
- Status banner using \`var(--brand-primary)\` accent (teal)
- Three feature highlights with Lucide icons
- "Get Started" primary action + "Settings" secondary action
- Keyboard support: Enter/Escape to close`
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

// ============================================================================
// STORY 1: DEFAULT (Open)
// ============================================================================

export const Default: Story = {
  name: 'Default (Open)',
  render: () => ({
    components: { AppLogo, X, CheckCircle, LayoutGrid, Timer, Shield, Settings },
    template: `
      <div :style="containerStyle">
        <div :style="modalStyle">
          <!-- Header -->
          <div :style="headerStyle">
            <div :style="headerContentStyle">
              <AppLogo size="xl" />
              <div>
                <h2 :style="titleStyle">Welcome to FlowState</h2>
                <p :style="subtitleStyle">Your productivity companion</p>
              </div>
            </div>
            <button :style="closeBtnStyle">
              <X :size="20" />
            </button>
          </div>

          <!-- Body -->
          <div :style="bodyStyle">
            <!-- Status Banner -->
            <div :style="statusBannerStyle">
              <CheckCircle :size="20" />
              <span>Welcome!</span>
            </div>

            <!-- Features -->
            <div :style="featuresStyle">
              <div :style="featureStyle">
                <LayoutGrid :size="18" :style="featureIconStyle" />
                <span>Multiple views: Board, Calendar, Canvas</span>
              </div>
              <div :style="featureStyle">
                <Timer :size="18" :style="featureIconStyle" />
                <span>Built-in Pomodoro timer</span>
              </div>
              <div :style="featureStyle">
                <Shield :size="18" :style="featureIconStyle" />
                <span>100% private, works offline</span>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div :style="footerStyle">
            <button :style="primaryBtnStyle">Get Started</button>
            <div :style="secondaryActionsStyle">
              <button :style="secondaryBtnStyle">
                <Settings :size="16" />
                Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    `,
    data() {
      return {
        containerStyle, modalStyle, headerStyle, headerContentStyle,
        titleStyle, subtitleStyle, closeBtnStyle, bodyStyle, statusBannerStyle,
        featuresStyle, featureStyle, featureIconStyle, footerStyle, primaryBtnStyle,
        secondaryActionsStyle, secondaryBtnStyle
      }
    }
  })
}

// ============================================================================
// STORY 2: CLOSED STATE (with reopen hint)
// ============================================================================

export const Closed: Story = {
  name: 'Closed State',
  render: () => ({
    template: `
      <div :style="containerStyle">
        <div style="text-align: center;">
          <p style="color: var(--text-secondary); font-size: var(--text-sm); margin: 0 0 var(--space-3) 0;">
            Modal is closed. In the real app, it appears on first launch.
          </p>
          <button :style="reopenBtnStyle">
            Reopen Welcome Modal
          </button>
        </div>
      </div>
    `,
    data() {
      return {
        containerStyle: `position: relative; width: 100%; height: 200px; background: var(--overlay-backdrop-bg); display: flex; align-items: center; justify-content: center; border-radius: var(--radius-xl);`,
        reopenBtnStyle: `padding: var(--space-2) var(--space-4); background: transparent; border: 1px solid var(--brand-primary); border-radius: var(--radius-md); color: var(--brand-primary); font-size: var(--text-sm); font-weight: 500; cursor: pointer;`
      }
    }
  })
}
