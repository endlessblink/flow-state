import type { Meta, StoryObj } from '@storybook/vue3'

/**
 * PWA Concepts - Desktop Views & Planned Features in Mobile Frame
 *
 * Conceptual mobile previews of FlowState desktop views and planned features.
 * These screens are NOT in the actual mobile PWA navigation — they show how
 * desktop-only views would look in a mobile form factor.
 *
 * **Desktop Views (not in mobile nav):**
 * 1. Board - Kanban with priority columns
 * 2. Calendar - Day view with time grid
 * 3. Canvas - Whiteboard with nodes
 * 4. MorningDashboard - Morning planning with Big 3
 *
 * **Planned Features:**
 * 5. Focus - Timer-centric view (stub)
 * 6. Performance - Benchmark stats
 *
 * **Design:**
 * - 390x844px viewport (iPhone 14 aspect ratio)
 * - Rounded phone bezel (40px radius)
 * - Dark bezel border (3px)
 * - Status bar (time, wifi, battery)
 * - App header (44px) + bottom nav (56px)
 */
const meta: Meta = {
  title: '📱 PWA Concepts',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `Conceptual mobile previews of desktop views and planned features. These are NOT in the actual mobile PWA navigation.

**Desktop views shown in mobile frame:**
- Board, Calendar, Canvas, Morning Dashboard

**Planned features:**
- Focus, Performance

**Use Cases:**
- Design exploration for future mobile views
- UX prototyping and review
- Screenshot generation for planning docs`
      }
    }
  }
}

export default meta
type Story = StoryObj

// Conceptual bottom nav (generic — not the real mobile nav)
const PWAFrame = (screenContent: string, title: string) => `
  <div style="
    width: 390px;
    height: 844px;
    background: #1a1a1a;
    border-radius: 40px;
    border: 3px solid var(--glass-border);
    overflow: hidden;
    box-shadow: 0 24px 48px var(--overlay-heavy);
    display: flex;
    flex-direction: column;
  ">
    <!-- Status Bar -->
    <div style="
      height: 44px;
      background: linear-gradient(135deg, var(--surface-secondary) 0%, var(--surface-primary) 100%);
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 24px;
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--border-subtle);
    ">
      <span>9:41</span>
      <div style="display: flex; gap: var(--space-1_5); align-items: center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1"/></svg>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="10" rx="2"/><path d="M22 11h2"/></svg>
      </div>
    </div>

    <!-- App Header -->
    <div style="
      height: 44px;
      background: var(--surface-secondary);
      backdrop-filter: blur(20px);
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 16px;
      border-bottom: 1px solid var(--border-subtle);
    ">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-secondary);">
        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
      <span style="
        font-size: var(--text-sm);
        font-weight: 600;
        color: var(--text-primary);
        letter-spacing: 0.01em;
      ">${title}</span>
      <div style="display: flex; gap: var(--space-3); align-items: center;">
        <div style="
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--color-success);
          box-shadow: var(--success-glow);
        "></div>
        <span style="
          font-size: var(--text-meta);
          font-weight: 500;
          color: var(--brand-primary);
          letter-spacing: 0.02em;
        ">25:00</span>
      </div>
    </div>

    <!-- Screen Content -->
    <div style="
      flex: 1;
      overflow: hidden;
      background: var(--app-background-gradient);
    ">
      ${screenContent}
    </div>

    <!-- Concept Label (instead of real nav) -->
    <div style="
      height: 56px;
      background: var(--surface-secondary);
      backdrop-filter: blur(20px);
      border-top: 1px solid var(--glass-border);
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 0 12px;
    ">
      <span style="
        font-size: var(--text-xs);
        color: var(--text-disabled);
        text-transform: uppercase;
        letter-spacing: 0.1em;
      ">Conceptual Design — Not in Mobile Nav</span>
    </div>
  </div>
`

/**
 * Board View - Priority Kanban
 *
 * Desktop Kanban board shown in mobile frame. Not in actual mobile PWA nav.
 */
