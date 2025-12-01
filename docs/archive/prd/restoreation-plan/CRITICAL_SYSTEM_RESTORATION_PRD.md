# Pomo-Flow Critical System Restoration PRD
**Product Requirements Document**

## 📋 Document Information
- **Document ID**: PRD-RESTORE-001
- **Version**: 1.0
- **Created**: November 5, 2025
- **Status**: CRITICAL - IMMEDIATE ACTION REQUIRED
- **Owner**: Development Team
- **Reviewer**: Product Owner

---

## 🚨 EXECUTIVE SUMMARY

### **CRITICAL SYSTEM FAILURE DECLARATION**
The Pomo-Flow application is experiencing **MULTIPLE CRITICAL SYSTEM FAILURES** affecting core functionality. This PRD outlines the immediate restoration plan required to return the application to full operational status.

### **Business Impact**
- **User Experience**: SEVERELY DEGRADED - Core features non-functional
- **Productivity**: BLOCKED - Primary use cases broken
- **Revenue Impact**: HIGH - User retention at risk
- **Technical Debt**: CRITICAL - Architecture integrity compromised

### **Restoration Urgency**
**CODE RED** - Immediate restoration required within 48-72 hours to prevent significant user impact and maintain application viability.

---

## 🔍 CURRENT SYSTEM STATE ASSESSMENT

### **CRITICAL SYSTEM FAILURES IDENTIFIED**

#### **1. Drag & Drop System Completely Broken**
- **Root Cause**: `useHorizontalDragScroll.ts:237-238` calls `preventDefault()` before drag detection
- **Impact**: CORE FUNCTIONALITY UNUSABLE - Tasks cannot be dragged between Kanban columns
- **Affected Systems**: Board view, Calendar view, TaskCard components
- **User Impact**: Primary productivity features completely non-functional

#### **2. Authentication System Bypassed**
- **Location**: `router/index.ts:20,32`
- **Issue**: "Temporarily disabled for development" - security bypassed
- **Impact**: Unauthorized access to protected routes
- **Risk**: Security vulnerability in production

#### **3. Application Compilation Error**
- **Location**: `CanvasView.vue:1269:6`
- **Issue**: Duplicate `closeCanvasContextMenu` function declaration
- **Impact**: Vue compilation error, application crash
- **Severity**: BLOCKING - Prevents application from running

### **MAJOR MISSING FEATURES (v4.11.26 Architecture Not Implemented)**

#### **4. Kanban Board System Incomplete**
- **Missing Components**: 8 core components absent
  - `KanbanBoard.vue` (main container)
  - `SwimlaneHeader.vue`, `ColumnHeader.vue` (UI components)
  - `TaskList.vue`, `TaskCard.vue` (task display)
  - `BoardToolbar.vue`, `ViewControls.vue` (controls)
  - `QuickAddButton.vue` (task creation)
- **Impact**: Board view cannot function as designed

#### **5. Recurring Tasks System Missing**
- **Expected v4.11.26 Features**: Complete recurrence engine
- **Missing Components**:
  - `RecurrencePatternSelector.vue`
  - `RecurrencePreview.vue`
  - `RecurrenceEditModal.vue`
- **Missing Composable**: `useTaskRecurrence.ts`
- **Impact**: Advanced task scheduling unavailable

#### **6. Notification System Absent**
- **Expected v4.11.26 Features**: Task reminders beyond pomodoro
- **Missing Components**:
  - `NotificationCenter.vue`
  - `NotificationPreferences.vue`
  - `TaskReminderModal.vue`
- **Missing Store**: `notifications.ts`
- **Impact**: No task reminders or notification management

#### **7. Mobile System Incomplete**
- **Missing Components**:
  - `MobileBottomNav.vue`
  - `MobileHeader.vue`
- **Impact**: No mobile navigation or responsive headers

### **DESIGN REGRESSIONS & BROKEN UX**

#### **8. Timer/Clock System Damaged**
- **Debug Code**: 8 console.log statements in timer functions
- **Issues**:
  - Timer uses hardcoded emoticons instead of scalable icons
  - TimeDisplay component ignores i18n (hardcoded 'en-US')
  - Inconsistent CSS classes causing styling conflicts
  - Missing accessibility features (ARRIA labels)
- **Performance**: Inefficient tab display computation causing battery drain

#### **9. RTL/Internationalization Incomplete**
- **Found**: `he.json` locale file exists
- **Missing**: RTL text direction handling, language settings integration
- **Issue**: Components don't respect RTL text flow
- **Impact**: No proper internationalization support

