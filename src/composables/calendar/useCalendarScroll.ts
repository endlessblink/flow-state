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
   * Setup scroll synchronization between time labels and slots container
   */
  const setupScrollSync = () => {
    nextTick(() => {
      // Use .slots-container (the current calendar structure)
      calendarEventsContainer = document.querySelector('.slots-container') as HTMLElement
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
      const slotsContainer = document.querySelector('.slots-container') as HTMLElement
      const timeLabels = document.querySelector('.time-labels') as HTMLElement
      if (!slotsContainer) return

      const now = new Date()
      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()

      // Calculate scroll position: 1 minute = 1px
      const scrollTop = (currentHour * 60) + currentMinute - 100 // 100px offset from top

      // Scroll both containers to the calculated position
      slotsContainer.scrollTo({
        top: Math.max(0, scrollTop),
        behavior: 'smooth'
      })

      // Also scroll time labels to stay in sync
      if (timeLabels) {
        timeLabels.scrollTo({
          top: Math.max(0, scrollTop),
          behavior: 'smooth'
        })
      }
    })
  }

  return {
    setupScrollSync,
    cleanupScrollSync,
    scrollToCurrentTime
  }
}
