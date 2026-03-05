import type { Meta, StoryObj } from '@storybook/vue3'

/**
 * QuickSortStatCard — Tauri Parity showcase
 *
 * The `.stat-card` is defined inline in QuickSortView.vue (not a standalone component),
 * so this story replicates the markup + CSS inline to demonstrate the
 * backdrop-filter blur vs Tauri opaque rendering.
 *
 * CSS (from QuickSortView.vue, lines ~1252-1281):
 *   .stat-card {
 *     display: flex; flex-direction: column; align-items: center;
 *     gap: var(--space-2); padding: var(--space-5) var(--space-4);
 *     background: var(--glass-bg-medium); border: 1px solid var(--glass-border);
 *     border-radius: var(--radius-lg); backdrop-filter: blur(10px);
 *   }
 *   .stat-value  { font-size: var(--text-3xl); font-weight: var(--font-bold); color: var(--text-primary); }
 *   .stat-label  { font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
 *   .streak-card { background: var(--orange-bg-light); border-color: var(--danger-border-medium); }
 */
const meta = {
  title: '🖥️ Tauri Parity/QuickSort Stat Card',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Replicates the `.stat-card` grid from QuickSortView session-complete screen. Cards use `backdrop-filter: blur(10px)` + `var(--glass-bg-medium)`. Toggle Tauri Mode in the toolbar — in Browser mode the blobs behind each card should be visible; in Tauri mode each card becomes fully opaque via the `--glass-bg-medium` token override.',
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

// Inline style objects that mirror the QuickSortView scoped CSS
const statCardStyle = `
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-5) var(--space-4);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  min-width: 120px;
`

const streakCardStyle = `
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-5) var(--space-4);
  background: var(--orange-bg-light);
  border: 1px solid var(--danger-border-medium);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  min-width: 120px;
`

const statValueStyle = `
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  line-height: var(--leading-none);
`

const statLabelStyle = `
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
`

export const Default: Story = {
  render: () => ({
    template: `
      <div style="
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: var(--app-background-gradient, var(--color-base-950));
        padding: var(--space-10);
        position: relative;
        overflow: hidden;
      ">

        <!-- Colourful background blobs so backdrop-filter blur is visible -->
        <div style="position: absolute; inset: 0; pointer-events: none; overflow: hidden;">
          <div style="
            position: absolute; top: 15%; left: 10%;
            width: 350px; height: 350px; border-radius: 50%;
            background: radial-gradient(circle, rgba(78,205,196,0.35) 0%, transparent 70%);
            filter: blur(40px);
          "></div>
          <div style="
            position: absolute; top: 50%; right: 5%;
            width: 280px; height: 280px; border-radius: 50%;
            background: radial-gradient(circle, rgba(168,85,247,0.3) 0%, transparent 70%);
            filter: blur(50px);
          "></div>
          <div style="
            position: absolute; bottom: 20%; left: 35%;
            width: 300px; height: 300px; border-radius: 50%;
            background: radial-gradient(circle, rgba(251,146,60,0.25) 0%, transparent 70%);
            filter: blur(45px);
          "></div>
        </div>

        <!-- Session complete heading (matches QuickSortView) -->
        <div style="
          position: relative;
          z-index: 1;
          text-align: center;
          margin-bottom: var(--space-8);
        ">
          <div style="font-size: var(--text-4xl); margin-bottom: var(--space-4);">🎉</div>
          <h2 style="
            font-size: var(--text-2xl);
            font-weight: var(--font-bold);
            color: var(--text-primary);
            margin: 0 0 var(--space-2) 0;
          ">All tasks sorted!</h2>
          <p style="
            font-size: var(--text-sm);
            color: var(--text-muted);
            margin: 0;
          ">Session complete — here are your stats</p>
        </div>

        <!-- Stat card grid (matches .session-stats layout) -->
        <div style="
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: var(--space-4);
          width: 100%;
          max-width: 600px;
        ">
          <div style="${statCardStyle}">
            <span style="${statValueStyle}">24</span>
            <span style="${statLabelStyle}">Tasks Sorted</span>
          </div>

          <div style="${statCardStyle}">
            <span style="${statValueStyle}">4:32</span>
            <span style="${statLabelStyle}">Time Taken</span>
          </div>

          <div style="${statCardStyle}">
            <span style="${statValueStyle}">5.3</span>
            <span style="${statLabelStyle}">Tasks/Min</span>
          </div>

          <div style="${streakCardStyle}">
            <span style="${statValueStyle}">🔥 7</span>
            <span style="${statLabelStyle}">Day Streak</span>
          </div>
        </div>

        <!-- Notes -->
        <div style="
          position: relative;
          z-index: 1;
          margin-top: var(--space-8);
          padding: var(--space-4) var(--space-5);
          background: var(--glass-bg-soft);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          max-width: 480px;
          width: 100%;
        ">
          <p style="
            font-size: var(--text-xs);
            color: var(--text-tertiary);
            margin: 0;
            line-height: var(--leading-relaxed);
            text-align: center;
          ">
            Cards use <code style="font-family: var(--font-mono, monospace);">var(--glass-bg-medium)</code>
            + <code style="font-family: var(--font-mono, monospace);">backdrop-filter: blur(10px)</code>.
            The streak card uses <code style="font-family: var(--font-mono, monospace);">var(--orange-bg-light)</code>.
            Toggle Tauri Mode to see the opaque fallback.
          </p>
        </div>
      </div>
    `,
  }),
}

export const EmptySession: Story = {
  render: () => ({
    template: `
      <div style="
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--app-background-gradient, var(--color-base-950));
        padding: var(--space-10);
        position: relative;
        overflow: hidden;
      ">
        <!-- Background blobs -->
        <div style="position: absolute; inset: 0; pointer-events: none; overflow: hidden;">
          <div style="
            position: absolute; top: 25%; left: 20%;
            width: 400px; height: 400px; border-radius: 50%;
            background: radial-gradient(circle, rgba(78,205,196,0.3) 0%, transparent 70%);
            filter: blur(50px);
          "></div>
        </div>

        <div style="
          position: relative;
          z-index: 1;
          text-align: center;
        ">
          <p style="
            font-size: var(--text-sm);
            color: var(--text-muted);
            margin: 0 0 var(--space-6) 0;
          ">sessionSummary is null — stat cards are not rendered (v-if guard)</p>

          <div style="
            display: inline-block;
            padding: var(--space-5) var(--space-8);
            background: var(--glass-bg-soft);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-lg);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
          ">
            <span style="
              font-size: var(--text-sm);
              color: var(--text-tertiary);
            ">No session data yet</span>
          </div>
        </div>
      </div>
    `,
  }),
}

export const AllCardVariants: Story = {
  render: () => ({
    template: `
      <div style="
        min-height: 100vh;
        padding: var(--space-10);
        background: var(--app-background-gradient, var(--color-base-950));
        position: relative;
        overflow: hidden;
      ">
        <!-- Background blobs -->
        <div style="position: absolute; inset: 0; pointer-events: none; overflow: hidden;">
          <div style="
            position: absolute; top: 10%; left: 5%;
            width: 300px; height: 300px; border-radius: 50%;
            background: radial-gradient(circle, rgba(78,205,196,0.35) 0%, transparent 70%);
            filter: blur(40px);
          "></div>
          <div style="
            position: absolute; bottom: 20%; right: 10%;
            width: 280px; height: 280px; border-radius: 50%;
            background: radial-gradient(circle, rgba(168,85,247,0.3) 0%, transparent 70%);
            filter: blur(50px);
          "></div>
          <div style="
            position: absolute; top: 50%; left: 40%;
            width: 250px; height: 250px; border-radius: 50%;
            background: radial-gradient(circle, rgba(251,146,60,0.25) 0%, transparent 70%);
            filter: blur(45px);
          "></div>
        </div>

        <div style="position: relative; z-index: 1;">
          <h2 style="
            font-size: var(--text-xl);
            color: var(--text-primary);
            margin: 0 0 var(--space-2) 0;
            font-weight: var(--font-semibold);
          ">Stat Card Variants</h2>
          <p style="
            font-size: var(--text-sm);
            color: var(--text-muted);
            margin: 0 0 var(--space-8) 0;
          ">Standard glass card vs streak card (orange tint)</p>

          <!-- Standard cards row -->
          <div style="margin-bottom: var(--space-4);">
            <p style="
              font-size: var(--text-xs);
              color: var(--text-tertiary);
              text-transform: uppercase;
              letter-spacing: 0.08em;
              margin: 0 0 var(--space-3) 0;
            ">Standard .stat-card</p>
            <div style="display: flex; gap: var(--space-4); flex-wrap: wrap;">
              <div style="${statCardStyle}">
                <span style="${statValueStyle}">12</span>
                <span style="${statLabelStyle}">Tasks Sorted</span>
              </div>
              <div style="${statCardStyle}">
                <span style="${statValueStyle}">2:15</span>
                <span style="${statLabelStyle}">Time Taken</span>
              </div>
              <div style="${statCardStyle}">
                <span style="${statValueStyle}">5.3</span>
                <span style="${statLabelStyle}">Tasks/Min</span>
              </div>
              <div style="${statCardStyle}">
                <span style="${statValueStyle}">0</span>
                <span style="${statLabelStyle}">Day Streak</span>
              </div>
            </div>
          </div>

          <!-- Streak card row -->
          <div>
            <p style="
              font-size: var(--text-xs);
              color: var(--text-tertiary);
              text-transform: uppercase;
              letter-spacing: 0.08em;
              margin: 0 0 var(--space-3) 0;
            ">.stat-card.streak-card (orange tint)</p>
            <div style="display: flex; gap: var(--space-4); flex-wrap: wrap;">
              <div style="${streakCardStyle}">
                <span style="${statValueStyle}">🔥 1</span>
                <span style="${statLabelStyle}">Day Streak</span>
              </div>
              <div style="${streakCardStyle}">
                <span style="${statValueStyle}">🔥 7</span>
                <span style="${statLabelStyle}">Day Streak</span>
              </div>
              <div style="${streakCardStyle}">
                <span style="${statValueStyle}">🔥 30</span>
                <span style="${statLabelStyle}">Day Streak</span>
              </div>
            </div>
          </div>

          <!-- Token reference -->
          <div style="
            margin-top: var(--space-10);
            padding: var(--space-5);
            background: var(--glass-bg-soft);
            border: 1px solid var(--glass-border);
            border-radius: var(--radius-lg);
          ">
            <p style="
              font-size: var(--text-sm);
              color: var(--text-secondary);
              font-weight: var(--font-semibold);
              margin: 0 0 var(--space-3) 0;
            ">Token reference</p>
            <div style="
              display: grid;
              grid-template-columns: max-content 1fr;
              gap: var(--space-1) var(--space-6);
              font-size: var(--text-xs);
            ">
              <code style="font-family: var(--font-mono, monospace); color: var(--brand-primary, #4ECDC4);">--glass-bg-medium</code>
              <span style="color: var(--text-muted);">Standard card background (transparent in browser, opaque in Tauri)</span>
              <code style="font-family: var(--font-mono, monospace); color: var(--brand-primary, #4ECDC4);">--orange-bg-light</code>
              <span style="color: var(--text-muted);">Streak card background (orange tint)</span>
              <code style="font-family: var(--font-mono, monospace); color: var(--brand-primary, #4ECDC4);">--glass-border</code>
              <span style="color: var(--text-muted);">Card border</span>
              <code style="font-family: var(--font-mono, monospace); color: var(--brand-primary, #4ECDC4);">--danger-border-medium</code>
              <span style="color: var(--text-muted);">Streak card border</span>
            </div>
          </div>
        </div>
      </div>
    `,
  }),
}
