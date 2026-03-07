import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);min-height:200px;position:relative;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden',
  fab: 'position:absolute;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:var(--glass-bg-soft);border:2px solid var(--brand-primary);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 20px rgba(78,205,196,0.3);font-size:24px;color:var(--brand-primary)',
  fabBadge: 'position:absolute;top:-4px;right:-4px;width:20px;height:20px;border-radius:50%;background:var(--brand-primary);color:var(--bg-primary);font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center',
  voicePill: 'position:absolute;bottom:90px;right:16px;display:flex;align-items:center;gap:8px;padding:8px 14px;background:var(--glass-bg-soft);border:1px solid var(--brand-primary);border-radius:var(--radius-full);backdrop-filter:blur(8px)',
  voiceBadge: 'padding:2px 6px;background:var(--brand-primary);color:var(--bg-primary);border-radius:var(--radius-sm);font-size:10px;font-weight:600',
  waveform: 'display:flex;align-items:center;gap:2px;height:16px',
  bar: 'width:3px;background:var(--brand-primary);border-radius:1px',
  statusText: 'font-size:12px;color:var(--text-secondary)',
  closeBtn: 'background:none;border:none;color:var(--text-tertiary);font-size:14px;cursor:pointer;margin-left:4px',
}

const meta: Meta = {
  title: '📱 Mobile/MobileInboxQuickAdd',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const FABOnly: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.fab }, '+'),
    ])}
  }),
}

export const VoiceRecording: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.voicePill }, [
        h('span', { style: S.voiceBadge }, '🤖 AI'),
        h('div', { style: S.waveform }, [
          h('span', { style: S.bar + ';height:6px' }),
          h('span', { style: S.bar + ';height:12px' }),
          h('span', { style: S.bar + ';height:8px' }),
          h('span', { style: S.bar + ';height:14px' }),
          h('span', { style: S.bar + ';height:10px' }),
        ]),
        h('span', { style: S.statusText }, '3s — Speak freely...'),
        h('button', { style: S.closeBtn }, '✕'),
      ]),
      h('div', { style: S.fab }, '🎤'),
    ])}
  }),
}

export const WithPendingBadge: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.fab + ';position:absolute' }, [
        '+',
        h('span', { style: S.fabBadge }, '3'),
      ]),
    ])}
  }),
}

export const Processing: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.voicePill }, [
        h('span', { style: S.voiceBadge }, '🤖 AI'),
        h('span', { style: S.statusText }, '⏳ Processing...'),
      ]),
      h('div', { style: S.fab + ';opacity:0.6' }, '🎤'),
    ])}
  }),
}
