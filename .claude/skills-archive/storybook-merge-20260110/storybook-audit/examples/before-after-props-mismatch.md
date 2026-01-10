# Example: Props Mismatch Fix

## Problem
Story provided incorrect prop names that didn't match component's `defineProps`. Story args: `isVisible`, but component expects: `isOpen`.

## Detection
1. Check component's `defineProps` interface
2. Compare with story's `args` object
3. Look for missing or misnamed props

Run:
```bash
grep -A 20 "defineProps" src/components/MyModal.vue
grep -A 15 "args:" src/stories/MyModal.stories.ts
```

## Before Code
**Component (MyModal.vue):**
```typescript
interface Props {
  isOpen: boolean  // Component expects: isOpen
  title?: string
  message?: string
  onConfirm?: () => void
  onCancel?: () => void
}

const props = defineProps<Props>()
```

**Story (MyModal.stories.ts):**
```typescript
export const Default: Story = {
  args: {
    isVisible: true,  // ❌ Wrong prop name!
    title: 'Confirm Action',
    onConfirm: () => console.log('Confirmed'),
  },
  render: (args) => ({
    components: { MyModal },
    setup() {
      const isOpen = ref(args.isVisible)  // ❌ Using wrong prop
      return { isOpen, args }
    },
    template: `<MyModal :is-open="isOpen" v-bind="args" />`
  })
}
```

**Error:**
```
[Vue warn]: Missing required prop: "isOpen"
```

## After Code
```typescript
export const Default: Story = {
  args: {
    isOpen: true,  // ✅ Correct prop name!
    title: 'Confirm Action',
    onConfirm: () => console.log('Confirmed'),
    onCancel: () => console.log('Cancelled'),
  },
  render: (args) => ({
    components: { MyModal },
    setup() {
      const isOpen = ref(args.isOpen)  // ✅ Using correct prop
      const handleClose = () => {
        isOpen.value = false
        console.log('Modal closed')
      }

      return { isOpen, handleClose, args }
    },
    template: `
      <MyModal
        :is-open="isOpen"
        :title="args.title"
        @confirm="args.onConfirm"
        @cancel="handleClose"
      />
    `
  })
}
```

## Common Mismatches
| Story Arg | Actual Prop | Fix |
|-----------|-------------|-----|
| `isVisible` | `isOpen` | Use `isOpen` |
| `selectedTasks` | `taskIds` | Use `taskIds` |
| `onClose` | `@close` emit | Add handler in template |
| `onChange` | `@update:modelValue` | Use correct event name |
| `value` | `modelValue` | Use `modelValue` for v-model |

## Solution
Changed `isVisible` to `isOpen` to match component's `defineProps` interface.

**How to prevent this:**
1. Always check component's `defineProps` before writing stories
2. Use TypeScript types for better autocomplete
3. Verify component interface with:
   ```bash
   grep -A 5 "interface Props" src/components/MyComponent.vue
   ```

## Verification
1. Open Storybook
2. Navigate to the story
3. Confirm no Vue warnings about missing props
4. Confirm all props work as expected

## Related
- Check 4: Props Mismatch
