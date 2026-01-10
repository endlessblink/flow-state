# Example: Modal Iframe Height Fix

## Problem
The Docs page for `ConfirmationModal` was cutting off the bottom of the modal. Users couldn't see the action buttons at the bottom.

## Detection
The story file has either:
1. No explicit `iframeHeight` parameter (defaults to 400px)
2. `iframeHeight` value too low for the component

Run: `grep "iframeHeight" src/stories/modals/ConfirmationModal.stories.ts`

## Before Code
```typescript
const meta = {
  component: ConfirmationModal,
  title: '🎭 Overlays/🪟 Modals/ConfirmationModal',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      story: {
        // Missing iframeHeight - defaults to 400px, modal is clipped!
      },
    },
  },
} satisfies Meta<typeof ConfirmationModal>
```

## After Code
```typescript
const meta = {
  component: ConfirmationModal,
  title: '🎭 Overlays/🪟 Modals/ConfirmationModal',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      story: {
        inline: false,
        iframeHeight: 500,  // Adequate height for confirmation modal
      },
    },
  },
} satisfies Meta<typeof ConfirmationModal>
```

## Solution
Added `iframeHeight: 500` to the `docs.story` parameters. This gives enough space to display the full modal including action buttons.

## Verification
1. Open Storybook: `npm run storybook`
2. Navigate to ConfirmationModal
3. Click "Docs" tab
4. Confirm modal is fully visible without scrolling
5. Check that all action buttons are visible

## Component Type Guidelines
| Component Type | Minimum Height |
|----------------|----------------|
| Simple components | 400px |
| Context menus | 600px |
| Dropdowns | 500px |
| Modals (small) | 700px |
| Modals (large) | 900px |
| Components with submenus | 900px+ |

## Related
- Check 1: Iframe Height
