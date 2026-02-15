import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, ref } from 'vue'

/**
 * ## InboxFilters
 *
 * Filter and sort controls for the canvas inbox panel.
 * Provides sort buttons (Newest, Priority, Due, Canvas) and
 * filter chips (All, Hide Done, Unscheduled, priority levels, projects).
 *
 * **Dependencies:** Task store for active filters
 *
 * **Location:** `src/components/canvas/InboxFilters.vue`
 */
const InboxFiltersMock = defineComponent({
  name: 'InboxFiltersMock',
  setup() {
    const sortBy = ref('newest')
    const hideDone = ref(false)
    const unscheduled = ref(false)
    const activePriority = ref<string | null>(null)
    return { sortBy, hideDone, unscheduled, activePriority }
  },
  template: `
    <div style="width: 300px; display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-3); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-lg);">
      <!-- Sort Row -->
      <div style="display: flex; align-items: center; gap: var(--space-2);">
        <span style="font-size: var(--text-xs); color: var(--text-muted); flex-shrink: 0;">Sort:</span>
        <div style="display: flex; gap: 2px; flex-wrap: wrap;">
          <button
            v-for="opt in [
              { key: 'newest', label: '🕐 Newest' },
              { key: 'priority', label: '🚩 Priority' },
              { key: 'dueDate', label: '📅 Due' },
              { key: 'canvasOrder', label: '📐 Canvas' },
            ]"
            :key="opt.key"
            :style="{
              padding: '2px var(--space-2)',
              fontSize: 'var(--text-xs)',
              border: sortBy === opt.key ? '1px solid var(--brand-primary)' : '1px solid transparent',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              background: sortBy === opt.key ? 'var(--brand-primary-subtle)' : 'transparent',
              color: sortBy === opt.key ? 'var(--brand-primary)' : 'var(--text-secondary)',
              fontWeight: sortBy === opt.key ? 'var(--font-medium)' : 'normal',
              transition: 'all 0.15s ease',
            }"
            @click="sortBy = opt.key"
          >{{ opt.label }}</button>
        </div>
      </div>

      <div style="height: 1px; background: var(--border-subtle);" />

      <!-- Filter Chips -->
      <div style="display: flex; gap: var(--space-1); flex-wrap: wrap;">
        <button
          :style="{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '4px var(--space-2)',
            fontSize: 'var(--text-xs)',
            border: '1px solid',
            borderColor: (!hideDone && !unscheduled && !activePriority) ? 'var(--brand-primary)' : 'var(--glass-border)',
            borderRadius: 'var(--radius-full)',
            cursor: 'pointer',
            background: (!hideDone && !unscheduled && !activePriority) ? 'rgba(78, 205, 196, 0.1)' : 'transparent',
            color: (!hideDone && !unscheduled && !activePriority) ? 'var(--brand-primary)' : 'var(--text-secondary)',
          }"
          @click="hideDone = false; unscheduled = false; activePriority = null"
        >📋 All</button>

        <button
          :style="{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '4px var(--space-2)',
            fontSize: 'var(--text-xs)',
            border: '1px solid',
            borderColor: hideDone ? 'var(--brand-primary)' : 'var(--glass-border)',
            borderRadius: 'var(--radius-full)',
            cursor: 'pointer',
            background: hideDone ? 'rgba(78, 205, 196, 0.1)' : 'transparent',
            color: hideDone ? 'var(--brand-primary)' : 'var(--text-secondary)',
          }"
          @click="hideDone = !hideDone"
        >{{ hideDone ? '✅ Hiding Done' : '☑️ Show Done' }}</button>

        <button
          :style="{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '4px var(--space-2)',
            fontSize: 'var(--text-xs)',
            border: '1px solid',
            borderColor: unscheduled ? 'var(--brand-primary)' : 'var(--glass-border)',
            borderRadius: 'var(--radius-full)',
            cursor: 'pointer',
            background: unscheduled ? 'rgba(78, 205, 196, 0.1)' : 'transparent',
            color: unscheduled ? 'var(--brand-primary)' : 'var(--text-secondary)',
          }"
          @click="unscheduled = !unscheduled"
        >📅 Unscheduled</button>

        <button
          v-for="p in [
            { key: 'high', label: '🔴 High', color: 'var(--color-priority-high)' },
            { key: 'medium', label: '🟡 Medium', color: 'var(--color-priority-medium)' },
            { key: 'low', label: '🟢 Low', color: 'var(--color-priority-low)' },
          ]"
          :key="p.key"
          :style="{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '4px var(--space-2)',
            fontSize: 'var(--text-xs)',
            border: '1px solid',
            borderColor: activePriority === p.key ? p.color : 'var(--glass-border)',
            borderRadius: 'var(--radius-full)',
            cursor: 'pointer',
            background: activePriority === p.key ? p.color + '20' : 'transparent',
            color: activePriority === p.key ? p.color : 'var(--text-secondary)',
          }"
          @click="activePriority = activePriority === p.key ? null : p.key"
        >{{ p.label }}</button>
      </div>
    </div>
  `,
})

const meta = {
  component: InboxFiltersMock,
  title: '🎨 Canvas/InboxFilters',
  tags: ['autodocs', 'new'],
  parameters: { layout: 'centered' },
  decorators: [
    (story: any) => ({
      components: { story },
      template: '<div style="padding: var(--space-6);"><story /></div>',
    }),
  ],
} satisfies Meta<typeof InboxFiltersMock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
