import type { Meta, StoryObj } from '@storybook/vue3'

/**
 * PWA Screens - Real Mobile Views
 *
 * Actual FlowState mobile PWA screens in phone viewport (390x844px iPhone 14 frame).
 * These match the real mobile bottom navigation: Tasks, Sort, Timer, AI, Menu.
 *
 * **Screens:**
 * 1. Tasks - Task list with filters and sorting
 * 2. QuickSort - Card-based triage interface
 * 3. AIChat - Full-screen AI assistant chat
 * 4. Timer - Pomodoro timer view
 *
 * **Design:**
 * - 390x844px viewport (iPhone 14 aspect ratio)
 * - Rounded phone bezel (40px radius)
 * - Dark bezel border (3px)
 * - Status bar (time, wifi, battery)
 * - App header (44px) + bottom nav (56px)
 * - Mobile-optimized layouts (smaller fonts, tighter spacing)
 */
const meta: Meta = {
  title: '📱 PWA Screens',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `Real FlowState mobile PWA screens matching the actual bottom navigation.

**Mobile Nav:** Tasks | Sort | Timer | AI | Menu

**Viewport Specs:**
- 390x844px (iPhone 14 aspect ratio)
- Rounded bezel with dark border
- Status bar + app shell included
- Mobile-optimized spacing and typography

**Note:** These are static previews of real implemented mobile views.`
      }
    }
  }
}

export default meta
type Story = StoryObj

// Real mobile bottom nav: Tasks, Sort, Timer, AI, Menu
const PWAFrame = (screenContent: string, title: string, activeNav: string) => `
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

    <!-- Bottom Nav (real mobile: Tasks, Sort, Timer, AI, Menu) -->
    <div style="
      height: 56px;
      background: rgba(28, 25, 45, 0.85);
      backdrop-filter: blur(20px);
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      justify-content: space-around;
      align-items: center;
      padding: 0 12px;
    ">
      <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${activeNav === 'Tasks' ? '#4ECDC4' : 'rgba(255,255,255,0.5)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
        </svg>
        <span style="font-size: 10px; color: ${activeNav === 'Tasks' ? '#4ECDC4' : 'rgba(255,255,255,0.5)'};">Tasks</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${activeNav === 'Sort' ? '#4ECDC4' : 'rgba(255,255,255,0.5)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
        <span style="font-size: 10px; color: ${activeNav === 'Sort' ? '#4ECDC4' : 'rgba(255,255,255,0.5)'};">Sort</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${activeNav === 'Timer' ? '#4ECDC4' : 'rgba(255,255,255,0.5)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>
        </svg>
        <span style="font-size: 10px; color: ${activeNav === 'Timer' ? '#4ECDC4' : 'rgba(255,255,255,0.5)'};">Timer</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${activeNav === 'AI' ? '#4ECDC4' : 'rgba(255,255,255,0.5)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
        </svg>
        <span style="font-size: 10px; color: ${activeNav === 'AI' ? '#4ECDC4' : 'rgba(255,255,255,0.5)'};">AI</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${activeNav === 'Menu' ? '#4ECDC4' : 'rgba(255,255,255,0.5)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>
        </svg>
        <span style="font-size: 10px; color: ${activeNav === 'Menu' ? '#4ECDC4' : 'rgba(255,255,255,0.5)'};">Menu</span>
      </div>
    </div>
  </div>
`

/**
 * Tasks View - Task List
 *
 * The main task list view accessible from the Tasks tab in mobile nav.
 * Shows filters, sorting, and a scrollable task list.
 */
