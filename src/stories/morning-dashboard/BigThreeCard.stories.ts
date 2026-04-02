import type { Meta, StoryObj } from '@storybook/vue3'

const S = {
  card: 'display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-6); background: var(--surface-primary); border: 1px solid var(--glass-border); border-radius: var(--radius-lg);',
  headerTitle: 'font-size: 1.125rem; font-weight: 600; color: var(--text-primary); margin: 0;',
  headerSub: 'font-size: 0.75rem; color: var(--text-muted); margin: var(--space-1) 0 0 0;',
  layout: 'display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); min-height: 320px;',
  poolWrapper: 'display: flex; flex-direction: column; gap: var(--space-3); min-height: 0; overflow: hidden;',
  searchInput: 'width: 100%; padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); font-size: 0.85rem; outline: none;',
  pool: 'display: flex; flex-direction: column; gap: var(--space-3); flex: 1; overflow-y: auto; padding-right: var(--space-2);',
  sectionHeader: 'display: flex; align-items: center; gap: var(--space-2); padding: var(--space-1) 0;',
  sectionAccent: 'width: 3px; height: 14px; border-radius: var(--radius-xs); flex-shrink: 0;',
  sectionLabel: 'font-size: 0.7rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;',
  sectionCount: 'font-size: 0.65rem; color: var(--text-muted); background: var(--glass-bg-soft); padding: 0 var(--space-1); border-radius: var(--radius-sm);',
  poolCard: 'display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: var(--surface-primary); border: 1px solid var(--glass-border); border-radius: var(--radius-md); cursor: grab; min-height: 40px;',
  priorityDot: 'width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;',
  poolTitle: 'flex: 1; font-size: 0.8rem; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
  dueBadge: 'font-size: 0.65rem; color: var(--text-muted); white-space: nowrap; padding: 1px var(--space-1); background: var(--glass-bg-soft); border-radius: var(--radius-sm);',
  dueBadgeOverdue: 'font-size: 0.65rem; color: var(--color-danger); white-space: nowrap; padding: 1px var(--space-1); background: var(--danger-bg-subtle); border-radius: var(--radius-sm);',
  dropZones: 'display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-4); background: var(--glass-bg-soft); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); backdrop-filter: blur(8px);',
  zone: 'display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); min-height: 56px; flex: 1;',
  zoneEmpty: 'border: 2px dashed var(--glass-border);',
  zoneFilled: 'background: var(--surface-primary); border-left: 3px solid var(--brand-primary); border-top: 1px solid var(--glass-border); border-right: 1px solid var(--glass-border); border-bottom: 1px solid var(--glass-border);',
  num: 'font-size: 0.75rem; font-weight: 700; color: var(--brand-primary); min-width: 18px;',
  placeholder: 'font-size: 0.8rem; color: var(--text-muted); flex: 1;',
  zoneTitle: 'font-size: 0.85rem; color: var(--text-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
  clearBtn: 'background: none; border: none; color: var(--text-muted); font-size: 1.1rem; cursor: pointer; padding: 0 var(--space-1); line-height: 1;',
  startBtn: 'padding: var(--space-3) var(--space-4); background: var(--glass-bg-soft); color: var(--brand-primary); border: 1px solid var(--brand-primary); border-radius: var(--radius-md); font-size: 0.85rem; font-weight: 600; cursor: pointer; backdrop-filter: blur(8px); width: 100%; margin-top: auto;',
  startBtnDisabled: 'padding: var(--space-3) var(--space-4); background: var(--glass-bg-soft); color: var(--brand-primary); border: 1px solid var(--brand-primary); border-radius: var(--radius-md); font-size: 0.85rem; font-weight: 600; width: 100%; margin-top: auto; opacity: 0.4; cursor: not-allowed;',
  createRow: 'display: flex; gap: var(--space-2); align-items: flex-end; flex-shrink: 0;',
  addBtn: 'padding: var(--space-2) var(--space-3); background: var(--glass-bg-soft); color: var(--brand-primary); border: 1px solid var(--brand-primary); border-radius: var(--radius-md); font-size: 0.8rem; font-weight: 600; cursor: pointer; backdrop-filter: blur(8px); height: 36px; white-space: nowrap;',
}

