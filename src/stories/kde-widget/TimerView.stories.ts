import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, h, ref, onMounted, onUnmounted, watch } from 'vue'

const bgColor = '#232034'
const textColor = '#E2E8F0'
const mutedColor = '#7E7590'
const workColor = '#4ECDC4'
const breakColor = '#F59E0B'

const TimerView = defineComponent({
  name: 'TimerView',
  props: {
    progress: { type: Number, default: 0.65 },
    timeDisplay: { type: String, default: '17:32' },
    statusLabel: { type: String, default: 'focus' },
    isWorkSession: { type: Boolean, default: true },
    hasActiveSession: { type: Boolean, default: true },
    completedSessions: { type: Number, default: 2 },
    maxSessions: { type: Number, default: 4 },
  },
  setup(props) {
    const canvasRef = ref<HTMLCanvasElement | null>(null)

    const drawTimer = () => {
      const canvas = canvasRef.value
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const W = 160
      const H = 160
      const cx = W / 2
      const cy = H / 2
      const radius = 70
      const lw = 6
      const accent = props.isWorkSession ? workColor : breakColor

      ctx.clearRect(0, 0, W, H)

      // Background ring
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.strokeStyle = `${mutedColor}4D` // 30% opacity
      ctx.lineWidth = lw
      ctx.stroke()

      if (props.hasActiveSession && props.progress > 0) {
        // Progress arc
        ctx.beginPath()
        ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + props.progress * Math.PI * 2)
        ctx.strokeStyle = accent
        ctx.lineWidth = lw
        ctx.lineCap = 'round'
        ctx.shadowBlur = 10
        ctx.shadowColor = accent
        ctx.stroke()
        ctx.shadowBlur = 0

        // Bright center stroke (4px, slightly inset)
        ctx.beginPath()
        ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + props.progress * Math.PI * 2)
        ctx.strokeStyle = accent
        ctx.lineWidth = 4
        ctx.globalAlpha = 0.5
        ctx.stroke()
        ctx.globalAlpha = 1
        ctx.lineCap = 'butt'
      }

      // Center text — time
      const displayTime = props.hasActiveSession ? props.timeDisplay : '--:--'
      const displayLabel = props.hasActiveSession ? props.statusLabel : 'ready'

      ctx.fillStyle = textColor
      ctx.font = 'bold 36px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(displayTime, cx, cy - 10)

      // Center text — label
      ctx.fillStyle = mutedColor
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(displayLabel, cx, cy + 18)
    }

    onMounted(() => {
      drawTimer()
    })

    watch(
      () => [props.progress, props.timeDisplay, props.statusLabel, props.isWorkSession, props.hasActiveSession],
      () => drawTimer(),
      { flush: 'post' }
    )

    return { canvasRef }
  },
  render() {
    const p = this.$props as any
    const accent = p.isWorkSession ? workColor : breakColor

    // Session dots
    const dots = Array.from({ length: p.maxSessions }, (_: unknown, i: number) => {
      const done = i < p.completedSessions
      return h('div', {
        key: i,
        style: {
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: done ? accent : `${mutedColor}66`,
          flexShrink: '0',
          transition: 'background 0.2s',
        },
      })
    })

    return h('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        padding: '20px',
        background: bgColor,
        borderRadius: '16px',
        minWidth: '240px',
        fontFamily: 'sans-serif',
      },
    }, [
      // Connection status bar
      h('div', {
        style: {
          width: '100%',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '6px',
        },
      }, [
        h('div', {
          style: {
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#22C55E',
            flexShrink: '0',
          },
        }),
        h('span', { style: { fontSize: '10px', color: mutedColor } }, 'Connected'),
        h('span', { style: { fontSize: '10px', color: mutedColor } }, '•'),
        h('span', {
          style: { fontSize: '10px', color: workColor, cursor: 'pointer' },
        }, 'Open App'),
        h('span', { style: { fontSize: '10px', color: mutedColor } }, '•'),
        h('span', {
          style: { fontSize: '10px', color: workColor, cursor: 'pointer' },
        }, 'Sign out'),
      ]),

      // Session dots
      h('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        },
      }, dots),

      // Circular timer canvas
      h('canvas', {
        ref: 'canvasRef',
        width: 160,
        height: 160,
        style: { display: 'block' },
      }),
    ])
  },
})

const meta: Meta<typeof TimerView> = {
  title: 'KDE Widget/TimerView',
  component: TimerView,
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
    progress: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
    timeDisplay: { control: 'text' },
    statusLabel: { control: 'text' },
    isWorkSession: { control: 'boolean' },
    hasActiveSession: { control: 'boolean' },
    completedSessions: { control: { type: 'range', min: 0, max: 8, step: 1 } },
    maxSessions: { control: { type: 'range', min: 1, max: 8, step: 1 } },
  },
}

export default meta
type Story = StoryObj<typeof TimerView>

export const WorkInProgress: Story = {
  args: {
    progress: 0.65,
    timeDisplay: '17:32',
    statusLabel: 'focus',
    isWorkSession: true,
    hasActiveSession: true,
    completedSessions: 2,
    maxSessions: 4,
  },
}

export const BreakInProgress: Story = {
  args: {
    progress: 0.4,
    timeDisplay: '02:58',
    statusLabel: 'break',
    isWorkSession: false,
    hasActiveSession: true,
    completedSessions: 3,
    maxSessions: 4,
  },
}

export const Ready: Story = {
  args: {
    progress: 0,
    timeDisplay: '--:--',
    statusLabel: 'ready',
    isWorkSession: true,
    hasActiveSession: false,
    completedSessions: 0,
    maxSessions: 4,
  },
}

export const AlmostDone: Story = {
  args: {
    progress: 0.95,
    timeDisplay: '01:12',
    statusLabel: 'focus',
    isWorkSession: true,
    hasActiveSession: true,
    completedSessions: 3,
    maxSessions: 4,
  },
}

export const LongBreak: Story = {
  args: {
    progress: 0.2,
    timeDisplay: '12:45',
    statusLabel: 'break',
    isWorkSession: false,
    hasActiveSession: true,
    completedSessions: 4,
    maxSessions: 4,
  },
}
