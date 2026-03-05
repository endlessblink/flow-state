import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import DragHandleHints from '@/components/tasks/drag-handle/DragHandleHints.vue'

const meta = {
  title: '🖥️ Tauri Parity/DragHandle',
  component: DragHandleHints,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'DragHandleHints tooltip — demonstrates the opacity/transform fade transition that was fixed for Tauri parity. The tooltip uses `var(--tooltip-bg)` and `var(--glass-border)` so its appearance changes when .tauri-app is applied. Toggle Tauri Mode in the toolbar to compare Browser vs WebKitGTK rendering.',
      },
    },
  },
} satisfies Meta<typeof DragHandleHints>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    showDragHints: true,
    isHovered: false,
    size: 'md',
  },
  render: (args) => ({
    components: { DragHandleHints },
    setup() {
      return { args }
    },
    template: `
      <div style="
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--app-background-gradient, var(--color-base-950));
        padding: var(--space-10);
      ">
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-8);
          padding: var(--space-10);
          background: var(--glass-bg-soft);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-xl);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          min-width: 280px;
        ">
          <p style="
            margin: 0;
            font-size: var(--text-sm);
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-weight: var(--font-semibold);
          ">Static (Not Hovered)</p>

          <!-- Simulated drag handle button -->
          <div style="
            width: var(--space-12);
            height: var(--space-12);
            background: var(--glass-bg-medium);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <!-- Drag handle icon (6-dot grid) -->
            <svg width="16" height="16" viewBox="0 0 16 16" style="color: var(--text-tertiary);">
              <circle cx="5" cy="4" r="1.5" fill="currentColor"/>
              <circle cx="11" cy="4" r="1.5" fill="currentColor"/>
              <circle cx="5" cy="8" r="1.5" fill="currentColor"/>
              <circle cx="11" cy="8" r="1.5" fill="currentColor"/>
              <circle cx="5" cy="12" r="1.5" fill="currentColor"/>
              <circle cx="11" cy="12" r="1.5" fill="currentColor"/>
            </svg>
            <DragHandleHints v-bind="args" />
          </div>

          <p style="
            margin: 0;
            font-size: var(--text-xs);
            color: var(--text-tertiary);
            text-align: center;
          ">
            Tooltip is hidden because <code style="font-family: var(--font-mono, monospace);">isHovered=false</code>.<br>
            The transition uses a fade + translateY enter/leave.
          </p>
        </div>
      </div>
    `,
  }),
}

export const ShowHints: Story = {
  args: {
    showDragHints: true,
    isHovered: true,
    size: 'md',
  },
  render: (args) => ({
    components: { DragHandleHints },
    setup() {
      return { args }
    },
    template: `
      <div style="
        min-height: 100vh;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        background: var(--app-background-gradient, var(--color-base-950));
        padding: var(--space-20) var(--space-10);
      ">
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-24);
          padding: var(--space-10);
          background: var(--glass-bg-soft);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-xl);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          min-width: 320px;
        ">
          <p style="
            margin: 0;
            font-size: var(--text-sm);
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-weight: var(--font-semibold);
          ">Hints Visible (isHovered = true)</p>

          <!-- Simulated drag handle with visible hints -->
          <div style="
            width: var(--space-12);
            height: var(--space-12);
            background: var(--glass-bg-medium);
            border: 1px solid var(--brand-primary, #4ECDC4);
            border-radius: var(--radius-md);
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg width="16" height="16" viewBox="0 0 16 16" style="color: var(--brand-primary, #4ECDC4);">
              <circle cx="5" cy="4" r="1.5" fill="currentColor"/>
              <circle cx="11" cy="4" r="1.5" fill="currentColor"/>
              <circle cx="5" cy="8" r="1.5" fill="currentColor"/>
              <circle cx="11" cy="8" r="1.5" fill="currentColor"/>
              <circle cx="5" cy="12" r="1.5" fill="currentColor"/>
              <circle cx="11" cy="12" r="1.5" fill="currentColor"/>
            </svg>
            <DragHandleHints v-bind="args" />
          </div>

          <p style="
            margin: 0;
            font-size: var(--text-xs);
            color: var(--text-tertiary);
            text-align: center;
          ">
            The tooltip uses <code style="font-family: var(--font-mono, monospace);">var(--tooltip-bg)</code>
            + <code style="font-family: var(--font-mono, monospace);">var(--glass-border)</code>.<br>
            In Tauri mode these tokens use opaque values.
          </p>
        </div>
      </div>
    `,
  }),
}

