import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import { X, LayoutGrid, LayoutList, Rows } from 'lucide-vue-next'

/**
 * GroupEditModal - Canvas Group Configuration Modal
 *
 * Modal for editing canvas group properties: name, color, layout, collapse state, and visibility.
 * Appears in a centered overlay with glass morphism styling.
 *
 * **Form Fields:**
 * - Group Name (text input)
 * - Group Color (color picker + hex input)
 * - Layout (Grid/Vertical/Horizontal toggle buttons)
 * - Start Collapsed (checkbox)
 * - Visible (checkbox)
 *
 * **Note:** The real component uses `<Teleport to="body">` and `position: fixed`,
 * which breaks Storybook docs rendering. This story renders a static mock of the modal layout.
 */
const meta: Meta = {
  title: '🎨 Canvas/GroupEditModal',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `Glass morphism modal for editing canvas group properties.

**Layout:** Fixed overlay centered on screen with backdrop blur.

**Form Sections:**
- Name: Text input for group title
- Color: Color picker + hex text input side-by-side
- Layout: Three toggle buttons (Grid/Vertical/Horizontal)
- Options: Checkboxes for collapse/visible state

**Buttons:**
- Cancel (secondary, glass border)
- Save Changes (primary, teal border)

**Design Pattern:** Glass bg + colored borders. Primary action uses teal (var(--brand-primary)).

**Note:** Uses Teleport to body in real component. This story shows a static mock.`
      }
    }
  }
}

export default meta
type Story = StoryObj

// All styles as single-line strings — multiline breaks Storybook rendering
const S = {
  root: 'min-height:100vh; background:var(--surface-primary); display:flex; align-items:center; justify-content:center; padding:var(--space-4);',
  overlay: 'position:fixed; inset:0; background:var(--overlay-heavy); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center;',
  modal: 'background:var(--glass-bg-solid); backdrop-filter:blur(8px); border:1px solid var(--glass-border); border-radius:var(--radius-lg); box-shadow:var(--shadow-dark-xl); max-width:var(--space-125); width:90%; max-height:90vh; overflow:auto;',
  header: 'display:flex; align-items:center; justify-content:space-between; padding:var(--space-6); border-bottom:1px solid var(--glass-border);',
  title: 'font-size:var(--text-lg); font-weight:var(--font-semibold); color:var(--text-primary); margin:0;',
  closeBtn: 'background:transparent; border:1px solid transparent; color:var(--text-muted); cursor:pointer; padding:var(--space-2); border-radius:var(--radius-md);',
  body: 'padding:var(--space-6);',
  formGroup: 'margin-bottom:var(--space-5);',
  formGroupLast: 'margin-bottom:0;',
  label: 'display:block; font-size:var(--text-sm); font-weight:var(--font-medium); color:var(--text-primary); margin-bottom:var(--space-2);',
  input: 'width:100%; padding:var(--space-3); border:1px solid var(--glass-border); border-radius:var(--radius-md); background:var(--glass-bg-solid); color:var(--text-primary); font-size:var(--text-sm);',
  colorRow: 'display:flex; gap:var(--space-3); align-items:center;',
  colorPicker: 'width:60px; height:40px; border:1px solid var(--glass-border); border-radius:var(--radius-md); cursor:pointer; padding:var(--space-1);',
  colorText: 'flex:1; padding:var(--space-3); border:1px solid var(--glass-border); border-radius:var(--radius-md); background:var(--glass-bg-solid); color:var(--text-primary); font-size:var(--text-sm);',
  layoutRow: 'display:flex; gap:var(--space-3);',
  layoutBtn: 'flex:1; display:flex; flex-direction:column; align-items:center; gap:var(--space-2); padding:var(--space-4); border:1px solid var(--glass-border); border-radius:var(--radius-md); background:var(--glass-bg-solid); color:var(--text-secondary); cursor:pointer;',
  layoutBtnActive: 'flex:1; display:flex; flex-direction:column; align-items:center; gap:var(--space-2); padding:var(--space-4); border:1px solid var(--brand-primary); border-radius:var(--radius-md); background:transparent; color:var(--brand-primary); cursor:pointer;',
  checkboxLabel: 'display:flex; align-items:center; font-size:var(--text-sm); font-weight:var(--font-medium); color:var(--text-primary); cursor:pointer;',
  checkbox: 'margin-right:var(--space-2); width:16px; height:16px; cursor:pointer;',
  footer: 'display:flex; gap:var(--space-3); justify-content:flex-end; padding:var(--space-6); border-top:1px solid var(--glass-border);',
  btnSecondary: 'padding:var(--space-3) var(--space-4); border-radius:var(--radius-md); font-size:var(--text-sm); font-weight:var(--font-medium); cursor:pointer; background:transparent; border:1px solid var(--glass-border); color:var(--text-secondary);',
  btnPrimary: 'padding:var(--space-3) var(--space-4); border-radius:var(--radius-md); font-size:var(--text-sm); font-weight:var(--font-medium); cursor:pointer; background:transparent; border:1px solid var(--brand-primary); color:var(--brand-primary);',
  eventLog: 'margin-top:var(--space-6); padding:var(--space-4); background:var(--surface-secondary); border-radius:var(--radius-lg); width:100%; max-width:var(--space-125);',
  logTitle: 'color:var(--text-primary); margin:0 0 var(--space-2) 0; font-size:var(--text-base); font-weight:var(--font-semibold);',
  logEntry: 'color:var(--text-secondary); font-size:var(--text-sm); padding:var(--space-1) 0;',
}

