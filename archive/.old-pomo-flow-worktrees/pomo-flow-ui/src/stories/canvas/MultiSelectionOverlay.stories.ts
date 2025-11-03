import type { Meta, StoryObj } from '@storybook/vue3'
import MultiSelectionOverlay from '@/components/canvas/MultiSelectionOverlay.vue'

// Mock nodes data
const createMockNodes = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `node-${i + 1}`,
    type: 'taskNode',
    position: {
      x: 100 + (i % 3) * 250,
      y: 100 + Math.floor(i / 3) * 150
    },
    data: {
      label: `Task ${i + 1}`,
      priority: ['high', 'medium', 'low'][i % 3],
      status: 'todo'
    }
  }))
}

const meta = {
  component: MultiSelectionOverlay,
  title: '✨ Features/🎨 Canvas View/MultiSelectionOverlay',
  tags: ['autodocs'],

  parameters: {
    layout: 'fullscreen',
  },

  argTypes: {
    nodes: {
      control: 'array',
      description: 'Array of canvas nodes to select from',
    },
    selectedNodeIds: {
      control: 'array',
      description: 'Array of currently selected node IDs',
    },
  },
} satisfies Meta<typeof MultiSelectionOverlay>

export default meta
type Story = StoryObj<typeof meta>

// Basic Selection States
export const NoSelection: Story = {
  args: {
    nodes: createMockNodes(6),
    selectedNodeIds: [],
  },
  render: (args) => ({
    components: { MultiSelectionOverlay },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 100vw; height: 100vh; background: var(--surface-secondary); position: relative; overflow: hidden;">
        <!-- Mock canvas nodes -->
        <div v-for="node in args.nodes" :key="node.id"
             style="position: absolute; background: var(--surface-primary); border: 1px solid var(--border-medium); border-radius: 8px; padding: 12px; width: 200px; height: 80px;"
             :style="{ left: node.position.x + 'px', top: node.position.y + 'px' }">
          <div style="font-size: 14px; font-weight: 500; margin-bottom: 4px;">{{ node.data.label }}</div>
          <div style="display: flex; gap: 8px;">
            <span style="font-size: 12px; padding: 2px 6px; background: var(--surface-hover); border-radius: 4px;">{{ node.data.priority }}</span>
            <span style="font-size: 12px; color: var(--text-muted);">{{ node.data.status }}</span>
          </div>
        </div>

        <MultiSelectionOverlay v-bind="args"
          @selection-change="(selectedIds) => console.log('Selection changed:', selectedIds)"
          @bulk-action="(action, params) => console.log('Bulk action:', action, params)"
        />
      </div>
    `,
  })
}

export const SingleSelection: Story = {
  args: {
    nodes: createMockNodes(6),
    selectedNodeIds: ['node-2'],
  },
  render: (args) => ({
    components: { MultiSelectionOverlay },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 100vw; height: 100vh; background: var(--surface-secondary); position: relative; overflow: hidden;">
        <!-- Mock canvas nodes -->
        <div v-for="node in args.nodes" :key="node.id"
             :style="{ position: 'absolute', background: args.selectedNodeIds.includes(node.id) ? 'var(--color-work)' : 'var(--surface-primary)', border: '1px solid var(--border-medium)', borderRadius: '8px', padding: '12px', width: '200px', height: '80px', left: node.position.x + 'px', top: node.position.y + 'px' }">
          <div style="font-size: 14px; font-weight: 500; margin-bottom: 4px;">{{ node.data.label }}</div>
          <div style="display: flex; gap: 8px;">
            <span style="font-size: 12px; padding: 2px 6px; background: var(--surface-hover); border-radius: 4px;">{{ node.data.priority }}</span>
            <span style="font-size: 12px; color: var(--text-muted);">{{ node.data.status }}</span>
          </div>
        </div>

        <MultiSelectionOverlay v-bind="args"
          @selection-change="(selectedIds) => console.log('Selection changed:', selectedIds)"
          @bulk-action="(action, params) => console.log('Bulk action:', action, params)"
        />
      </div>
    `,
  })
}

