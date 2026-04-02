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
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--border-subtle);
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
      background: var(--surface-secondary);
      backdrop-filter: blur(20px);
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 16px;
      border-bottom: 1px solid var(--border-subtle);
    ">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2">
        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
      <span style="
        font-size: 15px;
        font-weight: 600;
        color: var(--text-primary);
        letter-spacing: 0.01em;
      ">${title}</span>
      <div style="display: flex; gap: 12px; align-items: center;">
        <div style="
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--color-success);
          box-shadow: var(--success-glow);
        "></div>
        <span style="
          font-size: 13px;
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

    <!-- Bottom Nav (real mobile: Tasks, Sort, Timer, AI, Menu) -->
    <div style="
      height: 56px;
      background: var(--surface-secondary);
      backdrop-filter: blur(20px);
      border-top: 1px solid var(--glass-border);
      display: flex;
      justify-content: space-around;
      align-items: center;
      padding: 0 12px;
    ">
      <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${activeNav === 'Tasks' ? '#4ECDC4' : 'rgba(255,255,255,0.5)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
        </svg>
        <span style="font-size: var(--text-xs); color: ${activeNav === 'Tasks' ? 'var(--brand-primary)' : 'var(--text-muted)'};">Tasks</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${activeNav === 'Sort' ? '#4ECDC4' : 'rgba(255,255,255,0.5)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
        <span style="font-size: var(--text-xs); color: ${activeNav === 'Sort' ? 'var(--brand-primary)' : 'var(--text-muted)'};">Sort</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${activeNav === 'Timer' ? '#4ECDC4' : 'rgba(255,255,255,0.5)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>
        </svg>
        <span style="font-size: var(--text-xs); color: ${activeNav === 'Timer' ? 'var(--brand-primary)' : 'var(--text-muted)'};">Timer</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${activeNav === 'AI' ? '#4ECDC4' : 'rgba(255,255,255,0.5)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
        </svg>
        <span style="font-size: var(--text-xs); color: ${activeNav === 'AI' ? 'var(--brand-primary)' : 'var(--text-muted)'};">AI</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${activeNav === 'Menu' ? '#4ECDC4' : 'rgba(255,255,255,0.5)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>
        </svg>
        <span style="font-size: var(--text-xs); color: ${activeNav === 'Menu' ? 'var(--brand-primary)' : 'var(--text-muted)'};">Menu</span>
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
          background: var(--glass-bg-heavy);
          border-bottom: 1px solid var(--border-subtle);
        ">
          <div style="display: flex; gap: 8px; margin-bottom: 10px;">
            <button style="
              padding: 6px 12px;
              background: var(--state-active-bg);
              border: 1px solid var(--state-active-border);
              border-radius: var(--radius-md);
              color: var(--brand-primary);
              font-size: 11px;
              font-weight: 600;
            ">All</button>
            <button style="
              padding: 6px 12px;
              background: transparent;
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-md);
              color: var(--text-muted);
              font-size: 11px;
            ">Today</button>
            <button style="
              padding: 6px 12px;
              background: transparent;
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-md);
              color: var(--text-muted);
              font-size: 11px;
            ">Overdue</button>
          </div>
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <span style="font-size: var(--text-xs); color: var(--text-tertiary);">
              12 tasks
            </span>
            <button style="
              padding: var(--space-1) var(--space-2);
              background: var(--glass-bg-medium);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-sm);
              color: var(--text-secondary);
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
            background: var(--glass-bg-heavy);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-lg);
            margin-bottom: var(--space-2);
          ">
            <div style="
              width: 18px;
              height: 18px;
              border-radius: 4px;
              border: 2px solid var(--canvas-task-border);
              flex-shrink: 0;
            "></div>
            <div style="flex: 1; min-width: 0;">
              <div style="
                font-size: 12px;
                font-weight: 500;
                color: var(--text-primary);
                margin-bottom: var(--space-1);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              ">Fix critical auth bug</div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <span style="
                  padding: 2px 6px;
                  background: var(--priority-high-bg);
                  border-radius: var(--radius-xs);
                  font-size: var(--text-xs);
                  color: var(--priority-high-text);
                ">High</span>
                <span style="font-size: var(--text-xs); color: var(--text-muted);">Today</span>
              </div>
            </div>
          </div>

          <!-- Task Row 2 -->
          <div style="
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px;
            background: var(--glass-bg-heavy);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-lg);
            margin-bottom: var(--space-2);
          ">
            <div style="
              width: 18px;
              height: 18px;
              border-radius: 4px;
              border: 2px solid var(--canvas-task-border);
              flex-shrink: 0;
            "></div>
            <div style="flex: 1; min-width: 0;">
              <div style="
                font-size: 12px;
                font-weight: 500;
                color: var(--text-primary);
                margin-bottom: var(--space-1);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              ">Review Q4 marketing proposal</div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <span style="
                  padding: 2px 6px;
                  background: var(--priority-medium-bg);
                  border-radius: var(--radius-xs);
                  font-size: var(--text-xs);
                  color: var(--priority-medium-text);
                ">Medium</span>
                <span style="font-size: var(--text-xs); color: var(--text-muted);">Tomorrow</span>
              </div>
            </div>
          </div>

          <!-- Task Row 3 (Done) -->
          <div style="
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px;
            background: var(--glass-bg-heavy);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-lg);
            margin-bottom: var(--space-2);
          ">
            <div style="
              width: 18px;
              height: 18px;
              border-radius: 4px;
              border: 2px solid var(--state-active-border);
              background: var(--brand-primary-dim);
              flex-shrink: 0;
            "></div>
            <div style="flex: 1; min-width: 0;">
              <div style="
                font-size: 12px;
                font-weight: 500;
                color: var(--text-muted);
                text-decoration: line-through;
                margin-bottom: 4px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              ">Deploy production hotfix</div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <span style="
                  padding: 2px 6px;
                  background: var(--status-done-bg);
                  border-radius: var(--radius-xs);
                  font-size: var(--text-xs);
                  color: var(--status-done-text);
                ">Done</span>
                <span style="font-size: var(--text-xs); color: var(--text-subtle);">Yesterday</span>
              </div>
            </div>
          </div>

          <!-- Task Row 4 -->
          <div style="
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px;
            background: var(--glass-bg-heavy);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-lg);
            margin-bottom: var(--space-2);
          ">
            <div style="
              width: 18px;
              height: 18px;
              border-radius: 4px;
              border: 2px solid var(--canvas-task-border);
              flex-shrink: 0;
            "></div>
            <div style="flex: 1; min-width: 0;">
              <div style="
                font-size: 12px;
                font-weight: 500;
                color: var(--text-primary);
                margin-bottom: var(--space-1);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              ">Update documentation</div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <span style="
                  padding: 2px 6px;
                  background: var(--priority-low-bg);
                  border-radius: var(--radius-xs);
                  font-size: var(--text-xs);
                  color: var(--priority-low-text);
                ">Low</span>
                <span style="font-size: var(--text-xs); color: var(--text-muted);">Next Week</span>
              </div>
            </div>
          </div>

          <!-- Task Row 5 -->
          <div style="
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px;
            background: var(--glass-bg-heavy);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-lg);
          ">
            <div style="
              width: 18px;
              height: 18px;
              border-radius: 4px;
              border: 2px solid var(--canvas-task-border);
              flex-shrink: 0;
            "></div>
            <div style="flex: 1; min-width: 0;">
              <div style="
                font-size: 12px;
                font-weight: 500;
                color: var(--text-primary);
                margin-bottom: var(--space-1);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              ">Refactor auth module</div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <span style="
                  padding: 2px 6px;
                  background: var(--priority-medium-bg);
                  border-radius: var(--radius-xs);
                  font-size: var(--text-xs);
                  color: var(--priority-medium-text);
                ">Medium</span>
                <span style="font-size: var(--text-xs); color: var(--text-muted);">This Week</span>
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
          border-bottom: 1px solid var(--glass-border-light);
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ECDC4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          <span style="font-size: 17px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.02em;">Quick Sort</span>
          <span style="
            margin-left: auto;
            padding: 3px 10px;
            background: var(--glass-border-light);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-full);
            font-size: var(--text-xs);
            font-weight: 600;
            color: var(--text-secondary);
          ">4/10</span>
        </div>

        <!-- Progress Bar -->
        <div style="height: 3px; background: var(--glass-border-light); margin: 0 16px;">
          <div style="width: 40%; height: 100%; background: var(--brand-primary); border-radius: var(--radius-xs); box-shadow: var(--brand-glow-sm);"></div>
        </div>

        <!-- Phase Toggle -->
        <div style="display: flex; gap: 8px; padding: 8px 16px;">
          <button style="
            display: flex; align-items: center; gap: 5px;
            padding: 6px 14px;
            background: var(--brand-primary-subtle);
            border: 1px solid var(--state-hover-border);
            border-radius: var(--radius-full);
            font-size: var(--text-xs); color: var(--brand-primary); font-weight: 500;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Sort
            <span style="padding: 0 var(--space-1_5); background: var(--state-active-bg); border: 1px solid var(--brand-primary-dim); border-radius: var(--radius-full); font-size: var(--text-xs); font-weight: 600;">6</span>
          </button>
          <button style="
            display: flex; align-items: center; gap: 5px;
            padding: 6px 14px;
            background: var(--glass-bg-subtle);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-full);
            font-size: var(--text-xs); color: var(--text-muted);
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Capture
          </button>
        </div>

        <!-- Context Bar -->
        <div style="
          display: flex; align-items: center; gap: 10px;
          padding: 4px 16px 8px;
          font-size: var(--text-xs); color: var(--text-muted);
        ">
          <span style="display: flex; align-items: center; gap: 3px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Today
          </span>
          <span style="width: 1px; height: 12px; background: var(--glass-border);"></span>
          <span style="display: flex; align-items: center; gap: 4px;">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: var(--color-warning);"></span>
            Medium
          </span>
          <span style="width: 1px; height: 12px; background: var(--glass-border);"></span>
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
          <div style="position: absolute; top: 8px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 2px; color: var(--text-disabled); font-size: var(--text-xs);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
            Edit
          </div>
          <div style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); display: flex; align-items: center; gap: 2px; color: var(--text-disabled); font-size: var(--text-xs);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            Delete
          </div>
          <div style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); display: flex; align-items: center; gap: 2px; color: var(--text-disabled); font-size: var(--text-xs);">
            Save
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
          <div style="position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 2px; color: var(--text-disabled); font-size: var(--text-xs);">
            Skip
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>

          <!-- Background stack cards -->
          <div style="
            position: absolute;
            width: calc(100% - 48px);
            height: 180px;
            background: var(--glass-bg-medium);
            border: 1px solid var(--glass-border-light);
            border-radius: 16px;
            transform: scale(0.95) translateY(8px);
            opacity: 0.5;
          "></div>

          <!-- Active Card -->
          <div style="
            position: relative;
            width: 100%;
            background: var(--canvas-task-bg);
            border: 1px solid var(--glass-border-soft);
            border-radius: var(--radius-xl);
            padding: var(--space-5);
            box-shadow: 0 8px 32px var(--overlay-bg);
            z-index: 2;
          ">
            <div style="font-size: 17px; font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-2_5); line-height: 1.4;">
              Review Q4 marketing proposal
            </div>
            <div style="font-size: var(--text-xs); color: var(--text-tertiary); line-height: 1.5;">
              Analyze the proposed budget allocation and timeline for approval.
            </div>
          </div>
        </div>

        <!-- Quick Edit Filters (Thumb Zone) -->
        <div style="padding: 8px 12px 12px;">
          <!-- Priority Row -->
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
            <span style="font-size: var(--text-xs); color: var(--text-subtle); width: 48px; flex-shrink: 0;">Priority</span>
            <div style="display: flex; gap: 6px;">
              <button style="padding: 5px 12px; background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); border-radius: var(--radius-full); font-size: var(--text-xs); color: var(--text-muted);">Low</button>
              <button style="padding: var(--space-1_5) var(--space-3); background: var(--color-warning-alpha-10); border: 1px solid var(--orange-bg-medium); border-radius: var(--radius-full); font-size: var(--text-xs); color: var(--color-warning); font-weight: 500;">Med</button>
              <button style="padding: 5px 12px; background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); border-radius: var(--radius-full); font-size: var(--text-xs); color: var(--text-muted);">High</button>
            </div>
          </div>
          <!-- Date Row -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: var(--text-xs); color: var(--text-subtle); width: 48px; flex-shrink: 0;">Due</span>
            <div style="display: flex; gap: 6px; overflow-x: auto;">
              <button style="padding: var(--space-1_5) var(--space-3); background: var(--brand-primary-subtle); border: 1px solid var(--state-hover-border); border-radius: var(--radius-full); font-size: var(--text-xs); color: var(--brand-primary); font-weight: 500;">Today</button>
              <button style="padding: 5px 12px; background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); border-radius: var(--radius-full); font-size: var(--text-xs); color: var(--text-muted);">Tmrw</button>
              <button style="padding: 5px 12px; background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); border-radius: var(--radius-full); font-size: var(--text-xs); color: var(--text-muted);">+3d</button>
              <button style="padding: 5px 12px; background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); border-radius: var(--radius-full); font-size: var(--text-xs); color: var(--text-muted);">Wknd</button>
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
        background: var(--surface-secondary);
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
              background: linear-gradient(135deg, var(--state-active-bg), var(--brand-primary-subtle));
              border: 1px solid var(--brand-primary-dim);
              border-radius: 16px 12px 4px 12px;
            ">
              <div style="
                font-size: var(--text-xs);
                color: var(--text-primary);
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
              background: var(--glass-bg-heavy);
              border: 1px solid var(--glass-border);
              border-radius: 16px 12px 12px 4px;
            ">
              <div style="
                font-size: var(--text-xs);
                color: var(--text-secondary);
                line-height: 1.6;
              ">You have <strong style="color: var(--brand-primary);">3 tasks</strong> due today:</div>
              <ul style="
                margin: var(--space-2) 0 0 0;
                padding-left: var(--space-4);
                font-size: var(--text-xs);
                color: var(--text-secondary);
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
              background: linear-gradient(135deg, var(--state-active-bg), var(--brand-primary-subtle));
              border: 1px solid var(--brand-primary-dim);
              border-radius: 16px 12px 4px 12px;
            ">
              <div style="
                font-size: var(--text-xs);
                color: var(--text-primary);
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
              background: var(--glass-bg-heavy);
              border: 1px solid var(--glass-border);
              border-radius: 16px 12px 12px 4px;
            ">
              <div style="display: flex; gap: 4px; align-items: center;">
                <div style="width: 6px; height: 6px; border-radius: 50%; background: var(--state-active-border);"></div>
                <div style="width: 6px; height: 6px; border-radius: 50%; background: var(--state-hover-border);"></div>
                <div style="width: 6px; height: 6px; border-radius: 50%; background: var(--brand-primary-subtle);"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div style="
          padding: var(--space-3) var(--space-4);
          background: var(--glass-bg-heavy);
          border-top: 1px solid var(--border-subtle);
        ">
          <div style="
            display: flex;
            gap: 6px;
            overflow-x: auto;
            margin-bottom: 12px;
          ">
            <button style="
              padding: var(--space-1_5) var(--space-3);
              background: var(--glass-bg-soft);
              border: 1px solid var(--border-interactive);
              border-radius: var(--radius-lg);
              color: var(--text-secondary);
              font-size: 11px;
              white-space: nowrap;
            ">Plan my day</button>
            <button style="
              padding: var(--space-1_5) var(--space-3);
              background: var(--glass-bg-soft);
              border: 1px solid var(--border-interactive);
              border-radius: var(--radius-lg);
              color: var(--text-secondary);
              font-size: 11px;
              white-space: nowrap;
            ">What's overdue?</button>
            <button style="
              padding: var(--space-1_5) var(--space-3);
              background: var(--glass-bg-soft);
              border: 1px solid var(--border-interactive);
              border-radius: var(--radius-lg);
              color: var(--text-secondary);
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
                padding: var(--space-2_5) var(--space-3_5);
                background: var(--glass-bg-heavy);
                border: 1px solid var(--border-interactive);
                border-radius: var(--radius-full);
                color: var(--text-primary);
                font-size: var(--text-xs);
                outline: none;
              "
            />
            <button style="
              padding: var(--space-2_5) var(--space-4);
              background: linear-gradient(135deg, var(--brand-primary-dim), var(--state-active-bg));
              border: 1px solid var(--state-active-border);
              border-radius: var(--radius-full);
              color: var(--brand-primary);
              font-weight: 600;
              font-size: var(--text-xs);
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
          background: var(--glass-bg-medium);
          border-radius: var(--radius-lg);
          width: 100%;
        ">
          <button style="
            flex: 1;
            padding: 8px;
            background: var(--state-active-bg);
            border: 1px solid var(--state-active-border);
            border-radius: var(--radius-md);
            color: var(--brand-primary);
            font-size: 11px;
            font-weight: 600;
          ">Focus</button>
          <button style="
            flex: 1;
            padding: 8px;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 10px;
            color: var(--text-muted);
            font-size: var(--text-xs);
          ">Short Break</button>
          <button style="
            flex: 1;
            padding: 8px;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 10px;
            color: var(--text-muted);
            font-size: var(--text-xs);
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
                color: var(--text-primary);
                letter-spacing: 2px;
                font-variant-numeric: tabular-nums;
              ">18:42</div>
              <div style="
                font-size: 11px;
                color: var(--brand-primary);
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.1em;
              ">Focus Session</div>
            </div>
          </div>

          <!-- Session count -->
          <div style="display: flex; gap: 6px; align-items: center;">
            <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--brand-primary);"></div>
            <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--brand-primary);"></div>
            <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--brand-primary-dim); border: 1px solid var(--state-active-border);"></div>
            <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--glass-border);"></div>
            <span style="font-size: var(--text-xs); color: var(--text-subtle); margin-left: var(--space-1);">2 of 4</span>
          </div>
        </div>

        <!-- Active Task -->
        <div style="
          width: 100%;
          padding: 12px 16px;
          background: var(--glass-bg-heavy);
          border: 1px solid var(--brand-primary-subtle);
          border-left: 3px solid var(--brand-primary);
          border-radius: var(--radius-lg);
          margin-bottom: 24px;
        ">
          <div style="font-size: var(--text-xs); color: var(--text-subtle); margin-bottom: var(--space-1); text-transform: uppercase; letter-spacing: 0.05em;">Current Task</div>
          <div style="font-size: var(--text-sm); font-weight: 500; color: var(--text-primary);">Fix critical auth bug</div>
          <div style="display: flex; gap: var(--space-1_5); margin-top: var(--space-1_5);">
            <span style="padding: var(--space-0_5) var(--space-1_5); background: var(--priority-high-bg); border-radius: var(--radius-xs); font-size: var(--text-xs); color: var(--priority-high-text);">High</span>
            <span style="font-size: var(--text-xs); color: var(--text-muted);">Due today</span>
          </div>
        </div>

        <!-- Controls -->
        <div style="display: flex; gap: 12px; width: 100%;">
          <button style="
            flex: 1;
            padding: 14px;
            background: var(--glass-bg-medium);
            border: 1px solid var(--border-interactive);
            border-radius: var(--radius-xl);
            color: var(--text-secondary);
            font-size: 13px;
            font-weight: 500;
          ">Reset</button>
          <button style="
            flex: 2;
            padding: 14px;
            background: var(--danger-bg-subtle);
            border: 1px solid var(--danger-border-medium);
            border-radius: var(--radius-xl);
            color: var(--priority-high-text);
            font-size: 13px;
            font-weight: 600;
          ">Pause</button>
        </div>
      </div>
    `, 'Timer', 'Timer')
  })
}
