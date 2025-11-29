---
name: dev-storybook
description: Build and fix Storybook stories for Vue 3 components with proper patterns, error resolution, and consistent documentation
---

# dev-storybook

BUILD Storybook stories for Vue 3 components with TypeScript. Document components, create interactive demos, and handle common Storybook patterns. Use when creating component documentation, fixing story compilation errors, or setting up visual testing.

## Core Responsibilities

1. **Story Creation**: Write well-structured Storybook stories for Vue 3 components
2. **Error Resolution**: Fix TypeScript and Vue compilation errors in stories
3. **Styling Patterns**: Apply CSS correctly in Storybook without runtime template errors
4. **Component Props**: Ensure correct prop types and event handlers

## Critical Rules

### Vue 3 Template Restrictions

**NEVER use `<style>` or `<script>` tags inside runtime templates**:

```typescript
// ❌ WRONG - Causes Vue compilation error
template: `
  <div>
    <style>
      .my-class { color: red; }
    </style>
    <MyComponent />
  </div>
`

// ✅ CORRECT - Apply styles globally or use inline styles
template: `
  <div>
    <MyComponent />
  </div>
`
```

### Component Prop Verification

**ALWAYS verify component props before writing stories**:

```bash
# Check component interface
grep -A 5 "interface Props" src/components/MyComponent.vue
grep -A 5 "defineProps" src/components/MyComponent.vue
```

Example fix:
```typescript
// Component expects: { isOpen: boolean, taskIds: string[] }
// ❌ WRONG story args
args: {
  isVisible: true,  // Wrong prop name
  selectedTasks: [] // Wrong prop name
}

// ✅ CORRECT story args
args: {
  isOpen: true,
  taskIds: ['1', '2', '3']
}
```

### Import Requirements

**ALWAYS include required Vue imports**:

```typescript
import type { Meta, StoryObj } from '@storybook/vue3'
import { ref, reactive, computed } from 'vue' // Include all Vue APIs you use
import MyComponent from '@/components/MyComponent.vue'
```

Common missing imports:
- `ref` - For reactive state
- `reactive` - For reactive objects
- `computed` - For computed properties
- `watch` - For watchers
- `onMounted`, `onUnmounted` - For lifecycle hooks

## Story Structure Pattern

### Basic Story Template

```typescript
import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import MyComponent from '@/components/MyComponent.vue'

const meta = {
  component: MyComponent,
  title: '📁 Category/MyComponent',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered', // or 'fullscreen'
    docs: {
      description: {
        component: 'Component description here'
      }
    }
  }
} satisfies Meta<typeof MyComponent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    // Component props here
    isOpen: true,
    title: 'Example'
  },
  render: (args) => ({
    components: { MyComponent },
    setup() {
      const isOpen = ref(args.isOpen)

      const handleClose = () => {
        isOpen.value = false
      }

      return {
        isOpen,
        handleClose,
        args
      }
    },
    template: `
      <MyComponent
        v-bind="args"
        :is-open="isOpen"
        @close="handleClose"
      />
    `
  })
}
```

### Modal/Overlay Story Pattern

```typescript
export const ModalExample: Story = {
  parameters: {
    layout: 'fullscreen' // Modal needs full screen
  },
  args: {
    isOpen: true,
    title: 'Modal Title'
  },
  render: (args) => ({
    components: { MyModal },
    setup() {
      const isOpen = ref(args.isOpen)

      return {
        isOpen,
        args,
        handleClose: () => { isOpen.value = false },
        handleConfirm: () => { console.log('Confirmed') }
      }
    },
    template: `
      <div style="width: 100vw; height: 100vh; background: var(--surface-secondary);">
        <MyModal
          v-bind="args"
          :is-open="isOpen"
          @close="handleClose"
          @confirm="handleConfirm"
        />
      </div>
    `
  })
}
```

## Story Organization Standards

### CRITICAL: Consolidate, Don't Duplicate

**Problem**: Too many similar stories create confusion and make components harder to understand.

**Solution**: Use focused, well-documented stories with clear purpose.

### Recommended Story Structure (5-Story Pattern)

Every component story file should follow this organization:

#### 1. **Default Story** (Primary with interactive controls)
```typescript
export const Default: Story = {
  args: {
    variant: 'default',
    hoverable: false,
    // ... all props with defaults
  },
  render: (args) => ({
    components: { MyComponent },
    setup() {
      return { args }
    },
    template: `
      <MyComponent v-bind="args" style="width: 320px;">
        <div style="padding: var(--space-2);">
          <h3 style="margin: 0 0 var(--space-2) 0; font-size: 16px; font-weight: 600;">
            Default Component
          </h3>
          <p style="margin: 0; font-size: 14px; color: var(--text-secondary);">
            Usage guidance explaining when/where to use this component.
          </p>
        </div>
      </MyComponent>
    `
  })
}
```

