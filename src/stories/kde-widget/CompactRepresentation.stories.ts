import type { Meta, StoryObj } from '@storybook/vue3'
import { ref, defineComponent, h, onMounted } from 'vue'

// Design tokens
const bgColor = '#232034'
const textColor = '#E2E8F0'
const mutedColor = '#7E7590'
const workColor = '#4ECDC4'
const breakColor = '#F59E0B'

const CompactRepresentation = defineComponent({
  name: 'CompactRepresentation',
  props: {
    size: { type: Number, default: 48 },
    progress: { type: Number, default: 0.65 },
    isActive: { type: Boolean, default: true },
    isWorkSession: { type: Boolean, default: true },
    minutesRemaining: { type: Number, default: 17 },
  },
  setup(props) {
    const canvasRef = ref<HTMLCanvasElement | null>(null)

    const draw = () => {
      const canvas = canvasRef.value
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const s = props.size
      const dpr = window.devicePixelRatio || 1
      canvas.width = s * dpr
      canvas.height = s * dpr
      canvas.style.width = `${s}px`
      canvas.style.height = `${s}px`
      ctx.scale(dpr, dpr)

      ctx.clearRect(0, 0, s, s)

      const cx = s / 2
      const cy = s / 2
      const lineWidth = Math.max(2, s / 12)
      const radius = (s - lineWidth * 2) / 2

      const accent = props.isWorkSession ? workColor : breakColor

      // Background ring
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.strokeStyle = `${mutedColor}4D` // 30% opacity (~0x4D)
      ctx.lineWidth = lineWidth
      ctx.stroke()

      if (props.isActive && props.progress > 0) {
        // Active center fill
        ctx.beginPath()
        ctx.arc(cx, cy, radius - lineWidth, 0, Math.PI * 2)
        ctx.fillStyle = `${accent}26` // 15% opacity (~0x26)
        ctx.fill()

        // Progress arc — shadow layer
        const startAngle = -Math.PI / 2
        const endAngle = startAngle + props.progress * Math.PI * 2
        ctx.beginPath()
        ctx.arc(cx, cy, radius, startAngle, endAngle)
        ctx.strokeStyle = accent
        ctx.lineWidth = lineWidth
        ctx.lineCap = 'round'
        ctx.shadowBlur = 4
        ctx.shadowColor = accent
        ctx.stroke()
        ctx.shadowBlur = 0

        // Progress arc — brighter top layer (1px thinner)
        ctx.beginPath()
        ctx.arc(cx, cy, radius, startAngle, endAngle)
        ctx.strokeStyle = accent
        ctx.lineWidth = lineWidth - 1
        ctx.lineCap = 'round'
        ctx.stroke()

        // Minutes remaining text
        const fontSize = Math.round(s * 0.25)
        ctx.font = `bold ${fontSize}px system-ui, sans-serif`
        ctx.fillStyle = accent
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(props.minutesRemaining), cx, cy)
      } else {
        // Idle: tomato emoji
        const fontSize = Math.round(s * 0.6)
        ctx.font = `${fontSize}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('🍅', cx, cy)
      }
    }

    onMounted(() => {
      draw()
    })

    return { canvasRef, draw }
  },
  render() {
    const p = this.$props as any
    return h('div', {
      style: {
        width: `${p.size}px`,
        height: `${p.size}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      },
    }, [
      h('canvas', {
        ref: 'canvasRef',
        style: { display: 'block' },
        width: p.size,
        height: p.size,
      }),
    ])
  },
})

const meta: Meta<typeof CompactRepresentation> = {
  title: 'KDE Widget/CompactRepresentation',
  component: CompactRepresentation,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: bgColor },
        { name: 'desktop', value: '#1a1829' },
        { name: 'panel', value: '#0f0d1a' },
      ],
    },
  },
  argTypes: {
    size: { control: { type: 'range', min: 20, max: 96, step: 2 } },
    progress: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
    isActive: { control: 'boolean' },
    isWorkSession: { control: 'boolean' },
    minutesRemaining: { control: { type: 'range', min: 0, max: 60, step: 1 } },
  },
}

export default meta
type Story = StoryObj<typeof CompactRepresentation>

export const WorkSession: Story = {
  args: {
    size: 48,
    progress: 0.65,
    isActive: true,
    isWorkSession: true,
    minutesRemaining: 17,
  },
}

export const BreakSession: Story = {
  args: {
    size: 48,
    progress: 0.4,
    isActive: true,
    isWorkSession: false,
    minutesRemaining: 3,
  },
}

export const Idle: Story = {
  args: {
    size: 48,
    progress: 0,
    isActive: false,
    isWorkSession: true,
    minutesRemaining: 0,
  },
}

export const AlmostDone: Story = {
  args: {
    size: 48,
    progress: 0.95,
    isActive: true,
    isWorkSession: true,
    minutesRemaining: 1,
  },
}

export const SmallPanel: Story = {
  name: 'SmallPanel (28px)',
  args: {
    size: 28,
    progress: 0.5,
    isActive: true,
    isWorkSession: true,
    minutesRemaining: 12,
  },
}

export const LargePanel: Story = {
  name: 'LargePanel (64px)',
  args: {
    size: 64,
    progress: 0.3,
    isActive: true,
    isWorkSession: false,
    minutesRemaining: 8,
  },
}