export const Board: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Desktop Kanban board in mobile frame — conceptual mobile layout. Not in actual mobile PWA navigation.'
      }
    }
  },
  render: () => ({
    template: PWAFrame(`
      <div style="padding: var(--space-2_5); overflow-y: auto; height: 100%; font-size: var(--text-xs);">
        <!-- View Type Tabs -->
        <div style="
          display: flex;
          gap: var(--space-1_5);
          margin-bottom: var(--space-2_5);
          padding: var(--space-1);
          background: var(--glass-bg-subtle);
          border-radius: var(--radius-lg);
        ">
          <button style="
            flex: 1;
            padding: var(--space-1_5) var(--space-2);
            background: var(--state-active-bg);
            border: 1px solid var(--state-active-border);
            border-radius: var(--radius-md);
            color: var(--brand-primary);
            font-size: var(--text-xs);
            font-weight: 600;
          ">Priority</button>
          <button style="
            flex: 1;
            padding: var(--space-1_5) var(--space-2);
            background: transparent;
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            color: var(--text-muted);
            font-size: var(--text-xs);
          ">Date</button>
          <button style="
            flex: 1;
            padding: var(--space-1_5) var(--space-2);
            background: transparent;
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            color: var(--text-muted);
            font-size: var(--text-xs);
          ">Status</button>
        </div>

        <!-- Kanban Columns -->
        <div style="display: flex; gap: var(--space-2); overflow-x: auto; padding-bottom: var(--space-2);">
          <!-- High Priority Column -->
          <div style="
            min-width: 200px;
            background: var(--glass-bg-light);
            border-radius: var(--radius-lg);
            padding: var(--space-2_5);
          ">
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: var(--space-2);
            ">
              <span style="font-size: var(--text-xs); font-weight: 600; color: var(--priority-high-text);">High</span>
              <span style="
                padding: 1px var(--space-1_5);
                background: var(--priority-high-bg);
                border-radius: var(--radius-full);
                font-size: var(--text-xs);
                color: var(--priority-high-text);
              ">3</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: var(--space-1_5);">
              <div style="
                background: var(--canvas-task-bg);
                border: 1px solid var(--danger-border-subtle);
                border-radius: var(--radius-md);
                padding: var(--space-2);
              ">
                <div style="font-size: var(--text-xs); font-weight: 500; color: var(--text-primary); margin-bottom: var(--space-1_5); line-height: 1.3;">Fix critical auth bug</div>
                <div style="display: flex; gap: var(--space-1_5); align-items: center;">
                  <span style="padding: 1px 5px; background: var(--priority-high-bg); border: 1px solid var(--priority-high-border); border-radius: var(--radius-sm); font-size: var(--text-xs); color: var(--priority-high-text);">High</span>
                  <span style="font-size: var(--text-xs); color: var(--text-muted);">Today</span>
                </div>
              </div>
              <div style="
                background: var(--canvas-task-bg);
                border: 1px solid var(--danger-border-subtle);
                border-radius: var(--radius-md);
                padding: var(--space-2);
              ">
                <div style="font-size: var(--text-xs); font-weight: 500; color: var(--text-primary); margin-bottom: var(--space-1_5); line-height: 1.3;">Deploy production hotfix</div>
                <div style="display: flex; gap: var(--space-1_5); align-items: center;">
                  <span style="padding: 1px 5px; background: var(--priority-high-bg); border: 1px solid var(--priority-high-border); border-radius: var(--radius-sm); font-size: var(--text-xs); color: var(--priority-high-text);">High</span>
                  <span style="font-size: var(--text-xs); color: var(--text-muted);">Tomorrow</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Medium Priority Column -->
          <div style="
            min-width: 200px;
            background: var(--glass-bg-light);
            border-radius: var(--radius-lg);
            padding: var(--space-2_5);
          ">
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: var(--space-2);
            ">
              <span style="font-size: var(--text-xs); font-weight: 600; color: var(--priority-medium-text);">Medium</span>
              <span style="
                padding: 1px var(--space-1_5);
                background: var(--priority-medium-bg);
                border-radius: var(--radius-full);
                font-size: var(--text-xs);
                color: var(--priority-medium-text);
              ">5</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: var(--space-1_5);">
              <div style="
                background: var(--canvas-task-bg);
                border: 1px solid var(--priority-medium-border);
                border-radius: var(--radius-md);
                padding: var(--space-2);
              ">
                <div style="font-size: var(--text-xs); font-weight: 500; color: var(--text-primary); margin-bottom: var(--space-1_5); line-height: 1.3;">Review Q4 marketing plan</div>
                <div style="display: flex; gap: var(--space-1_5); align-items: center;">
                  <span style="padding: 1px 5px; background: var(--priority-medium-bg); border: 1px solid var(--priority-medium-border); border-radius: var(--radius-sm); font-size: var(--text-xs); color: var(--priority-medium-text);">Medium</span>
                  <span style="font-size: var(--text-xs); color: var(--text-muted);">This Week</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Low Priority Column -->
          <div style="
            min-width: 200px;
            background: var(--glass-bg-light);
            border-radius: var(--radius-lg);
            padding: var(--space-2_5);
          ">
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: var(--space-2);
            ">
              <span style="font-size: var(--text-xs); font-weight: 600; color: var(--priority-low-text);">Low</span>
              <span style="
                padding: 1px var(--space-1_5);
                background: var(--priority-low-bg);
                border-radius: var(--radius-full);
                font-size: var(--text-xs);
                color: var(--priority-low-text);
              ">2</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: var(--space-1_5);">
              <div style="
                background: var(--canvas-task-bg);
                border: 1px solid var(--priority-low-border);
                border-radius: var(--radius-md);
                padding: var(--space-2);
              ">
                <div style="font-size: var(--text-xs); font-weight: 500; color: var(--text-primary); margin-bottom: var(--space-1_5); line-height: 1.3;">Update team wiki</div>
                <div style="display: flex; gap: var(--space-1_5); align-items: center;">
                  <span style="padding: 1px 5px; background: var(--priority-low-bg); border: 1px solid var(--priority-low-border); border-radius: var(--radius-sm); font-size: var(--text-xs); color: var(--priority-low-text);">Low</span>
                  <span style="font-size: var(--text-xs); color: var(--text-muted);">Next Week</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `, 'Board')
  })
}