#### **10. Theme System Issues**
- **Missing**: Settings modal for theme preferences
- **Problem**: Theme switching may not persist properly
- **Impact**: User preferences not saved

### **PERFORMANCE & TECHNICAL DEBT CRISIS**

#### **11. Massive Debug Code Presence**
- **Scale**: 885 console.log statements across 66 files
- **Major Sources**:
  - `tasks.ts`: 193 debug statements
  - `canvas.ts`: 26 debug statements
  - `timer.ts`: 13 debug statements
- **Impact**: Performance degradation, unprofessional codebase

#### **12. TODO/FIXME Items Everywhere**
- **Count**: 24 TODO/FIXME markers across 10 files
- **Critical Areas**:
  - Mobile Pomodoro pause/extend functionality
  - Canvas section selection dialog
  - Native date picker integration
- **Impact**: Incomplete features throughout application

#### **13. Store Architecture Problems**
- **Issue**: `tasks.ts` extremely large (84,230+ lines) - should be modularized
- **Missing**: `tasks-new.ts`, `taskScheduler.ts`, `taskCanvas.ts` (referenced in architecture)
- **Impact**: Maintainability and performance issues

#### **14. Component Structure Issues**
- **Problem**: Missing `index.ts` files for clean imports
- **Missing Base Components**: `BaseBadge.vue`, incomplete `BaseNavItem.vue`
- **Impact**: Inconsistent component organization and broken imports

### **MISSING FILES INVENTORY**

#### **Complete Missing Components List**:
```
src/components/base/BaseBadge.vue
src/components/base/BaseNavItem.vue (incomplete RTL)
src/components/recurrence/RecurrencePreview.vue
src/components/recurrence/RecurrenceEditModal.vue
src/components/notifications/NotificationCenter.vue
src/components/notifications/NotificationPreferences.vue
src/components/notifications/TaskReminderModal.vue
src/components/mobile/MobileBottomNav.vue
src/components/mobile/MobileHeader.vue
src/views/TodoView.vue (referenced in router TODO)
src/stores/tasks-new.ts
src/stores/taskScheduler.ts
src/stores/taskCanvas.ts
```

### **OVERALL SYSTEM HEALTH ASSESSMENT**

**Current State**: CRITICAL - Application has ambitious architecture but core functionality is severely impaired
**Risk Level**: CODE RED - Primary productivity features non-functional
**User Impact**: SEVERE - Core use cases broken across all major views
**Technical Debt**: CRITICAL - 885+ debug statements, 24 TODO items, missing architecture components

**Immediate Actions Required**:
1. Emergency restoration of drag & drop functionality
2. Fix compilation errors preventing app startup
3. Restore authentication security
4. Implement missing core components
5. Clean up massive debug code presence

---

## 🎯 RESTORATION REQUIREMENTS

### **Phase 1: Critical System Restoration (IMMEDIATE - 2 hours)**

#### **1.1 Drag & Drop System Emergency Fix**
**Priority**: CRITICAL
**Timeline**: 0-1 hours
**Root Cause**: `useHorizontalDragScroll.ts:237-238` calls preventDefault before drag detection

**Must-Have Fixes:**
- Rewrite event handling in `useHorizontalDragScroll.ts` to detect drag intent before preventDefault
- Allow HTML5 drag-and-drop events to propagate naturally
- Test drag functionality across Board, Calendar, and Canvas views
- Restore visual drag preview and drop zone activation

**Success Criteria:**
- ✅ Tasks can be dragged between Kanban columns
- ✅ Drag preview appears and follows cursor
- ✅ Drop zones activate and highlight properly
- ✅ No cross-view conflicts (Canvas continues working)

#### **1.2 Application Compilation Error Fix**
**Priority**: CRITICAL
**Timeline**: 0-0.5 hours
**Location**: `CanvasView.vue:1269:6`

**Must-Have Fixes:**
- Remove duplicate `closeCanvasContextMenu` function declaration
- Verify application compiles without errors
- Test Canvas view functionality

**Success Criteria:**
- ✅ Application compiles without Vue errors
- ✅ Canvas view loads and functions properly
- ✅ No console compilation errors

#### **1.3 Authentication System Restoration**
**Priority**: HIGH
**Timeline**: 1-2 hours
**Location**: `router/index.ts:20,32`

**Must-Have Fixes:**
- Re-enable authentication requirements in router
- Remove "temporarily disabled for development" flags
- Test authentication flow and route protection