export const Tasks: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Mobile task list (MobileInboxView) — the default view when opening the PWA. Filters, sorting, and swipeable task rows.'
      }
    }
  },
  render: () => ({
    template: PWAFrame(`
      <div style="
        display: flex;
        flex-direction: column;
        height: 100%;
      ">
        <!-- Filter Bar -->
        <div style="
          padding: 12px 16px;
          background: rgba(28, 25, 45, 0.6);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        ">
          <div style="display: flex; gap: 8px; margin-bottom: 10px;">
            <button style="
              padding: 6px 12px;
              background: rgba(78, 205, 196, 0.15);
              border: 1px solid rgba(78, 205, 196, 0.5);
              border-radius: 8px;
              color: #4ECDC4;
              font-size: 11px;
              font-weight: 600;
            ">All</button>
            <button style="
              padding: 6px 12px;
              background: transparent;
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 8px;
              color: rgba(255, 255, 255, 0.5);
              font-size: 11px;
            ">Today</button>
            <button style="
              padding: 6px 12px;
              background: transparent;
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 8px;
              color: rgba(255, 255, 255, 0.5);
              font-size: 11px;
            ">Overdue</button>
          </div>
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <span style="font-size: 11px; color: rgba(255, 255, 255, 0.6);">
              12 tasks
            </span>
            <button style="
              padding: 4px 8px;
              background: rgba(45, 40, 70, 0.3);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 6px;
              color: rgba(255, 255, 255, 0.7);
              font-size: 11px;
            ">Sort: Priority</button>
          </div>
        </div>

        <!-- Task List -->
        <div style="
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        ">
          <!-- Task Row 1 -->
          <div style="
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px;
            background: rgba(35, 32, 52, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            margin-bottom: 8px;
          ">
            <div style="
              width: 18px;
              height: 18px;
              border-radius: 4px;
              border: 2px solid rgba(255, 255, 255, 0.3);
              flex-shrink: 0;
            "></div>
            <div style="flex: 1; min-width: 0;">
              <div style="
                font-size: 12px;
                font-weight: 500;
                color: rgba(255, 255, 255, 0.95);
                margin-bottom: 4px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              ">Fix critical auth bug</div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <span style="
                  padding: 2px 6px;
                  background: rgba(239, 68, 68, 0.2);
                  border-radius: 4px;
                  font-size: 9px;
                  color: #f87171;
                ">High</span>
                <span style="font-size: 10px; color: rgba(255, 255, 255, 0.5);">Today</span>
              </div>
            </div>
          </div>

          <!-- Task Row 2 -->
          <div style="
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px;
            background: rgba(35, 32, 52, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            margin-bottom: 8px;
          ">
            <div style="
              width: 18px;
              height: 18px;
              border-radius: 4px;
              border: 2px solid rgba(255, 255, 255, 0.3);
              flex-shrink: 0;
            "></div>
            <div style="flex: 1; min-width: 0;">
              <div style="
                font-size: 12px;
                font-weight: 500;
                color: rgba(255, 255, 255, 0.95);
                margin-bottom: 4px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              ">Review Q4 marketing proposal</div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <span style="
                  padding: 2px 6px;
                  background: rgba(249, 115, 22, 0.2);
                  border-radius: 4px;
                  font-size: 9px;
                  color: #fb923c;
                ">Medium</span>
                <span style="font-size: 10px; color: rgba(255, 255, 255, 0.5);">Tomorrow</span>
              </div>
            </div>
          </div>

          <!-- Task Row 3 (Done) -->
          <div style="
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px;
            background: rgba(35, 32, 52, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            margin-bottom: 8px;
          ">
            <div style="
              width: 18px;
              height: 18px;
              border-radius: 4px;
              border: 2px solid rgba(78, 205, 196, 0.5);
              background: rgba(78, 205, 196, 0.3);
              flex-shrink: 0;
            "></div>
            <div style="flex: 1; min-width: 0;">
              <div style="
                font-size: 12px;
                font-weight: 500;
                color: rgba(255, 255, 255, 0.5);
                text-decoration: line-through;
                margin-bottom: 4px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              ">Deploy production hotfix</div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <span style="
                  padding: 2px 6px;
                  background: rgba(34, 197, 94, 0.2);
                  border-radius: 4px;
                  font-size: 9px;
                  color: #4ade80;
                ">Done</span>
                <span style="font-size: 10px; color: rgba(255, 255, 255, 0.4);">Yesterday</span>
              </div>
            </div>
          </div>

          <!-- Task Row 4 -->
          <div style="
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px;
            background: rgba(35, 32, 52, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            margin-bottom: 8px;
          ">
            <div style="
              width: 18px;
              height: 18px;
              border-radius: 4px;
              border: 2px solid rgba(255, 255, 255, 0.3);
              flex-shrink: 0;
            "></div>
            <div style="flex: 1; min-width: 0;">
              <div style="
                font-size: 12px;
                font-weight: 500;
                color: rgba(255, 255, 255, 0.95);
                margin-bottom: 4px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              ">Update documentation</div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <span style="
                  padding: 2px 6px;
                  background: rgba(59, 130, 246, 0.2);
                  border-radius: 4px;
                  font-size: 9px;
                  color: #60a5fa;
                ">Low</span>
                <span style="font-size: 10px; color: rgba(255, 255, 255, 0.5);">Next Week</span>
              </div>
            </div>
          </div>

          <!-- Task Row 5 -->
          <div style="
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px;
            background: rgba(35, 32, 52, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
          ">
            <div style="
              width: 18px;
              height: 18px;
              border-radius: 4px;
              border: 2px solid rgba(255, 255, 255, 0.3);
              flex-shrink: 0;
            "></div>
            <div style="flex: 1; min-width: 0;">
              <div style="
                font-size: 12px;
                font-weight: 500;
                color: rgba(255, 255, 255, 0.95);
                margin-bottom: 4px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              ">Refactor auth module</div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <span style="
                  padding: 2px 6px;
                  background: rgba(249, 115, 22, 0.2);
                  border-radius: 4px;
                  font-size: 9px;
                  color: #fb923c;
                ">Medium</span>
                <span style="font-size: 10px; color: rgba(255, 255, 255, 0.5);">This Week</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `, 'Tasks', 'Tasks')
  })
}