**Purpose**: Interactive playground for testing all prop combinations via Controls panel.

#### 2. **Variants Story** (Consolidated comparison)
```typescript
export const Variants: Story = {
  parameters: {
    docs: {
      description: {
        story: `**Visual variants for different contexts:**

- **Variant A**: When to use this variant
- **Variant B**: When to use this variant
- **Variant C**: When to use this variant`
      }
    }
  },
  render: () => ({
    components: { MyComponent },
    template: `
      <div style="display: flex; gap: var(--space-6); flex-wrap: wrap;">
        <MyComponent variant="a" style="width: 280px;">
          <div style="padding: var(--space-4);">
            <h4>Variant A</h4>
            <p>Use when [specific context]</p>
          </div>
        </MyComponent>

        <MyComponent variant="b" style="width: 280px;">
          <div style="padding: var(--space-4);">
            <h4>Variant B</h4>
            <p>Use when [specific context]</p>
          </div>
        </MyComponent>
      </div>
    `
  })
}
```

**Purpose**: Show all visual variants **side by side** with usage guidance.

**Anti-pattern**: Don't create separate stories for each variant (VariantA, VariantB, VariantC). Consolidate!

#### 3. **Effects/States Story** (Realistic contexts)
```typescript
export const Effects: Story = {
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story: `**Effects for interaction and visual hierarchy:**

- **Hoverable**: Use when components are clickable
- **Glass**: Use on colorful/gradient backgrounds
- **Elevated**: Use to emphasize important content`
      }
    }
  },
  render: () => ({
    components: { MyComponent },
    template: `
      <div style="padding: var(--space-8); display: flex; flex-direction: column; gap: var(--space-8);">
        <!-- Hoverable -->
        <div>
          <h3>Hoverable Component</h3>
          <p>Use when components are clickable. Hover to see the effect.</p>
          <MyComponent hoverable style="width: 320px; cursor: pointer;">
            Content here
          </MyComponent>
        </div>

        <!-- Glass Effect (SHOW IN REALISTIC CONTEXT) -->
        <div>
          <h3>Glass Effect</h3>
          <p>Use on colorful or gradient backgrounds.</p>
          <div style="padding: var(--space-8); background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: var(--radius-xl);">
            <MyComponent glass style="width: 320px;">
              Glass effect shown on actual gradient!
            </MyComponent>
          </div>
        </div>
      </div>
    `
  })
}
```

**Purpose**: Show effects/states in **realistic visual contexts** (e.g., glass on gradient, not plain background).

**Critical**: Always show effects where they actually make sense visually.

#### 4. **WithSlots/Structure Story** (Slot patterns)
```typescript
export const WithSlots: Story = {
  parameters: {
    docs: {
      description: {
        story: `**Component supports slots for structured content:**

- **Header**: For titles, actions, or badges
- **Footer**: For metadata, timestamps, or action buttons
- Use slots to create consistent, structured layouts`
      }
    }
  },
  render: () => ({
    components: { MyComponent },
    template: `
      <div style="display: flex; gap: var(--space-6); flex-wrap: wrap;">
        <!-- Header only -->
        <MyComponent style="width: 300px;">
          <template #header>
            <h3>Header Content</h3>
          </template>
          Main content
        </MyComponent>

        <!-- Footer only -->
        <MyComponent style="width: 300px;">
          Main content
          <template #footer>
            Footer actions
          </template>
        </MyComponent>

        <!-- Both -->
        <MyComponent style="width: 300px;">
          <template #header>Header</template>
          Main content
          <template #footer>Footer</template>
        </MyComponent>
      </div>
    `
  })
}
```

**Purpose**: Show slot usage patterns side by side.

#### 5. **Real-World Example** (Production-ready)
```typescript
export const TaskCardExample: Story = {
  parameters: {
    docs: {
      description: {
        story: 'A realistic example showing how to combine variants, effects, and slots for production use.'
      }
    }
  },
  render: () => ({
    components: { MyComponent },
    template: `
      <MyComponent hoverable elevated style="width: 380px;">
        <template #header>
          <!-- Complex header with badges, title, etc. -->
        </template>

        <div style="display: flex; flex-direction: column; gap: var(--space-4);">
          <!-- Rich content with metadata, progress, etc. -->
        </div>

        <template #footer>
          <!-- Actions and metadata -->
        </template>
      </MyComponent>
    `
  })
}
```

