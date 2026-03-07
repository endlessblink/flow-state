import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, h } from 'vue'

const panelBg = '#2d2d44'
const textColor = '#E2E8F0'
const mutedColor = '#7E7590'
const workColor = '#4ECDC4'

// Helper: section header with top border divider
function sectionHeader(label: string) {
  return h('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      marginTop: '8px',
    },
  }, [
    h('div', { style: { height: '1px', background: 'rgba(255,255,255,0.08)' } }),
    h('div', {
      style: {
        fontSize: '14px',
        fontWeight: 'bold',
        color: textColor,
      },
    }, label),
  ])
}

// Helper: labeled text input row
function inputField(label: string, value: string, masked = false) {
  return h('div', {
    style: { display: 'flex', flexDirection: 'column', gap: '4px' },
  }, [
    h('div', { style: { fontSize: '12px', color: mutedColor } }, label),
    h('div', {
      style: {
        height: '32px',
        borderRadius: '6px',
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.12)',
        padding: '0 10px',
        display: 'flex',
        alignItems: 'center',
        fontSize: '13px',
        color: masked ? mutedColor : textColor,
        letterSpacing: masked ? '4px' : 'normal',
      },
    }, masked ? '••••••••••' : value),
  ])
}

// Helper: number display row
function numberField(label: string, value: string | number, unit = 'min') {
  return h('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '32px',
    },
  }, [
    h('div', { style: { fontSize: '13px', color: textColor } }, label),
    h('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      },
    }, [
      h('div', {
        style: {
          width: '22px',
          height: '22px',
          borderRadius: '4px',
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          color: mutedColor,
          cursor: 'pointer',
        },
      }, '−'),
      h('div', { style: { fontSize: '13px', color: textColor, minWidth: '20px', textAlign: 'center' } }, String(value)),
      h('div', {
        style: {
          width: '22px',
          height: '22px',
          borderRadius: '4px',
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          color: mutedColor,
          cursor: 'pointer',
        },
      }, '+'),
      h('div', { style: { fontSize: '12px', color: mutedColor } }, unit),
    ]),
  ])
}

// Helper: checkbox row
function checkboxRow(label: string, checked: boolean, disabled = false) {
  return h('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      opacity: disabled ? '0.4' : '1',
    },
  }, [
    h('div', {
      style: {
        width: '16px',
        height: '16px',
        borderRadius: '3px',
        border: `1.5px solid ${checked ? workColor : 'rgba(255,255,255,0.2)'}`,
        background: checked ? `${workColor}22` : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: '0',
        cursor: disabled ? 'default' : 'pointer',
      },
    }, checked ? h('span', { style: { color: workColor, fontSize: '11px', fontWeight: 'bold' } }, '✓') : null),
    h('div', { style: { fontSize: '13px', color: textColor } }, label),
  ])
}

// Helper: inline dropdown (visual only)
function dropdownField(label: string, value: string) {
  return h('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
  }, [
    h('div', { style: { fontSize: '13px', color: textColor } }, label),
    h('div', {
      style: {
        height: '28px',
        minWidth: '120px',
        borderRadius: '6px',
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.12)',
        padding: '0 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        fontSize: '13px',
        color: textColor,
        cursor: 'pointer',
      },
    }, [
      h('span', null, value),
      h('span', { style: { color: mutedColor, fontSize: '10px' } }, '▼'),
    ]),
  ])
}