/**
 * QuickSort View - Swipe-Based Triage
 *
 * 4-direction swipe card interface for rapid task triage.
 * Accessible via the Sort tab in mobile nav.
 */
export const QuickSort: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Mobile QuickSort (MobileQuickSortView) — 4-direction swipe card triage with phase toggle, context bar, and quick edit filters.'
      }
    }
  },
  render: () => ({
    template: PWAFrame(`
      <div style="
        display: flex;
        flex-direction: column;
        height: 100%;
        position: relative;
      ">
        <!-- Header -->
        <div style="
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ECDC4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          <span style="font-size: 17px; font-weight: 700; color: rgba(255,255,255,0.95); letter-spacing: -0.02em;">Quick Sort</span>
          <span style="
            margin-left: auto;
            padding: 3px 10px;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            color: rgba(255,255,255,0.9);
          ">4/10</span>
        </div>

        <!-- Progress Bar -->
        <div style="height: 3px; background: rgba(255,255,255,0.06); margin: 0 16px;">
          <div style="width: 40%; height: 100%; background: #4ECDC4; border-radius: 2px; box-shadow: 0 0 8px rgba(78,205,196,0.5);"></div>
        </div>

        <!-- Phase Toggle -->
        <div style="display: flex; gap: 8px; padding: 8px 16px;">
          <button style="
            display: flex; align-items: center; gap: 5px;
            padding: 6px 14px;
            background: rgba(78,205,196,0.1);
            border: 1px solid rgba(78,205,196,0.4);
            border-radius: 20px;
            font-size: 12px; color: #4ECDC4; font-weight: 500;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Sort
            <span style="padding: 0 5px; background: rgba(78,205,196,0.15); border: 1px solid rgba(78,205,196,0.3); border-radius: 10px; font-size: 10px; font-weight: 600;">6</span>
          </button>
          <button style="
            display: flex; align-items: center; gap: 5px;
            padding: 6px 14px;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 20px;
            font-size: 12px; color: rgba(255,255,255,0.5);
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Capture
          </button>
        </div>

        <!-- Context Bar -->
        <div style="
          display: flex; align-items: center; gap: 10px;
          padding: 4px 16px 8px;
          font-size: 11px; color: rgba(255,255,255,0.5);
        ">
          <span style="display: flex; align-items: center; gap: 3px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Today
          </span>
          <span style="width: 1px; height: 12px; background: rgba(255,255,255,0.1);"></span>
          <span style="display: flex; align-items: center; gap: 4px;">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: #f59e0b;"></span>
            Medium
          </span>
          <span style="width: 1px; height: 12px; background: rgba(255,255,255,0.1);"></span>
          <span style="display: flex; align-items: center; gap: 3px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            Work
          </span>
        </div>

        <!-- Card Area with Swipe Hints -->
        <div style="
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: 0 16px;
        ">
          <!-- Swipe hints -->
          <div style="position: absolute; top: 8px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 2px; color: rgba(255,255,255,0.25); font-size: 10px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
            Edit
          </div>
          <div style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); display: flex; align-items: center; gap: 2px; color: rgba(255,255,255,0.25); font-size: 10px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            Delete
          </div>
          <div style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); display: flex; align-items: center; gap: 2px; color: rgba(255,255,255,0.25); font-size: 10px;">
            Save
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
          <div style="position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 2px; color: rgba(255,255,255,0.25); font-size: 10px;">
            Skip
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>

          <!-- Background stack cards -->
          <div style="
            position: absolute;
            width: calc(100% - 48px);
            height: 180px;
            background: rgba(35,32,52,0.5);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 16px;
            transform: scale(0.95) translateY(8px);
            opacity: 0.5;
          "></div>

          <!-- Active Card -->
          <div style="
            position: relative;
            width: 100%;
            background: rgba(35, 32, 52, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 16px;
            padding: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            z-index: 2;
          ">
            <div style="font-size: 17px; font-weight: 600; color: rgba(255,255,255,0.95); margin-bottom: 10px; line-height: 1.4;">
              Review Q4 marketing proposal
            </div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.55); line-height: 1.5;">
              Analyze the proposed budget allocation and timeline for approval.
            </div>
          </div>
        </div>

        <!-- Quick Edit Filters (Thumb Zone) -->
        <div style="padding: 8px 12px 12px;">
          <!-- Priority Row -->
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
            <span style="font-size: 11px; color: rgba(255,255,255,0.4); width: 48px; flex-shrink: 0;">Priority</span>
            <div style="display: flex; gap: 6px;">
              <button style="padding: 5px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; font-size: 11px; color: rgba(255,255,255,0.5);">Low</button>
              <button style="padding: 5px 12px; background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.4); border-radius: 20px; font-size: 11px; color: #f59e0b; font-weight: 500;">Med</button>
              <button style="padding: 5px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; font-size: 11px; color: rgba(255,255,255,0.5);">High</button>
            </div>
          </div>
          <!-- Date Row -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 11px; color: rgba(255,255,255,0.4); width: 48px; flex-shrink: 0;">Due</span>
            <div style="display: flex; gap: 6px; overflow-x: auto;">
              <button style="padding: 5px 12px; background: rgba(78,205,196,0.1); border: 1px solid rgba(78,205,196,0.4); border-radius: 20px; font-size: 11px; color: #4ECDC4; font-weight: 500;">Today</button>
              <button style="padding: 5px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; font-size: 11px; color: rgba(255,255,255,0.5);">Tmrw</button>
              <button style="padding: 5px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; font-size: 11px; color: rgba(255,255,255,0.5);">+3d</button>
              <button style="padding: 5px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; font-size: 11px; color: rgba(255,255,255,0.5);">Wknd</button>
            </div>
          </div>
        </div>
      </div>
    `, 'Quick Sort', 'Sort')
  })
}

