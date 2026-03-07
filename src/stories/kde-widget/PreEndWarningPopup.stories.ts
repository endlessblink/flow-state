import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, h } from 'vue'

const bgColor = '#232034'
const textColor = '#E2E8F0'
const mutedColor = '#7E7590'
const workColor = '#4ECDC4'
const breakColor = '#F59E0B'

const PreEndWarningPopup = defineComponent({
  name: 'PreEndWarningPopup',
  props: {
    isWorkSession: { type: Boolean, default: true },
    secondsLeft: { type: Number, default: 60 },
  },
  render() {
    const p = this.$props as any
    const accent = p.isWorkSession ? workColor : breakColor
    const emoji = p.isWorkSession ? '⏰' : '☕'
    const title = p.isWorkSession ? 'Almost done!' : 'Break ending soon!'
    const sub3 = p.isWorkSession ? 'Wrap up your current task' : 'Get ready to focus'

    const formatSecondsLeft = (secs: number): string => {
      if (secs >= 120) return `${Math.round(secs / 60)} minutes left`
      if (secs >= 60) return '1 minute left'
      return `${secs} seconds left`
    }

    const subtitle = formatSecondsLeft(p.secondsLeft)

    return h('div', {
      style: {
        width: '360px',
        height: '160px',
        position: 'relative',
        fontFamily: 'Noto Sans, sans-serif',
      },
    }, [
      // Outer glow
      h('div', {
        style: {
          position: 'absolute',
          inset: '-6px',
          borderRadius: '22px',
          border: `3px solid ${accent}4d`,
          pointerEvents: 'none',
        },
      }),

      // Card
      h('div', {
        style: {
          position: 'absolute',
          inset: '10px',
          borderRadius: '16px',
          background: `${bgColor}f2`,
          border: `2px solid ${accent}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: '16px',
          boxSizing: 'border-box',
        },
      }, [
        // Emoji
        h('div', {
          style: {
            fontSize: '36px',
            lineHeight: '1',
            flexShrink: '0',
          },
        }, emoji),

        // Text column
        h('div', {
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          },
        }, [
          // Title
          h('div', {
            style: {
              fontSize: '18px',
              fontWeight: 'bold',
              color: textColor,
            },
          }, title),

          // Seconds subtitle
          h('div', {
            style: {
              fontSize: '14px',
              color: mutedColor,
            },
          }, subtitle),

          // Sub-subtitle
          h('div', {
            style: {
              fontSize: '13px',
              color: mutedColor,
              opacity: '0.7',
            },
          }, sub3),
        ]),
      ]),
    ])
  },
})

const meta: Meta<typeof PreEndWarningPopup> = {
  title: 'KDE Widget/PreEndWarningPopup',
  component: PreEndWarningPopup,
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
    isWorkSession: { control: 'boolean' },
    secondsLeft: { control: { type: 'range', min: 10, max: 300, step: 10 } },
  },
}

export default meta
type Story = StoryObj<typeof PreEndWarningPopup>

export const WorkEnding: Story = {
  args: {
    isWorkSession: true,
    secondsLeft: 60,
  },
}

export const BreakEnding: Story = {
  args: {
    isWorkSession: false,
    secondsLeft: 60,
  },
}

export const ThirtySeconds: Story = {
  args: {
    isWorkSession: true,
    secondsLeft: 30,
  },
}

export const TwoMinutes: Story = {
  args: {
    isWorkSession: true,
    secondsLeft: 120,
  },
}
