import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import {
  LayoutGrid,
  Calendar,
  Grid3x3,
  Zap,
  List,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Menu,
  Wifi,
  Battery,
  Timer,
  Columns3,
  CheckSquare,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  MoreHorizontal
} from 'lucide-vue-next'

/**
 * PWA Screens - Mobile Viewport Gallery
 *
 * Shows all 9 FlowState screens in mobile PWA viewports (390x844px iPhone 14 frame).
 * Each screen includes the app shell (header + bottom nav) for realistic mobile preview.
 *
 * **Screens:**
 * 1. Board - Kanban with priority columns
 * 2. Calendar - Day view with time grid
 * 3. Canvas - Whiteboard with nodes
 * 4. QuickSort - Card-based triage
 * 5. Focus - Timer-centric view (stub)
 * 6. AllTasks - Task table/list
 * 7. AIChat - Full-screen chat
 * 8. Cyberflow - Gamification dashboard
 * 9. Performance - Benchmark stats
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
        component: `Gallery of all FlowState screens in mobile PWA viewports.

**Viewport Specs:**
- 390x844px (iPhone 14 aspect ratio)
- Rounded bezel with dark border
- Status bar + app shell included
- Mobile-optimized spacing and typography

**Use Cases:**
- Mobile UI review
- PWA design validation
- Screenshot generation for docs
- Visual regression testing

**Note:** These are static previews. Full interactivity requires real store setup.`
      }
    }
  }
}

export default meta
type Story = StoryObj

// PWA Device Frame decorator
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
      padding: 0 16px;
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
        font-size: 16px;
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
          font-size: 14px;
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
      background: var(--app-background-gradient);
    ">
      ${screenContent}
    </div>

    <!-- Bottom Nav -->
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
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${title === 'Board' ? '#4ECDC4' : 'rgba(255,255,255,0.5)'}" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
        <span style="font-size: 10px; color: ${title === 'Board' ? '#4ECDC4' : 'rgba(255,255,255,0.5)'};">Board</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${title === 'Calendar' ? '#4ECDC4' : 'rgba(255,255,255,0.5)'}" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span style="font-size: 10px; color: ${title === 'Calendar' ? '#4ECDC4' : 'rgba(255,255,255,0.5)'};">Calendar</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${title === 'Canvas' ? '#4ECDC4' : 'rgba(255,255,255,0.5)'}" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
        <span style="font-size: 10px; color: ${title === 'Canvas' ? '#4ECDC4' : 'rgba(255,255,255,0.5)'};">Canvas</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${title === 'QuickSort' ? '#4ECDC4' : 'rgba(255,255,255,0.5)'}" stroke-width="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
        <span style="font-size: 10px; color: ${title === 'QuickSort' ? '#4ECDC4' : 'rgba(255,255,255,0.5)'};">Sort</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2">
          <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
        </svg>
        <span style="font-size: 10px; color: rgba(255,255,255,0.5);">More</span>
      </div>
    </div>
  </div>
`

/**
 * Board View - Priority Kanban
 *
 * Kanban board with High/Medium/Low priority columns.
 */
