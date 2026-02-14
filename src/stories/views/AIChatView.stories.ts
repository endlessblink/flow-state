import type { Meta, StoryObj } from '@storybook/vue3'
import { createPinia, setActivePinia } from 'pinia'
import { Sparkles } from 'lucide-vue-next'
import AIChatView from '@/views/AIChatView.vue'

/**
 * AIChatView - AI Assistant Full-Screen Interface
 *
 * A dedicated full-screen AI chat interface with two-column layout:
 * - Left sidebar: conversation list + agent chain buttons
 * - Right area: chat messages, input, quick actions
 *
 * **Features:**
 * - Multiple conversation management
 * - Provider selection (Groq, OpenRouter, Ollama)
 * - Model selection per provider
 * - Quick actions (Plan my day, What's overdue?, etc.)
 * - Voice input support
 * - Undo last AI action
 * - Personality toggle (Professional / Grid Handler)
 *
 * **Store Dependencies:**
 * - aiChatStore: Conversation and message state
 * - taskStore: Task context for AI operations
 * - timerStore: Timer status for quick actions
 */
const meta: Meta = {
  title: '✨ Views/AIChatView',
  tags: ['autodocs', 'new'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `Full-screen AI chat interface with conversation management and provider selection.

**Key Components:**
- Conversation sidebar with history
- Chat message area with markdown support
- Provider settings (Groq/OpenRouter/Ollama)
- Quick action buttons for common queries
- Voice input integration (when supported)

**Store Dependencies:**
This view requires stores to be initialized. In a real app, these are set up via router.`
      }
    }
  }
}

export default meta
type Story = StoryObj

function setupMockStores() {
  const pinia = createPinia()
  setActivePinia(pinia)
}

// All styles as single-line strings — multiline breaks Storybook rendering
const S = {
  rootFlex: 'display:flex; height:100vh; background:var(--overlay-component-bg);',
  rootWrap: 'min-height:100vh; background:var(--overlay-component-bg);',
  sidebar: 'width:280px; display:flex; flex-direction:column; background:var(--overlay-component-bg); border-inline-end:1px solid var(--border-subtle);',
  newChatWrap: 'padding:var(--space-3); border-bottom:1px solid var(--border-subtle);',
  newChatBtn: 'width:100%; padding:var(--space-2) var(--space-3); background:var(--accent-primary); color:white; border:none; border-radius:var(--radius-md); font-size:var(--text-sm); font-weight:var(--font-medium); cursor:pointer;',
  convList: 'flex:1; padding:var(--space-2);',
  convItem: 'padding:var(--space-2) var(--space-2_5); background:var(--surface-hover); border-radius:var(--radius-md); margin-bottom:var(--space-1);',
  convTitle: 'font-size:var(--text-sm); color:var(--text-primary);',
  convTime: 'font-size:var(--text-xs); color:var(--text-muted); margin-top:2px;',
  agentWrap: 'padding:var(--space-3); border-top:1px solid var(--border-subtle);',
  agentLabel: 'font-size:var(--text-xs); text-transform:uppercase; color:var(--text-muted); margin-bottom:var(--space-2);',
  agentBtn: 'width:100%; padding:var(--space-2) var(--space-2_5); background:transparent; border:1px solid var(--border-medium); border-radius:var(--radius-md); font-size:var(--text-sm); color:var(--text-secondary); text-align:start; cursor:pointer;',
  chatMain: 'flex:1; display:flex; flex-direction:column;',
  chatHeader: 'display:flex; justify-content:space-between; align-items:center; padding:var(--space-3) var(--space-4); border-bottom:1px solid var(--border-subtle);',
  chatTitleGroup: 'display:flex; align-items:center; gap:var(--space-2);',
  chatTitle: 'font-size:var(--text-base); font-weight:var(--font-semibold); color:var(--text-primary);',
  chatBadge: 'font-size:var(--text-xs); padding:1px var(--space-1_5); background:var(--surface-hover); border-radius:var(--radius-full); color:var(--text-tertiary);',
  settingsBtn: 'width:var(--space-8); height:var(--space-8); background:transparent; border:none; color:var(--text-tertiary); border-radius:var(--radius-md); cursor:pointer;',
  emptyArea: 'flex:1; padding:var(--space-4) var(--space-6); display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center;',
  emptyTitle: 'font-size:var(--text-lg); font-weight:var(--font-medium); color:var(--text-secondary); margin-bottom:var(--space-2);',
  emptyHint: 'font-size:var(--text-sm); color:var(--text-tertiary); opacity:0.7;',
  inputArea: 'border-top:1px solid var(--border-subtle); background:var(--surface-tertiary); padding:var(--space-3) var(--space-6);',
  inputRow: 'display:flex; gap:var(--space-2); align-items:flex-end;',
  textarea: 'flex:1; min-height:var(--space-10); padding:var(--space-2) var(--space-3); background:var(--glass-bg-medium); border:1px solid var(--border-subtle); border-radius:var(--radius-md); color:var(--text-primary); font-size:var(--text-sm); resize:none; font-family:inherit;',
  sendBtn: 'width:var(--space-10); height:var(--space-10); background:var(--accent-primary); border:none; border-radius:var(--radius-md); color:white; cursor:pointer; display:flex; align-items:center; justify-content:center;',
  quickActions: 'display:flex; gap:var(--space-2); margin-top:var(--space-3); flex-wrap:wrap;',
  quickActionBtn: 'padding:var(--space-1) var(--space-3); background:transparent; border:1px solid var(--border-medium); border-radius:var(--radius-full); font-size:var(--text-xs); color:var(--text-secondary); cursor:pointer;',
}