export const MultipleSelection: Story = {
  args: {
    nodes: createMockNodes(8),
    selectedNodeIds: ['node-1', 'node-3', 'node-5', 'node-7'],
  },
  render: (args) => ({
    components: { MultiSelectionOverlay },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 100vw; height: 100vh; background: var(--surface-secondary); position: relative; overflow: hidden;">
        <!-- Mock canvas nodes -->
        <div v-for="node in args.nodes" :key="node.id"
             :style="{ position: 'absolute', background: args.selectedNodeIds.includes(node.id) ? 'var(--color-work)' : 'var(--surface-primary)', border: '1px solid var(--border-medium)', borderRadius: '8px', padding: '12px', width: '200px', height: '80px', left: node.position.x + 'px', top: node.position.y + 'px' }">
          <div style="font-size: 14px; font-weight: 500; margin-bottom: 4px;">{{ node.data.label }}</div>
          <div style="display: flex; gap: 8px;">
            <span style="font-size: 12px; padding: 2px 6px; background: var(--surface-hover); border-radius: 4px;">{{ node.data.priority }}</span>
            <span style="font-size: 12px; color: var(--text-muted);">{{ node.data.status }}</span>
          </div>
        </div>

        <MultiSelectionOverlay v-bind="args"
          @selection-change="(selectedIds) => console.log('Selection changed:', selectedIds)"
          @bulk-action="(action, params) => console.log('Bulk action:', action, params)"
        />
      </div>
    `,
  })
}

export const LargeSelection: Story = {
  args: {
    nodes: createMockNodes(15),
    selectedNodeIds: ['node-1', 'node-2', 'node-3', 'node-4', 'node-5', 'node-6', 'node-7', 'node-8'],
  },
  render: (args) => ({
    components: { MultiSelectionOverlay },
    setup() {
      return { args }
    },
    template: `
      <div style="width: 100vw; height: 100vh; background: var(--surface-secondary); position: relative; overflow: auto;">
        <!-- Mock canvas nodes -->
        <div v-for="node in args.nodes" :key="node.id"
             :style="{ position: 'absolute', background: args.selectedNodeIds.includes(node.id) ? 'var(--color-work)' : 'var(--surface-primary)', border: '1px solid var(--border-medium)', borderRadius: '8px', padding: '12px', width: '200px', height: '80px', left: node.position.x + 'px', top: node.position.y + 'px' }">
          <div style="font-size: 14px; font-weight: 500; margin-bottom: 4px;">{{ node.data.label }}</div>
          <div style="display: flex; gap: 8px;">
            <span style="font-size: 12px; padding: 2px 6px; background: var(--surface-hover); border-radius: 4px;">{{ node.data.priority }}</span>
            <span style="font-size: 12px; color: var(--text-muted);">{{ node.data.status }}</span>
          </div>
        </div>

        <MultiSelectionOverlay v-bind="args"
          @selection-change="(selectedIds) => console.log('Selection changed:', selectedIds)"
          @bulk-action="(action, params) => console.log('Bulk action:', action, params)"
        />
      </div>
    `,
  })
}

// Interactive Demo
export const InteractiveDemo: Story = {
  render: () => ({
    components: { MultiSelectionOverlay },
    setup() {
      const nodes = ref(createMockNodes(12))
      const selectedNodeIds = ref<string[]>([])
      const multiSelectMode = ref(true)

      const handleSelectionChange = (newSelection: string[]) => {
        selectedNodeIds.value = newSelection
        console.log('Selection changed:', newSelection)
      }

      const handleBulkAction = (action: string, params: any) => {
        console.log('Bulk action:', action, params)

        // Simulate bulk actions
        if (action === 'delete') {
          const confirmed = confirm(`Delete ${params.nodeIds.length} selected tasks?`)
          if (confirmed) {
            nodes.value = nodes.value.filter(node => !params.nodeIds.includes(node.id))
            selectedNodeIds.value = []
          }
        } else if (action === 'duplicate') {
          const newNodes = params.nodeIds.map(id => {
            const originalNode = nodes.value.find(n => n.id === id)
            if (originalNode) {
              return {
                ...originalNode,
                id: `${originalNode.id}-copy`,
                position: {
                  ...originalNode.position,
                  x: originalNode.position.x + 20,
                  y: originalNode.position.y + 20
                },
                data: {
                  ...originalNode.data,
                  label: `${originalNode.data.label} (Copy)`
                }
              }
            }
          }).filter(Boolean)

          nodes.value.push(...newNodes)
        }
      }

      // Simulate multi-select mode toggle
      const toggleMultiSelectMode = () => {
        multiSelectMode.value = !multiSelectMode.value
      }

      return {
        nodes,
        selectedNodeIds,
        multiSelectMode,
        handleSelectionChange,
        handleBulkAction,
        toggleMultiSelectMode
      }
    },
    template: `
      <div style="width: 100vw; height: 100vh; background: var(--surface-secondary); position: relative; overflow: hidden;">
        <!-- Controls Panel -->
        <div style="position: absolute; top: 20px; right: 20px; z-index: 100; background: var(--surface-primary); padding: 16px; border-radius: 8px; box-shadow: var(--shadow-md); min-width: 200px;">
          <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">Interactive Demo</h4>

          <div style="margin-bottom: 12px;">
            <button
              @click="toggleMultiSelectMode"
              style="padding: 6px 12px; background: multiSelectMode ? 'var(--color-work)' : 'var(--surface-hover)'; border: 1px solid var(--border-medium); border-radius: 4px; font-size: 12px; cursor: pointer; width: 100%;"
            >
              Multi-Select: {{ multiSelectMode ? 'ON' : 'OFF' }}
            </button>
          </div>

          <div style="margin-bottom: 12px;">
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">Total Nodes: {{ nodes.length }}</div>
            <div style="font-size: 12px; color: var(--text-secondary);">Selected: {{ selectedNodeIds.length }}</div>
          </div>

          <div style="padding: 8px; background: var(--surface-hover); border-radius: 4px; font-size: 11px; color: var(--text-muted);">
            <div>• Click nodes to select (when multi-select on)</div>
            <div>• Use bulk actions in overlay</div>
            <div>• Try Delete/Duplicate actions</div>
          </div>
        </div>

        <!-- Mock Canvas Background -->
        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: radial-gradient(circle, var(--border-subtle) 1px, transparent 1px); background-size: 20px 20px; opacity: 0.5;"></div>

        <!-- Mock canvas nodes -->
        <div
          v-for="node in nodes"
          :key="node.id"
          @click="multiSelectMode && (() => {
            const index = selectedNodeIds.indexOf(node.id)
            if (index > -1) {
              selectedNodeIds.splice(index, 1)
            } else {
              selectedNodeIds.push(node.id)
            }
            handleSelectionChange([...selectedNodeIds])
          })"
          :style="{
            position: 'absolute',
            background: selectedNodeIds.includes(node.id) ? 'var(--color-work)' : 'var(--surface-primary)',
            border: selectedNodeIds.includes(node.id) ? '2px solid var(--color-work)' : '1px solid var(--border-medium)',
            borderRadius: '8px',
            padding: '12px',
            width: '200px',
            height: '80px',
            left: node.position.x + 'px',
            top: node.position.y + 'px',
            cursor: multiSelectMode ? 'pointer' : 'default',
            transition: 'all 0.2s ease'
          }"
        >
          <div style="font-size: 14px; font-weight: 500; margin-bottom: 4px;">{{ node.data.label }}</div>
          <div style="display: flex; gap: 8px;">
            <span style="font-size: 12px; padding: 2px 6px; background: var(--surface-hover); border-radius: 4px;">{{ node.data.priority }}</span>
            <span style="font-size: 12px; color: var(--text-muted);">{{ node.data.status }}</span>
          </div>
        </div>

        <!-- MultiSelectionOverlay with simulated state -->
        <div v-if="multiSelectMode" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 1000;">
          <!-- Selection Controls -->
          <div style="position: absolute; top: var(--space-4); left: var(--space-4); background: var(--bg-secondary); border: 1px solid var(--border-primary); border-radius: var(--radius-lg); padding: var(--space-3); box-shadow: 0 4px 12px var(--shadow-strong); pointer-events: auto; min-width: 300px;">
            <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3);">
              <span style="font-size: var(--text-xs); font-weight: var(--font-medium); color: var(--text-secondary); min-width: 80px;">Mode:</span>
              <button style="display: flex; align-items: center; gap: var(--space-1); background: var(--brand-primary); border: none; color: white; padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); font-size: var(--text-xs); cursor: pointer;">
                Rectangle
              </button>
            </div>

            <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3);">
              <span style="font-size: var(--text-xs); font-weight: var(--font-medium); color: var(--text-secondary); min-width: 80px;">Actions:</span>
              <button @click="selectedNodeIds = []" style="display: flex; align-items: center; gap: var(--space-1); background: var(--surface-primary); border: 1px solid var(--border-secondary); color: var(--text-secondary); padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); font-size: var(--text-xs); cursor: pointer;">
                Clear
              </button>
              <button @click="selectedNodeIds = nodes.map(n => n.id)" style="display: flex; align-items: center; gap: var(--space-1); background: var(--surface-primary); border: 1px solid var(--border-secondary); color: var(--text-secondary); padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); font-size: var(--text-xs); cursor: pointer;">
                All
              </button>
            </div>

            <div v-if="selectedNodeIds.length > 0" style="display: flex; justify-content: space-between; align-items: center; padding-top: var(--space-2); border-top: 1px solid var(--border-secondary);">
              <span style="font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--text-primary);">{{ selectedNodeIds.length }} selected</span>

              <div style="position: relative;">
                <button @click="handleBulkAction('updateStatus', { nodeIds: selectedNodeIds, status: 'done' })" style="display: flex; align-items: center; gap: var(--space-1); background: var(--brand-primary); border: none; color: white; padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); font-size: var(--text-xs); cursor: pointer;">
                  Mark Done
                </button>
              </div>
            </div>
          </div>

          <!-- Selection Handles -->
          <div v-for="node in nodes.filter(n => selectedNodeIds.includes(n.id))" :key="node.id" style="position: absolute; border: 2px solid var(--brand-primary); border-radius: var(--radius-md); pointer-events: none;" :style="{ left: (node.position.x - 5) + 'px', top: (node.position.y - 5) + 'px', width: '210px', height: '90px' }">
            <div style="position: absolute; width: 8px; height: 8px; background: var(--brand-primary); border: 2px solid white; border-radius: var(--radius-xs); top: '-4px'; left: '-4px';"></div>
            <div style="position: absolute; width: 8px; height: 8px; background: var(--brand-primary); border: 2px solid white; border-radius: var(--radius-xs); top: '-4px'; right: '-4px';"></div>
            <div style="position: absolute; width: 8px; height: 8px; background: var(--brand-primary); border: 2px solid white; border-radius: var(--radius-xs); bottom: '-4px'; left: '-4px';"></div>
            <div style="position: absolute; width: 8px; height: 8px; background: var(--brand-primary); border: 2px solid white; border-radius: var(--radius-xs); bottom: '-4px'; right: '-4px';"></div>
          </div>
        </div>
      </div>
    `,
  })
}