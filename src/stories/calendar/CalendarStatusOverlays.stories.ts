import type { Meta, StoryObj } from '@storybook/vue3'
import { AlertTriangle, XCircle, RefreshCw, X, Loader2 } from 'lucide-vue-next'

// ============================================================================
// INLINE STYLES (Design Token-Based — faithful to CalendarStatusOverlays.vue)
// ============================================================================

const containerStyle = `position: relative; width: 100%; min-height: 200px; background: var(--glass-bg-subtle); border-radius: var(--radius-xl); overflow: hidden;`

const healthAlertStyle = `position: relative; width: 100%; background: var(--danger-bg-subtle); border-bottom: 2px solid var(--color-danger); padding: var(--space-3) var(--space-4);`

const healthContentStyle = `display: flex; align-items: center; justify-content: space-between; max-width: 1200px; margin: 0 auto; gap: var(--space-3);`

const healthIconStyle = `flex-shrink: 0; color: var(--color-warning);`

const healthMessageStyle = `flex: 1; font-weight: 500; font-size: var(--text-sm); color: var(--text-primary);`

const retryBtnStyle = `display: flex; align-items: center; gap: var(--space-1); padding: var(--space-1) var(--space-3); background: var(--glass-bg-soft); border: 1px solid var(--color-warning); border-radius: var(--radius-sm); color: var(--color-warning); font-size: var(--text-xs); font-weight: 500; cursor: pointer; backdrop-filter: blur(8px);`

const errorAlertStyle = `position: relative; margin: var(--space-4) auto; max-width: 600px; width: 90%; background: var(--glass-bg-medium); border: 1px solid var(--color-danger); border-radius: var(--radius-md); padding: var(--space-4) var(--space-5); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);`

const errorRetryableStyle = `position: relative; margin: var(--space-4) auto; max-width: 600px; width: 90%; background: var(--glass-bg-medium); border: 1px solid var(--color-warning); border-radius: var(--radius-md); padding: var(--space-4) var(--space-5); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);`

const errorContentStyle = `display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);`

const errorIconStyle = `flex-shrink: 0; color: var(--color-danger);`

const errorIconRetryableStyle = `flex-shrink: 0; color: var(--color-warning);`

const errorMessageStyle = `flex: 1; font-size: var(--text-sm); color: var(--text-primary); line-height: 1.4;`

const errorActionsStyle = `display: flex; gap: var(--space-2); flex-shrink: 0;`

const errorRetryBtnStyle = `display: flex; align-items: center; gap: var(--space-1); padding: var(--space-1_5) var(--space-3); background: var(--glass-bg-soft); border: 1px solid var(--color-warning); border-radius: var(--radius-sm); color: var(--color-warning); font-size: var(--text-xs); cursor: pointer; backdrop-filter: blur(8px); white-space: nowrap;`

const dismissBtnStyle = `display: flex; align-items: center; justify-content: center; width: var(--space-7); height: var(--space-7); background: var(--glass-bg-soft); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-muted); cursor: pointer; backdrop-filter: blur(8px);`

const refreshBtnStyle = `display: flex; align-items: center; gap: var(--space-1); padding: var(--space-1_5) var(--space-3); background: var(--glass-bg-soft); border: 1px solid var(--color-danger); border-radius: var(--radius-sm); color: var(--color-danger); font-size: var(--text-xs); cursor: pointer; backdrop-filter: blur(8px); white-space: nowrap;`

const loadingOverlayStyle = `position: relative; width: 100%; min-height: 300px; background: var(--overlay-backdrop-bg); display: flex; align-items: center; justify-content: center; border-radius: var(--radius-xl); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);`

const loadingContentStyle = `background: var(--glass-bg-heavy); padding: var(--space-6) var(--space-8); border-radius: var(--radius-lg); border: 1px solid var(--glass-border); box-shadow: var(--shadow-xl); display: flex; flex-direction: column; align-items: center; gap: var(--space-4); min-width: 200px; backdrop-filter: blur(16px);`

const spinnerStyle = `color: var(--brand-primary); animation: spin 1s linear infinite;`

const loadingTextStyle = `color: var(--text-primary); font-size: var(--text-sm); font-weight: 500;`

const healthyStyle = `display: flex; align-items: center; justify-content: center; min-height: 120px; color: var(--text-muted); font-size: var(--text-sm);`

// ============================================================================
// META
// ============================================================================