/**
 * AI Chat View - Full-Screen Chat
 *
 * AI assistant chat interface accessible from the AI tab.
 */
export const AIChat: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Mobile AI chat (MobileAIChatView) — full-screen chat with quick action chips and typing indicator.'
      }
    }
  },
  render: () => ({
    template: PWAFrame(`
      <div style="
        display: flex;
        flex-direction: column;
        height: 100%;
        background: rgba(18, 18, 20, 0.98);
      ">
        <!-- Chat Messages Area -->
        <div style="
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        ">
          <!-- User Message -->
          <div style="
            display: flex;
            justify-content: flex-end;
            margin-bottom: 16px;
          ">
            <div style="
              max-width: 75%;
              padding: 10px 14px;
              background: linear-gradient(135deg, rgba(78, 205, 196, 0.2), rgba(78, 205, 196, 0.15));
              border: 1px solid rgba(78, 205, 196, 0.3);
              border-radius: 16px 12px 4px 12px;
            ">
              <div style="
                font-size: 12px;
                color: rgba(255, 255, 255, 0.95);
                line-height: 1.5;
              ">What tasks are due today?</div>
            </div>
          </div>

          <!-- AI Message -->
          <div style="
            display: flex;
            justify-content: flex-start;
            margin-bottom: 16px;
          ">
            <div style="
              max-width: 85%;
              padding: 10px 14px;
              background: rgba(35, 32, 52, 0.8);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 16px 12px 12px 4px;
            ">
              <div style="
                font-size: 12px;
                color: rgba(255, 255, 255, 0.9);
                line-height: 1.6;
              ">You have <strong style="color: #4ECDC4;">3 tasks</strong> due today:</div>
              <ul style="
                margin: 8px 0 0 0;
                padding-left: 16px;
                font-size: 12px;
                color: rgba(255, 255, 255, 0.8);
                line-height: 1.6;
              ">
                <li>Fix critical auth bug</li>
                <li>Team standup at 10:00</li>
                <li>Code review session at 13:00</li>
              </ul>
            </div>
          </div>

          <!-- User Message -->
          <div style="
            display: flex;
            justify-content: flex-end;
            margin-bottom: 16px;
          ">
            <div style="
              max-width: 75%;
              padding: 10px 14px;
              background: linear-gradient(135deg, rgba(78, 205, 196, 0.2), rgba(78, 205, 196, 0.15));
              border: 1px solid rgba(78, 205, 196, 0.3);
              border-radius: 16px 12px 4px 12px;
            ">
              <div style="
                font-size: 12px;
                color: rgba(255, 255, 255, 0.95);
                line-height: 1.5;
              ">Plan my day</div>
            </div>
          </div>

          <!-- AI Typing Indicator -->
          <div style="
            display: flex;
            justify-content: flex-start;
          ">
            <div style="
              padding: 10px 14px;
              background: rgba(35, 32, 52, 0.8);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 16px 12px 12px 4px;
            ">
              <div style="display: flex; gap: 4px; align-items: center;">
                <div style="width: 6px; height: 6px; border-radius: 50%; background: rgba(78, 205, 196, 0.6);"></div>
                <div style="width: 6px; height: 6px; border-radius: 50%; background: rgba(78, 205, 196, 0.4);"></div>
                <div style="width: 6px; height: 6px; border-radius: 50%; background: rgba(78, 205, 196, 0.2);"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div style="
          padding: 12px 16px;
          background: rgba(28, 25, 45, 0.6);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        ">
          <div style="
            display: flex;
            gap: 6px;
            overflow-x: auto;
            margin-bottom: 12px;
          ">
            <button style="
              padding: 6px 12px;
              background: rgba(45, 40, 70, 0.5);
              border: 1px solid rgba(255, 255, 255, 0.15);
              border-radius: 12px;
              color: rgba(255, 255, 255, 0.8);
              font-size: 11px;
              white-space: nowrap;
            ">Plan my day</button>
            <button style="
              padding: 6px 12px;
              background: rgba(45, 40, 70, 0.5);
              border: 1px solid rgba(255, 255, 255, 0.15);
              border-radius: 12px;
              color: rgba(255, 255, 255, 0.8);
              font-size: 11px;
              white-space: nowrap;
            ">What's overdue?</button>
            <button style="
              padding: 6px 12px;
              background: rgba(45, 40, 70, 0.5);
              border: 1px solid rgba(255, 255, 255, 0.15);
              border-radius: 12px;
              color: rgba(255, 255, 255, 0.8);
              font-size: 11px;
              white-space: nowrap;
            ">Weekly summary</button>
          </div>

          <!-- Input Bar -->
          <div style="display: flex; gap: 8px;">
            <input
              type="text"
              placeholder="Ask anything..."
              style="
                flex: 1;
                padding: 10px 14px;
                background: rgba(35, 32, 52, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 20px;
                color: rgba(255, 255, 255, 0.95);
                font-size: 12px;
                outline: none;
              "
            />
            <button style="
              padding: 10px 16px;
              background: linear-gradient(135deg, rgba(78, 205, 196, 0.3), rgba(78, 205, 196, 0.2));
              border: 1px solid rgba(78, 205, 196, 0.5);
              border-radius: 20px;
              color: #4ECDC4;
              font-weight: 600;
              font-size: 12px;
            ">Send</button>
          </div>
        </div>
      </div>
    `, 'AI Chat', 'AI')
  })
}

