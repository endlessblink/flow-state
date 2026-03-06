import type { Meta, StoryObj } from '@storybook/vue3'
import DragHandleHints from '@/components/tasks/drag-handle/DragHandleHints.vue'
import { ref } from 'vue'

const meta = {
  title: '📝 Task Management/DragHandleHints',
  component: DragHandleHints,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `A keyboard-shortcut tooltip that appears below a task row's drag handle (⠿) on hover.

Shows three shortcuts: **Click** → Start drag, **↑↓←→** → Move, **Esc** → Cancel.

Appears with a fade+slide transition when the user hovers the drag handle, and disappears on mouse leave. Uses \`position: absolute\` anchored below its parent container.`
      }
    }
  },
  argTypes: {
    showDragHints: { control: 'boolean', description: 'Master toggle — when false, hints never appear regardless of hover' },
    isHovered: { control: 'boolean', description: 'Whether the parent drag handle is being hovered' },
    size: { control: 'select', options: ['sm', 'md', 'lg'], description: 'Size variant matching the parent drag handle' }
  }
} satisfies Meta<typeof DragHandleHints>

export default meta
type Story = StoryObj<typeof meta>

const handleDotsStyle = `
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2px;
  padding: 2px;
`

const handleDotStyle = `
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--text-tertiary);
`

const taskRowStyle = `
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
`

/**
 * Hover over the drag handle (⠿ dots) on any task row to see the
 * keyboard shortcut hints appear with a fade-slide animation.
 */
export const Interactive: Story = {
  name: 'Hover to Reveal',
  args: {
    showDragHints: true,
    isHovered: false,
    size: 'md'
  },
  render: (args) => ({
    components: { DragHandleHints },
    setup() {
      const hoveredIndex = ref<number | null>(null)
      const tasks = [
        'Review pull requests',
        'Update documentation',
        'Fix login bug',
        'Design new dashboard',
      ]
      return { args, hoveredIndex, tasks }
    },
    template: `
      <div style="
        min-height: 100vh;
        background: var(--app-background-gradient);
        padding: var(--space-10) var(--space-6);
      ">
        <div style="max-width: 550px; margin: 0 auto;">
          <div style="
            color: var(--text-primary);
            font-size: var(--text-lg);
            font-weight: 600;
            margin-bottom: var(--space-2);
          ">Drag Handle Hints</div>
          <div style="
            color: var(--text-secondary);
            font-size: var(--text-sm);
            margin-bottom: var(--space-6);
            line-height: 1.5;
          ">Hover over the ⠿ drag handle on any row below to see keyboard shortcut hints appear.</div>

          <div style="display: flex; flex-direction: column; gap: var(--space-2);">
            <div v-for="(task, i) in tasks" :key="i" style="${taskRowStyle}">
              <!-- Drag handle with hints -->
              <div
                @mouseenter="hoveredIndex = i"
                @mouseleave="hoveredIndex = null"
                style="
                  position: relative;
                  cursor: grab;
                  padding: var(--space-1);
                  border-radius: var(--radius-sm);
                  transition: background var(--duration-fast);
                "
                :style="hoveredIndex === i ? 'background: var(--surface-hover);' : ''"
              >
                <div style="${handleDotsStyle}"
                  :style="hoveredIndex === i ? 'opacity: 0.9;' : 'opacity: 0.35;'"
                >
                  <div v-for="d in 6" :key="d" style="${handleDotStyle}"
                    :style="hoveredIndex === i ? 'background: var(--brand-primary);' : ''"
                  ></div>
                </div>
                <DragHandleHints
                  :show-drag-hints="args.showDragHints"
                  :is-hovered="hoveredIndex === i"
                  :size="args.size"
                />
              </div>

              <div style="
                width: 16px; height: 16px;
                border-radius: var(--radius-sm);
                border: 1.5px solid var(--text-quaternary);
                flex-shrink: 0;
              "></div>
              <span style="color: var(--text-primary); font-size: var(--text-sm);">{{ task }}</span>
            </div>
          </div>

          <div style="
            margin-top: var(--space-6);
            padding: var(--space-3) var(--space-4);
            background: var(--glass-bg-soft);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            color: var(--text-tertiary);
            font-size: var(--text-xs);
            line-height: 1.5;
          ">
            The tooltip shows: <kbd style="background: var(--glass-border-hover); padding: 1px 4px; border-radius: 3px; font-family: var(--font-mono); font-size: 10px;">Click</kbd> Start drag ·
            <kbd style="background: var(--glass-border-hover); padding: 1px 4px; border-radius: 3px; font-family: var(--font-mono); font-size: 10px;">↑↓←→</kbd> Move ·
            <kbd style="background: var(--glass-border-hover); padding: 1px 4px; border-radius: 3px; font-family: var(--font-mono); font-size: 10px;">Esc</kbd> Cancel
          </div>
        </div>
      </div>
    `
  })
}

