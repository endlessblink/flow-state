import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import BaseCard from '@/components/base/BaseCard.vue'

const meta = {
  component: BaseCard,
  title: '🧩 Components/🔘 Base/BaseCard',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `A flexible card component with multiple variants and effects. Cards are the primary container for grouping related content.

**When to use:**
- Group related information and actions
- Create distinct visual sections
- Display content that users can interact with
- Build task cards, project cards, or settings panels`
      }
    }
  },

  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'outlined', 'filled'],
      description: 'Visual style variant',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'default' }
      }
    },
    hoverable: {
      control: 'boolean',
      description: 'Add hover effects (elevation & transform)',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' }
      }
    },
    glass: {
      control: 'boolean',
      description: 'Enable glassmorphism effect with backdrop blur',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' }
      }
    },
    elevated: {
      control: 'boolean',
      description: 'Add extra elevation with larger shadow',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' }
      }
    }
  }
} satisfies Meta<typeof BaseCard>

export default meta
type Story = StoryObj<typeof meta>

// PRIMARY STORY - Default with interactive controls
export const Default: Story = {
  args: {
    variant: 'default',
    hoverable: false,
    glass: false,
    elevated: false
  },
  render: (args) => ({
    components: { BaseCard },
    setup() {
      return { args }
    },
    template: `
      <BaseCard v-bind="args" style="width: 320px;">
        <div style="padding: var(--space-2);">
          <h3 style="margin: 0 0 var(--space-2) 0; font-size: 16px; font-weight: 600; color: var(--text-primary);">
            Default Card
          </h3>
          <p style="margin: 0; font-size: 14px; color: var(--text-secondary); line-height: 1.5;">
            The default card style with subtle background and border. Use for general content grouping.
          </p>
        </div>
      </BaseCard>
    `,
  })
}

// VARIANTS COMPARISON - Show all visual variants side by side
export const Variants: Story = {
  parameters: {
    docs: {
      description: {
        story: `**Visual variants for different contexts:**

- **Default**: Standard card with subtle background and border (most common)
- **Outlined**: Transparent background with visible border (use on colored backgrounds)
- **Filled**: Solid background color (use for emphasis or differentiation)`
      }
    }
  },
  render: () => ({
    components: { BaseCard },
    template: `
      <div style="display: flex; gap: var(--space-6); flex-wrap: wrap;">
        <!-- Default -->
        <BaseCard variant="default" style="width: 280px;">
          <div style="padding: var(--space-4);">
            <h4 style="margin: 0 0 var(--space-2) 0; font-size: 14px; font-weight: 600; color: var(--text-primary);">Default</h4>
            <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">
              Use for general content. Works on any background.
            </p>
          </div>
        </BaseCard>

        <!-- Outlined -->
        <BaseCard variant="outlined" style="width: 280px;">
          <div style="padding: var(--space-4);">
            <h4 style="margin: 0 0 var(--space-2) 0; font-size: 14px; font-weight: 600; color: var(--text-primary);">Outlined</h4>
            <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">
              Use on colored backgrounds or for subtle emphasis.
            </p>
          </div>
        </BaseCard>

        <!-- Filled -->
        <BaseCard variant="filled" style="width: 280px;">
          <div style="padding: var(--space-4);">
            <h4 style="margin: 0 0 var(--space-2) 0; font-size: 14px; font-weight: 600; color: var(--text-primary);">Filled</h4>
            <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">
              Use for emphasis or to differentiate from other cards.
            </p>
          </div>
        </BaseCard>
      </div>
    `,
  })
}

