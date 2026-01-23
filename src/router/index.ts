import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteLocationNormalized as _RouteLocationNormalized, NavigationGuardNext as _NavigationGuardNext } from 'vue-router' // SECURITY: App is now 100% Supabase standard
import { useAuthStore } from '@/stores/auth'

// Mobile detection helper (mirrors useMobileDetection.ts logic)
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  const userAgent = navigator.userAgent || navigator.vendor || (window as typeof window & { opera?: string }).opera || ''
  const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())
  const isSmallScreen = window.matchMedia('(max-width: 768px)').matches
  return isMobileUA || isSmallScreen
}

// Mobile route to desktop equivalent mapping
const mobileToDesktopRedirects: Record<string, string> = {
  'mobile-quick-sort': 'quick-sort',
  'mobile-today': 'canvas',
  'mobile-timer': 'canvas',
}

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'canvas',
      component: () => import('@/views/CanvasView.vue'),
      meta: { requiresAuth: false } // Temporarily disabled for development
    },
    {
      path: '/board',
      name: 'board',
      component: () => import('@/views/BoardView.vue'),
      meta: { requiresAuth: false } // Temporarily disabled for development
    },
    {
      path: '/canvas',
      redirect: '/'
    },
    {
      path: '/calendar',
      name: 'calendar',
      component: () => import('@/views/CalendarView.vue'),
      meta: { requiresAuth: false } // Temporarily disabled for development
    },
    {
      path: '/calendar-test',
      name: 'calendar-test',
      component: () => import('@/views/CalendarViewVueCal.vue'),
      meta: { requiresAuth: false } // Temporarily disabled for development
    },
    {
      path: '/design-system',
      name: 'design-system',
      beforeEnter() {
        window.open('http://localhost:6006', '_blank')
        return false
      },
      redirect: '/'
    },
    {
      path: '/tasks',
      name: 'all-tasks',
      component: () => import('@/views/AllTasksView.vue'),
      meta: { requiresAuth: false } // Temporarily disabled for development
    },
    {
      path: '/timer',
      name: 'mobile-timer',
      component: () => import('@/mobile/views/MobileTimerView.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/today',
      name: 'mobile-today',
      component: () => import('@/mobile/views/MobileTodayView.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/catalog',
      name: 'catalog',
      component: () => import('@/views/AllTasksView.vue'),
      meta: { requiresAuth: false } // Temporarily disabled for development to match other views
    },
    {
      path: '/quick-sort',
      name: 'quick-sort',
      component: () => import('@/views/QuickSortView.vue'),
      meta: { requiresAuth: false } // Temporarily disabled for development
    },
    {
      path: '/mobile-quick-sort',
      name: 'mobile-quick-sort',
      component: () => import('@/mobile/views/MobileQuickSortView.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/focus/:taskId',
      name: 'focus',
      component: () => import('@/views/FocusView.vue'),
      props: true,
      meta: { requiresAuth: true }
    },
    {
      path: '/keyboard-test',
      name: 'keyboard-test',
      component: () => import('@/components/debug/KeyboardDeletionTest.vue')
    },
    {
      path: '/performance',
      name: 'performance',
      component: () => import('@/views/PerformanceView.vue'),
      meta: { requiresAdmin: true }
    },
    // TODO: Add other views when implemented
    // {
    //   path: '/todo',
    //   name: 'todo',
    //   component: () => import('@/views/TodoView.vue')
    // }
  ]
})

// Global authentication guard
router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()

  // Ensure user is initialized
  if (!authStore.isInitialized) {
    await authStore.initialize()
  }

  // BUG-1014: Redirect desktop users away from mobile-only routes
  const routeName = to.name as string
  if (routeName && routeName in mobileToDesktopRedirects && !isMobileDevice()) {
    const desktopRoute = mobileToDesktopRedirects[routeName]
    console.log(`🛣️ [BUG-1014] Desktop user on mobile route "${routeName}" - redirecting to "${desktopRoute}"`)
    next({ name: desktopRoute })
    return
  }

  // Check if route requires authentication
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    console.log('🛣️ Route requires authentication - redirecting to board')
    next({ name: 'board' })
    return
  }

  // Check if route requires admin privileges
  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    console.warn('👮 Access denied: Route requires Admin privileges')
    next({ name: 'board' })
    return
  }

  next()
})

export default router