/**
 * Calendar View - Day View
 *
 * Desktop calendar shown in mobile frame. Not in actual mobile PWA nav.
 */
export const Calendar: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Desktop calendar day view in mobile frame — conceptual mobile layout. Not in actual mobile PWA navigation.'
      }
    }
  },
  render: () => ({
    template: PWAFrame(`
      <div style="display: flex; flex-direction: column; height: 100%;">
        <!-- Calendar Header -->
        <div style="
          padding: var(--space-3) var(--space-4);
          background: var(--glass-bg-heavy);
          border-bottom: 1px solid var(--border-subtle);
        ">
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: var(--space-2_5);
          ">
            <button style="
              padding: var(--space-1_5);
              background: var(--glass-bg-subtle);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-md);
              color: var(--text-secondary);
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span style="font-size: var(--text-meta); font-weight: 600; color: var(--text-primary);">Today Feb 13</span>
            <button style="
              padding: var(--space-1_5);
              background: var(--glass-bg-subtle);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-md);
              color: var(--text-secondary);
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          <div style="display: flex; gap: var(--space-1_5);">
            <button style="
              flex: 1;
              padding: var(--space-1_5) var(--space-2_5);
              background: var(--state-active-bg);
              border: 1px solid var(--state-active-border);
              border-radius: var(--radius-md);
              color: var(--brand-primary);
              font-size: var(--text-xs);
              font-weight: 600;
            ">Day</button>
            <button style="
              flex: 1;
              padding: var(--space-1_5) var(--space-2_5);
              background: transparent;
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-md);
              color: var(--text-muted);
              font-size: var(--text-xs);
            ">Week</button>
            <button style="
              flex: 1;
              padding: var(--space-1_5) var(--space-2_5);
              background: transparent;
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-md);
              color: var(--text-muted);
              font-size: var(--text-xs);
            ">Month</button>
          </div>
        </div>

        <!-- Time Grid -->
        <div style="flex: 1; overflow-y: auto; padding: 0 var(--space-3);">
          <div style="position: relative; height: 48px; border-bottom: 1px solid var(--border-subtle);">
            <span style="position: absolute; left: 0; top: var(--space-2); font-size: var(--text-xs); color: var(--text-subtle);">9:00</span>
          </div>

          <!-- 10:00 with task -->
          <div style="position: relative; height: 96px; border-bottom: 1px solid var(--border-subtle);">
            <span style="position: absolute; left: 0; top: var(--space-2); font-size: var(--text-xs); color: var(--text-subtle);">10:00</span>
            <div style="
              position: absolute; left: 48px; right: 0; top: 4px; height: 88px;
              background: linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(220, 38, 38, 0.25));
              border-left: 3px solid #f87171;
              border-radius: var(--radius-md);
              padding: var(--space-2);
            ">
              <div style="font-size: var(--text-xs); font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-1);">Team standup</div>
              <div style="font-size: var(--text-xs); color: var(--text-secondary);">10:00 - 10:30</div>
            </div>
          </div>

          <div style="position: relative; height: 48px; border-bottom: 1px solid var(--border-subtle);">
            <span style="position: absolute; left: 0; top: var(--space-2); font-size: var(--text-xs); color: var(--text-subtle);">11:00</span>
          </div>

          <!-- Current time line -->
          <div style="position: relative; height: 48px; border-bottom: 1px solid var(--border-subtle);">
            <span style="position: absolute; left: 0; top: var(--space-2); font-size: var(--text-xs); color: var(--text-subtle);">12:00</span>
            <div style="position: absolute; left: 48px; right: 0; top: 24px; height: 2px; background: var(--color-danger); box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);">
              <div style="position: absolute; left: -6px; top: -4px; width: 10px; height: 10px; border-radius: 50%; background: var(--color-danger);"></div>
            </div>
          </div>

          <!-- 13:00 with task -->
          <div style="position: relative; height: 96px; border-bottom: 1px solid var(--border-subtle);">
            <span style="position: absolute; left: 0; top: var(--space-2); font-size: var(--text-xs); color: var(--text-subtle);">13:00</span>
            <div style="
              position: absolute; left: 48px; right: 0; top: 4px; height: 88px;
              background: linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(37, 99, 235, 0.25));
              border-left: 3px solid #60a5fa;
              border-radius: var(--radius-md);
              padding: var(--space-2);
            ">
              <div style="font-size: var(--text-xs); font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-1);">Code review session</div>
              <div style="font-size: var(--text-xs); color: var(--text-secondary);">13:00 - 13:30</div>
            </div>
          </div>

          <div style="position: relative; height: 48px; border-bottom: 1px solid var(--border-subtle);">
            <span style="position: absolute; left: 0; top: var(--space-2); font-size: var(--text-xs); color: var(--text-subtle);">14:00</span>
          </div>
          <div style="position: relative; height: 48px; border-bottom: 1px solid var(--border-subtle);">
            <span style="position: absolute; left: 0; top: var(--space-2); font-size: var(--text-xs); color: var(--text-subtle);">15:00</span>
          </div>
        </div>
      </div>
    `, 'Calendar')
  })
}