/**
 * Default - Empty Chat State
 *
 * Shows the initial state when no messages exist yet.
 */
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Initial empty state with conversation list sidebar and empty chat area.'
      }
    }
  },
  render: () => ({
    components: { AIChatView, Sparkles },
    setup() {
      setupMockStores()
      return {}
    },
    template: `
      <div style="min-height:100vh; background:var(--overlay-component-bg);">
        <AIChatView />
      </div>
    `
  })
}

/**
 * Layout Structure - Skeleton View
 *
 * Shows the two-column layout structure without functional stores.
 */
export const LayoutStructure: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Visual demonstration of the two-column layout structure with conversation sidebar and chat main area.'
      }
    }
  },
  render: () => ({
    components: { Sparkles },
    setup() {
      return { S }
    },
    template: `
      <div :style="S.rootFlex">
        <aside :style="S.sidebar">
          <div :style="S.newChatWrap">
            <button :style="S.newChatBtn">+ New Chat</button>
          </div>
          <div :style="S.convList">
            <div :style="S.convItem">
              <div :style="S.convTitle">New Chat</div>
              <div :style="S.convTime">Just now</div>
            </div>
          </div>
          <div :style="S.agentWrap">
            <div :style="S.agentLabel">Agent Chains</div>
            <button :style="S.agentBtn">📅 Daily Planner</button>
          </div>
        </aside>
        <main :style="S.chatMain">
          <header :style="S.chatHeader">
            <div :style="S.chatTitleGroup">
              <Sparkles :size="18" style="color:var(--accent-primary);" />
              <span :style="S.chatTitle">New Chat</span>
              <span :style="S.chatBadge">Auto</span>
            </div>
            <div style="display:flex; gap:var(--space-1);">
              <button :style="S.settingsBtn">⚙️</button>
            </div>
          </header>
          <div :style="S.emptyArea">
            <Sparkles :size="40" style="color:var(--accent-primary); opacity:0.4; margin-bottom:var(--space-4);" />
            <p :style="S.emptyTitle">Ask me anything about your tasks!</p>
            <p :style="S.emptyHint">Try: "Plan my day" or "Break down this task"</p>
          </div>
          <div :style="S.inputArea">
            <div :style="S.inputRow">
              <textarea placeholder="Ask AI..." :style="S.textarea"></textarea>
              <button :style="S.sendBtn">➤</button>
            </div>
            <div :style="S.quickActions">
              <button :style="S.quickActionBtn">Plan my day</button>
              <button :style="S.quickActionBtn">What's overdue?</button>
            </div>
          </div>
        </main>
      </div>
    `
  })
}
