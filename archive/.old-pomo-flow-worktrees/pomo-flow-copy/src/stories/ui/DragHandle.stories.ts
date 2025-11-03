import type { Meta, StoryObj } from '@storybook/vue3'
import DragHandle from '@/components/DragHandle.vue'

const meta = {
  component: DragHandle,
  title: '🧩 Components/🔧 UI/DragHandle',
  tags: ['autodocs'],

  args: {
    disabled: false,
    size: 'md',
    showDragHints: false,
    showKeyboardNavigation: true,
    dragThreshold: 5,
  },

  parameters: {
    layout: 'centered',
  },

  decorators: [
    (story) => ({
      components: { story },
      template: `
        <div style="padding: var(--space-8); display: flex; flex-direction: column; align-items: center; gap: var(--space-8);">
          <story />
          <div style="text-align: center; color: var(--text-secondary); font-size: var(--text-sm);">
            <p>Click and drag to test drag functionality</p>
            <p>Use arrow keys for keyboard navigation</p>
          </div>
        </div>
      `
    })
  ]
} satisfies Meta<typeof DragHandle>

export default meta
type Story = StoryObj<typeof meta>

// Default state
export const Default: Story = {
  args: {
    disabled: false,
    showDragHints: false,
  },
}

// Disabled state
export const Disabled: Story = {
  args: {
    disabled: true,
    showDragHints: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Disabled drag handle prevents all interaction. The handle appears grayed out and non-interactive. Use this when dragging should be temporarily unavailable.'
      }
    }
  }
}

// Small size
export const Small: Story = {
  args: {
    size: 'sm',
    showDragHints: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Small size variant for compact interfaces. The grip pattern uses 4 dots instead of 6, providing a smaller touch target while maintaining accessibility.'
      }
    }
  }
}

// Large size
export const Large: Story = {
  args: {
    size: 'lg',
    showDragHints: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Large size variant for better accessibility and touch interaction. The grip pattern uses 8 dots and provides larger touch targets, making it easier to grab on mobile devices.'
      }
    }
  }
}

// With drag hints
export const WithHints: Story = {
  args: {
    showDragHints: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Drag handle with hints displayed on hover. Shows keyboard shortcuts:\n\n• **Click** - Start drag operation\n• **Arrow Keys** - Move in any direction\n• **Esc** - Cancel drag\n\nHelps users discover advanced interaction features.'
      }
    }
  }
}

// Keyboard navigation enabled
export const KeyboardEnabled: Story = {
  args: {
    showKeyboardNavigation: true,
    showDragHints: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Drag handle with full keyboard navigation support. Features include:\n\n### **Keyboard Controls:**\n- **Enter/Space** - Start drag operation\n- **Arrow Keys** - Move element in any direction\n- **Escape** - Cancel current drag\n- **Tab** - Navigate to/from handle\n\n### **Visual Feedback:**\n- Focus indicator with enhanced border\n- Keyboard hints display\n- Screen reader announcements\n- State changes for dragging\n\nThis provides complete accessibility for users who cannot or prefer not to use mouse/touch input.'
      }
    }
  }
}