export const Board: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Mobile Kanban board with priority columns (High/Medium/Low).'
      }
    }
  },
  render: () => ({
    template: PWAFrame(`
      <div style="padding: 12px; overflow-y: auto; height: 100%;">
        <!-- View Type Tabs -->
        <div style="
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
          padding: 4px;
          background: rgba(45, 40, 70, 0.15);
          border-radius: 8px;
        ">
          <button style="
            flex: 1;
            padding: 6px 12px;
            background: rgba(78, 205, 196, 0.15);
            border: 1px solid rgba(78, 205, 196, 0.5);
            border-radius: 6px;
            color: #4ECDC4;
            font-size: 12px;
            font-weight: 600;
          ">Priority</button>
          <button style="
            flex: 1;
            padding: 6px 12px;
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 6px;
            color: rgba(255, 255, 255, 0.5);
            font-size: 12px;
          ">Date</button>
          <button style="
            flex: 1;
            padding: 6px 12px;
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 6px;
            color: rgba(255, 255, 255, 0.5);
            font-size: 12px;
          ">Status</button>
        </div>

        <!-- Kanban Columns -->
        <div style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 8px;">
          <!-- High Priority Column -->
          <div style="
            min-width: 280px;
            background: rgba(45, 40, 70, 0.15);
            border-radius: 12px;
            padding: 12px;
          ">
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 10px;
            ">
              <span style="font-size: 13px; font-weight: 600; color: #f87171;">High</span>
              <span style="
                padding: 2px 8px;
                background: rgba(239, 68, 68, 0.2);
                border-radius: 12px;
                font-size: 11px;
                color: #f87171;
              ">3</span>
            </div>
            <!-- Task Cards -->
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div style="
                background: rgba(35, 32, 52, 0.95);
                border: 1px solid rgba(239, 68, 68, 0.3);
                border-radius: 8px;
                padding: 10px;
              ">
                <div style="
                  font-size: 13px;
                  font-weight: 500;
                  color: rgba(255, 255, 255, 0.95);
                  margin-bottom: 6px;
                  line-height: 1.3;
                ">Fix critical auth bug</div>
                <div style="display: flex; gap: 6px; align-items: center;">
                  <span style="
                    padding: 2px 6px;
                    background: rgba(239, 68, 68, 0.2);
                    border: 1px solid rgba(239, 68, 68, 0.5);
                    border-radius: 4px;
                    font-size: 10px;
                    color: #f87171;
                  ">High</span>
                  <span style="font-size: 11px; color: rgba(255, 255, 255, 0.5);">Today</span>
                </div>
              </div>
              <div style="
                background: rgba(35, 32, 52, 0.95);
                border: 1px solid rgba(239, 68, 68, 0.3);
                border-radius: 8px;
                padding: 10px;
              ">
                <div style="
                  font-size: 13px;
                  font-weight: 500;
                  color: rgba(255, 255, 255, 0.95);
                  margin-bottom: 6px;
                  line-height: 1.3;
                ">Deploy production hotfix</div>
                <div style="display: flex; gap: 6px; align-items: center;">
                  <span style="
                    padding: 2px 6px;
                    background: rgba(239, 68, 68, 0.2);
                    border: 1px solid rgba(239, 68, 68, 0.5);
                    border-radius: 4px;
                    font-size: 10px;
                    color: #f87171;
                  ">High</span>
                  <span style="font-size: 11px; color: rgba(255, 255, 255, 0.5);">Tomorrow</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Medium Priority Column -->
          <div style="
            min-width: 280px;
            background: rgba(45, 40, 70, 0.15);
            border-radius: 12px;
            padding: 12px;
          ">
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 10px;
            ">
              <span style="font-size: 13px; font-weight: 600; color: #fb923c;">Medium</span>
              <span style="
                padding: 2px 8px;
                background: rgba(249, 115, 22, 0.2);
                border-radius: 12px;
                font-size: 11px;
                color: #fb923c;
              ">5</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div style="
                background: rgba(35, 32, 52, 0.95);
                border: 1px solid rgba(249, 115, 22, 0.3);
                border-radius: 8px;
                padding: 10px;
              ">
                <div style="
                  font-size: 13px;
                  font-weight: 500;
                  color: rgba(255, 255, 255, 0.95);
                  margin-bottom: 6px;
                  line-height: 1.3;
                ">Review Q4 marketing plan</div>
                <div style="display: flex; gap: 6px; align-items: center;">
                  <span style="
                    padding: 2px 6px;
                    background: rgba(249, 115, 22, 0.2);
                    border: 1px solid rgba(249, 115, 22, 0.5);
                    border-radius: 4px;
                    font-size: 10px;
                    color: #fb923c;
                  ">Medium</span>
                  <span style="font-size: 11px; color: rgba(255, 255, 255, 0.5);">This Week</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Low Priority Column -->
          <div style="
            min-width: 280px;
            background: rgba(45, 40, 70, 0.15);
            border-radius: 12px;
            padding: 12px;
          ">
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 10px;
            ">
              <span style="font-size: 13px; font-weight: 600; color: #60a5fa;">Low</span>
              <span style="
                padding: 2px 8px;
                background: rgba(59, 130, 246, 0.2);
                border-radius: 12px;
                font-size: 11px;
                color: #60a5fa;
              ">2</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div style="
                background: rgba(35, 32, 52, 0.95);
                border: 1px solid rgba(59, 130, 246, 0.3);
                border-radius: 8px;
                padding: 10px;
              ">
                <div style="
                  font-size: 13px;
                  font-weight: 500;
                  color: rgba(255, 255, 255, 0.95);
                  margin-bottom: 6px;
                  line-height: 1.3;
                ">Update team wiki</div>
                <div style="display: flex; gap: 6px; align-items: center;">
                  <span style="
                    padding: 2px 6px;
                    background: rgba(59, 130, 246, 0.2);
                    border: 1px solid rgba(59, 130, 246, 0.5);
                    border-radius: 4px;
                    font-size: 10px;
                    color: #60a5fa;
                  ">Low</span>
                  <span style="font-size: 11px; color: rgba(255, 255, 255, 0.5);">Next Week</span>
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
 * Calendar day view with hourly time grid and scheduled tasks.
 */
export const Calendar: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Mobile calendar day view with time slots and scheduled tasks.'
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
              border-radius: 6px;
              color: rgba(255, 255, 255, 0.7);
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <span style="
              font-size: 15px;
              font-weight: 600;
              color: rgba(255, 255, 255, 0.95);
            ">Today Feb 13</span>
            <button style="
              padding: 6px;
              background: rgba(45, 40, 70, 0.15);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 6px;
              color: rgba(255, 255, 255, 0.7);
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
          <div style="display: flex; gap: 6px;">
            <button style="
              flex: 1;
              padding: 6px 10px;
              background: rgba(78, 205, 196, 0.15);
              border: 1px solid rgba(78, 205, 196, 0.5);
              border-radius: 6px;
              color: #4ECDC4;
              font-size: 12px;
              font-weight: 600;
            ">Day</button>
            <button style="
              flex: 1;
              padding: 6px 10px;
              background: transparent;
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 6px;
              color: rgba(255, 255, 255, 0.5);
              font-size: 12px;
            ">Week</button>
            <button style="
              flex: 1;
              padding: 6px 10px;
              background: transparent;
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 6px;
              color: rgba(255, 255, 255, 0.5);
              font-size: 12px;
            ">Month</button>
          </div>
        </div>

        <!-- Time Grid -->
        <div style="
          flex: 1;
          overflow-y: auto;
          padding: 0 12px;
        ">
          <!-- Current Time Indicator -->
          <div style="
            position: relative;
            height: 48px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          ">
            <span style="
              position: absolute;
              left: 0;
              top: 8px;
              font-size: 11px;
              color: rgba(255, 255, 255, 0.4);
            ">9:00</span>
          </div>

          <!-- 10:00 Slot with Task -->
          <div style="
            position: relative;
            height: 96px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          ">
            <span style="
              position: absolute;
              left: 0;
              top: 8px;
              font-size: 11px;
              color: rgba(255, 255, 255, 0.4);
            ">10:00</span>
            <div style="
              position: absolute;
              left: 48px;
              right: 0;
              top: 4px;
              height: 88px;
              background: linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(220, 38, 38, 0.25) 100%);
              border-left: 3px solid #f87171;
              border-radius: 6px;
              padding: 8px;
            ">
              <div style="
                font-size: 13px;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.95);
                margin-bottom: 4px;
              ">Team standup</div>
              <div style="
                font-size: 11px;
                color: rgba(255, 255, 255, 0.6);
              ">10:00 - 10:30</div>
            </div>
          </div>

          <!-- 11:00 Empty Slot -->
          <div style="
            position: relative;
            height: 48px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          ">
            <span style="
              position: absolute;
              left: 0;
              top: 8px;
              font-size: 11px;
              color: rgba(255, 255, 255, 0.4);
            ">11:00</span>
          </div>

          <!-- Current Time Indicator Line -->
          <div style="
            position: relative;
            height: 48px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          ">
            <span style="
              position: absolute;
              left: 0;
              top: 8px;
              font-size: 11px;
              color: rgba(255, 255, 255, 0.4);
            ">12:00</span>
            <div style="
              position: absolute;
              left: 48px;
              right: 0;
              top: 24px;
              height: 2px;
              background: #ef4444;
              box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
            ">
              <div style="
                position: absolute;
                left: -6px;
                top: -4px;
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: #ef4444;
              "></div>
            </div>
          </div>

          <!-- 13:00 Slot with Task -->
          <div style="
            position: relative;
            height: 96px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          ">
            <span style="
              position: absolute;
              left: 0;
              top: 8px;
              font-size: 11px;
              color: rgba(255, 255, 255, 0.4);
            ">13:00</span>
            <div style="
              position: absolute;
              left: 48px;
              right: 0;
              top: 4px;
              height: 88px;
              background: linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(37, 99, 235, 0.25) 100%);
              border-left: 3px solid #60a5fa;
              border-radius: 6px;
              padding: 8px;
            ">
              <div style="
                font-size: 13px;
                font-weight: 600;
                color: rgba(255, 255, 255, 0.95);
                margin-bottom: 4px;
              ">Code review session</div>
              <div style="
                font-size: 11px;
                color: rgba(255, 255, 255, 0.6);
              ">13:00 - 13:30</div>
            </div>
          </div>

          <!-- 14:00 Empty Slot -->
          <div style="
            position: relative;
            height: 48px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          ">
            <span style="
              position: absolute;
              left: 0;
              top: 8px;
              font-size: 11px;
              color: rgba(255, 255, 255, 0.4);
            ">14:00</span>
          </div>

          <!-- 15:00 Slot -->
          <div style="
            position: relative;
            height: 48px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          ">
            <span style="
              position: absolute;
              left: 0;
              top: 8px;
              font-size: 11px;
              color: rgba(255, 255, 255, 0.4);
            ">15:00</span>
          </div>
        </div>
      </div>
    `, 'Calendar')
  })
}

