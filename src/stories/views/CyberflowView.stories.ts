import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'background:var(--cf-dark-1, #0a0a14);min-height:600px;border:1px solid var(--cf-cyan, #00f0ff);border-radius:var(--radius-lg);overflow:hidden;font-family:monospace',
  header: 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(0,240,255,0.15)',
  headerLeft: 'display:flex;align-items:center;gap:12px',
  title: 'font-size:16px;font-weight:700;color:var(--cf-cyan, #00f0ff);letter-spacing:2px;padding:4px 12px;border:1px solid var(--cf-cyan, #00f0ff)',
  status: 'font-size:11px;color:rgba(0,240,255,0.5);letter-spacing:1px',
  tabs: 'display:flex;gap:0;border-bottom:1px solid rgba(0,240,255,0.15)',
  tab: 'padding:10px 16px;font-size:12px;color:rgba(0,240,255,0.5);text-transform:uppercase;letter-spacing:1px;cursor:pointer;border-bottom:2px solid transparent',
  tabActive: 'padding:10px 16px;font-size:12px;color:var(--cf-cyan, #00f0ff);text-transform:uppercase;letter-spacing:1px;cursor:pointer;border-bottom:2px solid var(--cf-cyan, #00f0ff)',
  content: 'padding:16px',
  grid: 'display:grid;grid-template-columns:1fr 1fr;gap:12px',
  card: 'background:rgba(0,240,255,0.05);border:1px solid rgba(0,240,255,0.15);padding:16px;border-radius:4px',
  cardTitle: 'font-size:11px;color:rgba(0,240,255,0.6);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px',
  cardContent: 'font-size:14px;color:var(--cf-cyan, #00f0ff)',
}

const tabs = [
  { label: 'Overview', icon: '◫' },
  { label: 'Missions', icon: '◎' },
  { label: 'Boss', icon: '☠' },
  { label: 'Upgrades', icon: '⚡' },
  { label: 'Achievements', icon: '🏆' },
]

const meta: Meta = {
  title: '🖥️ Views/CyberflowView',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('div', { style: S.header }, [
        h('div', { style: S.headerLeft }, [
          h('span', { style: S.title }, 'CYBERFLOW'),
          h('span', { style: S.status }, '// ONLINE'),
        ]),
      ]),
      h('div', { style: S.tabs }, tabs.map((t, i) =>
        h('div', { style: i === 0 ? S.tabActive : S.tab }, `${t.icon} ${t.label}`)
      )),
      h('div', { style: S.content }, [
        h('div', { style: S.grid }, [
          h('div', { style: S.card }, [
            h('div', { style: S.cardTitle }, 'Character'),
            h('div', { style: S.cardContent }, 'LVL 12 NETRUNNER'),
          ]),
          h('div', { style: S.card }, [
            h('div', { style: S.cardTitle }, 'Daily Briefing'),
            h('div', { style: S.cardContent }, '3/5 missions complete'),
          ]),
          h('div', { style: S.card }, [
            h('div', { style: S.cardTitle }, 'Boss Fight'),
            h('div', { style: S.cardContent }, 'HP: 45/100'),
          ]),
          h('div', { style: S.card }, [
            h('div', { style: S.cardTitle }, 'Shop'),
            h('div', { style: S.cardContent }, '2,400 XP available'),
          ]),
        ]),
      ]),
    ])}
  }),
}
