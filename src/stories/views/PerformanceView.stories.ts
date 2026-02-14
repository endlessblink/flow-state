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

// Inline styles matching PerformanceView.vue design tokens
const S = {
  view: 'min-height:100vh; background:var(--app-background-gradient); padding:var(--space-6); color:var(--text-primary);',
  header: 'display:flex; justify-content:space-between; align-items:center; padding:var(--space-6); background:var(--glass-bg-tint); backdrop-filter:blur(12px); border:1px solid var(--glass-border); border-radius:var(--radius-lg); margin-bottom:var(--space-6);',
  headerTitle: 'font-size:var(--text-3xl); font-weight:var(--font-bold); color:var(--text-primary); margin:0 0 var(--space-1) 0;',
  headerSub: 'color:var(--text-muted); margin:0;',
  btnPrimary: 'padding:var(--space-3) var(--space-5); background:var(--glass-bg-soft); border:1px solid var(--color-indigo); border-radius:var(--radius-md); color:var(--color-indigo); font-size:var(--text-sm); font-weight:var(--font-semibold); cursor:pointer; backdrop-filter:blur(8px);',
  grid3: 'display:grid; grid-template-columns:repeat(3,1fr); gap:var(--space-4); margin-bottom:var(--space-6);',
  card: 'padding:var(--space-6); background:var(--glass-bg-tint); backdrop-filter:blur(12px); border:1px solid var(--glass-border); border-radius:var(--radius-lg);',
  cardGrade: 'padding:var(--space-6); background:var(--glass-bg-tint); backdrop-filter:blur(12px); border:1px solid var(--success-border); border-radius:var(--radius-lg); text-align:center;',
  cardLabel: 'font-size:var(--text-sm); text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted); margin:0 0 var(--space-2) 0;',
  gradeValue: 'font-size:5rem; font-weight:800; color:var(--color-success); line-height:1; margin:var(--space-4) 0;',
  gradeMsg: 'font-size:var(--text-sm); color:var(--text-secondary); margin:0;',
  statValue: 'font-size:var(--text-3xl); font-weight:700; color:var(--color-indigo); margin:var(--space-2) 0;',
  statLabel: 'font-size:var(--text-sm); color:var(--text-muted);',
  resultsWrap: 'padding:var(--space-6); background:var(--glass-bg-tint); backdrop-filter:blur(12px); border:1px solid var(--glass-border); border-radius:var(--radius-lg);',
  resultsTitle: 'font-size:var(--text-xl); font-weight:var(--font-semibold); margin:0 0 var(--space-4) 0; color:var(--text-primary);',
  table: 'width:100%; border-collapse:collapse;',
  th: 'text-align:left; padding:var(--space-3); font-size:var(--text-sm); color:var(--text-muted); font-weight:var(--font-medium); border-bottom:1px solid var(--glass-border);',
  tr: 'border-bottom:1px solid var(--glass-border-faint);',
  td: 'padding:var(--space-3); color:var(--text-primary);',
  tdName: 'padding:var(--space-3); font-weight:var(--font-semibold); color:var(--text-primary);',
  tdMuted: 'padding:var(--space-3); color:var(--text-muted);',
  badgeFast: 'display:inline-block; padding:var(--space-1) var(--space-2); background:var(--success-bg-subtle); color:var(--color-success); border-radius:var(--radius-sm); font-size:var(--text-xs); font-weight:700;',
  badgeOk: 'display:inline-block; padding:var(--space-1) var(--space-2); background:var(--warning-bg-subtle); color:var(--color-warning); border-radius:var(--radius-sm); font-size:var(--text-xs); font-weight:700;',
  badgeSlow: 'display:inline-block; padding:var(--space-1) var(--space-2); background:var(--danger-bg); color:var(--danger); border-radius:var(--radius-sm); font-size:var(--text-xs); font-weight:700;',
  sidebar: 'padding:var(--space-6); background:var(--glass-bg-tint); backdrop-filter:blur(12px); border:1px solid var(--glass-border); border-radius:var(--radius-lg); margin-top:var(--space-4);',
  sidebarTitle: 'font-size:var(--text-lg); font-weight:var(--font-semibold); margin:0 0 var(--space-4) 0; color:var(--text-primary);',
  recItem: 'margin-bottom:var(--space-3); font-size:var(--text-sm); color:var(--text-secondary); line-height:1.4;',
  recStrong: 'color:var(--text-primary); font-weight:var(--font-semibold);',
  gridMain: 'display:grid; grid-template-columns:1fr 300px; gap:var(--space-6);',
  emptyText: 'color:var(--text-muted); font-size:var(--text-sm);',
  progressBar: 'display:inline-block; width:60px; height:6px; background:var(--glass-border); border-radius:3px; margin-right:var(--space-2); vertical-align:middle; overflow:hidden;',
  progressFill: 'display:block; height:100%; background:var(--color-indigo); border-radius:3px;',
  btnSecondary: 'width:100%; padding:var(--space-3) var(--space-5); background:var(--glass-bg-soft); border:1px solid var(--glass-border-hover); border-radius:var(--radius-md); color:var(--text-primary); font-size:var(--text-sm); font-weight:var(--font-semibold); cursor:pointer; backdrop-filter:blur(8px);',
  footerNote: 'margin-top:var(--space-4); font-size:var(--text-xs); color:var(--text-muted);'
}

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
      <div style="${S.view}">
        <!-- Header -->
        <div style="${S.header}">
          <div>
            <h1 style="${S.headerTitle}">Performance Dashboard</h1>
            <p style="${S.headerSub}">System health and benchmarking suite</p>
          </div>
          <button style="${S.btnPrimary}">Run Full Suite</button>
        </div>

        <!-- Summary Cards -->
        <div style="${S.grid3}">
          <div style="${S.cardGrade}">
            <h3 style="${S.cardLabel}">Overall Grade</h3>
            <div style="${S.gradeValue}">A</div>
            <p style="${S.gradeMsg}">Excellent Performance</p>
          </div>
          <div style="${S.card}">
            <h3 style="${S.cardLabel}">Canvas Latency</h3>
            <div style="${S.statValue}">45.2ms</div>
            <div style="${S.statLabel}">1000 nodes sync</div>
          </div>
          <div style="${S.card}">
            <h3 style="${S.cardLabel}">Memory Usage</h3>
            <div style="${S.statValue}">124.8MB</div>
            <div style="${S.statLabel}">Heap size</div>
          </div>
        </div>

        <!-- Main Content Grid -->
        <div style="${S.gridMain}">
          <!-- Results Table -->
          <div style="${S.resultsWrap}">
            <h2 style="${S.resultsTitle}">Benchmark Results</h2>
            <table style="${S.table}">
              <thead>
                <tr>
                  <th style="${S.th}">Test Category</th>
                  <th style="${S.th}">Average</th>
                  <th style="${S.th}">Min/Max</th>
                  <th style="${S.th}">Success</th>
                  <th style="${S.th}">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr style="${S.tr}">
                  <td style="${S.tdName}">Canvas Performance</td>
                  <td style="${S.td}">45.2ms</td>
                  <td style="${S.tdMuted}">38.1 / 52.3ms</td>
                  <td style="${S.td}"><span style="${S.progressBar}"><span style="${S.progressFill} width:100%;"></span></span> 100%</td>
                  <td style="${S.td}"><span style="${S.badgeFast}">FAST</span></td>
                </tr>
                <tr style="${S.tr}">
                  <td style="${S.tdName}">Render Performance</td>
                  <td style="${S.td}">12.8ms</td>
                  <td style="${S.tdMuted}">10.2 / 15.4ms</td>
                  <td style="${S.td}"><span style="${S.progressBar}"><span style="${S.progressFill} width:100%;"></span></span> 100%</td>
                  <td style="${S.td}"><span style="${S.badgeFast}">FAST</span></td>
                </tr>
                <tr style="${S.tr}">
                  <td style="${S.tdName}">Store Performance</td>
                  <td style="${S.td}">8.3ms</td>
                  <td style="${S.tdMuted}">6.1 / 11.2ms</td>
                  <td style="${S.td}"><span style="${S.progressBar}"><span style="${S.progressFill} width:98%;"></span></span> 98%</td>
                  <td style="${S.td}"><span style="${S.badgeFast}">FAST</span></td>
                </tr>
                <tr style="${S.tr}">
                  <td style="${S.tdName}">Memory Efficiency</td>
                  <td style="${S.td}">124.8MB</td>
                  <td style="${S.tdMuted}">— / —</td>
                  <td style="${S.td}"><span style="${S.progressBar}"><span style="${S.progressFill} width:100%;"></span></span> 100%</td>
                  <td style="${S.td}"><span style="${S.badgeFast}">FAST</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Sidebar -->
          <div style="${S.sidebar}">
            <h2 style="${S.sidebarTitle}">Recommendations</h2>
            <p style="${S.emptyText}">System is performing optimally. No recommendations at this time.</p>
            <div style="margin-top:var(--space-6); padding-top:var(--space-6); border-top:1px solid var(--glass-border);">
              <h3 style="${S.sidebarTitle}">Baseline Management</h3>
              <button style="${S.btnSecondary}">Save as New Baseline</button>
              <div style="${S.footerNote}">Baselines are stored in docs/performance/</div>
            </div>
          </div>
        </div>
      </div>
    `
  })
}

/**
 * Degraded Performance
 *
 * Dashboard showing mixed results with warnings.
 */
export const DegradedPerformance: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Performance dashboard showing degraded metrics with warnings and recommendations.'
      }
    }
  },
  render: () => ({
    template: `
      <div style="${S.view}">
        <div style="${S.header}">
          <div>
            <h1 style="${S.headerTitle}">Performance Dashboard</h1>
            <p style="${S.headerSub}">System health and benchmarking suite</p>
          </div>
          <button style="${S.btnPrimary}">Run Full Suite</button>
        </div>

        <div style="${S.grid3}">
          <div style="padding:var(--space-6); background:var(--glass-bg-tint); backdrop-filter:blur(12px); border:1px solid var(--warning-border); border-radius:var(--radius-lg); text-align:center;">
            <h3 style="${S.cardLabel}">Overall Grade</h3>
            <div style="font-size:5rem; font-weight:800; color:var(--color-warning); line-height:1; margin:var(--space-4) 0;">C</div>
            <p style="${S.gradeMsg}">Performance Needs Attention</p>
          </div>
          <div style="${S.card}">
            <h3 style="${S.cardLabel}">Canvas Latency</h3>
            <div style="font-size:var(--text-3xl); font-weight:700; color:var(--color-warning); margin:var(--space-2) 0;">187.4ms</div>
            <div style="${S.statLabel}">1000 nodes sync</div>
          </div>
          <div style="${S.card}">
            <h3 style="${S.cardLabel}">Memory Usage</h3>
            <div style="font-size:var(--text-3xl); font-weight:700; color:var(--danger); margin:var(--space-2) 0;">312.5MB</div>
            <div style="${S.statLabel}">Heap size</div>
          </div>
        </div>

        <div style="${S.gridMain}">
          <div style="${S.resultsWrap}">
            <h2 style="${S.resultsTitle}">Benchmark Results</h2>
            <table style="${S.table}">
              <thead>
                <tr>
                  <th style="${S.th}">Test Category</th>
                  <th style="${S.th}">Average</th>
                  <th style="${S.th}">Min/Max</th>
                  <th style="${S.th}">Success</th>
                  <th style="${S.th}">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr style="${S.tr}">
                  <td style="${S.tdName}">Canvas Performance</td>
                  <td style="${S.td}">187.4ms</td>
                  <td style="${S.tdMuted}">142.1 / 234.8ms</td>
                  <td style="${S.td}"><span style="${S.progressBar}"><span style="${S.progressFill} width:85%;"></span></span> 85%</td>
                  <td style="${S.td}"><span style="${S.badgeOk}">OK</span></td>
                </tr>
                <tr style="${S.tr}">
                  <td style="${S.tdName}">Render Performance</td>
                  <td style="${S.td}">38.2ms</td>
                  <td style="${S.tdMuted}">22.5 / 54.1ms</td>
                  <td style="${S.td}"><span style="${S.progressBar}"><span style="${S.progressFill} width:92%;"></span></span> 92%</td>
                  <td style="${S.td}"><span style="${S.badgeOk}">OK</span></td>
                </tr>
                <tr style="${S.tr}">
                  <td style="${S.tdName}">Store Performance</td>
                  <td style="${S.td}">8.1ms</td>
                  <td style="${S.tdMuted}">5.9 / 10.8ms</td>
                  <td style="${S.td}"><span style="${S.progressBar}"><span style="${S.progressFill} width:100%;"></span></span> 100%</td>
                  <td style="${S.td}"><span style="${S.badgeFast}">FAST</span></td>
                </tr>
                <tr style="${S.tr}">
                  <td style="${S.tdName}">Memory Efficiency</td>
                  <td style="${S.td}">312.5MB</td>
                  <td style="${S.tdMuted}">— / —</td>
                  <td style="${S.td}"><span style="${S.progressBar}"><span style="${S.progressFill} width:60%;"></span></span> 60%</td>
                  <td style="${S.td}"><span style="${S.badgeSlow}">SLOW</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="${S.sidebar}">
            <h2 style="${S.sidebarTitle}">Recommendations</h2>
            <div style="${S.recItem}"><span style="${S.recStrong}">Canvas:</span> High latency detected with many nodes. Consider LOD optimization.</div>
            <div style="${S.recItem}"><span style="${S.recStrong}">Memory:</span> Memory usage is elevated. Check for leaks in node pooling.</div>
            <div style="${S.recItem}"><span style="${S.recStrong}">Render:</span> Main thread is taking too long for UI updates. Review watcher complexity.</div>
          </div>
        </div>
      </div>
    `
  })
}

/**
 * Empty State
 *
 * Before any benchmarks have been run.
 */
export const EmptyState: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Initial state before any benchmarks are run. Shows empty results with prompt to start.'
      }
    }
  },
  render: () => ({
    template: `
      <div style="${S.view}">
        <div style="${S.header}">
          <div>
            <h1 style="${S.headerTitle}">Performance Dashboard</h1>
            <p style="${S.headerSub}">System health and benchmarking suite</p>
          </div>
          <button style="${S.btnPrimary}">Run Full Suite</button>
        </div>

        <div style="${S.grid3}">
          <div style="${S.card}; text-align:center;">
            <h3 style="${S.cardLabel}">Overall Grade</h3>
            <div style="font-size:5rem; font-weight:800; color:var(--text-muted); line-height:1; margin:var(--space-4) 0;">-</div>
            <p style="${S.gradeMsg}">System status unknown</p>
          </div>
          <div style="${S.card}">
            <h3 style="${S.cardLabel}">Canvas Latency</h3>
            <div style="${S.statValue}">0.0ms</div>
            <div style="${S.statLabel}">1000 nodes sync</div>
          </div>
          <div style="${S.card}">
            <h3 style="${S.cardLabel}">Memory Usage</h3>
            <div style="${S.statValue}">0.0MB</div>
            <div style="${S.statLabel}">Heap size</div>
          </div>
        </div>

        <div style="${S.resultsWrap}">
          <h2 style="${S.resultsTitle}">Benchmark Results</h2>
          <p style="${S.emptyText}">No results yet. Run the benchmark suite to see metrics.</p>
        </div>
      </div>
    `
  })
}
