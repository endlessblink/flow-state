---
name: Test Application Features
description: TEST Vue.js application functionality with Playwright, validate bug fixes, and verify features work. Use when claiming functionality works, validating changes, or ensuring no regressions. MANDATORY testing before deployment.
---

# Comprehensive Testing

## Instructions

### Mandatory Testing Protocol
ALWAYS follow this sequence before claiming any feature works:

1. **Environment Setup**
   - Navigate to http://localhost:5546
   - Wait for app container to load
   - Verify stores are loaded
   - Check for initial console errors

2. **Real Data Verification**
   - Confirm tasks are loaded (not demo content)
   - Verify tasks have real properties (ids, titles, dates)
   - Check no placeholder/demo data exists

3. **Playwright MCP Testing**
   - Test functionality in browser
   - Verify visual feedback works correctly
   - Monitor for console errors
   - Confirm state synchronization across views

4. **Cross-View Validation**
   - Test sidebar ↔ calendar ↔ kanban sync
   - Verify state changes reflect everywhere
   - Test data persistence after refresh

### Zero Tolerance Rules
- **NO console errors** allowed (zero tolerance)
- **NO demo content** - must use real data
- **NO assumptions** - must verify visually
- **NO shortcuts** - complete testing required

### Critical Validation Checklist
- [ ] Real tasks loaded (not demo content)
- [ ] Zero console errors
- [ ] Visual confirmation in Playwright MCP
- [ ] State synchronized across all views
- [ ] Data persists after page refresh
- [ ] All interactions work as expected

### Test Examples
```javascript
// Test task creation
await page.click('[data-testid="quick-add-task"]')
await page.fill('[data-testid="task-title-input"]', 'Test Task')
await page.click('[data-testid="save-task"]')
await expect(page.locator('[data-testid="sidebar-task"]:has-text("Test Task")')).toBeVisible()

// Test calendar drag-drop
const sidebarTask = page.locator('[data-testid="sidebar-task"]').first()
const timeSlot = page.locator('[data-testid="time-slot"]').first()
await sidebarTask.dragTo(timeSlot)
await expect(page.locator('[data-testid="calendar-event"]')).toBeVisible()
```

This skill ensures comprehensive validation that features actually work with real data, no errors, and proper visual feedback.