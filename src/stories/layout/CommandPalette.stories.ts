import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'

/**
 * CommandPalette - Quick Task Creation
 *
 * Modal overlay triggered by Cmd+K / Ctrl+K for rapid task entry.
 * Uses progressive disclosure: simple title input first, then
 * expandable fields for priority, project, and due date.
 *
 * **Note:** The real component uses `useTaskStore()` and `<Teleport to="body">`,
 * so this story renders a static visual replica of the palette layout.
 */
const meta: Meta = {
  title: '🏢 Layout/CommandPalette',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `Quick task creation palette triggered by Cmd+K.

**Layout:** Centered modal with backdrop blur overlay.

**Features:**
- Search/title input with auto-focus
- Progressive disclosure for metadata fields
- Keyboard navigation (Escape to close, Enter to create)
- Project selector, priority, due date

**Note:** Uses Teleport + useTaskStore in real component. This story shows a static visual replica.`
      }
    }
  }
}

export default meta
type Story = StoryObj

const S = {
  page: 'min-height:100vh; background:var(--app-background-gradient); display:flex; align-items:flex-start; justify-content:center; padding:var(--space-20) var(--space-4);',
  overlay: 'position:fixed; inset:0; background:var(--overlay-bg); backdrop-filter:blur(4px);',
  palette: 'position:relative; width:100%; max-width:560px; background:var(--surface-secondary); border:1px solid var(--border-medium); border-radius:var(--radius-lg); box-shadow:0 24px 48px var(--overlay-bg); backdrop-filter:blur(20px); overflow:hidden;',
  inputRow: 'display:flex; align-items:center; gap:var(--space-3); padding:var(--space-4) var(--space-5); border-bottom:1px solid var(--border-subtle);',
  searchIcon: 'flex-shrink:0; color:var(--text-muted);',
  input: 'flex:1; background:transparent; border:none; outline:none; color:var(--text-primary); font-size:var(--text-base); font-weight:400;',
  kbd: 'padding:var(--space-0_5) var(--space-1_5); background:var(--glass-bg-light); border:1px solid var(--glass-border); border-radius:var(--radius-xs); font-size:var(--text-xs); color:var(--text-muted); font-family:monospace;',
  metaRow: 'display:flex; align-items:center; gap:var(--space-2); padding:var(--space-3) var(--space-5); border-bottom:1px solid var(--border-subtle);',
  metaChip: 'display:flex; align-items:center; gap:var(--space-1_5); padding:var(--space-1_5) var(--space-2_5); background:var(--glass-bg-heavy); border:1px solid var(--glass-border); border-radius:var(--radius-md); font-size:var(--text-xs); color:var(--text-secondary); cursor:pointer;',
  metaChipActive: 'display:flex; align-items:center; gap:var(--space-1_5); padding:var(--space-1_5) var(--space-2_5); background:var(--brand-primary-subtle); border:1px solid var(--brand-primary-dim); border-radius:var(--radius-md); font-size:var(--text-xs); color:var(--brand-primary); cursor:pointer;',
  footer: 'display:flex; align-items:center; justify-content:space-between; padding:var(--space-2_5) var(--space-5); background:var(--glass-bg-tint);',
  footerHint: 'display:flex; align-items:center; gap:var(--space-3); font-size:var(--text-xs); color:var(--text-subtle);',
  footerHintItem: 'display:flex; align-items:center; gap:var(--space-1);',
  createBtn: 'padding:var(--space-1_5) var(--space-3_5); background:var(--brand-primary-subtle); border:1px solid var(--state-active-border); border-radius:var(--radius-md); font-size:var(--text-xs); font-weight:600; color:var(--brand-primary); cursor:pointer; backdrop-filter:blur(8px);',
  createBtnDisabled: 'padding:var(--space-1_5) var(--space-3_5); background:var(--glass-bg-medium); border:1px solid var(--border-subtle); border-radius:var(--radius-md); font-size:var(--text-xs); font-weight:600; color:var(--text-disabled); cursor:default;',
  suggestion: 'display:flex; align-items:center; gap:var(--space-3); padding:var(--space-2_5) var(--space-5); cursor:pointer;',
  suggestionHover: 'display:flex; align-items:center; gap:var(--space-3); padding:var(--space-2_5) var(--space-5); background:var(--glass-glow); cursor:pointer;',
  suggestionIcon: 'width:32px; height:32px; border-radius:var(--radius-md); background:var(--glass-bg-heavy); border:1px solid var(--border-subtle); display:flex; align-items:center; justify-content:center;',
  suggestionText: 'flex:1;',
  suggestionTitle: 'font-size:var(--text-meta); color:var(--text-secondary); margin-bottom:var(--space-0_5);',
  suggestionDesc: 'font-size:var(--text-xs); color:var(--text-muted);',
}

