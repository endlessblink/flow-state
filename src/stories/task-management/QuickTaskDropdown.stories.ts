import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent } from 'vue'

/**
 * QuickTaskDropdown - Timer companion dropdown for quick task selection.
 * Shows pinned and frequent tasks, allows pinning new tasks, and starts timers.
 * Appears next to the Pomodoro timer in the header.
 * Real component: src/components/timer/QuickTaskDropdown.vue
 */
const QuickTaskDropdownMock = defineComponent({
  name: 'QuickTaskDropdownMock',
  props: {
    isOpen: { type: Boolean, default: true },
    pinnedTasks: {
      type: Array as () => Array<{ id: string; title: string; projectColor?: string }>,
      default: () => []
    },
    frequentTasks: {
      type: Array as () => Array<{ id: string; title: string; frequency: number; projectColor?: string }>,
      default: () => []
    },
    inputValue: { type: String, default: '' },
    focusedIndex: { type: Number, default: -1 },
  },
  template: `
    <div style="position: relative; display: flex; align-items: center;">
      <!-- Trigger Button -->
      <button style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: transparent; border: none; color: var(--text-muted); border-radius: var(--radius-6); cursor: pointer;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      </button>

      <!-- Dropdown -->
      <div v-if="isOpen" style="position: absolute; top: 36px; left: 50%; transform: translateX(-50%); width: 280px; background: var(--overlay-component-bg); backdrop-filter: blur(12px); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); box-shadow: 0 8px 32px rgba(0,0,0,0.4); padding: var(--space-2) 0; z-index: 100; max-height: 400px; overflow-y: auto;">
        <!-- Quick Add Input -->
        <div style="display: flex; align-items: center; gap: var(--space-1); padding: var(--space-1-5) var(--space-3);">
          <input
            :value="inputValue"
            type="text"
            placeholder="Pin a new quick task..."
            style="flex: 1; background: var(--glass-bg-medium); border: 1px solid var(--glass-bg-heavy); border-radius: var(--radius-md); padding: var(--space-1-5) var(--space-2); font-size: var(--text-sm); color: var(--text-primary); outline: none;"
          />
          <button v-if="inputValue.trim()" style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: var(--glass-bg-heavy); border: 1px solid var(--glass-border); border-radius: var(--radius-md); cursor: pointer; color: var(--text-secondary); flex-shrink: 0;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5v14"/></svg>
          </button>
        </div>

        <div v-if="pinnedTasks.length > 0 || frequentTasks.length > 0" style="height: 1px; background: var(--glass-bg-heavy); margin: var(--space-1) 0;" />

        <!-- Pinned Section -->
        <template v-if="pinnedTasks.length > 0">
          <div style="display: flex; align-items: center; gap: var(--space-1-5); padding: var(--space-1-5) var(--space-3); font-size: var(--text-xs); font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.6;"><path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1h1V4H7v2h1a1 1 0 0 1 1 1z"/></svg>
            <span>Pinned</span>
          </div>
          <div v-for="(task, index) in pinnedTasks" :key="task.id"
            :style="{
              display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)', cursor: 'pointer',
              background: focusedIndex === index ? 'var(--glass-bg-heavy)' : 'transparent'
            }"
          >
            <span v-if="task.projectColor" :style="{ width: '8px', height: '8px', borderRadius: '50%', background: task.projectColor, flexShrink: '0' }" />
            <span style="flex: 1; font-size: var(--text-sm); color: var(--text-primary); word-break: break-word;">{{ task.title }}</span>
            <button style="display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; background: transparent; border: none; border-radius: var(--radius-sm); cursor: pointer; color: var(--text-muted); flex-shrink: 0;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
            <button style="display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; background: transparent; border: none; border-radius: var(--radius-sm); cursor: pointer; color: var(--text-muted); flex-shrink: 0;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
          </div>
        </template>

        <!-- Frequent Section -->
        <template v-if="frequentTasks.length > 0">
          <div v-if="pinnedTasks.length > 0" style="height: 1px; background: var(--glass-bg-heavy); margin: var(--space-1) 0;" />
          <div style="display: flex; align-items: center; gap: var(--space-1-5); padding: var(--space-1-5) var(--space-3); font-size: var(--text-xs); font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.6;"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
            <span>Frequent</span>
          </div>
          <div v-for="(task, index) in frequentTasks" :key="task.id"
            :style="{
              display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)', cursor: 'pointer',
              background: focusedIndex === (pinnedTasks.length + index) ? 'var(--glass-bg-heavy)' : 'transparent'
            }"
          >
            <span v-if="task.projectColor" :style="{ width: '8px', height: '8px', borderRadius: '50%', background: task.projectColor, flexShrink: '0' }" />
            <span style="flex: 1; font-size: var(--text-sm); color: var(--text-primary); word-break: break-word;">{{ task.title }}</span>
            <span style="display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 18px; padding: 0 4px; background: var(--glass-bg-heavy); border-radius: var(--radius-md); font-size: var(--text-xs); font-weight: 700; color: var(--text-muted); flex-shrink: 0;">{{ task.frequency }}</span>
            <button style="display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; background: transparent; border: none; border-radius: var(--radius-sm); cursor: pointer; color: var(--text-muted); flex-shrink: 0;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
          </div>
        </template>

        <!-- Empty State -->
        <div v-if="pinnedTasks.length === 0 && frequentTasks.length === 0 && !inputValue.trim()" style="display: flex; align-items: center; justify-content: center; padding: var(--space-3) var(--space-4); color: var(--text-muted); font-size: var(--text-xs); text-align: center; opacity: 0.7;">
          <span>Type above to pin your common tasks</span>
        </div>
      </div>
    </div>
  `
})

