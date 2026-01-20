<template>
  <nav class="mobile-nav">
    <router-link to="/tasks" class="nav-item" active-class="active">
      <InboxIcon />
      <span>Inbox</span>
    </router-link>
    
    <router-link to="/calendar" class="nav-item" active-class="active">
      <CalendarIcon />
      <span>Calendar</span>
    </router-link>
    
    <div class="nav-item" @click="handleMore">
        <MenuIcon />
        <span>Menu</span>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { Inbox as InboxIcon, Calendar as CalendarIcon, Menu as MenuIcon } from 'lucide-vue-next'

const handleMore = () => {
    // Todo: Open mobile sidebar or settings
    console.log('Open more menu')
}
</script>

<style scoped>
.mobile-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: var(--surface-primary);
  border-top: 1px solid var(--border-subtle);
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 1000;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 100%;
  color: var(--text-tertiary);
  text-decoration: none;
  font-size: 0.75rem;
  gap: 4px;
  transition: color 0.2s ease;
  cursor: pointer;
}

.nav-item.active {
  color: var(--primary-brand);
}

.nav-item :deep(svg) {
  width: 24px;
  height: 24px;
  stroke-width: 2px;
}
</style>
