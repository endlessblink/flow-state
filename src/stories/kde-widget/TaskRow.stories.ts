import type { Meta, StoryObj } from '@storybook/vue3'
import { ref, defineComponent, h } from 'vue'

// Design tokens matching KDE widget palette
const bgColor = '#232034'
const textColor = '#E2E8F0'
const mutedColor = '#7E7590'
const workColor = '#4ECDC4'
const breakColor = '#F59E0B'

const TaskRow = defineComponent({
  name: 'TaskRow',
  props: {
    title: { type: String, default: 'Design the landing page' },
    isActiveTask: { type: Boolean, default: false },
    isEditing: { type: Boolean, default: false },
    isWorkSession: { type: Boolean, default: true },
    showCanvasBadge: { type: Boolean, default: false },
  },
  setup(props) {
    const hovered = ref(false)
    const doneHovered = ref(false)
    const playHovered = ref(false)
    const pinHovered = ref(false)

    return { hovered, doneHovered, playHovered, pinHovered }
  },
  render() {
    const p = this.$props as any
    const accent = p.isWorkSession ? workColor : breakColor

    // Row background based on state
    let rowBg = 'rgba(46, 41, 69, 0.3)'
    let rowBorder = 'none'
    if (p.isActiveTask) {
      const accentHex = p.isWorkSession ? '78, 205, 196' : '245, 158, 11'
      rowBg = `rgba(${accentHex}, 0.15)`
      rowBorder = `2px solid ${accent}`
    } else if (p.isEditing) {
      rowBg = 'rgba(46, 41, 69, 0.5)'
      rowBorder = '1px solid rgba(78, 205, 196, 0.3)'
    }

    // Timer icon
    let timerIcon = '▶'
    if (p.isActiveTask) timerIcon = '⏱'
    // (TimerOnOtherTask story will override isActiveTask=false but pass a custom icon via a wrapper)

    // Done toggle
    const doneToggle = h('div', {
      style: {
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        border: this.doneHovered ? '1.5px solid #22C55E' : `1.5px solid ${mutedColor}`,
        background: this.doneHovered ? 'rgba(34, 197, 94, 0.25)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        color: this.doneHovered ? '#22C55E' : mutedColor,
        cursor: 'pointer',
        flexShrink: '0',
        transition: 'all 0.15s',
      },
      onMouseenter: () => { this.doneHovered = true },
      onMouseleave: () => { this.doneHovered = false },
    }, '✓')

    // Play/timer button
    const playButton = h('div', {
      style: {
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        background: this.playHovered ? `rgba(78, 205, 196, 0.25)` : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        color: accent,
        cursor: 'pointer',
        flexShrink: '0',
        transition: 'all 0.15s',
      },
      onMouseenter: () => { this.playHovered = true },
      onMouseleave: () => { this.playHovered = false },
    }, timerIcon)

    // Pin button
    const pinButton = h('div', {
      style: {
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        background: this.pinHovered ? 'rgba(78, 205, 196, 0.25)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        cursor: 'pointer',
        flexShrink: '0',
        transition: 'all 0.15s',
      },
      onMouseenter: () => { this.pinHovered = true },
      onMouseleave: () => { this.pinHovered = false },
    }, '📌')

    // Task title
    const titleEl = h('div', {
      style: {
        flex: '1',
        minWidth: '0',
        fontSize: '13px',
        color: this.hovered ? workColor : textColor,
        fontWeight: p.isActiveTask ? 'bold' : 'normal',
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: '2',
        WebkitBoxOrient: 'vertical',
        textOverflow: 'ellipsis',
        lineHeight: '1.35',
        textDecoration: this.hovered ? 'underline' : 'none',
        cursor: 'pointer',
        direction: 'ltr',
        textAlign: 'left',
        transition: 'color 0.15s',
      },
    }, p.title)

    // Canvas badge
    const canvasBadge = p.showCanvasBadge ? h('div', {
      style: {
        padding: '2px 6px',
        borderRadius: '9999px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        fontSize: '9px',
        color: mutedColor,
        whiteSpace: 'nowrap',
        flexShrink: '0',
      },
    }, 'Not on Canvas') : null

    // Active timer pulse style (injected via a wrapper style tag approach — we use a key animation trick with inline keyframes)
    const pulseStyle = p.isActiveTask ? {
      animation: 'taskrow-pulse 2s ease-in-out infinite',
    } : {}

    return h('div', { style: { fontFamily: 'Noto Sans, sans-serif' } }, [
      // Inject keyframes once via a style element sibling
      p.isActiveTask ? h('style', {}, `
        @keyframes taskrow-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
      `) : null,

      h('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 8px',
          borderRadius: '6px',
          background: rowBg,
          border: rowBorder,
          cursor: 'pointer',
          transition: 'background 0.15s',
          direction: 'ltr',
          ...pulseStyle,
        },
        onMouseenter: () => { this.hovered = true },
        onMouseleave: () => { this.hovered = false },
      }, [
        doneToggle,
        playButton,
        pinButton,
        titleEl,
        canvasBadge,
      ]),
    ])
  },
})