/**
 * Canvas View - Whiteboard
 *
 * Desktop canvas whiteboard shown in mobile frame. Not in actual mobile PWA nav.
 */
export const Canvas: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Desktop canvas whiteboard in mobile frame — conceptual mobile layout. Not in actual mobile PWA navigation.'
      }
    }
  },
  render: () => ({
    template: PWAFrame(`
      <div style="
        position: relative;
        height: 100%;
        background:
          radial-gradient(circle at 20% 30%, rgba(99, 102, 241, 0.05) 0%, transparent 50%),
          radial-gradient(circle at 80% 70%, rgba(139, 92, 246, 0.05) 0%, transparent 50%);
        overflow: hidden;
      ">
        <!-- Toolbar -->
        <div style="
          position: absolute;
          top: var(--space-3);
          left: var(--space-3);
          right: var(--space-3);
          display: flex;
          gap: var(--space-2);
          z-index: 10;
        ">
          <button style="
            padding: var(--space-2) var(--space-3);
            background: var(--glass-bg-heavy);
            backdrop-filter: blur(20px);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-lg);
            color: var(--text-primary);
            font-size: var(--text-xs);
            font-weight: 500;
          ">+ Task</button>
          <button style="
            padding: var(--space-2) var(--space-3);
            background: var(--glass-bg-heavy);
            backdrop-filter: blur(20px);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-lg);
            color: var(--text-primary);
            font-size: var(--text-xs);
            font-weight: 500;
          ">+ Group</button>
          <div style="flex: 1;"></div>
          <button style="
            padding: var(--space-2);
            background: var(--glass-bg-heavy);
            backdrop-filter: blur(20px);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-lg);
            color: var(--text-primary);
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
            </svg>
          </button>
        </div>

        <!-- Canvas Content -->
        <div style="position: relative; height: 100%; padding: 60px var(--space-3) var(--space-3) var(--space-3);">
          <!-- Task Node 1 -->
          <div style="
            position: absolute; left: 24px; top: 80px; width: 200px;
            background: var(--canvas-task-bg);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            padding: var(--space-2);
            box-shadow: 0 4px 12px var(--overlay-bg);
          ">
            <div style="font-size: var(--text-xs); font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-1_5);">Design new feature mockups</div>
            <div style="display: flex; gap: var(--space-1_5); align-items: center;">
              <span style="padding: 1px 5px; background: var(--priority-high-bg); border: 1px solid var(--priority-high-border); border-radius: var(--radius-sm); font-size: var(--text-xs); color: var(--priority-high-text);">High</span>
              <span style="font-size: var(--text-xs); color: var(--text-muted);">Today</span>
            </div>
          </div>

          <!-- Group Node -->
          <div style="
            position: absolute; left: 150px; top: 200px; width: 220px; height: 160px;
            background: var(--glass-bg-medium);
            border: 2px dashed var(--glass-border);
            border-radius: var(--radius-xl);
            padding: var(--space-2);
          ">
            <div style="font-size: var(--text-xs); font-weight: 600; color: var(--text-secondary); margin-bottom: var(--space-2); text-transform: uppercase; letter-spacing: 0.05em;">Sprint Tasks (3)</div>
            <div style="
              background: var(--canvas-task-bg);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-md);
              padding: var(--space-2);
              margin-bottom: var(--space-1_5);
            ">
              <div style="font-size: var(--text-xs); font-weight: 500; color: var(--text-primary);">API integration</div>
            </div>
            <div style="
              background: var(--canvas-task-bg);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-md);
              padding: var(--space-2);
            ">
              <div style="font-size: var(--text-xs); font-weight: 500; color: var(--text-primary);">Unit tests</div>
            </div>
          </div>

          <!-- Task Node 2 -->
          <div style="
            position: absolute; right: 24px; top: 120px; width: 180px;
            background: var(--canvas-task-bg);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            padding: var(--space-2);
            box-shadow: 0 4px 12px var(--overlay-bg);
          ">
            <div style="font-size: var(--text-xs); font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-1_5);">Update documentation</div>
            <div style="display: flex; gap: var(--space-1_5); align-items: center;">
              <span style="padding: 1px 5px; background: var(--priority-low-bg); border: 1px solid var(--priority-low-border); border-radius: var(--radius-sm); font-size: var(--text-xs); color: var(--priority-low-text);">Low</span>
            </div>
          </div>

          <!-- Task Node 3 -->
          <div style="
            position: absolute; left: 40px; bottom: 100px; width: 190px;
            background: var(--canvas-task-bg);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-md);
            padding: var(--space-2);
            box-shadow: 0 4px 12px var(--overlay-bg);
          ">
            <div style="font-size: var(--text-xs); font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-1_5);">Refactor auth module</div>
            <div style="display: flex; gap: var(--space-1_5); align-items: center;">
              <span style="padding: 1px 5px; background: var(--priority-medium-bg); border: 1px solid var(--priority-medium-border); border-radius: var(--radius-sm); font-size: var(--text-xs); color: var(--priority-medium-text);">Medium</span>
              <span style="font-size: var(--text-xs); color: var(--text-muted);">Tomorrow</span>
            </div>
          </div>
        </div>

        <!-- Minimap -->
        <div style="
          position: absolute; bottom: var(--space-4); right: var(--space-4);
          width: 100px; height: 70px;
          background: var(--glass-bg-heavy);
          backdrop-filter: blur(20px);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-md);
          padding: var(--space-1);
        ">
          <div style="
            width: 100%; height: 100%;
            background:
              radial-gradient(circle at 30% 30%, rgba(239, 68, 68, 0.3) 0%, transparent 20%),
              radial-gradient(circle at 70% 50%, rgba(59, 130, 246, 0.3) 0%, transparent 20%);
            border-radius: var(--radius-sm);
          "></div>
        </div>
      </div>
    `, 'Canvas')
  })
}

