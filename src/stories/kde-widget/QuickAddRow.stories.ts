import type { Meta, StoryObj } from '@storybook/vue3'
import { ref, defineComponent, h } from 'vue'

const bgColor = '#232034'
const textColor = '#E2E8F0'
const mutedColor = '#7E7590'
const tealColor = '#4ECDC4'

const QuickAddRow = defineComponent({
  name: 'QuickAddRow',
  props: {
    inputValue: { type: String, default: '' },
    dueDateLabel: { type: String, default: 'Today' },
    isFocused: { type: Boolean, default: false },
  },
  setup(props) {
    const localValue = ref(props.inputValue)
    const focused = ref(props.isFocused)

    return { localValue, focused }
  },
  render() {
    const p = this.$props as any
    const isFocused = this.focused || p.isFocused
    const borderColor = isFocused ? tealColor : 'rgba(255,255,255,0.10)'

    const inputStyle = {
      flex: '1',
      height: '30px',
      borderRadius: '6px',
      background: 'rgba(28, 26, 46, 0.9)',
      border: `1px solid ${borderColor}`,
      padding: '0 10px',
      fontSize: '12px',
      color: textColor,
      outline: 'none',
      boxSizing: 'border-box' as const,
      fontFamily: 'inherit',
    }

    const dueDateStyle = {
      width: '80px',
      height: '30px',
      borderRadius: '6px',
      background: 'rgba(28, 26, 46, 0.9)',
      border: `1px solid ${borderColor}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '12px',
      color: textColor,
      cursor: 'pointer',
      flexShrink: '0',
      userSelect: 'none' as const,
    }

    const addButtonStyle = {
      width: '30px',
      height: '30px',
      borderRadius: '6px',
      background: 'transparent',
      border: `1px solid ${tealColor}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '16px',
      fontWeight: 'bold',
      color: tealColor,
      cursor: 'pointer',
      flexShrink: '0',
    }

    const playButtonStyle = {
      width: '30px',
      height: '30px',
      borderRadius: '6px',
      background: 'transparent',
      border: `1px solid ${tealColor}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
      color: tealColor,
      cursor: 'pointer',
      flexShrink: '0',
    }

    return h('div', {
      style: {
        width: '440px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontFamily: 'Noto Sans, sans-serif',
      },
    }, [
      // Text input
      h('input', {
        style: inputStyle,
        value: this.localValue || p.inputValue,
        placeholder: 'Quick add task...',
        onFocus: () => { this.focused = true },
        onBlur: () => { this.focused = false },
        onInput: (e: Event) => { this.localValue = (e.target as HTMLInputElement).value },
      }),

      // Due date dropdown
      h('div', { style: dueDateStyle }, p.dueDateLabel),

      // Add button
      h('div', { style: addButtonStyle }, '+'),

      // Play button
      h('div', { style: playButtonStyle }, '▶'),
    ])
  },
})

const meta: Meta<typeof QuickAddRow> = {
  title: 'KDE Widget/QuickAddRow',
  component: QuickAddRow,
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
    inputValue: { control: 'text' },
    dueDateLabel: {
      control: 'select',
      options: ['Today', 'Tomorrow', 'No date', 'Next week'],
    },
    isFocused: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof QuickAddRow>

export const Empty: Story = {
  args: {
    inputValue: '',
    dueDateLabel: 'Today',
    isFocused: false,
  },
}

export const WithText: Story = {
  args: {
    inputValue: 'Design the landing page',
    dueDateLabel: 'Today',
    isFocused: true,
  },
}

export const TomorrowDue: Story = {
  args: {
    inputValue: '',
    dueDateLabel: 'Tomorrow',
    isFocused: false,
  },
}

export const NoDueDate: Story = {
  args: {
    inputValue: '',
    dueDateLabel: 'No date',
    isFocused: false,
  },
}