**Purpose**: Show production-ready example combining multiple features.

### Usage Guidance Requirements

**EVERY story must include usage guidance**. Never show a variant without explaining when to use it.

#### Component-Level Documentation
```typescript
const meta = {
  component: MyComponent,
  title: '🧩 Components/🔘 Base/MyComponent',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `Component description explaining its purpose.

**When to use:**
- Specific use case 1
- Specific use case 2
- Specific use case 3`
      }
    }
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'outlined', 'filled'],
      description: 'Visual style variant',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'default' }
      }
    }
  }
}
```

#### Story-Level Documentation
```typescript
export const Variants: Story = {
  parameters: {
    docs: {
      description: {
        story: `**Visual variants for different contexts:**

- **Default**: Standard style (use for X)
- **Outlined**: Transparent background (use for Y)
- **Filled**: Solid background (use for Z)`
      }
    }
  }
}
```

### Visual Context Best Practices

#### ✅ GOOD: Show effects in realistic contexts
```typescript
// Glass effect on gradient
<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: var(--space-8);">
  <MyComponent glass>
    Now the glass effect actually makes sense!
  </MyComponent>
</div>

// Elevated card on page
<div style="padding: var(--space-8); background: var(--surface-primary);">
  <MyComponent elevated>
    Extra shadow creates depth on the page
  </MyComponent>
</div>
```

#### ❌ BAD: Show effects on plain backgrounds
```typescript
// Glass effect on plain background (can't see blur!)
<MyComponent glass>
  Glass effect is invisible here
</MyComponent>

// Elevated without context (shadow purpose unclear)
<MyComponent elevated>
  Why is this elevated?
</MyComponent>
```

### ArgTypes Standards

Always include comprehensive argTypes with descriptions:

```typescript
argTypes: {
  variant: {
    control: 'select',
    options: ['default', 'outlined', 'filled'],
    description: 'Visual style variant',
    table: {
      type: { summary: 'string' },
      defaultValue: { summary: 'default' }
    }
  },
  hoverable: {
    control: 'boolean',
    description: 'Add hover effects (elevation & transform)',
    table: {
      type: { summary: 'boolean' },
      defaultValue: { summary: 'false' }
    }
  }
}
```

### Story Consolidation Checklist

Before creating multiple similar stories, ask:

- [ ] Can these variants be shown side by side in one story?
- [ ] Does each story explain WHEN to use it?
- [ ] Are effects shown in realistic visual contexts?
- [ ] Is the Default story using args for interactivity?
- [ ] Does the documentation include "When to use" guidance?

**Target**: 5-7 focused stories per component, NOT 12+ redundant stories.

## CSS Styling Patterns

### Option 1: Inline Styles (Preferred for simple cases)

```typescript
template: `
  <div style="padding: 20px; background: var(--surface-primary);">
    <MyComponent />
  </div>
`
```

### Option 2: CSS Variables (Use design tokens)

```typescript
template: `
  <div style="
    padding: var(--space-4);
    background: var(--surface-primary);
    border-radius: var(--radius-lg);
  ">
    <MyComponent />
  </div>
`
```

### Option 3: Global Styling (For component-wide changes)

Modify the component's scoped styles directly in the `.vue` file instead of trying to override in stories.

## Common Errors and Fixes

### Error: "Tags with side effect (<script> and <style>) are ignored"

**Cause**: Attempting to use `<style>` or `<script>` tags in runtime template

**Fix**: Remove the tags and use inline styles or global component styles

```typescript
// Before (causes error)
template: `<div><style>.foo{}</style><Component /></div>`

// After (works)
template: `<div style="..."><Component /></div>`
```

### Error: "Cannot find module '@/components/...'"

**Cause**: TypeScript path resolution in story files

**Fix**: This is usually a TypeScript check error only. Storybook will still work because Vite handles the paths. You can ignore or configure `tsconfig.json` to include story files.

### Error: "Cannot find name 'ref'"

**Cause**: Missing Vue import

**Fix**: Add `import { ref } from 'vue'`

### Error: "Missing required prop: 'propName'"

**Cause**: Component expects different props than story provides

**Fix**:
1. Check component props: `grep -A 5 "defineProps" src/components/MyComponent.vue`
2. Update story args to match
3. Ensure event handlers match emitted events

## Storybook Configuration

### Running Storybook

```bash
npm run storybook        # Start on port 6006
npm run build-storybook  # Build static site
```

### Story File Patterns