const meta: Meta = {
  title: '☀️ Morning Dashboard/BigThreeCard',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `The main Big Three card for the Morning Dashboard. Left side shows a searchable, grouped task pool with draggable cards. Right side has 3 drop zones for daily priorities plus a "Start My Day" button.`,
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'With Tasks & Partially Filled',
  render: () => ({
    template: `
      <div style="padding: var(--space-6); background: var(--app-background-gradient); min-height: 100vh;">
        <div style="${S.card}">
          <div>
            <h2 style="${S.headerTitle}">Today's Big 3</h2>
            <p style="${S.headerSub}">Drag tasks from the left into your focus zones</p>
          </div>

          <div style="${S.layout}">
            <!-- Task Pool -->
            <div style="${S.poolWrapper}">
              <input style="${S.searchInput}" placeholder="Search tasks..." />

              <div style="${S.pool}">
                <!-- Overdue section -->
                <div>
                  <div style="${S.sectionHeader}">
                    <span style="${S.sectionAccent} background-color: var(--color-danger);" />
                    <span style="${S.sectionLabel}">Overdue</span>
                    <span style="${S.sectionCount}">2</span>
                  </div>
                  <div style="display: flex; flex-direction: column; gap: var(--space-1);">
                    <div style="${S.poolCard}">
                      <span style="${S.priorityDot} background-color: var(--color-danger);" />
                      <span style="${S.poolTitle}">Fix production crash</span>
                      <span style="${S.dueBadgeOverdue}">Yesterday</span>
                    </div>
                    <div style="${S.poolCard}">
                      <span style="${S.priorityDot} background-color: var(--color-warning);" />
                      <span style="${S.poolTitle}">Update API documentation</span>
                      <span style="${S.dueBadgeOverdue}">2 days ago</span>
                    </div>
                  </div>
                </div>

                <!-- Due Today section -->
                <div>
                  <div style="${S.sectionHeader}">
                    <span style="${S.sectionAccent} background-color: var(--brand-primary);" />
                    <span style="${S.sectionLabel}">Due Today</span>
                    <span style="${S.sectionCount}">3</span>
                  </div>
                  <div style="display: flex; flex-direction: column; gap: var(--space-1);">
                    <div style="${S.poolCard}">
                      <span style="${S.priorityDot} background-color: var(--color-danger);" />
                      <span style="${S.poolTitle}">Deploy v2.1 hotfix</span>
                      <span style="${S.dueBadge}">Today</span>
                    </div>
                    <div style="${S.poolCard}">
                      <span style="${S.priorityDot} background-color: var(--color-warning);" />
                      <span style="${S.poolTitle}">Team standup notes</span>
                      <span style="${S.dueBadge}">Today</span>
                    </div>
                    <div style="${S.poolCard}">
                      <span style="${S.priorityDot} background-color: var(--brand-primary);" />
                      <span style="${S.poolTitle}">Review PR #187</span>
                      <span style="${S.dueBadge}">Today</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style="${S.createRow}">
                <input style="${S.searchInput} flex: 1;" placeholder="Create a new task..." />
                <button style="${S.addBtn}">Add</button>
              </div>
            </div>

            <!-- Drop Zones -->
            <div style="${S.dropZones}">
              <div style="${S.zone} ${S.zoneFilled}">
                <span style="${S.num}">1.</span>
                <span style="${S.zoneTitle}">Deploy v2.1 hotfix</span>
                <button style="${S.clearBtn}">&times;</button>
              </div>
              <div style="${S.zone} ${S.zoneEmpty}">
                <span style="${S.num}">2.</span>
                <span style="${S.placeholder}">Second focus</span>
              </div>
              <div style="${S.zone} ${S.zoneEmpty}">
                <span style="${S.num}">3.</span>
                <span style="${S.placeholder}">One more thing</span>
              </div>
              <button style="${S.startBtnDisabled}">Start My Day</button>
            </div>
          </div>
        </div>
      </div>
    `,
  }),
}

