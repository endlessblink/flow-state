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
    border: 3px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6);
    display: flex;
    flex-direction: column;
  ">
    <!-- Status Bar -->
    <div style="
      height: 44px;
      background: linear-gradient(135deg, rgba(28, 25, 45, 0.95) 0%, rgba(35, 32, 52, 0.95) 100%);
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 24px;
      font-size: 12px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    ">
      <span>9:41</span>
      <div style="display: flex; gap: 6px; align-items: center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1"/></svg>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="10" rx="2"/><path d="M22 11h2"/></svg>
      </div>
    </div>

    <!-- App Header -->
    <div style="
      height: 44px;
      background: rgba(28, 25, 45, 0.92);
      backdrop-filter: blur(20px);
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    ">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2">
        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
      <span style="
        font-size: 15px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.95);
        letter-spacing: 0.01em;
      ">${title}</span>
      <div style="display: flex; gap: 12px; align-items: center;">
        <div style="
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
        "></div>
        <span style="
          font-size: 13px;
          font-weight: 500;
          color: rgba(78, 205, 196, 1);
          letter-spacing: 0.02em;
        ">25:00</span>
      </div>
    </div>

    <!-- Screen Content -->
    <div style="
      flex: 1;
      overflow: hidden;
      background: linear-gradient(180deg, rgba(18, 18, 26, 1) 0%, rgba(22, 20, 35, 1) 100%);
    ">
      ${screenContent}
    </div>

    <!-- Concept Label (instead of real nav) -->
    <div style="
      height: 56px;
      background: rgba(28, 25, 45, 0.85);
      backdrop-filter: blur(20px);
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 0 12px;
    ">
      <span style="
        font-size: 10px;
        color: rgba(255, 255, 255, 0.3);
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
      <div style="padding: 10px; overflow-y: auto; height: 100%; font-size: 11px;">
        <!-- View Type Tabs -->
        <div style="
          display: flex;
          gap: 6px;
          margin-bottom: 10px;
          padding: 4px;
          background: rgba(45, 40, 70, 0.15);
          border-radius: 10px;
        ">
          <button style="
            flex: 1;
            padding: 5px 8px;
            background: rgba(78, 205, 196, 0.15);
            border: 1px solid rgba(78, 205, 196, 0.5);
            border-radius: 8px;
            color: #4ECDC4;
            font-size: 10px;
            font-weight: 600;
          ">Priority</button>
          <button style="
            flex: 1;
            padding: 5px 8px;
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            color: rgba(255, 255, 255, 0.5);
            font-size: 10px;
          ">Date</button>
          <button style="
            flex: 1;
            padding: 5px 8px;
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            color: rgba(255, 255, 255, 0.5);
            font-size: 10px;
          ">Status</button>
        </div>

        <!-- Kanban Columns -->
        <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px;">
          <!-- High Priority Column -->
          <div style="
            min-width: 200px;
            background: rgba(45, 40, 70, 0.15);
            border-radius: 12px;
            padding: 10px;
          ">
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 8px;
            ">
              <span style="font-size: 10px; font-weight: 600; color: #f87171;">High</span>
              <span style="
                padding: 1px 6px;
                background: rgba(239, 68, 68, 0.2);
                border-radius: 12px;
                font-size: 10px;
                color: #f87171;
              ">3</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div style="
                background: rgba(35, 32, 52, 0.95);
                border: 1px solid rgba(239, 68, 68, 0.3);
                border-radius: 8px;
                padding: 8px;
              ">
                <div style="font-size: 11px; font-weight: 500; color: rgba(255, 255, 255, 0.95); margin-bottom: 6px; line-height: 1.3;">Fix critical auth bug</div>
                <div style="display: flex; gap: 6px; align-items: center;">
                  <span style="padding: 1px 5px; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.5); border-radius: 4px; font-size: 9px; color: #f87171;">High</span>
                  <span style="font-size: 9px; color: rgba(255, 255, 255, 0.5);">Today</span>
                </div>
              </div>
              <div style="
                background: rgba(35, 32, 52, 0.95);
                border: 1px solid rgba(239, 68, 68, 0.3);
                border-radius: 8px;
                padding: 8px;
              ">
                <div style="font-size: 11px; font-weight: 500; color: rgba(255, 255, 255, 0.95); margin-bottom: 6px; line-height: 1.3;">Deploy production hotfix</div>
                <div style="display: flex; gap: 6px; align-items: center;">
                  <span style="padding: 1px 5px; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.5); border-radius: 4px; font-size: 9px; color: #f87171;">High</span>
                  <span style="font-size: 9px; color: rgba(255, 255, 255, 0.5);">Tomorrow</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Medium Priority Column -->
          <div style="
            min-width: 200px;
            background: rgba(45, 40, 70, 0.15);
            border-radius: 12px;
            padding: 10px;
          ">
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 8px;
            ">
              <span style="font-size: 10px; font-weight: 600; color: #fb923c;">Medium</span>
              <span style="
                padding: 1px 6px;
                background: rgba(249, 115, 22, 0.2);
                border-radius: 12px;
                font-size: 10px;
                color: #fb923c;
              ">5</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div style="
                background: rgba(35, 32, 52, 0.95);
                border: 1px solid rgba(249, 115, 22, 0.3);
                border-radius: 8px;
                padding: 8px;
              ">
                <div style="font-size: 11px; font-weight: 500; color: rgba(255, 255, 255, 0.95); margin-bottom: 6px; line-height: 1.3;">Review Q4 marketing plan</div>
                <div style="display: flex; gap: 6px; align-items: center;">
                  <span style="padding: 1px 5px; background: rgba(249, 115, 22, 0.2); border: 1px solid rgba(249, 115, 22, 0.5); border-radius: 4px; font-size: 9px; color: #fb923c;">Medium</span>
                  <span style="font-size: 9px; color: rgba(255, 255, 255, 0.5);">This Week</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Low Priority Column -->
          <div style="
            min-width: 200px;
            background: rgba(45, 40, 70, 0.15);
            border-radius: 12px;
            padding: 10px;
          ">
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 8px;
            ">
              <span style="font-size: 10px; font-weight: 600; color: #60a5fa;">Low</span>
              <span style="
                padding: 1px 6px;
                background: rgba(59, 130, 246, 0.2);
                border-radius: 12px;
                font-size: 10px;
                color: #60a5fa;
              ">2</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div style="
                background: rgba(35, 32, 52, 0.95);
                border: 1px solid rgba(59, 130, 246, 0.3);
                border-radius: 8px;
                padding: 8px;
              ">
                <div style="font-size: 11px; font-weight: 500; color: rgba(255, 255, 255, 0.95); margin-bottom: 6px; line-height: 1.3;">Update team wiki</div>
                <div style="display: flex; gap: 6px; align-items: center;">
                  <span style="padding: 1px 5px; background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.5); border-radius: 4px; font-size: 9px; color: #60a5fa;">Low</span>
                  <span style="font-size: 9px; color: rgba(255, 255, 255, 0.5);">Next Week</span>
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
          padding: 12px 16px;
          background: rgba(28, 25, 45, 0.6);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        ">
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
          ">
            <button style="
              padding: 6px;
              background: rgba(45, 40, 70, 0.15);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 8px;
              color: rgba(255, 255, 255, 0.7);
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span style="font-size: 13px; font-weight: 600; color: rgba(255, 255, 255, 0.95);">Today Feb 13</span>
            <button style="
              padding: 6px;
              background: rgba(45, 40, 70, 0.15);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 8px;
              color: rgba(255, 255, 255, 0.7);
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          <div style="display: flex; gap: 6px;">
            <button style="
              flex: 1;
              padding: 6px 10px;
              background: rgba(78, 205, 196, 0.15);
              border: 1px solid rgba(78, 205, 196, 0.5);
              border-radius: 8px;
              color: #4ECDC4;
              font-size: 11px;
              font-weight: 600;
            ">Day</button>
            <button style="
              flex: 1;
              padding: 6px 10px;
              background: transparent;
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 8px;
              color: rgba(255, 255, 255, 0.5);
              font-size: 11px;
            ">Week</button>
            <button style="
              flex: 1;
              padding: 6px 10px;
              background: transparent;
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 8px;
              color: rgba(255, 255, 255, 0.5);
              font-size: 11px;
            ">Month</button>
          </div>
        </div>

        <!-- Time Grid -->
        <div style="flex: 1; overflow-y: auto; padding: 0 12px;">
          <div style="position: relative; height: 48px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <span style="position: absolute; left: 0; top: 8px; font-size: 11px; color: rgba(255, 255, 255, 0.4);">9:00</span>
          </div>

          <!-- 10:00 with task -->
          <div style="position: relative; height: 96px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <span style="position: absolute; left: 0; top: 8px; font-size: 11px; color: rgba(255, 255, 255, 0.4);">10:00</span>
            <div style="
              position: absolute; left: 48px; right: 0; top: 4px; height: 88px;
              background: linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(220, 38, 38, 0.25));
              border-left: 3px solid #f87171;
              border-radius: 8px;
              padding: 8px;
            ">
              <div style="font-size: 11px; font-weight: 600; color: rgba(255, 255, 255, 0.95); margin-bottom: 4px;">Team standup</div>
              <div style="font-size: 11px; color: rgba(255, 255, 255, 0.6);">10:00 - 10:30</div>
            </div>
          </div>

          <div style="position: relative; height: 48px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <span style="position: absolute; left: 0; top: 8px; font-size: 11px; color: rgba(255, 255, 255, 0.4);">11:00</span>
          </div>

          <!-- Current time line -->
          <div style="position: relative; height: 48px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <span style="position: absolute; left: 0; top: 8px; font-size: 11px; color: rgba(255, 255, 255, 0.4);">12:00</span>
            <div style="position: absolute; left: 48px; right: 0; top: 24px; height: 2px; background: #ef4444; box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);">
              <div style="position: absolute; left: -6px; top: -4px; width: 10px; height: 10px; border-radius: 50%; background: #ef4444;"></div>
            </div>
          </div>

          <!-- 13:00 with task -->
          <div style="position: relative; height: 96px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <span style="position: absolute; left: 0; top: 8px; font-size: 11px; color: rgba(255, 255, 255, 0.4);">13:00</span>
            <div style="
              position: absolute; left: 48px; right: 0; top: 4px; height: 88px;
              background: linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(37, 99, 235, 0.25));
              border-left: 3px solid #60a5fa;
              border-radius: 8px;
              padding: 8px;
            ">
              <div style="font-size: 11px; font-weight: 600; color: rgba(255, 255, 255, 0.95); margin-bottom: 4px;">Code review session</div>
              <div style="font-size: 11px; color: rgba(255, 255, 255, 0.6);">13:00 - 13:30</div>
            </div>
          </div>

          <div style="position: relative; height: 48px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <span style="position: absolute; left: 0; top: 8px; font-size: 11px; color: rgba(255, 255, 255, 0.4);">14:00</span>
          </div>
          <div style="position: relative; height: 48px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <span style="position: absolute; left: 0; top: 8px; font-size: 11px; color: rgba(255, 255, 255, 0.4);">15:00</span>
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
          top: 12px;
          left: 12px;
          right: 12px;
          display: flex;
          gap: 8px;
          z-index: 10;
        ">
          <button style="
            padding: 8px 12px;
            background: rgba(28, 25, 45, 0.85);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 12px;
            color: rgba(255, 255, 255, 0.9);
            font-size: 11px;
            font-weight: 500;
          ">+ Task</button>
          <button style="
            padding: 8px 12px;
            background: rgba(28, 25, 45, 0.85);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 12px;
            color: rgba(255, 255, 255, 0.9);
            font-size: 11px;
            font-weight: 500;
          ">+ Group</button>
          <div style="flex: 1;"></div>
          <button style="
            padding: 8px;
            background: rgba(28, 25, 45, 0.85);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 12px;
            color: rgba(255, 255, 255, 0.9);
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
            </svg>
          </button>
        </div>

        <!-- Canvas Content -->
        <div style="position: relative; height: 100%; padding: 60px 12px 12px 12px;">
          <!-- Task Node 1 -->
          <div style="
            position: absolute; left: 24px; top: 80px; width: 200px;
            background: rgba(35, 32, 52, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.25);
            border-radius: 8px;
            padding: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          ">
            <div style="font-size: 11px; font-weight: 600; color: rgba(255, 255, 255, 0.95); margin-bottom: 5px;">Design new feature mockups</div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <span style="padding: 1px 5px; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.5); border-radius: 4px; font-size: 9px; color: #f87171;">High</span>
              <span style="font-size: 9px; color: rgba(255, 255, 255, 0.5);">Today</span>
            </div>
          </div>

          <!-- Group Node -->
          <div style="
            position: absolute; left: 150px; top: 200px; width: 220px; height: 160px;
            background: rgba(38, 35, 55, 0.7);
            border: 2px dashed rgba(255, 255, 255, 0.3);
            border-radius: 16px;
            padding: 8px;
          ">
            <div style="font-size: 11px; font-weight: 600; color: rgba(255, 255, 255, 0.7); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">Sprint Tasks (3)</div>
            <div style="
              background: rgba(35, 32, 52, 0.95);
              border: 1px solid rgba(255, 255, 255, 0.2);
              border-radius: 8px;
              padding: 8px;
              margin-bottom: 6px;
            ">
              <div style="font-size: 11px; font-weight: 500; color: rgba(255, 255, 255, 0.95);">API integration</div>
            </div>
            <div style="
              background: rgba(35, 32, 52, 0.95);
              border: 1px solid rgba(255, 255, 255, 0.2);
              border-radius: 8px;
              padding: 8px;
            ">
              <div style="font-size: 11px; font-weight: 500; color: rgba(255, 255, 255, 0.95);">Unit tests</div>
            </div>
          </div>

          <!-- Task Node 2 -->
          <div style="
            position: absolute; right: 24px; top: 120px; width: 180px;
            background: rgba(35, 32, 52, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.25);
            border-radius: 8px;
            padding: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          ">
            <div style="font-size: 11px; font-weight: 600; color: rgba(255, 255, 255, 0.95); margin-bottom: 5px;">Update documentation</div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <span style="padding: 1px 5px; background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.5); border-radius: 4px; font-size: 9px; color: #60a5fa;">Low</span>
            </div>
          </div>

          <!-- Task Node 3 -->
          <div style="
            position: absolute; left: 40px; bottom: 100px; width: 190px;
            background: rgba(35, 32, 52, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.25);
            border-radius: 8px;
            padding: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          ">
            <div style="font-size: 11px; font-weight: 600; color: rgba(255, 255, 255, 0.95); margin-bottom: 5px;">Refactor auth module</div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <span style="padding: 1px 5px; background: rgba(249, 115, 22, 0.2); border: 1px solid rgba(249, 115, 22, 0.5); border-radius: 4px; font-size: 9px; color: #fb923c;">Medium</span>
              <span style="font-size: 9px; color: rgba(255, 255, 255, 0.5);">Tomorrow</span>
            </div>
          </div>
        </div>

        <!-- Minimap -->
        <div style="
          position: absolute; bottom: 16px; right: 16px;
          width: 100px; height: 70px;
          background: rgba(28, 25, 45, 0.85);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          padding: 4px;
        ">
          <div style="
            width: 100%; height: 100%;
            background:
              radial-gradient(circle at 30% 30%, rgba(239, 68, 68, 0.3) 0%, transparent 20%),
              radial-gradient(circle at 70% 50%, rgba(59, 130, 246, 0.3) 0%, transparent 20%);
            border-radius: 4px;
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
      <div style="overflow-y: auto; height: 100%; padding: 12px;">
        <!-- Greeting + Score Row -->
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
        ">
          <div style="flex: 1;">
            <h1 style="font-size: 1.25rem; font-weight: 600; color: rgba(255, 255, 255, 0.95); margin: 0 0 4px 0; line-height: 1.2;">Good morning, there</h1>
            <p style="font-size: 11px; color: rgba(255, 255, 255, 0.55); margin: 0 0 4px 0;">Saturday, March 7, 2026</p>
            <p style="font-size: 11px; font-style: italic; color: rgba(255, 255, 255, 0.35); margin: 0;">The way to get started is to quit talking and begin doing.</p>
          </div>
          <div style="
            display: flex; align-items: center; gap: 8px;
            padding: 8px 12px;
            background: rgba(45, 40, 70, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            backdrop-filter: blur(12px);
            flex-shrink: 0;
          ">
            <div style="width: 24px; height: 24px; border-radius: 50%; background: rgba(78, 205, 196, 0.2); border: 1.5px solid #4ECDC4; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; color: #4ECDC4;">1</div>
            <div style="width: 48px; height: 4px; background: rgba(255, 255, 255, 0.08); border-radius: 2px; overflow: hidden;">
              <div style="width: 35%; height: 100%; background: linear-gradient(90deg, #4ECDC4, #3db8af); border-radius: 2px;"></div>
            </div>
            <div style="display: flex; align-items: center; gap: 3px; font-size: 10px; color: #fb923c;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#fb923c" stroke="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
              0
            </div>
          </div>
        </div>

        <!-- Big 3 Card -->
        <div style="
          background: rgba(35, 32, 52, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 12px;
        ">
          <div style="margin-bottom: 8px;">
            <div style="font-size: 13px; font-weight: 600; color: rgba(255, 255, 255, 0.95); margin-bottom: 2px;">Today's Big 3</div>
            <div style="font-size: 10px; color: rgba(255, 255, 255, 0.4);">Drag tasks from the left into your focus zones</div>
          </div>

          <div style="display: flex; gap: 8px; min-height: 200px;">
            <!-- Task Pool -->
            <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
              <div style="padding: 6px 8px; background: rgba(45, 40, 70, 0.4); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; font-size: 10px; color: rgba(255, 255, 255, 0.35);">Search tasks...</div>
              <div>
                <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
                  <span style="width: 3px; height: 12px; border-radius: 2px; background: #f87171;"></span>
                  <span style="font-size: 9px; font-weight: 600; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.05em;">Overdue</span>
                  <span style="font-size: 9px; color: rgba(255,255,255,0.3); background: rgba(45,40,70,0.4); padding: 0 4px; border-radius: 3px;">2</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 3px;">
                  <div style="padding: 6px 8px; background: rgba(35, 32, 52, 0.9); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 6px; font-size: 10px; color: rgba(255, 255, 255, 0.9); cursor: grab;">Fix landing page CTA</div>
                  <div style="padding: 6px 8px; background: rgba(35, 32, 52, 0.9); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 6px; font-size: 10px; color: rgba(255, 255, 255, 0.9); cursor: grab;">Review PR #42</div>
                </div>
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
                  <span style="width: 3px; height: 12px; border-radius: 2px; background: #4ECDC4;"></span>
                  <span style="font-size: 9px; font-weight: 600; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.05em;">Due Today</span>
                  <span style="font-size: 9px; color: rgba(255,255,255,0.3); background: rgba(45,40,70,0.4); padding: 0 4px; border-radius: 3px;">3</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 3px;">
                  <div style="padding: 6px 8px; background: rgba(35, 32, 52, 0.9); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 6px; font-size: 10px; color: rgba(255, 255, 255, 0.9); cursor: grab;">Ship v1.3 release</div>
                  <div style="padding: 6px 8px; background: rgba(35, 32, 52, 0.9); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 6px; font-size: 10px; color: rgba(255, 255, 255, 0.9); cursor: grab;">Update API docs</div>
                  <div style="padding: 6px 8px; background: rgba(35, 32, 52, 0.9); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 6px; font-size: 10px; color: rgba(255, 255, 255, 0.9); cursor: grab;">Write unit tests</div>
                </div>
              </div>
              <div style="display: flex; gap: 4px; margin-top: auto;">
                <div style="flex: 1; padding: 6px 8px; background: rgba(45, 40, 70, 0.4); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; font-size: 10px; color: rgba(255, 255, 255, 0.35);">Create a new task...</div>
                <button style="padding: 6px 8px; background: rgba(45, 40, 70, 0.4); border: 1px solid #4ECDC4; border-radius: 8px; font-size: 10px; font-weight: 600; color: #4ECDC4; white-space: nowrap;">Add</button>
              </div>
            </div>

            <!-- Drop Zones -->
            <div style="flex: 1; display: flex; flex-direction: column; gap: 8px; padding: 8px; background: rgba(45, 40, 70, 0.25); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; backdrop-filter: blur(8px);">
              <div style="flex: 1; display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 2px dashed rgba(255, 255, 255, 0.1); border-radius: 8px;">
                <span style="font-size: 10px; font-weight: 700; color: #4ECDC4;">1.</span>
                <span style="font-size: 10px; color: rgba(255, 255, 255, 0.35);">Top priority</span>
              </div>
              <div style="flex: 1; display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 2px dashed rgba(255, 255, 255, 0.1); border-radius: 8px;">
                <span style="font-size: 10px; font-weight: 700; color: #4ECDC4;">2.</span>
                <span style="font-size: 10px; color: rgba(255, 255, 255, 0.35);">Second focus</span>
              </div>
              <div style="flex: 1; display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 2px dashed rgba(255, 255, 255, 0.1); border-radius: 8px;">
                <span style="font-size: 10px; font-weight: 700; color: #4ECDC4;">3.</span>
                <span style="font-size: 10px; color: rgba(255, 255, 255, 0.35);">One more thing</span>
              </div>
              <button style="padding: 8px 12px; background: rgba(45, 40, 70, 0.4); border: 1px solid #4ECDC4; border-radius: 8px; font-size: 11px; font-weight: 600; color: #4ECDC4; opacity: 0.4; backdrop-filter: blur(8px); width: 100%;">Start My Day</button>
            </div>
          </div>
        </div>

        <!-- Bottom Row: Missions + News -->
        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
          <!-- Daily Missions -->
          <div style="flex: 1; background: rgba(35, 32, 52, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 12px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ECDC4" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
              <span style="font-size: 11px; font-weight: 600; color: rgba(255, 255, 255, 0.9);">Daily Missions</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.2);"></div>
                <span style="font-size: 10px; color: rgba(255, 255, 255, 0.7);">Complete 3 tasks</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.2);"></div>
                <span style="font-size: 10px; color: rgba(255, 255, 255, 0.7);">Focus for 25 min</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 14px; height: 14px; border-radius: 50%; background: rgba(78,205,196,0.2); border: 1.5px solid #4ECDC4; display: flex; align-items: center; justify-content: center;">
                  <svg width="8" height="8" viewBox="0 0 16 16" fill="none"><path d="M5 8l2 2 4-4" stroke="#4ECDC4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
                <span style="font-size: 10px; color: rgba(255, 255, 255, 0.4); text-decoration: line-through;">Open app</span>
              </div>
            </div>
          </div>

          <!-- Tech News -->
          <div style="flex: 1; background: rgba(35, 32, 52, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 12px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ECDC4" stroke-width="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/></svg>
              <span style="font-size: 11px; font-weight: 600; color: rgba(255, 255, 255, 0.9);">Tech News</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div>
                <div style="font-size: 10px; color: rgba(255, 255, 255, 0.85); line-height: 1.3; margin-bottom: 2px;">Show HN: Open-source task manager</div>
                <div style="font-size: 9px; color: rgba(255, 255, 255, 0.3);">github.com · 142 pts</div>
              </div>
              <div>
                <div style="font-size: 10px; color: rgba(255, 255, 255, 0.85); line-height: 1.3; margin-bottom: 2px;">Vue 4 RFC: Signals and fine-grained reactivity</div>
                <div style="font-size: 9px; color: rgba(255, 255, 255, 0.3);">vuejs.org · 98 pts</div>
              </div>
              <div>
                <div style="font-size: 10px; color: rgba(255, 255, 255, 0.85); line-height: 1.3; margin-bottom: 2px;">Tauri 3.0 ships with mobile support</div>
                <div style="font-size: 9px; color: rgba(255, 255, 255, 0.3);">tauri.app · 87 pts</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Capture -->
        <div style="
          display: flex; align-items: center; gap: 8px;
          padding: 10px 12px;
          background: rgba(45, 40, 70, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          backdrop-filter: blur(12px);
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span style="font-size: 11px; color: rgba(255, 255, 255, 0.35);">Quick capture a task...</span>
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
        padding: 24px;
      ">
        <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: 16px;">⏱</div>
          <div style="font-size: 20px; font-weight: 600; color: rgba(255, 255, 255, 0.95); margin-bottom: 8px;">Focus View</div>
          <div style="font-size: 12px; color: rgba(255, 255, 255, 0.5);">Timer-centric productivity interface</div>
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
      <div style="height: 100%; overflow-y: auto; padding: 16px;">
        <!-- Grade Card -->
        <div style="
          background: linear-gradient(135deg, rgba(78, 205, 196, 0.15), rgba(78, 205, 196, 0.08));
          border: 1px solid rgba(78, 205, 196, 0.3);
          border-radius: 16px;
          padding: 20px;
          text-align: center;
          margin-bottom: 16px;
        ">
          <div style="font-size: 56px; font-weight: 900; color: #4ECDC4; text-shadow: 0 0 24px rgba(78, 205, 196, 0.5); margin-bottom: 8px; line-height: 1;">A+</div>
          <div style="font-size: 13px; color: rgba(255, 255, 255, 0.8); font-weight: 600;">Excellent Performance</div>
        </div>

        <!-- Summary Stats -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
          <div style="background: rgba(35, 32, 52, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 12px; text-align: center;">
            <div style="font-size: 10px; color: rgba(255, 255, 255, 0.5); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Tasks Completed</div>
            <div style="font-size: 22px; font-weight: 700; color: rgba(255, 255, 255, 0.95);">127</div>
          </div>
          <div style="background: rgba(35, 32, 52, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 12px; text-align: center;">
            <div style="font-size: 10px; color: rgba(255, 255, 255, 0.5); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Focus Hours</div>
            <div style="font-size: 22px; font-weight: 700; color: rgba(255, 255, 255, 0.95);">42.5</div>
          </div>
          <div style="background: rgba(35, 32, 52, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 12px; text-align: center;">
            <div style="font-size: 10px; color: rgba(255, 255, 255, 0.5); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Avg Completion</div>
            <div style="font-size: 22px; font-weight: 700; color: rgba(255, 255, 255, 0.95);">94%</div>
          </div>
          <div style="background: rgba(35, 32, 52, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 12px; text-align: center;">
            <div style="font-size: 10px; color: rgba(255, 255, 255, 0.5); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Streak</div>
            <div style="font-size: 22px; font-weight: 700; color: rgba(255, 255, 255, 0.95);">7 days</div>
          </div>
        </div>

        <!-- Benchmark Results -->
        <div style="background: rgba(35, 32, 52, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 14px; margin-bottom: 16px;">
          <div style="font-size: 11px; color: rgba(255, 255, 255, 0.7); font-weight: 600; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Benchmark Results</div>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <span style="font-size: 11px; color: rgba(255, 255, 255, 0.8);">Task Creation</span>
              <span style="font-size: 11px; font-weight: 600; color: #4ECDC4;">0.8ms</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <span style="font-size: 11px; color: rgba(255, 255, 255, 0.8);">Board Render</span>
              <span style="font-size: 11px; font-weight: 600; color: #4ECDC4;">12.3ms</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <span style="font-size: 11px; color: rgba(255, 255, 255, 0.8);">Calendar Render</span>
              <span style="font-size: 11px; font-weight: 600; color: #4ECDC4;">18.7ms</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; color: rgba(255, 255, 255, 0.8);">Supabase Sync</span>
              <span style="font-size: 11px; font-weight: 600; color: #4ECDC4;">45.2ms</span>
            </div>
          </div>
        </div>

        <!-- Recommendations -->
        <div style="background: rgba(35, 32, 52, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 14px;">
          <div style="font-size: 11px; color: rgba(255, 255, 255, 0.7); font-weight: 600; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em;">Recommendations</div>
          <ul style="margin: 0; padding-left: 16px; font-size: 11px; color: rgba(255, 255, 255, 0.8); line-height: 1.6;">
            <li style="margin-bottom: 6px;">All systems optimal</li>
            <li style="margin-bottom: 6px;">Continue current workflow</li>
            <li>Great job on 7-day streak!</li>
          </ul>
        </div>
      </div>
    `, 'Performance')
  })
}
