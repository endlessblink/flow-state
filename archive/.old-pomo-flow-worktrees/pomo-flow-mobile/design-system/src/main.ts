import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'

// Import design tokens from parent project
import '../../src/assets/design-tokens.css'
import '../../src/assets/styles.css'

// Import pages
import TokensPage from './pages/TokensPage.vue'
import IconsPage from './pages/IconsPage.vue'
import BaseComponentsPage from './pages/BaseComponentsPage.vue'
import UIComponentsPage from './pages/UIComponentsPage.vue'
import BoardPage from './pages/BoardPage.vue'
import CalendarPage from './pages/CalendarPage.vue'
import CanvasPage from './pages/CanvasPage.vue'
import ModalsPage from './pages/ModalsPage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/tokens' },
    { path: '/tokens', component: TokensPage },
    { path: '/icons', component: IconsPage },
    { path: '/base', component: BaseComponentsPage },
    { path: '/ui', component: UIComponentsPage },
    { path: '/board', component: BoardPage },
    { path: '/calendar', component: CalendarPage },
    { path: '/canvas', component: CanvasPage },
    { path: '/modals', component: ModalsPage },
  ],
  scrollBehavior() {
    return { top: 0 }
  }
})

const app = createApp(App)
app.use(router)
app.mount('#app')