/**
 * Morning Dashboard - Daily Planning
 *
 * Desktop morning dashboard shown in mobile frame. Not in actual mobile PWA nav.
 */
export const MorningDashboard: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Desktop morning dashboard in mobile frame — Big 3 slots, daily missions, tech news. Not in actual mobile PWA navigation.'
      }
    }
  },
  render: () => ({
    template: PWAFrame(`
      <div style="overflow-y: auto; height: 100%; padding: var(--space-3);">
        <!-- Greeting + Score Row -->
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: var(--space-3);
        ">
          <div style="flex: 1;">
            <h1 style="font-size: 1.25rem; font-weight: 600; color: var(--text-primary); margin: 0 0 var(--space-1) 0; line-height: 1.2;">Good morning, there</h1>
            <p style="font-size: var(--text-xs); color: var(--text-secondary); margin: 0 0 var(--space-1) 0;">Saturday, March 7, 2026</p>
            <p style="font-size: var(--text-xs); font-style: italic; color: var(--text-subtle); margin: 0;">The way to get started is to quit talking and begin doing.</p>
          </div>
          <div style="
            display: flex; align-items: center; gap: var(--space-2);
            padding: var(--space-2) var(--space-3);
            background: var(--glass-bg-soft);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-lg);
            backdrop-filter: blur(12px);
            flex-shrink: 0;
          ">
            <div style="width: 24px; height: 24px; border-radius: 50%; background: var(--brand-primary-subtle); border: 1.5px solid var(--brand-primary); display: flex; align-items: center; justify-content: center; font-size: var(--text-xs); font-weight: 700; color: var(--brand-primary);">1</div>
            <div style="width: 48px; height: 4px; background: var(--border-subtle); border-radius: var(--radius-xs); overflow: hidden;">
              <div style="width: 35%; height: 100%; background: linear-gradient(90deg, #4ECDC4, #3db8af); border-radius: var(--radius-xs);"></div>
            </div>
            <div style="display: flex; align-items: center; gap: 3px; font-size: var(--text-xs); color: var(--color-warning);">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#fb923c" stroke="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
              0
            </div>
          </div>
        </div>

        <!-- Big 3 Card -->
        <div style="
          background: var(--canvas-task-bg);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: var(--space-3);
          margin-bottom: var(--space-3);
        ">
          <div style="margin-bottom: var(--space-2);">
            <div style="font-size: var(--text-meta); font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-0_5);">Today's Big 3</div>
            <div style="font-size: var(--text-xs); color: var(--text-subtle);">Drag tasks from the left into your focus zones</div>
          </div>

          <div style="display: flex; gap: var(--space-2); min-height: 200px;">
            <!-- Task Pool -->
            <div style="flex: 1; display: flex; flex-direction: column; gap: var(--space-2);">
              <div style="padding: var(--space-1_5) var(--space-2); background: var(--glass-bg-soft); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); font-size: var(--text-xs); color: var(--text-subtle);">Search tasks...</div>
              <div>
                <div style="display: flex; align-items: center; gap: var(--space-1); margin-bottom: var(--space-1);">
                  <span style="width: 3px; height: 12px; border-radius: var(--radius-xs); background: var(--color-danger);"></span>
                  <span style="font-size: var(--text-xs); font-weight: 600; color: var(--text-subtle); text-transform: uppercase; letter-spacing: 0.05em;">Overdue</span>
                  <span style="font-size: var(--text-xs); color: var(--text-muted); background: var(--glass-bg-soft); padding: 0 var(--space-1); border-radius: var(--radius-sm);">2</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 3px;">
                  <div style="padding: var(--space-1_5) var(--space-2); background: var(--canvas-task-bg); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); font-size: var(--text-xs); color: var(--text-primary); cursor: grab;">Fix landing page CTA</div>
                  <div style="padding: var(--space-1_5) var(--space-2); background: var(--canvas-task-bg); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); font-size: var(--text-xs); color: var(--text-primary); cursor: grab;">Review PR #42</div>
                </div>
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: var(--space-1); margin-bottom: var(--space-1);">
                  <span style="width: 3px; height: 12px; border-radius: var(--radius-xs); background: var(--brand-primary);"></span>
                  <span style="font-size: var(--text-xs); font-weight: 600; color: var(--text-subtle); text-transform: uppercase; letter-spacing: 0.05em;">Due Today</span>
                  <span style="font-size: var(--text-xs); color: var(--text-muted); background: var(--glass-bg-soft); padding: 0 var(--space-1); border-radius: var(--radius-sm);">3</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 3px;">
                  <div style="padding: var(--space-1_5) var(--space-2); background: var(--canvas-task-bg); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); font-size: var(--text-xs); color: var(--text-primary); cursor: grab;">Ship v1.3 release</div>
                  <div style="padding: var(--space-1_5) var(--space-2); background: var(--canvas-task-bg); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); font-size: var(--text-xs); color: var(--text-primary); cursor: grab;">Update API docs</div>
                  <div style="padding: var(--space-1_5) var(--space-2); background: var(--canvas-task-bg); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); font-size: var(--text-xs); color: var(--text-primary); cursor: grab;">Write unit tests</div>
                </div>
              </div>
              <div style="display: flex; gap: var(--space-1); margin-top: auto;">
                <div style="flex: 1; padding: var(--space-1_5) var(--space-2); background: var(--glass-bg-soft); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); font-size: var(--text-xs); color: var(--text-subtle);">Create a new task...</div>
                <button style="padding: var(--space-1_5) var(--space-2); background: var(--glass-bg-soft); border: 1px solid var(--brand-primary); border-radius: var(--radius-md); font-size: var(--text-xs); font-weight: 600; color: var(--brand-primary); white-space: nowrap;">Add</button>
              </div>
            </div>

            <!-- Drop Zones -->
            <div style="flex: 1; display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-2); background: var(--glass-bg-subtle); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); backdrop-filter: blur(8px);">
              <div style="flex: 1; display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border: 2px dashed var(--glass-border); border-radius: var(--radius-md);">
                <span style="font-size: var(--text-xs); font-weight: 700; color: var(--brand-primary);">1.</span>
                <span style="font-size: var(--text-xs); color: var(--text-subtle);">Top priority</span>
              </div>
              <div style="flex: 1; display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border: 2px dashed var(--glass-border); border-radius: var(--radius-md);">
                <span style="font-size: var(--text-xs); font-weight: 700; color: var(--brand-primary);">2.</span>
                <span style="font-size: var(--text-xs); color: var(--text-subtle);">Second focus</span>
              </div>
              <div style="flex: 1; display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border: 2px dashed var(--glass-border); border-radius: var(--radius-md);">
                <span style="font-size: var(--text-xs); font-weight: 700; color: var(--brand-primary);">3.</span>
                <span style="font-size: var(--text-xs); color: var(--text-subtle);">One more thing</span>
              </div>
              <button style="padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); border: 1px solid var(--brand-primary); border-radius: var(--radius-md); font-size: var(--text-xs); font-weight: 600; color: var(--brand-primary); opacity: 0.4; backdrop-filter: blur(8px); width: 100%;">Start My Day</button>
            </div>
          </div>
        </div>

        <!-- Bottom Row: Missions + News -->
        <div style="display: flex; gap: var(--space-2); margin-bottom: var(--space-3);">
          <!-- Daily Missions -->
          <div style="flex: 1; background: var(--canvas-task-bg); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: var(--space-3);">
            <div style="display: flex; align-items: center; gap: var(--space-1_5); margin-bottom: var(--space-2);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
              <span style="font-size: var(--text-xs); font-weight: 600; color: var(--text-primary);">Daily Missions</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: var(--space-1_5);">
              <div style="display: flex; align-items: center; gap: var(--space-1_5);">
                <div style="width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid var(--glass-border);"></div>
                <span style="font-size: var(--text-xs); color: var(--text-secondary);">Complete 3 tasks</span>
              </div>
              <div style="display: flex; align-items: center; gap: var(--space-1_5);">
                <div style="width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid var(--glass-border);"></div>
                <span style="font-size: var(--text-xs); color: var(--text-secondary);">Focus for 25 min</span>
              </div>
              <div style="display: flex; align-items: center; gap: var(--space-1_5);">
                <div style="width: 14px; height: 14px; border-radius: 50%; background: var(--brand-primary-subtle); border: 1.5px solid var(--brand-primary); display: flex; align-items: center; justify-content: center;">
                  <svg width="8" height="8" viewBox="0 0 16 16" fill="none"><path d="M5 8l2 2 4-4" stroke="#4ECDC4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
                <span style="font-size: var(--text-xs); color: var(--text-subtle); text-decoration: line-through;">Open app</span>
              </div>
            </div>
          </div>

          <!-- Tech News -->
          <div style="flex: 1; background: var(--canvas-task-bg); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: var(--space-3);">
            <div style="display: flex; align-items: center; gap: var(--space-1_5); margin-bottom: var(--space-2);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" stroke-width="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/></svg>
              <span style="font-size: var(--text-xs); font-weight: 600; color: var(--text-primary);">Tech News</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: var(--space-2);">
              <div>
                <div style="font-size: var(--text-xs); color: var(--text-primary); line-height: 1.3; margin-bottom: var(--space-0_5);">Show HN: Open-source task manager</div>
                <div style="font-size: var(--text-xs); color: var(--text-subtle);">github.com · 142 pts</div>
              </div>
              <div>
                <div style="font-size: var(--text-xs); color: var(--text-primary); line-height: 1.3; margin-bottom: var(--space-0_5);">Vue 4 RFC: Signals and fine-grained reactivity</div>
                <div style="font-size: var(--text-xs); color: var(--text-subtle);">vuejs.org · 98 pts</div>
              </div>
              <div>
                <div style="font-size: var(--text-xs); color: var(--text-primary); line-height: 1.3; margin-bottom: var(--space-0_5);">Tauri 3.0 ships with mobile support</div>
                <div style="font-size: var(--text-xs); color: var(--text-subtle);">tauri.app · 87 pts</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Capture -->
        <div style="
          display: flex; align-items: center; gap: var(--space-2);
          padding: var(--space-2_5) var(--space-3);
          background: var(--glass-bg-soft);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          backdrop-filter: blur(12px);
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-subtle);">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span style="font-size: var(--text-xs); color: var(--text-subtle);">Quick capture a task...</span>
        </div>
      </div>
    `, 'Morning')
  })
}

