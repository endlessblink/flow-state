import type { Meta, StoryObj } from '@storybook/vue3'
import { AlertTriangle, X, RefreshCw, Trash2, CheckSquare, FolderKanban, Ban } from 'lucide-vue-next'

// ============================================================================
// INLINE STYLES (Design Token-Based — faithful to SyncErrorPopover.vue)
// ============================================================================

const containerStyle = `position: relative; width: 100%; min-height: 500px; background: var(--overlay-backdrop-bg); display: flex; align-items: flex-start; justify-content: flex-end; padding: var(--space-6); border-radius: var(--radius-xl);`

const popoverStyle = `width: 360px; background: var(--glass-bg-medium); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-xl); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); overflow: hidden; display: flex; flex-direction: column;`

const headerStyle = `display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4); border-bottom: 1px solid var(--border-subtle);`

const headerIconStyle = `display: flex; align-items: center; justify-content: center; width: var(--space-9); height: var(--space-9); background: var(--danger-bg-subtle); border-radius: var(--radius-md); color: var(--color-danger);`

const headerTitleStyle = `font-size: var(--text-base); font-weight: var(--font-semibold); color: var(--text-primary); margin: 0;`

const headerSubtitleStyle = `font-size: var(--text-sm); color: var(--text-muted); margin: 0;`

const closeBtnStyle = `display: flex; align-items: center; justify-content: center; width: var(--space-7); height: var(--space-7); background: transparent; border: none; border-radius: var(--radius-sm); color: var(--text-muted); cursor: pointer; margin-left: auto;`

const bodyStyle = `flex: 1; overflow-y: auto; padding: var(--space-4);`

const errorSummaryStyle = `padding: var(--space-3); background: var(--danger-bg-subtle); border-radius: var(--radius-md); margin-bottom: var(--space-4); font-size: var(--text-sm); color: var(--color-danger); line-height: 1.5;`

const errorItemStyle = `padding: var(--space-3); background: var(--surface-subtle); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); margin-bottom: var(--space-3);`

const errorItemPermanentStyle = `padding: var(--space-3); background: var(--surface-subtle); border: 1px dashed var(--color-danger); border-radius: var(--radius-md); margin-bottom: var(--space-3);`

const errorEntityStyle = `display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-1); color: var(--text-secondary); font-size: var(--text-sm);`

const entityTypeStyle = `font-weight: var(--font-medium);`

const entityIdStyle = `font-family: monospace; font-size: var(--text-xs); color: var(--text-muted);`

const permanentBadgeStyle = `display: inline-flex; align-items: center; gap: var(--space-0_5); padding: var(--space-0_5) var(--space-1_5); background: var(--danger-bg-subtle); color: var(--color-danger); font-size: var(--text-xs); font-weight: var(--font-medium); border-radius: var(--radius-sm); margin-left: auto;`

const errorOperationStyle = `font-size: var(--text-sm); color: var(--text-muted); margin-bottom: var(--space-1);`

const errorDetailStyle = `font-size: var(--text-xs); color: var(--color-danger); background: var(--danger-bg-subtle); padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); margin-bottom: var(--space-2);`

const errorMetaStyle = `display: flex; gap: var(--space-3); font-size: var(--text-xs); color: var(--text-muted);`

const footerStyle = `display: flex; gap: var(--space-3); padding: var(--space-4); border-top: 1px solid var(--border-subtle);`

const retryBtnStyle = `flex: 1; display: flex; align-items: center; justify-content: center; gap: var(--space-2); padding: var(--space-2_5) var(--space-4); background: var(--glass-bg-soft); border: 1px solid var(--brand-primary); border-radius: var(--radius-md); color: var(--brand-primary); font-weight: var(--font-medium); cursor: pointer; backdrop-filter: blur(8px);`

