# Example: Store Dependency Fix (Real Case from AuthModal)

## Problem
`AuthModal` story imported real Pinia stores (`useUIStore`, `useAuthStore`), which triggered PouchDB initialization in Storybook. This caused database errors and conflicts.

## Detection
Stories importing from `@/stores/` directory.

Run: `grep -rn "from '@/stores" src/stories/auth/AuthModal.stories.ts`

## Before Code
```typescript
import type { Meta, StoryObj } from '@storybook/vue3'
import AuthModal from '@/components/auth/AuthModal.vue'
import { useUIStore } from '@/stores/ui'  // ❌ Real store import!
import { useAuthStore } from '@/stores/auth'  // ❌ Real store import!

export const Login: Story = {
  render: (args: any) => ({
    components: { AuthModal },
    setup() {
      const uiStore = useUIStore()  // ❌ Triggers PouchDB init!
      const authStore = useAuthStore()  // ❌ Triggers PouchDB init!

      // Mock stores for Storybook
      uiStore.authModalOpen = args.isOpen
      uiStore.authModalView = args.view

      return { args, uiStore, authStore }
    },
    template: `<AuthModal :is-open="uiStore.authModalOpen" @close="uiStore.closeAuthModal" />`
  })
}
```

**Error in Console:**
```
⚠️ [DATABASE] Document tasks:data has 178 conflicts
⚠️ [DATABASE] Document projects:data has 171 conflicts
```

## After Code (Option A - Props Only - RECOMMENDED)
```typescript
import type { Meta, StoryObj } from '@storybook/vue3'
import AuthModal from '@/components/auth/AuthModal.vue'
import LoginForm from '@/components/auth/LoginForm.vue'

// No store imports! ✅

export const Login: Story = {
  name: 'Login View',
  args: {
    isOpen: true,
    view: 'login'
  },
  render: (args: any) => ({
    components: { AuthModal, LoginForm },
    setup() {
      // Use local state instead of store ✅
      const isOpen = ref(args.isOpen)

      const handleClose = () => {
        isOpen.value = false
        console.log('Modal closed')
      }

      const handleSuccess = () => {
        console.log('Login successful')
      }

      return { isOpen, handleClose, handleSuccess, args }
    },
    template: `
      <AuthModal
        :is-open="isOpen"
        @close="handleClose"
        @success="handleSuccess"
      >
        <template #google-signin>
          <div style="padding: 12px; text-align: center; color: var(--text-muted);">
            Google Sign-In would go here
          </div>
        </template>
      </AuthModal>
    `
  })
}
```

## After Code (Option B - Fresh Pinia Decorator)
If component MUST use store:

```typescript
// Create: src/stories/decorators/freshPiniaDecorator.ts
import { createPinia, setActivePinia } from 'pinia'

export const freshPiniaDecorator = (story: any) => {
  setActivePinia(createPinia())
  return story()
}
```

```typescript
import { freshPiniaDecorator } from '../decorators/freshPiniaDecorator'

const meta: Meta<typeof AuthModal> = {
  component: AuthModal,
  title: '🎭 Overlays/🪟 Modals/Auth Modal',
  tags: ['autodocs'],
  decorators: [freshPiniaDecorator],  // Fresh Pinia instance!
  // ...
}

export const Login: Story = {
  render: (args: any) => ({
    components: { AuthModal },
    setup() {
      const uiStore = useUIStore()  // ✅ Uses fresh isolated Pinia
      const authStore = useAuthStore()

      uiStore.authModalOpen = args.isOpen
      return { uiStore, authStore, args }
    },
    template: `<AuthModal :is-open="uiStore.authModalOpen" @close="uiStore.closeAuthModal" />`
  })
}
```

## Solution
Removed real store imports and used local state (`ref`) instead. This prevents PouchDB initialization in Storybook.

**Why this matters:**
- Stores initialize PouchDB on first access
- If main app has accumulated conflicts (178+ tasks, 171+ projects), Storybook errors
- Storybook should use mock data, not production database

## Verification
1. Open Storybook console
2. Navigate to AuthModal stories
3. Confirm no database errors in console
4. Confirm modal renders correctly

## Related
- Check 2: Store Dependencies
- ISSUE-011: PouchDB Document Conflict Accumulation