// Variant for "timer on other task" — skip icon
const TaskRowSkip = defineComponent({
  name: 'TaskRowSkip',
  props: {
    title: { type: String, default: 'Design the landing page' },
    isWorkSession: { type: Boolean, default: true },
    showCanvasBadge: { type: Boolean, default: false },
  },
  setup() {
    const hovered = ref(false)
    return { hovered }
  },
  render() {
    const p = this.$props as any
    const accent = p.isWorkSession ? workColor : breakColor

    return h('div', { style: { fontFamily: 'Noto Sans, sans-serif' } }, [
      h('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 8px',
          borderRadius: '6px',
          background: 'rgba(46, 41, 69, 0.3)',
          border: 'none',
          cursor: 'pointer',
          direction: 'ltr',
        },
        onMouseenter: () => { this.hovered = true },
        onMouseleave: () => { this.hovered = false },
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
        // Skip icon
        h('div', {
          style: {
            width: '22px', height: '22px', borderRadius: '50%',
            background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', color: accent, flexShrink: '0',
          },
        }, '⏭'),
        // Pin
        h('div', {
          style: {
            width: '22px', height: '22px', borderRadius: '50%',
            background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', flexShrink: '0',
          },
        }, '📌'),
        // Title
        h('div', {
          style: {
            flex: '1', minWidth: '0', fontSize: '13px', color: textColor,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: '2', WebkitBoxOrient: 'vertical',
            textOverflow: 'ellipsis', lineHeight: '1.35',
            direction: 'ltr', textAlign: 'left',
          },
        }, p.title),
        // Canvas badge
        p.showCanvasBadge ? h('div', {
          style: {
            padding: '2px 6px', borderRadius: '9999px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            fontSize: '9px', color: mutedColor, whiteSpace: 'nowrap', flexShrink: '0',
          },
        }, 'Not on Canvas') : null,
      ]),
    ])
  },
})

const meta: Meta<typeof TaskRow> = {
  title: 'KDE Widget/TaskRow',
  component: TaskRow,
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
    title: { control: 'text' },
    isActiveTask: { control: 'boolean' },
    isEditing: { control: 'boolean' },
    isWorkSession: { control: 'boolean' },
    showCanvasBadge: { control: 'boolean' },
  },
  decorators: [
    (story) => ({
      setup() { return {} },
      render() {
        return h('div', { style: { width: '440px', padding: '8px', background: bgColor, borderRadius: '8px' } }, [
          h(story()),
        ])
      },
    }),
  ],
}

export default meta
type Story = StoryObj<typeof TaskRow>

export const Default: Story = {
  args: {
    title: 'Design the landing page',
    isActiveTask: false,
    isEditing: false,
    isWorkSession: true,
    showCanvasBadge: false,
  },
}

export const ActiveTimer: Story = {
  args: {
    title: 'Design the landing page',
    isActiveTask: true,
    isEditing: false,
    isWorkSession: true,
    showCanvasBadge: false,
  },
}

export const TimerOnOtherTask: Story = {
  render: () => ({
    setup() { return {} },
    render() {
      return h('div', { style: { width: '440px', padding: '8px', background: bgColor, borderRadius: '8px' } }, [
        h(TaskRowSkip, {
          title: 'Review pull requests',
          isWorkSession: true,
          showCanvasBadge: false,
        }),
      ])
    },
  }),
}

export const WithCanvasBadge: Story = {
  args: {
    title: 'Design the landing page',
    isActiveTask: false,
    isEditing: false,
    isWorkSession: true,
    showCanvasBadge: true,
  },
}

export const RTLTitle: Story = {
  args: {
    title: 'לארגן משימות / טאבים',
    isActiveTask: false,
    isEditing: false,
    isWorkSession: true,
    showCanvasBadge: false,
  },
}

export const LongTitle: Story = {
  args: {
    title: 'Implement full authentication flow with OAuth, session management, refresh tokens, and audit logging across all environments',
    isActiveTask: false,
    isEditing: false,
    isWorkSession: true,
    showCanvasBadge: false,
  },
}