export const AllSlotsFilled: Story = {
  name: 'All Slots Filled (Ready)',
  render: () => ({
    template: `
      <div style="padding: var(--space-6); background: var(--app-background-gradient); min-height: 100vh;">
        <div style="${S.card}">
          <div>
            <h2 style="${S.headerTitle}">Today's Big 3</h2>
            <p style="${S.headerSub}">Drag tasks from the left into your focus zones</p>
          </div>

          <div style="${S.layout}">
            <div style="${S.poolWrapper}">
              <input style="${S.searchInput}" placeholder="Search tasks..." />
              <div style="${S.pool}">
                <div>
                  <div style="${S.sectionHeader}">
                    <span style="${S.sectionAccent} background-color: var(--brand-primary);" />
                    <span style="${S.sectionLabel}">Upcoming</span>
                    <span style="${S.sectionCount}">2</span>
                  </div>
                  <div style="display: flex; flex-direction: column; gap: var(--space-1);">
                    <div style="${S.poolCard}">
                      <span style="${S.priorityDot} background-color: var(--text-muted);" />
                      <span style="${S.poolTitle}">Refactor auth module</span>
                      <span style="${S.dueBadge}">Tomorrow</span>
                    </div>
                    <div style="${S.poolCard}">
                      <span style="${S.priorityDot} background-color: var(--brand-primary);" />
                      <span style="${S.poolTitle}">Write migration script</span>
                      <span style="${S.dueBadge}">Mar 10</span>
                    </div>
                  </div>
                </div>
              </div>
              <div style="${S.createRow}">
                <input style="${S.searchInput} flex: 1;" placeholder="Create a new task..." />
                <button style="${S.addBtn}">Add</button>
              </div>
            </div>

            <div style="${S.dropZones}">
              <div style="${S.zone} ${S.zoneFilled}">
                <span style="${S.num}">1.</span>
                <span style="${S.zoneTitle}">Deploy v2.1 hotfix</span>
                <button style="${S.clearBtn}">&times;</button>
              </div>
              <div style="${S.zone} ${S.zoneFilled}">
                <span style="${S.num}">2.</span>
                <span style="${S.zoneTitle}">Review PR #187</span>
                <button style="${S.clearBtn}">&times;</button>
              </div>
              <div style="${S.zone} ${S.zoneFilled}">
                <span style="${S.num}">3.</span>
                <span style="${S.zoneTitle}">Team standup notes</span>
                <button style="${S.clearBtn}">&times;</button>
              </div>
              <button style="${S.startBtn}">Start My Day</button>
            </div>
          </div>
        </div>
      </div>
    `,
  }),
}

export const EmptyState: Story = {
  name: 'Empty (No Tasks)',
  render: () => ({
    template: `
      <div style="padding: var(--space-6); background: var(--app-background-gradient); min-height: 100vh;">
        <div style="${S.card}">
          <div>
            <h2 style="${S.headerTitle}">Today's Big 3</h2>
            <p style="${S.headerSub}">Drag tasks from the left into your focus zones</p>
          </div>
          <div style="${S.layout}">
            <div style="${S.poolWrapper}">
              <input style="${S.searchInput}" placeholder="Search tasks..." />
              <div style="display: flex; align-items: center; justify-content: center; padding: var(--space-8); color: var(--text-muted); font-size: 0.85rem; flex: 1;">
                No tasks yet — create one below!
              </div>
              <div style="${S.createRow}">
                <input style="${S.searchInput} flex: 1;" placeholder="Create a new task..." />
                <button style="${S.addBtn}">Add</button>
              </div>
            </div>
            <div style="${S.dropZones}">
              <div style="${S.zone} ${S.zoneEmpty}"><span style="${S.num}">1.</span><span style="${S.placeholder}">Top priority</span></div>
              <div style="${S.zone} ${S.zoneEmpty}"><span style="${S.num}">2.</span><span style="${S.placeholder}">Second focus</span></div>
              <div style="${S.zone} ${S.zoneEmpty}"><span style="${S.num}">3.</span><span style="${S.placeholder}">One more thing</span></div>
              <button style="${S.startBtnDisabled}">Start My Day</button>
            </div>
          </div>
        </div>
      </div>
    `,
  }),
}