const clearBtnStyle = `display: flex; align-items: center; justify-content: center; gap: var(--space-2); padding: var(--space-2_5) var(--space-4); background: var(--glass-bg-soft); border: 1px solid var(--color-danger); border-radius: var(--radius-md); color: var(--color-danger); font-weight: var(--font-medium); cursor: pointer; backdrop-filter: blur(8px);`

const dismissBtnStyle = `padding: var(--space-2_5) var(--space-4); background: transparent; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); color: var(--text-secondary); font-weight: var(--font-medium); cursor: pointer;`

const noRetryHintStyle = `color: var(--color-danger); font-style: italic;`

// ============================================================================
// META
// ============================================================================

const meta: Meta = {
  title: '🏢 Layout/SyncErrorPopover',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `Sync error overlay showing failed operations with entity info, retry counts, and actions.

**Features:**
- Classifies errors as retryable or permanent (corrupted)
- Shows entity type/ID, operation, error message, and attempt count
- Retry retryable errors, Clear All to dismiss permanent ones
- Positioned top-right as a popover over the app`
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

// ============================================================================
// STORY 1: WITH ERRORS (multiple retryable)
// ============================================================================

export const WithErrors: Story = {
  name: 'Multiple Errors',
  render: () => ({
    components: { AlertTriangle, X, RefreshCw, Trash2, CheckSquare, FolderKanban },
    template: `
      <div :style="containerStyle">
        <div :style="popoverStyle">
          <!-- Header -->
          <div :style="headerStyle">
            <div :style="headerIconStyle">
              <AlertTriangle :size="20" />
            </div>
            <div style="flex: 1;">
              <h3 :style="headerTitleStyle">Sync Errors</h3>
              <p :style="headerSubtitleStyle">2 errors</p>
            </div>
            <button :style="closeBtnStyle">
              <X :size="16" />
            </button>
          </div>

          <!-- Body -->
          <div :style="bodyStyle">
            <!-- Error Summary -->
            <div :style="errorSummaryStyle">
              Network timeout - 2 operations failed
            </div>

            <!-- Error Item 1 -->
            <div :style="errorItemStyle">
              <div :style="errorEntityStyle">
                <CheckSquare :size="14" />
                <span :style="entityTypeStyle">Task</span>
                <span :style="entityIdStyle">task-123...</span>
              </div>
              <div :style="errorOperationStyle">Update</div>
              <div :style="errorDetailStyle">Network timeout after 30 seconds</div>
              <div :style="errorMetaStyle">
                <span>Attempt 3</span>
                <span>2m ago</span>
              </div>
            </div>

            <!-- Error Item 2 -->
            <div :style="errorItemStyle">
              <div :style="errorEntityStyle">
                <FolderKanban :size="14" />
                <span :style="entityTypeStyle">Group</span>
                <span :style="entityIdStyle">group-456...</span>
              </div>
              <div :style="errorOperationStyle">Create</div>
              <div :style="errorDetailStyle">duplicate key value violates unique constraint</div>
              <div :style="errorMetaStyle">
                <span>Attempt 2</span>
                <span>1m ago</span>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div :style="footerStyle">
            <button :style="retryBtnStyle">
              <RefreshCw :size="16" />
              Retry All
            </button>
            <button :style="clearBtnStyle">
              <Trash2 :size="16" />
              Clear All
            </button>
            <button :style="dismissBtnStyle">Dismiss</button>
          </div>
        </div>
      </div>
    `,
    data() {
      return {
        containerStyle, popoverStyle, headerStyle, headerIconStyle, headerTitleStyle,
        headerSubtitleStyle, closeBtnStyle, bodyStyle, errorSummaryStyle, errorItemStyle,
        errorEntityStyle, entityTypeStyle, entityIdStyle, errorOperationStyle,
        errorDetailStyle, errorMetaStyle, footerStyle, retryBtnStyle, clearBtnStyle, dismissBtnStyle
      }
    }
  })
}

// ============================================================================
// STORY 2: PERMANENT ERROR (corrupted data)
// ============================================================================

export const PermanentError: Story = {
  name: 'Permanent Error',
  render: () => ({
    components: { AlertTriangle, X, Trash2, CheckSquare, Ban },
    template: `
      <div :style="containerStyle">
        <div :style="popoverStyle">
          <!-- Header -->
          <div :style="headerStyle">
            <div :style="headerIconStyle">
              <AlertTriangle :size="20" />
            </div>
            <div style="flex: 1;">
              <h3 :style="headerTitleStyle">Sync Errors</h3>
              <p :style="headerSubtitleStyle">1 error (1 corrupted - click Clear All)</p>
            </div>
            <button :style="closeBtnStyle">
              <X :size="16" />
            </button>
          </div>

          <!-- Body -->
          <div :style="bodyStyle">
            <!-- Error Summary -->
            <div :style="errorSummaryStyle">
              Task data corrupted
            </div>

            <!-- Permanent Error Item -->
            <div :style="errorItemPermanentStyle">
              <div :style="errorEntityStyle">
                <CheckSquare :size="14" />
                <span :style="entityTypeStyle">Task</span>
                <span :style="entityIdStyle">task-789...</span>
                <span :style="permanentBadgeStyle">
                  <Ban :size="10" /> Corrupted
                </span>
              </div>
              <div :style="errorOperationStyle">Update</div>
              <div :style="errorDetailStyle">Task data corrupted: missing required field "title"</div>
              <div :style="errorMetaStyle">
                <span>Attempt 6</span>
                <span>30s ago</span>
                <span :style="noRetryHintStyle">Cannot retry</span>
              </div>
            </div>
          </div>

          <!-- Footer (no retry button for permanent errors) -->
          <div :style="footerStyle">
            <button :style="clearBtnStyle">
              <Trash2 :size="16" />
              Clear All
            </button>
            <button :style="dismissBtnStyle">Dismiss</button>
          </div>
        </div>
      </div>
    `,
    data() {
      return {
        containerStyle, popoverStyle, headerStyle, headerIconStyle, headerTitleStyle,
        headerSubtitleStyle, closeBtnStyle, bodyStyle, errorSummaryStyle,
        errorItemPermanentStyle, errorEntityStyle, entityTypeStyle, entityIdStyle,
        permanentBadgeStyle, errorOperationStyle, errorDetailStyle, errorMetaStyle,
        noRetryHintStyle, footerStyle, clearBtnStyle, dismissBtnStyle
      }
    }
  })
}

// ============================================================================
// STORY 3: EMPTY STATE
// ============================================================================

export const Empty: Story = {
  name: 'Empty (No Errors)',
  render: () => ({
    components: { AlertTriangle, X },
    template: `
      <div :style="containerStyle">
        <div :style="popoverStyle">
          <!-- Header -->
          <div :style="headerStyle">
            <div :style="headerIconStyle">
              <AlertTriangle :size="20" />
            </div>
            <div style="flex: 1;">
              <h3 :style="headerTitleStyle">Sync Errors</h3>
              <p :style="headerSubtitleStyle">0 errors</p>
            </div>
            <button :style="closeBtnStyle">
              <X :size="16" />
            </button>
          </div>

          <!-- Body -->
          <div :style="bodyStyle">
            <div style="text-align: center; padding: var(--space-6) 0; color: var(--text-muted); font-size: var(--text-sm);">
              No sync errors. Everything is up to date.
            </div>
          </div>
        </div>
      </div>
    `,
    data() {
      return {
        containerStyle: `position: relative; width: 100%; min-height: 280px; background: var(--overlay-backdrop-bg); display: flex; align-items: flex-start; justify-content: flex-end; padding: var(--space-6); border-radius: var(--radius-xl);`,
        popoverStyle, headerStyle, headerIconStyle, headerTitleStyle,
        headerSubtitleStyle, closeBtnStyle, bodyStyle
      }
    }
  })
}
