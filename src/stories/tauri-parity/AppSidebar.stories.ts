import type { Meta, StoryObj } from '@storybook/vue3'

/**
 * Visual showcase of AppSidebar CSS.
 *
 * The sidebar uses `backdrop-filter: blur(40px) saturate(200%)` with a
 * `linear-gradient(135deg, var(--glass-bg-subtle) 0%, rgba(255,255,255,0.01) 100%)` background.
 * In Tauri mode (WebKitGTK), the `.tauri-app aside, .tauri-app nav` rule in styles.css overrides
 * this to `background: rgb(24, 21, 38)` and `backdrop-filter: none` — making it fully opaque.
 *
 * The sidebar header section uses `var(--glass-bg-medium)` with no independent blur.
 *
 * Toggle the Tauri Mode in the toolbar to compare Browser vs WebKitGTK rendering.
 */
const meta = {
  title: '🖥️ Tauri Parity/AppSidebar',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Visual showcase of AppSidebar CSS. The sidebar uses glass morphism which switches to opaque in Tauri mode.',
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default: full-width sidebar with header, quick task input, smart views, projects list,
 * and user footer. All glass morphism effects visible.
 */
export const Default: Story = {
  render: () => ({
    template: `
      <div style="background: var(--app-background-gradient); min-height: 100vh; display: flex; font-family: inherit;">

        <!-- SIDEBAR — replicates AppSidebar.vue .sidebar CSS -->
        <aside style="
          min-width: 240px;
          max-width: 340px;
          width: 280px;
          background: linear-gradient(135deg, var(--glass-bg-subtle) 0%, rgba(255,255,255,0.01) 100%);
          backdrop-filter: blur(40px) saturate(200%);
          -webkit-backdrop-filter: blur(40px) saturate(200%);
          border-right: 1px solid var(--glass-border);
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          position: relative;
          z-index: 100;
          box-shadow: 4px 0 24px rgba(0,0,0,0.3), inset -1px 0 0 var(--glass-bg-heavy);
          overflow: hidden;
        ">

          <!-- Sidebar Header — background: var(--glass-bg-medium) -->
          <div style="
            padding: var(--space-10) var(--space-6) var(--space-6) var(--space-6);
            background: var(--glass-bg-medium);
          ">
            <!-- App brand -->
            <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-6);">
              <div style="width: 32px; height: 32px; background: linear-gradient(135deg, var(--brand-primary), hsl(174, 62%, 40%)); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
              <span style="font-size: var(--text-lg); font-weight: 600; color: var(--text-primary);">FlowState</span>
            </div>

            <!-- Create Project button — glass morphism pattern -->
            <button style="
              width: 100%;
              background: var(--glass-bg-soft);
              border: 1px solid var(--brand-primary);
              color: var(--brand-primary);
              padding: var(--space-2) var(--space-4);
              border-radius: var(--radius-md);
              cursor: pointer;
              font-size: var(--text-sm);
              font-weight: 500;
              display: flex;
              align-items: center;
              gap: var(--space-2);
              min-height: 40px;
              backdrop-filter: blur(8px);
            ">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Create Project
            </button>

            <!-- Icon buttons row -->
            <div style="display: flex; gap: var(--space-2); margin-top: var(--space-2);">
              <button style="background: transparent; border: 1px solid var(--border-medium); color: var(--text-secondary); width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md); cursor: pointer;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect>
                </svg>
              </button>
              <button style="background: transparent; border: 1px solid var(--border-medium); color: var(--text-secondary); width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md); cursor: pointer;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"></path>
                </svg>
              </button>
            </div>
          </div>

          <!-- Quick Task Input -->
          <div style="padding: var(--space-4) var(--space-6) var(--space-3);">
            <div style="
              display: flex; align-items: center; gap: var(--space-2);
              padding: var(--space-2) var(--space-3);
              background: var(--glass-bg-soft);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-md);
              cursor: text;
            ">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted);">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span style="font-size: var(--text-sm); color: var(--text-muted);">Quick add task...</span>
            </div>
          </div>

          <!-- Task Management Section — flex: 1, overflow-y: auto -->
          <div style="flex: 1; overflow-y: auto; padding: var(--space-4) var(--space-6);">

            <!-- Smart Views section -->
            <div style="margin-bottom: var(--space-5);">
              <div style="font-size: var(--text-xs); font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: var(--space-2); padding: 0 var(--space-2);">Views</div>

              <!-- Active smart view item -->
              <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); background: var(--state-active-bg, rgba(78,205,196,0.08)); border: 1px solid var(--state-active-border, rgba(78,205,196,0.2)); border-radius: var(--radius-md); margin-bottom: var(--space-1); cursor: pointer;">
                <span>📅</span>
                <span style="font-size: var(--text-sm); font-weight: 500; color: var(--brand-primary);">Today</span>
                <span style="margin-left: auto; font-size: var(--text-xs); color: var(--brand-primary); background: rgba(78,205,196,0.15); padding: 2px 6px; border-radius: var(--radius-full); font-weight: 600;">4</span>
              </div>

              <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); margin-bottom: var(--space-1); cursor: pointer;">
                <span>📆</span>
                <span style="font-size: var(--text-sm); color: var(--text-secondary);">This Week</span>
              </div>

              <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); margin-bottom: var(--space-1); cursor: pointer;">
                <span>📋</span>
                <span style="font-size: var(--text-sm); color: var(--text-secondary);">All Tasks</span>
                <span style="margin-left: auto; font-size: var(--text-xs); color: var(--text-muted); background: var(--glass-bg-medium); padding: 2px 6px; border-radius: var(--radius-full);">12</span>
              </div>
            </div>

            <!-- Projects section -->
            <div>
              <div style="font-size: var(--text-xs); font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: var(--space-2); padding: 0 var(--space-2); display: flex; align-items: center; justify-content: space-between;">
                <span>Projects</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </div>

              <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); margin-bottom: var(--space-1); cursor: pointer;">
                <div style="width: 10px; height: 10px; border-radius: 50%; background: #4ECDC4; flex-shrink: 0;"></div>
                <span style="font-size: var(--text-sm); color: var(--text-secondary);">Work</span>
                <span style="margin-left: auto; font-size: var(--text-xs); color: var(--text-muted); background: var(--glass-bg-medium); padding: 2px 6px; border-radius: var(--radius-full);">5</span>
              </div>

              <!-- Sub-project (indented) -->
              <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); padding-left: var(--space-8); border-radius: var(--radius-md); margin-bottom: var(--space-1); cursor: pointer;">
                <span style="font-size: var(--text-sm);">🚀</span>
                <span style="font-size: var(--text-sm); color: var(--text-secondary);">Deep Work</span>
              </div>

              <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); margin-bottom: var(--space-1); cursor: pointer;">
                <div style="width: 10px; height: 10px; border-radius: 50%; background: #FF6B6B; flex-shrink: 0;"></div>
                <span style="font-size: var(--text-sm); color: var(--text-secondary);">Personal</span>
                <span style="margin-left: auto; font-size: var(--text-xs); color: var(--text-muted); background: var(--glass-bg-medium); padding: 2px 6px; border-radius: var(--radius-full);">3</span>
              </div>

              <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); padding-left: var(--space-8); border-radius: var(--radius-md); cursor: pointer;">
                <span style="font-size: var(--text-sm);">💰</span>
                <span style="font-size: var(--text-sm); color: var(--text-secondary);">Finance</span>
              </div>
            </div>
          </div>

          <!-- User footer -->
          <div style="
            padding: var(--space-4) var(--space-6);
            border-top: 1px solid var(--border-subtle);
            background: var(--glass-bg-soft);
            display: flex;
            align-items: center;
            gap: var(--space-3);
          ">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, var(--brand-primary), #8b5cf6); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <span style="font-size: var(--text-sm); font-weight: 700; color: white;">U</span>
            </div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: var(--text-sm); font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">User</div>
              <div style="font-size: var(--text-xs); color: var(--text-muted);">Level 4 · 1,240 XP</div>
            </div>
          </div>
        </aside>

        <!-- Main content area placeholder -->
        <main style="flex: 1; padding: var(--space-10); opacity: 0.4;">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4);">
            <div v-for="n in 9" :key="n" style="height: 100px; background: var(--glass-bg-medium); border: 1px solid var(--glass-border); border-radius: var(--radius-lg);"></div>
          </div>
        </main>
      </div>
    `,
  }),
}

/**
 * Collapsed: narrower sidebar showing only icons — tests that the glass/opaque
 * background renders correctly at reduced width.
 */
export const Collapsed: Story = {
  render: () => ({
    template: `
      <div style="background: var(--app-background-gradient); min-height: 100vh; display: flex; font-family: inherit;">

        <!-- SIDEBAR — collapsed (icon-only) -->
        <aside style="
          width: 64px;
          min-width: 64px;
          max-width: 64px;
          background: linear-gradient(135deg, var(--glass-bg-subtle) 0%, rgba(255,255,255,0.01) 100%);
          backdrop-filter: blur(40px) saturate(200%);
          -webkit-backdrop-filter: blur(40px) saturate(200%);
          border-right: 1px solid var(--glass-border);
          display: flex;
          flex-direction: column;
          align-items: center;
          min-height: 100vh;
          position: relative;
          z-index: 100;
          box-shadow: 4px 0 24px rgba(0,0,0,0.3), inset -1px 0 0 var(--glass-bg-heavy);
          overflow: hidden;
        ">
          <!-- Logo icon -->
          <div style="padding: var(--space-8) 0 var(--space-6); display: flex; flex-direction: column; align-items: center; gap: var(--space-6); width: 100%;">
            <div style="width: 32px; height: 32px; background: linear-gradient(135deg, var(--brand-primary), hsl(174, 62%, 40%)); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>

            <!-- Nav icons -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-2); width: 100%;">
              <!-- Active nav item -->
              <div style="
                width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
                background: var(--state-active-bg, rgba(78,205,196,0.08));
                border: 1px solid var(--state-active-border, rgba(78,205,196,0.2));
                border-radius: var(--radius-md);
                cursor: pointer;
                color: var(--brand-primary);
              " title="Canvas">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect>
                </svg>
              </div>

              <div style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md); cursor: pointer; color: var(--text-muted);" title="Board">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="7" height="18"></rect><rect x="14" y="3" width="7" height="11"></rect>
                </svg>
              </div>

              <div style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md); cursor: pointer; color: var(--text-muted);" title="Calendar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </div>

              <div style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md); cursor: pointer; color: var(--text-muted);" title="AI">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 3l1.5 4.5H18l-3.75 2.72 1.42 4.28L12 11.77l-3.67 2.73 1.42-4.28L6 7.5h4.5L12 3z"></path>
                </svg>
              </div>

              <div style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md); cursor: pointer; color: var(--text-muted);" title="Settings">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"></path>
                </svg>
              </div>
            </div>
          </div>

          <!-- Spacer -->
          <div style="flex: 1;"></div>

          <!-- User avatar -->
          <div style="padding: var(--space-4) 0; border-top: 1px solid var(--border-subtle); width: 100%; display: flex; justify-content: center;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, var(--brand-primary), #8b5cf6); display: flex; align-items: center; justify-content: center; cursor: pointer;">
              <span style="font-size: var(--text-sm); font-weight: 700; color: white;">U</span>
            </div>
          </div>
        </aside>

        <!-- Main content area placeholder -->
        <main style="flex: 1; padding: var(--space-10); opacity: 0.4;">
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-4);">
            <div v-for="n in 12" :key="n" style="height: 100px; background: var(--glass-bg-medium); border: 1px solid var(--glass-border); border-radius: var(--radius-lg);"></div>
          </div>
        </main>
      </div>
    `,
  }),
}