const meta: Meta = {
  title: '📅 Calendar/CalendarStatusOverlays',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `Status overlay banners for the calendar view showing system health, errors, and loading states.

**States:**
- **Healthy** — No overlays shown, calendar functions normally
- **Degraded Mode** — Warning banner when store initialization fails
- **Loading / Syncing** — Centered spinner overlay with status text
- **Error (retryable)** — Warning-themed alert with Retry + Dismiss
- **Error (fatal)** — Danger-themed alert with Refresh Page action`
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

// ============================================================================
// STORY 1: HEALTHY (no overlays)
// ============================================================================

export const Healthy: Story = {
  name: 'Healthy (No Overlays)',
  render: () => ({
    template: `
      <div :style="containerStyle">
        <div :style="healthyStyle">
          No overlays — calendar is functioning normally.
        </div>
      </div>
    `,
    data() {
      return { containerStyle, healthyStyle }
    }
  })
}

// ============================================================================
// STORY 2: DEGRADED MODE (system health warning)
// ============================================================================

export const DegradedMode: Story = {
  name: 'Degraded Mode',
  render: () => ({
    components: { AlertTriangle, RefreshCw },
    template: `
      <div :style="containerStyle">
        <div :style="healthAlertStyle">
          <div :style="healthContentStyle">
            <AlertTriangle :size="18" :style="healthIconStyle" />
            <span :style="healthMessageStyle">Calendar store failed to initialize. Running in degraded mode.</span>
            <button :style="retryBtnStyle">
              <RefreshCw :size="12" />
              Retry
            </button>
          </div>
        </div>
        <div :style="healthyStyle">
          Calendar content (degraded)
        </div>
      </div>
    `,
    data() {
      return {
        containerStyle, healthAlertStyle, healthContentStyle, healthIconStyle,
        healthMessageStyle, retryBtnStyle, healthyStyle
      }
    }
  })
}

// ============================================================================
// STORY 3: LOADING
// ============================================================================

export const Loading: Story = {
  name: 'Loading',
  render: () => ({
    components: { Loader2 },
    template: `
      <div :style="loadingOverlayStyle">
        <div :style="loadingContentStyle">
          <Loader2 :size="32" :style="spinnerStyle" />
          <span :style="loadingTextStyle">Loading Calendar...</span>
        </div>
      </div>
    `,
    data() {
      return { loadingOverlayStyle, loadingContentStyle, spinnerStyle, loadingTextStyle }
    }
  })
}

// ============================================================================
// STORY 4: SYNCING
// ============================================================================

export const Syncing: Story = {
  name: 'Syncing',
  render: () => ({
    components: { Loader2 },
    template: `
      <div :style="loadingOverlayStyle">
        <div :style="loadingContentStyle">
          <Loader2 :size="32" :style="spinnerStyle" />
          <span :style="loadingTextStyle">Synchronizing Data...</span>
        </div>
      </div>
    `,
    data() {
      return { loadingOverlayStyle, loadingContentStyle, spinnerStyle, loadingTextStyle }
    }
  })
}

// ============================================================================
// STORY 5: RETRYABLE ERROR
// ============================================================================

export const WithError: Story = {
  name: 'Retryable Error',
  render: () => ({
    components: { AlertTriangle, RefreshCw, X },
    template: `
      <div :style="containerStyle">
        <div :style="errorRetryableStyle">
          <div :style="errorContentStyle">
            <AlertTriangle :size="24" :style="errorIconRetryableStyle" />
            <span :style="errorMessageStyle">
              <strong>Network Error:</strong> Failed to sync calendar events. Check your connection.
            </span>
            <div :style="errorActionsStyle">
              <button :style="errorRetryBtnStyle">
                <RefreshCw :size="12" />
                Retry
              </button>
              <button :style="dismissBtnStyle">
                <X :size="14" />
              </button>
            </div>
          </div>
        </div>
        <div :style="healthyStyle">
          Calendar content behind error
        </div>
      </div>
    `,
    data() {
      return {
        containerStyle, errorRetryableStyle, errorContentStyle, errorIconRetryableStyle,
        errorMessageStyle, errorActionsStyle, errorRetryBtnStyle, dismissBtnStyle, healthyStyle
      }
    }
  })
}

// ============================================================================
// STORY 6: FATAL ERROR (System Restart)
// ============================================================================

export const SystemRestartError: Story = {
  name: 'Fatal Error (Restart Required)',
  render: () => ({
    components: { XCircle, RefreshCw, X },
    template: `
      <div :style="containerStyle">
        <div :style="errorAlertStyle">
          <div :style="errorContentStyle">
            <XCircle :size="24" :style="errorIconStyle" />
            <span :style="errorMessageStyle">
              <strong>System Restart:</strong> Critical error detected. Please refresh the page.
            </span>
            <div :style="errorActionsStyle">
              <button :style="refreshBtnStyle">
                <RefreshCw :size="12" />
                Refresh
              </button>
              <button :style="dismissBtnStyle">
                <X :size="14" />
              </button>
            </div>
          </div>
        </div>
        <div :style="healthyStyle">
          Calendar content behind error
        </div>
      </div>
    `,
    data() {
      return {
        containerStyle, errorAlertStyle, errorContentStyle, errorIconStyle,
        errorMessageStyle, errorActionsStyle, refreshBtnStyle, dismissBtnStyle, healthyStyle
      }
    }
  })
}
