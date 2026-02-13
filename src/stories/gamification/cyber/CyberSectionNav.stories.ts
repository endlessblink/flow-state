import type { Meta, StoryObj } from '@storybook/vue3'
import CyberSectionNav from '@/components/gamification/cyber/CyberSectionNav.vue'
import { ref } from 'vue'

const meta = {
  title: '🎮 Gamification/Cyber/CyberSectionNav',
  component: CyberSectionNav,
  tags: ['autodocs', 'new'],
  argTypes: {
    activeSection: {
      control: 'select',
      options: ['overview', 'missions', 'boss', 'upgrades', 'achievements', 'arena'],
      description: 'Currently active section',
    },
  },
} satisfies Meta<typeof CyberSectionNav>

export default meta
type Story = StoryObj<typeof meta>

export const Overview: Story = {
  args: {
    activeSection: 'overview',
  },
  render: (args) => ({
    components: { CyberSectionNav },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-6); background: var(--cf-dark-1, #0a0a0f);">
        <CyberSectionNav v-bind="args" />
      </div>
    `,
  }),
}

export const Missions: Story = {
  args: {
    activeSection: 'missions',
  },
  render: (args) => ({
    components: { CyberSectionNav },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-6); background: var(--cf-dark-1, #0a0a0f);">
        <CyberSectionNav v-bind="args" />
      </div>
    `,
  }),
}

export const Boss: Story = {
  args: {
    activeSection: 'boss',
  },
  render: (args) => ({
    components: { CyberSectionNav },
    setup() {
      return { args }
    },
    template: `
      <div style="padding: var(--space-6); background: var(--cf-dark-1, #0a0a0f);">
        <CyberSectionNav v-bind="args" />
      </div>
    `,
  }),
}

export const Interactive: Story = {
  args: {
    activeSection: 'overview',
  },
  render: (args) => ({
    components: { CyberSectionNav },
    setup() {
      const activeSection = ref(args.activeSection)
      const handleUpdate = (section: string) => {
        activeSection.value = section as typeof args.activeSection
      }
      return { activeSection, handleUpdate }
    },
    template: `
      <div style="padding: var(--space-6); background: var(--cf-dark-1, #0a0a0f);">
        <CyberSectionNav :activeSection="activeSection" @update:activeSection="handleUpdate" />
        <div style="margin-top: var(--space-4); padding: var(--space-4); background: var(--cf-dark-2); border-radius: var(--radius-md);">
          <p style="font-family: var(--font-cyber-data); color: var(--text-secondary);">
            Active Section: <span style="color: var(--cf-cyan); font-weight: 700;">{{ activeSection.toUpperCase() }}</span>
          </p>
        </div>
      </div>
    `,
  }),
}
