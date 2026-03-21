/**
 * Common data-testid selector helpers for Vitest (component tests) and Playwright (E2E tests).
 *
 * Usage:
 *   import { testIds } from '../helpers/selectors'
 *
 *   // Component test (Vue Test Utils):
 *   const card = wrapper.find(testIds.taskCard('abc-123'))
 *
 *   // Playwright:
 *   await page.locator(testIds.taskCard('abc-123')).click()
 */

export const testIds = {
  // ── Task cards ────────────────────────────────────────────────────
  taskCard: (id: string) => `[data-testid="task-card-${id}"]`,
  taskCardTitle: (id: string) => `[data-testid="task-card-title-${id}"]`,
  taskCardDoneToggle: (id: string) => `[data-testid="done-toggle-${id}"]`,

  // ── Kanban board ──────────────────────────────────────────────────
  kanbanBoard: '[data-testid="kanban-board"]',
  kanbanColumn: (status: string) => `[data-testid="kanban-column-${status}"]`,
  kanbanColumnHeader: (status: string) => `[data-testid="kanban-column-header-${status}"]`,

  // ── Timer ─────────────────────────────────────────────────────────
  timerDisplay: '[data-testid="timer-display"]',
  timerStartButton: '[data-testid="timer-start"]',
  timerPauseButton: '[data-testid="timer-pause"]',
  timerStopButton: '[data-testid="timer-stop"]',

  // ── Inbox ─────────────────────────────────────────────────────────
  inboxBadge: '[data-testid="inbox-badge"]',
  inboxPanel: '[data-testid="inbox-panel"]',

  // ── Sidebar ───────────────────────────────────────────────────────
  sidebar: '[data-testid="sidebar"]',
  sidebarProjectItem: (id: string) => `[data-testid="sidebar-project-${id}"]`,

  // ── Canvas ────────────────────────────────────────────────────────
  canvasNode: (id: string) => `[data-testid="canvas-node-${id}"]`,

  // ── Modals and overlays ───────────────────────────────────────────
  taskEditModal: '[data-testid="task-edit-modal"]',
  confirmationModal: '[data-testid="confirmation-modal"]',
  confirmationModalConfirm: '[data-testid="confirmation-modal-confirm"]',
  confirmationModalCancel: '[data-testid="confirmation-modal-cancel"]',

  // ── Forms ─────────────────────────────────────────────────────────
  taskTitleInput: '[data-testid="task-title-input"]',
  taskDescriptionInput: '[data-testid="task-description-input"]',
  createTaskButton: '[data-testid="create-task-button"]',
  saveTaskButton: '[data-testid="save-task-button"]',
  deleteTaskButton: '[data-testid="delete-task-button"]',

  // ── Search ────────────────────────────────────────────────────────
  searchInput: '[data-testid="search-input"]',
  searchResults: '[data-testid="search-results"]',
  searchResultItem: (id: string) => `[data-testid="search-result-${id}"]`,

  // ── Notifications ─────────────────────────────────────────────────
  notificationToast: '[data-testid="notification-toast"]',
  updateNotification: '[data-testid="update-notification"]',
}
