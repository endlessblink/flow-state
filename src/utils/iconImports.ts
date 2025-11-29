/**
 * Optimized Icon Imports
 * Consolidates commonly used icon imports to reduce bundle size and improve performance
 */

import { ref, computed } from 'vue'

// Core UI icons - used across multiple components
export const coreIcons = {
  // Navigation
  ChevronDown: () => import('lucide-vue-next').then(m => ({ default: m.ChevronDown })),
  ChevronLeft: () => import('lucide-vue-next').then(m => ({ default: m.ChevronLeft })),
  ChevronRight: () => import('lucide-vue-next').then(m => ({ default: m.ChevronRight })),
  Plus: () => import('lucide-vue-next').then(m => ({ default: m.Plus })),
  X: () => import('lucide-vue-next').then(m => ({ default: m.X })),

  // Actions
  Check: () => import('lucide-vue-next').then(m => ({ default: m.Check })),
  Edit: () => import('lucide-vue-next').then(m => ({ default: m.Edit })),
  Trash2: () => import('lucide-vue-next').then(m => ({ default: m.Trash2 })),
  Copy: () => import('lucide-vue-next').then(m => ({ default: m.Copy })),
  Play: () => import('lucide-vue-next').then(m => ({ default: m.Play })),
  Pause: () => import('lucide-vue-next').then(m => ({ default: m.Pause })),
  Square: () => import('lucide-vue-next').then(m => ({ default: m.Square })),

  // Interface
  Eye: () => import('lucide-vue-next').then(m => ({ default: m.Eye })),
  EyeOff: () => import('lucide-vue-next').then(m => ({ default: m.EyeOff })),
  Settings: () => import('lucide-vue-next').then(m => ({ default: m.Settings })),
  Search: () => import('lucide-vue-next').then(m => ({ default: m.Search })),
  Calendar: () => import('lucide-vue-next').then(m => ({ default: m.Calendar })),
  CalendarDays: () => import('lucide-vue-next').then(m => ({ default: m.CalendarDays })),
  ListTodo: () => import('lucide-vue-next').then(m => ({ default: m.ListTodo })),
  Timer: () => import('lucide-vue-next').then(m => ({ default: m.Timer })),
  Clock: () => import('lucide-vue-next').then(m => ({ default: m.Clock })),

  // View controls
  AlignJustify: () => import('lucide-vue-next').then(m => ({ default: m.AlignJustify })),
  List: () => import('lucide-vue-next').then(m => ({ default: m.List })),
  LayoutList: () => import('lucide-vue-next').then(m => ({ default: m.LayoutList })),
  CheckCircle: () => import('lucide-vue-next').then(m => ({ default: m.CheckCircle })),
  Circle: () => import('lucide-vue-next').then(m => ({ default: m.Circle })),

  // Project management
  Inbox: () => import('lucide-vue-next').then(m => ({ default: m.Inbox })),
  FolderOpen: () => import('lucide-vue-next').then(m => ({ default: m.FolderOpen })),
  Filter: () => import('lucide-vue-next').then(m => ({ default: m.Filter })),
  Flag: () => import('lucide-vue-next').then(m => ({ default: m.Flag })),

  // State and status
  AlertCircle: () => import('lucide-vue-next').then(m => ({ default: m.AlertCircle })),
  RefreshCw: () => import('lucide-vue-next').then(m => ({ default: m.RefreshCw })),
  Wifi: () => import('lucide-vue-next').then(m => ({ default: m.Wifi })),
  WifiOff: () => import('lucide-vue-next').then(m => ({ default: m.WifiOff })),
  Cloud: () => import('lucide-vue-next').then(m => ({ default: m.Cloud })),
  CloudOff: () => import('lucide-vue-next').then(m => ({ default: m.CloudOff })),

  // Specialized icons
  Zap: () => import('lucide-vue-next').then(m => ({ default: m.Zap })),
  SkipForward: () => import('lucide-vue-next').then(m => ({ default: m.SkipForward })),
  Undo2: () => import('lucide-vue-next').then(m => ({ default: m.Undo2 })),
  Minimize2: () => import('lucide-vue-next').then(m => ({ default: m.Minimize2 })),
  Maximize2: () => import('lucide-vue-next').then(m => ({ default: m.Maximize2 })),
  Archive: () => import('lucide-vue-next').then(m => ({ default: m.Archive })),
  Link: () => import('lucide-vue-next').then(m => ({ default: m.Link })),
  Star: () => import('lucide-vue-next').then(m => ({ default: m.Star })),
  MoreHorizontal: () => import('lucide-vue-next').then(m => ({ default: m.MoreHorizontal })),
  CheckSquare: () => import('lucide-vue-next').then(m => ({ default: m.CheckSquare })),
  GitCompare: () => import('lucide-vue-next').then(m => ({ default: m.GitCompare })),
  Loader: () => import('lucide-vue-next').then(m => ({ default: m.Loader })),
  PauseCircle: () => import('lucide-vue-next').then(m => ({ default: m.PauseCircle })),
  FileText: () => import('lucide-vue-next').then(m => ({ default: m.FileText })),
  Activity: () => import('lucide-vue-next').then(m => ({ default: m.Activity })),
  Shield: () => import('lucide-vue-next').then(m => ({ default: m.Shield })),

  // Layout and grid
  Grid3X3: () => import('lucide-vue-next').then(m => ({ default: m.Grid3X3 })),
  LayoutGrid: () => import('lucide-vue-next').then(m => ({ default: m.LayoutGrid })),
  Rows: () => import('lucide-vue-next').then(m => ({ default: m.Rows })),

  // User and auth
  User: () => import('lucide-vue-next').then(m => ({ default: m.User })),
  LogOut: () => import('lucide-vue-next').then(m => ({ default: m.LogOut })),
  Bell: () => import('lucide-vue-next').then(m => ({ default: m.Bell })),
  Palette: () => import('lucide-vue-next').then(m => ({ default: m.Palette })),

  // Collapse/expand
  ChevronsDown: () => import('lucide-vue-next').then(m => ({ default: m.ChevronsDown })),
  ChevronsUp: () => import('lucide-vue-next').then(m => ({ default: m.ChevronsUp })),

  // Arrow controls
  ArrowRight: () => import('lucide-vue-next').then(m => ({ default: m.ArrowRight })),
  ArrowLeft: () => import('lucide-vue-next').then(m => ({ default: m.ArrowLeft })),

  // Special cases
  EyeIcon: () => import('lucide-vue-next').then(m => ({ default: m.Eye })),
  EyeOffIcon: () => import('lucide-vue-next').then(m => ({ default: m.EyeOff })),
  CheckCircleIcon: () => import('lucide-vue-next').then(m => ({ default: m.CheckCircle })),
  AlertCircleIcon: () => import('lucide-vue-next').then(m => ({ default: m.AlertCircle }))
} as const