// Interactive demonstration
export const InteractiveDemo: Story = {
  render: () => ({
    components: { DragHandle },
    setup() {
      const isDragging = ref(false)
      const dragPosition = ref({ x: 0, y: 0 })
      const dragStart = ref({ x: 0, y: 0 })

      const handleDragStart = (event: MouseEvent | TouchEvent) => {
        isDragging.value = true
        const clientX = 'touches' in event ? event.touches[0]?.clientX || 0 : event.clientX
        const clientY = 'touches' in event ? event.touches[0]?.clientY || 0 : event.clientY
        dragStart.value = { x: clientX, y: clientY }
      }

      const handleDragEnd = () => {
        isDragging.value = false
      }

      const handleDragMove = (event: MouseEvent | TouchEvent, deltaX: number, deltaY: number) => {
        const clientX = 'touches' in event ? event.touches[0]?.clientX || 0 : event.clientX
        const clientY = 'touches' in event ? event.touches[0]?.clientY || 0 : event.clientY
        dragPosition.value = { x: clientX, y: clientY }
      }

      const handleKeyboardMove = (direction: 'up' | 'down' | 'left' | 'right') => {
        const moves = {
          up: { x: 0, y: -10 },
          down: { x: 0, y: 10 },
          left: { x: -10, y: 0 },
          right: { x: 10, y: 0 }
        }
        dragPosition.value.x += moves[direction].x
        dragPosition.value.y += moves[direction].y
      }

      return {
        isDragging,
        dragPosition,
        handleDragStart,
        handleDragEnd,
        handleDragMove,
        handleKeyboardMove
      }
    },
    template: `
      <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-4);">
        <DragHandle
          @drag-start="handleDragStart"
          @drag-end="handleDragEnd"
          @drag-move="handleDragMove"
          @keyboard-move="handleKeyboardMove"
          show-drag-hints
          show-keyboard-navigation
        />
        <div style="text-align: center; color: var(--text-secondary); font-size: var(--text-sm);">
          <p>Drag Position: ({{ Math.round(dragPosition.x) }}, {{ Math.round(dragPosition.y) }})</p>
          <p>State: {{ isDragging ? 'Dragging' : 'Ready' }}</p>
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story: 'Interactive drag handle demonstration with live state tracking:\n\n## Features to Test:\n\n### **Mouse/Touch Interaction**\n- Click and drag to initiate drag operation\n- Watch for drag ghost preview following cursor\n- Release to end drag operation\n- Smooth animations and visual feedback\n\n### **Keyboard Navigation**\n- Focus the drag handle and press Enter/Space to start\n- Use arrow keys to move element\n- Press Escape to cancel drag operation\n- Full accessibility support with screen reader announcements\n\n### **Visual States**\n- **Hover** - Enhanced glow and animation effects\n- **Focus** - Visible focus ring and border highlighting\n- **Dragging** - Active state with pulsing indicators\n- **Disabled** - Grayed out non-interactive state\n\n### **Advanced Features**\n- **Drag Ghost** - Visual preview following cursor\n- **Directional Indicators** - Show movement directions\n- **Touch Feedback** - Enhanced mobile interaction\n- **Multi-layer Animations** - Sophisticated visual feedback\n\n### **Accessibility**\n- Screen reader support with state announcements\n- Keyboard navigation with all controls\n- High contrast mode support\n- Reduced motion preferences respected\n- Proper ARIA labels and roles\n\nThe component provides professional drag-and-drop functionality with sophisticated glass morphism design and comprehensive accessibility support.'
      }
    }
  }
}

// Custom drag threshold
export const CustomThreshold: Story = {
  args: {
    dragThreshold: 10,
    showDragHints: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Drag handle with custom threshold (10px instead of default 5px). Requires more movement before drag operation starts, preventing accidental drags. Useful for:\n\n- Dense interfaces with adjacent interactive elements\n- Touch devices where accidental touches are common\n- Precision drag operations requiring confirmation\n\nThe threshold value determines minimum pixel movement required to initiate dragging.'
      }
    }
  }
}

// Size comparison
export const SizeComparison: Story = {
  render: () => ({
    components: { DragHandle },
    template: `
      <div style="display: flex; align-items: center; gap: var(--space-8);">
        <div style="text-align: center;">
          <DragHandle size="sm" style="margin-bottom: var(--space-2);" />
          <p style="font-size: var(--text-xs); color: var(--text-secondary);">Small</p>
        </div>
        <div style="text-align: center;">
          <DragHandle size="md" style="margin-bottom: var(--space-2);" />
          <p style="font-size: var(--text-xs); color: var(--text-secondary);">Medium</p>
        </div>
        <div style="text-align: center;">
          <DragHandle size="lg" style="margin-bottom: var(--space-2);" />
          <p style="font-size: var(--text-xs); color: var(--text-secondary);">Large</p>
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story: 'Size comparison showing all three variants side by side:\n\n### **Small (40px)**\n- 4 dots in grip pattern\n- Compact touch target\n- Ideal for dense interfaces\n- Mobile-optimized interactions\n\n### **Medium (48px)**\n- 6 dots in grip pattern\n- Balanced touch target\n- Standard desktop interactions\n- Recommended default size\n\n### **Large (56px)**\n- 8 dots in grip pattern\n- Maximum touch target\n- Enhanced accessibility\n- Ideal for touch-first interfaces\n\nChoose size based on target device, interface density, and accessibility requirements.'
      }
    }
  }
}