import type { Meta, StoryObj } from '@storybook/vue3'
import { Newspaper } from 'lucide-vue-next'
import NewsCard from '@/components/morning-dashboard/NewsCard.vue'

const S = {
  card: 'display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-4); background: var(--surface-primary); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); width: 360px;',
  header: 'display: flex; align-items: center; gap: var(--space-2);',
  icon: 'color: var(--brand-primary); flex-shrink: 0;',
  title: 'font-size: 0.9375rem; font-weight: 600; color: var(--text-primary); margin: 0;',
  skeleton: 'display: flex; flex-direction: column; gap: var(--space-3);',
  skeletonRow: 'display: flex; flex-direction: column; gap: var(--space-1); padding: var(--space-2) var(--space-3);',
  skeletonTitle: 'height: 14px; width: 85%; background: var(--glass-bg-soft); border-radius: var(--radius-sm);',
  skeletonMeta: 'height: 10px; width: 40%; background: var(--glass-bg-soft); border-radius: var(--radius-sm);',
  error: 'padding: var(--space-3); font-size: 0.8rem; color: var(--text-muted);',
}

const meta: Meta = {
  title: '☀️ Morning Dashboard/MorningNews',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Tech news card with loading skeleton, error state, and a list of NewsCard items fetched from HN/RSS.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const WithNews: Story = {
  render: () => ({
    components: { Newspaper, NewsCard },
    template: `
      <div style="${S.card}">
        <div style="${S.header}">
          <Newspaper :size="16" style="${S.icon}" />
          <h2 style="${S.title}">Tech News</h2>
        </div>
        <div style="display: flex; flex-direction: column;">
          <NewsCard title="Vue 3.5 Released with Reactive Props Destructure" url="#" :points="342" domain="vuejs.org" />
          <NewsCard title="Rust 2024 Edition Stabilized" url="#" :points="512" domain="blog.rust-lang.org" />
          <NewsCard title="TypeScript 5.8 Brings Isolated Declarations" url="#" :points="287" domain="devblogs.microsoft.com" />
        </div>
      </div>
    `,
  }),
}

export const Loading: Story = {
  render: () => ({
    components: { Newspaper },
    template: `
      <div style="${S.card}">
        <div style="${S.header}">
          <Newspaper :size="16" style="${S.icon}" />
          <h2 style="${S.title}">Tech News</h2>
        </div>
        <div style="${S.skeleton}">
          <div style="${S.skeletonRow}">
            <div style="${S.skeletonTitle}" />
            <div style="${S.skeletonMeta}" />
          </div>
          <div style="${S.skeletonRow}">
            <div style="${S.skeletonTitle}" />
            <div style="${S.skeletonMeta}" />
          </div>
          <div style="${S.skeletonRow}">
            <div style="${S.skeletonTitle}" />
            <div style="${S.skeletonMeta}" />
          </div>
        </div>
      </div>
    `,
  }),
}

export const Error: Story = {
  render: () => ({
    components: { Newspaper },
    template: `
      <div style="${S.card}">
        <div style="${S.header}">
          <Newspaper :size="16" style="${S.icon}" />
          <h2 style="${S.title}">Tech News</h2>
        </div>
        <div style="${S.error}">Failed to load news — check your connection</div>
      </div>
    `,
  }),
}
