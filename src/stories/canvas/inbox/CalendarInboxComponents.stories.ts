import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, ref } from 'vue'

/**
 * Calendar Inbox sub-components: CalendarInboxHeader, CalendarInboxInput,
 * CalendarInboxList, and CalendarTaskCard. Used in CalendarView sidebar
 * to show and manage tasks for a selected date.
 * Real components: src/components/inbox/calendar/
 */

// --- CalendarInboxHeader Mock (COMPREHENSIVE - matches real component) ---
const CalendarInboxHeaderMock = defineComponent({
  name: 'CalendarInboxHeaderMock',
  props: {
    inboxCount: { type: Number, default: 3 },
    todayCount: { type: Number, default: 1 },
    showTodayOnly: { type: Boolean, default: false },
    showAdvancedFilters: { type: Boolean, default: false },
    showSearch: { type: Boolean, default: false },
    searchQuery: { type: String, default: '' },
  },
  setup(props) {
    const showSearchInput = ref(props.showSearch)
    const searchValue = ref(props.searchQuery)
    const filtersExpanded = ref(props.showAdvancedFilters)
    const activeSortBy = ref('newest')
    const todayFilterActive = ref(props.showTodayOnly)

    return { showSearchInput, searchValue, filtersExpanded, activeSortBy, todayFilterActive }
  },
  template: `
    <div>
      <!-- Main Header Row -->
      <div style="display: flex; align-items: center; gap: var(--space-2); padding-bottom: var(--space-3); border-bottom: 1px solid var(--border-subtle); min-width: 0;">
        <!-- Collapse button -->
        <button style="background: transparent; border: 1px solid var(--border-medium); color: var(--text-muted); padding: var(--space-1); cursor: pointer; border-radius: var(--radius-md); transition: all var(--duration-normal) var(--spring-smooth); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>

        <!-- Title -->
        <h3 style="font-size: var(--text-base); font-weight: var(--font-semibold); color: var(--text-primary); margin: 0; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Inbox</h3>

        <!-- Count badge -->
        <span style="padding: 2px 8px; background: rgba(99, 179, 237, 0.2); border-radius: var(--radius-full); font-size: var(--text-xs); font-weight: 600; color: rgb(99, 179, 237); flex-shrink: 0;">{{ inboxCount }}</span>

        <!-- Quick Today Filter -->
        <button
          @click="todayFilterActive = !todayFilterActive"
          :style="{
            display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
            padding: 'var(--space-1) var(--space-2)',
            background: todayFilterActive ? 'var(--brand-bg-subtle)' : 'var(--glass-bg-light)',
            backdropFilter: 'blur(8px)',
            border: todayFilterActive ? '1px solid var(--brand-border-subtle)' : '1px solid var(--glass-border)',
            borderRadius: 'var(--radius-full)',
            color: todayFilterActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
            fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)',
            cursor: 'pointer', transition: 'all var(--duration-fast) var(--spring-smooth)',
            whiteSpace: 'nowrap', flexShrink: '0'
          }"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
          <span>Today</span>
          <span v-if="todayCount > 0" :style="{
            background: 'var(--brand-primary-subtle)',
            border: '1px solid var(--brand-primary-dim)',
            color: 'var(--brand-primary)',
            fontSize: 'var(--text-xs)',
            padding: '0 var(--space-1)',
            borderRadius: 'var(--radius-full)',
            minWidth: '16px',
            textAlign: 'center'
          }">{{ todayCount }}</span>
        </button>

        <!-- Search toggle -->
        <button
          @click="showSearchInput = !showSearchInput"
          :style="{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '28px', height: '28px', padding: 'var(--space-1)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            background: showSearchInput ? 'var(--brand-primary-subtle)' : 'transparent',
            color: showSearchInput ? 'var(--brand-primary)' : 'var(--text-tertiary)',
            cursor: 'pointer', transition: 'all var(--duration-normal) var(--ease-out)',
            flexShrink: '0'
          }"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </button>
      </div>

      <!-- Search Input Row (expandable) -->
      <Transition name="slide-down">
        <div v-if="showSearchInput" style="padding: var(--space-2) 0; border-bottom: 1px solid var(--border-light);">
          <div style="display: flex; align-items: center; gap: var(--space-2); padding: var(--space-1_5) var(--space-2); background: var(--surface-1); border: 1px solid var(--border-color); border-radius: var(--radius-md); transition: all var(--duration-normal) var(--ease-out);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2" style="flex-shrink: 0;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              v-model="searchValue"
              type="text"
              placeholder="Search tasks..."
              style="flex: 1; border: none; background: transparent; color: var(--text-primary); font-size: var(--text-sm); outline: none; min-width: 0;"
            />
            <button v-if="searchValue" style="display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; padding: 0; border: none; border-radius: var(--radius-sm); background: var(--surface-hover); color: var(--text-secondary); cursor: pointer; transition: all var(--duration-fast) var(--ease-out); flex-shrink: 0;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      </Transition>

      <!-- More Filters Toggle Button -->
      <div>
        <button
          @click="filtersExpanded = !filtersExpanded"
          style="display: flex; align-items: center; gap: var(--space-2); background: none; border: none; color: var(--text-secondary); font-size: var(--text-xs); cursor: pointer; padding: var(--space-1) 0; width: 100%;"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          <span>{{ filtersExpanded ? 'Hide filters' : 'More filters' }}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :style="{ transition: 'transform var(--duration-normal)', transform: filtersExpanded ? 'rotate(180deg)' : 'rotate(0deg)', marginLeft: 'auto' }"><polyline points="6 9 12 15 18 9"/></svg>
        </button>

        <!-- Advanced Filters Section (expandable) -->
        <Transition name="slide-down">
          <div v-if="filtersExpanded" style="display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--border-subtle);">
            <!-- Sort Row -->
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <span style="font-size: var(--text-xs); color: var(--text-muted); font-weight: 500;">Sort:</span>
              <div style="display: flex; gap: var(--space-1); flex-wrap: wrap;">
                <button
                  v-for="sort in ['Newest', 'Priority', 'Due', 'Canvas']"
                  :key="sort"
                  @click="activeSortBy = sort.toLowerCase()"
                  :style="{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
                    padding: 'var(--space-1) var(--space-2)',
                    background: activeSortBy === sort.toLowerCase() ? 'var(--state-active-bg)' : 'transparent',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-md)',
                    color: activeSortBy === sort.toLowerCase() ? 'var(--state-active-text)' : 'var(--text-secondary)',
                    fontSize: 'var(--text-xs)', cursor: 'pointer',
                    transition: 'all var(--duration-fast) var(--spring-smooth)'
                  }"
                >
                  <svg v-if="sort === 'Newest'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <svg v-if="sort === 'Priority'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>
                  <svg v-if="sort === 'Due'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                  <svg v-if="sort === 'Canvas'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
                  {{ sort }}
                </button>
              </div>
            </div>

            <div style="height: 1px; background: var(--border-subtle); margin: var(--space-1) 0;" />

            <!-- Filter Chips Row -->
            <div style="display: flex; flex-wrap: wrap; gap: var(--space-2);">
              <!-- Priority filter chip -->
              <button style="display: flex; align-items: center; gap: var(--space-1); padding: var(--space-1) var(--space-2); background: var(--glass-bg-light); border: 1px solid var(--glass-border); border-radius: var(--radius-full); color: var(--text-secondary); font-size: var(--text-xs); cursor: pointer; transition: all var(--duration-fast) var(--spring-smooth); white-space: nowrap;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444;" />
                High
              </button>

              <!-- Unscheduled chip -->
              <button style="display: flex; align-items: center; gap: var(--space-1); padding: var(--space-1) var(--space-2); background: var(--glass-bg-light); border: 1px solid var(--glass-border); border-radius: var(--radius-full); color: var(--text-secondary); font-size: var(--text-xs); cursor: pointer; transition: all var(--duration-fast) var(--spring-smooth); white-space: nowrap;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                Unscheduled
              </button>

              <!-- Duration chips -->
              <button style="display: flex; align-items: center; gap: var(--space-1); padding: var(--space-1) var(--space-2); background: var(--glass-bg-light); border: 1px solid var(--glass-border); border-radius: var(--radius-full); color: var(--text-secondary); font-size: var(--text-xs); cursor: pointer; transition: all var(--duration-fast) var(--spring-smooth); white-space: nowrap;">
                <span>⚡</span>
                Quick
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  `
})