/**
 * Timer View - Pomodoro Timer
 *
 * Full-screen Pomodoro timer accessible from the Timer tab.
 * Shows countdown, active task, and session controls.
 */
export const Timer: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Mobile Pomodoro timer (MobileTimerView) — large countdown display with session controls and active task.'
      }
    }
  },
  render: () => ({
    template: PWAFrame(`
      <div style="
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 24px 16px;
        align-items: center;
        justify-content: space-between;
      ">
        <!-- Session Type Tabs -->
        <div style="
          display: flex;
          gap: 4px;
          padding: 4px;
          background: rgba(45, 40, 70, 0.3);
          border-radius: 12px;
          width: 100%;
        ">
          <button style="
            flex: 1;
            padding: 8px;
            background: rgba(78, 205, 196, 0.15);
            border: 1px solid rgba(78, 205, 196, 0.5);
            border-radius: 10px;
            color: #4ECDC4;
            font-size: 11px;
            font-weight: 600;
          ">Focus</button>
          <button style="
            flex: 1;
            padding: 8px;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 10px;
            color: rgba(255, 255, 255, 0.5);
            font-size: 11px;
          ">Short Break</button>
          <button style="
            flex: 1;
            padding: 8px;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 10px;
            color: rgba(255, 255, 255, 0.5);
            font-size: 11px;
          ">Long Break</button>
        </div>

        <!-- Timer Display -->
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          margin: 32px 0;
        ">
          <!-- Circular Timer -->
          <div style="
            position: relative;
            width: 220px;
            height: 220px;
          ">
            <!-- Timer ring background -->
            <svg width="220" height="220" viewBox="0 0 220 220" style="position: absolute; top: 0; left: 0;">
              <circle cx="110" cy="110" r="100" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="6"/>
              <circle cx="110" cy="110" r="100" fill="none" stroke="#4ECDC4" stroke-width="6"
                stroke-dasharray="628" stroke-dashoffset="157" stroke-linecap="round"
                transform="rotate(-90 110 110)"
                style="filter: drop-shadow(0 0 8px rgba(78, 205, 196, 0.4));"/>
            </svg>
            <!-- Time text -->
            <div style="
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            ">
              <div style="
                font-size: 52px;
                font-weight: 300;
                color: rgba(255, 255, 255, 0.95);
                letter-spacing: 2px;
                font-variant-numeric: tabular-nums;
              ">18:42</div>
              <div style="
                font-size: 11px;
                color: rgba(78, 205, 196, 0.8);
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.1em;
              ">Focus Session</div>
            </div>
          </div>

          <!-- Session count -->
          <div style="display: flex; gap: 6px; align-items: center;">
            <div style="width: 8px; height: 8px; border-radius: 50%; background: #4ECDC4;"></div>
            <div style="width: 8px; height: 8px; border-radius: 50%; background: #4ECDC4;"></div>
            <div style="width: 8px; height: 8px; border-radius: 50%; background: rgba(78, 205, 196, 0.3); border: 1px solid rgba(78, 205, 196, 0.5);"></div>
            <div style="width: 8px; height: 8px; border-radius: 50%; background: rgba(255, 255, 255, 0.1);"></div>
            <span style="font-size: 10px; color: rgba(255, 255, 255, 0.4); margin-left: 4px;">2 of 4</span>
          </div>
        </div>

        <!-- Active Task -->
        <div style="
          width: 100%;
          padding: 12px 16px;
          background: rgba(35, 32, 52, 0.6);
          border: 1px solid rgba(78, 205, 196, 0.2);
          border-left: 3px solid #4ECDC4;
          border-radius: 12px;
          margin-bottom: 24px;
        ">
          <div style="font-size: 10px; color: rgba(255, 255, 255, 0.4); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em;">Current Task</div>
          <div style="font-size: 13px; font-weight: 500; color: rgba(255, 255, 255, 0.95);">Fix critical auth bug</div>
          <div style="display: flex; gap: 6px; margin-top: 6px;">
            <span style="padding: 2px 6px; background: rgba(239, 68, 68, 0.2); border-radius: 4px; font-size: 9px; color: #f87171;">High</span>
            <span style="font-size: 10px; color: rgba(255, 255, 255, 0.5);">Due today</span>
          </div>
        </div>

        <!-- Controls -->
        <div style="display: flex; gap: 12px; width: 100%;">
          <button style="
            flex: 1;
            padding: 14px;
            background: rgba(45, 40, 70, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 14px;
            color: rgba(255, 255, 255, 0.7);
            font-size: 13px;
            font-weight: 500;
          ">Reset</button>
          <button style="
            flex: 2;
            padding: 14px;
            background: rgba(239, 68, 68, 0.15);
            border: 1px solid rgba(239, 68, 68, 0.4);
            border-radius: 14px;
            color: #f87171;
            font-size: 13px;
            font-weight: 600;
          ">Pause</button>
        </div>
      </div>
    `, 'Timer', 'Timer')
  })
}
