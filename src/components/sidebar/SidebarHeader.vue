<template>
  <div class="sidebar-header">
    <div class="app-brand">
      <AppLogo size="md" />
      <span class="brand-text">FlowState</span>
    </div>
    <BaseButton variant="secondary" size="md" @click="sidebar.openCreateProject">
      <Plus :size="14" />
      {{ $t('sidebar.create_project') }}
    </BaseButton>

    <div class="icon-button-group">
      <button
        class="icon-btn"
        :title="$t('sidebar.hide_sidebar')"
        :aria-label="$t('sidebar.hide_sidebar')"
        @click="uiStore.toggleMainSidebar"
      >
        <PanelLeftClose :size="18" />
      </button>

      <button
        class="icon-btn"
        :title="$t('common.settings')"
        :aria-label="$t('sidebar.open_settings')"
        @click="uiStore.openSettingsModal()"
      >
        <Settings :size="18" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUIStore } from '@/stores/ui'
import { useSidebarManagement } from '@/composables/app/useSidebarManagement'
import { Plus, PanelLeftClose, Settings } from 'lucide-vue-next'
import BaseButton from '@/components/base/BaseButton.vue'
import AppLogo from '@/components/base/AppLogo.vue'

const uiStore = useUIStore()
const sidebar = useSidebarManagement()
</script>

<style scoped>
.sidebar-header {
  padding: var(--space-10) var(--space-6) var(--space-6) var(--space-6);
  background: var(--glass-bg-medium);
}

.app-brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
}

.brand-icon {
  font-size: var(--text-xl);
}

.brand-text {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

/* Sidebar header buttons */
.sidebar-header button {
  width: 100%;
}

/* Icon button group */
.icon-button-group {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.icon-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-secondary);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.icon-btn:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  color: var(--text-primary);
  box-shadow: var(--state-hover-shadow);
}

.icon-btn:active {
  transform: scale(0.95);
}
</style>