// --- CalendarTaskCard Mock ---
const CalendarTaskCardMock = defineComponent({
  name: 'CalendarTaskCardMock',
  props: {
    title: { type: String, default: 'Task title' },
    priority: { type: String, default: 'none' },
    status: { type: String, default: 'planned' },
    isHovered: { type: Boolean, default: false },
  },
  template: `
    <div :style="{
      display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
      padding: 'var(--space-2) var(--space-3)',
      background: isHovered ? 'var(--glass-bg-light)' : 'transparent',
      borderRadius: 'var(--radius-md)',
      cursor: 'pointer', transition: 'background 0.15s ease'
    }">
      <span :style="{
        width: '8px', height: '8px', borderRadius: '50%', flexShrink: '0',
        background: priority === 'high' ? '#ef4444' : priority === 'medium' ? '#f59e0b' : priority === 'low' ? '#3b82f6' : 'rgba(255,255,255,0.15)'
      }" />
      <span style="flex: 1; font-size: var(--text-sm); color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ title }}</span>
      <span :style="{
        padding: '1px 6px', borderRadius: 'var(--radius-sm)', fontSize: '10px', fontWeight: '500',
        background: status === 'done' ? 'rgba(16,185,129,0.15)' : status === 'active' ? 'rgba(59,130,246,0.15)' : 'var(--glass-bg-medium)',
        color: status === 'done' ? 'var(--success)' : status === 'active' ? 'var(--info)' : 'var(--text-muted)',
        textTransform: 'capitalize', flexShrink: '0'
      }">{{ status }}</span>
      <div v-if="isHovered" style="display: flex; gap: 2px;">
        <button style="width: 20px; height: 20px; background: transparent; border: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm);">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
        <button style="width: 20px; height: 20px; background: transparent; border: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm);">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
      </div>
    </div>
  `
})

