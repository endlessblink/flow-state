import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, ref } from 'vue'

/**
 * Unified Inbox sub-components: UnifiedInboxHeader, UnifiedInboxInput,
 * UnifiedInboxList, and UnifiedInboxTaskCard. Used in CanvasView to show
 * all unassigned tasks in a collapsible sidebar panel.
 * Real components: src/components/inbox/unified/
 */

// --- UnifiedInboxHeader Mock (COMPREHENSIVE - matches real component) ---
const UnifiedInboxHeaderMock = defineComponent({
  name: 'UnifiedInboxHeaderMock',
  props: {
    taskCount: { type: Number, default: 0 },
    doneTaskCount: { type: Number, default: 0 },
    activeTimeFilter: { type: String, default: 'all' },
    showGroupFilter: { type: Boolean, default: false },
    showAdvancedFilters: { type: Boolean, default: false },
    showSearch: { type: Boolean, default: false },
    searchQuery: { type: String, default: '' },
  },
  setup(props) {
    const showSearchInput = ref(props.showSearch)
    const searchValue = ref(props.searchQuery)
    const filtersExpanded = ref(props.showAdvancedFilters)
    const hideDone = ref(true)
    const activeSortBy = ref('newest')
    const activeHighPriority = ref(false)

    return { showSearchInput, searchValue, filtersExpanded, hideDone, activeSortBy, activeHighPriority }
  },
  template: `
    <div>
      <!-- Main Header Row -->
      <div style="display: flex; align-items: center; padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--glass-border); background: transparent; gap: var(--space-2); height: 44px; flex-shrink: 0; width: 100%;">
        <!-- 1. Collapse button -->
        <button style="background: none; border: 1px solid var(--border-subtle); cursor: pointer; color: var(--text-secondary); padding: var(--space-1); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; flex-shrink: 0;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>

        <!-- 2. Title -->
        <h3 style="margin: 0; font-size: var(--text-base); font-weight: var(--font-semibold); color: var(--text-primary); flex: 0 0 auto;">Inbox</h3>

        <!-- 3. Count badge -->
        <span style="padding: 2px 8px; background: rgba(99, 179, 237, 0.2); border-radius: var(--radius-full); font-size: var(--text-xs); font-weight: 600; color: rgb(99, 179, 237); flex-shrink: 0;">{{ taskCount }}</span>

        <!-- 4. Done toggle -->
        <button
          @click="hideDone = !hideDone"
          :style="{
            display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
            padding: 'var(--space-1) var(--space-2)',
            borderRadius: 'var(--radius-md)',
            border: hideDone ? '1px solid var(--border-subtle)' : '1px solid #22c55e',
            background: hideDone ? 'transparent' : 'rgba(34, 197, 94, 0.15)',
            color: hideDone ? 'var(--text-tertiary)' : '#22c55e',
            fontSize: 'var(--text-xs)', cursor: 'pointer',
            transition: 'all var(--duration-normal) var(--ease-out)',
            flexShrink: '0', minWidth: '28px', minHeight: '28px'
          }"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span :style="{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minWidth: '16px', height: '16px', padding: '0 var(--space-1)',
            borderRadius: 'var(--radius-full)',
            background: hideDone ? 'var(--surface-elevated)' : '#22c55e',
            color: hideDone ? 'var(--text-secondary)' : 'white',
            fontSize: 'var(--text-xs)', fontWeight: '600'
          }">{{ doneTaskCount }}</span>
        </button>

        <!-- 5. Time filter dropdown -->
        <button style="display: flex; align-items: center; gap: var(--space-1_5); padding: var(--space-1) var(--space-2); border-radius: var(--radius-md); border: 1px solid transparent; background: transparent; color: var(--text-secondary); font-size: var(--text-xs); cursor: pointer; transition: all var(--duration-normal) var(--ease-out); white-space: nowrap; flex-shrink: 0;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
          <span>{{ activeTimeFilter === 'all' ? 'All' : activeTimeFilter === 'today' ? 'Today' : activeTimeFilter === 'next3days' ? '3 Days' : activeTimeFilter === 'week' ? 'Week' : 'Month' }}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>

        <!-- 6. Group filter dropdown (if shown) -->
        <button v-if="showGroupFilter" style="display: flex; align-items: center; gap: var(--space-1_5); padding: var(--space-1) var(--space-2); border-radius: var(--radius-md); border: 1px solid transparent; background: transparent; color: var(--text-secondary); font-size: var(--text-xs); cursor: pointer; transition: all var(--duration-normal) var(--ease-out); white-space: nowrap; flex-shrink: 0;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>
          <span>Groups</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>

        <!-- 7. Search toggle -->
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

      <!-- 8. Search Input Row (expandable) -->
      <Transition name="slide-down">
        <div v-if="showSearchInput" style="padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--border-light); background: var(--surface-ground);">
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

      <!-- 9. Filters & Sort Toggle Button -->
      <div style="border-bottom: 1px solid var(--border-light); background: var(--surface-ground);">
        <button
          @click="filtersExpanded = !filtersExpanded"
          :style="{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 'var(--space-2)', padding: 'var(--space-2)',
            border: 'none',
            background: filtersExpanded ? 'var(--brand-primary-subtle)' : 'transparent',
            color: filtersExpanded ? 'var(--brand-primary)' : 'var(--text-muted)',
            fontSize: 'var(--text-xs)', cursor: 'pointer',
            transition: 'all var(--duration-normal)'
          }"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          <span>{{ filtersExpanded ? 'Hide filters & sort' : 'Filters & Sort' }}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :style="{ transition: 'transform var(--duration-normal) var(--ease-out)', transform: filtersExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }"><polyline points="6 9 12 15 18 9"/></svg>
        </button>

        <!-- 10. Advanced Filters Section (expandable) -->
        <Transition name="slide-down">
          <div v-if="filtersExpanded" style="display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--border-subtle);">
            <!-- Sort Row -->
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <span style="font-size: var(--text-xs); color: var(--text-muted); font-weight: 500;">Sort:</span>
              <div style="display: flex; gap: var(--space-1);">
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
              <button
                @click="activeHighPriority = !activeHighPriority"
                :style="{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
                  padding: 'var(--space-1) var(--space-2)',
                  background: activeHighPriority ? 'var(--state-active-bg)' : 'var(--glass-bg-light)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--radius-full)',
                  color: activeHighPriority ? 'var(--state-active-text)' : 'var(--text-secondary)',
                  fontSize: 'var(--text-xs)', cursor: 'pointer',
                  transition: 'all var(--duration-fast) var(--spring-smooth)',
                  whiteSpace: 'nowrap'
                }"
              >
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

              <!-- Clear all button -->
              <button style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: var(--glass-bg-light); border: 1px solid var(--glass-border); border-radius: var(--radius-full); color: var(--text-muted); cursor: pointer; transition: all var(--duration-fast) var(--spring-smooth);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  `
})

