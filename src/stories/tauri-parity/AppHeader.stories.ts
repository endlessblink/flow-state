import type { Meta, StoryObj } from '@storybook/vue3'

/**
 * Visual showcase of AppHeader CSS.
 *
 * The header uses a glass morphism control panel (`var(--glass-bg-medium)` with
 * `backdrop-filter: blur(var(--blur-md))`). In Tauri mode (WebKitGTK), backdrop-filter
 * on `aside` and `nav` elements is disabled via `.tauri-app aside, .tauri-app nav { backdrop-filter: none }`.
 * The control panel pill also uses glass backgrounds that become opaque in Tauri.
 *
 * Toggle the Tauri Mode in the toolbar to compare Browser vs WebKitGTK rendering.
 */
const meta = {
  title: '🖥️ Tauri Parity/AppHeader',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Visual showcase of AppHeader CSS. The header uses glass morphism background which switches to opaque in Tauri mode.',
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default: header bar with page title, control panel pill, view tabs,
 * and an active task glass pill — the full header layout.
 */
export const Default: Story = {
  render: () => ({
    template: `
      <div style="background: var(--app-background-gradient); min-height: 100vh; font-family: inherit;">

        <!-- APP HEADER -->
        <div style="padding: var(--space-10) var(--space-12) 0 var(--space-12);">

          <!-- Header Section: title + control panel -->
          <div style="
            display: flex;
            justify-content: flex-start;
            align-items: center;
            gap: var(--space-4);
            margin-bottom: var(--space-6);
            position: relative;
          ">

            <!-- Page Title -->
            <div style="display: flex; flex-direction: column; align-items: flex-start;">
              <h1 style="
                font-size: var(--text-2xl);
                font-weight: 800;
                letter-spacing: -0.02em;
                background: linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin: 0;
                line-height: 1.1;
              ">Canvas</h1>
              <span style="
                display: flex;
                align-items: center;
                gap: var(--space-2);
                font-size: var(--text-xs);
                font-weight: 600;
                color: var(--text-muted);
                text-transform: uppercase;
                letter-spacing: 0.1em;
                margin-top: var(--space-1);
              ">Workflow</span>
            </div>

            <!-- Control Panel — glass pill: var(--glass-bg-medium) + backdrop-filter -->
            <div style="
              display: flex;
              align-items: center;
              gap: var(--space-4);
              padding: var(--space-3) var(--space-4);
              margin-inline-start: auto;
              background: var(--glass-bg-medium);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-lg);
              backdrop-filter: blur(12px);
              -webkit-backdrop-filter: blur(12px);
              box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            ">
              <!-- Sync status dot -->
              <div style="display: flex; align-items: center; gap: var(--space-2);">
                <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--brand-primary);"></div>
                <span style="font-size: var(--text-xs); color: var(--text-muted);">Synced</span>
              </div>

              <!-- Divider -->
              <div style="width: 1px; height: 24px; background: var(--border-subtle); margin: 0 var(--space-2);"></div>

              <!-- Keyboard shortcut button -->
              <button style="
                display: flex; align-items: center; justify-content: center;
                width: 36px; height: 36px; border: none; background: transparent;
                color: var(--text-muted); border-radius: var(--radius-md); cursor: pointer;
              ">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                  <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"></path>
                </svg>
              </button>

              <!-- Divider -->
              <div style="width: 1px; height: 24px; background: var(--border-subtle); margin: 0 var(--space-2);"></div>

              <!-- AI button -->
              <button style="
                position: relative; display: flex; align-items: center; justify-content: center;
                width: 36px; height: 36px; border: none; background: transparent;
                color: var(--text-muted); border-radius: var(--radius-md); cursor: pointer;
              ">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 3l1.5 4.5H18l-3.75 2.72 1.42 4.28L12 11.77l-3.67 2.73 1.42-4.28L6 7.5h4.5L12 3z"></path>
                </svg>
              </button>

              <!-- Divider -->
              <div style="width: 1px; height: 24px; background: var(--border-subtle); margin: 0 var(--space-2);"></div>

              <!-- Clock -->
              <div style="display: flex; align-items: center;">
                <span style="font-family: monospace; font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); letter-spacing: 0.025em;">14:32</span>
              </div>

              <!-- Timer display: transparent + stroke border -->
              <div style="
                display: flex; align-items: center; gap: var(--space-3);
                padding: var(--space-2) var(--space-3);
                border-radius: var(--radius-xl);
                border: 1.5px solid transparent;
              ">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--brand-primary);">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span style="font-size: var(--text-lg); font-weight: 600; color: var(--text-secondary); min-width: 4rem; letter-spacing: 0.025em;">25:00</span>
                <!-- Start button -->
                <button style="
                  background: transparent; border: none; color: var(--brand-primary);
                  width: 28px; height: 28px; border-radius: var(--radius-md);
                  cursor: pointer; display: flex; align-items: center; justify-content: center;
                ">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Active Task Glass Pill — backdrop-filter: blur(8px) -->
            <div style="
              display: flex;
              align-items: center;
              gap: var(--space-2);
              padding: var(--space-1_5) var(--space-3);
              background: var(--glass-bg-soft);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-xl);
              backdrop-filter: blur(8px);
              -webkit-backdrop-filter: blur(8px);
              max-width: 240px;
            ">
              <div style="width: 8px; height: 8px; min-width: 8px; border-radius: 50%; background: #4ECDC4;"></div>
              <span style="
                font-size: var(--text-sm); font-weight: 500; color: var(--text-secondary);
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
              ">Design onboarding flow</span>
            </div>
          </div>

          <!-- Content Header: view tabs -->
          <div style="
            display: flex;
            align-items: center;
            margin-bottom: var(--space-6);
            padding-bottom: var(--space-3);
            border-bottom: 1px solid var(--border-subtle);
          ">
            <div style="display: flex; gap: 2px;">
              <a style="
                background: transparent; border: 1px solid transparent;
                color: var(--text-muted); padding: var(--space-3) var(--space-4);
                font-size: var(--text-sm); font-weight: 500;
                border-radius: 8px 8px 0 0; cursor: pointer; text-decoration: none;
              ">Morning</a>
              <a style="
                color: var(--brand-primary);
                background: var(--state-active-bg, rgba(78,205,196,0.08));
                border: 1px solid var(--state-active-border, rgba(78,205,196,0.2));
                padding: var(--space-3) var(--space-4);
                font-size: var(--text-sm); font-weight: 600;
                border-radius: 8px 8px 0 0; cursor: pointer; text-decoration: none;
                backdrop-filter: var(--state-active-glass);
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
              ">Canvas</a>
              <a style="
                background: transparent; border: 1px solid transparent;
                color: var(--text-muted); padding: var(--space-3) var(--space-4);
                font-size: var(--text-sm); font-weight: 500;
                border-radius: 8px 8px 0 0; cursor: pointer; text-decoration: none;
              ">Calendar</a>
              <a style="
                background: transparent; border: 1px solid transparent;
                color: var(--text-muted); padding: var(--space-3) var(--space-4);
                font-size: var(--text-sm); font-weight: 500;
                border-radius: 8px 8px 0 0; cursor: pointer; text-decoration: none;
              ">Board</a>
              <a style="
                background: transparent; border: 1px solid transparent;
                color: var(--text-muted); padding: var(--space-3) var(--space-4);
                font-size: var(--text-sm); font-weight: 500;
                border-radius: 8px 8px 0 0; cursor: pointer; text-decoration: none;
              ">Catalog</a>
              <a style="
                background: transparent; border: 1px solid transparent;
                color: var(--text-muted); padding: var(--space-3) var(--space-4);
                font-size: var(--text-sm); font-weight: 500;
                border-radius: 8px 8px 0 0; cursor: pointer; text-decoration: none;
              ">Quick Sort</a>
              <a style="
                background: transparent; border: 1px solid transparent;
                color: var(--text-muted); padding: var(--space-3) var(--space-4);
                font-size: var(--text-sm); font-weight: 500;
                border-radius: 8px 8px 0 0; cursor: pointer; text-decoration: none;
              ">AI</a>
            </div>
          </div>

          <!-- Simulated page content -->
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-4); opacity: 0.4;">
            <div v-for="n in 8" :key="n" style="height: 120px; background: var(--glass-bg-medium); border: 1px solid var(--glass-border); border-radius: var(--radius-lg);"></div>
          </div>
        </div>
      </div>
    `,
  }),
}

/**
 * TimerActive: header with an active work timer — shows amber stroke border on timer display.
 * In browser: transparent pill with blur backdrop. In Tauri: opaque background, no blur.
 */
export const TimerActive: Story = {
  render: () => ({
    template: `
      <div style="background: var(--app-background-gradient); min-height: 100vh; font-family: inherit;">
        <div style="padding: var(--space-10) var(--space-12) 0 var(--space-12);">

          <div style="display: flex; align-items: center; gap: var(--space-4); margin-bottom: var(--space-6);">
            <!-- Page title -->
            <div style="display: flex; flex-direction: column;">
              <h1 style="font-size: var(--text-2xl); font-weight: 800; letter-spacing: -0.02em; background: linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; line-height: 1.1;">Board</h1>
              <span style="font-size: var(--text-xs); font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em; margin-top: var(--space-1);">Overview</span>
            </div>

            <!-- Control panel with active timer -->
            <div style="
              display: flex; align-items: center; gap: var(--space-4);
              padding: var(--space-3) var(--space-4);
              margin-inline-start: auto;
              background: var(--glass-bg-medium);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-lg);
              backdrop-filter: blur(12px);
              -webkit-backdrop-filter: blur(12px);
              box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            ">
              <div style="display: flex; align-items: center; gap: var(--space-2);">
                <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--brand-primary);"></div>
                <span style="font-size: var(--text-xs); color: var(--text-muted);">Synced</span>
              </div>
              <div style="width: 1px; height: 24px; background: var(--border-subtle); margin: 0 var(--space-2);"></div>

              <span style="font-family: monospace; font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); letter-spacing: 0.025em;">14:35</span>

              <!-- Active timer display — border: 1.5px solid var(--timer-work-stroke), no fill -->
              <div style="
                display: flex; align-items: center; gap: var(--space-3);
                padding: var(--space-2) var(--space-3);
                border-radius: var(--radius-xl);
                border: 1.5px solid hsl(var(--teal-500));
                box-shadow: 0 0 12px rgba(78,205,196,0.3), 0 0 24px rgba(78,205,196,0.15);
                background: transparent;
              ">
                <div style="font-size: var(--text-xl); display: inline-flex;">⚡</div>
                <span style="font-size: var(--text-lg); font-weight: 600; color: var(--text-secondary); min-width: 4rem; letter-spacing: 0.025em;">18:42</span>
                <button style="background: transparent; border: none; color: var(--text-muted); width: 28px; height: 28px; border-radius: var(--radius-md); cursor: pointer; display: flex; align-items: center; justify-content: center;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                  </svg>
                </button>
                <button style="background: transparent; border: none; color: var(--color-danger, #ef4444); width: 28px; height: 28px; border-radius: var(--radius-md); cursor: pointer; display: flex; align-items: center; justify-content: center;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Active task glass pill -->
            <div style="
              display: flex; align-items: center; gap: var(--space-2);
              padding: var(--space-1_5) var(--space-3);
              background: var(--glass-bg-soft);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-xl);
              backdrop-filter: blur(8px);
              -webkit-backdrop-filter: blur(8px);
              max-width: 240px;
            ">
              <div style="width: 8px; height: 8px; min-width: 8px; border-radius: 50%; background: #FF6B6B;"></div>
              <span style="font-size: var(--text-sm); font-weight: 500; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Fix critical bug in auth flow</span>
            </div>
          </div>

          <!-- View tabs -->
          <div style="display: flex; align-items: center; margin-bottom: var(--space-6); padding-bottom: var(--space-3); border-bottom: 1px solid var(--border-subtle);">
            <div style="display: flex; gap: 2px;">
              <a style="background: transparent; border: 1px solid transparent; color: var(--text-muted); padding: var(--space-3) var(--space-4); font-size: var(--text-sm); font-weight: 500; border-radius: 8px 8px 0 0; cursor: pointer; text-decoration: none;">Morning</a>
              <a style="background: transparent; border: 1px solid transparent; color: var(--text-muted); padding: var(--space-3) var(--space-4); font-size: var(--text-sm); font-weight: 500; border-radius: 8px 8px 0 0; cursor: pointer; text-decoration: none;">Canvas</a>
              <a style="background: transparent; border: 1px solid transparent; color: var(--text-muted); padding: var(--space-3) var(--space-4); font-size: var(--text-sm); font-weight: 500; border-radius: 8px 8px 0 0; cursor: pointer; text-decoration: none;">Calendar</a>
              <a style="color: var(--brand-primary); background: var(--state-active-bg, rgba(78,205,196,0.08)); border: 1px solid var(--state-active-border, rgba(78,205,196,0.2)); padding: var(--space-3) var(--space-4); font-size: var(--text-sm); font-weight: 600; border-radius: 8px 8px 0 0; cursor: pointer; text-decoration: none;">Board</a>
              <a style="background: transparent; border: 1px solid transparent; color: var(--text-muted); padding: var(--space-3) var(--space-4); font-size: var(--text-sm); font-weight: 500; border-radius: 8px 8px 0 0; cursor: pointer; text-decoration: none;">Catalog</a>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); opacity: 0.4;">
            <div v-for="n in 6" :key="n" style="height: 200px; background: var(--glass-bg-medium); border: 1px solid var(--glass-border); border-radius: var(--radius-lg);"></div>
          </div>
        </div>
      </div>
    `,
  }),
}
