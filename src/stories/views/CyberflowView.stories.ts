import type { Meta, StoryObj } from '@storybook/vue3'

/**
 * CyberflowView - Gamification Hub (FEATURE-1118)
 *
 * Cyberpunk-themed gamification interface with:
 * - Overview dashboard
 * - Missions (daily/weekly/boss challenges)
 * - Boss fight interface
 * - Skill tree (upgrades)
 * - Achievements
 * - Arena (PvP challenges - TASK-1301)
 *
 * **Features:**
 * - Tab-based navigation
 * - XP and leveling system
 * - Achievement tracking
 * - Cosmetic shop
 * - Character drawer
 * - Neon cyberpunk design tokens
 *
 * **Store Dependencies:**
 * - gamificationStore: XP, achievements, shop
 * - taskStore: Task completion for XP
 *
 * **Design:**
 * - Orbitron/Rajdhani fonts
 * - Neon cyan/magenta color scheme
 * - augmented-ui borders
 * - Glowing effects
 */
const meta: Meta = {
  title: '✨ Views/CyberflowView',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `Cyberpunk gamification hub with missions, achievements, and RPG elements.

**Tabs:**
- Overview: Dashboard with quick stats
- Missions: Daily/weekly/boss challenges
- Boss: Boss fight interface
- Upgrades: Skill tree
- Achievements: Achievement gallery
- Arena: PvP challenges (TASK-1301)

**Design Theme:**
- Neon cyan/magenta color palette
- augmented-ui clipped borders
- Glowing text effects
- Monospace fonts for code aesthetic

**Note:** Full functionality requires gamificationStore setup.`
      }
    }
  }
}

export default meta
type Story = StoryObj

/**
 * Overview Dashboard
 *
 * Shows the main dashboard with stats and navigation cards.
 */
export const OverviewDashboard: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Overview dashboard with XP, level, and navigation cards to other sections.'
      }
    }
  },
  render: () => ({
    template: `
      <div style="
        min-height: 100vh;
        background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
        color: #e2e8f0;
        padding: var(--space-6);
        font-family: 'Rajdhani', sans-serif;
      ">
        <!-- Header -->
        <div style="
          display: flex;
          align-items: center;
          gap: var(--space-3);
          margin-bottom: var(--space-6);
        ">
          <span style="
            font-family: 'Orbitron', sans-serif;
            font-size: var(--text-2xl);
            font-weight: 900;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #00ffdd;
            text-shadow: 0 0 20px rgba(0, 255, 221, 0.5);
            padding: var(--space-2) var(--space-4);
            background: rgba(10, 10, 15, 0.8);
            border: 1px solid rgba(0, 255, 221, 0.4);
            clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
          ">CYBERFLOW</span>
          <span style="
            font-size: var(--text-xs);
            letter-spacing: 0.1em;
            color: rgba(0, 255, 136, 0.7);
          ">// ONLINE</span>
        </div>

        <!-- XP Bar -->
        <div style="
          background: rgba(10, 10, 15, 0.6);
          border: 1px solid rgba(0, 255, 221, 0.3);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          margin-bottom: var(--space-6);
        ">
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: var(--space-2);
          ">
            <span style="
              font-size: var(--text-sm);
              color: #00ffdd;
              font-weight: 700;
            ">LEVEL 12</span>
            <span style="
              font-size: var(--text-sm);
              color: rgba(255, 255, 255, 0.6);
            ">2,450 / 3,000 XP</span>
          </div>
          <div style="
            height: 12px;
            background: rgba(0, 0, 0, 0.5);
            border-radius: var(--radius-full);
            overflow: hidden;
            position: relative;
          ">
            <div style="
              width: 82%;
              height: 100%;
              background: linear-gradient(90deg, #00ffdd, #00ff88);
              box-shadow: 0 0 16px rgba(0, 255, 221, 0.6);
            "></div>
          </div>
        </div>

        <!-- Navigation Cards -->
        <div style="
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: var(--space-4);
        ">
          <!-- Missions Card -->
          <div style="
            background: linear-gradient(135deg, rgba(0, 255, 221, 0.05), rgba(0, 255, 136, 0.05));
            border: 1px solid rgba(0, 255, 221, 0.3);
            border-radius: var(--radius-lg);
            padding: var(--space-5);
            cursor: pointer;
            transition: all 0.3s;
          ">
            <div style="
              font-size: var(--text-3xl);
              margin-bottom: var(--space-2);
            ">🎯</div>
            <div style="
              font-size: var(--text-xl);
              font-weight: 700;
              color: #00ffdd;
              margin-bottom: var(--space-1);
            ">MISSIONS</div>
            <div style="
              font-size: var(--text-sm);
              color: rgba(255, 255, 255, 0.6);
            ">Daily & weekly challenges</div>
          </div>

          <!-- Achievements Card -->
          <div style="
            background: linear-gradient(135deg, rgba(139, 92, 246, 0.05), rgba(255, 0, 255, 0.05));
            border: 1px solid rgba(139, 92, 246, 0.3);
            border-radius: var(--radius-lg);
            padding: var(--space-5);
            cursor: pointer;
          ">
            <div style="
              font-size: var(--text-3xl);
              margin-bottom: var(--space-2);
            ">🏆</div>
            <div style="
              font-size: var(--text-xl);
              font-weight: 700;
              color: #ff00ff;
              margin-bottom: var(--space-1);
            ">ACHIEVEMENTS</div>
            <div style="
              font-size: var(--text-sm);
              color: rgba(255, 255, 255, 0.6);
            ">24 / 50 unlocked</div>
          </div>

          <!-- Upgrades Card -->
          <div style="
            background: linear-gradient(135deg, rgba(251, 146, 60, 0.05), rgba(234, 179, 8, 0.05));
            border: 1px solid rgba(251, 146, 60, 0.3);
            border-radius: var(--radius-lg);
            padding: var(--space-5);
            cursor: pointer;
          ">
            <div style="
              font-size: var(--text-3xl);
              margin-bottom: var(--space-2);
            ">⚡</div>
            <div style="
              font-size: var(--text-xl);
              font-weight: 700;
              color: #fb923c;
              margin-bottom: var(--space-1);
            ">UPGRADES</div>
            <div style="
              font-size: var(--text-sm);
              color: rgba(255, 255, 255, 0.6);
            ">Skill tree progression</div>
          </div>

          <!-- Arena Card -->
          <div style="
            background: linear-gradient(135deg, rgba(239, 68, 68, 0.05), rgba(220, 38, 38, 0.05));
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: var(--radius-lg);
            padding: var(--space-5);
            cursor: pointer;
          ">
            <div style="
              font-size: var(--text-3xl);
              margin-bottom: var(--space-2);
            ">⚔️</div>
            <div style="
              font-size: var(--text-xl);
              font-weight: 700;
              color: #ef4444;
              margin-bottom: var(--space-1);
            ">ARENA</div>
            <div style="
              font-size: var(--text-sm);
              color: rgba(255, 255, 255, 0.6);
            ">PvP challenges</div>
          </div>
        </div>
      </div>
    `
  })
}