/**
 * All three size variants side by side with hints permanently visible.
 */
export const AllSizes: Story = {
  render: () => ({
    components: { DragHandleHints },
    template: `
      <div style="
        min-height: 100vh;
        background: var(--app-background-gradient);
        padding: var(--space-10) var(--space-6);
      ">
        <div style="max-width: 600px; margin: 0 auto;">
          <div style="
            color: var(--text-primary);
            font-size: var(--text-lg);
            font-weight: 600;
            margin-bottom: var(--space-2);
          ">Size Variants</div>
          <div style="
            color: var(--text-secondary);
            font-size: var(--text-sm);
            margin-bottom: var(--space-8);
            line-height: 1.5;
          ">The hints tooltip adapts to the drag handle size: sm, md, and lg.</div>

          <div style="
            display: flex;
            gap: var(--space-16);
            align-items: flex-start;
            justify-content: center;
            padding-bottom: 120px;
          ">
            <div v-for="size in ['sm', 'md', 'lg']" :key="size" style="
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: var(--space-2);
            ">
              <div style="
                color: var(--text-tertiary);
                font-size: var(--text-xs);
                text-transform: uppercase;
                letter-spacing: 0.05em;
              ">{{ size }}</div>
              <div :style="{
                width: size === 'sm' ? '32px' : size === 'lg' ? '64px' : '48px',
                height: size === 'sm' ? '32px' : size === 'lg' ? '64px' : '48px',
                background: 'var(--glass-bg-medium)',
                border: '1px solid var(--brand-primary)',
                borderRadius: 'var(--radius-md)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }">
                <div style="${handleDotsStyle}; opacity: 0.7;">
                  <div v-for="d in 6" :key="d" style="${handleDotStyle}; background: var(--brand-primary);"></div>
                </div>
                <DragHandleHints
                  :show-drag-hints="true"
                  :is-hovered="true"
                  :size="size"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  })
}

/**
 * When showDragHints is false (user disabled hints in settings),
 * hovering the handle shows nothing.
 */
export const Disabled: Story = {
  name: 'Hints Disabled',
  args: {
    showDragHints: false,
    isHovered: true,
    size: 'md'
  },
  render: (args) => ({
    components: { DragHandleHints },
    setup() {
      return { args }
    },
    template: `
      <div style="
        min-height: 100vh;
        background: var(--app-background-gradient);
        padding: var(--space-10) var(--space-6);
      ">
        <div style="max-width: 400px; margin: 0 auto; text-align: center;">
          <div style="
            color: var(--text-primary);
            font-size: var(--text-lg);
            font-weight: 600;
            margin-bottom: var(--space-2);
          ">Hints Disabled</div>
          <div style="
            color: var(--text-secondary);
            font-size: var(--text-sm);
            margin-bottom: var(--space-8);
            line-height: 1.5;
          ">When <code style="color: var(--brand-primary);">showDragHints</code> is false, nothing appears even when hovered. Toggle it to true in the controls below.</div>

          <div style="
            width: 48px;
            height: 48px;
            background: var(--glass-bg-medium);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            position: relative;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="${handleDotsStyle}; opacity: 0.5;">
              <div v-for="d in 6" :key="d" style="${handleDotStyle}"></div>
            </div>
            <DragHandleHints v-bind="args" />
          </div>
        </div>
      </div>
    `
  })
}