// --- Full Panel Mock ---
const CalendarInboxPanelMock = defineComponent({
  name: 'CalendarInboxPanelMock',
  components: { CalendarInboxHeaderMock, CalendarTaskCardMock },
  props: {
    selectedDate: { type: String, default: 'February 13, 2026' },
    inboxCount: { type: Number, default: 3 },
    todayCount: { type: Number, default: 1 },
    showTodayOnly: { type: Boolean, default: false },
    showAdvancedFilters: { type: Boolean, default: false },
    showSearch: { type: Boolean, default: false },
    searchQuery: { type: String, default: '' },
    tasks: {
      type: Array as () => Array<{ id: string; title: string; priority?: string; status?: string }>,
      default: () => [
        { id: '1', title: 'Morning standup', priority: 'medium', status: 'done' },
        { id: '2', title: 'Code review session', priority: 'high', status: 'active' },
        { id: '3', title: 'Write sprint summary', priority: 'low', status: 'planned' },
      ]
    },
  },
  template: `
    <div style="width: 320px; background: var(--overlay-component-bg); backdrop-filter: blur(12px); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); overflow: hidden; padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3);">
      <!-- Header -->
      <CalendarInboxHeaderMock
        :inboxCount="inboxCount"
        :todayCount="todayCount"
        :showTodayOnly="showTodayOnly"
        :showAdvancedFilters="showAdvancedFilters"
        :showSearch="showSearch"
        :searchQuery="searchQuery"
      />

      <!-- Input -->
      <div style="display: flex; align-items: center; gap: var(--space-2);">
        <input type="text" placeholder="Add task for this date..." style="flex: 1; padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-sm); outline: none;" />
        <button style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: var(--glass-bg-medium); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-secondary); cursor: pointer; flex-shrink: 0;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5v14"/></svg>
        </button>
      </div>

      <!-- Task list -->
      <div v-if="tasks.length > 0" style="flex: 1; overflow-y: auto; max-height: 400px;">
        <CalendarTaskCardMock
          v-for="(task, i) in tasks" :key="task.id"
          :title="task.title"
          :priority="task.priority || 'none'"
          :status="task.status || 'planned'"
          :isHovered="i === 1"
        />
      </div>

      <!-- Empty state -->
      <div v-else style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-8); text-align: center;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" style="opacity: 0.4; margin-bottom: var(--space-2);"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
        <p style="font-size: var(--text-sm); color: var(--text-muted); margin: 0;">No tasks for this date</p>
      </div>
    </div>
  `
})

