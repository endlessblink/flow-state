/**
 * FEATURE-1345: Configure Android status bar appearance.
 * Sets dark background + light text to match FlowState's dark theme.
 * Uses @capacitor/status-bar (already installed).
 */
import { isCapacitor } from '@/utils/platform'

export async function initCapacitorStatusBar(): Promise<void> {
  if (!isCapacitor()) return

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')

    // Dark background matching app theme
    await StatusBar.setBackgroundColor({ color: '#0f172a' })
    // Light text/icons on dark background
    await StatusBar.setStyle({ style: Style.Dark })
    // Don't overlay content — status bar is a separate area
    await StatusBar.setOverlaysWebView({ overlay: false })

    console.log('[CAP-STATUS] Status bar configured')
  } catch (error) {
    console.warn('[CAP-STATUS] Failed to configure status bar:', error)
  }
}