/**
 * Default - Empty State
 *
 * Command palette with empty input, ready for task title entry.
 */
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Empty command palette ready for input. Shows the search icon, placeholder text, and keyboard shortcut hint.'
      }
    }
  },
  render: () => ({
    setup() { return { S } },
    template: `
      <div :style="S.page">
        <div :style="S.palette">
          <!-- Input Row -->
          <div :style="S.inputRow">
            <svg :style="S.searchIcon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input :style="S.input" placeholder="Type a task title or search..." readonly />
            <span :style="S.kbd">Esc</span>
          </div>

          <!-- Metadata Row -->
          <div :style="S.metaRow">
            <div :style="S.metaChip">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              Inbox
            </div>
            <div :style="S.metaChip">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              Priority
            </div>
            <div :style="S.metaChip">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Due date
            </div>
          </div>

          <!-- Footer -->
          <div :style="S.footer">
            <div :style="S.footerHint">
              <span :style="S.footerHintItem"><span :style="S.kbd">Enter</span> Create</span>
              <span :style="S.footerHintItem"><span :style="S.kbd">Tab</span> Next field</span>
            </div>
            <button :style="S.createBtnDisabled">Create Task</button>
          </div>
        </div>
      </div>
    `
  })
}

/**
 * With Task Title
 *
 * Command palette with a task title entered and ready to create.
 */
export const WithTaskTitle: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Palette with task title filled in. The Create button becomes active (teal) when a title is present.'
      }
    }
  },
  render: () => ({
    setup() { return { S } },
    template: `
      <div :style="S.page">
        <div :style="S.palette">
          <!-- Input Row -->
          <div :style="S.inputRow">
            <svg :style="S.searchIcon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input :style="S.input" value="Fix authentication redirect loop" readonly />
            <span :style="S.kbd">Esc</span>
          </div>

          <!-- Metadata Row -->
          <div :style="S.metaRow">
            <div :style="S.metaChipActive">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              Work Project
            </div>
            <div :style="S.metaChip">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              Priority
            </div>
            <div :style="S.metaChip">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Due date
            </div>
          </div>

          <!-- Footer -->
          <div :style="S.footer">
            <div :style="S.footerHint">
              <span :style="S.footerHintItem"><span :style="S.kbd">Enter</span> Create</span>
              <span :style="S.footerHintItem"><span :style="S.kbd">Tab</span> Next field</span>
            </div>
            <button :style="S.createBtn">Create Task</button>
          </div>
        </div>
      </div>
    `
  })
}

/**
 * With All Metadata
 *
 * Command palette with all metadata fields filled: project, priority, and due date.
 */
export const WithAllMetadata: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Palette with all fields populated — project, priority (High), and due date. Shows full progressive disclosure.'
      }
    }
  },
  render: () => ({
    setup() { return { S } },
    template: `
      <div :style="S.page">
        <div :style="S.palette">
          <!-- Input Row -->
          <div :style="S.inputRow">
            <svg :style="S.searchIcon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input :style="S.input" value="Deploy production hotfix for OAuth" readonly />
            <span :style="S.kbd">Esc</span>
          </div>

          <!-- Metadata Row -->
          <div :style="S.metaRow">
            <div :style="S.metaChipActive">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              Work Project
            </div>
            <div style="display:flex; align-items:center; gap:var(--space-1_5); padding:var(--space-1_5) var(--space-2_5); background:var(--priority-high-bg); border:1px solid var(--priority-high-border); border-radius:var(--radius-md); font-size:var(--text-xs); color:var(--priority-high-text); cursor:pointer;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              High
            </div>
            <div :style="S.metaChipActive">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Today
            </div>
          </div>

          <!-- Footer -->
          <div :style="S.footer">
            <div :style="S.footerHint">
              <span :style="S.footerHintItem"><span :style="S.kbd">Enter</span> Create</span>
              <span :style="S.footerHintItem"><span :style="S.kbd">Tab</span> Next field</span>
            </div>
            <button :style="S.createBtn">Create Task</button>
          </div>
        </div>
      </div>
    `
  })
}

