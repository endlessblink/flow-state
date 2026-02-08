<template>
  <div v-if="isOpen" class="settings-overlay" @click="$emit('close')">
    <div class="settings-modal" @click.stop>
      <header class="settings-header">
        <h2 class="settings-title">
          Settings
        </h2>
        <button class="close-btn" @click="$emit('close')">
          <X :size="16" />
        </button>
      </header>

      <div class="settings-layout">
        <aside class="settings-sidebar">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="tab-btn"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <component :is="tab.icon" :size="18" />
            <span>{{ tab.label }}</span>
          </button>
        </aside>

        <main class="settings-content">
          <Transition name="tab-fade" mode="out-in">
            <component
              :is="currentTab"
              :key="activeTab"
              @close-modal="$emit('close')"
            />
          </Transition>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { X, Timer, Palette, Layout, User, Database, Info } from 'lucide-vue-next'

// Tab components
import TimerSettingsTab from '../settings/tabs/TimerSettingsTab.vue'
import AppearanceSettingsTab from '../settings/tabs/AppearanceSettingsTab.vue'
import WorkflowSettingsTab from '../settings/tabs/WorkflowSettingsTab.vue'
import AccountSettingsTab from '../settings/tabs/AccountSettingsTab.vue'
import StorageSettingsTab from '../settings/tabs/StorageSettingsTab.vue'
import AboutSettingsTab from '../settings/tabs/AboutSettingsTab.vue'

defineProps<{
  isOpen: boolean
}>()

defineEmits<{
  close: []
}>()

const activeTab = ref('timer')

const tabs = [
  { id: 'timer', label: 'Timer', icon: Timer, component: TimerSettingsTab },
  { id: 'appearance', label: 'Appearance', icon: Palette, component: AppearanceSettingsTab },
  { id: 'workflow', label: 'Workflow', icon: Layout, component: WorkflowSettingsTab },
  { id: 'account', label: 'Account', icon: User, component: AccountSettingsTab },
  { id: 'storage', label: 'Storage', icon: Database, component: StorageSettingsTab },
  { id: 'about', label: 'About', icon: Info, component: AboutSettingsTab }
]

const currentTab = computed(() => {
  return tabs.find(t => t.id === activeTab.value)?.component
})
</script>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  backdrop-filter: blur(8px);
}

.settings-modal {
  background: linear-gradient(
    135deg,
    var(--glass-bg-medium) 0%,
    var(--glass-bg-heavy) 100%
  );
  backdrop-filter: blur(32px) saturate(200%);
  -webkit-backdrop-filter: blur(32px) saturate(200%);
  border: 1px solid var(--glass-border-strong);
  border-radius: var(--radius-2xl);
  box-shadow:
    0 32px 64px var(--shadow-xl),
    0 16px 32px var(--shadow-strong),
    inset 0 2px 0 var(--glass-border-soft);
  width: 95%;
  max-width: 720px;
  height: 600px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--glass-border-strong);
  background: var(--glass-bg-tint);
}

.settings-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  transition: all var(--duration-normal) var(--spring-smooth);
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--glass-border);
  color: var(--text-primary);
  transform: scale(1.05);
}

.settings-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.settings-sidebar {
  width: 200px;
  background: var(--glass-bg-soft);
  border-right: 1px solid var(--glass-border-strong);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
  text-align: left;
}

.tab-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

.tab-btn.active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}

.settings-content {
  flex: 1;
  padding: var(--space-6);
  overflow-y: auto;
  background: var(--glass-bg-light);
  position: relative;
}

/* Slide-Fade Transition */
.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: all 0.25s var(--spring-smooth);
}

.tab-fade-enter-from {
  opacity: 0;
  transform: translateX(12px);
}

.tab-fade-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}

@media (max-width: 640px) {
  .settings-layout {
    flex-direction: column;
  }
  
  .settings-sidebar {
    width: 100%;
    flex-direction: row;
    overflow-x: auto;
    padding: var(--space-2);
    border-right: none;
    border-bottom: 1px solid var(--glass-border-strong);
  }
  
  .tab-btn {
    flex-shrink: 0;
    padding: var(--space-2);
  }
  
  .tab-btn span {
    display: none;
  }
}
</style>