/**
 * Canvas View - Whiteboard
 *
 * Canvas whiteboard with task nodes and groups.
 */
export const Canvas: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Mobile canvas whiteboard with scattered task nodes and groups.'
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
          radial-gradient(circle at 80% 70%, rgba(139, 92, 246, 0.05) 0%, transparent 50%),
          var(--app-background-gradient);
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
            border-radius: 8px;
            color: rgba(255, 255, 255, 0.9);
            font-size: 12px;
            font-weight: 500;
          ">+ Task</button>
          <button style="
            padding: 8px 12px;
            background: rgba(28, 25, 45, 0.85);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 8px;
            color: rgba(255, 255, 255, 0.9);
            font-size: 12px;
            font-weight: 500;
          ">+ Group</button>
          <div style="flex: 1;"></div>
          <button style="
            padding: 8px;
            background: rgba(28, 25, 45, 0.85);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 8px;
            color: rgba(255, 255, 255, 0.9);
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
            </svg>
          </button>
        </div>

        <!-- Canvas Content -->
        <div style="
          position: relative;
          height: 100%;
          padding: 60px 12px 12px 12px;
        ">
          <!-- Task Node 1 -->
          <div style="
            position: absolute;
            left: 24px;
            top: 80px;
            width: 200px;
            background: rgba(35, 32, 52, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.25);
            border-radius: 8px;
            padding: 10px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          ">
            <div style="
              font-size: 12px;
              font-weight: 600;
              color: rgba(255, 255, 255, 0.95);
              margin-bottom: 6px;
            ">Design new feature mockups</div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <span style="
                padding: 2px 6px;
                background: rgba(239, 68, 68, 0.2);
                border: 1px solid rgba(239, 68, 68, 0.5);
                border-radius: 4px;
                font-size: 9px;
                color: #f87171;
              ">High</span>
              <span style="font-size: 10px; color: rgba(255, 255, 255, 0.5);">Today</span>
            </div>
          </div>

          <!-- Group Node -->
          <div style="
            position: absolute;
            left: 150px;
            top: 200px;
            width: 220px;
            height: 160px;
            background: rgba(38, 35, 55, 0.7);
            border: 2px dashed rgba(255, 255, 255, 0.3);
            border-radius: 12px;
            padding: 8px;
          ">
            <div style="
              font-size: 11px;
              font-weight: 600;
              color: rgba(255, 255, 255, 0.7);
              margin-bottom: 8px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            ">Sprint Tasks (3)</div>

            <!-- Nested Task 1 -->
            <div style="
              background: rgba(35, 32, 52, 0.95);
              border: 1px solid rgba(255, 255, 255, 0.2);
              border-radius: 6px;
              padding: 8px;
              margin-bottom: 6px;
            ">
              <div style="
                font-size: 11px;
                font-weight: 500;
                color: rgba(255, 255, 255, 0.95);
              ">API integration</div>
            </div>

            <!-- Nested Task 2 -->
            <div style="
              background: rgba(35, 32, 52, 0.95);
              border: 1px solid rgba(255, 255, 255, 0.2);
              border-radius: 6px;
              padding: 8px;
            ">
              <div style="
                font-size: 11px;
                font-weight: 500;
                color: rgba(255, 255, 255, 0.95);
              ">Unit tests</div>
            </div>
          </div>

          <!-- Task Node 2 -->
          <div style="
            position: absolute;
            right: 24px;
            top: 120px;
            width: 180px;
            background: rgba(35, 32, 52, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.25);
            border-radius: 8px;
            padding: 10px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          ">
            <div style="
              font-size: 12px;
              font-weight: 600;
              color: rgba(255, 255, 255, 0.95);
              margin-bottom: 6px;
            ">Update documentation</div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <span style="
                padding: 2px 6px;
                background: rgba(59, 130, 246, 0.2);
                border: 1px solid rgba(59, 130, 246, 0.5);
                border-radius: 4px;
                font-size: 9px;
                color: #60a5fa;
              ">Low</span>
            </div>
          </div>

          <!-- Task Node 3 -->
          <div style="
            position: absolute;
            left: 40px;
            bottom: 100px;
            width: 190px;
            background: rgba(35, 32, 52, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.25);
            border-radius: 8px;
            padding: 10px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          ">
            <div style="
              font-size: 12px;
              font-weight: 600;
              color: rgba(255, 255, 255, 0.95);
              margin-bottom: 6px;
            ">Refactor auth module</div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <span style="
                padding: 2px 6px;
                background: rgba(249, 115, 22, 0.2);
                border: 1px solid rgba(249, 115, 22, 0.5);
                border-radius: 4px;
                font-size: 9px;
                color: #fb923c;
              ">Medium</span>
              <span style="font-size: 10px; color: rgba(255, 255, 255, 0.5);">Tomorrow</span>
            </div>
          </div>
        </div>

        <!-- Minimap -->
        <div style="
          position: absolute;
          bottom: 16px;
          right: 16px;
          width: 100px;
          height: 70px;
          background: rgba(28, 25, 45, 0.85);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          padding: 4px;
        ">
          <div style="
            width: 100%;
            height: 100%;
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
 * QuickSort View - Triage Interface
 *
 * Card-based task triage with category buttons.
 */