const meta = {
  component: CalendarInboxPanelMock,
  title: '🎨 Canvas/Inbox/CalendarInbox',
  tags: ['autodocs', 'new'],

  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [{ name: 'dark', value: 'var(--bg-primary)' }],
    },
  },

  decorators: [
    (story: any) => ({
      components: { story },
      template: `
        <div style="padding: var(--space-6);">
          <story />
        </div>
      `,
    })
  ],
} satisfies Meta<typeof CalendarInboxPanelMock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    inboxCount: 3,
    todayCount: 1,
  },
}

export const WithFiltersOpen: Story = {
  args: {
    inboxCount: 3,
    todayCount: 1,
    showAdvancedFilters: true,
  },
}

export const TodayOnly: Story = {
  args: {
    inboxCount: 1,
    todayCount: 1,
    showTodayOnly: true,
    tasks: [
      { id: '1', title: 'Code review session', priority: 'high', status: 'active' },
    ],
  },
}

export const WithSearch: Story = {
  args: {
    inboxCount: 2,
    todayCount: 1,
    showSearch: true,
    searchQuery: 'code',
    tasks: [
      { id: '1', title: 'Code review session', priority: 'high', status: 'active' },
      { id: '2', title: 'Code refactoring', priority: 'medium', status: 'planned' },
    ],
  },
}

export const EmptyDate: Story = {
  args: {
    selectedDate: 'March 1, 2026',
    inboxCount: 0,
    todayCount: 0,
    tasks: [],
  },
}

export const BusyDay: Story = {
  args: {
    selectedDate: 'February 14, 2026',
    inboxCount: 6,
    todayCount: 3,
    tasks: [
      { id: '1', title: 'Sprint planning meeting', priority: 'high', status: 'active' },
      { id: '2', title: 'Deploy v1.3.0 to production', priority: 'high', status: 'planned' },
      { id: '3', title: 'Review design mockups', priority: 'medium', status: 'done' },
      { id: '4', title: 'Update database indexes', priority: 'medium', status: 'planned' },
      { id: '5', title: 'Write changelog', priority: 'low', status: 'planned' },
      { id: '6', title: 'Team retrospective', priority: 'low', status: 'planned' },
    ],
  },
}

export const AllDone: Story = {
  args: {
    selectedDate: 'February 12, 2026',
    inboxCount: 3,
    todayCount: 0,
    tasks: [
      { id: '1', title: 'Morning standup', priority: 'medium', status: 'done' },
      { id: '2', title: 'Fix CSS alignment', priority: 'low', status: 'done' },
      { id: '3', title: 'Merge feature branch', priority: 'high', status: 'done' },
    ],
  },
}