// EFFECTS - Show hoverable, glass, and elevated in realistic contexts
export const Effects: Story = {
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story: `**Effects for interaction and visual hierarchy:**

- **Hoverable**: Adds lift effect on hover (use for clickable cards)
- **Glass**: Glassmorphism effect with backdrop blur (use on colorful/gradient backgrounds)
- **Elevated**: Extra shadow for hierarchy (use to emphasize important cards)`
      }
    }
  },
  render: () => ({
    components: { BaseCard },
    template: `
      <div style="padding: var(--space-8); display: flex; flex-direction: column; gap: var(--space-8);">
        <!-- Hoverable Card -->
        <div>
          <h3 style="margin: 0 0 var(--space-4) 0; font-size: 16px; font-weight: 600; color: var(--text-primary);">
            Hoverable Card
          </h3>
          <p style="margin: 0 0 var(--space-4) 0; font-size: 14px; color: var(--text-muted);">
            Use when cards are clickable or interactive. Hover to see the effect.
          </p>
          <BaseCard hoverable style="width: 320px; cursor: pointer;">
            <div style="padding: var(--space-4);">
              <h4 style="margin: 0 0 var(--space-2) 0; font-size: 14px; font-weight: 600; color: var(--text-primary);">
                Interactive Card
              </h4>
              <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">
                This card lifts on hover to indicate it's clickable.
              </p>
            </div>
          </BaseCard>
        </div>

        <!-- Glass Card -->
        <div>
          <h3 style="margin: 0 0 var(--space-4) 0; font-size: 16px; font-weight: 600; color: var(--text-primary);">
            Glass Card
          </h3>
          <p style="margin: 0 0 var(--space-4) 0; font-size: 14px; color: var(--text-muted);">
            Use on colorful or gradient backgrounds for a modern glassmorphism effect.
          </p>
          <div style="padding: var(--space-8); background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: var(--radius-xl);">
            <BaseCard glass style="width: 320px;">
              <div style="padding: var(--space-4);">
                <h4 style="margin: 0 0 var(--space-2) 0; font-size: 14px; font-weight: 600; color: var(--text-primary);">
                  Glass Effect
                </h4>
                <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">
                  Glassmorphism works best on vibrant backgrounds.
                </p>
              </div>
            </BaseCard>
          </div>
        </div>

        <!-- Elevated Card -->
        <div>
          <h3 style="margin: 0 0 var(--space-4) 0; font-size: 16px; font-weight: 600; color: var(--text-primary);">
            Elevated Card
          </h3>
          <p style="margin: 0 0 var(--space-4) 0; font-size: 14px; color: var(--text-muted);">
            Use to create visual hierarchy and emphasize important content.
          </p>
          <BaseCard elevated style="width: 320px;">
            <div style="padding: var(--space-4);">
              <h4 style="margin: 0 0 var(--space-2) 0; font-size: 14px; font-weight: 600; color: var(--text-primary);">
                Important Card
              </h4>
              <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">
                Extra shadow creates depth and draws attention.
              </p>
            </div>
          </BaseCard>
        </div>
      </div>
    `,
  })
}

// WITH SLOTS - Show header and footer usage
export const WithSlots: Story = {
  parameters: {
    docs: {
      description: {
        story: `**Cards support header and footer slots for structured content:**

- **Header**: For titles, actions, or badges
- **Footer**: For metadata, timestamps, or action buttons
- Use slots to create consistent, structured layouts`
      }
    }
  },
  render: () => ({
    components: { BaseCard },
    template: `
      <div style="display: flex; gap: var(--space-6); flex-wrap: wrap;">
        <!-- With Header -->
        <BaseCard style="width: 300px;">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: var(--text-primary);">
                Task Summary
              </h3>
              <span style="padding: 2px 8px; background: var(--color-work); color: white; border-radius: var(--radius-full); font-size: 11px; font-weight: 500;">
                Active
              </span>
            </div>
          </template>
          <p style="margin: 0; font-size: 14px; color: var(--text-secondary);">
            Card with header slot for title and status badge.
          </p>
        </BaseCard>

        <!-- With Footer -->
        <BaseCard style="width: 300px;">
          <p style="margin: 0; font-size: 14px; color: var(--text-secondary);">
            Card with footer slot for actions and metadata.
          </p>
          <template #footer>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; color: var(--text-muted);">Updated 2h ago</span>
              <button style="padding: 6px 12px; background: var(--brand-primary); color: white; border: none; border-radius: var(--radius-md); font-size: 12px; cursor: pointer;">
                View
              </button>
            </div>
          </template>
        </BaseCard>

        <!-- With Both -->
        <BaseCard style="width: 300px;">
          <template #header>
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: var(--text-primary);">
              Project Card
            </h3>
          </template>
          <p style="margin: 0; font-size: 14px; color: var(--text-secondary);">
            Card with both header and footer slots for complete structure.
          </p>
          <template #footer>
            <div style="display: flex; gap: var(--space-2);">
              <span style="padding: 4px 8px; background: var(--surface-tertiary); border-radius: var(--radius-sm); font-size: 11px;">React</span>
              <span style="padding: 4px 8px; background: var(--surface-tertiary); border-radius: var(--radius-sm); font-size: 11px;">Vue</span>
            </div>
          </template>
        </BaseCard>
      </div>
    `,
  })
}

