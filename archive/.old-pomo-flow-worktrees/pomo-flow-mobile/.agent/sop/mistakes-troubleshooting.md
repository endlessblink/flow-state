# Common Mistakes & Troubleshooting Guide

## Critical Development Rules

### 🚨 ALWAYS TEST WITH PLAYWRIGHT
**Rule:** Never claim functionality works without Playwright MCP visual confirmation.

**Common Mistakes:**
- Assuming code works because it compiles
- Trusting console logs over visual testing
- Claiming "it should work" without browser verification

**Correct Process:**
1. Write code
2. Test with Playwright MCP
3. Verify visual functionality
4. Only then claim it works

**Example Failures:**
- CSS not loading but HTML renders (❌ "Dashboard loads")
- JavaScript errors preventing interactions (❌ "Feature is implemented")
- Responsive design breaking on mobile (❌ "Works on all devices")

## Recent Session Mistakes & Solutions

### 1. Canvas Scrolling Issues (RESOLVED)
**Problem:** Canvas had unwanted browser scrollbars instead of internal VueFlow panning.

**Mistake:** 
- Used CSS `overflow: hidden` incorrectly
- Didn't target VueFlow pane specifically

**Solution:**
```css
.vue-flow__pane { 
  scrollbar-width: none !important; 
}
```

**Prevention:** Always test canvas interactions in browser, don't assume CSS works.

### 2. Section Deletion Not Working (RESOLVED)
**Problem:** Delete key didn't remove sections from canvas.

**Mistake:**
- Used store selection tracking instead of VueFlow's `getSelectedNodes`
- Missing `syncNodes()` call after deletion

**Solution:**
```typescript
const selectedNodes = getSelectedNodes.value // Use VueFlow's selection
selectedNodes.forEach(node => {
  if (node.id.startsWith('section-')) {
    canvasStore.deleteSection(sectionId)
  }
})
syncNodes() // CRITICAL: Refresh VueFlow display
```

**Prevention:** Use VueFlow's built-in selection methods, not store tracking.

### 3. Storybook Integration Problems (RESOLVED)
**Problem:** Storybook added complexity and React dependencies.

**Mistake:**
- Assumed Storybook was the best solution for component documentation
- Didn't consider specific user needs (click-to-copy)

**Solution:** Built custom Vue design system app with:
- Click-to-copy functionality
- Same tech stack as main app
- Hot reload and theme switching

**Prevention:** Choose tools based on actual requirements, not popularity.

## Data Flow Mistakes

### 1. Task Instance Migration Issues
**Problem:** Legacy tasks with `scheduledDate` weren't showing in calendar.

**Mistake:**
- Only checked new `instances` array
- Didn't provide backward compatibility

**Solution:**
```typescript
export const getTaskInstances = (task: Task): TaskInstance[] => {
  // New format
  if (task.instances && task.instances.length > 0) {
    return task.instances
  }
  
  // Legacy compatibility
  if (task.scheduledDate && task.scheduledTime) {
    return [{
      id: `legacy-${task.id}`,
      scheduledDate: task.scheduledDate,
      scheduledTime: task.scheduledTime,
      duration: task.estimatedDuration
    }]
  }
  
  return []
}
```

**Prevention:** Always maintain backward compatibility during data migrations.

### 2. Database Persistence Race Conditions
**Problem:** Data loss during rapid task updates.

**Mistake:**
- No debouncing on database saves
- Multiple simultaneous writes

**Solution:**
```typescript
let tasksSaveTimer: ReturnType<typeof setTimeout> | null = null

watch(tasks, (newTasks) => {
  if (tasksSaveTimer) clearTimeout(tasksSaveTimer)
  tasksSaveTimer = setTimeout(() => {
    db.save(DB_KEYS.TASKS, newTasks)
  }, 1000) // Debounce 1 second
}, { deep: true, flush: 'post' })
```

**Prevention:** Always debounce database writes with proper timing.

## UI/UX Mistakes

### 1. Design System vs User Needs
**Problem:** Built generic components instead of user-specific workflow tools.

**Mistake:**
- Followed common patterns instead of user requirements
- Compromised on UX for implementation speed

**Solution:** 
- Focus on personal productivity workflow
- Build exact features needed, not generic ones
- Perfect UX over faster implementation

**Prevention:** Always prioritize user's specific needs over general best practices.

### 2. Theme Inconsistencies
**Problem:** Dark mode had inconsistent colors and glass effects.

**Mistake:**
- Hardcoded color values instead of design tokens
- Inconsistent CSS variable usage

**Solution:**
```css
/* Use design tokens consistently */
background: var(--glass-bg);
border: 1px solid var(--glass-border);
color: var(--text-primary);
```

**Prevention:** Always use design tokens, never hardcode colors.

## Performance Mistakes

### 1. Excessive Re-renders
**Problem:** Canvas lagging with many tasks.

**Mistake:**
- Computed properties running on every change
- No memoization for expensive calculations

