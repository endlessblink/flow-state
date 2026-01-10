# Example: Missing Vue Imports Fix

## Problem
Story used `ref()` and `computed()` without importing them from Vue. TypeScript error: "Cannot find name 'ref'".

## Detection
Stories using Vue APIs (`ref`, `reactive`, `computed`, `watch`, `onMounted`, etc.) without importing them.

Run: `grep -rn "ref\|reactive\|computed\|watch" src/stories/ | grep -v "from 'vue'"`

## Before Code
```typescript
import type { Meta, StoryObj } from '@storybook/vue3'
import MyComponent from '@/components/MyComponent.vue'

// ❌ Missing: import { ref, computed } from 'vue'

export const InteractiveDemo: Story = {
  render: () => ({
    components: { MyComponent },
    setup() {
      const counter = ref(0)  // ❌ Error: Cannot find name 'ref'
      const doubleCounter = computed(() => counter.value * 2)  // ❌ Error: Cannot find name 'computed'

      const handleClick = () => {
        counter.value++
      }

      return { counter, doubleCounter, handleClick }
    },
    template: `
      <MyComponent :count="counter" @click="handleClick" />
      <div>Double: {{ doubleCounter }}</div>
    `
  })
}
```

**TypeScript Errors:**
```
ERROR [1:18] Cannot find name 'ref'
ERROR [2:26] Cannot find name 'computed'
```

## After Code
```typescript
import type { Meta, StoryObj } from '@storybook/vue3'
import { ref, computed } from 'vue'  // ✅ Add missing imports
import MyComponent from '@/components/MyComponent.vue'

export const InteractiveDemo: Story = {
  render: () => ({
    components: { MyComponent },
    setup() {
      const counter = ref(0)  // ✅ Works now!
      const doubleCounter = computed(() => counter.value * 2)  // ✅ Works now!

      const handleClick = () => {
        counter.value++
      }

      return { counter, doubleCounter, handleClick }
    },
    template: `
      <MyComponent :count="counter" @click="handleClick" />
      <div>Double: {{ doubleCounter }}</div>
    `
  })
}
```

## Solution
Added missing Vue imports (`ref`, `computed`) to the import statement.

**How to check for missing imports:**
1. Look for Vue API usage in `setup()` function
2. Verify each API is imported from 'vue'
3. Add missing imports to existing Vue import or create new line

## Common Vue APIs That Need Import
| API | Description | Import |
|-----|-------------|--------|
| `ref` | Reactive primitive | `import { ref } from 'vue'` |
| `reactive` | Reactive object | `import { reactive } from 'vue'` |
| `computed` | Computed property | `import { computed } from 'vue'` |
| `watch` | Watcher | `import { watch } from 'vue'` |
| `watchEffect` | Immediate watcher | `import { watchEffect } from 'vue'` |
| `onMounted` | Lifecycle hook | `import { onMounted } from 'vue'` |
| `onUnmounted` | Lifecycle hook | `import { onUnmounted } from 'vue'` |
| `nextTick` | Next DOM update | `import { nextTick } from 'vue'` |
| `toRefs` | Destructure reactive | `import { toRefs } from 'vue'` |

## Pattern: Adding to Existing Vue Import
```typescript
// Before: Existing import is present
import { ref } from 'vue'

// After: Add new APIs to same import line
import { ref, computed, watch, onMounted } from 'vue'
```

## Pattern: Creating New Vue Import
```typescript
// Before: No Vue import exists
import MyComponent from '@/components/MyComponent.vue'

// After: Add Vue import before component import
import { ref, computed } from 'vue'
import MyComponent from '@/components/MyComponent.vue'
```

## Quick Detection Script
```bash
# Find stories using Vue APIs without imports
grep -rn "ref\|reactive\|computed\|watch" src/stories/ --include="*.ts" | \
  grep -v "from 'vue'" | \
  cut -d: -f1 | \
  sort -u
```

## Verification
1. Save changes to story file
2. Check TypeScript errors are resolved
3. Open Storybook and navigate to story
4. Confirm component renders correctly

## Related
- Check 7: Missing Vue Imports
- dev-storybook: Import Requirements section
