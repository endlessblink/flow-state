# Drag-and-Drop System Mapping - Pomo-Flow
**Generated**: November 2, 2025
**Purpose**: Complete technical documentation of the drag-and-drop system failure and resolution path

## **Overview**

This directory contains a comprehensive technical analysis of the drag-and-drop system failure in the Pomo-Flow Vue 3 productivity application. The analysis reveals that recent horizontal scroll isolation changes have inadvertently broken the core drag-and-drop functionality.

## **Quick Summary**

### **Root Cause**
The `useHorizontalDragScroll.ts` composable calls `preventDefault()` and `stopPropagation()` on mousedown events **before** checking if the target element is draggable, completely blocking HTML5 drag-and-drop operations.

### **Impact**
- Tasks cannot be visually dragged between Kanban columns
- No drag preview appears when attempting to drag
- Drop zones never activate
- Mobile touch dragging also broken
- Cross-view inconsistency (Canvas dragging works, Board/Calendar don't)

### **Fix Complexity**
**Low** - The drag system architecture is sound; only event timing and CSS constraints need adjustment.

## **Document Structure**

### **1. [drag-system-architecture.md](./drag-system-architecture.md)**
High-level system architecture and component interaction map.
- File architecture overview
- Component interaction flows
- Key technical components breakdown
- Data flow architecture
- Integration points

### **2. [component-breakdown.md](./component-breakdown.md)**
Detailed analysis of each drag-related component.
- TaskCard.vue implementation details
- useDragAndDrop.ts composable analysis
- KanbanSwimlane.vue drop zone configuration
- useHorizontalDragScroll.ts problem analysis
- Canvas drag system (working alternative)

### **3. [event-system-analysis.md](./event-system-analysis.md)**
Complete event handling chain analysis.
- Native browser event sequence
- Event handler registration and priority
- Event propagation and cancellation analysis
- Mouse vs touch event handling
- CSS event interactions

### **4. [identified-issues.md](./identified-issues.md)**
Comprehensive catalog of all issues with specific locations.
- 15 categorized issues from critical to cosmetic
- Exact file locations and line numbers
- Impact assessment and fix priority
- Cross-platform compatibility issues
- Testing strategy

### **5. [flow-diagrams.md](./flow-diagrams.md)**
Visual flow diagrams showing current vs intended flow.
- ASCII art diagrams of event flows
- Component interaction diagrams
- CSS impact visualization
- Mobile touch event flows
- Fix implementation process

## **Critical Issues Summary**

| Priority | Issue | File | Lines | Impact |
|----------|-------|------|-------|--------|
| 1 | Event Handler Priority Conflict | useHorizontalDragScroll.ts | 202-226 | 🔴 Critical |
| 2 | Global CSS Overflow Restrictions | design-tokens.css | 736-754 | 🔴 Critical |
| 3 | App-Level Overflow Constraints | App.vue | 1150, 1753 | 🟠 High |
| 4 | Body Style Manipulation | useHorizontalDragScroll.ts | 165-166 | 🟠 High |

## **Quick Fix Path**

### **Phase 1: Unblock Core Functionality**
1. **Fix event timing** in `useHorizontalDragScroll.ts`
2. **Remove global overflow** in `design-tokens.css`
3. **Fix app-level constraints** in `App.vue`
4. **Remove body manipulation** in `useHorizontalDragScroll.ts`

### **Phase 2: Polish and Enhancement**
5. Fix touch event handling for mobile
6. Add visual feedback states
7. Clean up debug messages
8. Architectural improvements

## **Key Findings**

### **What's Working Well**
- ✅ **Component Architecture**: Well-designed drag components
- ✅ **Type Safety**: Full TypeScript support
- ✅ **State Management**: Proper global state coordination
- ✅ **Canvas Drag**: Vue Flow dragging works independently
- ✅ **Accessibility**: Comprehensive ARIA support

### **What's Broken**
- ❌ **Event Timing**: preventDefault() called before drag detection
- ❌ **CSS Constraints**: Global overflow restrictions prevent drag rendering
- ❌ **Visual Feedback**: No drag preview or hover states
- ❌ **Cross-View Inconsistency**: Board/Calendar broken, Canvas working

### **Root Cause Analysis**
The horizontal scroll isolation feature (commit `896b701`) implemented overly aggressive event handling that blocks the natural HTML5 drag-and-drop event flow. The detection logic is actually correct, but it runs after the damage is already done.

## **Development Guidelines**

### **For Immediate Fixes**
1. **Always check for draggable elements before calling preventDefault()**
2. **Use targeted CSS constraints instead of global restrictions**
3. **Test drag functionality on both desktop and mobile**
4. **Verify no regressions in horizontal scroll behavior**

### **For Future Development**
1. **Use CSS classes instead of direct style manipulation**
2. **Implement proper event cleanup to prevent memory leaks**
3. **Consider event delegation patterns for better performance**
4. **Test cross-view consistency when implementing drag features**

## **Testing Strategy**

### **Critical Path Testing**
- [ ] Drag tasks between all Kanban columns
- [ ] Verify drag preview appears and follows cursor
- [ ] Test drop zone highlighting
- [ ] Validate mobile touch dragging
- [ ] Ensure horizontal scroll still works in Kanban

### **Regression Testing**
- [ ] No memory leaks over extended use
- [ ] Cross-browser compatibility (Chrome, Firefox, Safari)
- [ ] Performance with large task lists
- [ ] Undo/redo functionality preserved

## **Next Steps**

1. **Review Documentation**: Read through all 5 mapping documents
2. **Implement Phase 1 Fixes**: Address the 4 critical issues
3. **Test Thoroughly**: Verify drag functionality works end-to-end
4. **Implement Phase 2**: Address medium and low priority issues
5. **Update Documentation**: Reflect final implementation state

## **Contact and Support**

This mapping documentation provides a complete technical foundation for understanding and fixing the drag-and-drop system. The issues are well-defined with specific locations and clear fix paths.

**Remember**: The drag system architecture is fundamentally sound - it just needs the event handling conflicts resolved to restore full functionality.