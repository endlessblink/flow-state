<script setup lang="ts">
import { ChevronLeft, ChevronRight, Calendar, Eye, EyeOff } from 'lucide-vue-next'
import ProjectFilterDropdown from '@/components/projects/ProjectFilterDropdown.vue'

defineProps<{
  formatCurrentDate: string
  hideCalendarDoneTasks: boolean
  viewMode: 'day' | 'week' | 'month'
}>()

defineEmits<{
  (e: 'previousDay'): void
  (e: 'nextDay'): void
  (e: 'goToToday'): void
  (e: 'toggleDoneTasks'): void
  (e: 'update:viewMode', value: 'day' | 'week' | 'month'): void
}>()
</script>

<template>
  <div class="calendar-header">
    <div class="date-navigation">
      <button class="nav-btn" title="Previous Day" @click="$emit('previousDay')">
        <ChevronLeft :size="16" :stroke-width="1.5" />
      </button>
      <h2 class="current-date">
        {{ formatCurrentDate }}
      </h2>
      <button class="nav-btn" title="Next Day" @click="$emit('nextDay')">
        <ChevronRight :size="16" :stroke-width="1.5" />
      </button>
    </div>
    <div class="header-actions">
      <button class="today-btn" @click="$emit('goToToday')">
        <Calendar :size="16" :stroke-width="1.5" />
        Today
      </button>

      <!-- Project Filter -->
      <ProjectFilterDropdown />

      <!-- Hide Done Tasks Toggle (TASK-076) -->
      <button
        class="hide-done-toggle"
        :class="{ active: hideCalendarDoneTasks }"
        :title="hideCalendarDoneTasks ? 'Show completed tasks' : 'Hide completed tasks'"
        @click="$emit('toggleDoneTasks')"
      >
        <EyeOff v-if="hideCalendarDoneTasks" :size="16" :stroke-width="1.5" />
        <Eye v-else :size="16" :stroke-width="1.5" />
        <span>{{ hideCalendarDoneTasks ? 'Hidden' : 'Done' }}</span>
      </button>

      <div class="view-selector">
        <button
          class="view-btn"
          :class="{ active: viewMode === 'day' }"
          @click="$emit('update:viewMode', 'day')"
        >
          Day
        </button>
        <button
          class="view-btn"
          :class="{ active: viewMode === 'week' }"
          @click="$emit('update:viewMode', 'week')"
        >
          Week
        </button>
        <button
          class="view-btn"
          :class="{ active: viewMode === 'month' }"
          @click="$emit('update:viewMode', 'month')"
        >
          Month
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar-header {
  position: sticky;
  top: 0;
  z-index: 200; /* Above all calendar content and events */
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-6) var(--space-8);
  /* Glassy background to ensure visibility when sticky but keep gradient */
  background: var(--glass-panel-bg);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-sm);
}

.date-navigation {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.nav-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-subtle);
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.nav-btn:hover {
  background: var(--glass-bg-hover);
  border-color: var(--border-hover);
  transform: translateY(-1px);
}

.current-date {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  min-width: 240px;
  text-align: center;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.today-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-subtle);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.today-btn:hover {
  background: var(--glass-bg-hover);
  border-color: var(--border-hover);
  transform: translateY(-1px);
}

.hide-done-toggle {
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-md);
  position: relative;
  z-index: 1000;
  pointer-events: auto;
  user-select: none;
}

.hide-done-toggle:hover {
  background: linear-gradient(
    135deg,
    var(--state-hover-bg) 0%,
    var(--glass-bg-soft) 100%
  );
  border-color: var(--state-hover-border);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.hide-done-toggle.active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  color: var(--state-active-text);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.view-selector {
  display: flex;
  gap: var(--space-1);
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-1);
  box-shadow: inset var(--shadow-sm);
}

.view-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.view-btn:hover {
  color: var(--text-primary);
  background: var(--glass-bg-heavy);
}

.view-btn.active {
  background: var(--state-active-bg);
  border: 1px solid var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  color: var(--text-primary);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}
</style>