export const QuickSort: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Mobile QuickSort triage interface with swipeable cards.'
      }
    }
  },
  render: () => ({
    template: PWAFrame(`
      <div style="
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 16px;
        justify-content: space-between;
      ">
        <!-- Progress Bar -->
        <div style="margin-bottom: 20px;">
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
          ">
            <span style="font-size: 12px; color: rgba(255, 255, 255, 0.6);">Progress</span>
            <span style="font-size: 12px; color: rgba(255, 255, 255, 0.9); font-weight: 600;">3 / 12</span>
          </div>
          <div style="
            height: 6px;
            background: rgba(45, 40, 70, 0.5);
            border-radius: 3px;
            overflow: hidden;
          ">
            <div style="
              width: 25%;
              height: 100%;
              background: linear-gradient(90deg, rgba(78, 205, 196, 0.9), rgba(78, 205, 196, 0.7));
              box-shadow: 0 0 12px rgba(78, 205, 196, 0.5);
            "></div>
          </div>
        </div>

        <!-- Task Card -->
        <div style="
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        ">
          <div style="
            width: 100%;
            max-width: 340px;
            background: rgba(35, 32, 52, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          ">
            <div style="
              font-size: 18px;
              font-weight: 600;
              color: rgba(255, 255, 255, 0.95);
              margin-bottom: 12px;
              line-height: 1.4;
            ">Review Q4 marketing proposal</div>

            <div style="
              font-size: 13px;
              color: rgba(255, 255, 255, 0.6);
              margin-bottom: 16px;
              line-height: 1.5;
            ">Analyze the proposed budget allocation and timeline for approval.</div>

            <div style="display: flex; gap: 10px; margin-bottom: 16px;">
              <button style="
                padding: 6px 12px;
                background: rgba(249, 115, 22, 0.2);
                border: 1px solid rgba(249, 115, 22, 0.5);
                border-radius: 6px;
                color: #fb923c;
                font-size: 11px;
                font-weight: 600;
              ">Medium Priority</button>
              <button style="
                padding: 6px 12px;
                background: rgba(148, 163, 184, 0.15);
                border: 1px solid rgba(148, 163, 184, 0.3);
                border-radius: 6px;
                color: #94a3b8;
                font-size: 11px;
              ">No due date</button>
            </div>

            <div style="
              padding: 10px;
              background: rgba(45, 40, 70, 0.3);
              border-radius: 8px;
              border: 1px solid rgba(255, 255, 255, 0.08);
            ">
              <div style="
                font-size: 11px;
                color: rgba(255, 255, 255, 0.5);
                margin-bottom: 6px;
              ">Subtasks (1/3)</div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 6px;
                  font-size: 12px;
                  color: rgba(255, 255, 255, 0.7);
                ">
                  <div style="
                    width: 14px;
                    height: 14px;
                    border-radius: 3px;
                    background: rgba(78, 205, 196, 0.3);
                    border: 2px solid #4ECDC4;
                  "></div>
                  <span style="text-decoration: line-through; opacity: 0.6;">Read proposal</span>
                </div>
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 6px;
                  font-size: 12px;
                  color: rgba(255, 255, 255, 0.7);
                ">
                  <div style="
                    width: 14px;
                    height: 14px;
                    border-radius: 3px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                  "></div>
                  <span>Check budget</span>
                </div>
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 6px;
                  font-size: 12px;
                  color: rgba(255, 255, 255, 0.7);
                ">
                  <div style="
                    width: 14px;
                    height: 14px;
                    border-radius: 3px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                  "></div>
                  <span>Discuss with team</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Category Buttons -->
        <div style="margin-bottom: 16px;">
          <div style="
            font-size: 11px;
            color: rgba(255, 255, 255, 0.5);
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          ">Move to:</div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <button style="
              padding: 8px 14px;
              background: rgba(59, 130, 246, 0.15);
              border: 1px solid rgba(59, 130, 246, 0.4);
              border-radius: 8px;
              color: #60a5fa;
              font-size: 12px;
              font-weight: 500;
            ">Work</button>
            <button style="
              padding: 8px 14px;
              background: rgba(34, 197, 94, 0.15);
              border: 1px solid rgba(34, 197, 94, 0.4);
              border-radius: 8px;
              color: #4ade80;
              font-size: 12px;
              font-weight: 500;
            ">Personal</button>
            <button style="
              padding: 8px 14px;
              background: rgba(245, 158, 11, 0.15);
              border: 1px solid rgba(245, 158, 11, 0.4);
              border-radius: 8px;
              color: #fbbf24;
              font-size: 12px;
              font-weight: 500;
            ">Home</button>
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 10px;">
          <button style="
            flex: 1;
            padding: 12px;
            background: rgba(45, 40, 70, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 10px;
            color: rgba(255, 255, 255, 0.7);
            font-size: 13px;
            font-weight: 500;
          ">Skip</button>
          <button style="
            flex: 2;
            padding: 12px;
            background: linear-gradient(135deg, rgba(78, 205, 196, 0.2), rgba(78, 205, 196, 0.15));
            border: 1px solid rgba(78, 205, 196, 0.5);
            border-radius: 10px;
            color: #4ECDC4;
            font-size: 13px;
            font-weight: 600;
            box-shadow: 0 0 16px rgba(78, 205, 196, 0.2);
          ">Done</button>
        </div>
      </div>
    `, 'QuickSort')
  })
}

