/**
 * BUG-2110: one reminder, not four. On the Linux desktop app the KDE widget
 * owns every desktop reminder (session-end card with sound, idle focus/break
 * card, 1-minute heads-up). The app must not add its own popups, system
 * notifications or end sounds on top — they stacked up and grabbed the
 * keyboard. Web/PWA and other platforms keep the app's own notifications.
 */
export function widgetOwnsDesktopReminders(): boolean {
  if (typeof window === 'undefined') return false
  const api = (window as unknown as { electronAPI?: { isElectron?: boolean; platform?: string } }).electronAPI
  return api?.isElectron === true && api.platform === 'linux'
}
