import type { Meta, StoryObj } from '@storybook/vue3'
import NewsCard from '@/components/morning-dashboard/NewsCard.vue'

const meta = {
  component: NewsCard,
  title: '☀️ Morning Dashboard/NewsCard',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    title: { control: 'text' },
    url: { control: 'text' },
    points: { control: 'number' },
    domain: { control: 'text' },
  },
} satisfies Meta<typeof NewsCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: 'Vue 3.5 Released with Reactive Props Destructure',
    url: 'https://example.com/article',
    points: 342,
    domain: 'vuejs.org',
  },
  render: (args) => ({
    components: { NewsCard },
    setup() { return { args } },
    template: `
      <div style="width: 340px; padding: var(--space-4); background: var(--surface-primary); border: 1px solid var(--glass-border); border-radius: var(--radius-lg);">
        <NewsCard v-bind="args" />
      </div>
    `,
  }),
}

export const NewsList: Story = {
  render: () => ({
    components: { NewsCard },
    template: `
      <div style="width: 340px; padding: var(--space-4); background: var(--surface-primary); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); display: flex; flex-direction: column;">
        <NewsCard title="Rust 2024 Edition Stabilized" url="#" :points="512" domain="blog.rust-lang.org" />
        <NewsCard title="TypeScript 5.8 Brings Isolated Declarations" url="#" :points="287" domain="devblogs.microsoft.com" />
        <NewsCard title="Bun 1.3 Now Supports Node.js Compatibility Layer" url="#" :points="198" domain="bun.sh" />
        <NewsCard title="A Very Long Title That Should Be Truncated After Two Lines of Text in the Card Component" url="#" :points="45" domain="longdomainname.example.com" />
      </div>
    `,
  }),
}
