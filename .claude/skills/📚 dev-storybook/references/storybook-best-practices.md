# Storybook Best Practices Reference

## Component Documentation Standards

### Story Structure
Every component should follow this story structure:

```typescript
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<ComponentType> = {
  title: 'Category/ComponentName',
  component: ComponentName,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Clear description of what this component does and when to use it.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    // Comprehensive controls for all props
  }
};

export default meta;
type Story = StoryObj<typeof meta>;
```

### Essential Stories
Every component should have these core stories:

1. **Default** - Basic state with minimal props
2. **Interactive** - Shows interaction capabilities
3. **All States** - Disabled, loading, error states if applicable
4. **Variants** - Different visual variants (primary, secondary, etc.)

## Prop Documentation Best Practices

### TypeScript Interfaces
Use descriptive TypeScript interfaces:

```typescript
interface ButtonProps {
  /** The text displayed on the button */
  children: React.ReactNode;

  /** The visual style variant */
  variant?: 'primary' | 'secondary' | 'danger';

  /** The button size */
  size?: 'small' | 'medium' | 'large';

  /** Whether the button is disabled */
  disabled?: boolean;

  /** Click handler */
  onClick?: (event: MouseEvent) => void;
}
```

### JSDoc Comments
Always include JSDoc comments for complex props:

```typescript
/**
 * The callback function called when the button is clicked
 * @param event - The mouse event object
 * @param data - Optional data passed to the handler
 */
onClick?: (event: MouseEvent, data?: any) => void;
```

## Controls Mapping

### Type-to-Control Mapping
```typescript
const controlMapping = {
  // Basic types
  'string': 'text',
  'number': 'number',
  'boolean': 'boolean',

  // Select types
  'enum': 'select',
  'union': 'select',

  // Complex types
  'array': 'object',
  'object': 'object',

  // Interactive types
  'function': 'action',
  'event': 'action'
};
```

### Control Configuration
```typescript
argTypes: {
  variant: {
    control: { type: 'select' },
    options: ['primary', 'secondary', 'danger'],
    description: 'The visual style variant of the button'
  },
  size: {
    control: { type: 'radio' },
    options: ['small', 'medium', 'large']
  },
  onClick: {
    action: 'clicked'
  }
}
```

## Testing Standards

### Visual Testing
- Test all component states and variants
- Include responsive breakpoints
- Test dark/light themes if applicable
- Include internationalization variations

### Accessibility Testing
- Test keyboard navigation
- Verify ARIA attributes
- Check color contrast ratios
- Test screen reader compatibility

### Interaction Testing
- Test all user interactions
- Verify event handlers work correctly
- Test error states and edge cases
- Validate form inputs

## Documentation Content

### Component Description
Include:
- What the component does
- When to use it
- Design considerations
- Accessibility notes
- Performance considerations

### Props Documentation
For each prop, document:
- Purpose and usage
- Default behavior
- Constraints and validation
- Examples of common usage

### Usage Examples
Provide practical examples:
```typescript
export const UsageExample: Story = {
  render: () => (
    <div>
      <Button variant="primary">Primary Button</Button>
      <Button variant="secondary">Secondary Button</Button>
      <Button disabled>Disabled Button</Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Example showing different button variants and states.'
      }
    }
  }
};
```

## Framework-Specific Guidelines

### React
- Use functional components with hooks
- Leverage TypeScript interfaces
- Use CSF3 (Component Story Format 3)
- Include autodocs tags

### Vue
- Use Vue 3 Composition API
- Include prop validation
- Use Single File Components
- Test slot content

### Svelte
- Use modern Svelte syntax
- Include prop typing
- Test reactive behavior
- Include slot documentation

## Performance Considerations

### Story Optimization
- Lazy load heavy components
- Use decorators for complex setups
- Optimize initial render time
- Mock heavy dependencies

### Bundle Size
- Split large stories
- Use dynamic imports
- Optimize asset loading
- Monitor bundle impact

## Integration Guidelines

### Design Systems
- Follow design token patterns
- Include theme variants
- Document design decisions
- Maintain consistency

### CI/CD Integration
- Enforce story coverage
- Run visual tests
- Validate documentation
- Automate deployment

## Common Patterns

### Form Components
```typescript
export const FormExample: Story = {
  render: () => {
    const [value, setValue] = useState('');

    return (
      <Form onSubmit={(data) => console.log(data)}>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter text"
        />
        <Button type="submit">Submit</Button>
      </Form>
    );
  }
};
```

### Data Display Components
```typescript
export const DataTable: Story = {
  render: () => (
    <Table
      data={mockData}
      columns={tableColumns}
      pagination
      sortable
      filterable
    />
  )
};
```

### Interactive Components
```typescript
export const InteractiveExample: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <div>
        <Button onClick={() => setIsOpen(!isOpen)}>
          Toggle Modal
        </Button>
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        >
          Modal content
        </Modal>
      </div>
    );
  }
};
```

## Accessibility Standards

### ARIA Attributes
- Use semantic HTML elements
- Include appropriate ARIA roles
- Provide alternative text
- Support keyboard navigation

### Focus Management
- Manage focus in modals and dropdowns
- Include visible focus indicators
- Support tab navigation
- Handle escape keys

### Color Contrast
- Meet WCAG 2.1 AA standards
- Test in light and dark modes
- Ensure text readability
- Verify interactive element visibility

## Maintenance Guidelines

### Keeping Stories Updated
- Update stories when components change
- Review documentation regularly
- Add new variants as needed
- Remove outdated examples

### Version Management
- Tag stories with version info
- Document breaking changes
- Maintain backward compatibility
- Update migration guides

## Quality Assurance

### Review Checklist
- [ ] All props have controls
- [ ] All variants are documented
- [ ] Stories render without errors
- [ ] Accessibility tests pass
- [ ] Visual tests are stable
- [ ] Documentation is accurate
- [ ] Examples are practical

### Automated Checks
- Lint story files
- Validate TypeScript types
- Test story compilation
- Check for missing props
- Validate control mappings