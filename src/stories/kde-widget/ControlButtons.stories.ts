import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, h, computed } from 'vue'

const bgColor = '#232034'
const textColor = '#E2E8F0'
const mutedColor = '#7E7590'
const workColor = '#4ECDC4'
const breakColor = '#F59E0B'

const ControlButtons = defineComponent({
  name: 'ControlButtons',
  props: {
    hasActiveSession: { type: Boolean, default: true },
    isRunning: { type: Boolean, default: true },
    isWorkSession: { type: Boolean, default: true },
  },
  setup(props) {
    const accent = computed(() => (props.isWorkSession ? workColor : breakColor))

    const makeBtn = (
      label: string,
      icon: string,
      width: number,
      useAccent: boolean,
      disabled: boolean
    ) => {
      const borderColor = useAccent ? accent.value : mutedColor
      const color = useAccent ? accent.value : textColor
      return h('div', {
        style: {
          width: `${width}px`,
          height: '32px',
          borderRadius: '6px',
          border: `1px solid ${disabled ? borderColor + '66' : borderColor}`,
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? '0.4' : '1',
          flexShrink: '0',
          transition: 'opacity 0.15s',
        },
      }, [
        h('span', { style: { fontSize: '13px', color, lineHeight: '1' } }, icon),
        h('span', { style: { fontSize: '12px', color, lineHeight: '1' } }, label),
      ])
    }

    return { accent, makeBtn }
  },
  render() {
    const p = this.$props as any
    const accent = p.isWorkSession ? workColor : breakColor

    const playIcon = p.isRunning ? '⏸' : '▶'
    const playLabel = p.isRunning ? 'Pause' : 'Start'

    const skipBtn = this.makeBtn('Skip', '⏭', 70, false, !p.hasActiveSession)
    const playBtn = this.makeBtn(playLabel, playIcon, 70, true, false)
    const resetBtn = this.makeBtn('Reset', '↻', 62, false, !p.hasActiveSession)
    const stopBtn = this.makeBtn('Stop', '⏹', 62, false, !p.hasActiveSession)

    const quickBreakBtn = !p.hasActiveSession
      ? h('div', {
          style: {
            width: '80px',
            height: '28px',
            borderRadius: '6px',
            border: `1px solid ${breakColor}`,
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          },
        }, [
          h('span', { style: { fontSize: '11px', color: breakColor } }, '☕ Break'),
        ])
      : null

    return h('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        padding: '20px',
        background: bgColor,
        borderRadius: '12px',
        fontFamily: 'sans-serif',
      },
    }, [
      // Button row
      h('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
        },
      }, [skipBtn, playBtn, resetBtn, stopBtn]),

      // Quick break button (only when idle)
      quickBreakBtn,
    ])
  },
})

const meta: Meta<typeof ControlButtons> = {
  title: 'KDE Widget/ControlButtons',
  component: ControlButtons,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#1a1a2e' },
        { name: 'desktop', value: '#2d2d44' },
      ],
    },
  },
  argTypes: {
    hasActiveSession: { control: 'boolean' },
    isRunning: { control: 'boolean' },
    isWorkSession: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof ControlButtons>

export const Running: Story = {
  args: {
    hasActiveSession: true,
    isRunning: true,
    isWorkSession: true,
  },
}

export const Paused: Story = {
  args: {
    hasActiveSession: true,
    isRunning: false,
    isWorkSession: true,
  },
}

export const Idle: Story = {
  args: {
    hasActiveSession: false,
    isRunning: false,
    isWorkSession: true,
  },
}

export const BreakRunning: Story = {
  args: {
    hasActiveSession: true,
    isRunning: true,
    isWorkSession: false,
  },
}

export const BreakIdle: Story = {
  args: {
    hasActiveSession: false,
    isRunning: false,
    isWorkSession: false,
  },
}
