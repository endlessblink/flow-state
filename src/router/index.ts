import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteLocationNormalized as _RouteLocationNormalized, NavigationGuardNext as _NavigationGuardNext } from 'vue-router' // SECURITY: App is now 100% Supabase standard
import { useAuthStore } from '@/stores/auth'
import { EXTERNAL_URLS } from '@/config/urls'
import { openExternal } from '@/utils/openExternal'
import { MOBILE_BREAKPOINT_PX } from '@/constants/breakpoints'

// Mobile detection helper (mirrors useMobileDetection.ts logic)
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  const userAgent = navigator.userAgent || navigator.vendor || (window as typeof window & { opera?: string }).opera || ''
  const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())
  const isSmallScreen = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`).matches
  return isMobileUA || isSmallScreen
}

// Mobile route to desktop equivalent mapping
const mobileToDesktopRedirects: Record<string, string> = {
  'mobile-quick-sort': 'quick-sort',
  'mobile-today': 'canvas',
  'mobile-timer': 'canvas',
  'mobile-ai-chat': 'ai',
  'mobile-calendar': 'calendar',
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
        openExternal(EXTERNAL_URLS.STORYBOOK_DEV)
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
      path: '/ai',
      name: 'ai',
      component: () => import('@/views/AIHubView.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/mobile-quick-sort',
      name: 'mobile-quick-sort',
      component: () => import('@/mobile/views/MobileQuickSortView.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/mobile-ai-chat',
      name: 'mobile-ai-chat',
      component: () => import('@/mobile/views/MobileAIChatView.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/mobile-calendar',
      name: 'mobile-calendar',
      component: () => import('@/mobile/views/MobileCalendarView.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/focus/:taskId',
      name: 'focus',
      component: () => import('@/views/FocusView.vue'),
      props: true,
      meta: { requiresAuth: false }
    },
    {
      path: '/today-flow',
      name: 'today-flow',
      component: () => import('@/views/TodayFlowView.vue'),
      meta: { requiresAuth: false }
    },
    // Only include debug routes in development
    ...(import.meta.env.DEV ? [
      {
        path: '/keyboard-test',
        name: 'keyboard-test',
        component: () => import('@/components/debug/KeyboardDeletionTest.vue')
      }
    ] : []),
    {
      path: '/ai-chat',
      redirect: '/ai'
    },
    {
      path: '/performance',
      name: 'performance',
      component: () => import('@/views/PerformanceView.vue'),
      meta: { requiresAdmin: true }
    },
    {
      path: '/invite/:token',
      name: 'invite-accept',
      component: () => import('@/views/InviteAcceptView.vue'),
      meta: { requiresAuth: false }
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

  // Workspace navigation guard: redirect from personal-only routes in shared workspace
  try {
    const { useWorkspaceStore } = await import('@/stores/workspace')
    const workspaceStore = useWorkspaceStore()
    if (!workspaceStore.isPersonalWorkspace && routeName) {
      const PERSONAL_ONLY_ROUTES = ['canvas', 'quick-sort', 'today-flow', 'ai', 'focus', 'performance', 'mobile-today', 'mobile-timer', 'mobile-quick-sort', 'mobile-ai-chat']
      if (PERSONAL_ONLY_ROUTES.includes(routeName)) {
        console.log(`[WORKSPACE] Redirecting from personal route "${routeName}" to board (shared workspace)`)
        next({ name: 'board' })
        return
      }
    }
  } catch {
    // Workspace store not ready yet — allow navigation
  }

  next()
})

// Handle dynamic import failures gracefully (BUG-1184)
// After a deploy, old chunk hashes are removed from the VPS.
// Browsers/service workers that cached old index.html will request stale chunk URLs → 404.
// Fix: detect chunk load failure and force a full page reload to get fresh index.html + SW.
router.onError((error, to, _from) => {
  const isChunkError =
    error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('Loading chunk') ||
    error.message.includes('Loading CSS chunk') ||
    error.message.includes('error loading dynamically imported module')

  if (isChunkError) {
    console.error('[BUG-1184] Chunk load failed — reloading to get fresh assets:', error.message)

    // Prevent infinite reload loops: only auto-reload once per session
    const reloadKey = 'chunk-reload-' + to.fullPath
    if (!sessionStorage.getItem(reloadKey)) {
      sessionStorage.setItem(reloadKey, Date.now().toString())
      // Unregister stale service worker before reloading
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          for (const registration of registrations) {
            registration.unregister()
          }
          window.location.assign(window.location.href)
        }).catch(() => {
          window.location.assign(window.location.href)
        })
      } else {
        window.location.assign(window.location.href)
      }
    } else {
      // Already reloaded once for this route — show error to user
      console.error('[BUG-1184] Chunk reload already attempted for', to.fullPath)
      window.dispatchEvent(new CustomEvent('route-load-error', {
        detail: { error, route: to.fullPath }
      }))
    }
  }
})

export default router