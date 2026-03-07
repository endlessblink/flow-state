import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'max-width:430px;margin:0 auto;background:var(--bg-primary);min-height:600px;border:1px solid var(--border-primary);border-radius:var(--radius-xl);overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px',
  timerCircle: 'width:240px;height:240px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:all 0.3s',
  timerIdle: 'border:3px solid var(--border-secondary);background:var(--surface-primary)',
  timerActive: 'border:3px solid var(--brand-primary);background:var(--surface-primary);box-shadow:0 0 30px rgba(78,205,196,0.2)',
  timerBreak: 'border:3px solid var(--color-warning);background:var(--surface-primary);box-shadow:0 0 30px rgba(245,158,11,0.2)',
  time: 'font-size:48px;font-weight:700;color:var(--text-primary);font-variant-numeric:tabular-nums',
  status: 'font-size:13px;color:var(--text-tertiary);margin-top:4px',
  playIcon: 'font-size:32px;color:var(--text-tertiary);margin-top:8px',
  pauseIcon: 'font-size:32px;color:var(--brand-primary);margin-top:8px',
  actions: 'display:flex;gap:16px;margin-top:32px',
  stopBtn: 'display:flex;align-items:center;gap:8px;padding:10px 20px;background:var(--glass-bg-soft);border:1px solid var(--color-danger);border-radius:var(--radius-lg);color:var(--color-danger);font-size:14px;cursor:pointer',
  focusIndicator: 'display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--surface-secondary);border-radius:var(--radius-full);font-size:12px;color:var(--brand-primary);margin-top:16px',
  taskInfo: 'margin-top:32px;text-align:center',
  taskLabel: 'font-size:12px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px',
  taskName: 'font-size:16px;color:var(--text-primary);font-weight:500',
}

const meta: Meta = {
  title: '📱 Mobile/MobileTimerView',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const Idle: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.timerCircle + ';' + S.timerIdle }, [
        h('div', { style: S.time }, '25:00'),
        h('div', { style: S.status }, 'Ready'),
        h('div', { style: S.playIcon }, '▶'),
      ]),
      h('div', { style: S.taskInfo }, [
        h('div', { style: S.taskLabel }, 'Current Focus'),
        h('div', { style: S.taskName + ';color:var(--text-tertiary)' }, 'No task selected'),
      ]),
    ])}
  }),
}

export const Active: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.timerCircle + ';' + S.timerActive }, [
        h('div', { style: S.time }, '18:42'),
        h('div', { style: S.status }, 'Focus Session'),
        h('div', { style: S.pauseIcon }, '⏸'),
      ]),
      h('div', { style: S.actions }, [
        h('button', { style: S.stopBtn }, ['⏹ Stop']),
      ]),
      h('div', { style: S.focusIndicator }, ['📱 Screen Awake']),
      h('div', { style: S.taskInfo }, [
        h('div', { style: S.taskLabel }, 'Current Focus'),
        h('div', { style: S.taskName }, 'Design landing page'),
      ]),
    ])}
  }),
}

export const Break: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.timerCircle + ';' + S.timerBreak }, [
        h('div', { style: S.time }, '04:15'),
        h('div', { style: S.status + ';color:var(--color-warning)' }, 'Break Time'),
        h('div', { style: S.pauseIcon + ';color:var(--color-warning)' }, '⏸'),
      ]),
      h('div', { style: S.actions }, [
        h('button', { style: S.stopBtn }, ['⏹ Stop']),
      ]),
      h('div', { style: S.taskInfo }, [
        h('div', { style: S.taskLabel }, 'Current Focus'),
        h('div', { style: S.taskName }, 'Design landing page'),
      ]),
    ])}
  }),
}
