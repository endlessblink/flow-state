import { createRouter, createWebHashHistory } from 'vue-router'
import BoardView from '@/views/BoardView.vue'
import CalendarView from '@/views/CalendarView.vue'
import CalendarViewVueCal from '@/views/CalendarViewVueCal.vue'
import CanvasView from '@/views/CanvasView.vue'
import DesignSystemView from '@/views/DesignSystemView.vue'

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
      component: DesignSystemView
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