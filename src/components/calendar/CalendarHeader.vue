<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight, Calendar, Eye, EyeOff, SlidersHorizontal, RefreshCw, Repeat, MoreVertical } from 'lucide-vue-next'
import ProjectFilterDropdown from '@/components/projects/ProjectFilterDropdown.vue'
import BasePopover from '@/components/base/BasePopover.vue'

defineProps<{
  formatCurrentDate: string
  hideCalendarDoneTasks: boolean
  showFutureRecurring: boolean
  viewMode: 'day' | 'week' | 'month'
  externalCalendarEnabled?: boolean
  externalCalendarLoading?: boolean
  googleConnected?: boolean
  showGoogleEvents?: boolean
}>()

defineEmits<{
  (e: 'previousDay'): void
  (e: 'nextDay'): void
  (e: 'goToToday'): void
  (e: 'toggleDoneTasks'): void
  (e: 'toggleFutureRecurring'): void
  (e: 'update:viewMode', value: 'day' | 'week' | 'month'): void
  (e: 'syncExternalCalendar'): void
  (e: 'toggleGoogleEvents'): void
  (e: 'syncGoogleCalendar'): void
}>()

useI18n()

// TASK-157: Filters hidden by default for cleaner look
const showFilters = ref(false)

// TASK-1418: View Options Dropdown
const showViewOptions = ref(false)
const viewOptionsTriggerRef = ref<HTMLElement>()
const popoverX = ref(0)
const popoverY = ref(0)

const toggleViewOptions = () => {
  if (viewOptionsTriggerRef.value) {
    const rect = viewOptionsTriggerRef.value.getBoundingClientRect()
    popoverX.value = rect.left + rect.width / 2 // Center of trigger for position="bottom"
    popoverY.value = rect.bottom + 4
  }
  showViewOptions.value = !showViewOptions.value
}
</script>

<template>
  <!-- TASK-157: Simplified Todoist-style calendar header -->
  <div class="calendar-header calendar-header--minimal">
    <div class="date-navigation">
      <button
        class="nav-btn"
        :title="$t('calendar.previous_day')"
        :aria-label="$t('calendar.previous_day')"
        @click="$emit('previousDay')"
      >
        <ChevronLeft :size="16" :stroke-width="1.5" />
      </button>
      <h2 class="current-date">
        {{ formatCurrentDate }}
      </h2>
      <button
        class="nav-btn"
        :title="$t('calendar.next_day')"
        :aria-label="$t('calendar.next_day')"
        @click="$emit('nextDay')"
      >
        <ChevronRight :size="16" :stroke-width="1.5" />
      </button>
    </div>
    <div class="header-actions header-actions--minimal">
      <button class="today-btn today-btn--minimal" @click="$emit('goToToday')">
        <Calendar :size="18" :stroke-width="1.5" />
        {{ $t('calendar.today') }}
      </button>

      <!-- TASK-1418: View Options Dropdown trigger -->
      <button
        ref="viewOptionsTriggerRef"
        class="view-options-trigger"
        :class="{ active: showViewOptions || showFilters || hideCalendarDoneTasks || showFutureRecurring }"
        title="View options"
        aria-label="View options"
        @click="toggleViewOptions"
      >
        <MoreVertical :size="16" :stroke-width="1.5" />
      </button>

      <!-- TASK-1418: View Options Popover -->
      <BasePopover
        :is-visible="showViewOptions"
        :x="popoverX"
        :y="popoverY"
        position="bottom"
        variant="menu"
        :close-on-click-outside="true"
        @close="showViewOptions = false"
      >
        <div class="view-options-menu">
          <!-- Project Filters -->
          <button
            class="view-option-item"
            :class="{ active: showFilters }"
            @click="showFilters = !showFilters"
          >
            <SlidersHorizontal :size="16" :stroke-width="1.5" class="option-icon" />
            <span class="option-label">{{ $t('calendar.toggle_filters') }}</span>
            <span v-if="showFilters" class="option-indicator" />
          </button>

          <!-- Hide/Show Completed -->
          <button
            class="view-option-item"
            :class="{ active: hideCalendarDoneTasks }"
            @click="$emit('toggleDoneTasks')"
          >
            <EyeOff
              v-if="hideCalendarDoneTasks"
              :size="16"
              :stroke-width="1.5"
              class="option-icon"
            />
            <Eye
              v-else
              :size="16"
              :stroke-width="1.5"
              class="option-icon"
            />
            <span class="option-label">{{ hideCalendarDoneTasks ? $t('calendar.show_completed') : $t('calendar.hide_completed') }}</span>
            <span v-if="hideCalendarDoneTasks" class="option-indicator" />
          </button>

          <!-- Future Recurring -->
          <button
            class="view-option-item"
            :class="{ active: showFutureRecurring }"
            @click="$emit('toggleFutureRecurring')"
          >
            <Repeat :size="16" :stroke-width="1.5" class="option-icon" />
            <span class="option-label">{{ showFutureRecurring ? 'Hide future recurring' : 'Show future recurring' }}</span>
            <span v-if="showFutureRecurring" class="option-indicator" />
          </button>

          <!-- Sync External Calendar (conditional) -->
          <button
            v-if="externalCalendarEnabled"
            class="view-option-item"
            :class="{ syncing: externalCalendarLoading }"
            @click="$emit('syncExternalCalendar')"
          >
            <RefreshCw
              :size="16"
              :stroke-width="1.5"
              class="option-icon"
              :class="{ spinning: externalCalendarLoading }"
            />
            <span class="option-label">{{ $t('calendar.sync_external') }}</span>
          </button>

          <!-- Google Calendar Toggle (conditional) -->
          <button
            v-if="googleConnected"
            class="view-option-item"
            :class="{ active: showGoogleEvents }"
            @click="$emit('toggleGoogleEvents')"
          >
            <Eye
              v-if="showGoogleEvents"
              :size="16"
              :stroke-width="1.5"
              class="option-icon"
            />
            <EyeOff
              v-else
              :size="16"
              :stroke-width="1.5"
              class="option-icon"
            />
            <span class="option-label">Google Calendar</span>
            <span v-if="showGoogleEvents" class="option-indicator" />
          </button>
        </div>
      </BasePopover>

      <div class="view-selector view-selector--minimal">
        <button
          class="view-btn"
          :class="{ active: viewMode === 'day' }"
          @click="$emit('update:viewMode', 'day')"
        >
          {{ $t('calendar.day') }}
        </button>
        <button
          class="view-btn"
          :class="{ active: viewMode === 'week' }"
          @click="$emit('update:viewMode', 'week')"
        >
          {{ $t('calendar.week') }}
        </button>
        <button
          class="view-btn"
          :class="{ active: viewMode === 'month' }"
          @click="$emit('update:viewMode', 'month')"
        >
          {{ $t('calendar.month') }}
        </button>
      </div>
    </div>
  </div>

  <!-- Collapsible Filter Bar -->
  <Transition name="slide-down">
    <div v-if="showFilters" class="filter-bar">
      <!-- Project Filter -->
      <ProjectFilterDropdown />
    </div>
  </Transition>
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