// --- UnifiedInboxTaskCard Mock ---
const UnifiedInboxTaskCardMock = defineComponent({
  name: 'UnifiedInboxTaskCardMock',
  props: {
    title: { type: String, default: 'Task title' },
    priority: { type: String, default: 'none' },
    dueDate: { type: String, default: '' },
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
      <div style="display: flex; flex-direction: column; gap: 1px; cursor: grab; opacity: 0.4; padding: 2px;">
        <span v-for="i in 3" :key="i" style="width: 10px; height: 2px; background: currentColor; border-radius: 1px;" />
      </div>
      <span :style="{
        width: '8px', height: '8px', borderRadius: '50%', flexShrink: '0',
        background: priority === 'high' ? '#ef4444' : priority === 'medium' ? '#f59e0b' : priority === 'low' ? '#3b82f6' : 'rgba(255,255,255,0.15)'
      }" />
      <span style="flex: 1; font-size: var(--text-sm); color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ title }}</span>
      <span v-if="dueDate" style="font-size: var(--text-xs); color: var(--text-tertiary); white-space: nowrap;">{{ dueDate }}</span>
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
const UnifiedInboxPanelMock = defineComponent({
  name: 'UnifiedInboxPanelMock',
  components: { UnifiedInboxHeaderMock, UnifiedInboxTaskCardMock },
  props: {
    taskCount: { type: Number, default: 4 },
    doneTaskCount: { type: Number, default: 2 },
    activeTimeFilter: { type: String, default: 'all' },
    showGroupFilter: { type: Boolean, default: false },
    showAdvancedFilters: { type: Boolean, default: false },
    showSearch: { type: Boolean, default: false },
    searchQuery: { type: String, default: '' },
    tasks: {
      type: Array as () => Array<{ id: string; title: string; priority?: string; dueDate?: string }>,
      default: () => [
        { id: '1', title: 'Review API design doc', priority: 'high', dueDate: 'Today' },
        { id: '2', title: 'Write migration script', priority: 'medium', dueDate: 'Tomorrow' },
        { id: '3', title: 'Update CI configuration', priority: 'low' },
        { id: '4', title: 'Research caching strategies' },
      ]
    }
  },
  template: `
    <div style="width: 320px; background: var(--overlay-component-bg); backdrop-filter: blur(12px); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); overflow: hidden;">
      <UnifiedInboxHeaderMock
        :taskCount="taskCount"
        :doneTaskCount="doneTaskCount"
        :activeTimeFilter="activeTimeFilter"
        :showGroupFilter="showGroupFilter"
        :showAdvancedFilters="showAdvancedFilters"
        :showSearch="showSearch"
        :searchQuery="searchQuery"
      />

      <!-- 11. Task Input Area -->
      <div style="display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3) var(--space-4);">
        <input type="text" placeholder="Add a task..." style="flex: 1; padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-sm); outline: none;" />
        <button style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: var(--glass-bg-medium); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-secondary); cursor: pointer; flex-shrink: 0;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5v14"/></svg>
        </button>
      </div>

      <!-- 12. Task List -->
      <div v-if="tasks.length > 0" style="padding: var(--space-1) var(--space-2); max-height: 400px; overflow-y: auto;">
        <UnifiedInboxTaskCardMock
          v-for="(task, i) in tasks" :key="task.id"
          :title="task.title"
          :priority="task.priority || 'none'"
          :dueDate="task.dueDate || ''"
          :isHovered="i === 0"
        />
      </div>
      <div v-else style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-8); text-align: center;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" style="opacity: 0.4; margin-bottom: var(--space-2);"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
        <p style="font-size: var(--text-sm); color: var(--text-muted); margin: 0;">No unassigned tasks</p>
      </div>
    </div>
  `
})

const meta = {
  component: UnifiedInboxPanelMock,
  title: '🎨 Canvas/Inbox/UnifiedInbox',
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
} satisfies Meta<typeof UnifiedInboxPanelMock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    taskCount: 4,
    doneTaskCount: 2,
    showAdvancedFilters: false,
  },
}

