import type { Meta, StoryObj } from '@storybook/vue3'
import { ref, defineComponent, h, onMounted } from 'vue'

// Design tokens
const bgColor = '#232034'
const textColor = '#E2E8F0'
const mutedColor = '#7E7590'
const workColor = '#4ECDC4'
const inputBg = 'rgba(56, 51, 89, 0.4)'
const inputBorder = 'rgba(56, 51, 89, 0.6)'
const errorColor = '#EF4444'
const googleBlue = '#4285F4'

const LoginView = defineComponent({
  name: 'LoginView',
  props: {
    width: { type: Number, default: 440 },
    height: { type: Number, default: 320 },
    isAuthenticating: { type: Boolean, default: false },
    authError: { type: String, default: '' },
    emailValue: { type: String, default: '' },
    passwordValue: { type: String, default: '' },
  },
  setup(props) {
    const spinnerAngle = ref(0)
    let animFrame = 0

    const animateSpinner = () => {
      spinnerAngle.value = (spinnerAngle.value + 8) % 360
      animFrame = requestAnimationFrame(animateSpinner)
    }

    onMounted(() => {
      if (props.isAuthenticating) {
        animateSpinner()
      }
    })

    return { spinnerAngle, animateSpinner }
  },
  render() {
    const p = this.$props as any
    const hasValues = p.emailValue.length > 0 && p.passwordValue.length > 0
    const btnBorderColor = hasValues ? workColor : mutedColor
    const btnTextColor = hasValues ? workColor : mutedColor
    const btnOpacity = p.isAuthenticating ? '0.5' : '1'

    // Spinner circle drawn as a bordered arc using CSS border trick
    const spinner = h('span', {
      style: {
        display: 'inline-block',
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        border: `2px solid ${workColor}`,
        borderTopColor: 'transparent',
        marginRight: '6px',
        verticalAlign: 'middle',
        animation: 'spin 0.8s linear infinite',
      },
    })

    const spinnerStyle = h('style', {}, '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }')

    const margin = 20
    const gap = 12
    const inputHeight = 32
    const labelSize = 10
    const inputFontSize = 12
    const fullWidth = p.width - margin * 2

    // Field builder
    const buildField = (label: string, placeholder: string, isPassword: boolean, value: string) => {
      const dots = isPassword && value.length > 0
        ? '•'.repeat(Math.min(value.length, 12))
        : ''
      const displayText = isPassword ? dots : value

      return h('div', {
        style: { display: 'flex', flexDirection: 'column', gap: '4px', width: `${fullWidth}px` },
      }, [
        h('div', {
          style: { fontSize: `${labelSize}px`, color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.5px' },
        }, label),
        h('div', {
          style: {
            width: '100%',
            height: `${inputHeight}px`,
            borderRadius: '6px',
            background: inputBg,
            border: `1px solid ${inputBorder}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            boxSizing: 'border-box',
          },
        }, [
          h('span', {
            style: {
              fontSize: `${inputFontSize}px`,
              color: displayText ? textColor : mutedColor,
              fontFamily: isPassword && displayText ? 'monospace' : 'inherit',
              letterSpacing: isPassword && displayText ? '2px' : 'normal',
            },
          }, displayText || placeholder),
        ]),
      ])
    }

    // "or" divider
    const orDivider = h('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: `${fullWidth}px`,
      },
    }, [
      h('div', { style: { flex: '1', height: '1px', background: inputBorder } }),
      h('span', { style: { fontSize: '10px', color: mutedColor } }, 'or'),
      h('div', { style: { flex: '1', height: '1px', background: inputBorder } }),
    ])

    return h('div', {
      style: {
        width: `${p.width}px`,
        minHeight: `${p.height}px`,
        background: bgColor,
        borderRadius: '16px',
        border: `1px solid ${inputBorder}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: `${margin}px`,
        boxSizing: 'border-box',
        gap: `${gap}px`,
        fontFamily: 'system-ui, sans-serif',
      },
    }, [
      spinnerStyle,

      // Tomato emoji
      h('div', { style: { fontSize: '40px', lineHeight: '1', marginBottom: '0' } }, '🍅'),

      // Title
      h('div', {
        style: { fontSize: '18px', fontWeight: 'bold', color: textColor, textAlign: 'center' },
      }, 'PomoFlow'),

      // Subtitle
      h('div', {
        style: { fontSize: '11px', color: mutedColor, textAlign: 'center', lineHeight: '1.4' },
      }, 'Sign in to sync your tasks and timer'),

      // 8px spacer
      h('div', { style: { height: '8px', flexShrink: '0' } }),

      // Email field
      buildField('Email', 'your@email.com', false, p.emailValue),

      // Password field
      buildField('Password', 'Enter password', true, p.passwordValue),

      // Error message
      p.authError
        ? h('div', {
            style: { fontSize: '10px', color: errorColor, textAlign: 'center', width: `${fullWidth}px` },
          }, p.authError)
        : null,

      // Sign In button
      h('div', {
        style: {
          width: `${fullWidth}px`,
          height: '36px',
          borderRadius: '8px',
          background: 'transparent',
          border: `1.5px solid ${btnBorderColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: p.isAuthenticating ? 'not-allowed' : 'pointer',
          opacity: btnOpacity,
          fontSize: '13px',
          color: btnTextColor,
          transition: 'all 0.15s',
          flexShrink: '0',
          boxSizing: 'border-box',
        },
      }, [
        p.isAuthenticating ? spinner : null,
        h('span', {}, p.isAuthenticating ? 'Signing in...' : 'Sign In'),
      ]),

      // "or" divider
      orDivider,

      // Google button
      h('div', {
        style: {
          width: `${fullWidth}px`,
          height: '36px',
          borderRadius: '8px',
          background: 'transparent',
          border: `1.5px solid ${googleBlue}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          cursor: 'pointer',
          fontSize: '13px',
          color: googleBlue,
          flexShrink: '0',
          boxSizing: 'border-box',
        },
      }, [
        h('span', { style: { fontWeight: 'bold', fontSize: '15px' } }, 'G'),
        h('span', {}, 'Continue with Google'),
      ]),

      // Import link
      h('div', {
        style: {
          fontSize: '10px',
          color: workColor,
          textAlign: 'center',
          opacity: '0.7',
          cursor: 'pointer',
          textDecoration: 'underline',
        },
      }, 'Import from FlowState app'),
    ])
  },
})

const meta: Meta<typeof LoginView> = {
  title: 'KDE Widget/LoginView',
  component: LoginView,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#1a1829' },
        { name: 'desktop', value: '#2d2b3d' },
      ],
    },
  },
  argTypes: {
    width: { control: { type: 'range', min: 320, max: 600, step: 10 } },
    height: { control: { type: 'range', min: 260, max: 480, step: 10 } },
    isAuthenticating: { control: 'boolean' },
    authError: { control: 'text' },
    emailValue: { control: 'text' },
    passwordValue: { control: 'text' },
  },
}

export default meta
type Story = StoryObj<typeof LoginView>

export const Default: Story = {
  args: {
    width: 440,
    height: 320,
    isAuthenticating: false,
    authError: '',
    emailValue: '',
    passwordValue: '',
  },
}

export const FilledForm: Story = {
  args: {
    ...Default.args,
    emailValue: 'user@example.com',
    passwordValue: 'hunter2',
  },
}

export const Authenticating: Story = {
  args: {
    ...Default.args,
    emailValue: 'user@example.com',
    passwordValue: 'hunter2',
    isAuthenticating: true,
  },
}

export const WithError: Story = {
  args: {
    ...Default.args,
    emailValue: 'user@example.com',
    passwordValue: 'wrongpassword',
    authError: 'Invalid email or password',
  },
}

export const Compact: Story = {
  args: {
    ...Default.args,
    width: 380,
    height: 300,
  },
}
