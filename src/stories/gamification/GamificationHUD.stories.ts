import type { Meta, StoryObj } from '@storybook/vue3'
import GamificationHUD from '@/components/gamification/GamificationHUD.vue'

const meta = {
  component: GamificationHUD,
  title: '🎮 Gamification/GamificationHUD',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof GamificationHUD>

export default meta
type Story = StoryObj<typeof meta>

// Documentation (store-dependent component)
export const Documentation: Story = {
  render: () => ({
    template: `
      <div style="padding: var(--space-10); background: var(--overlay-component-bg); border-radius: var(--radius-lg); min-width: 800px;">
        <h1 style="margin: 0 0 var(--space-6) 0; color: var(--text-primary); font-size: var(--text-2xl);">GamificationHUD Component</h1>

        <div style="display: flex; flex-direction: column; gap: var(--space-6);">
          <div>
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--text-base);">Purpose</h3>
            <p style="margin: 0; color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.6;">
              RPG-styled header HUD that replaces inline gamification widgets with a unified, cyberflow-themed display. Adapts to intensity level (minimal/moderate/intense).
            </p>
          </div>

          <div>
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--text-base);">Intensity Modes</h3>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md);">
              <ul style="margin: 0; padding-left: var(--space-5); color: var(--text-tertiary); font-size: var(--text-sm); line-height: 1.8;">
                <li><strong style="color: var(--text-secondary);">Minimal:</strong> "Lv.N" text only (no container, no decoration)</li>
                <li><strong style="color: var(--text-secondary);">Moderate:</strong> Corner-cut container with level + XP bar + streak + challenge pips</li>
                <li><strong style="color: var(--text-secondary);">Intense:</strong> Same + always-on glow + XP shine animation + narrative micro-text</li>
              </ul>
            </div>
          </div>

          <div>
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--text-base);">Features</h3>
            <ul style="margin: 0; padding-left: var(--space-5); color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.8;">
              <li>Corner-cut container (cyberflow-design-system §6)</li>
              <li>Level badge with size="sm"</li>
              <li>XP bar (80px wide) with percentage or X/Y display</li>
              <li>Streak counter with flame icon</li>
              <li>Challenge pips or active mission label</li>
              <li>Expand chevron (rotates 180° when panel open)</li>
              <li>Narrative micro-text row (intense only)</li>
              <li>Per-widget tooltips (GamificationTooltipWrapper)</li>
              <li>Auth CTA when not authenticated</li>
              <li>Respects prefers-reduced-motion</li>
            </ul>
          </div>

          <div>
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--text-base);">Typography</h3>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md);">
              <ul style="margin: 0; padding-left: var(--space-5); color: var(--text-tertiary); font-size: var(--text-sm); line-height: 1.8;">
                <li><strong style="color: var(--text-secondary);">Font:</strong> Space Mono (--font-cyber-data)</li>
                <li><strong style="color: var(--text-secondary);">Labels:</strong> 11px, 400 weight, uppercase, 0.05em letter-spacing</li>
                <li><strong style="color: var(--text-secondary);">Values:</strong> 14px, 700 weight, 0.02em letter-spacing</li>
                <li><strong style="color: var(--text-secondary);">Color:</strong> rgba(0, 240, 255, 0.9) (--cf-cyan)</li>
              </ul>
            </div>
          </div>

          <div>
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--text-base);">Design Tokens</h3>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md); font-family: monospace; font-size: var(--text-xs); color: var(--text-tertiary);">
              <pre style="margin: 0; white-space: pre-wrap;">--cf-cyan: #00f0ff           // Primary accent color
--cf-cyan-50: rgba(0, 240, 255, 0.5)  // Muted variant
--cf-cyan-20: rgba(0, 240, 255, 0.2)  // Border color
--xp-bar-gradient: linear-gradient(90deg, rgba(0, 240, 255, 0.9), rgba(255, 0, 153, 0.9))
--streak-flame-color: rgb(255, 107, 53)
--font-cyber-data: 'Space Mono', monospace</pre>
            </div>
          </div>

          <div>
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--text-base);">Props & Events</h3>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md); font-family: monospace; font-size: var(--text-xs); color: var(--text-tertiary);">
              <pre style="margin: 0; white-space: pre-wrap;">// Props
panelOpen: boolean  // Panel open state (affects chevron + tooltips)

// Events
@togglePanel  // Emitted when HUD is clicked</pre>
            </div>
          </div>

          <div>
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--text-base);">Sections (Moderate+)</h3>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md);">
              <ol style="margin: 0; padding-left: var(--space-5); color: var(--text-tertiary); font-size: var(--text-sm); line-height: 1.8;">
                <li><strong>Level:</strong> LevelBadge (sm) + "LV" label + level number</li>
                <li><strong>XP:</strong> "XP" label + progress bar + percentage or X/Y</li>
                <li><strong>Streak:</strong> Flame icon + streak days</li>
                <li><strong>Mission/Challenges:</strong> First active daily or ChallengePips</li>
                <li><strong>Chevron:</strong> Expand indicator</li>
                <li><strong>Narrative:</strong> Level-based quote (intense only)</li>
              </ol>
            </div>
          </div>

          <div style="padding: var(--space-4); background: rgba(var(--neon-cyan), 0.05); border-radius: var(--radius-md); border: 1px solid rgba(var(--neon-cyan), 0.15);">
            <h4 style="margin: 0 0 var(--space-2) 0; color: var(--text-primary); font-size: var(--text-sm); font-weight: 600;">Usage Example</h4>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md); font-family: monospace; font-size: var(--text-xs); color: var(--text-tertiary);">
              <pre style="margin: 0; white-space: pre-wrap;">&lt;GamificationHUD
  :panel-open="isPanelOpen"
  @toggle-panel="isPanelOpen = !isPanelOpen"
/&gt;</pre>
            </div>
          </div>

          <div>
            <h3 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--text-base);">Corner-Cut Container</h3>
            <p style="margin: 0 0 var(--space-2) 0; color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.6;">
              Uses clip-path polygon with 8px diagonal cuts at top-left and bottom-right corners. Background is rgba(18, 18, 26, 0.85) with backdrop-filter blur(12px).
            </p>
            <div style="padding: var(--space-3); background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md); font-family: monospace; font-size: var(--text-xs); color: var(--text-tertiary);">
              <pre style="margin: 0; white-space: pre-wrap;">clip-path: polygon(
  8px 0, 100% 0,
  100% calc(100% - 8px),
  calc(100% - 8px) 100%,
  0 100%, 0 8px
);</pre>
            </div>
          </div>

          <div style="padding: var(--space-4); background: rgba(var(--neon-magenta), 0.05); border-radius: var(--radius-md); border: 1px solid rgba(var(--neon-magenta), 0.15);">
            <p style="margin: 0; color: var(--text-tertiary); font-size: var(--text-xs); line-height: 1.6;">
              <strong style="color: var(--text-secondary);">Store Dependency:</strong> Reads from gamificationStore (currentLevel, levelInfo, streakInfo), challengesStore (hasActiveChallenges, activeDailies), authStore (isAuthenticated), settingsStore (gamificationEnabled), uiStore (openAuthModal). Uses useCyberflowTheme() for intensity rendering.
            </p>
          </div>
        </div>
      </div>
    `,
  }),
}
