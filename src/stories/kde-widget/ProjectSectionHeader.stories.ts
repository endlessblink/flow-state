import type { Meta, StoryObj } from '@storybook/vue3'
import { defineComponent, h } from 'vue'

const bgColor = '#232034'
const textColor = '#E2E8F0'
const mutedColor = '#7E7590'

const ProjectSectionHeader = defineComponent({
  name: 'ProjectSectionHeader',
  props: {
    projectName: { type: String, default: 'My Projects' },
    projectColor: { type: String, default: '#4ECDC4' },
  },
  render() {
    const p = this.$props as any

    return h('div', {
      style: {
        width: '440px',
        height: '28px',
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        paddingLeft: '8px',
        fontFamily: 'Noto Sans, sans-serif',
        boxSizing: 'border-box',
      },
    }, [
      // Color dot
      h('div', {
        style: {
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: p.projectColor || mutedColor,
          flexShrink: '0',
        },
      }),

      // Project name
      h('span', {
        style: {
          fontSize: '11px',
          fontWeight: 'bold',
          color: textColor,
          flexShrink: '0',
          whiteSpace: 'nowrap',
        },
      }, p.projectName),

      // Separator line
      h('div', {
        style: {
          flex: '1',
          height: '1px',
          background: 'rgba(255,255,255,0.08)',
          marginLeft: '4px',
        },
      }),
    ])
  },
})

const meta: Meta<typeof ProjectSectionHeader> = {
  title: 'KDE Widget/ProjectSectionHeader',
  component: ProjectSectionHeader,
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
    projectName: { control: 'text' },
    projectColor: { control: 'color' },
  },
}

export default meta
type Story = StoryObj<typeof ProjectSectionHeader>

export const Default: Story = {
  args: {
    projectName: 'My Projects',
    projectColor: '#4ECDC4',
  },
}

export const WorkProject: Story = {
  args: {
    projectName: 'Work',
    projectColor: '#FF6B6B',
  },
}

export const PersonalProject: Story = {
  args: {
    projectName: 'Personal',
    projectColor: '#A78BFA',
  },
}

export const NoColor: Story = {
  args: {
    projectName: 'Unsorted',
    projectColor: mutedColor,
  },
}
