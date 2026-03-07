import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import { Plus, FolderPlus, Calendar, CalendarX } from 'lucide-vue-next'

/**
 * CanvasToolbar - Edge-mounted Canvas Controls
 *
 * Vertical toolbar fixed to the right edge of the canvas viewport.
 * Contains primary actions and filter toggles.
 *
 * **Actions:**
 * - Add Task (primary, indigo)
 * - Create Group
 * - Toggle hide overdue tasks
 *
 * **Note:** The real component uses `<Teleport to="body">` and `useTaskStore()`,
 * so this story renders a static mock of the toolbar layout.
 */
const meta: Meta = {
  title: '🎨 Canvas/CanvasToolbar',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `Edge-mounted vertical toolbar for canvas controls.

**Layout:** Fixed right edge, vertical flex column with icon buttons.

**Buttons:**
- Add Task (indigo, primary action)
- Create Group (secondary)
- Hide overdue toggle (orange when active)

**Note:** Uses Teleport to body in real component. This story shows a static mock.`
      }
    }
  }
}

export default meta
type Story = StoryObj

// All styles as single-line strings — multiline breaks Storybook rendering
const S = {
  root: 'min-height:100vh; background:var(--surface-primary); display:flex; justify-content:flex-end; padding:16px;',
  rootInteractive: 'min-height:100vh; background:var(--surface-primary); padding:16px; display:flex; flex-direction:column; align-items:flex-end;',
  toolbar: 'display:flex; flex-direction:column; align-items:center; gap:4px; padding:6px; border-radius:var(--radius-md); background:rgba(28,25,45,0.9); backdrop-filter:blur(12px); border:1px solid var(--glass-border); box-shadow:0 4px 12px rgba(0,0,0,0.3);',
  group: 'display:flex; flex-direction:column; align-items:center; gap:2px;',
  separator: 'width:24px; height:1px; background:var(--glass-border); margin:2px 0;',
  btn: 'display:flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:var(--radius-sm); color:var(--text-secondary); background:transparent; border:1px solid transparent; cursor:pointer;',
  btnPrimary: 'display:flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:var(--radius-sm); background:rgba(99,102,241,0.2); color:#818cf8; border:1px solid rgba(99,102,241,0.4); cursor:pointer;',
  btnActiveOverdue: 'display:flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:var(--radius-sm); color:#fb923c; background:rgba(249,115,22,0.15); border:1px solid rgba(249,115,22,0.4); cursor:pointer;',
  eventLog: 'margin-top:24px; padding:16px; background:var(--surface-secondary); border-radius:var(--radius-lg); width:300px;',
  logTitle: 'color:var(--text-primary); margin:0 0 8px 0;',
  logEntry: 'color:var(--text-secondary); font-size:var(--text-sm); padding:4px 0;',
}

/**
 * Default - Static Layout
 *
 * Shows the toolbar layout with all buttons in their default state.
 */
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Default toolbar with Add Task (indigo), Create Group, and Hide Overdue toggle.'
      }
    }
  },
  render: () => ({
    components: { Plus, FolderPlus, Calendar },
    setup() {
      return { S }
    },
    template: `
      <div :style="S.root">
        <div :style="S.toolbar">
          <div :style="S.group">
            <button :style="S.btnPrimary" title="Add Task to Inbox"><Plus :size="14" /></button>
            <button :style="S.btn" title="Create New Group"><FolderPlus :size="14" /></button>
          </div>
          <div :style="S.separator"></div>
          <div :style="S.group">
            <button :style="S.btn" title="Hide overdue tasks"><Calendar :size="14" /></button>
          </div>
        </div>
      </div>
    `
  })
}

/**
 * With Overdue Filter Active
 *
 * Shows the toolbar with the overdue filter toggled on (orange highlight).
 */
export const OverdueFilterActive: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Toolbar with overdue tasks filter active — button turns orange.'
      }
    }
  },
  render: () => ({
    components: { Plus, FolderPlus, CalendarX },
    setup() {
      return { S }
    },
    template: `
      <div :style="S.root">
        <div :style="S.toolbar">
          <div :style="S.group">
            <button :style="S.btnPrimary" title="Add Task to Inbox"><Plus :size="14" /></button>
            <button :style="S.btn" title="Create New Group"><FolderPlus :size="14" /></button>
          </div>
          <div :style="S.separator"></div>
          <div :style="S.group">
            <button :style="S.btnActiveOverdue" title="Show overdue tasks"><CalendarX :size="14" /></button>
          </div>
        </div>
      </div>
    `
  })
}

/**
 * Interactive - Click Events
 *
 * Interactive version that logs button clicks to an event log.
 */
export const Interactive: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Interactive toolbar that logs button clicks to an event log panel below.'
      }
    }
  },
  render: () => ({
    components: { Plus, FolderPlus, Calendar, CalendarX },
    setup() {
      const logs = ref<string[]>([])
      const overdueHidden = ref(false)
      const addLog = (msg: string) => logs.value.push(msg)
      const toggleOverdue = () => {
        overdueHidden.value = !overdueHidden.value
        addLog(overdueHidden.value ? 'Overdue tasks hidden' : 'Overdue tasks shown')
      }
      return { S, logs, overdueHidden, addLog, toggleOverdue }
    },
    template: `
      <div :style="S.rootInteractive">
        <div :style="S.toolbar">
          <div :style="S.group">
            <button :style="S.btnPrimary" title="Add Task" @click="addLog('Add task clicked')"><Plus :size="14" /></button>
            <button :style="S.btn" title="Create Group" @click="addLog('Create group clicked')"><FolderPlus :size="14" /></button>
          </div>
          <div :style="S.separator"></div>
          <div :style="S.group">
            <button :style="overdueHidden ? S.btnActiveOverdue : S.btn" @click="toggleOverdue">
              <CalendarX v-if="overdueHidden" :size="14" />
              <Calendar v-else :size="14" />
            </button>
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
