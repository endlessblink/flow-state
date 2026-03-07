import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, h } from 'vue'

const bgColor = '#232034'
const textColor = '#E2E8F0'
const mutedColor = '#7E7590'
const workColor = '#4ECDC4'

const SystemNotification = defineComponent({
  name: 'SystemNotification',
  props: {
    isWorkComplete: { type: Boolean, default: true },
  },
  render() {
    const p = this.$props as any
    const title = p.isWorkComplete ? '🍅 Work session complete!' : '☕ Break is over!'
    const body = p.isWorkComplete ? 'Ready for a break?' : 'Ready to focus?'
    const btn1Label = p.isWorkComplete ? '☕ Break' : '🍅 Work'

    return h('div', {
      style: {
        width: '420px',
        height: '120px',
        borderRadius: '12px',
        background: bgColor,
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '16px',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontFamily: 'Noto Sans, sans-serif',
      },
    }, [
      // Icon area
      h('div', {
        style: {
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: 'rgba(78, 205, 196, 0.15)',
          border: `1px solid ${workColor}66`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          flexShrink: '0',
        },
      }, '⏱'),

      // Content column
      h('div', {
        style: {
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          minWidth: '0',
        },
      }, [
        // App name
        h('div', {
          style: {
            fontSize: '10px',
            color: mutedColor,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          },
        }, 'FlowState'),

        // Notification title
        h('div', {
          style: {
            fontSize: '14px',
            fontWeight: 'bold',
            color: textColor,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          },
        }, title),

        // Body
        h('div', {
          style: {
            fontSize: '12px',
            color: mutedColor,
          },
        }, body),
      ]),

      // Button column
      h('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flexShrink: '0',
        },
      }, [
        // Button 1: Break or Work
        h('div', {
          style: {
            width: '90px',
            height: '30px',
            borderRadius: '12px',
            border: `1.5px solid ${workColor}`,
            color: workColor,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            background: 'transparent',
          },
        }, btn1Label),

        // Button 2: +5 min
        h('div', {
          style: {
            width: '80px',
            height: '30px',
            borderRadius: '12px',
            border: `1.5px solid ${mutedColor}`,
            color: textColor,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            background: 'transparent',
          },
        }, '⏰ +5 min'),
      ]),
    ])
  },
})

const meta: Meta<typeof SystemNotification> = {
  title: 'KDE Widget/SystemNotification',
  component: SystemNotification,
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
    isWorkComplete: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof SystemNotification>

export const WorkComplete: Story = {
  args: {
    isWorkComplete: true,
  },
}

export const BreakComplete: Story = {
  args: {
    isWorkComplete: false,
  },
}
