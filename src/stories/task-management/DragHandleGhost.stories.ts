import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'

/**
 * **DragHandleGhost** is the floating 6-dot indicator that follows the cursor
 * when dragging a task row to reorder it.
 *
 * The real component uses `<Teleport to="body">` + `position: fixed`, which
 * breaks inside Storybook's iframe. These stories use inline replicas of the
 * ghost styling so you can see exactly what it looks like in context.
 *
 * **How it works in the app:**
 * 1. User grabs a task row's drag handle (⠿ dots on the left)
 * 2. DragHandleGhost appears at the cursor
 * 3. Ghost follows the mouse via reactive `position` prop
 * 4. On drop, `isDragging` → false and the ghost disappears
 */
const meta = {
  title: '📝 Task Management/DragHandleGhost',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'The floating 6-dot drag indicator that follows the cursor during task reordering. Uses `<Teleport>` + `position: fixed` in production — stories show inline replicas for correct Storybook rendering.'
      }
    }
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const ghostBoxStyle = `
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: var(--filter-tasks-bg);
  border: 1px solid var(--filter-tasks-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  opacity: 0.85;
  transform: scale(1.1);
`

const dotGridStyle = `
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 3px;
`

const dotStyle = `
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-navigation);
  box-shadow: 0 0 6px var(--filter-tasks-border);
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

const handleDotsStyle = `
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2px;
  cursor: grab;
  opacity: 0.35;
  padding: var(--space-1);
