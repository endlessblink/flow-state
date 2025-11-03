# Data Cleanup and Maintenance Tools

## Overview
Pomo-Flow includes comprehensive data cleanup tools for troubleshooting, maintenance, and data management. These tools address issues with demo tasks, corrupted data, and storage problems.

## Core Cleanup Tools

### 1. Comprehensive Data Cleanup Script
**File**: `clear-all-data.html`
**Access**: `http://localhost:5546/clear-all-data.html`

**Features**:
- **Safe Analysis Mode**: Analyze data before deletion
- **Multi-Layer Clearing**: IndexedDB, localStorage, sessionStorage
- **Detailed Logging**: Shows exactly what's being removed
- **Error Handling**: Graceful failure with clear feedback

**Usage Steps**:
1. Open pomo-flow app (`npm run dev`)
2. Navigate to `http://localhost:5546/clear-all-data.html`
3. Click "Analyze Only (Safe)" to see current data
4. Click "Clear ALL Data" to remove all persistent data
5. Refresh main app to see clean state

**What Gets Cleared**:
- All IndexedDB data (tasks, projects, canvas, timer, settings)
- All localStorage entries with `pomo-flow` prefix
- All sessionStorage entries with `pomo-flow` prefix

### 2. Cleanup Instructions Guide
**File**: `CLEANUP_INSTRUCTIONS.md`
**Purpose**: Step-by-step guidance for users
**Sections**: Problem description, solution steps, verification process

### 3. Recovery Tool Integration
**File**: `src/stores/tasks.ts` (lines 465-474)
**Purpose**: Automatic data restoration from backups
**Features**: JSON file import, recovery tool integration, fallback mechanisms

## Common Data Issues & Solutions

### Issue: Demo Tasks in Calendar
**Symptoms**: Tasks like "create project structure", "Feature development" appearing
**Root Cause**: Persistent storage from previous testing sessions
**Solutions**:
1. **Recommended**: Use `clear-all-data.html` script
2. **Alternative**: Manual deletion through UI
3. **Debug**: Check browser console for task sources

### Issue: Real Tasks Not Showing in Calendar
**Symptoms**: Calendar inbox shows empty despite having tasks
**Root Cause**: Overly restrictive filtering logic
**Solutions**:
1. **Filter Toggle**: Use new flexible filter system in CalendarInboxPanel
2. **Debug**: Check console logs for filter reasoning
3. **Verification**: Confirm task properties (status, instances, canvasPosition)

### Issue: Corrupted or Inconsistent Data
**Symptoms**: App crashes, missing tasks, sync errors
**Root Cause**: Partial data updates, storage corruption
**Solutions**:
1. **Backup**: Export current data if needed
2. **Cleanup**: Use comprehensive cleanup script
3. **Restore**: Import clean data from recovery tool

## Technical Implementation

### IndexedDB Cleanup Logic
```javascript
// Clear all data via useDatabase composable
const { useDatabase } = await import('./src/composables/useDatabase.ts')
const db = useDatabase()
await db.clear()
```

### LocalStorage Cleanup
```javascript
const localStorageKeys = Object.keys(localStorage)
  .filter(key => key.startsWith('pomo-flow'))
localStorageKeys.forEach(key => localStorage.removeItem(key))
```

### SessionStorage Cleanup
```javascript
const sessionStorageKeys = Object.keys(sessionStorage)
  .filter(key => key.startsWith('pomo-flow'))
sessionStorageKeys.forEach(key => sessionStorage.removeItem(key))
```

## Data Recovery Tools

### Recovery Tool Import
**Location**: `src/stores/tasks.ts`
**Trigger**: Automatically runs when IndexedDB is empty
**Sources**:
1. Recovery tool data (highest priority)
2. JSON file backup (secondary)
3. Default demo data (fallback)

### User Backup Files
**Common Locations**:
- `public/user-backup.json`
- `backup/import-result.json`
- `storage-analysis/real-user-tasks.json`

### Manual Import Process
1. Place JSON file in appropriate location
2. Restart application
3. Recovery tool automatically detects and imports
4. Verify tasks appear correctly

## Best Practices

### Before Cleanup
1. **Export Data**: Use built-in export if needed
2. **Backup Important**: Save critical task data
3. **Document Issues**: Note current problems for reference

### During Cleanup
1. **Use Safe Mode**: Analyze before clearing
2. **Check Logs**: Review what's being removed
3. **Verify Results**: Confirm cleanup succeeded

### After Cleanup
1. **Test Functionality**: Verify app works correctly
2. **Import Clean Data**: Restore necessary tasks
3. **Monitor Performance**: Check for remaining issues

## Troubleshooting Guide

### Cleanup Script Not Working
**Check**: App is running on correct port (5546)
**Verify**: Console shows no import errors
**Solution**: Manually clear browser storage

### Tasks Still Missing After Cleanup
**Check**: Recovery tool is importing correctly
**Verify**: JSON file format is valid
**Solution**: Manually import via browser dev tools

### New Demo Tasks Keep Appearing
**Check**: Task creation logic in CalendarInboxPanel
**Verify**: `handleQuickAddTask` opens modal instead of creating hardcoded tasks
**Solution**: Update component logic (already fixed)

## Maintenance Schedule

### Regular Maintenance (Monthly)
- Review task data for consistency
- Check storage quota usage
- Test recovery tool functionality

### Troubleshooting (As Needed)
- Use cleanup script for data issues
- Verify filter logic working correctly
- Check for hardcoded task creation

### Development Cleanup (Weekly)
- Clear demo data from testing
- Verify production data integrity
- Test import/export functionality

## Integration with Other Systems

### Cloud Sync Integration
- Cleanup affects local storage only
- Cloud data remains unless explicitly cleared
- Sync resumes after cleanup with clean state

### Design System Integration
- Cleanup tools use consistent styling
- Error handling follows app patterns
- Debug logging integrates with console

### Canvas/Calendar Integration
- Cleanup affects all views uniformly
- Filter system works with clean data
- No hardcoded task creation remaining

---

*Last Updated: October 16, 2025*
*Tools Version: 1.0 (Comprehensive Cleanup System)*
*Integration: All Views, Recovery Tool, Cloud Sync*