/* TASK-1418: View Options Dropdown */
.view-options-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.view-options-trigger:hover {
  background: var(--glass-bg-heavy);
  color: var(--text-primary);
}

.view-options-trigger.active {
  color: var(--brand-primary);
}

.view-options-menu {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 220px;
}

.view-option-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  text-align: start;
  width: 100%;
}

.view-option-item:hover {
  background: var(--glass-bg-light);
  border-color: var(--glass-border);
}

.view-option-item.active {
  color: var(--brand-primary);
}

.view-option-item .option-icon {
  flex-shrink: 0;
  color: currentColor;
}

.view-option-item .option-label {
  flex: 1;
}

.option-indicator {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--brand-primary);
  flex-shrink: 0;
}

.view-option-item .spinning {
  animation: spin 1s linear infinite;
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

/* TASK-157: Minimal Calendar Header Styles */
.calendar-header--minimal {
  padding: var(--space-2) var(--space-4);
  background: transparent;
  backdrop-filter: none;
  border-bottom: none;
  box-shadow: none;
}

.header-actions--minimal {
  gap: var(--space-2);
}

.today-btn--minimal {
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-sm);
  background: transparent;
  border: none;
}

.today-btn--minimal:hover {
  background: var(--glass-bg-heavy);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.view-selector--minimal {
  background: transparent;
  backdrop-filter: none;
  border: none;
  box-shadow: none;
  padding: 0;
  gap: var(--space-1);
}

.view-selector--minimal .view-btn {
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-sm);
}

.view-selector--minimal .view-btn.active {
  background: var(--color-indigo-bg-medium);
  border: none;
  box-shadow: none;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  background: var(--overlay-light);
  border-bottom: 1px solid var(--border-subtle);
}

/* Slide-down transition */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all var(--duration-normal) var(--ease-out);
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.slide-down-enter-to,
.slide-down-leave-from {
  max-height: 60px;
}

</style>