**Success Criteria:**
- ✅ Protected routes require authentication
- ✅ Authentication flow works properly
- ✅ No unauthorized access to protected areas

#### **1.4 Critical Debug Code Cleanup**
**Priority**: HIGH
**Timeline**: 1-2 hours

**Must-Have Fixes:**
- Remove console.log statements from core stores (`tasks.ts`, `canvas.ts`, `timer.ts`)
- Clean debug code from timer functions (`useAppHeader.ts`)
- Remove debug logging from critical application flow

**Success Criteria:**
- ✅ Core stores have zero console.log statements
- ✅ Timer functions are clean
- ✅ No performance degradation from debug code

### **Phase 2: Component Integration (Day 1)**

#### **2.1 Component Dependency Resolution**
**Priority**: HIGH
**Timeline**: 2-8 hours

**Fixes Required:**
- Resolve missing component imports
- Fix modal dialog systems
- Restore context menu functionality
- Implement missing event handlers throughout app
- Fix component prop passing and state synchronization

#### **2.2 Advanced Feature Restoration**
**Priority**: HIGH
**Timeline**: 8-16 hours

**Features to Restore:**
- Fix week/month calendar views
- Implement advanced canvas features (multi-select, lasso)
- Restore task dependency management on canvas
- Fix keyboard shortcuts and hotkeys
- Restore advanced modal interactions

### **Phase 3: Design System Restoration (Day 1-2)**

#### **3.1 Visual Design System Recovery**
**Priority**: MEDIUM
**Timeline**: 16-24 hours

**Design Elements to Fix:**
- Restore glass morphism effects
- Fix color consistency and design tokens
- Implement proper responsive layouts
- Fix typography and spacing throughout app
- Ensure dark/light theme switching works

#### **3.2 Performance & Optimization**
**Priority**: MEDIUM
**Timeline**: 24-32 hours

**Optimizations:**
- Remove all debug console.log statements
- Fix memory leaks and performance issues
- Optimize component rendering
- Clean up development artifacts
- Implement proper error boundaries

### **Phase 4: Complete System Testing (Day 2)**

#### **4.1 Manual Testing Protocol**
**Priority**: HIGH
**Timeline**: 32-40 hours

**Test Areas:**
- Canvas drag/drop operations
- All calendar views and interactions
- Pomodoro timer complete functionality
- All modal and context menu interactions
- Cross-browser compatibility

#### **4.2 Automated Testing**
**Priority**: MEDIUM
**Timeline**: 40-48 hours

**Testing Requirements:**
- Run Playwright tests for visual verification
- Execute Vitest tests for functionality
- Performance testing and optimization
- Integration testing between systems

---

## 🔧 TECHNICAL IMPLEMENTATION PLAN

### **Canvas System Technical Fixes**

#### **Vue Flow Integration Restoration**
```typescript
// Required Fixes in CanvasView.vue
- Fix @vue-flow/core import and configuration
- Restore proper node and edge type definitions
- Implement missing drag event handlers
- Fix viewport and zoom controls integration
```

#### **Task Dragging Implementation**
```typescript
// Critical Functionality to Restore
- Remove extent: 'parent' constraints properly
- Implement handleNodeDragStop event handler
- Fix task position persistence to stores
- Restore section boundary detection
```

### **Calendar System Technical Fixes**

#### **Event Creation System**
```typescript
// Required in useCalendarDayView.ts
- Fix drag-to-create event handlers
- Restore proper task instance creation
- Fix calendar event rendering logic
- Implement event resize functionality
```

#### **Store Integration Fixes**
```typescript
// Task Store Synchronization
- Resolve filtering conflicts between calendar and task store
- Fix smart view integration
- Restore proper event state management
- Fix date navigation logic
```

### **Pomodoro Timer Technical Fixes**

#### **Timer Logic Restoration**
```typescript
// Required in timer store
- Fix timer countdown logic
- Restore session state management
- Implement proper break reminders
- Fix timer persistence to localStorage
```

#### **UI Component Fixes**
```typescript
// Timer Display Components
- Fix counter display design and layout
- Restore proper start/pause/reset buttons
- Fix timer progress visualization
- Implement proper notification handling
```

---

## 📊 SUCCESS CRITERIA

### **Phase 1 Success Metrics**
- [ ] Canvas drag/drop works for 100% of test cases
- [ ] Calendar events can be created and displayed
- [ ] Pomodoro timer starts, pauses, and resets correctly
- [ ] No JavaScript console errors on main views
- [ ] Basic visual styling appears correctly

