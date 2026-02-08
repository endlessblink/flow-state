import OverflowTooltip from '@/components/base/OverflowTooltip.vue'

const meta = {
  component: OverflowTooltip,
    title: '🧩 Primitives/OverflowTooltip',
    tags: ['autodocs'],
    parameters: {
        layout: 'centered',
    }
}

export default meta

export const Default = {
    render: () => ({
        components: { OverflowTooltip },
        template: `
      <div style="width: 150px; border: 1px dashed #ccc; padding: 4px;">
        <OverflowTooltip text="This is a very long text that will surely overflow the container width">
          This is a very long text that will surely overflow the container width
        </OverflowTooltip>
      </div>
    `
    })
}

export const NotOverflowing = {
    render: () => ({
        components: { OverflowTooltip },
        template: `
      <div style="width: 300px; border: 1px dashed #ccc; padding: 4px;">
        <OverflowTooltip text="Short text">
          Short text
        </OverflowTooltip>
      </div>
    `
    })
}

export const CustomContent = {
    render: () => ({
        components: { OverflowTooltip },
        template: `
      <div style="width: 100px; border: 1px dashed #ccc; padding: 4px;">
        <OverflowTooltip text="Long Project Name">
          Long Project Name
          <template #tooltip-content>
            <div style="color: #4ECDC4; font-weight: bold;">Project Detail:</div>
            <div>This project focuses on Storybook coverage.</div>
          </template>
        </OverflowTooltip>
      </div>
    `
    })
}
