import type { Meta, StoryObj } from '@storybook/vue3'
import PerformanceTest from '@/components/PerformanceTest.vue'

const meta = {
  component: PerformanceTest,
  title: '🧩 Components/🔧 UI/PerformanceTest',
  tags: ['autodocs'],

  parameters: {
    layout: 'centered',
  },

  // Since PerformanceTest is a fixed positioned overlay, we need special container
  decorators: [
    (story) => ({
      components: { story },
      template: `
        <div style="height: 600px; width: 800px; position: relative; background: var(--surface-secondary); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg);">
          <div style="padding: var(--space-4);">
            <h2 style="margin: 0 0 var(--space-4) 0; color: var(--text-primary);">Performance Testing Demo</h2>
            <p style="margin: 0 0 var(--space-4) 0; color: var(--text-secondary);">The PerformanceTest component appears as a fixed overlay in the top-right corner.</p>
            <div style="background: var(--surface-tertiary); padding: var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <p style="margin: 0; color: var(--text-secondary); font-size: var(--text-sm);">🚀 Look for the performance testing panel in the top-right corner to test application performance with various scenarios.</p>
            </div>
          </div>
          <story />
        </div>
      `
    })
  ]
} satisfies Meta<typeof PerformanceTest>

export default meta
type Story = StoryObj<typeof meta>

// Default performance test component
export const Default: Story = {
  render: () => ({
    components: { PerformanceTest },
    template: '<PerformanceTest />'
  })
}

// Initial state - no test data loaded
export const InitialState: Story = {
  render: () => ({
    components: { PerformanceTest },
    template: '<PerformanceTest />',
    parameters: {
      docs: {
        description: {
          story: 'Initial state of the PerformanceTest component with no test data loaded. Shows three main buttons:\n\n• **Load 60 Test Tasks** - Generates and loads test tasks for performance testing\n• **Clear Test Data** - Disabled until test data is loaded\n• **Run Drag Performance Test** - Disabled until test data is loaded'
        }
      }
    }
  })
}

// After loading test data
export const AfterLoadingData: Story = {
  render: () => ({
    components: { PerformanceTest },
    template: '<PerformanceTest />',
    parameters: {
      docs: {
        description: {
          story: 'State after loading test data. Shows:\n\n• **Test Results** - Performance metrics from loading 60 tasks\n• **Test Data Info** - Statistics about loaded tasks\n• **Enabled Controls** - All buttons are now available for testing\n\nPerformance results include status indicators:\n• ✅ **Fast** - Under 100ms\n• ⚠️ **Medium** - 100-300ms\n• ❌ **Slow** - Over 300ms'
        }
      }
    }
  })
}

// During performance testing
export const DuringTesting: Story = {
  render: () => ({
    components: { PerformanceTest },
    template: '<PerformanceTest />',
    parameters: {
      docs: {
        description: {
          story: 'State during active performance testing. Shows:\n\n• **Loading State** - Buttons disabled during test execution\n• **Comprehensive Results** - Multiple performance metrics\n• **Task Statistics** - Live count of tasks by status\n\nThe performance test evaluates:\n• Task loading speed\n• Drag and drop performance\n• UI rendering performance\n• State management efficiency'
        }
      }
    }
  })
}

// Interactive demonstration
export const InteractiveDemo: Story = {
  render: () => ({
    components: { PerformanceTest },
    template: '<PerformanceTest />',
    parameters: {
      docs: {
        description: {
          story: 'Interactive performance testing demonstration:\n\n## How to Use:\n\n1. **Load Test Data** - Click "Load 60 Test Tasks" to generate sample tasks\n2. **View Results** - Check loading performance metrics\n3. **Run Performance Test** - Execute comprehensive drag performance tests\n4. **Clear Data** - Remove test data when finished\n\n## Performance Metrics:\n\n• **Task Loading** - Time to load 60 tasks into the store\n• **Drag Performance** - Speed of drag and drop operations\n• **UI Rendering** - Component render times\n• **Memory Usage** - Task storage efficiency\n\n## Performance Targets:\n\n- ✅ **Fast**: Under 100ms (excellent)\n- ⚠️ **Medium**: 100-300ms (acceptable)\n- ❌ **Slow**: Over 300ms (needs optimization)\n\nThis tool helps identify performance bottlenecks and ensure the application remains responsive with large amounts of data.'
        }
      }
    }
  })
}

// Performance monitoring scenario
export const PerformanceMonitoring: Story = {
  render: () => ({
    components: { PerformanceTest },
    template: '<PerformanceTest />',
    parameters: {
      docs: {
        description: {
          story: 'Performance monitoring scenario for development:\n\n## Use Cases:\n\n### Development Testing\n- Test performance with realistic data volumes\n- Identify UI bottlenecks early\n- Validate drag and drop performance\n- Monitor state management efficiency\n\n### Quality Assurance\n- Regression testing for performance\n- Validate performance across browsers\n- Test with different data sizes\n- Ensure consistent user experience\n\n### Optimization\n- Measure before/after performance\n- Identify slow operations\n- Profile critical user flows\n- Validate optimization results\n\n## Best Practices:\n\n1. **Test Early** - Run performance tests during development\n2. **Test Often** - Monitor performance changes over time\n3. **Test Realistically** - Use realistic data volumes\n4. **Test Consistently** - Use the same test scenarios\n\nThis component provides immediate feedback on application performance and helps maintain high-quality user experience.'
        }
      }
    }
  })
}