export const WithFiltersOpen: Story = {
  args: {
    taskCount: 4,
    doneTaskCount: 2,
    showAdvancedFilters: true,
  },
}

export const FilteredByPriority: Story = {
  args: {
    taskCount: 1,
    doneTaskCount: 0,
    showAdvancedFilters: true,
    tasks: [
      { id: '1', title: 'Review API design doc', priority: 'high', dueDate: 'Today' },
    ],
  },
}

export const WithSearch: Story = {
  args: {
    taskCount: 2,
    doneTaskCount: 1,
    showSearch: true,
    searchQuery: 'API',
    tasks: [
      { id: '1', title: 'Review API design doc', priority: 'high', dueDate: 'Today' },
      { id: '2', title: 'Refactor API client', priority: 'medium' },
    ],
  },
}

export const EmptyInbox: Story = {
  args: {
    taskCount: 0,
    doneTaskCount: 0,
    tasks: [],
  },
}

export const ManyTasks: Story = {
  args: {
    taskCount: 8,
    doneTaskCount: 3,
    showGroupFilter: true,
    tasks: [
      { id: '1', title: 'Fix authentication bug', priority: 'high', dueDate: 'Today' },
      { id: '2', title: 'Write unit tests', priority: 'medium', dueDate: 'Tomorrow' },
      { id: '3', title: 'Update documentation', priority: 'low' },
      { id: '4', title: 'Refactor API client' },
      { id: '5', title: 'Deploy staging', priority: 'high', dueDate: 'Friday' },
      { id: '6', title: 'Code review PR #42', priority: 'medium' },
      { id: '7', title: 'Research GraphQL migration' },
      { id: '8', title: 'Sprint retrospective notes', dueDate: 'Next week' },
    ],
  },
}
