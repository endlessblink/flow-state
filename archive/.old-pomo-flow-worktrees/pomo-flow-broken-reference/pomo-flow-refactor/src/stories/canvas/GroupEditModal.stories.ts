import type { Meta, StoryObj } from '@storybook/vue3'
import GroupEditModal from '@/components/canvas/GroupEditModal.vue'
import type { CanvasSection } from '@/stores/canvas'

const meta = {
  component: GroupEditModal,
  title: '🧩 Components/🎨 Canvas/GroupEditModal',
  tags: ['autodocs'],

  args: {
    section: null,
    isVisible: false,
  },

  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof GroupEditModal>

export default meta
type Story = StoryObj<typeof meta>

// Sample canvas section
const sampleSection: CanvasSection = {
  id: 'section-1',
  name: 'Development Tasks',
  color: '#6366f1',
  layout: 'grid',
  isCollapsed: false,
  isVisible: true,
  tasks: [],
  position: { x: 100, y: 200 },
  size: { width: 400, height: 300 },
  createdAt: new Date(),
  updatedAt: new Date(),
}

// Modal hidden (default)
export const Hidden: Story = {
  args: {
    section: sampleSection,
    isVisible: false,
  },
}

// Modal visible with section data
export const Visible: Story = {
  args: {
    section: sampleSection,
    isVisible: true,
  },
}

// New section (null section)
export const NewSection: Story = {
  args: {
    section: null,
    isVisible: true,
  },
}

// Grid layout
export const GridLayout: Story = {
  args: {
    section: {
      ...sampleSection,
      id: 'grid-section',
      name: 'Grid Layout Section',
      layout: 'grid',
    },
    isVisible: true,
  },
}

// Vertical layout
export const VerticalLayout: Story = {
  args: {
    section: {
      ...sampleSection,
      id: 'vertical-section',
      name: 'Vertical Layout Section',
      layout: 'vertical',
    },
    isVisible: true,
  },
}

// Horizontal layout
export const HorizontalLayout: Story = {
  args: {
    section: {
      ...sampleSection,
      id: 'horizontal-section',
      name: 'Horizontal Layout Section',
      layout: 'horizontal',
    },
    isVisible: true,
  },
}

// Collapsed section
export const CollapsedSection: Story = {
  args: {
    section: {
      ...sampleSection,
      id: 'collapsed-section',
      name: 'Collapsed Section',
      isCollapsed: true,
    },
    isVisible: true,
  },
}

// Hidden section
export const HiddenSection: Story = {
  args: {
    section: {
      ...sampleSection,
      id: 'hidden-section',
      name: 'Hidden Section',
      isVisible: false,
    },
    isVisible: true,
  },
}

// Different colors
export const RedColor: Story = {
  args: {
    section: {
      ...sampleSection,
      id: 'red-section',
      name: 'Urgent Tasks',
      color: '#ef4444',
    },
    isVisible: true,
  },
}

export const GreenColor: Story = {
  args: {
    section: {
      ...sampleSection,
      id: 'green-section',
      name: 'Completed Tasks',
      color: '#10b981',
    },
    isVisible: true,
  },
}

export const BlueColor: Story = {
  args: {
    section: {
      ...sampleSection,
      id: 'blue-section',
      name: 'Review Tasks',
      color: '#3b82f6',
    },
    isVisible: true,
  },
}

export const PurpleColor: Story = {
  args: {
    section: {
      ...sampleSection,
      id: 'purple-section',
      name: 'Planning Tasks',
      color: '#8b5cf6',
    },
    isVisible: true,
  },
}

// Long name
export const LongName: Story = {
  args: {
    section: {
      ...sampleSection,
      id: 'long-name-section',
      name: 'This is a very long section name that demonstrates how the modal handles text overflow',
      color: '#f59e0b',
    },
    isVisible: true,
  },
}

// Custom hex color
export const CustomHexColor: Story = {
  args: {
    section: {
      ...sampleSection,
      id: 'custom-color-section',
      name: 'Custom Color Section',
      color: '#ff6b35',
    },
    isVisible: true,
  },
}

// Empty name (requires user input)
export const EmptyName: Story = {
  args: {
    section: {
      ...sampleSection,
      id: 'empty-name-section',
      name: '',
      color: '#64748b',
    },
    isVisible: true,
  },
}

// Complex configuration
export const ComplexConfig: Story = {
  args: {
    section: {
      ...sampleSection,
      id: 'complex-section',
      name: 'Complex Configuration Section',
      color: '#dc2626',
      layout: 'horizontal',
      isCollapsed: true,
      isVisible: false,
    },
    isVisible: true,
  },
}