### **Phase 2 Success Metrics**
- [ ] All modals and context menus function
- [ ] Component imports resolve without errors
- [ ] Advanced features (multi-select, keyboard shortcuts) work
- [ ] Week/month calendar views function
- [ ] Task dependencies work on canvas

### **Phase 3 Success Metrics**
- [ ] Glass morphism design system fully restored
- [ ] Dark/light theme switching works
- [ ] Performance scores return to baseline (>90 Lighthouse)
- [ ] No memory leaks in 1-hour usage test
- [ ] Responsive design works on mobile devices

### **Phase 4 Success Metrics**
- [ ] All Playwright tests pass (>95% success rate)
- [ ] All Vitest unit tests pass (100% success)
- [ ] Manual testing checklist complete
- [ ] Cross-browser compatibility verified
- [ ] User acceptance testing approved

---

## ⏰ TIMELINE & RESOURCES

### **Overall Timeline: 48 Hours**
- **Phase 1**: 0-2 hours (Emergency fixes)
- **Phase 2**: 2-16 hours (Component integration)
- **Phase 3**: 16-32 hours (Design system)
- **Phase 4**: 32-48 hours (Testing & validation)

### **Resource Allocation**
- **Lead Developer**: Full-time (48 hours)
- **UI/UX Designer**: Part-time (16 hours, Phase 3)
- **QA Engineer**: Part-time (16 hours, Phase 4)
- **Product Owner**: Oversight and approval

### **Risk Mitigation Strategies**

#### **Technical Risks**
- **Risk**: Further breakage during fixes
- **Mitigation**: Work on feature branches, frequent commits
- **Backup Plan**: Revert to last known working state

#### **Timeline Risks**
- **Risk**: Complex fixes taking longer than expected
- **Mitigation**: Prioritize fixes by user impact
- **Backup Plan**: Phase 1 fixes only for immediate release

#### **Quality Risks**
- **Risk**: Rushed fixes introducing new bugs
- **Mitigation**: Comprehensive testing in Phase 4
- **Backup Plan**: Extended QA period if needed

---

## 🚀 EMERGENCY PROTOCOLS

### **Immediate Actions (First 2 Hours)**
1. **Stop all other development work**
2. **Create emergency fix branch**: `emergency-critical-restoration`
3. **Implement Phase 1 fixes only**
4. **Test basic functionality**
5. **Deploy emergency fixes to production**

### **Communication Protocol**
- **Status Updates**: Every 30 minutes during Phase 1
- **Stakeholder Notifications**: Immediate for major blockers
- **User Communication**: Prepare downtime notice if needed

### **Rollback Strategy**
- **Known Good State**: Commit before restoration attempts
- **Rollback Trigger**: >3 critical systems remain broken after Phase 1
- **Rollback Procedure**: `git revert` to last working commit

---

## 📈 POST-RESTORATION IMPROVEMENTS

### **Process Improvements**
- Implement more rigorous testing before merges
- Create automated regression testing
- Establish code freeze periods for stability
- Implement better component dependency tracking

### **Technical Improvements**
- Add error boundaries to prevent cascade failures
- Implement better state management patterns
- Create component integration tests
- Establish performance monitoring

### **Documentation Improvements**
- Document critical system dependencies
- Create troubleshooting guides
- Implement better change management processes
- Create restoration playbooks for future incidents

---

## 📝 APPROVAL & SIGNOFF

### **Required Approvals**
- [ ] **Technical Lead**: Architecture review approval
- [ ] **Product Owner**: Business requirements validation
- [ ] **QA Lead**: Testing protocol approval
- [ ] **DevOps**: Deployment plan approval

### **Signoff Criteria**
- All Phase 1 success metrics met
- No critical system failures remain
- Basic user functionality restored
- Emergency deployment successful

---

## 📞 EMERGENCY CONTACTS

- **Technical Lead**: [Contact Information]
- **Product Owner**: [Contact Information]
- **DevOps Engineer**: [Contact Information]
- **Stakeholder Representative**: [Contact Information]

---

**Document Status**: ACTIVE - IMMEDIATE IMPLEMENTATION REQUIRED
**Next Review**: Post-Phase 1 completion
**Archive Date**: 30 days after successful restoration

---

*This PRD represents a critical system restoration effort. All team members are expected to prioritize restoration activities according to the timelines and requirements outlined in this document.*