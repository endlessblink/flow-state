# Pomo-Flow Architecture Mapping - Version 4.11.25
**Generated**: November 23, 2025
**Purpose**: Comprehensive technical documentation of Pomo-Flow architecture, including recent enhancements in RTL/Hebrew support, task linking, calendar-aware filtering, and smart views

## **Overview**

This directory contains comprehensive technical documentation for the Pomo-Flow Vue 3 productivity application, version 4.11.25. This release includes significant architectural enhancements focused on internationalization, task management improvements, and advanced filtering capabilities.

**Major Features Added in v4.11.25**:
- ✅ **RTL/Hebrew Language Support**: Complete right-to-left language implementation
- ✅ **Enhanced Task Linking**: Improved connection visualization and drag-and-drop separation
- ✅ **Calendar-Aware Filtering**: Advanced task filtering with calendar instance detection
- ✅ **Smart View Improvements**: Enhanced uncategorized task filtering and counter consistency
- ✅ **Error Handling Improvements**: Vue lifecycle management and component error boundaries
- ✅ **Input Field Fixes**: Character input handling for international keyboards

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

### **Core Architecture Documentation**
**1. [ARCHITECTURE_REFERENCE.md](./ARCHITECTURE_REFERENCE.md)**
Complete system architecture with latest v4.11.25 enhancements.
- Technology stack overview (Vue 3.4.0, TypeScript 5.9.3, Vite 7.1.10)
- State management ecosystem (11 Pinia stores)
- Enhanced smart views and filtering systems
- RTL/Hebrew support architecture
- Performance and optimization patterns

**2. [FOLDER_STRUCTURE_MAPPING.md](./FOLDER_STRUCTURE_MAPPING.md)**
Comprehensive file and directory structure mapping.
- Complete component organization with RTL support
- Internationalization structure (i18n with Hebrew locale)
- Settings and configuration components
- Enhanced error handling patterns
- Vue lifecycle management improvements

### **Component and Interaction Documentation**
**3. [COMPONENT_REFERENCE.md](./COMPONENT_REFERENCE.md)**
Detailed component documentation with latest enhancements.
- Enhanced BaseInput with RTL/Hebrew support
- TaskNode improvements for task linking and connections
- Error handling improvements and Vue lifecycle fixes
- Defensive programming patterns and component safety

**4. [INTERACTION_FLOWS.md](./INTERACTION_FLOWS.md)**
Complete user interaction flows and system behaviors.
- Calendar-aware task filtering workflows
- Smart view filtering and counter consistency
- Enhanced error recovery workflows
- RTL language interaction patterns
- Drag-and-drop system analysis and fixes

### **Specialized Systems Documentation**
**5. [CANVAS_SYSTEM_ARCHITECTURE.md](./CANVAS_SYSTEM_ARCHITECTURE.md)**
Canvas and Vue Flow integration architecture.
- Task connection and dependency management
- Section management and collapsible containers
- Multi-selection and batch operations
- Canvas-specific undo/redo system

**6. [UNDO_REDO_SYSTEM.md](./UNDO_REDO_SYSTEM.md)**
Unified undo/redo system architecture.
- VueUse integration with 50-entry capacity
- Task operations with deep cloning
- JSON-based state serialization
- Cross-system consistency patterns

### **Additional Reference Materials**
**7. [COMPOSABLES_CATALOG.md](./COMPOSABLES_CATALOG.md)**
Complete composable library documentation.
- 25+ reusable composables
- RTL/Hebrew alignment utilities
- Error handling and lifecycle management
- Performance optimization patterns

**8. [PERFORMANCE_AND_ISSUES.md](./PERFORMANCE_AND_ISSUES.md)**
Performance analysis and optimization strategies.
- Drag-and-drop system issues and resolutions
- Cross-platform compatibility considerations
- Memory management and leak prevention
- Optimization recommendations

## **Version 4.11.25 Release Highlights**

### ✅ Completed Enhancements

| Feature | Component | Impact | Status |
|---------|-----------|---------|---------|
| RTL/Hebrew Support | `i18n/he.json`, `LanguageSettings.vue` | 🌍 International | ✅ **Complete** |
| Task Linking Enhancement | `TaskNode.vue`, Vue Flow connections | 🔗 Connectivity | ✅ **Complete** |
| Calendar-Aware Filtering | `CalendarInboxPanel.vue` | 📅 Scheduling | ✅ **Complete** |
| Smart View Filtering | `useUncategorizedTasks.ts` | 🎯 Organization | ✅ **Complete** |
| Error Handling Improvements | `BaseInput.vue`, lifecycle fixes | 🛡️ Reliability | ✅ **Complete** |
| Character Input Fixes | Input field handling | ⌨️ UX | ✅ **Complete** |

### 🔧 Technical Debt Resolved

| Area | Issue | Resolution |
|------|-------|------------|
| Internationalization | Missing RTL support | Complete Hebrew language pack added |
| Task Connections | Poor drag/connection separation | HTML5 drag separated from Vue Flow connections |
| Filter Consistency | Counter/display mismatches | Real-time synchronization implemented |
| Error Boundaries | Missing component error handling | Vue lifecycle patterns implemented |
| Input Handling | Character input issues | International keyboard support added |

## **Development Guidelines**

### **For Working with v4.11.25**
1. **RTL/Hebrew Support**: Use `getHebrewTextClasses()` composable for proper text alignment
2. **Task Connections**: Leverage separated HTML5 drag and Vue Flow connection systems
3. **Calendar Filtering**: Implement instance-aware filtering with `CalendarInboxPanel` patterns
4. **Smart Views**: Use `useUncategorizedTasks` composable for consistent filtering logic
5. **Error Boundaries**: Implement Vue lifecycle patterns and defensive programming

### **For Future Development**
1. **Internationalization**: Follow established i18n patterns for additional languages
2. **Component Safety**: Use error boundaries and defensive programming patterns
3. **State Consistency**: Maintain counter/display synchronization across all views
4. **Performance**: Leverage established debouncing and virtual scrolling patterns
5. **Testing**: Test both RTL and LTR language modes for comprehensive coverage

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