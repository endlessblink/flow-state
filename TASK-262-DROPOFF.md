# TASK-262: Canvas Selection Deselect on Empty Space Click - DROPOFF

## Current Status: IN PROGRESS - Testing Phase

### Problem Statement
- Clicking a task deselects any selected groups
- Clicking a group deselects any selected tasks
- User wants: clicking nodes should ADD to selection, only empty space click should deselect all

### What Was Implemented

#### 1. Canvas Store (`src/stores/canvas.ts`)
- Added `allowBulkDeselect` flag (line ~140) - controls when bulk deselection is allowed
- Exported in return statement (line ~1209)

#### 2. CanvasView.vue (`src/views/CanvasView.vue`)
- Added `@node-click="handleNodeClick"` event handler (line ~112)
- **`handleNodeClick`** (lines ~321-369):
  - Manages selection on node clicks
  - ADDS clicked node to selection instead of replacing
  - Updates both store AND Vue Flow's nodes directly
  - Ctrl/Cmd+click toggles individual nodes
- **`handleSelectionChange`** (lines ~371-387):
  - Only processes when `allowBulkDeselect` is true (pane click)
  - Otherwise ignores Vue Flow's selection events

#### 3. useCanvasEvents.ts (`src/composables/canvas/useCanvasEvents.ts`)
- `handlePaneClick` sets `canvasStore.allowBulkDeselect = true` before clearing (line ~90)

#### 4. useCanvasOrchestrator.ts (`src/composables/canvas/useCanvasOrchestrator.ts`)
- `handleNodesChange` filters selection changes (lines ~473-522)
- Has debug logging with colored console output

### Debug Logging Added
Console logs with colored backgrounds:
- **Green**: `[TASK-262] NODE CLICK` - when a node is clicked
- **Teal**: `[TASK-262] Selection updated` - after selection changes
- **Purple**: `[TASK-262] @selection-change` - when Vue Flow fires selection event
- **Orange**: `[TASK-262] @selection-change (bulk deselect)` - pane click deselection
- **Navy/Yellow**: `[TASK-262] handleNodesChange CALLED` - all node changes

### Key Architecture Insight
Vue Flow's default behavior: clicking a node selects ONLY that node (deselects all others).
The fix intercepts `@node-click` and manages selection manually, ignoring Vue Flow's
`@selection-change` event except during explicit pane clicks.

### What Needs Testing
1. Click a task → should select it (green log)
2. Click a group → task should STAY selected, group also selected (green log, teal log)
3. Click empty canvas space → ALL should deselect (orange log)
4. Ctrl+click → should toggle individual nodes

### Files Modified
- `src/stores/canvas.ts` - added `allowBulkDeselect` flag
- `src/views/CanvasView.vue` - added `handleNodeClick`, modified `handleSelectionChange`
- `src/composables/canvas/useCanvasEvents.ts` - set flag in `handlePaneClick`
- `src/composables/canvas/useCanvasOrchestrator.ts` - added debug logging

### Dev Server
Run on port 5546:
```bash
npx vite --host 0.0.0.0 --port 5546
```

### Playwright MCP
Fixed config - use `@playwright/mcp@latest`:
```bash
claude mcp add --scope user playwright -- npx @playwright/mcp@latest
```

### Next Steps
1. Restart Claude Code to load Playwright MCP
2. Use Playwright MCP tools to open browser and test selection
3. Verify all 4 test cases work
4. Remove debug logging once confirmed working
5. Update MASTER_PLAN.md to mark TASK-262 as done

### Potential Issues to Check
- Vue Flow might still override selection via internal state
- The `nodes.value.forEach` update might not trigger reactivity correctly
- May need to use `setNodes()` instead of direct mutation
