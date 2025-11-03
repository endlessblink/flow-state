import type { Meta, StoryObj } from '@storybook/vue3'
import MultiSelectToggle from '@/components/MultiSelectToggle.vue'

const meta = {
  component: MultiSelectToggle,
  title: '🧩 Components/🔧 UI/MultiSelectToggle',
  tags: ['autodocs'],

  args: {
    selected: false,
    indeterminate: false,
    disabled: false,
    size: 'md',
    selectedCount: 0,
    totalCount: 0,
    showToolbar: true,
    showKeyboardHints: false,
  },

  parameters: {
    layout: 'centered',
  },

  decorators: [
    (story) => ({
      components: { story },
      template: `
        <div style="padding: var(--space-8); display: flex; flex-direction: column; align-items: center; gap: var(--space-6);">
          <story />
        </div>
      `
    })
  ]
} satisfies Meta<typeof MultiSelectToggle>

export default meta
type Story = StoryObj<typeof meta>

// Default state
export const Default: Story = {
  args: {
    selected: false,
    indeterminate: false,
    selectedCount: 0,
    totalCount: 10,
  },
}

// Selected state
export const Selected: Story = {
  args: {
    selected: true,
    selectedCount: 5,
    totalCount: 10,
  },
  parameters: {
    docs: {
      description: {
        story: 'Selected state shows the toggle is active with a checkmark. The toolbar appears showing the selection count and bulk action buttons. Use this state when all or some items are selected.'
      }
    }
  }
}

// Indeterminate state
export const Indeterminate: Story = {
  args: {
    indeterminate: true,
    selectedCount: 3,
    totalCount: 10,
  },
  parameters: {
    docs: {
      description: {
        story: 'Indeterminate state (partially selected) shows a minus icon instead of checkmark. This indicates that some but not all items are selected. The toolbar displays the current selection count.'
      }
    }
  }
}

// Disabled state
export const Disabled: Story = {
  args: {
    disabled: true,
    selected: false,
    selectedCount: 0,
    totalCount: 10,
  },
  parameters: {
    docs: {
      description: {
        story: 'Disabled state prevents user interaction. The toggle appears grayed out and non-interactive. Use this when selection functionality should be temporarily unavailable.'
      }
    }
  }
}

// Selected and disabled
export const SelectedDisabled: Story = {
  args: {
    selected: true,
    disabled: true,
    selectedCount: 5,
    totalCount: 10,
  },
  parameters: {
    docs: {
      description: {
        story: 'Selected but disabled state shows a pre-selected toggle that cannot be changed by the user. Useful for displaying locked selections or read-only states.'
      }
    }
  }
}

// Small size
export const Small: Story = {
  args: {
    size: 'sm',
    selected: false,
    selectedCount: 0,
    totalCount: 10,
  },
  parameters: {
    docs: {
      description: {
        story: 'Small size variant for compact interfaces. All functionality remains the same but with reduced touch target size. Use in space-constrained layouts.'
      }
    }
  }
}

// Large size
export const Large: Story = {
  args: {
    size: 'lg',
    selected: true,
    selectedCount: 7,
    totalCount: 10,
  },
  parameters: {
    docs: {
      description: {
        story: 'Large size variant for better accessibility and touch interaction. Larger touch targets make it easier to select on mobile devices or for users with motor impairments.'
      }
    }
  }
}

// With toolbar hidden
export const NoToolbar: Story = {
  args: {
    selected: true,
    selectedCount: 5,
    totalCount: 10,
    showToolbar: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Toggle without floating toolbar. The basic selection functionality works but bulk action controls are hidden. Use when toolbar functionality is handled elsewhere.'
      }
    }
  }
}

// With keyboard hints
export const WithKeyboardHints: Story = {
  args: {
    selected: false,
    selectedCount: 0,
    totalCount: 10,
    showKeyboardHints: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Toggle with keyboard shortcuts hint displayed. Shows available keyboard shortcuts:\n\n• **Ctrl+A** - Select all items\n• **Shift+Click** - Range selection\n• **Esc** - Clear selection\n\nHelps users discover power user features.'
      }
    }
  }
}

