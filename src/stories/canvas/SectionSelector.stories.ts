import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, ref } from 'vue'

/**
 * ## SectionSelector
 *
 * Dropdown selector for choosing a canvas section/group.
 * Shows color dots, group names, and a "None (Move to Inbox)" option.
 *
 * **Dependencies:** Canvas store for section list
 *
 * **Location:** `src/components/canvas/SectionSelector.vue`
 */
const SectionSelectorMock = defineComponent({
  name: 'SectionSelectorMock',
  setup() {
    const isOpen = ref(false)
    const selected = ref<string | null>(null)
    const sections = [
      { id: '1', name: 'To Do', color: '#3b82f6' },
      { id: '2', name: 'In Progress', color: '#f59e0b' },
      { id: '3', name: 'Done', color: '#10b981' },
      { id: '4', name: 'Backlog', color: '#6b7280' },
    ]
    const selectedSection = () => sections.find(s => s.id === selected.value)
    return { isOpen, selected, sections, selectedSection }
  },
  template: `
    <div style="position: relative; width: 260px;">
      <button
        style="display: flex; align-items: center; gap: var(--space-2); width: 100%; padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); cursor: pointer; font-size: var(--text-sm);"
        @click="isOpen = !isOpen"
      >
        <template v-if="selectedSection()">
          <div :style="{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: selectedSection().color, flexShrink: 0 }" />
          <span style="flex: 1; text-align: start;">{{ selectedSection().name }}</span>
        </template>
        <span v-else style="flex: 1; text-align: start; color: var(--text-muted);">Select section...</span>
        <span style="color: var(--text-muted); transition: transform 0.2s;" :style="{ transform: isOpen ? 'rotate(180deg)' : '' }">▾</span>
      </button>

      <div v-if="isOpen" style="position: absolute; top: 100%; left: 0; right: 0; margin-top: var(--space-1); background: var(--glass-bg-medium); border: 1px solid var(--glass-border); border-radius: var(--radius-md); overflow: hidden; z-index: 10; box-shadow: var(--shadow-lg);">
        <div
          style="display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); cursor: pointer; font-size: var(--text-sm); color: var(--text-secondary); border-bottom: 1px solid var(--border-subtle);"
          :style="{ background: !selected ? 'var(--surface-hover)' : '' }"
          @click="selected = null; isOpen = false"
        >
          <span>📥</span>
          <span>None (Move to Inbox)</span>
        </div>
        <div
          v-for="section in sections"
          :key="section.id"
          style="display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); cursor: pointer; font-size: var(--text-sm); color: var(--text-primary);"
          :style="{ background: selected === section.id ? 'var(--surface-hover)' : '' }"
          @click="selected = section.id; isOpen = false"
        >
          <div :style="{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: section.color, flexShrink: 0 }" />
          <span>{{ section.name }}</span>
        </div>
      </div>
    </div>
  `,
})

const meta = {
  component: SectionSelectorMock,
  title: '🎨 Canvas/SectionSelector',
  tags: ['autodocs', 'new'],
  parameters: { layout: 'centered' },
  decorators: [
    (story: any) => ({
      components: { story },
      template: '<div style="padding: var(--space-8);"><story /></div>',
    }),
  ],
} satisfies Meta<typeof SectionSelectorMock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
