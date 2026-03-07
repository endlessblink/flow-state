import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, h } from 'vue'

const bgColor = '#232034'
const textColor = '#E2E8F0'
const mutedColor = '#7E7590'
const workColor = '#4ECDC4'
const breakColor = '#F59E0B'

const FullScreenOverlay = defineComponent({
  name: 'FullScreenOverlay',
  props: {
    lastCompletedWasWork: { type: Boolean, default: true },
  },
  render() {
    const p = this.$props as any
    const accent = p.lastCompletedWasWork ? breakColor : workColor
    const icon = p.lastCompletedWasWork ? '🛌' : '⏱'
    const title = p.lastCompletedWasWork ? 'Time for a break!' : "Break's over!"
    const subtitle = p.lastCompletedWasWork
      ? "You've earned some rest. Step away from the screen."
      : 'Ready to get back to work?'
    const primaryLabel = p.lastCompletedWasWork ? '☕ Start Break' : '🍅 Start Work'

    // Kirigami icons are system icons — approximate with styled div
    const iconEl = h('div', {
      style: {
        width: '72px',
        height: '72px',
        borderRadius: '16px',
        background: `linear-gradient(135deg, ${accent}44, ${accent}22)`,
        border: `2px solid ${accent}66`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '36px',
      },
    }, p.lastCompletedWasWork ? '🛌' : '⏱')

    return h('div', {
      style: {
        width: '800px',
        height: '500px',
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Noto Sans, sans-serif',
        position: 'relative',
      },
    }, [
      // Outer glow ring (matches QML: anchors.margins: -12, border.width: 6)
      h('div', {
        style: {
          position: 'absolute',
          width: '474px',
          height: 'auto',
          minHeight: '424px',
          borderRadius: '36px',
          border: `6px solid ${accent}66`,
          pointerEvents: 'none',
          zIndex: '0',
        },
      }),

      // Card (matches QML: 450x400, radius 24, border 3)
      h('div', {
        style: {
          width: '450px',
          minHeight: '400px',
          borderRadius: '24px',
          background: `${bgColor}fa`,
          border: `3px solid ${accent}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '28px',
          padding: '40px',
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: '1',
        },
      }, [
        // Icon (approximates Kirigami.Icon)
        iconEl,

        // Title — QML uses root.textColor (white), NOT accent
        h('div', {
          style: {
            fontSize: '32px',
            fontWeight: 'bold',
            color: textColor,
            textAlign: 'center',
          },
        }, title),

        // Subtitle
        h('div', {
          style: {
            fontSize: '16px',
            color: mutedColor,
            textAlign: 'center',
            maxWidth: '350px',
            lineHeight: '1.5',
          },
        }, subtitle),

        // Spacer (QML: Item { Layout.preferredHeight: 20 })
        h('div', { style: { height: '20px' } }),

        // Buttons row (QML: Row { spacing: 20 })
        h('div', {
          style: {
            display: 'flex',
            gap: '20px',
            alignItems: 'center',
          },
        }, [
          // Primary button (QML: 160x52, radius 14, accent bg 0.15, accent border)
          h('div', {
            style: {
              width: '160px',
              height: '52px',
              borderRadius: '14px',
              background: `${accent}26`,
              border: `2px solid ${accent}`,
              color: accent,
              fontSize: '18px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            },
          }, primaryLabel),

          // Secondary button (QML: 140x52, mutedColor border, textColor text)
          h('div', {
            style: {
              width: '140px',
              height: '52px',
              borderRadius: '14px',
              background: 'transparent',
              border: `2px solid ${mutedColor}`,
              color: textColor,
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            },
          }, '⏰ +5 min'),
        ]),

        // Dismiss hint
        h('div', {
          style: {
            fontSize: '13px',
            color: mutedColor,
            opacity: '0.6',
          },
        }, 'Press anywhere to dismiss'),
      ]),
    ])
  },
})

const meta: Meta<typeof FullScreenOverlay> = {
  title: 'KDE Widget/FullScreenOverlay',
  component: FullScreenOverlay,
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
    lastCompletedWasWork: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof FullScreenOverlay>

export const WorkComplete: Story = {
  args: {
    lastCompletedWasWork: true,
  },
}

export const BreakComplete: Story = {
  args: {
    lastCompletedWasWork: false,
  },
}
