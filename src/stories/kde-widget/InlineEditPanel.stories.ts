import type { Meta, StoryObj } from '@storybook/vue3'
import { ref, defineComponent, h } from 'vue'

// Design tokens matching KDE widget palette
const bgColor = '#232034'
const textColor = '#E2E8F0'
const mutedColor = '#7E7590'
const workColor = '#4ECDC4'

const InlineEditPanel = defineComponent({
  name: 'InlineEditPanel',
  props: {
    taskTitle: { type: String, default: 'Design the landing page' },
    status: { type: String, default: 'todo' },
    priority: { type: String, default: 'medium' },
    dueDate: { type: String, default: '2026-03-10' },
    isSaving: { type: Boolean, default: false },
    editError: { type: String, default: '' },
    confirmingDelete: { type: Boolean, default: false },
  },
  setup(props) {
    const saveHovered = ref(false)
    const cancelHovered = ref(false)
    const deleteHovered = ref(false)
    const openHovered = ref(false)
    const activeChip = ref<string | null>(null)

    return { saveHovered, cancelHovered, deleteHovered, openHovered, activeChip }
  },
  render() {
    const p = this.$props as any

    // ── Task row (editing state) ────────────────────────────────────────────
    const taskRow = h('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 12px',
        borderRadius: '6px',
        background: 'rgba(46, 41, 69, 0.5)',
        border: '1px solid rgba(78, 205, 196, 0.3)',
        direction: 'ltr',
      },
    }, [
      // Done toggle
      h('div', {
        style: {
          width: '22px', height: '22px', borderRadius: '50%',
          border: `1.5px solid ${mutedColor}`, background: 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', color: mutedColor, flexShrink: '0',
        },
      }, '✓'),
      // Play
      h('div', {
        style: {
          width: '22px', height: '22px', borderRadius: '50%', background: 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', color: workColor, flexShrink: '0',
        },
      }, '▶'),
      // Pin
      h('div', {
        style: {
          width: '22px', height: '22px', borderRadius: '50%', background: 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', flexShrink: '0',
        },
      }, '📌'),
      // Title
      h('div', {
        style: {
          flex: '1', minWidth: '0', fontSize: '13px', color: textColor,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          direction: 'ltr', textAlign: 'left',
        },
      }, p.taskTitle),
    ])

    // ── Separator ───────────────────────────────────────────────────────────
    const separator = h('div', {
      style: {
        height: '1px',
        background: 'rgba(255, 255, 255, 0.08)',
        margin: '8px 0',
      },
    })

    // ── Shared dropdown style factory ───────────────────────────────────────
    const dropdownStyle = {
      flex: '1',
      height: '32px',
      borderRadius: '4px',
      background: 'rgba(46, 41, 69, 0.6)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      color: textColor,
      fontSize: '11px',
      padding: '0 6px',
      appearance: 'none' as const,
      WebkitAppearance: 'none' as const,
      outline: 'none',
      cursor: 'pointer',
    }

    const labelStyle = {
      fontSize: '10px',
      color: mutedColor,
      marginBottom: '6px',
    }

    const fieldCol = (label: string, value: string) =>
      h('div', { style: { flex: '1', display: 'flex', flexDirection: 'column' } }, [
        h('div', { style: labelStyle }, label),
        h('div', {
          style: {
            ...dropdownStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            userSelect: 'none',
          },
        }, [
          h('span', {}, value),
          h('span', { style: { color: mutedColor, fontSize: '9px' } }, '▾'),
        ]),
      ])

    // ── Row 1 — Status + Priority ────────────────────────────────────────────
    const row1 = h('div', { style: { display: 'flex', gap: '8px' } }, [
      fieldCol('Status', p.status),
      fieldCol('Priority', p.priority),
    ])

    // ── Row 2 — Due Date ─────────────────────────────────────────────────────
    const dueDateLabel = p.dueDate ? p.dueDate : 'No due date'
    const row2 = h('div', { style: { display: 'flex', flexDirection: 'column' } }, [
      h('div', { style: labelStyle }, 'Due Date'),
      h('div', {
        style: {
          ...dropdownStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          userSelect: 'none',
        },
      }, [
        h('span', { style: { color: p.dueDate ? textColor : mutedColor } }, dueDateLabel),
        h('span', { style: { color: mutedColor, fontSize: '9px' } }, '▾'),
      ]),
    ])

    // ── Row 2b — Duration chips ──────────────────────────────────────────────
    const chips = ['15m', '30m', '1h', '2h', '3h']
    const row2b = h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' } }, [
      h('span', { style: { fontSize: '10px', color: mutedColor, whiteSpace: 'nowrap' } }, 'Set due:'),
      ...chips.map(chip =>
        h('div', {
          key: chip,
          style: {
            height: '22px',
            padding: '0 10px',
            borderRadius: '11px',
            background: this.activeChip === chip ? 'rgba(78, 205, 196, 0.15)' : 'rgba(255, 255, 255, 0.06)',
            border: this.activeChip === chip ? `1px solid ${workColor}` : '1px solid rgba(255, 255, 255, 0.1)',
            color: this.activeChip === chip ? workColor : textColor,
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s',
            userSelect: 'none',
          },
          onMouseenter: () => { this.activeChip = chip },
          onMouseleave: () => { this.activeChip = null },
        }, chip)
      ),
    ])

    // ── Row 3 — Action buttons ───────────────────────────────────────────────
    const saveBtn = h('div', {
      style: {
        width: '60px',
        height: '28px',
        borderRadius: '5px',
        background: 'rgba(78, 205, 196, 0.10)',
        border: `1px solid ${workColor}`,
        color: workColor,
        fontSize: '11px',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: p.isSaving ? 'wait' : 'pointer',
        flexShrink: '0',
        opacity: p.isSaving ? 0.7 : 1,
      },
      onMouseenter: () => { this.saveHovered = true },
      onMouseleave: () => { this.saveHovered = false },
    }, p.isSaving ? '...' : 'Save')

    const cancelBtn = h('div', {
      style: {
        width: '60px',
        height: '28px',
        borderRadius: '5px',
        background: 'rgba(255, 255, 255, 0.04)',
        border: `1px solid ${mutedColor}`,
        color: mutedColor,
        fontSize: '11px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: '0',
      },
    }, 'Cancel')

    const deleteLabel = p.confirmingDelete ? 'Confirm?' : 'Perm. Delete'
    const deleteWidth = p.confirmingDelete ? '90px' : '95px'
    const deleteBtn = h('div', {
      style: {
        width: deleteWidth,
        height: '28px',
        borderRadius: '5px',
        background: 'rgba(248, 113, 113, 0.1)',
        border: '1px solid #F87171',
        color: '#F87171',
        fontSize: '11px',
        fontWeight: p.confirmingDelete ? 'bold' : 'normal',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: '0',
      },
    }, deleteLabel)

    const openLink = h('div', {
      style: {
        marginLeft: 'auto',
        fontSize: '11px',
        color: workColor,
        cursor: 'pointer',
        textDecoration: this.openHovered ? 'underline' : 'none',
        whiteSpace: 'nowrap',
      },
      onMouseenter: () => { this.openHovered = true },
      onMouseleave: () => { this.openHovered = false },
    }, 'Open in App →')

    const row3 = h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
      saveBtn,
      cancelBtn,
      deleteBtn,
      openLink,
    ])

    // ── Error text ───────────────────────────────────────────────────────────
    const errorEl = p.editError
      ? h('div', {
          style: {
            fontSize: '10px',
            color: '#F87171',
            lineHeight: '1.4',
            wordBreak: 'break-word',
          },
        }, p.editError)
      : null

    // ── Edit panel ────────────────────────────────────────────────────────────
    const editPanel = h('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        paddingTop: '16px',
      },
    }, [
      separator,
      row1,
      row2,
      row2b,
      row3,
      errorEl,
    ])

    return h('div', {
      style: {
        width: '440px',
        fontFamily: 'Noto Sans, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
      },
    }, [
      taskRow,
      editPanel,
    ])
  },
})