// REAL-WORLD EXAMPLE - Task Card
export const TaskCardExample: Story = {
  parameters: {
    docs: {
      description: {
        story: 'A realistic task card example showing how to combine variants, effects, and slots for a production-ready component.'
      }
    }
  },
  render: () => ({
    components: { BaseCard },
    template: `
      <BaseCard hoverable elevated style="width: 380px;">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-2);">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: var(--text-primary); flex: 1;">
              Complete Project Documentation
            </h3>
            <div style="display: flex; gap: 4px; flex-shrink: 0;">
              <span style="padding: 3px 8px; background: var(--color-work); color: white; border-radius: var(--radius-full); font-size: 11px; font-weight: 500;">
                Work
              </span>
              <span style="padding: 3px 8px; background: var(--color-danger); color: white; border-radius: var(--radius-full); font-size: 11px; font-weight: 500;">
                High
              </span>
            </div>
          </div>
        </template>

        <div style="display: flex; flex-direction: column; gap: var(--space-4);">
          <p style="margin: 0; font-size: 14px; color: var(--text-secondary); line-height: 1.5;">
            Write comprehensive documentation for the new task management system including API endpoints and user guide.
          </p>

          <div style="display: flex; align-items: center; gap: var(--space-3); font-size: 13px; color: var(--text-muted); flex-wrap: wrap;">
            <span style="display: flex; align-items: center; gap: 4px;">
              📁 Projects
            </span>
            <span>•</span>
            <span style="display: flex; align-items: center; gap: 4px;">
              ⏱️ 2 hours
            </span>
            <span>•</span>
            <span style="display: flex; align-items: center; gap: 4px;">
              📅 Due today
            </span>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <div style="width: 32px; height: 32px; background: var(--color-work); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; color: white; font-weight: 600;">
                JD
              </div>
              <span style="font-size: 13px; color: var(--text-secondary);">John Doe</span>
            </div>
            <div style="display: flex; align-items: center; gap: var(--space-2); font-size: 13px; color: var(--text-muted);">
              <div style="width: 16px; height: 16px; border: 2px solid var(--border-medium); border-radius: 50%; border-top-color: var(--color-work); border-right-color: var(--color-work);"></div>
              <span>75%</span>
            </div>
          </div>
        </div>

        <template #footer>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; color: var(--text-muted);">Updated 1 hour ago</span>
            <div style="display: flex; gap: var(--space-2);">
              <button style="padding: 6px 12px; background: var(--glass-bg-medium); border: 1px solid var(--glass-border); border-radius: var(--radius-md); font-size: 12px; cursor: pointer; color: var(--text-secondary);">
                Edit
              </button>
              <button style="padding: 6px 12px; background: transparent; border: 1px solid var(--brand-primary); border-radius: var(--radius-md); font-size: 12px; cursor: pointer; color: var(--brand-primary); box-shadow: 0 0 0 1px var(--brand-primary) inset;">
                Start Timer
              </button>
            </div>
          </div>
        </template>
      </BaseCard>
    `,
  })
}
