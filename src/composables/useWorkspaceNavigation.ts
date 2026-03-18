import { computed } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'

// Navigation items that are ONLY visible in personal workspace
const PERSONAL_ONLY_ITEMS = [
  'canvas',
  'quick-sort',
  'morning',
  'today-flow',
  'mobile-today',
  'mobile-timer',
  'mobile-quick-sort',
  'mobile-ai-chat',
  'ai',
  'focus',
  'performance',
]

// Items visible in shared workspace
const SHARED_WORKSPACE_ITEMS = [
  'board',
  'calendar',
  'all-tasks',
  'catalog',
  'mobile-calendar',
]

export function useWorkspaceNavigation() {
  const workspaceStore = useWorkspaceStore()

  const isNavItemVisible = computed(() => {
    return (itemId: string): boolean => {
      if (workspaceStore.isPersonalWorkspace) return true
      // In shared workspace: hide personal-only features
      return !PERSONAL_ONLY_ITEMS.includes(itemId)
    }
  })

  const shouldRedirectToBoard = computed(() => {
    // If in shared workspace and on a personal-only route
    return !workspaceStore.isPersonalWorkspace
  })

  return {
    isNavItemVisible,
    shouldRedirectToBoard,
    PERSONAL_ONLY_ITEMS,
    SHARED_WORKSPACE_ITEMS,
  }
}