Stories are auto-discovered from:
- `src/**/*.stories.ts`
- `src/**/*.stories.tsx`

### Decorators Pattern

```typescript
decorators: [
  () => ({
    template: '<div style="width: 100%; height: 100vh;"><story /></div>'
  })
]
```

## Mock Data Patterns

### Creating Mock Store

```typescript
const createMockStore = (overrides = {}) => ({
  state: {
    items: [],
    ...overrides
  },
  getItem: (id: string) => mockData.find(item => item.id === id),
  updateItem: (id: string, data: any) => {
    console.log('Updated:', id, data)
  }
})

export const WithMockStore: Story = {
  render: () => ({
    setup() {
      const store = createMockStore({ items: mockItems })
      return { store }
    }
  })
}
```

## Design System Colors Fix

**CRITICAL**: Ensure design tokens use neutral grays (no blue tint)

Blue-tinted grays (WRONG):
```css
--gray-950: 218, 33%, 12%;   /* Hue 218 = Blue! */
--gray-900: 217, 33%, 17%;   /* High saturation = Color tint! */
```

Neutral grays (CORRECT):
```css
--gray-950: 0, 0%, 12%;   /* Hue 0, Saturation 0% = Neutral */
--gray-900: 0, 0%, 17%;   /* No color tint */
```

Check for blue tint:
```bash
grep "gray-9" src/assets/design-tokens.css
```

## Testing Stories

1. **Visual Check**: Open http://localhost:6006 and verify rendering
2. **Interaction**: Test interactive elements (buttons, inputs, modals)
3. **Responsive**: Check different viewport sizes
4. **Error Console**: Look for Vue warnings or errors

## Best Practices

1. **One Component Per Story File**: Each component gets its own `.stories.ts`
2. **Multiple Variants**: Create stories for different states (Default, Loading, Error, etc.)
3. **Descriptive Names**: Use clear story names like `Default`, `WithData`, `ErrorState`
4. **Documentation**: Add descriptions using `parameters.docs.description`
5. **Args Controls**: Use `argTypes` to make props interactive
6. **Real Data**: Use realistic mock data that represents actual use cases

## Common Story Variants

```typescript
export const Default: Story = { /* Basic usage */ }
export const Loading: Story = { /* Loading state */ }
export const Error: Story = { /* Error state */ }
export const WithData: Story = { /* Populated with data */ }
export const Empty: Story = { /* Empty state */ }
export const Interactive: Story = { /* Full interaction demo */ }
```

## Resources

- Storybook Docs: https://storybook.js.org/docs/vue/get-started/introduction
- Vue 3 + Storybook: https://storybook.js.org/docs/vue/writing-stories/introduction
- Component Story Format (CSF): https://storybook.js.org/docs/api/csf

---

**When to use this skill**: Creating or fixing Storybook stories, resolving story compilation errors, documenting Vue 3 components, setting up component showcases.

---

## MANDATORY USER VERIFICATION REQUIREMENT

### Policy: No Fix Claims Without User Confirmation

**CRITICAL**: Before claiming ANY issue, bug, or problem is "fixed", "resolved", "working", or "complete", the following verification protocol is MANDATORY:

#### Step 1: Technical Verification
- Run all relevant tests (build, type-check, unit tests)
- Verify no console errors
- Take screenshots/evidence of the fix

#### Step 2: User Verification Request
**REQUIRED**: Use the `AskUserQuestion` tool to explicitly ask the user to verify the fix:

```
"I've implemented [description of fix]. Before I mark this as complete, please verify:
1. [Specific thing to check #1]
2. [Specific thing to check #2]
3. Does this fix the issue you were experiencing?

Please confirm the fix works as expected, or let me know what's still not working."
```

#### Step 3: Wait for User Confirmation
- **DO NOT** proceed with claims of success until user responds
- **DO NOT** mark tasks as "completed" without user confirmation
- **DO NOT** use phrases like "fixed", "resolved", "working" without user verification

#### Step 4: Handle User Feedback
- If user confirms: Document the fix and mark as complete
- If user reports issues: Continue debugging, repeat verification cycle

### Prohibited Actions (Without User Verification)
- Claiming a bug is "fixed"
- Stating functionality is "working"
- Marking issues as "resolved"
- Declaring features as "complete"
- Any success claims about fixes

### Required Evidence Before User Verification Request
1. Technical tests passing
2. Visual confirmation via Playwright/screenshots
3. Specific test scenarios executed
4. Clear description of what was changed

**Remember: The user is the final authority on whether something is fixed. No exceptions.**
