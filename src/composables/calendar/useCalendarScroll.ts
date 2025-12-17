import { ref as _ref, nextTick } from 'vue'

/**
 * Calendar scroll management composable
 * Handles scroll synchronization and automatic scrolling to current time
 * Extracted from CalendarView.vue for better maintainability
 */
export function useCalendarScroll() {
  // Scroll sync state
  let calendarEventsContainer: HTMLElement | null = null
  let timeLabelsContainer: HTMLElement | null = null
  let scrollHandler: ((event: Event) => void) | null = null

  /**
   * Setup scroll synchronization between time labels and calendar events container
   */
  const setupScrollSync = () => {
    nextTick(() => {
      calendarEventsContainer = document.querySelector('.calendar-events-container') as HTMLElement
      timeLabelsContainer = document.querySelector('.time-labels') as HTMLElement

      if (calendarEventsContainer && timeLabelsContainer) {
        scrollHandler = () => {
          if (timeLabelsContainer && calendarEventsContainer) {
            timeLabelsContainer.scrollTop = calendarEventsContainer.scrollTop
          }
        }

        calendarEventsContainer.addEventListener('scroll', scrollHandler, { passive: true })
      }
    })
  }

  /**
   * Cleanup scroll synchronization listeners
   */
  const cleanupScrollSync = () => {
    if (calendarEventsContainer && scrollHandler) {
      calendarEventsContainer.removeEventListener('scroll', scrollHandler)
    }
  }

  /**
   * Scroll the calendar grid to show the current time
   */
  const scrollToCurrentTime = () => {
    nextTick(() => {
      const container = document.querySelector('.calendar-grid') as HTMLElement
      if (!container) return

      const now = new Date()
      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()

      // Calculate which time slot to scroll to (30-minute slots)
      const slotIndex = Math.floor((currentHour * 2) + (currentMinute >= 30 ? 1 : 0))
      const slotHeight = 30 // Each slot is 30px high

      // Calculate scroll position with some offset to show current time in upper portion
      const scrollTop = slotIndex * slotHeight - 100 // 100px offset from top

      // Scroll to the calculated position
      container.scrollTo({
        top: Math.max(0, scrollTop),
        behavior: 'smooth'
      })
    })
  }

  return {
    setupScrollSync,
    cleanupScrollSync,
    scrollToCurrentTime
  }
}
