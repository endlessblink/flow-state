import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, h } from 'vue'

const bgColor = '#232034'
const textColor = '#E2E8F0'
const mutedColor = '#7E7590'
const workColor = '#4ECDC4'

const WidgetFooter = defineComponent({
  name: 'WidgetFooter',
  props: {
    nannyEnabled: { type: Boolean, default: true },
    nannyQuietToday: { type: Boolean, default: false },
    isLoading: { type: Boolean, default: false },
  },
  render() {
    const p = this.$props as any

    const refreshButton = h('div', {
      style: {
        width: '100px',
        height: '28px',
        borderRadius: '6px',
        background: 'transparent',
        border: `1px solid ${mutedColor}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '5px',
        cursor: p.isLoading ? 'not-allowed' : 'pointer',
        opacity: p.isLoading ? '0.4' : '0.6',
        transition: 'opacity 0.15s',
        flexShrink: '0',
      },
    }, [
      h('span', {
        style: { fontSize: '13px', color: textColor, lineHeight: '1' },
      }, '↻'),
      h('span', {
        style: { fontSize: '11px', color: textColor },
      }, 'Refresh'),
    ])

    const quietToggle = p.nannyEnabled
      ? h('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
        }, [
          p.nannyQuietToday
            ? h('span', {
                style: {
                  fontSize: '10px',
                  color: mutedColor,
                  opacity: '0.5',
                  fontStyle: 'italic',
                },
              }, '(Reminders paused for today)')
            : h('span', {
                style: {
                  fontSize: '10px',
                  color: workColor,
                  opacity: '0.6',
                  cursor: 'pointer',
                },
              }, '🔇 Quiet today'),
        ])
      : null

    return h('div', {
      style: {
        width: '440px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 0',
        fontFamily: 'Noto Sans, sans-serif',
        boxSizing: 'border-box',
      },
    }, [
      refreshButton,
      quietToggle,
    ].filter(Boolean))
  },
})

const meta: Meta<typeof WidgetFooter> = {
  title: 'KDE Widget/WidgetFooter',
  component: WidgetFooter,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: bgColor },
        { name: 'desktop', value: '#1a1a2e' },
      ],
    },
  },
  argTypes: {
    nannyEnabled: { control: 'boolean' },
    nannyQuietToday: { control: 'boolean' },
    isLoading: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof WidgetFooter>

export const Default: Story = {
  args: {
    nannyEnabled: true,
    nannyQuietToday: false,
    isLoading: false,
  },
}

export const QuietToday: Story = {
  args: {
    nannyEnabled: true,
    nannyQuietToday: true,
    isLoading: false,
  },
}

export const NannyDisabled: Story = {
  args: {
    nannyEnabled: false,
    nannyQuietToday: false,
    isLoading: false,
  },
}

export const Loading: Story = {
  args: {
    nannyEnabled: true,
    nannyQuietToday: false,
    isLoading: true,
  },
}
