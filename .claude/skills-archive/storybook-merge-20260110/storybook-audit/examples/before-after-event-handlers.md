# Example: Missing Event Handlers Fix

## Problem
Story used modal component without providing required event handlers (`@close`, `@cancel`). Modal didn't have a way to close or cancel action.

## Detection
Stories using components with event emitters but not providing handlers for critical events (`@close`, `@submit`, `@confirm`, `@cancel`).

Critical events to check:
- `@close` - Modal/dropdown close action
- `@submit` - Form submission
- `@confirm` - Confirmation action
- `@cancel` - Cancellation action

## Before Code
**Component (ConfirmationModal.vue) defines emits:**
```typescript
const emit = defineEmits<{
  close: []
  confirm: []
  cancel: []
}>()
```

**Story (ConfirmationModal.stories.ts) - MISSING HANDLERS:**
```typescript
export const Default: Story = {
  args: {
    isOpen: true,
    title: 'Confirm Action',
    message: 'Are you sure?',
  },
  render: (args) => ({
    components: { ConfirmationModal },
    setup() {
      return { args }
    },
    template: `
      <ConfirmationModal
        :is-open="args.isOpen"
        :title="args.title"
        :message="args.message"
        // ❌ Missing: @close handler
        // ❌ Missing: @confirm handler
        // ❌ Missing: @cancel handler
      />
    `
  })
}
```

**Issue:** User clicks "Cancel" or "Confirm" buttons, but nothing happens because no event handlers are provided.

## After Code (Option A - Noop Handlers - RECOMMENDED)
```typescript
export const Default: Story = {
  args: {
    isOpen: true,
    title: 'Confirm Action',
    message: 'Are you sure?',
  },
  render: (args) => ({
    components: { ConfirmationModal },
    setup() {
      const handleClose = () => {
        console.log('Modal closed')
        args.isOpen = false  // Close modal in story
      }

      const handleConfirm = () => {
        console.log('Confirmed action')
        args.isOpen = false  // Close modal after confirm
      }

      const handleCancel = () => {
        console.log('Cancelled')
        args.isOpen = false  // Close modal after cancel
      }

      return { args, handleClose, handleConfirm, handleCancel }
    },
    template: `
      <ConfirmationModal
        :is-open="args.isOpen"
        :title="args.title"
        :message="args.message"
        @close="handleClose"
        @confirm="handleConfirm"
        @cancel="handleCancel"
      />
    `
  })
}
```

## After Code (Option B - Console.log Only - Simplest)
```typescript
export const Default: Story = {
  args: {
    isOpen: true,
    title: 'Confirm Action',
    message: 'Are you sure?',
  },
  render: (args) => ({
    components: { ConfirmationModal },
    template: `
      <ConfirmationModal
        :is-open="args.isOpen"
        :title="args.title"
        :message="args.message"
        @close="() => console.log('Closed')"
        @confirm="() => console.log('Confirmed')"
        @cancel="() => console.log('Cancelled')"
      />
    `
  })
}
```

## After Code (Option C - Interactive Demo with Toggle)
```typescript
export const InteractiveDemo: Story = {
  render: () => ({
    components: { ConfirmationModal },
    setup() {
      const isOpen = ref(true)

      const handleClose = () => {
        console.log('Modal closed')
        isOpen.value = false
      }

      const handleConfirm = () => {
        console.log('Confirmed action')
        isOpen.value = false
      }

      const handleCancel = () => {
        console.log('Cancelled')
        isOpen.value = false
      }

      const reopen = () => {
        isOpen.value = true
      }

      return { isOpen, handleClose, handleConfirm, handleCancel, reopen }
    },
    template: `
      <div>
        <button @click="reopen">Reopen Modal</button>
        <ConfirmationModal
          :is-open="isOpen"
          title="Confirm Action"
          message="Are you sure you want to proceed?"
          @close="handleClose"
          @confirm="handleConfirm"
          @cancel="handleCancel"
        />
      </div>
    `
  })
}
```

## Solution
Added event handlers (`@close`, `@confirm`, `@cancel`) to make modal interactive.

**How to detect missing handlers:**
1. Check component's `defineEmits` declaration
2. Identify critical events (close, submit, confirm, cancel)
3. Verify story provides handlers for these events

## Critical Event Handlers Checklist

For **Modal/Overlay** components:
- [ ] `@close` - User closes modal (X button, backdrop click, ESC)
- [ ] `@confirm` - User confirms action
- [ ] `@cancel` - User cancels action

For **Form** components:
- [ ] `@submit` - User submits form
- [ ] `@cancel` - User cancels form

For **Dropdown/Menu** components:
- [ ] `@close` - User closes dropdown (selection made, click outside)
- [ ] `@select` - User selects item

## How to Identify Critical Events

**Step 1:** Check component's `defineEmits`:
```bash
grep -A 10 "defineEmits" src/components/MyModal.vue
```

**Step 2:** Match against critical events list:
```typescript
const emit = defineEmits<{
  close: []        // CRITICAL - modal needs this
  confirm: []      // CRITICAL - modal needs this
  cancel: []       // CRITICAL - modal needs this
  somethingElse: []  // Optional - not critical
}>()
```

**Step 3:** Add handlers to story template:
```typescript
template: `
  <MyModal
    @close="() => {}"           // Noop or console.log
    @confirm="() => {}"         // Noop or console.log
    @cancel="() => {}"          // Noop or console.log
    @somethingElse="() => {}"    // Optional - can skip
  />
`
```

## Verification
1. Save changes to story file
2. Open Storybook and navigate to story
3. Try clicking modal buttons (Confirm, Cancel, X)
4. Check console for expected log messages
5. Confirm modal closes when appropriate

## Related
- Check 8: Event Handlers