/**
 * Focus View - Timer Centric
 *
 * Planned feature: immersive focus mode with timer.
 */
export const Focus: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Planned mobile focus view — timer-centric interface (not yet implemented).'
      }
    }
  },
  render: () => ({
    template: PWAFrame(`
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: var(--space-6);
      ">
        <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: var(--space-4);">⏱</div>
          <div style="font-size: var(--text-xl); font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-2);">Focus View</div>
          <div style="font-size: var(--text-xs); color: var(--text-muted);">Timer-centric productivity interface</div>
        </div>
      </div>
    `, 'Focus')
  })
}

/**
 * Performance View - Benchmark Dashboard
 *
 * Planned feature: performance stats and benchmarks.
 */
export const Performance: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Planned mobile performance dashboard — benchmark stats and grade (not yet implemented).'
      }
    }
  },
  render: () => ({
    template: PWAFrame(`
      <div style="height: 100%; overflow-y: auto; padding: var(--space-4);">
        <!-- Grade Card -->
        <div style="
          background: linear-gradient(135deg, var(--brand-primary-subtle), var(--brand-bg-dim));
          border: 1px solid var(--brand-primary-dim);
          border-radius: var(--radius-xl);
          padding: var(--space-5);
          text-align: center;
          margin-bottom: var(--space-4);
        ">
          <div style="font-size: 56px; font-weight: 900; color: var(--brand-primary); text-shadow: 0 0 24px var(--brand-primary-dim); margin-bottom: var(--space-2); line-height: 1;">A+</div>
          <div style="font-size: var(--text-meta); color: var(--text-secondary); font-weight: 600;">Excellent Performance</div>
        </div>

        <!-- Summary Stats -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2_5); margin-bottom: var(--space-4);">
          <div style="background: var(--canvas-task-bg); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); padding: var(--space-3); text-align: center;">
            <div style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-1_5);">Tasks Completed</div>
            <div style="font-size: 22px; font-weight: 700; color: var(--text-primary);">127</div>
          </div>
          <div style="background: var(--canvas-task-bg); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); padding: var(--space-3); text-align: center;">
            <div style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-1_5);">Focus Hours</div>
            <div style="font-size: 22px; font-weight: 700; color: var(--text-primary);">42.5</div>
          </div>
          <div style="background: var(--canvas-task-bg); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); padding: var(--space-3); text-align: center;">
            <div style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-1_5);">Avg Completion</div>
            <div style="font-size: 22px; font-weight: 700; color: var(--text-primary);">94%</div>
          </div>
          <div style="background: var(--canvas-task-bg); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); padding: var(--space-3); text-align: center;">
            <div style="font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-1_5);">Streak</div>
            <div style="font-size: 22px; font-weight: 700; color: var(--text-primary);">7 days</div>
          </div>
        </div>

        <!-- Benchmark Results -->
        <div style="background: var(--canvas-task-bg); border: 1px solid var(--glass-border); border-radius: var(--radius-xl); padding: var(--space-3_5); margin-bottom: var(--space-4);">
          <div style="font-size: var(--text-xs); color: var(--text-secondary); font-weight: 600; margin-bottom: var(--space-3); text-transform: uppercase; letter-spacing: 0.05em;">Benchmark Results</div>
          <div style="display: flex; flex-direction: column; gap: var(--space-2_5);">
            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: var(--space-2); border-bottom: 1px solid var(--border-subtle);">
              <span style="font-size: var(--text-xs); color: var(--text-secondary);">Task Creation</span>
              <span style="font-size: var(--text-xs); font-weight: 600; color: var(--brand-primary);">0.8ms</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: var(--space-2); border-bottom: 1px solid var(--border-subtle);">
              <span style="font-size: var(--text-xs); color: var(--text-secondary);">Board Render</span>
              <span style="font-size: var(--text-xs); font-weight: 600; color: var(--brand-primary);">12.3ms</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: var(--space-2); border-bottom: 1px solid var(--border-subtle);">
              <span style="font-size: var(--text-xs); color: var(--text-secondary);">Calendar Render</span>
              <span style="font-size: var(--text-xs); font-weight: 600; color: var(--brand-primary);">18.7ms</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: var(--text-xs); color: var(--text-secondary);">Supabase Sync</span>
              <span style="font-size: var(--text-xs); font-weight: 600; color: var(--brand-primary);">45.2ms</span>
            </div>
          </div>
        </div>

        <!-- Recommendations -->
        <div style="background: var(--canvas-task-bg); border: 1px solid var(--glass-border); border-radius: var(--radius-xl); padding: var(--space-3_5);">
          <div style="font-size: var(--text-xs); color: var(--text-secondary); font-weight: 600; margin-bottom: var(--space-2_5); text-transform: uppercase; letter-spacing: 0.05em;">Recommendations</div>
          <ul style="margin: 0; padding-left: var(--space-4); font-size: var(--text-xs); color: var(--text-secondary); line-height: 1.6;">
            <li style="margin-bottom: var(--space-1_5);">All systems optimal</li>
            <li style="margin-bottom: var(--space-1_5);">Continue current workflow</li>
            <li>Great job on 7-day streak!</li>
          </ul>
        </div>
      </div>
    `, 'Performance')
  })
}