/**
 * Interactive - Toggle States
 *
 * Interactive version with clickable metadata chips that toggle states.
 */
export const Interactive: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Interactive palette mock — click metadata chips to toggle active state. Demonstrates the progressive disclosure pattern.'
      }
    }
  },
  render: () => ({
    setup() {
      const title = ref('')
      const project = ref('Inbox')
      const priority = ref('')
      const dueDate = ref('')
      const projects = ['Inbox', 'Work Project', 'Personal', 'Learning Vue']
      const priorities = ['', 'Low', 'Medium', 'High']
      const dates = ['', 'Today', 'Tomorrow', 'This Week']
      const logs = ref<string[]>([])

      const cycleProject = () => {
        const idx = projects.indexOf(project.value)
        project.value = projects[(idx + 1) % projects.length]
        logs.value.push(`Project: ${project.value}`)
      }
      const cyclePriority = () => {
        const idx = priorities.indexOf(priority.value)
        priority.value = priorities[(idx + 1) % priorities.length]
        logs.value.push(`Priority: ${priority.value || 'None'}`)
      }
      const cycleDate = () => {
        const idx = dates.indexOf(dueDate.value)
        dueDate.value = dates[(idx + 1) % dates.length]
        logs.value.push(`Due: ${dueDate.value || 'None'}`)
      }
      const createTask = () => {
        if (!title.value.trim()) return
        logs.value.push(`Created: "${title.value}" [${project.value}] ${priority.value} ${dueDate.value}`)
        title.value = ''
      }

      return { S, title, project, priority, dueDate, logs, cycleProject, cyclePriority, cycleDate, createTask }
    },
    template: `
      <div :style="S.page">
        <div style="display:flex; flex-direction:column; gap:var(--space-5); width:100%; max-width:560px;">
          <div :style="S.palette">
            <!-- Input Row -->
            <div :style="S.inputRow">
              <svg :style="S.searchIcon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input :style="S.input" v-model="title" placeholder="Type a task title..." />
              <span :style="S.kbd">Esc</span>
            </div>

            <!-- Metadata Row -->
            <div :style="S.metaRow">
              <div :style="project !== 'Inbox' ? S.metaChipActive : S.metaChip" @click="cycleProject">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                {{ project }}
              </div>
              <div :style="priority ? S.metaChipActive : S.metaChip" @click="cyclePriority">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                {{ priority || 'Priority' }}
              </div>
              <div :style="dueDate ? S.metaChipActive : S.metaChip" @click="cycleDate">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                {{ dueDate || 'Due date' }}
              </div>
            </div>

            <!-- Footer -->
            <div :style="S.footer">
              <div :style="S.footerHint">
                <span :style="S.footerHintItem"><span :style="S.kbd">Enter</span> Create</span>
                <span :style="S.footerHintItem"><span :style="S.kbd">Tab</span> Next field</span>
              </div>
              <button :style="title.trim() ? S.createBtn : S.createBtnDisabled" @click="createTask">Create Task</button>
            </div>
          </div>

          <!-- Event Log -->
          <div v-if="logs.length" style="padding:var(--space-4); background:var(--glass-bg-medium); border:1px solid var(--border-subtle); border-radius:var(--radius-lg);">
            <h3 style="color:var(--text-secondary); margin:0 0 var(--space-2) 0; font-size:var(--text-xs); text-transform:uppercase; letter-spacing:0.05em;">Event Log</h3>
            <div v-for="(log, i) in logs" :key="i" style="color:var(--text-muted); font-size:var(--text-xs); padding:var(--space-1) 0; font-family:monospace;">{{ log }}</div>
          </div>
        </div>
      </div>
    `
  })
}
