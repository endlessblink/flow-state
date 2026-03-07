import type { Meta, StoryObj } from '@storybook/vue3'
import { Mic, MicOff, CalendarDays, Flag, Maximize2, X } from 'lucide-vue-next'

const S = {
  sidebar: 'width: 260px; background: var(--glass-bg-medium); border-radius: var(--radius-lg); padding: var(--space-4) var(--space-6);',
  section: 'padding: var(--space-2); background: var(--glass-bg-medium); border: 1px solid var(--glass-border); border-radius: var(--radius-lg);',
  row: 'display: flex; gap: var(--space-2); align-items: center;',
  input: 'flex: 1; padding: var(--space-2_5); background: var(--glass-bg-tint); border: 1px solid var(--glass-border); border-radius: var(--radius-sm); color: var(--text-primary); font-size: var(--text-sm); outline: none;',
  inputFocused: 'flex: 1; padding: var(--space-2_5); background: var(--glass-bg-light); border: 1px solid var(--brand-primary); border-radius: var(--radius-sm); color: var(--text-primary); font-size: var(--text-sm); outline: none;',
  micBtn: 'width: 32px; height: 32px; border-radius: 50%; border: none; background: var(--glass-bg-soft); color: var(--text-secondary); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;',
  micBtnRec: 'width: 32px; height: 32px; border-radius: 50%; border: none; background: var(--color-danger); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;',
  metaRow: 'display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-2); padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); background: var(--glass-bg-soft);',
  metaBtn: 'display: flex; align-items: center; gap: var(--space-1); padding: var(--space-1) var(--space-2); background: transparent; border: 1px solid var(--border-medium); border-radius: var(--radius-sm); color: var(--text-secondary); font-size: var(--text-xs); cursor: pointer;',
  metaBtnActive: 'display: flex; align-items: center; gap: var(--space-1); padding: var(--space-1) var(--space-2); background: transparent; border: 1px solid var(--brand-primary); border-radius: var(--radius-sm); color: var(--brand-primary); font-size: var(--text-xs); cursor: pointer;',
  dot: 'color: var(--text-muted); font-size: var(--text-xs); user-select: none;',
  voiceFeedback: 'display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2); margin-top: var(--space-2); background: var(--glass-bg-soft); border-radius: var(--radius-sm); border: 1px solid var(--glass-border);',
  voiceStatus: 'flex: 1; font-size: var(--text-xs); color: var(--text-secondary);',
  waveBar: 'width: 2px; height: 4px; background: var(--color-danger); border-radius: 1px;',
}

const meta: Meta = {
  title: '🏢 Layout/Sidebar/SidebarQuickTaskInput',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Quick task creation input with voice recording, date/priority pickers, expand-to-fullscreen, and success flash animation.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { Mic },
    template: `
      <div style="${S.sidebar}">
        <div style="${S.section}">
          <div style="${S.row}">
            <input style="${S.input}" placeholder="Quick add a task..." />
            <button style="${S.micBtn}"><Mic :size="16" /></button>
          </div>
        </div>
      </div>
    `,
  }),
}

export const WithMetadata: Story = {
  name: 'Focused with Metadata',
  render: () => ({
    components: { Mic, CalendarDays, Flag },
    template: `
      <div style="${S.sidebar}">
        <div style="${S.section}">
          <div style="${S.row}">
            <input style="${S.inputFocused}" value="Deploy the new feature" />
            <button style="${S.micBtn}"><Mic :size="16" /></button>
          </div>
          <div style="${S.metaRow}">
            <button style="${S.metaBtnActive}">
              <CalendarDays :size="14" />
              <span>Today</span>
            </button>
            <span style="${S.dot}">&middot;</span>
            <button style="${S.metaBtn}">
              <Flag :size="14" />
              <span>No priority</span>
            </button>
          </div>
        </div>
      </div>
    `,
  }),
}

export const VoiceRecording: Story = {
  render: () => ({
    components: { MicOff, X },
    template: `
      <div style="${S.sidebar}">
        <div style="${S.section}">
          <div style="${S.row}">
            <input style="${S.input} border-color: var(--color-danger); box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.15);" placeholder="Listening..." />
            <button style="${S.micBtnRec}"><MicOff :size="16" /></button>
          </div>
          <div style="${S.voiceFeedback}">
            <div style="display: flex; align-items: center; gap: 2px; height: 16px;">
              <span style="${S.waveBar}" /><span style="${S.waveBar} height: 10px;" /><span style="${S.waveBar}" />
            </div>
            <span style="${S.voiceStatus}">Speak now...</span>
            <button style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: var(--space-1); border-radius: 50%;"><X :size="12" /></button>
          </div>
        </div>
      </div>
    `,
  }),
}
