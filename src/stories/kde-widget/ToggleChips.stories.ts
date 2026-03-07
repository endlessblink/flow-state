import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, h } from 'vue'

const bgColor = '#232034'
const textColor = '#E2E8F0'
const mutedColor = '#7E7590'
const tealColor = '#4ECDC4'

const ToggleChips = defineComponent({
  name: 'ToggleChips',
  props: {
    todayActive: { type: Boolean, default: false },
    nannyEnabled: { type: Boolean, default: true },
    nannyQuietToday: { type: Boolean, default: false },
  },
  render() {
    const p = this.$props as any

    // Today chip styles
    const todayActive = p.todayActive
    const todayBg = todayActive ? 'rgba(78, 205, 196, 0.20)' : 'rgba(255,255,255,0.03)'
    const todayBorder = todayActive ? tealColor : `rgba(78, 205, 196, 0.30)`
    const todayAccent = tealColor
    const todayTextColor = todayActive ? tealColor : textColor
    const todayFontWeight = todayActive ? 'bold' : 'normal'
    const todayLabel = '📅 Today'

    // Nanny chip styles
    const nannyEnabled = p.nannyEnabled
    const nannyQuiet = p.nannyQuietToday
    const nannyBg = nannyEnabled ? 'rgba(78, 205, 196, 0.20)' : 'rgba(255,255,255,0.03)'
    const nannyBorder = nannyEnabled ? tealColor : `rgba(78, 205, 196, 0.30)`
    const nannyAccent = nannyEnabled ? tealColor : mutedColor
    const nannyTextColor = nannyEnabled ? tealColor : mutedColor
    const nannyFontWeight = nannyEnabled ? 'bold' : 'normal'
    const nannyIcon = nannyEnabled ? '🔔' : '🔕'
    const nannyText = nannyEnabled
      ? (nannyQuiet ? 'Nanny (paused today)' : 'Nanny')
      : 'Nanny (off)'

    const chipBase = {
      flex: '1',
      height: '32px',
      borderRadius: '6px',
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      position: 'relative' as const,
      overflow: 'hidden' as const,
      paddingLeft: '14px',
      paddingRight: '12px',
      boxSizing: 'border-box' as const,
      fontSize: '13px',
      userSelect: 'none' as const,
    }

    const makeChip = (
      bg: string,
      border: string,
      accentColor: string,
      icon: string,
      label: string,
      color: string,
      fontWeight: string,
    ) => h('div', {
      style: {
        ...chipBase,
        background: bg,
        border: `1px solid ${border}`,
      },
    }, [
      // Left accent bar (3px wide, absolute positioned)
      h('div', {
        style: {
          position: 'absolute',
          left: '0',
          top: '0',
          bottom: '0',
          width: '3px',
          background: accentColor,
          borderRadius: '6px 0 0 6px',
        },
      }),
      // Label
      h('span', {
        style: {
          color,
          fontWeight,
          fontSize: '13px',
          whiteSpace: 'nowrap' as const,
          overflow: 'hidden' as const,
          textOverflow: 'ellipsis',
        },
      }, `${icon} ${label}`),
    ])

    return h('div', {
      style: {
        width: '440px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontFamily: 'Noto Sans, sans-serif',
      },
    }, [
      makeChip(todayBg, todayBorder, todayAccent, '📅', 'Today', todayTextColor, todayFontWeight),
      makeChip(nannyBg, nannyBorder, nannyAccent, nannyIcon, nannyText, nannyTextColor, nannyFontWeight),
    ])
  },
})

const meta: Meta<typeof ToggleChips> = {
  title: 'KDE Widget/ToggleChips',
  component: ToggleChips,
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
    todayActive: { control: 'boolean' },
    nannyEnabled: { control: 'boolean' },
    nannyQuietToday: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof ToggleChips>

export const BothInactive: Story = {
  args: {
    todayActive: false,
    nannyEnabled: true,
    nannyQuietToday: false,
  },
}

export const TodayActive: Story = {
  args: {
    todayActive: true,
    nannyEnabled: true,
    nannyQuietToday: false,
  },
}

export const NannyOff: Story = {
  args: {
    todayActive: false,
    nannyEnabled: false,
    nannyQuietToday: false,
  },
}

export const NannyQuiet: Story = {
  args: {
    todayActive: false,
    nannyEnabled: true,
    nannyQuietToday: true,
  },
}

export const BothActive: Story = {
  args: {
    todayActive: true,
    nannyEnabled: true,
    nannyQuietToday: false,
  },
}