// Empty state (no items)
export const Empty: Story = {
  args: {
    selected: false,
    selectedCount: 0,
    totalCount: 0,
  },
  parameters: {
    docs: {
      description: {
        story: 'Empty state when there are no items to select. The toggle is disabled or hidden since there are no items available for selection.'
      }
    }
  }
}

// All selected
export const AllSelected: Story = {
  args: {
    selected: true,
    selectedCount: 10,
    totalCount: 10,
  },
  parameters: {
    docs: {
      description: {
        story: 'All items selected state. Shows maximum selection count and the select all button becomes active/checked in the toolbar.'
      }
    }
  }
}

// Partial selection
export const PartialSelection: Story = {
  args: {
    indeterminate: true,
    selectedCount: 4,
    totalCount: 10,
  },
  parameters: {
    docs: {
      description: {
        story: 'Partial selection state showing 4 of 10 items selected. The indeterminate state indicates some items are selected but not all. Toolbar shows current selection count.'
      }
    }
  }
}

// Large selection count
export const LargeSelection: Story = {
  args: {
    selected: true,
    selectedCount: 247,
    totalCount: 500,
  },
  parameters: {
    docs: {
      description: {
        story: 'Large selection count demonstrating how the component handles high numbers. Shows "247 selected" in the toolbar, maintaining readability even with large datasets.'
      }
    }
  }
}

// Interactive demonstration
export const InteractiveDemo: Story = {
  render: () => ({
    components: { MultiSelectToggle },
    setup() {
      const selected = ref(false)
      const indeterminate = ref(false)
      const selectedCount = ref(0)
      const totalCount = ref(10)

      const handleChange = (checked: boolean) => {
        selected.value = checked
        indeterminate.value = false
        selectedCount.value = checked ? totalCount.value : 0
      }

      const handleSelectAll = () => {
        selected.value = true
        indeterminate.value = false
        selectedCount.value = totalCount.value
      }

      const handleInvertSelection = () => {
        selectedCount.value = totalCount.value - selectedCount.value
        selected.value = selectedCount.value === totalCount.value
        indeterminate.value = selectedCount.value > 0 && selectedCount.value < totalCount.value
      }

      const handleClearSelection = () => {
        selected.value = false
        indeterminate.value = false
        selectedCount.value = 0
      }

      return {
        selected,
        indeterminate,
        selectedCount,
        totalCount,
        handleChange,
        handleSelectAll,
        handleInvertSelection,
        handleClearSelection
      }
    },
    template: `
      <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-4);">
        <MultiSelectToggle
          :selected="selected"
          :indeterminate="indeterminate"
          :selected-count="selectedCount"
          :total-count="totalCount"
          @change="handleChange"
          @select-all="handleSelectAll"
          @invert-selection="handleInvertSelection"
          @clear-selection="handleClearSelection"
        />
        <div style="text-align: center; color: var(--text-secondary); font-size: var(--text-sm);">
          <p>Selected: {{ selectedCount }} / {{ totalCount }}</p>
          <p>State: {{ selected ? 'Selected' : indeterminate ? 'Indeterminate' : 'Not selected' }}</p>
        </div>
      </div>
    `
  }),
  parameters: {
    docs: {
      description: {
        story: 'Interactive demonstration with state management:\n\n## Features to Test:\n\n### **Basic Selection**\n- Click the toggle to select/deselect all items\n- Watch the state change from unselected → selected → unselected\n- Toolbar appears/displays based on selection state\n\n### **Toolbar Actions**\n- **Select All** - Selects all available items\n- **Invert Selection** - Toggles selected vs unselected items\n- **Clear Selection** - Deselects all items\n\n### **Visual States**\n- **Empty** - No selection (unchecked)\n- **Selected** - All items selected (checkmark)\n- **Indeterminate** - Partial selection (minus icon)\n- **Disabled** - Non-interactive state\n\n### **Keyboard Shortcuts**\n- **Ctrl+A** - Select all items\n- **Shift+Click** - Range selection (if implemented)\n- **Esc** - Clear selection\n- **Space/Enter** - Toggle selection\n\n### **Accessibility Features**\n- Screen reader announcements for state changes\n- High contrast mode support\n- Reduced motion animations\n- Proper ARIA labels and roles\n- Keyboard navigation support\n\nThe component provides sophisticated multi-select functionality with glass morphism design, smooth animations, and comprehensive accessibility support.'
      }
    }
  }
}