/**
 * Focus View - Timer Centric
 *
 * Placeholder stub for focus view.
 */
export const Focus: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Mobile focus view (stub - timer-centric interface).'
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
          <div style="
            font-size: 48px;
            margin-bottom: 16px;
          ">⏱️</div>
          <div style="
            font-size: 20px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.95);
            margin-bottom: 8px;
          ">Focus View</div>
          <div style="
            font-size: 13px;
            color: rgba(255, 255, 255, 0.5);
          ">Timer-centric productivity interface</div>
        </div>
      </div>
    `, 'Focus')
  })
}

/**
 * AllTasks View - Task Table
 *
 * Compact task list/table view.
 */
export const AllTasks: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Mobile all tasks list with filters and sorting.'
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
              border-radius: 6px;
              color: #4ECDC4;
              font-size: 11px;
              font-weight: 600;
            ">All</button>
            <button style="
              padding: 6px 12px;
              background: transparent;
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 6px;
              color: rgba(255, 255, 255, 0.5);
              font-size: 11px;
            ">Today</button>
            <button style="
              padding: 6px 12px;
              background: transparent;
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 6px;
              color: rgba(255, 255, 255, 0.5);
              font-size: 11px;
            ">Overdue</button>
          </div>
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <span style="font-size: 12px; color: rgba(255, 255, 255, 0.6);">
              12 tasks
            </span>
            <button style="
              padding: 4px 8px;
              background: rgba(45, 40, 70, 0.3);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 4px;
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
            border-radius: 8px;
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
                font-size: 13px;
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
            border-radius: 8px;
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
                font-size: 13px;
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

          <!-- Task Row 3 -->
          <div style="
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px;
            background: rgba(35, 32, 52, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 8px;
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
                font-size: 13px;
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
            border-radius: 8px;
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
                font-size: 13px;
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
            border-radius: 8px;
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
                font-size: 13px;
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
    `, 'All Tasks')
  })
}

