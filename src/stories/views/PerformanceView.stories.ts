import type { Meta, StoryObj } from '@storybook/vue3'

/**
 * PerformanceView - System Health Dashboard
 *
 * Performance benchmarking and monitoring interface.
 *
 * **Features:**
 * - Performance grade (A+ to D)
 * - Benchmark suite runner
 * - Canvas latency metrics
 * - Memory usage tracking
 * - Baseline comparison
 * - Recommendations
 *
 * **Metrics:**
 * - Canvas Performance (1000 nodes sync)
 * - Render Performance (UI updates)
 * - Store Performance (state updates)
 * - Memory Efficiency
 * - Throughput (ops/s)
 *
 * **Utilities:**
 * - performanceBenchmark utility
 * - Baseline export/import
 * - Historical comparison
 */
const meta: Meta = {
  title: '✨ Views/PerformanceView',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `System health and benchmarking suite for FlowState.

**Key Metrics:**
- Overall performance grade (A+ to D)
- Canvas latency (target: <100ms)
- Memory usage (heap size)
- Render performance (frame budget)
- Throughput (operations per second)

**Benchmarks:**
- Canvas Performance: 1000 node sync test
- Render Performance: UI update latency
- Store Performance: State mutation speed
- Memory Efficiency: Heap usage

**Features:**
- Run full benchmark suite
- View historical results
- Export baselines for regression testing
- Automated recommendations

**Note:** Real benchmarks require the app to be running with full store setup.`
      }
    }
  }
}

export default meta
type Story = StoryObj

