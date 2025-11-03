import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteLocationNormalized, NavigationGuardNext } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import BoardView from '@/views/BoardView.vue'
import CalendarView from '@/views/CalendarView.vue'
import CalendarViewVueCal from '@/views/CalendarViewVueCal.vue'
import CanvasView from '@/views/CanvasView.vue'
import AllTasksView from '@/views/AllTasksView.vue'
import FocusView from '@/views/FocusView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'board',
      component: BoardView,
      meta: { requiresAuth: true }
    },
    {
      path: '/calendar',
      name: 'calendar',
      component: CalendarView,
      meta: { requiresAuth: true }
    },
    {
      path: '/canvas',
      name: 'canvas',
      component: CanvasView,
      meta: { requiresAuth: true }
    },
    {
      path: '/calendar-test',
      name: 'calendar-test',
      component: CalendarViewVueCal,
      meta: { requiresAuth: true }
    },
    {
      path: '/design-system',
      name: 'design-system',
      beforeEnter() {
        window.open('http://localhost:6006', '_blank')
      }
    },
    {
      path: '/tasks',
      name: 'all-tasks',
      component: AllTasksView,
      meta: { requiresAuth: true }
    },
    {
      path: '/focus/:taskId',
      name: 'focus',
      component: FocusView,
      meta: { requiresAuth: true }
    },
    {
      path: '/today',
      name: 'today',
      component: () => import('@/mobile/views/TodayView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/mobile',
      redirect: '/today'
    },
    {
      path: '/keyboard-test',
      name: 'keyboard-test',
      component: () => import('@/components/KeyboardDeletionTest.vue')
    }
    // TODO: Add other views when implemented
    // {
    //   path: '/todo',
    //   name: 'todo',
    //   component: () => import('@/views/TodoView.vue')
    // }
  ]
})

// Global navigation guard for authentication
router.beforeEach(async (to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext) => {
  const authStore = useAuthStore()
  const uiStore = useUIStore()

  // Check if route requires authentication
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)

  if (requiresAuth) {
    // Wait for auth to initialize if it's still loading
    if (authStore.isLoading) {
      // Wait for auth state to be determined
      const maxWaitTime = 5000 // 5 seconds max
      const startTime = Date.now()

      while (authStore.isLoading && Date.now() - startTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    if (!authStore.isAuthenticated) {
      // User is not authenticated, open auth modal
      uiStore.openAuthModal('login', to.fullPath)
      // Allow navigation to continue (user can see the app but modal will be open)
      next()
    } else {
      // User is authenticated, allow navigation
      next()
    }
  } else {
    // Route doesn't require authentication, allow navigation
    next()
  }
})

export default router