const meta: Meta<typeof InlineEditPanel> = {
  title: 'KDE Widget/InlineEditPanel',
  component: InlineEditPanel,
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
    taskTitle: { control: 'text' },
    status: {
      control: 'select',
      options: ['planned', 'todo', 'in_progress', 'done'],
    },
    priority: {
      control: 'select',
      options: ['none', 'low', 'medium', 'high'],
    },
    dueDate: { control: 'text' },
    isSaving: { control: 'boolean' },
    editError: { control: 'text' },
    confirmingDelete: { control: 'boolean' },
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
type Story = StoryObj<typeof InlineEditPanel>

export const Default: Story = {
  args: {
    taskTitle: 'Design the landing page',
    status: 'todo',
    priority: 'medium',
    dueDate: '2026-03-10',
    isSaving: false,
    editError: '',
    confirmingDelete: false,
  },
}

export const NoDueDate: Story = {
  args: {
    ...Default.args,
    dueDate: '',
  },
}

export const Saving: Story = {
  args: {
    ...Default.args,
    isSaving: true,
  },
}

export const WithError: Story = {
  args: {
    ...Default.args,
    editError: 'Failed to save task. Please check your connection and try again.',
  },
}

export const ConfirmingDelete: Story = {
  args: {
    ...Default.args,
    confirmingDelete: true,
  },
}

export const HighPriority: Story = {
  args: {
    ...Default.args,
    priority: 'high',
    status: 'in_progress',
  },
}