`

const handleDotStyle = `
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--text-tertiary);
`

/**
 * Shows the ghost next to a simulated task list so you can see
 * what the drag experience looks like. The ghost appears when a
 * user grabs any task row's drag handle.
 */
export const InContext: Story = {
  name: 'Ghost in Context',
  render: () => ({
    setup() {
      const tasks = [
        'Review pull requests',
        'Update documentation',
        'Fix login bug',
        'Design new dashboard',
        'Write unit tests',
      ]
      return { tasks }
    },
    template: `
      <div style="
        min-height: 100vh;
        background: var(--app-background-gradient);
        padding: var(--space-10) var(--space-6);
      ">
        <div style="max-width: 700px; margin: 0 auto;">
          <div style="
            color: var(--text-primary);
            font-size: var(--text-lg);
            font-weight: 600;
            margin-bottom: var(--space-2);
          ">Task Reordering</div>
          <div style="
            color: var(--text-secondary);
            font-size: var(--text-sm);
            margin-bottom: var(--space-6);
            line-height: 1.5;
          ">When a user grabs the ⠿ drag handle, the blue ghost appears at the cursor and follows it until drop.</div>

          <div style="display: flex; gap: var(--space-8); align-items: flex-start;">
            <!-- Task list -->
            <div style="flex: 1; display: flex; flex-direction: column; gap: var(--space-2);">
              <div v-for="(task, i) in tasks" :key="i" style="${taskRowStyle}; position: relative;"
                :style="i === 2 ? 'border-color: var(--filter-tasks-border); background: var(--filter-tasks-bg);' : ''"
              >
                <div style="${handleDotsStyle}"
                  :style="i === 2 ? 'opacity: 0.8; cursor: grabbing;' : ''"
                >
                  <div v-for="d in 6" :key="d" style="${handleDotStyle}"
                    :style="i === 2 ? 'background: var(--color-navigation);' : ''"
                  ></div>
                </div>
                <div style="
                  width: 16px; height: 16px;
                  border-radius: var(--radius-sm);
                  border: 1.5px solid var(--text-quaternary);
                  flex-shrink: 0;
                "></div>
                <span style="color: var(--text-primary); font-size: var(--text-sm);">{{ task }}</span>

                <!-- Arrow pointing to ghost on the dragged row -->
                <div v-if="i === 2" style="
                  position: absolute;
                  right: -40px;
                  top: 50%;
                  transform: translateY(-50%);
                  color: var(--filter-tasks-border);
                  font-size: var(--text-lg);
                ">→</div>
              </div>
            </div>

            <!-- Ghost replica (inline, not teleported) -->
            <div style="
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: var(--space-3);
              padding-top: 88px;
            ">
              <div style="${ghostBoxStyle}">
                <div style="${dotGridStyle}">
                  <div v-for="n in 6" :key="n" style="${dotStyle}"></div>
                </div>
              </div>
              <div style="
                color: var(--filter-tasks-border);
                font-size: var(--text-xs);
                text-align: center;
                max-width: 80px;
                line-height: 1.3;
              ">Ghost at cursor</div>
            </div>
          </div>

          <!-- Legend -->
          <div style="
            margin-top: var(--space-8);
            padding: var(--space-4);
            background: var(--glass-bg-soft);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            display: flex;
            gap: var(--space-6);
            flex-wrap: wrap;
          ">
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <div style="width: 12px; height: 12px; border-radius: var(--radius-xs); background: var(--filter-tasks-bg); border: 1px solid var(--filter-tasks-border);"></div>
              <span style="color: var(--text-secondary); font-size: var(--text-xs);">Active drag source</span>
            </div>
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <div style="${ghostBoxStyle}; width: 16px; height: 16px; transform: none; opacity: 1;">
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px;">
                  <div v-for="n in 6" :key="n" style="width: 2px; height: 2px; border-radius: 50%; background: var(--color-navigation);"></div>
                </div>
              </div>
              <span style="color: var(--text-secondary); font-size: var(--text-xs);">Floating ghost (follows cursor)</span>
            </div>
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <div style="width: 12px; height: 12px; border-radius: var(--radius-xs); background: var(--glass-bg-soft); border: 1px solid var(--glass-border);"></div>
              <span style="color: var(--text-secondary); font-size: var(--text-xs);">Normal task row</span>
            </div>
          </div>
        </div>
      </div>
    `
  })
}

/**
 * Shows all the visual states of the ghost element:
 * visible (dragging), scaled up, and the dot pattern close-up.
 */
export const GhostAnatomy: Story = {
  name: 'Ghost Anatomy',
  render: () => ({
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
          ">Ghost Anatomy</div>
          <div style="
            color: var(--text-secondary);
            font-size: var(--text-sm);
            margin-bottom: var(--space-8);
            line-height: 1.5;
          ">The ghost is a 48×48px blue-tinted square with 6 dots, rendered at 110% scale and 85% opacity.</div>

          <div style="
            display: flex;
            gap: var(--space-10);
            align-items: flex-start;
            justify-content: center;
            flex-wrap: wrap;
          ">
            <!-- Normal size -->
            <div style="text-align: center;">
              <div style="
                color: var(--text-tertiary);
                font-size: var(--text-xs);
                margin-bottom: var(--space-3);
                text-transform: uppercase;
                letter-spacing: 0.05em;
              ">Default (1×)</div>
              <div style="
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 48px;
                height: 48px;
                background: var(--filter-tasks-bg);
                border: 1px solid var(--filter-tasks-border);
                border-radius: var(--radius-md);
                box-shadow: var(--shadow-md);
              ">
                <div style="${dotGridStyle}">
                  <div v-for="n in 6" :key="n" style="${dotStyle}"></div>
                </div>
              </div>
              <div style="color: var(--text-quaternary); font-size: var(--text-xs); margin-top: var(--space-2);">48 × 48px</div>
            </div>

            <!-- Scaled (as rendered during drag) -->
            <div style="text-align: center;">
              <div style="
                color: var(--text-tertiary);
                font-size: var(--text-xs);
                margin-bottom: var(--space-3);
                text-transform: uppercase;
                letter-spacing: 0.05em;
              ">During drag (1.1×)</div>
              <div style="${ghostBoxStyle}">
                <div style="${dotGridStyle}">
                  <div v-for="n in 6" :key="n" style="${dotStyle}"></div>
                </div>
              </div>
              <div style="color: var(--text-quaternary); font-size: var(--text-xs); margin-top: var(--space-2);">scale(1.1), opacity 0.85</div>
            </div>

            <!-- Large close-up -->
            <div style="text-align: center;">
              <div style="
                color: var(--text-tertiary);
                font-size: var(--text-xs);
                margin-bottom: var(--space-3);
                text-transform: uppercase;
                letter-spacing: 0.05em;
              ">Close-up (3×)</div>
              <div style="
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 144px;
                height: 144px;
                background: var(--filter-tasks-bg);
                border: 1px solid var(--filter-tasks-border);
                border-radius: var(--radius-lg);
                box-shadow: var(--shadow-md);
              ">
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 9px;">
                  <div v-for="n in 6" :key="n" style="
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: var(--color-navigation);
                    box-shadow: var(--priority-low-glow);
                  "></div>
                </div>
              </div>
              <div style="color: var(--text-quaternary); font-size: var(--text-xs); margin-top: var(--space-2);">6-dot grid pattern</div>
            </div>
          </div>

          <!-- CSS specs -->
          <div style="
            margin-top: var(--space-10);
            padding: var(--space-4);
            background: var(--glass-bg-soft);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
          ">
            <div style="
              color: var(--text-tertiary);
              font-size: var(--text-xs);
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: var(--space-3);
            ">CSS Properties</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2);">
              <div style="color: var(--text-secondary); font-size: var(--text-xs);">
                <code style="color: var(--brand-primary);">position</code> fixed (teleported to body)
              </div>
              <div style="color: var(--text-secondary); font-size: var(--text-xs);">
                <code style="color: var(--brand-primary);">pointer-events</code> none
              </div>
              <div style="color: var(--text-secondary); font-size: var(--text-xs);">
                <code style="color: var(--brand-primary);">z-index</code> 9999
              </div>
              <div style="color: var(--text-secondary); font-size: var(--text-xs);">
                <code style="color: var(--brand-primary);">transform</code> translate(-50%, -50%) scale(1.1)
              </div>
              <div style="color: var(--text-secondary); font-size: var(--text-xs);">
                <code style="color: var(--brand-primary);">background</code> --blue-bg-light (15% alpha)
              </div>
              <div style="color: var(--text-secondary); font-size: var(--text-xs);">
                <code style="color: var(--brand-primary);">border</code> --blue-border-medium
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  })
}