export const Interactive: Story = {
  args: {
    showDragHints: true,
    isHovered: false,
    size: 'md',
  },
  render: (args) => ({
    components: { DragHandleHints },
    setup() {
      const isHovered = ref(false)
      return { args, isHovered }
    },
    template: `
      <div style="
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: var(--app-background-gradient, var(--color-base-950));
        padding: var(--space-10);
        gap: var(--space-8);
      ">
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-6);
          padding: var(--space-10);
          background: var(--glass-bg-soft);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-xl);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          min-width: 300px;
        ">
          <p style="
            margin: 0;
            font-size: var(--text-sm);
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-weight: var(--font-semibold);
          ">Interactive — hover the handle</p>

          <!-- Wrapper provides space for the absolutely-positioned tooltip -->
          <div style="padding: var(--space-4) var(--space-8) var(--space-20);">
            <div
              @mouseenter="isHovered = true"
              @mouseleave="isHovered = false"
              :style="{
                width: 'var(--space-12)',
                height: 'var(--space-12)',
                background: isHovered ? 'var(--glass-bg-medium)' : 'var(--glass-bg-soft)',
                border: isHovered ? '1px solid var(--brand-primary)' : '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-md)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'grab',
                transition: 'all var(--duration-fast)',
                transform: isHovered ? 'scale(1.05)' : 'scale(1)',
              }"
            >
              <svg
                width="16" height="16" viewBox="0 0 16 16"
                :style="{ color: isHovered ? 'var(--brand-primary, #4ECDC4)' : 'var(--text-tertiary)', transition: 'color var(--duration-fast)' }"
              >
                <circle cx="5" cy="4" r="1.5" fill="currentColor"/>
                <circle cx="11" cy="4" r="1.5" fill="currentColor"/>
                <circle cx="5" cy="8" r="1.5" fill="currentColor"/>
                <circle cx="11" cy="8" r="1.5" fill="currentColor"/>
                <circle cx="5" cy="12" r="1.5" fill="currentColor"/>
                <circle cx="11" cy="12" r="1.5" fill="currentColor"/>
              </svg>

              <DragHandleHints
                :show-drag-hints="args.showDragHints"
                :is-hovered="isHovered"
                :size="args.size"
              />
            </div>
          </div>

          <p style="
            margin: 0;
            font-size: var(--text-xs);
            color: var(--text-tertiary);
            text-align: center;
          ">
            The fade-in uses <code style="font-family: var(--font-mono, monospace);">var(--duration-normal)</code>
            + opacity/translateY transition.<br>
            This easing was fixed for Tauri parity.
          </p>
        </div>
      </div>
    `,
  }),
}

export const AllSizes: Story = {
  render: () => ({
    components: { DragHandleHints },
    setup() {
      const sizes = ['sm', 'md', 'lg'] as const
      const hoveredStates = ref<boolean[]>([false, false, false])

      return { sizes, hoveredStates }
    },
    template: `
      <div style="
        min-height: 100vh;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        background: var(--app-background-gradient, var(--color-base-950));
        padding: var(--space-20) var(--space-10);
      ">
        <div style="
          display: flex;
          flex-direction: column;
          gap: var(--space-8);
          padding: var(--space-10);
          background: var(--glass-bg-soft);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-xl);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          min-width: 320px;
        ">
          <p style="
            margin: 0;
            font-size: var(--text-sm);
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-weight: var(--font-semibold);
          ">All Sizes — Hover Each Handle</p>

          <div style="
            display: flex;
            gap: var(--space-12);
            align-items: flex-start;
            justify-content: center;
            padding-bottom: var(--space-16);
          ">
            <div
              v-for="(size, index) in sizes"
              :key="size"
              style="display: flex; flex-direction: column; align-items: center; gap: var(--space-3);"
            >
              <div
                @mouseenter="hoveredStates[index] = true"
                @mouseleave="hoveredStates[index] = false"
                :style="{
                  width: size === 'sm' ? 'var(--space-8)' : size === 'lg' ? 'var(--space-16)' : 'var(--space-12)',
                  height: size === 'sm' ? 'var(--space-8)' : size === 'lg' ? 'var(--space-16)' : 'var(--space-12)',
                  background: hoveredStates[index] ? 'var(--glass-bg-medium)' : 'var(--glass-bg-soft)',
                  border: hoveredStates[index] ? '1px solid var(--brand-primary)' : '1px solid var(--glass-border)',
                  borderRadius: 'var(--radius-md)',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'grab',
                  transition: 'all var(--duration-fast)',
                  transform: hoveredStates[index] ? 'scale(1.05)' : 'scale(1)',
                }"
              >
                <svg
                  width="12" height="12" viewBox="0 0 16 16"
                  :style="{ color: hoveredStates[index] ? 'var(--brand-primary, #4ECDC4)' : 'var(--text-tertiary)' }"
                >
                  <circle cx="5" cy="4" r="1.5" fill="currentColor"/>
                  <circle cx="11" cy="4" r="1.5" fill="currentColor"/>
                  <circle cx="5" cy="8" r="1.5" fill="currentColor"/>
                  <circle cx="11" cy="8" r="1.5" fill="currentColor"/>
                  <circle cx="5" cy="12" r="1.5" fill="currentColor"/>
                  <circle cx="11" cy="12" r="1.5" fill="currentColor"/>
                </svg>

                <DragHandleHints
                  :show-drag-hints="true"
                  :is-hovered="hoveredStates[index]"
                  :size="size"
                />
              </div>

              <span style="
                font-size: var(--text-xs);
                color: var(--text-tertiary);
                text-transform: uppercase;
                letter-spacing: 0.05em;
              ">{{ size }}</span>
            </div>
          </div>
        </div>
      </div>
    `,
  }),
}
