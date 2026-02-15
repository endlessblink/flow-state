import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import { ChevronDown, Check } from 'lucide-vue-next'

/**
 * GroupSettingsMenu - Canvas Group Configuration
 *
 * Settings modal for canvas groups. Configures auto-assign behavior
 * when tasks are dropped into a group (priority, status, due date).
 *
 * **Note:** The real component uses CustomSelect and store dependencies.
 * This story renders a static mock matching the app's glass morphism design.
 */
const meta: Meta = {
  title: '🎨 Canvas/GroupSettingsMenu',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `Settings modal for canvas groups with auto-assign configuration.

**Form Fields:**
- Priority auto-assign (None/High/Medium/Low)
- Status auto-assign (None/Planned/In Progress/Done)
- Due Date auto-assign (None/Today/Tomorrow/Next Week)

**Design Pattern:** Glass bg + colored borders. Primary action uses teal border + text (never solid fill). Dropdowns use purple-tinted glass with backdrop-filter blur.

**Note:** Uses CustomSelect in real component. This story shows a static mock.`
      }
    }
  }
}

export default meta
type Story = StoryObj

// All styles as single-line strings — multiline breaks Storybook rendering
const S = {
  root: 'display:flex; align-items:center; justify-content:center; min-height:100vh; background:var(--surface-primary); padding:var(--space-4);',
  modal: 'width:400px; background:var(--overlay-component-bg); backdrop-filter:blur(8px); border:1px solid var(--glass-border); border-radius:var(--radius-xl); overflow:visible; box-shadow:var(--shadow-2xl);',
  header: 'display:flex; align-items:center; justify-content:space-between; padding:var(--space-4); border-bottom:1px solid var(--glass-border);',
  title: 'font-size:var(--text-lg); font-weight:var(--font-semibold); color:var(--text-primary); margin:0; display:flex; align-items:center; gap:var(--space-2);',
  closeBtn: 'background:transparent; border:1px solid transparent; color:var(--text-muted); cursor:pointer; padding:var(--space-1); border-radius:var(--radius-md); font-size:var(--text-base);',
  body: 'padding:var(--space-4); display:flex; flex-direction:column; gap:var(--space-4);',
  statusRow: 'display:flex; align-items:center; gap:var(--space-2);',
  statusName: 'font-size:var(--text-base); font-weight:var(--font-medium); color:var(--text-primary);',
  statusBadge: 'font-size:var(--text-xs); padding:2px var(--space-2); background:var(--glass-bg-soft); color:var(--text-secondary); border:1px solid var(--glass-border); border-radius:var(--radius-full);',
  sectionTitle: 'font-size:var(--text-sm); font-weight:var(--font-semibold); color:var(--text-primary); margin:0 0 var(--space-1); display:flex; align-items:center; gap:var(--space-1);',
  sectionDesc: 'font-size:var(--text-xs); color:var(--text-muted); margin:0 0 var(--space-3);',
  fields: 'display:flex; flex-direction:column; gap:var(--space-3);',
  label: 'display:block; font-size:var(--text-xs); font-weight:var(--font-medium); color:var(--text-secondary); margin-bottom:var(--space-1);',
  // CustomSelect trigger — matches real component
  selectTrigger: 'width:100%; display:flex; align-items:center; justify-content:space-between; gap:var(--space-1); padding:0 var(--space-2); background:transparent; border:1px solid var(--glass-border); border-radius:var(--radius-sm); color:var(--text-primary); font-size:var(--text-xs); font-weight:var(--font-medium); height:28px; line-height:1; cursor:pointer; outline:none; text-align:left;',
  selectTriggerOpen: 'width:100%; display:flex; align-items:center; justify-content:space-between; gap:var(--space-1); padding:0 var(--space-2); background:transparent; border:1px solid var(--brand-primary); border-radius:var(--radius-sm); color:var(--text-primary); font-size:var(--text-xs); font-weight:var(--font-medium); height:28px; line-height:1; cursor:pointer; outline:none; text-align:left;',
  selectValue: 'flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;',
  selectIcon: 'flex-shrink:0; color:var(--text-muted); transition:transform 150ms ease;',
  selectIconOpen: 'flex-shrink:0; color:rgba(78,205,196,0.8); transform:rotate(180deg); transition:transform 150ms ease;',
  // Dropdown panel — purple-tinted glass with blur (matches real CustomSelect)
  selectWrapper: 'position:relative;',
  dropdown: 'position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:9999; background:rgba(35,32,50,0.65); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); border:1px solid rgba(255,255,255,0.12); box-shadow:0 8px 32px rgba(0,0,0,0.3),0 0 0 1px rgba(255,255,255,0.08) inset; border-radius:var(--radius-md); max-height:200px; overflow-y:auto; padding:var(--space-1); list-style:none; margin:0;',
  option: 'display:flex; align-items:center; justify-content:space-between; gap:var(--space-2); padding:var(--space-1_5) var(--space-2); background:transparent; border:1px solid transparent; border-radius:var(--radius-md); color:var(--text-primary); font-size:var(--text-xs); cursor:pointer; user-select:none; white-space:nowrap; min-height:28px;',
  optionHover: 'display:flex; align-items:center; justify-content:space-between; gap:var(--space-2); padding:var(--space-1_5) var(--space-2); background:var(--surface-hover); border:1px solid transparent; border-radius:var(--radius-md); color:var(--text-primary); font-size:var(--text-xs); cursor:pointer; user-select:none; white-space:nowrap; min-height:28px;',
  footer: 'display:flex; justify-content:flex-end; gap:var(--space-2); padding:var(--space-3) var(--space-4); border-top:1px solid var(--glass-border);',
  btnSecondary: 'padding:var(--space-2) var(--space-4); background:transparent; border:1px solid var(--glass-border); border-radius:var(--radius-md); color:var(--text-secondary); cursor:pointer; font-size:var(--text-sm); backdrop-filter:blur(8px);',
  btnPrimary: 'padding:var(--space-2) var(--space-4); background:transparent; border:1px solid var(--brand-primary); border-radius:var(--radius-md); color:var(--brand-primary); cursor:pointer; font-size:var(--text-sm); font-weight:var(--font-medium); backdrop-filter:blur(8px);',
}