**Solution:**
```typescript
// Memoize expensive calculations
const tasksByStatus = computed(() => {
  return tasks.value.reduce((groups, task) => {
    groups[task.status] = (groups[task.status] || []).concat(task)
    return groups
  }, {} as Record<string, Task[]>)
})
```

**Prevention:** Use computed properties and memoization for expensive operations.

### 2. Bundle Size Bloat
**Problem:** Large bundle size due to unused dependencies.

**Mistake:**
- Added libraries without tree-shaking verification
- Didn't optimize imports

**Solution:**
```typescript
// Import specific components, not entire libraries
import { Button } from 'headlessui/vue' // ✅
// import * as HeadlessUI from 'headlessui/vue' // ❌
```

**Prevention:** Always verify tree-shaking and use specific imports.

## Testing Mistakes

### 1. Assuming Playwright Limitations
**Problem:** Not testing features because "Playwright can't test it."

**Mistake:**
- Avoided manual testing for complex interactions
- Claimed features worked without verification

**Reality:**
- Playwright can test most interactions
- Manual testing supplements, doesn't replace
- Some features need both automated and manual testing

**Solution:**
1. Use Playwright for core functionality
2. Document manual testing requirements
3. Never claim untested features work

### 2. Incomplete Test Coverage
**Problem:** Tests passed but features broken in real use.

**Mistake:**
- Only tested happy path
- Didn't test edge cases and error states

**Solution:**
```typescript
// Test both success and failure cases
describe('Task Creation', () => {
  it('should create task successfully', () => { /* ... */ })
  it('should handle empty title gracefully', () => { /* ... */ })
  it('should validate required fields', () => { /* ... */ })
})
```

**Prevention:** Always test edge cases and error handling.

## Common Debugging Patterns

### 1. CSS Issues
**Problem:** Styles not applying as expected.

**Debugging Steps:**
1. Check CSS variables in browser dev tools
2. Verify CSS specificity
3. Test in both light and dark themes
4. Check responsive breakpoints

**Common Fixes:**
```css
/* Increase specificity */
.component .element { /* ... */ }

/* Use !important sparingly */
.glass-effect {
  background: var(--glass-bg) !important;
}
```

### 4. Task Sidebar Rounded Edges and Gradient Removal (RESOLVED - Oct 10, 2025)
**Problem:** Task sidebar had sharp edges and unwanted blue gradient background.

**Initial Mistakes:**
1. Applied border-radius to wrong elements (`.sidebar-task` individual cards, `.task-list` container)
2. Didn't inspect which element actually had the visible background
3. Set background: transparent which allowed App's gradient overlay to show through
4. Confused CSS computed values (showing 24px) with visual appearance

**Debugging Process:**
1. Used Playwright `browser_evaluate` to inspect `.task-sidebar` computed styles
2. Found element had TWO data-v attributes (`data-v-098e335d`, `data-v-075d41ba`)
3. Checked parent elements (`.calendar-layout`, `.view-wrapper`)
4. Inspected pseudo-elements (::before, ::after)
5. Searched for ALL gradients in CalendarView.vue
6. Discovered App.vue has `.app::before` with animated radial gradient overlay
7. Realized transparent background was showing App's background through

**Root Cause:**
- `.task-sidebar` is the 300px wide container with the blue gradient (not child elements)
- Initial fix used `background: transparent` which exposed App's gradient overlay
- The visual "blue gradient" was actually App's background showing through transparency

**Final Solution:**
```css
.task-sidebar {
  width: 300px;
  background: var(--surface-primary); /* Solid background - blocks App gradient */
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  border: 1px solid var(--glass-border); /* Stroke border for subtle outline */
  border-radius: 24px; /* Rounded corners on container itself */
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden; /* Clips child content to rounded borders */
  box-shadow: var(--shadow-xs);
}

/* Task cards: moderate rounding (not excessive) */
.sidebar-task {
  border-radius: 16px; /* Not 32px+ which was too round */
  overflow: hidden;
}
```

**Key Learnings:**
1. **Use Playwright to inspect EXACTLY which element has the visual style**
   - Don't assume based on class names
   - Check computed styles AND visual screenshot
2. **Transparent backgrounds reveal parent/app backgrounds**
   - If removing gradient, use solid color instead of transparent
   - Understand the background layer stack
3. **Multiple data-v attributes = scoped styles from multiple components**
   - Task sidebar has styles from both TaskManagerSidebar AND CalendarView
4. **"Background showing through" vs "element has background"**
   - Distinguish between element's own background and inherited/shown-through backgrounds
5. **Moderation in design**
   - 16px radius sufficient for cards (32px was excessive)
   - 24px for larger containers works well

**Correct Debugging Workflow:**
1. Take Playwright screenshot to see the problem visually
2. Use `browser_evaluate` to inspect element computed styles
3. Check parent elements and app-level backgrounds
4. Search codebase for gradient sources if not obvious
5. Test transparent vs solid background approaches
6. Verify fix with new Playwright screenshot
7. Confirm with user viewing same browser