/**
 * Default - Dashboard with Results
 *
 * Shows the performance dashboard with mock results.
 */
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Performance dashboard with grade, metrics, and benchmark results table.'
      }
    }
  },
  render: () => ({
    template: `
      <div style="
        min-height: 100vh;
        background: var(--app-background-gradient);
        padding: var(--space-6);
        color: var(--text-primary);
      ">
        <!-- Header -->
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-6);
          background: var(--glass-bg-tint);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          margin-bottom: var(--space-6);
        ">
          <div>
            <h1 style="
              font-size: var(--text-3xl);
              font-weight: var(--font-bold);
              background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              margin: 0 0 var(--space-1) 0;
            ">Performance Dashboard</h1>
            <p style="
              color: var(--text-muted);
              margin: 0;
            ">System health and benchmarking suite</p>
          </div>
          <button style="
            padding: var(--space-3) var(--space-5);
            background: #6366f1;
            border: none;
            border-radius: var(--radius-md);
            color: white;
            font-size: var(--text-sm);
            font-weight: var(--font-semibold);
            cursor: pointer;
          ">🚀 Run Full Suite</button>
        </div>

        <!-- Summary Cards -->
        <div style="
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-4);
          margin-bottom: var(--space-6);
        ">
          <!-- Grade Card -->
          <div style="
            padding: var(--space-6);
            background: var(--glass-bg-tint);
            border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: var(--radius-lg);
            text-align: center;
          ">
            <h3 style="
              font-size: var(--text-sm);
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: var(--text-muted);
              margin: 0 0 var(--space-2) 0;
            ">Overall Grade</h3>
            <div style="
              font-size: 5rem;
              font-weight: 800;
              color: #10b981;
              line-height: 1;
              margin: var(--space-4) 0;
            ">A</div>
            <p style="
              font-size: var(--text-sm);
              color: var(--text-secondary);
              margin: 0;
            ">Excellent Performance</p>
          </div>

          <!-- Canvas Latency -->
          <div style="
            padding: var(--space-6);
            background: var(--glass-bg-tint);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-lg);
          ">
            <h3 style="
              font-size: var(--text-sm);
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: var(--text-muted);
              margin: 0 0 var(--space-2) 0;
            ">Canvas Latency</h3>
            <div style="
              font-size: var(--text-3xl);
              font-weight: 700;
              color: #6366f1;
              margin: var(--space-2) 0;
            ">45.2ms</div>
            <div style="
              font-size: var(--text-sm);
              color: var(--text-muted);
            ">1000 nodes sync</div>
          </div>

          <!-- Memory Usage -->
          <div style="
            padding: var(--space-6);
            background: var(--glass-bg-tint);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-lg);
          ">
            <h3 style="
              font-size: var(--text-sm);
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: var(--text-muted);
              margin: 0 0 var(--space-2) 0;
            ">Memory Usage</h3>
            <div style="
              font-size: var(--text-3xl);
              font-weight: 700;
              color: #6366f1;
              margin: var(--space-2) 0;
            ">124.8MB</div>
            <div style="
              font-size: var(--text-sm);
              color: var(--text-muted);
            ">Heap size</div>
          </div>
        </div>

        <!-- Results Table -->
        <div style="
          padding: var(--space-6);
          background: var(--glass-bg-tint);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
        ">
          <h2 style="
            font-size: var(--text-xl);
            font-weight: var(--font-semibold);
            margin: 0 0 var(--space-4) 0;
          ">Benchmark Results</h2>

          <table style="
            width: 100%;
            border-collapse: collapse;
          ">
            <thead>
              <tr style="
                border-bottom: 1px solid var(--glass-border);
              ">
                <th style="
                  text-align: left;
                  padding: var(--space-3);
                  font-size: var(--text-sm);
                  color: var(--text-muted);
                  font-weight: var(--font-medium);
                ">Test Category</th>
                <th style="
                  text-align: left;
                  padding: var(--space-3);
                  font-size: var(--text-sm);
                  color: var(--text-muted);
                  font-weight: var(--font-medium);
                ">Average</th>
                <th style="
                  text-align: left;
                  padding: var(--space-3);
                  font-size: var(--text-sm);
                  color: var(--text-muted);
                  font-weight: var(--font-medium);
                ">Min/Max</th>
                <th style="
                  text-align: left;
                  padding: var(--space-3);
                  font-size: var(--text-sm);
                  color: var(--text-muted);
                  font-weight: var(--font-medium);
                ">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px solid var(--glass-border-faint);">
                <td style="padding: var(--space-3); font-weight: var(--font-semibold);">Canvas Performance</td>
                <td style="padding: var(--space-3);">45.2ms</td>
                <td style="padding: var(--space-3); color: var(--text-muted);">38.1 / 52.3ms</td>
                <td style="padding: var(--space-3);">
                  <span style="
                    padding: var(--space-1) var(--space-2);
                    background: rgba(16, 185, 129, 0.15);
                    color: #10b981;
                    border-radius: var(--radius-sm);
                    font-size: var(--text-xs);
                    font-weight: 700;
                  ">FAST</span>
                </td>
              </tr>
              <tr style="border-bottom: 1px solid var(--glass-border-faint);">
                <td style="padding: var(--space-3); font-weight: var(--font-semibold);">Render Performance</td>
                <td style="padding: var(--space-3);">12.8ms</td>
                <td style="padding: var(--space-3); color: var(--text-muted);">10.2 / 15.4ms</td>
                <td style="padding: var(--space-3);">
                  <span style="
                    padding: var(--space-1) var(--space-2);
                    background: rgba(16, 185, 129, 0.15);
                    color: #10b981;
                    border-radius: var(--radius-sm);
                    font-size: var(--text-xs);
                    font-weight: 700;
                  ">FAST</span>
                </td>
              </tr>
              <tr style="border-bottom: 1px solid var(--glass-border-faint);">
                <td style="padding: var(--space-3); font-weight: var(--font-semibold);">Store Performance</td>
                <td style="padding: var(--space-3);">8.3ms</td>
                <td style="padding: var(--space-3); color: var(--text-muted);">6.1 / 11.2ms</td>
                <td style="padding: var(--space-3);">
                  <span style="
                    padding: var(--space-1) var(--space-2);
                    background: rgba(16, 185, 129, 0.15);
                    color: #10b981;
                    border-radius: var(--radius-sm);
                    font-size: var(--text-xs);
                    font-weight: 700;
                  ">FAST</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `
  })
}
