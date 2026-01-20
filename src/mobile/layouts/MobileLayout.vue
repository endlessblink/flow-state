<template>
  <div class="mobile-layout">
    <header class="mobile-header">
       <h1>FlowState</h1>
    </header>
    <main class="mobile-content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <MobileNav />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import MobileNav from '@/mobile/components/MobileNav.vue'

const router = useRouter()
const route = useRoute()

onMounted(() => {
  // Redirect Canvas (/) to Inbox (/tasks) on mobile
  if (route.path === '/' || route.name === 'canvas') {
    router.replace('/tasks')
  }
})
</script>

<style scoped>
.mobile-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: var(--app-background-gradient);
  overflow: hidden;
}

.mobile-header {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg-medium);
  backdrop-filter: blur(var(--blur-md));
  border-bottom: 1px solid var(--glass-border);
  z-index: 10;
}

.mobile-header h1 {
  font-size: var(--text-lg);
  font-weight: 800;
  margin: 0;
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.mobile-content {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 80px; /* Space for nav */
  position: relative;
  -webkit-overflow-scrolling: touch;
}
</style>
