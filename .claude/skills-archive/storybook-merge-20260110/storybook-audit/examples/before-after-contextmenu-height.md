# Example: ContextMenu Height Fix

## Problem
`TaskContextMenu` in the Docs page was cutting off cascading submenus. Users couldn't access submenu items.

## Detection
The story has insufficient `iframeHeight` for a component with expandable/cascading content.

## Before Code
```typescript
const meta = {
  component: TaskContextMenu,
  title: '🎭 Overlays/📋 Context Menus/TaskContextMenu',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      story: {
        iframeHeight: 400,  // Too small - submenus are cut off!
      },
    },
  },
} satisfies Meta<typeof TaskContextMenu>
```

## After Code
```typescript
const meta = {
  component: TaskContextMenu,
  title: '🎭 Overlays/📋 Context Menus/TaskContextMenu',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      story: {
        inline: false,
        iframeHeight: 900,  // Increased for cascading submenus
      },
    },
  },
} satisfies Meta<typeof TaskContextMenu>
```

## Solution
Increased `iframeHeight` from 400px to 900px to accommodate cascading submenus. Components with expandable or cascading content need more height.

## Verification
1. Open Storybook and navigate to TaskContextMenu
2. Click "Docs" tab
3. Right-click on the context menu to open cascading submenus
4. Confirm all submenu items are visible without scrolling

## Key Insight
When sizing iframes, consider the **maximum expanded state** of the component, not just the default state.

## Related
- Check 1: Iframe Height