**Prevention:**
- Always test CSS changes with Playwright screenshots BEFORE and AFTER
- Use browser inspection to find exact target element
- Understand background layering (app background → component background → element background)
- Don't assume CSS variable names match visual elements

**Standardized Sidebar Design Pattern:**
After identifying the issue, created a standardized design pattern for all sidebar panels based on target design (`docs/debug/image.png`):

**Affected Components:**
1. `src/components/TaskManagerSidebar.vue` (Calendar view)
2. `src/components/canvas/InboxPanel.vue` (Canvas view)

**Standardized Styling:**
```css
/* Both .task-sidebar and .inbox-panel now use: */
{
  background: var(--surface-secondary); /* Clean solid background */
  border: 1px solid var(--border-subtle); /* Subtle stroke border */
  border-radius: 16px; /* Moderate rounded corners (not excessive) */
  box-shadow: var(--shadow-sm); /* Minimal shadow */
}
```

**Removed:**
- All gradient backgrounds (linear-gradient)
- Excessive backdrop-filter effects
- Overly rounded corners (24px+ was too much)
- Glass effects that didn't match design

**Result:** Both sidebars now have consistent, minimalist styling:
- ✅ Clean flat design matching target
- ✅ Solid backgrounds (no gradients)
- ✅ 16px rounded corners (moderate, not pill-shaped)
- ✅ Subtle stroke borders
- ✅ Unified design language across Calendar and Canvas views

### 2. Vue Reactivity Issues
**Problem:** UI not updating after data changes.

**Debugging Steps:**
1. Check if data is reactive (ref/reactive)
2. Verify computed properties are working
3. Check for direct array mutations
4. Use Vue DevTools

**Common Fixes:**
```typescript
// ❌ Direct mutation
tasks.value[0].title = 'new title'

// ✅ Reactive update
updateTask(tasks.value[0].id, { title: 'new title' })
```

### 3. Database Issues
**Problem:** Data not persisting or loading.

**Debugging Steps:**
1. Check IndexedDB in browser dev tools
2. Verify LocalForage configuration
3. Check for JSON serialization errors
4. Test with different browsers

**Common Fixes:**
```typescript
// Add error handling
try {
  await db.save(DB_KEYS.TASKS, tasks)
} catch (error) {
  console.error('Database save failed:', error)
  // Implement fallback or user notification
}
```

## Preventive Development Practices

### 1. Code Review Checklist
Before committing, verify:
- [ ] Playwright tests pass
- [ ] No console errors
- [ ] Both themes work correctly
- [ ] Responsive design tested
- [ ] Database operations have error handling
- [ ] TypeScript types are correct
- [ ] No unused imports/variables

### 2. Feature Development Workflow
1. **Understand Requirements**: Read user documentation
2. **Plan Implementation**: Consider edge cases
3. **Write Code**: Follow established patterns
4. **Test Immediately**: Use Playwright MCP
5. **Debug Issues**: Check console and browser tools
6. **Verify in Browser**: Visual confirmation required
7. **Update Documentation**: Keep docs current

### 3. Common Pitfalls to Avoid

**Never:**
- Claim functionality without testing
- Hardcode values (use design tokens)
- Skip error handling in database operations
- Ignore TypeScript warnings
- Break backward compatibility without migration
- Use CSS !important unless absolutely necessary

**Always:**
- Test with Playwright before claiming success
- Use computed properties for derived state
- Implement proper error boundaries
- Follow existing code patterns
- Update documentation with changes
- Consider mobile/responsive implications

## Emergency Procedures

### When Things Go Wrong
1. **Stop and Assess**: Don't make rapid changes
2. **Check Console**: Look for JavaScript errors
3. **Verify Data**: Check IndexedDB contents
4. **Test Isolation**: Create minimal reproduction
5. **Roll Back if Needed**: Use git to revert
6. **Document the Issue**: Add to troubleshooting guide

### Data Recovery
```typescript
// Export data before major changes
const backup = await db.exportAll()
localStorage.setItem('emergency-backup', JSON.stringify(backup))

// Restore if needed
const backupData = JSON.parse(localStorage.getItem('emergency-backup'))
await db.importAll(backupData)
```

---

## Quick Reference

### Most Common Issues
1. **CSS not loading** → Check design tokens, verify theme class
2. **Data not persisting** → Check IndexedDB, verify error handling
3. **Reactivity not working** → Use ref/reactive properly
4. **Playwright tests failing** → Check selectors, verify element visibility
5. **Bundle size too large** → Optimize imports, check tree-shaking

### Debug Commands
```bash
# Check for TypeScript errors
npm run lint

# Run tests
npm run test

# Build and analyze
npm run build

# Check dependencies
npm ls
```

### Essential Browser Tools
- **Vue DevTools** for component inspection
- **Console** for JavaScript errors
- **Network** for API/database issues
- **Application/Storage** for IndexedDB
- **Elements** for CSS debugging

---

*Last Updated: October 9, 2025*
*Based on real development session experiences*
*Updated as new issues are discovered and resolved*