/**
 * Default - Pre-filled Form
 *
 * Shows the modal with a pre-filled group: "Sprint Backlog", teal color, Grid layout, uncollapsed, visible.
 */
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Modal with pre-filled "Sprint Backlog" group. Teal color (#4ECDC4), Grid layout active, visible and not collapsed.'
      }
    }
  },
  render: () => ({
    components: { X, LayoutGrid, LayoutList, Rows },
    setup() {
      return { S }
    },
    template: `
      <div :style="S.root">
        <div :style="S.modal">
          <div :style="S.header">
            <h2 :style="S.title">Edit Group</h2>
            <button :style="S.closeBtn" aria-label="Close modal">
              <X :size="18" />
            </button>
          </div>

          <div :style="S.body">
            <div :style="S.formGroup">
              <label :style="S.label">Group Name</label>
              <input :style="S.input" type="text" placeholder="Enter group name" value="Sprint Backlog" />
            </div>

            <div :style="S.formGroup">
              <label :style="S.label">Group Color</label>
              <div :style="S.colorRow">
                <input :style="S.colorPicker" type="color" value="#4ECDC4" />
                <input :style="S.colorText" type="text" placeholder="#000000" value="#4ECDC4" />
              </div>
            </div>

            <div :style="S.formGroup">
              <label :style="S.label">Layout</label>
              <div :style="S.layoutRow">
                <button :style="S.layoutBtnActive">
                  <LayoutGrid :size="16" />
                  <span>Grid</span>
                </button>
                <button :style="S.layoutBtn">
                  <LayoutList :size="16" />
                  <span>Vertical</span>
                </button>
                <button :style="S.layoutBtn">
                  <Rows :size="16" />
                  <span>Horizontal</span>
                </button>
              </div>
            </div>

            <div :style="S.formGroup">
              <label :style="S.checkboxLabel">
                <input :style="S.checkbox" type="checkbox" />
                Start Collapsed
              </label>
            </div>

            <div :style="S.formGroupLast">
              <label :style="S.checkboxLabel">
                <input :style="S.checkbox" type="checkbox" checked />
                Visible
              </label>
            </div>
          </div>

          <div :style="S.footer">
            <button :style="S.btnSecondary">Cancel</button>
            <button :style="S.btnPrimary">Save Changes</button>
          </div>
        </div>
      </div>
    `
  })
}

/**
 * Empty Form
 *
 * Shows the modal with an empty form (no name, default indigo color, Grid layout).
 */
export const EmptyForm: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Modal with empty form. No group name entered, default indigo color (#6366f1), Grid layout selected.'
      }
    }
  },
  render: () => ({
    components: { X, LayoutGrid, LayoutList, Rows },
    setup() {
      return { S }
    },
    template: `
      <div :style="S.root">
        <div :style="S.modal">
          <div :style="S.header">
            <h2 :style="S.title">Edit Group</h2>
            <button :style="S.closeBtn" aria-label="Close modal">
              <X :size="18" />
            </button>
          </div>

          <div :style="S.body">
            <div :style="S.formGroup">
              <label :style="S.label">Group Name</label>
              <input :style="S.input" type="text" placeholder="Enter group name" value="" />
            </div>

            <div :style="S.formGroup">
              <label :style="S.label">Group Color</label>
              <div :style="S.colorRow">
                <input :style="S.colorPicker" type="color" value="#6366f1" />
                <input :style="S.colorText" type="text" placeholder="#000000" value="#6366f1" />
              </div>
            </div>

            <div :style="S.formGroup">
              <label :style="S.label">Layout</label>
              <div :style="S.layoutRow">
                <button :style="S.layoutBtnActive">
                  <LayoutGrid :size="16" />
                  <span>Grid</span>
                </button>
                <button :style="S.layoutBtn">
                  <LayoutList :size="16" />
                  <span>Vertical</span>
                </button>
                <button :style="S.layoutBtn">
                  <Rows :size="16" />
                  <span>Horizontal</span>
                </button>
              </div>
            </div>

            <div :style="S.formGroup">
              <label :style="S.checkboxLabel">
                <input :style="S.checkbox" type="checkbox" />
                Start Collapsed
              </label>
            </div>

            <div :style="S.formGroupLast">
              <label :style="S.checkboxLabel">
                <input :style="S.checkbox" type="checkbox" checked />
                Visible
              </label>
            </div>
          </div>

          <div :style="S.footer">
            <button :style="S.btnSecondary">Cancel</button>
            <button :style="S.btnPrimary">Save Changes</button>
          </div>
        </div>
      </div>
    `
  })
}

