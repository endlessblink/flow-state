<template>
  <!-- LEFT SIDEBAR NAVIGATION -->
  <Transition name="sidebar-slide">
    <aside
      v-if="uiStore"
      v-show="uiStore.mainSidebarVisible"
      class="sidebar"
      aria-label="Main navigation"
      :aria-hidden="!uiStore.mainSidebarVisible"
    >
      <SidebarHeader />
      <SidebarWorkspaceSwitcher v-if="workspaceStore.shouldShowSwitcher" />
      <SidebarQuickTaskInput ref="quickTaskInput" />

      <div class="task-management-section">
        <SidebarSmartViews />
        <SidebarDurationSection />
        <SidebarProjectsSection />
      </div>

      <SidebarUserFooter />
    </aside>
  </Transition>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useWorkspaceStore } from '@/stores/workspace'
import SidebarHeader from '@/components/sidebar/SidebarHeader.vue'
import SidebarWorkspaceSwitcher from '@/components/sidebar/SidebarWorkspaceSwitcher.vue'
import SidebarQuickTaskInput from '@/components/sidebar/SidebarQuickTaskInput.vue'
import SidebarSmartViews from '@/components/sidebar/SidebarSmartViews.vue'
import SidebarDurationSection from '@/components/sidebar/SidebarDurationSection.vue'
import SidebarProjectsSection from '@/components/sidebar/SidebarProjectsSection.vue'
import SidebarUserFooter from '@/components/sidebar/SidebarUserFooter.vue'

const uiStore = useUIStore()
const workspaceStore = useWorkspaceStore()

// Quick Task Input ref (for forwarding focusQuickTask)
const quickTaskInput = ref<InstanceType<typeof SidebarQuickTaskInput> | null>(null)

// Expose focus method - forwarded through SidebarQuickTaskInput
defineExpose({
  focusQuickTask: () => {
    quickTaskInput.value?.focusInput()
  }
})
</script>

<style scoped>
/* LEFT SIDEBAR - Glass effect */
.sidebar {
  min-width: 240px;
  max-width: 340px;
  width: 100%;
  background: linear-gradient(
    135deg,
    var(--glass-bg-subtle) 0%,
    rgba(255, 255, 255, 0.01) 100%
  );
  backdrop-filter: blur(40px) saturate(200%);
  -webkit-backdrop-filter: blur(40px) saturate(200%);
  border-inline-end: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: relative;
  z-index: 100;
  box-shadow:
    var(--shadow-2xl),
    inset -1px 0 0 var(--glass-bg-heavy);
  contain: style; /* BUG-1696: WebKitGTK fix - removed 'layout' containment which collapses flex children to 24px in wry 0.54.1 */
  overflow: hidden;
}

/* Sidebar toggle transitions */
.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition: transform var(--duration-slow) cubic-bezier(0.4, 0, 0.2, 1),
              opacity 300ms cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, opacity;
}

.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.sidebar-slide-enter-to,
.sidebar-slide-leave-from {
  transform: translateX(0);
  opacity: 1;
}

[dir="rtl"] .sidebar-slide-enter-from,
[dir="rtl"] .sidebar-slide-leave-to {
  transform: translateX(100%);
}

.task-management-section {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4) var(--space-6);
}
</style>