const ConfigPanel = defineComponent({
  name: 'ConfigPanel',
  props: {
    isAuthenticated: { type: Boolean, default: false },
    nannyEnabled: { type: Boolean, default: true },
    openAppMode: { type: String, default: 'web' },
  },
  render() {
    const p = this.$props as any
    const isTauri = p.openAppMode === 'tauri'

    // Day checkboxes: Mon–Sun, Mon–Fri checked
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const defaultChecked = [true, true, true, true, true, false, false]

    const dayCheckboxes = h('div', {
      style: {
        display: 'flex',
        gap: '6px',
        flexWrap: 'wrap',
        opacity: p.nannyEnabled ? '1' : '0.4',
      },
    }, days.map((day, i) =>
      h('div', {
        key: day,
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
        },
      }, [
        h('div', {
          style: {
            width: '28px',
            height: '28px',
            borderRadius: '5px',
            border: `1.5px solid ${defaultChecked[i] ? workColor : 'rgba(255,255,255,0.15)'}`,
            background: defaultChecked[i] ? `${workColor}22` : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: p.nannyEnabled ? 'pointer' : 'default',
          },
        }, defaultChecked[i] ? h('span', { style: { color: workColor, fontSize: '12px' } }, '✓') : null),
        h('div', { style: { fontSize: '10px', color: mutedColor } }, day),
      ])
    ))

    return h('div', {
      style: {
        width: '480px',
        height: '700px',
        background: panelBg,
        borderRadius: '12px',
        padding: '24px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        fontFamily: 'Noto Sans, sans-serif',
        overflowY: 'auto',
      },
    }, [
      // ─── Account ───
      sectionHeader('Account'),

      // Auth status row
      h('div', {
        style: { display: 'flex', alignItems: 'center', gap: '8px' },
      }, [
        h('div', {
          style: {
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: p.isAuthenticated ? '#4ade80' : '#ef4444',
            flexShrink: '0',
          },
        }),
        h('div', { style: { fontSize: '13px', color: mutedColor } },
          p.isAuthenticated ? 'Signed in' : 'Not signed in'),
      ]),

      p.isAuthenticated
        ? h('div', { style: { fontSize: '13px', color: textColor, padding: '4px 0' } }, 'user@example.com')
        : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, [
            inputField('Email', 'user@example.com'),
            inputField('Password', '', true),
            h('div', {
              style: {
                height: '32px',
                borderRadius: '6px',
                border: `1.5px solid ${workColor}`,
                color: workColor,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                background: 'transparent',
                marginTop: '4px',
              },
            }, 'Sign In'),
          ]),

      p.isAuthenticated
        ? h('div', {
            style: {
              height: '32px',
              borderRadius: '6px',
              border: '1.5px solid rgba(239,68,68,0.6)',
              color: '#ef4444',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              background: 'transparent',
            },
          }, 'Sign Out')
        : null,

      // ─── Supabase Connection ───
      sectionHeader('Supabase Connection'),
      inputField('Project URL', 'https://your-project.supabase.co'),
      inputField('Anon Key', '', true),

      // ─── Timer Settings ───
      sectionHeader('Timer Settings'),
      numberField('Work duration', 25),
      numberField('Break duration', 5),
      numberField('Long break', 15),
      numberField('Sessions before long break', 4, 'sessions'),

      // ─── Focus Reminders ───
      sectionHeader('Focus Reminders'),
      checkboxRow('Enable focus reminders', p.nannyEnabled),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', opacity: p.nannyEnabled ? '1' : '0.4' } }, [
        h('div', { style: { fontSize: '12px', color: mutedColor } }, 'Work days'),
        dayCheckboxes,
      ]),
      h('div', { style: { display: 'flex', gap: '16px', opacity: p.nannyEnabled ? '1' : '0.4' } }, [
        h('div', { style: { flex: '1' } }, [numberField('Start hour', 9, 'h')]),
        h('div', { style: { flex: '1' } }, [numberField('End hour', 18, 'h')]),
      ]),
      h('div', { style: { opacity: p.nannyEnabled ? '1' : '0.4' } }, [
        dropdownField('Remind after idle', '60 min'),
      ]),
      h('div', { style: { opacity: p.nannyEnabled ? '1' : '0.4' } }, [
        dropdownField('Tone', 'Gentle'),
      ]),

      // ─── Open App ───
      sectionHeader('Open App'),
      dropdownField('Mode', isTauri ? 'Tauri Desktop App' : 'Web Browser'),
      isTauri
        ? inputField('AppImage path', '/home/user/Applications/FlowState.AppImage')
        : inputField('Web URL', 'http://localhost:5546'),

      // ─── Display ───
      sectionHeader('Display'),
      checkboxRow('Show task list', true),
    ])
  },
})

const meta: Meta<typeof ConfigPanel> = {
  title: 'KDE Widget/ConfigPanel',
  component: ConfigPanel,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'desktop',
      values: [
        { name: 'dark', value: '#1a1a2e' },
        { name: 'desktop', value: '#2d2d44' },
      ],
    },
  },
  argTypes: {
    isAuthenticated: { control: 'boolean' },
    nannyEnabled: { control: 'boolean' },
    openAppMode: {
      control: 'select',
      options: ['web', 'tauri'],
    },
  },
}

export default meta
type Story = StoryObj<typeof ConfigPanel>

export const NotAuthenticated: Story = {
  args: {
    isAuthenticated: false,
    nannyEnabled: true,
    openAppMode: 'web',
  },
}

export const Authenticated: Story = {
  args: {
    isAuthenticated: true,
    nannyEnabled: true,
    openAppMode: 'web',
  },
}

export const NannyDisabled: Story = {
  args: {
    isAuthenticated: true,
    nannyEnabled: false,
    openAppMode: 'web',
  },
}

export const TauriMode: Story = {
  args: {
    isAuthenticated: true,
    nannyEnabled: true,
    openAppMode: 'tauri',
  },
}