// Icon type for better TypeScript support
export type CoreIconName = keyof typeof coreIcons

/**
 * Lazy loads an icon by name
 */
export async function loadIcon(name: CoreIconName) {
  return await coreIcons[name]()
}

/**
 * Preloads commonly used icons
 */
export function preloadCommonIcons() {
  const commonNames: CoreIconName[] = [
    'ChevronDown', 'ChevronLeft', 'ChevronRight', 'Plus', 'X',
    'Check', 'Edit', 'Eye', 'EyeOff', 'Calendar', 'Timer',
    'Play', 'Pause', 'Settings', 'Search', 'Inbox'
  ]

  return Promise.all(commonNames.map(name => loadIcon(name)))
}

/**
 * Icon import cache to prevent duplicate loading
 */
const iconCache = new Map<CoreIconName, any>()

/**
 * Cached icon loader with memory management
 */
export async function getCachedIcon(name: CoreIconName): Promise<any> {
  if (iconCache.has(name)) {
    return iconCache.get(name)
  }

  try {
    const icon = await loadIcon(name)

    // Limit cache size to prevent memory issues
    if (iconCache.size > 50) {
      const firstKey = iconCache.keys().next().value as CoreIconName
      iconCache.delete(firstKey)
    }

    iconCache.set(name, icon)
    return icon
  } catch (error) {
    console.error(`Failed to load icon: ${name}`, error)
    return null
  }
}

/**
 * Clears the icon cache (useful for memory management)
 */
export function clearIconCache() {
  iconCache.clear()
}

/**
 * Vue composable for lazy icon loading
 */
export function useLazyIcon() {
  const loading = ref<Set<CoreIconName>>(new Set())
  const error = ref<Map<CoreIconName, Error>>(new Map())

  const loadIcon = async (name: CoreIconName) => {
    if (loading.value.has(name)) {
      return iconCache.get(name)
    }

    loading.value.add(name)

    try {
      const icon = await getCachedIcon(name)
      loading.value.delete(name)
      error.value.delete(name)
      return icon
    } catch (err) {
      loading.value.delete(name)
      error.value.set(name, err as Error)
      throw err
    }
  }

  return {
    loadIcon,
    loading: computed(() => Array.from(loading.value)),
    error: computed(() => Array.from(error.value.entries())),
    isLoaded: (name: CoreIconName) => iconCache.has(name),
    isLoading: (name: CoreIconName) => loading.value.has(name),
    hasError: (name: CoreIconName) => error.value.has(name)
  }
}