/**
 * Default - In Progress Group
 *
 * Group settings with interactive custom dropdowns matching the glass morphism design.
 */
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Group settings with interactive CustomSelect-style dropdowns (purple glass with blur) and glass-style buttons (teal border, never solid fill).'
      }
    }
  },
  render: () => ({
    components: { ChevronDown, Check },
    setup() {
      const priority = ref({ value: '', label: 'No auto-assign' })
      const status = ref({ value: '', label: 'No auto-assign' })
      const dueDate = ref({ value: '', label: 'No auto-assign' })

      const openDropdown = ref<string | null>(null)
      const hoveredIndex = ref(-1)

      const priorityOptions = [
        { value: '', label: 'No auto-assign' },
        { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' },
        { value: 'low', label: 'Low' },
      ]
      const statusOptions = [
        { value: '', label: 'No auto-assign' },
        { value: 'planned', label: 'Planned' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'done', label: 'Done' },
      ]
      const dueDateOptions = [
        { value: '', label: 'No auto-assign' },
        { value: 'today', label: 'Today' },
        { value: 'tomorrow', label: 'Tomorrow' },
        { value: 'next_week', label: 'Next Week' },
      ]

      const toggleDropdown = (name: string) => {
        openDropdown.value = openDropdown.value === name ? null : name
        hoveredIndex.value = -1
      }

      const selectOption = (field: any, option: any) => {
        field.value = option
        openDropdown.value = null
      }

      return {
        S, priority, status, dueDate, openDropdown, hoveredIndex,
        priorityOptions, statusOptions, dueDateOptions,
        toggleDropdown, selectOption
      }
    },
    template: `
      <div :style="S.root" @click.self="openDropdown = null">
        <div :style="S.modal">
          <div :style="S.header">
            <h2 :style="S.title">⚙️ Group Settings</h2>
            <button :style="S.closeBtn">✕</button>
          </div>

          <div :style="S.body">
            <div :style="S.statusRow">
              <span :style="S.statusName">In Progress</span>
              <span :style="S.statusBadge">⚡ Detected: In Progress</span>
            </div>

            <div>
              <h3 :style="S.sectionTitle">⚡ Auto-assign when task dropped</h3>
              <p :style="S.sectionDesc">Tasks dropped into this group will have these properties set</p>

              <div :style="S.fields">
                <div>
                  <label :style="S.label">Priority</label>
                  <div :style="S.selectWrapper">
                    <button :style="openDropdown === 'priority' ? S.selectTriggerOpen : S.selectTrigger" @click="toggleDropdown('priority')">
                      <span :style="S.selectValue">{{ priority.label }}</span>
                      <ChevronDown :size="14" :style="openDropdown === 'priority' ? S.selectIconOpen : S.selectIcon" />
                    </button>
                    <ul v-if="openDropdown === 'priority'" :style="S.dropdown">
                      <li v-for="(opt, i) in priorityOptions" :key="opt.value"
                        :style="hoveredIndex === i ? S.optionHover : S.option"
                        @mouseenter="hoveredIndex = i" @mouseleave="hoveredIndex = -1"
                        @click="selectOption(priority, opt)">
                        <span>{{ opt.label }}</span>
                        <Check v-if="priority.value === opt.value" :size="14" style="opacity:0.7;" />
                      </li>
                    </ul>
                  </div>
                </div>
                <div>
                  <label :style="S.label">Status</label>
                  <div :style="S.selectWrapper">
                    <button :style="openDropdown === 'status' ? S.selectTriggerOpen : S.selectTrigger" @click="toggleDropdown('status')">
                      <span :style="S.selectValue">{{ status.label }}</span>
                      <ChevronDown :size="14" :style="openDropdown === 'status' ? S.selectIconOpen : S.selectIcon" />
                    </button>
                    <ul v-if="openDropdown === 'status'" :style="S.dropdown">
                      <li v-for="(opt, i) in statusOptions" :key="opt.value"
                        :style="hoveredIndex === i + 100 ? S.optionHover : S.option"
                        @mouseenter="hoveredIndex = i + 100" @mouseleave="hoveredIndex = -1"
                        @click="selectOption(status, opt)">
                        <span>{{ opt.label }}</span>
                        <Check v-if="status.value === opt.value" :size="14" style="opacity:0.7;" />
                      </li>
                    </ul>
                  </div>
                </div>
                <div>
                  <label :style="S.label">Due Date</label>
                  <div :style="S.selectWrapper">
                    <button :style="openDropdown === 'dueDate' ? S.selectTriggerOpen : S.selectTrigger" @click="toggleDropdown('dueDate')">
                      <span :style="S.selectValue">{{ dueDate.label }}</span>
                      <ChevronDown :size="14" :style="openDropdown === 'dueDate' ? S.selectIconOpen : S.selectIcon" />
                    </button>
                    <ul v-if="openDropdown === 'dueDate'" :style="S.dropdown">
                      <li v-for="(opt, i) in dueDateOptions" :key="opt.value"
                        :style="hoveredIndex === i + 200 ? S.optionHover : S.option"
                        @mouseenter="hoveredIndex = i + 200" @mouseleave="hoveredIndex = -1"
                        @click="selectOption(dueDate, opt)">
                        <span>{{ opt.label }}</span>
                        <Check v-if="dueDate.value === opt.value" :size="14" style="opacity:0.7;" />
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div :style="S.footer">
            <button :style="S.btnSecondary">Cancel</button>
            <button :style="S.btnPrimary">Save</button>
          </div>
        </div>
      </div>
    `
  })
}
