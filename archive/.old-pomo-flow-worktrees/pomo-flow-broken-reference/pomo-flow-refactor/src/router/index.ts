import { createRouter, createWebHashHistory } from 'vue-router'
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
      component: BoardView
    },
    {
      path: '/calendar',
      name: 'calendar',
      component: CalendarView
    },
    {
      path: '/canvas',
      name: 'canvas',
      component: CanvasView
    },
    {
      path: '/calendar-test',
      name: 'calendar-test',
      component: CalendarViewVueCal
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
      component: AllTasksView
    },
    {
      path: '/focus/:taskId',
      name: 'focus',
      component: FocusView
    },
    {
      path: '/today',
      name: 'today',
      component: () => import('@/mobile/views/TodayView.vue')
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

export default router