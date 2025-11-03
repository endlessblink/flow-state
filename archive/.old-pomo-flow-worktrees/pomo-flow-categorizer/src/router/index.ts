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
import QuickSortView from '@/views/QuickSortView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'board',
      component: BoardView,
      meta: { requiresAuth: false } // Temporarily disabled for development
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
      meta: { requiresAuth: false } // Temporarily disabled for development
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
      path: '/quick-sort',
      name: 'quick-sort',
      component: QuickSortView,
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

  console.log('🛣️ Router guard check:', {
    path: to.fullPath,
    requiresAuth: to.matched.some(record => record.meta.requiresAuth),
    isAuthenticated: authStore.isAuthenticated,
    isLoading: authStore.isLoading,
    modalOpen: uiStore.authModalOpen
  })

  // Check if route requires authentication
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)

  if (requiresAuth) {
    // Wait for auth to initialize if it's still loading
    if (authStore.isLoading) {
      console.log('⏳ Auth still loading, waiting...')
      // Wait for auth state to be determined
      const maxWaitTime = 5000 // 5 seconds max
      const startTime = Date.now()

      while (authStore.isLoading && Date.now() - startTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      console.log('✅ Auth loading complete, isAuthenticated:', authStore.isAuthenticated)
    }

    if (!authStore.isAuthenticated) {
      console.log('🔒 User not authenticated, checking if modal should open')
      // Only open modal if it's not already open (prevent duplicate opens)
      if (!uiStore.authModalOpen) {
        console.log('📂 Opening auth modal')
        uiStore.openAuthModal('login', to.fullPath)
      } else {
        console.log('⚠️ Auth modal already open, skipping')
      }
      // Allow navigation to continue (user can see the app but modal will be open)
      next()
    } else {
      console.log('✅ User authenticated, allowing navigation')
      // User is authenticated, allow navigation
      next()
    }
  } else {
    console.log('🌐 Route does not require auth, allowing navigation')
    // Route doesn't require authentication, allow navigation
    next()
  }
})

export default router