/**
 * Interactive - Form with State
 *
 * Interactive version with reactive state. Form fields update in real-time and button clicks are logged.
 */
export const Interactive: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Interactive modal with reactive form state. Change fields and click buttons to see events logged below the modal.'
      }
    }
  },
  render: () => ({
    components: { X, LayoutGrid, LayoutList, Rows },
    setup() {
      const logs = ref<string[]>([])
      const formData = ref({
        name: 'Sprint Backlog',
        color: '#4ECDC4',
        layout: 'grid' as 'grid' | 'vertical' | 'horizontal',
        isCollapsed: false,
        isVisible: true
      })

      const addLog = (msg: string) => {
        logs.value.push(`[${new Date().toLocaleTimeString()}] ${msg}`)
      }

      const setLayout = (layout: 'grid' | 'vertical' | 'horizontal') => {
        formData.value.layout = layout
        addLog(`Layout changed to: ${layout}`)
      }

      const handleSave = () => {
        if (!formData.value.name.trim()) {
          addLog('❌ Save failed: Group name is required')
          return
        }
        addLog(`✅ Saved group: "${formData.value.name}" (${formData.value.color}, ${formData.value.layout})`)
      }

      return { S, formData, logs, addLog, setLayout, handleSave }
    },
    template: `
      <div :style="S.root" style="flex-direction:column;">
        <div :style="S.modal">
          <div :style="S.header">
            <h2 :style="S.title">Edit Group</h2>
            <button :style="S.closeBtn" aria-label="Close modal" @click="addLog('Close button clicked')">
              <X :size="18" />
            </button>
          </div>

          <div :style="S.body">
            <div :style="S.formGroup">
              <label :style="S.label">Group Name</label>
              <input
                :style="S.input"
                type="text"
                placeholder="Enter group name"
                v-model="formData.name"
                @input="addLog('Name changed: ' + formData.name)"
              />
            </div>

            <div :style="S.formGroup">
              <label :style="S.label">Group Color</label>
              <div :style="S.colorRow">
                <input
                  :style="S.colorPicker"
                  type="color"
                  v-model="formData.color"
                  @input="addLog('Color changed: ' + formData.color)"
                />
                <input
                  :style="S.colorText"
                  type="text"
                  placeholder="#000000"
                  v-model="formData.color"
                  @input="addLog('Color hex updated: ' + formData.color)"
                />
              </div>
            </div>

            <div :style="S.formGroup">
              <label :style="S.label">Layout</label>
              <div :style="S.layoutRow">
                <button
                  :style="formData.layout === 'grid' ? S.layoutBtnActive : S.layoutBtn"
                  @click="setLayout('grid')"
                >
                  <LayoutGrid :size="16" />
                  <span>Grid</span>
                </button>
                <button
                  :style="formData.layout === 'vertical' ? S.layoutBtnActive : S.layoutBtn"
                  @click="setLayout('vertical')"
                >
                  <LayoutList :size="16" />
                  <span>Vertical</span>
                </button>
                <button
                  :style="formData.layout === 'horizontal' ? S.layoutBtnActive : S.layoutBtn"
                  @click="setLayout('horizontal')"
                >
                  <Rows :size="16" />
                  <span>Horizontal</span>
                </button>
              </div>
            </div>

            <div :style="S.formGroup">
              <label :style="S.checkboxLabel">
                <input
                  :style="S.checkbox"
                  type="checkbox"
                  v-model="formData.isCollapsed"
                  @change="addLog('Start Collapsed: ' + formData.isCollapsed)"
                />
                Start Collapsed
              </label>
            </div>

            <div :style="S.formGroupLast">
              <label :style="S.checkboxLabel">
                <input
                  :style="S.checkbox"
                  type="checkbox"
                  v-model="formData.isVisible"
                  @change="addLog('Visible: ' + formData.isVisible)"
                />
                Visible
              </label>
            </div>
          </div>

          <div :style="S.footer">
            <button :style="S.btnSecondary" @click="addLog('Cancel clicked')">Cancel</button>
            <button :style="S.btnPrimary" @click="handleSave">Save Changes</button>
          </div>
        </div>

        <div :style="S.eventLog">
          <h3 :style="S.logTitle">Event Log</h3>
          <div v-for="(log, i) in logs" :key="i" :style="S.logEntry">{{ log }}</div>
        </div>
      </div>
    `
  })
}
