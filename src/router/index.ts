import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteLocationNormalized as _RouteLocationNormalized, NavigationGuardNext as _NavigationGuardNext } from 'vue-router' // SECURITY: App is now 100% Supabase standard
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'board',
      component: () => import('@/views/BoardView.vue'),
      meta: { requiresAuth: false } // Temporarily disabled for development
    },
    {
      path: '/calendar',
      name: 'calendar',
      component: () => import('@/views/CalendarView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/canvas',
      name: 'canvas',
      component: () => import('@/views/CanvasView.vue'),
      meta: { requiresAuth: false } // Temporarily disabled for development
    },
    {
      path: '/calendar-test',
      name: 'calendar-test',
      component: () => import('@/views/CalendarViewVueCal.vue'),
      meta: { requiresAuth: true }
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
      meta: { requiresAuth: true }
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
      meta: { requiresAuth: true }
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