import type { Meta, StoryObj } from '@storybook/vue3'
import { ref, computed, defineComponent, h } from 'vue'

// Design tokens matching KDE widget palette
const bgColor = '#232034'
const textColor = '#E2E8F0'
const mutedColor = '#7E7590'
const workColor = '#4ECDC4'

const filterOptions = ['All', 'Todo', 'In Progress', 'Done', 'Pinned']
const sortOptions = ['Newest', 'Oldest', 'Priority', 'Due Date', 'Alphabetical']

const SortFilterControls = defineComponent({
  name: 'SortFilterControls',
  props: {
    filter: { type: String, default: 'All' },
    sort: { type: String, default: 'Newest' },
    taskCount: { type: Number, default: 12 },
    searchQuery: { type: String, default: '' },
    isSearching: { type: Boolean, default: false },
  },
  setup(props) {
    const localSearch = ref(props.searchQuery)
    const filterOpen = ref(false)
    const sortOpen = ref(false)
    const searchFocused = ref(false)
    const clearHovered = ref(false)
    const localFilter = ref(props.filter)
    const localSort = ref(props.sort)

    const countLabel = computed(() => {
      if (props.isSearching && localSearch.value) {
        return `${props.taskCount}/${12} tasks`
      }
      return `${props.taskCount} tasks`
    })

    return {
      localSearch,
      filterOpen,
      sortOpen,
      searchFocused,
      clearHovered,
      localFilter,
      localSort,
      countLabel,
    }
  },
  render() {
    const p = this.$props as any

    // ── Shared dropdown style ────────────────────────────────────────────────
    const dropdownBoxStyle = {
      width: '85px',
      height: '26px',
      borderRadius: '5px',
      background: 'rgba(28, 26, 46, 0.9)',
      border: '1px solid rgba(255, 255, 255, 0.10)',
      color: textColor,
      fontSize: '11px',
      padding: '0 6px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      cursor: 'pointer',
      userSelect: 'none' as const,
      flexShrink: '0',
    }

    const labelStyle = {
      fontSize: '9px',
      color: mutedColor,
      whiteSpace: 'nowrap' as const,
    }

    const filterDropdown = h('div', { style: { display: 'flex', alignItems: 'center', gap: '5px' } }, [
      h('span', { style: labelStyle }, 'Filter:'),
      h('div', { style: dropdownBoxStyle }, [
        h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, this.localFilter),
        h('span', { style: { color: mutedColor, fontSize: '9px', marginLeft: '4px', flexShrink: '0' } }, '▾'),
      ]),
    ])

    const sortDropdown = h('div', { style: { display: 'flex', alignItems: 'center', gap: '5px' } }, [
      h('span', { style: labelStyle }, 'Sort:'),
      h('div', { style: dropdownBoxStyle }, [
        h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, this.localSort),
        h('span', { style: { color: mutedColor, fontSize: '9px', marginLeft: '4px', flexShrink: '0' } }, '▾'),
      ]),
    ])

    // ── Task count badge ─────────────────────────────────────────────────────
    const countBadge = h('div', {
      style: {
        marginLeft: 'auto',
        fontSize: '10px',
        color: mutedColor,
        whiteSpace: 'nowrap',
        flexShrink: '0',
      },
    }, this.countLabel)

    // ── Filter/Sort row ──────────────────────────────────────────────────────
    const controlsRow = h('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      },
    }, [
      filterDropdown,
      sortDropdown,
      countBadge,
    ])

    // ── Search box ───────────────────────────────────────────────────────────
    const hasClear = this.localSearch.length > 0

    const searchBox = h('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        height: '30px',
        borderRadius: '6px',
        background: 'rgba(28, 26, 46, 0.9)',
        border: this.searchFocused
          ? `1px solid ${workColor}`
          : '1px solid rgba(255, 255, 255, 0.10)',
        padding: '0 8px',
        transition: 'border-color 0.15s',
      },
    }, [
      // Search icon
      h('span', {
        style: { fontSize: '12px', color: mutedColor, flexShrink: '0', lineHeight: '1' },
      }, '🔍'),

      // Input (simulated — no real input element to avoid Storybook form issues)
      h('div', {
        style: {
          flex: '1',
          fontSize: '11px',
          color: this.localSearch ? textColor : 'rgba(255, 255, 255, 0.3)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          cursor: 'text',
        },
      }, this.localSearch || 'Search tasks...'),

      // Clear button (only when text present)
      hasClear ? h('div', {
        style: {
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          background: this.clearHovered ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '9px',
          color: mutedColor,
          cursor: 'pointer',
          flexShrink: '0',
          transition: 'background 0.15s',
        },
        onMouseenter: () => { this.clearHovered = true },
        onMouseleave: () => { this.clearHovered = false },
      }, '✕') : null,
    ])

    return h('div', {
      style: {
        width: '440px',
        fontFamily: 'Noto Sans, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      },
    }, [
      controlsRow,
      searchBox,
    ])
  },
})

const meta: Meta<typeof SortFilterControls> = {
  title: 'KDE Widget/SortFilterControls',
  component: SortFilterControls,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: bgColor },
        { name: 'desktop', value: '#1a1825' },
      ],
    },
  },
  argTypes: {
    filter: {
      control: 'select',
      options: filterOptions,
    },
    sort: {
      control: 'select',
      options: sortOptions,
    },
    taskCount: { control: { type: 'range', min: 0, max: 50, step: 1 } },
    searchQuery: { control: 'text' },
    isSearching: { control: 'boolean' },
  },
  decorators: [
    (story) => ({
      setup() { return {} },
      render() {
        return h('div', {
          style: { padding: '16px', background: bgColor, borderRadius: '8px' },
        }, [h(story())])
      },
    }),
  ],
}

export default meta
type Story = StoryObj<typeof SortFilterControls>

export const Default: Story = {
  args: {
    filter: 'All',
    sort: 'Newest',
    taskCount: 12,
    searchQuery: '',
    isSearching: false,
  },
}

export const Filtered: Story = {
  args: {
    filter: 'Todo',
    sort: 'Priority',
    taskCount: 5,
    searchQuery: '',
    isSearching: false,
  },
}

export const Searching: Story = {
  args: {
    filter: 'All',
    sort: 'Newest',
    taskCount: 3,
    searchQuery: 'landing',
    isSearching: true,
  },
}

export const EmptyResults: Story = {
  args: {
    filter: 'All',
    sort: 'Newest',
    taskCount: 0,
    searchQuery: 'xyz',
    isSearching: true,
  },
}
