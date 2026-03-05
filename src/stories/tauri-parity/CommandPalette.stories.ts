import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'

/**
 * Visual showcase of CommandPalette CSS.
 *
 * The overlay uses `backdrop-filter: blur(var(--blur-md))` which is disabled in Tauri mode,
 * making the scrim fully opaque. The modal panel uses `var(--surface-primary)` for its
 * background — in browser this stays semi-transparent; in Tauri it renders fully opaque
 * via `rgb(30, 27, 48)` override.
 *
 * Toggle the Tauri Mode in the toolbar to compare Browser vs WebKitGTK rendering.
 */
const meta = {
  title: '🖥️ Tauri Parity/CommandPalette',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Visual showcase of CommandPalette CSS. The overlay and panel use backdrop-filter which is disabled in Tauri mode.',
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default: palette modal open over a simulated app background.
 * Replicates the exact CSS from CommandPalette.vue without importing the component.
 */
export const Default: Story = {
  render: () => ({
    setup() {
      const showMoreOptions = ref(false)
      return { showMoreOptions }
    },
    template: `
      <div style="background: var(--app-background-gradient); min-height: 100vh; position: relative; font-family: inherit;">

        <!-- Simulated app content behind overlay -->
        <div style="padding: var(--space-10); opacity: 0.4; pointer-events: none; user-select: none;">
          <div style="display: flex; gap: var(--space-4); margin-bottom: var(--space-6);">
            <div style="width: 240px; min-height: 400px; background: linear-gradient(135deg, var(--glass-bg-subtle) 0%, rgba(255,255,255,0.01) 100%); border-right: 1px solid var(--glass-border); border-radius: var(--radius-lg); padding: var(--space-6);">
              <div style="font-size: var(--text-lg); font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-4);">FlowState</div>
              <div style="display: flex; flex-direction: column; gap: var(--space-2);">
                <div style="padding: var(--space-2) var(--space-3); background: var(--state-active-bg); border-radius: var(--radius-md); color: var(--brand-primary); font-size: var(--text-sm);">Canvas</div>
                <div style="padding: var(--space-2) var(--space-3); color: var(--text-muted); font-size: var(--text-sm);">Board</div>
                <div style="padding: var(--space-2) var(--space-3); color: var(--text-muted); font-size: var(--text-sm);">Calendar</div>
              </div>
            </div>
            <div style="flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4);">
              <div v-for="n in 6" :key="n" style="height: 80px; background: var(--glass-bg-medium); border: 1px solid var(--glass-border); border-radius: var(--radius-lg);"></div>
            </div>
          </div>
        </div>

        <!-- Command Palette Overlay — backdrop-filter: blur(var(--blur-md)) on .tauri-app becomes none -->
        <div style="
          position: fixed;
          inset: 0;
          background: var(--overlay-darker, rgba(0,0,0,0.65));
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 20vh;
          z-index: 200;
        ">
          <!-- Command Palette Modal — background: var(--surface-primary); becomes rgb(30,27,48) in Tauri -->
          <div style="
            background: var(--surface-primary);
            border: 1px solid var(--glass-border-medium, rgba(255,255,255,0.12));
            border-radius: var(--radius-2xl);
            width: 600px;
            max-width: 90vw;
            box-shadow: 0 25px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.1);
            overflow: hidden;
          ">
            <!-- Quick Add Input Section -->
            <div style="
              display: flex;
              align-items: center;
              gap: var(--space-3);
              padding: var(--space-6);
              border-bottom: 1px solid var(--border-subtle);
            ">
              <!-- Plus icon placeholder -->
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--brand-primary); flex-shrink: 0;">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <div style="
                flex: 1;
                background: transparent;
                border: none;
                color: var(--text-primary);
                font-size: var(--text-lg);
                font-weight: 500;
                outline: none;
              ">Add a task...</div>
            </div>

            <!-- Additional Fields (collapsed by default) -->
            <div v-if="showMoreOptions" style="
              display: flex;
              gap: var(--space-3);
              padding: var(--space-4) var(--space-6);
              border-bottom: 1px solid var(--border-subtle);
            ">
              <div style="flex: 1; padding: var(--space-3) var(--space-4); background: transparent; border: 1px solid var(--glass-border-hover); border-radius: var(--radius-md); color: var(--text-secondary); font-size: var(--text-sm); min-height: 44px; display: flex; align-items: center;">Project</div>
              <div style="flex: 1; padding: var(--space-3) var(--space-4); background: transparent; border: 1px solid var(--glass-border-hover); border-radius: var(--radius-md); color: var(--text-secondary); font-size: var(--text-sm); min-height: 44px; display: flex; align-items: center;">Due date</div>
              <div style="flex: 1; padding: var(--space-3) var(--space-4); background: transparent; border: 1px solid var(--glass-border-hover); border-radius: var(--radius-md); color: var(--text-secondary); font-size: var(--text-sm); min-height: 44px; display: flex; align-items: center;">Medium Priority</div>
            </div>

            <!-- Footer Actions -->
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: var(--space-4) var(--space-6);
              border-top: 1px solid var(--border-subtle);
            ">
              <button
                @click="showMoreOptions = !showMoreOptions"
                style="
                  background: transparent;
                  border: 1px solid var(--glass-border-hover);
                  color: var(--text-secondary);
                  padding: var(--space-2) var(--space-4);
                  border-radius: var(--radius-md);
                  cursor: pointer;
                  font-size: var(--text-sm);
                  font-weight: 500;
                  min-height: 36px;
                "
              >{{ showMoreOptions ? 'Less options' : 'More options' }}</button>

              <div style="display: flex; gap: var(--space-4);">
                <span style="font-size: var(--text-xs); color: var(--text-secondary); padding: var(--space-1) var(--space-2); background: var(--surface-primary); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">Enter to add</span>
                <span style="font-size: var(--text-xs); color: var(--text-secondary); padding: var(--space-1) var(--space-2); background: var(--surface-primary); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">Shift+Enter to add + continue</span>
                <span style="font-size: var(--text-xs); color: var(--text-secondary); padding: var(--space-1) var(--space-2); background: var(--surface-primary); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">Esc to cancel</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
  }),
}

/**
 * WithMoreOptions: palette with expanded additional fields visible.
 */
export const WithMoreOptions: Story = {
  render: () => ({
    template: `
      <div style="background: var(--app-background-gradient); min-height: 100vh; position: relative; font-family: inherit;">

        <!-- Simulated background content -->
        <div style="padding: var(--space-10); opacity: 0.3; pointer-events: none;">
          <div style="height: 200px; background: var(--glass-bg-medium); border: 1px solid var(--glass-border); border-radius: var(--radius-xl);"></div>
        </div>

        <!-- Overlay with more options visible -->
        <div style="
          position: fixed;
          inset: 0;
          background: var(--overlay-darker, rgba(0,0,0,0.65));
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 20vh;
          z-index: 200;
        ">
          <div style="
            background: var(--surface-primary);
            border: 1px solid var(--glass-border-medium, rgba(255,255,255,0.12));
            border-radius: var(--radius-2xl);
            width: 600px;
            max-width: 90vw;
            box-shadow: 0 25px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.1);
            overflow: hidden;
          ">
            <!-- Input row -->
            <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-6); border-bottom: 1px solid var(--border-subtle);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--brand-primary); flex-shrink: 0;">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <div style="flex: 1; color: var(--text-primary); font-size: var(--text-lg); font-weight: 500;">Design new onboarding flow</div>
            </div>

            <!-- Expanded fields row -->
            <div style="display: flex; gap: var(--space-3); padding: var(--space-4) var(--space-6); border-bottom: 1px solid var(--border-subtle);">
              <div style="flex: 1; padding: var(--space-3) var(--space-4); background: var(--glass-bg-tint); border: 1px solid var(--brand-primary); border-radius: var(--radius-md); color: var(--brand-primary); font-size: var(--text-sm); min-height: 44px; display: flex; align-items: center;">Work Project</div>
              <div style="flex: 1; padding: var(--space-3) var(--space-4); background: transparent; border: 1px solid var(--glass-border-hover); border-radius: var(--radius-md); color: var(--text-secondary); font-size: var(--text-sm); min-height: 44px; display: flex; align-items: center;">2026-03-10</div>
              <div style="flex: 1; padding: var(--space-3) var(--space-4); background: transparent; border: 1px solid var(--glass-border-hover); border-radius: var(--radius-md); color: var(--text-secondary); font-size: var(--text-sm); min-height: 44px; display: flex; align-items: center;">High Priority</div>
            </div>

            <!-- Footer -->
            <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-4) var(--space-6); border-top: 1px solid var(--border-subtle);">
              <button style="background: var(--glass-bg-tint); border: 1px solid var(--border-interactive); color: var(--text-primary); padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); cursor: pointer; font-size: var(--text-sm); font-weight: 500; min-height: 36px;">Less options</button>
              <div style="display: flex; gap: var(--space-4);">
                <span style="font-size: var(--text-xs); color: var(--text-secondary); padding: var(--space-1) var(--space-2); background: var(--surface-primary); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">Enter to add</span>
                <span style="font-size: var(--text-xs); color: var(--text-secondary); padding: var(--space-1) var(--space-2); background: var(--surface-primary); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">Esc to cancel</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
  }),
}