/**
 * AI Chat View - Full-Screen Chat
 *
 * AI assistant chat interface.
 */
export const AIChat: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Mobile AI chat interface with messages and quick actions.'
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
              border-radius: 12px 12px 4px 12px;
            ">
              <div style="
                font-size: 13px;
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
              border-radius: 12px 12px 12px 4px;
            ">
              <div style="
                font-size: 13px;
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
              border-radius: 12px 12px 4px 12px;
            ">
              <div style="
                font-size: 13px;
                color: rgba(255, 255, 255, 0.95);
                line-height: 1.5;
              ">Plan my day</div>
            </div>
          </div>

          <!-- AI Message (typing indicator) -->
          <div style="
            display: flex;
            justify-content: flex-start;
          ">
            <div style="
              padding: 10px 14px;
              background: rgba(35, 32, 52, 0.8);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 12px 12px 12px 4px;
            ">
              <div style="display: flex; gap: 4px; align-items: center;">
                <div style="
                  width: 6px;
                  height: 6px;
                  border-radius: 50%;
                  background: rgba(78, 205, 196, 0.6);
                  animation: pulse 1.4s ease-in-out infinite;
                "></div>
                <div style="
                  width: 6px;
                  height: 6px;
                  border-radius: 50%;
                  background: rgba(78, 205, 196, 0.6);
                  animation: pulse 1.4s ease-in-out 0.2s infinite;
                "></div>
                <div style="
                  width: 6px;
                  height: 6px;
                  border-radius: 50%;
                  background: rgba(78, 205, 196, 0.6);
                  animation: pulse 1.4s ease-in-out 0.4s infinite;
                "></div>
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
              border-radius: 16px;
              color: rgba(255, 255, 255, 0.8);
              font-size: 11px;
              white-space: nowrap;
            ">Plan my day</button>
            <button style="
              padding: 6px 12px;
              background: rgba(45, 40, 70, 0.5);
              border: 1px solid rgba(255, 255, 255, 0.15);
              border-radius: 16px;
              color: rgba(255, 255, 255, 0.8);
              font-size: 11px;
              white-space: nowrap;
            ">What's overdue?</button>
            <button style="
              padding: 6px 12px;
              background: rgba(45, 40, 70, 0.5);
              border: 1px solid rgba(255, 255, 255, 0.15);
              border-radius: 16px;
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
                font-size: 13px;
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
              font-size: 13px;
            ">Send</button>
          </div>
        </div>
      </div>

      <style>
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      </style>
    `, 'AI Chat')
  })
}

/**
 * Cyberflow View - Gamification Dashboard
 *
 * Cyberpunk-themed gamification hub.
 */
export const Cyberflow: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Mobile Cyberflow gamification dashboard with neon cyberpunk theme.'
      }
    }
  },
  render: () => ({
    template: PWAFrame(`
      <div style="
        height: 100%;
        overflow-y: auto;
        background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
        padding: 16px;
      ">
        <!-- Header -->
        <div style="
          text-align: center;
          margin-bottom: 20px;
        ">
          <span style="
            font-family: 'Orbitron', monospace;
            font-size: 22px;
            font-weight: 900;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #00ffdd;
            text-shadow: 0 0 20px rgba(0, 255, 221, 0.5);
          ">CYBERFLOW</span>
        </div>

        <!-- XP Bar -->
        <div style="
          background: rgba(28, 25, 45, 0.8);
          border: 1px solid rgba(0, 255, 221, 0.3);
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 16px;
        ">
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
          ">
            <span style="
              font-size: 12px;
              color: rgba(255, 255, 255, 0.7);
              font-weight: 600;
              letter-spacing: 0.05em;
            ">LEVEL 12</span>
            <span style="
              font-size: 13px;
              color: #00ffdd;
              font-weight: 700;
            ">2,480 / 3,000 XP</span>
          </div>
          <div style="
            height: 8px;
            background: rgba(45, 40, 70, 0.5);
            border-radius: 4px;
            overflow: hidden;
          ">
            <div style="
              width: 82%;
              height: 100%;
              background: linear-gradient(90deg, #00ffdd, #ff00ff);
              box-shadow: 0 0 12px rgba(0, 255, 221, 0.6);
            "></div>
          </div>
        </div>

        <!-- Tab Navigation -->
        <div style="
          display: flex;
          gap: 6px;
          overflow-x: auto;
          margin-bottom: 16px;
          padding-bottom: 4px;
        ">
          <button style="
            padding: 8px 14px;
            background: linear-gradient(135deg, rgba(0, 255, 221, 0.2), rgba(0, 255, 221, 0.1));
            border: 1px solid rgba(0, 255, 221, 0.5);
            border-radius: 8px;
            color: #00ffdd;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            white-space: nowrap;
          ">Overview</button>
          <button style="
            padding: 8px 14px;
            background: rgba(45, 40, 70, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 8px;
            color: rgba(255, 255, 255, 0.6);
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            white-space: nowrap;
          ">Missions</button>
          <button style="
            padding: 8px 14px;
            background: rgba(45, 40, 70, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 8px;
            color: rgba(255, 255, 255, 0.6);
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            white-space: nowrap;
          ">Boss</button>
          <button style="
            padding: 8px 14px;
            background: rgba(45, 40, 70, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 8px;
            color: rgba(255, 255, 255, 0.6);
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            white-space: nowrap;
          ">Upgrades</button>
          <button style="
            padding: 8px 14px;
            background: rgba(45, 40, 70, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 8px;
            color: rgba(255, 255, 255, 0.6);
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            white-space: nowrap;
          ">Arena</button>
        </div>

        <!-- Stat Cards -->
        <div style="
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 16px;
        ">
          <!-- Streak Card -->
          <div style="
            background: rgba(28, 25, 45, 0.8);
            border: 1px solid rgba(255, 107, 53, 0.4);
            border-radius: 10px;
            padding: 12px;
          ">
            <div style="
              font-size: 10px;
              color: rgba(255, 255, 255, 0.5);
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 6px;
            ">Streak</div>
            <div style="
              font-size: 24px;
              font-weight: 700;
              color: #ff6b35;
              text-shadow: 0 0 12px rgba(255, 107, 53, 0.5);
            ">7🔥</div>
          </div>

          <!-- Tasks Today Card -->
          <div style="
            background: rgba(28, 25, 45, 0.8);
            border: 1px solid rgba(78, 205, 196, 0.4);
            border-radius: 10px;
            padding: 12px;
          ">
            <div style="
              font-size: 10px;
              color: rgba(255, 255, 255, 0.5);
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 6px;
            ">Tasks Today</div>
            <div style="
              font-size: 24px;
              font-weight: 700;
              color: #4ECDC4;
              text-shadow: 0 0 12px rgba(78, 205, 196, 0.5);
            ">12/15</div>
          </div>

          <!-- Achievements Card -->
          <div style="
            background: rgba(28, 25, 45, 0.8);
            border: 1px solid rgba(255, 215, 0, 0.4);
            border-radius: 10px;
            padding: 12px;
          ">
            <div style="
              font-size: 10px;
              color: rgba(255, 255, 255, 0.5);
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 6px;
            ">Achievements</div>
            <div style="
              font-size: 24px;
              font-weight: 700;
              color: #ffd700;
              text-shadow: 0 0 12px rgba(255, 215, 0, 0.5);
            ">24/50</div>
          </div>

          <!-- Rank Card -->
          <div style="
            background: rgba(28, 25, 45, 0.8);
            border: 1px solid rgba(255, 0, 255, 0.4);
            border-radius: 10px;
            padding: 12px;
          ">
            <div style="
              font-size: 10px;
              color: rgba(255, 255, 255, 0.5);
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 6px;
            ">Rank</div>
            <div style="
              font-size: 20px;
              font-weight: 700;
              color: #ff00ff;
              text-shadow: 0 0 12px rgba(255, 0, 255, 0.5);
            ">Elite</div>
          </div>
        </div>

        <!-- Recent Achievements -->
        <div style="
          background: rgba(28, 25, 45, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          padding: 14px;
        ">
          <div style="
            font-size: 11px;
            color: rgba(255, 255, 255, 0.7);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 12px;
            font-weight: 600;
          ">Recent Unlocks</div>

          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 10px;
              background: rgba(45, 40, 70, 0.3);
              border-radius: 8px;
            ">
              <div style="
                width: 36px;
                height: 36px;
                background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 215, 0, 0.1));
                border: 2px solid rgba(255, 215, 0, 0.5);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
              ">🏆</div>
              <div style="flex: 1;">
                <div style="
                  font-size: 12px;
                  font-weight: 600;
                  color: rgba(255, 255, 255, 0.95);
                  margin-bottom: 2px;
                ">Early Bird</div>
                <div style="
                  font-size: 10px;
                  color: rgba(255, 255, 255, 0.5);
                ">Complete 5 tasks before noon</div>
              </div>
              <div style="
                font-size: 11px;
                color: #ffd700;
                font-weight: 700;
              ">+200 XP</div>
            </div>

            <div style="
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 10px;
              background: rgba(45, 40, 70, 0.3);
              border-radius: 8px;
            ">
              <div style="
                width: 36px;
                height: 36px;
                background: linear-gradient(135deg, rgba(192, 192, 192, 0.2), rgba(192, 192, 192, 0.1));
                border: 2px solid rgba(192, 192, 192, 0.5);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
              ">🔥</div>
              <div style="flex: 1;">
                <div style="
                  font-size: 12px;
                  font-weight: 600;
                  color: rgba(255, 255, 255, 0.95);
                  margin-bottom: 2px;
                ">7-Day Streak</div>
                <div style="
                  font-size: 10px;
                  color: rgba(255, 255, 255, 0.5);
                ">Complete tasks for 7 days straight</div>
              </div>
              <div style="
                font-size: 11px;
                color: #c0c0c0;
                font-weight: 700;
              ">+150 XP</div>
            </div>
          </div>
        </div>
      </div>
    `, 'Cyberflow')
  })
}

/**
 * Performance View - Benchmark Dashboard
 *
 * Performance stats and benchmark results.
 */
export const Performance: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Mobile performance dashboard with benchmark stats and grade.'
      }
    }
  },
  render: () => ({
    template: PWAFrame(`
      <div style="
        height: 100%;
        overflow-y: auto;
        padding: 16px;
      ">
        <!-- Grade Card -->
        <div style="
          background: linear-gradient(135deg, rgba(78, 205, 196, 0.15), rgba(78, 205, 196, 0.08));
          border: 1px solid rgba(78, 205, 196, 0.3);
          border-radius: 16px;
          padding: 20px;
          text-align: center;
          margin-bottom: 16px;
        ">
          <div style="
            font-size: 56px;
            font-weight: 900;
            color: #4ECDC4;
            text-shadow: 0 0 24px rgba(78, 205, 196, 0.5);
            margin-bottom: 8px;
            line-height: 1;
          ">A+</div>
          <div style="
            font-size: 14px;
            color: rgba(255, 255, 255, 0.8);
            font-weight: 600;
          ">Excellent Performance</div>
        </div>

        <!-- Summary Stats -->
        <div style="
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 16px;
        ">
          <div style="
            background: rgba(35, 32, 52, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 12px;
            text-align: center;
          ">
            <div style="
              font-size: 10px;
              color: rgba(255, 255, 255, 0.5);
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 6px;
            ">Tasks Completed</div>
            <div style="
              font-size: 22px;
              font-weight: 700;
              color: rgba(255, 255, 255, 0.95);
            ">127</div>
          </div>

          <div style="
            background: rgba(35, 32, 52, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 12px;
            text-align: center;
          ">
            <div style="
              font-size: 10px;
              color: rgba(255, 255, 255, 0.5);
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 6px;
            ">Focus Hours</div>
            <div style="
              font-size: 22px;
              font-weight: 700;
              color: rgba(255, 255, 255, 0.95);
            ">42.5</div>
          </div>

          <div style="
            background: rgba(35, 32, 52, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 12px;
            text-align: center;
          ">
            <div style="
              font-size: 10px;
              color: rgba(255, 255, 255, 0.5);
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 6px;
            ">Avg Completion</div>
            <div style="
              font-size: 22px;
              font-weight: 700;
              color: rgba(255, 255, 255, 0.95);
            ">94%</div>
          </div>

          <div style="
            background: rgba(35, 32, 52, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 12px;
            text-align: center;
          ">
            <div style="
              font-size: 10px;
              color: rgba(255, 255, 255, 0.5);
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 6px;
            ">Streak</div>
            <div style="
              font-size: 22px;
              font-weight: 700;
              color: rgba(255, 255, 255, 0.95);
            ">7 days</div>
          </div>
        </div>

        <!-- Benchmark Results -->
        <div style="
          background: rgba(35, 32, 52, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 16px;
        ">
          <div style="
            font-size: 12px;
            color: rgba(255, 255, 255, 0.7);
            font-weight: 600;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          ">Benchmark Results</div>

          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding-bottom: 8px;
              border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            ">
              <span style="font-size: 12px; color: rgba(255, 255, 255, 0.8);">Task Creation</span>
              <span style="
                font-size: 12px;
                font-weight: 600;
                color: #4ECDC4;
              ">0.8ms</span>
            </div>

            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding-bottom: 8px;
              border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            ">
              <span style="font-size: 12px; color: rgba(255, 255, 255, 0.8);">Board Render</span>
              <span style="
                font-size: 12px;
                font-weight: 600;
                color: #4ECDC4;
              ">12.3ms</span>
            </div>

            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding-bottom: 8px;
              border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            ">
              <span style="font-size: 12px; color: rgba(255, 255, 255, 0.8);">Calendar Render</span>
              <span style="
                font-size: 12px;
                font-weight: 600;
                color: #4ECDC4;
              ">18.7ms</span>
            </div>

            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
            ">
              <span style="font-size: 12px; color: rgba(255, 255, 255, 0.8);">Supabase Sync</span>
              <span style="
                font-size: 12px;
                font-weight: 600;
                color: #4ECDC4;
              ">45.2ms</span>
            </div>
          </div>
        </div>

        <!-- Recommendations -->
        <div style="
          background: rgba(35, 32, 52, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 14px;
        ">
          <div style="
            font-size: 12px;
            color: rgba(255, 255, 255, 0.7);
            font-weight: 600;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          ">Recommendations</div>

          <ul style="
            margin: 0;
            padding-left: 16px;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.8);
            line-height: 1.6;
          ">
            <li style="margin-bottom: 6px;">All systems optimal</li>
            <li style="margin-bottom: 6px;">Continue current workflow</li>
            <li>Great job on 7-day streak!</li>
          </ul>
        </div>
      </div>
    `, 'Performance')
  })
}