const meta = {
  component: QuickTaskDropdownMock,
  title: '⏱️ Timer/QuickTaskDropdown',
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
        <div style="padding: var(--space-16) var(--space-6) var(--space-6); min-height: 500px;">
          <story />
        </div>
      `,
    })
  ],
} satisfies Meta<typeof QuickTaskDropdownMock>

export default meta
type Story = StoryObj<typeof meta>

export const EmptyState: Story = {
  args: {
    isOpen: true,
    pinnedTasks: [],
    frequentTasks: [],
  },
}

export const WithPinnedTasks: Story = {
  args: {
    isOpen: true,
    pinnedTasks: [
      { id: '1', title: 'Deep work session', projectColor: '#4ecdc4' },
      { id: '2', title: 'Code review', projectColor: '#ff6b6b' },
      { id: '3', title: 'Write documentation' },
    ],
    frequentTasks: [],
  },
}

export const WithFrequentTasks: Story = {
  args: {
    isOpen: true,
    pinnedTasks: [],
    frequentTasks: [
      { id: '1', title: 'Bug triage', frequency: 12, projectColor: '#ff6b6b' },
      { id: '2', title: 'Sprint planning', frequency: 8, projectColor: '#4ecdc4' },
      { id: '3', title: 'Email processing', frequency: 5 },
    ],
  },
}

export const MixedPinnedAndFrequent: Story = {
  args: {
    isOpen: true,
    pinnedTasks: [
      { id: '1', title: 'Deep work session', projectColor: '#4ecdc4' },
      { id: '2', title: 'Daily standup notes', projectColor: '#f59e0b' },
    ],
    frequentTasks: [
      { id: '3', title: 'Bug triage', frequency: 12, projectColor: '#ff6b6b' },
      { id: '4', title: 'Sprint planning', frequency: 8 },
    ],
  },
}

export const WithInputValue: Story = {
  args: {
    isOpen: true,
    inputValue: 'New quick task',
    pinnedTasks: [
      { id: '1', title: 'Existing pinned task', projectColor: '#4ecdc4' },
    ],
    frequentTasks: [],
  },
}

export const WithFocusedItem: Story = {
  args: {
    isOpen: true,
    focusedIndex: 1,
    pinnedTasks: [
      { id: '1', title: 'Deep work session', projectColor: '#4ecdc4' },
      { id: '2', title: 'Code review (focused)', projectColor: '#ff6b6b' },
      { id: '3', title: 'Write documentation' },
    ],
    frequentTasks: [],
  },
}

export const Closed: Story = {
  args: {
    isOpen: false,
  },
}
