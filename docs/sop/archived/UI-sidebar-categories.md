# 🐛 Debug SOP - Pomo-Flow Sidebar Categories Issue Resolution

## 🔍 Problem Statement
Categories (projects) don't appear on the main side panel despite database loading correctly.

## ✅ Solution Applied

### Root Cause Discovery
The issue was NOT in the separate `AppSidebar.vue` component, but in the hardcoded sidebar in `App.vue` at line 150. The problematic code used a broken pattern:

```vue
<!-- BROKEN PATTERN (line 150) -->
v-for="project in (Array.isArray(sidebar.rootProjects) ? sidebar.rootProjects.filter(p => p && p.id) : [])"
```

### Working Pattern Fix
Replaced with the proven working pattern from Board view:

```vue
<!-- WORKING PATTERN -->
v-for="project in taskStore.projects.filter(p => !p.parentId)"
```

## 🛠️ Step-by-Step Debug Process

### 1. Initial Investigation
- Verified database layer works perfectly: "✅ Loaded 2 projects from PouchDB"
- Confirmed Board view shows both projects correctly
- Identified sidebar Projects tree as empty despite database success

### 2. Component Analysis
- Discovered `AppSidebar.vue` wasn't being used (no console logs appearing)
- Found actual sidebar is hardcoded in `App.vue`
- Identified problematic `sidebar.rootProjects` pattern

### 3. Pattern Discovery
- Board view successfully uses: `taskStore.projects.filter(p => !p.parentId)`
- This pattern directly accesses the task store and filters for root projects
- Applied same pattern to App.vue sidebar

### 4. Implementation
```typescript
// File: src/App.vue (line 150)
// Changed from:
v-for="project in (Array.isArray(sidebar.rootProjects) ? sidebar.rootProjects.filter(p => p && p.id) : [])"

// To:
v-for="project in taskStore.projects.filter(p => !p.parentId)"
```

## ✅ Results Verified

### Before Fix
- Sidebar Projects section: Empty
- Console: "✅ Loaded 2 projects from PouchDB" (data was there)
- Board view: Working perfectly

### After Fix
- **"My Tasks"** appears with correct task count 🪣
- **"Test Project for Sidebar"** appears with correct task count
- Console: Clean project loading
- Board view: Still working perfectly

## 🎯 Key Learning Points

### 1. Always Verify the Actual Component
- Don't assume based on file names
- Check which components are actually imported and used
- Use DOM inspection to confirm template rendering

### 2. Use Proven Working Patterns
- Board view pattern: `taskStore.projects.filter(p => !project.parentId)` ✅
- Complex composables can have issues
- Direct store access is often more reliable

### 3. Database vs Template Issues
- Database working ≠ Template working
- Verify both layers independently
- Use console logs to trace data flow

### 4. Component Architecture
- App.vue had hardcoded sidebar instead of using AppSidebar component
- Separate AppSidebar.vue component existed but wasn't being used
- Main app components can override component libraries

## 🚀 Future Debug Approach

### 1. Quick Verification Checklist
- [ ] Check console for data loading messages
- [ ] Verify working views (Board, Calendar, Canvas)
- [ ] Inspect DOM to confirm template rendering
- [ ] Check for actual component usage vs assumed usage

### 2. Pattern Library
Keep a reference of working patterns:
```typescript
// ✅ Working: Direct store access for projects
taskStore.projects.filter(p => !p.parentId)

// ✅ Working: Direct store access for root projects
taskStore.projects.filter(project => !project.parentId)

// ❌ Avoid: Complex composable chains without verification
sidebar.rootProjects?.filter?.(p => p && p.id)
```

### 3. Debug Tools
- **Console**: Track data loading and reactivity
- **DOM Inspection**: Verify template rendering vs assumptions
- **Component Analysis**: Check actual imports and usage
- **Pattern Comparison**: Test working vs broken patterns

## 📝 Technical Details

### Files Modified
- `src/App.vue` (line 150): Fixed sidebar v-for pattern
- `src/stores/tasks.ts`: Removed duplicate PouchDB initialization (lines 836-886)

### Commit Information
- **Branch**: ui/fix-kanban-add-task-buttons
- **Commit**: 8c54c72
- **Message**: "fix: resolve categories not appearing in main sidebar panel"

### Verification Commands
```bash
npm run dev          # Start development server
# Check browser console for: "✅ Loaded X projects from PouchDB"
# Verify sidebar shows both: "My Tasks" and "Test Project for Sidebar"
```

## 🎉 Success Metrics
- ✅ Projects appear in sidebar: 2/2
- ✅ Task counts display correctly
- ✅ Board view functionality maintained
- ✅ No breaking changes
- ✅ Database integrity preserved

---

**Status**: RESOLVED ✅
**Date**: 2025-11-28
**Impact**: Categories now visible in main sidebar as intended