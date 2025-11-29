# TypeScript Foundation Restoration Troubleshooting

## Common Issues and Solutions

### Issue: Compilation Still Fails After Fixes
**Symptoms**: `npx tsc --noEmit` still shows errors
**Causes**:
- Missing type imports
- Circular dependencies
- Syntax errors in new code
- Incorrect type definitions

**Solutions**:
1. Check all imports are correct:
   ```typescript
   import type { Task, TaskInstance } from '@/stores/tasks'
   ```
2. Verify no circular dependencies between files
3. Check TypeScript syntax in newly added code
4. Ensure type definitions match actual usage

### Issue: Development Server Still Slow
**Symptoms**: Server takes 30+ seconds to compile
**Causes**:
- TypeScript still struggling with errors
- Vite configuration issues
- Missing source maps

**Solutions**:
1. Run TypeScript check first: `npx tsc --noEmit`
2. Clear Vite cache: `rm -rf node_modules/.vite`
3. Check vite.config.ts for issues
4. Verify all errors are resolved before starting dev server

### Issue: Runtime Errors Persist
**Symptoms**: Application loads but console shows errors
**Causes**:
- Store methods not properly exported
- Type mismatch issues at runtime
- Missing initialization

**Solutions**:
1. Verify all methods are exported from store:
   ```typescript
   return {
     // ... existing exports
     getTask,  // Must be included
     getUncategorizedTaskCount,  // Must be included
   }
   ```
2. Check component initialization
3. Test methods in browser console manually

### Issue: Task Properties Still Missing
**Symptoms**: `task.scheduledDate` returns undefined
**Causes**:
- Task interface not properly updated
- Type definitions not applied
- Old cached types

**Solutions**:
1. Restart TypeScript language server in IDE
2. Clear browser cache completely
3. Verify Task interface was actually updated
4. Check for multiple Task interface definitions

### Issue: Import/Export Conflicts
**Symptoms**: "Cannot find module" errors
**Causes**:
- Incorrect import paths
- Missing exports
- Type vs value import issues

**Solutions**:
1. Use `import type` for type-only imports:
   ```typescript
   import type { Task } from '@/stores/tasks'
   ```
2. Verify exports in store files
3. Check import paths are correct

## Validation Commands

### Quick TypeScript Check
```bash
npx tsc --noEmit --pretty
```
**Expected**: No output (0 errors)

### Development Server Test
```bash
npm run dev
```
**Expected**: Server starts in <15 seconds, no compilation errors

### Browser Console Test
```javascript
// Test in browser console
const taskStore = window.$nuxt.$pinia.useTaskStore()
console.log('Uncategorized count:', taskStore.getUncategorizedTaskCount())
console.log('Task properties:', taskStore.tasks[0].scheduledDate)
```
**Expected**: No errors, values returned correctly

## Common Error Messages and Fixes

### "Property 'scheduledDate' does not exist on type 'Task'"
**Fix**: Add `scheduledDate: string` to Task interface

### "Property 'getUncategorizedTaskCount' does not exist on type 'Store'"
**Fix**: Add `getUncategorizedTaskCount()` method to task store and export it

### "Cannot find name 'TaskInstance'"
**Fix**: Import `TaskInstance` type from store or define it

### "Type 'Promise<boolean>' is not assignable to type 'Promise<void>'"
**Fix**: Change method return type from `Promise<boolean>` to `Promise<void>`

### "Used as value instead of type"
**Fix**: Use `import type` instead of `import` for type-only imports

## Recovery Procedures

### If All Else Fails - Fresh Start
1. **Backup current changes**: `git commit -am "Backup before fresh start"`
2. **Reset to known good state**: `git reset --hard HEAD~5`
3. **Apply skill systematically**: Run TypeScript Foundation Restoration skill
4. **Validate each phase**: Don't proceed until compilation passes

### Rollback Plan
If skill makes things worse:
1. **Immediately stop**: Don't continue with more changes
2. **Check git status**: See what was modified
3. **Revert problematic files**: `git restore src/stores/tasks.ts` etc.
4. **Verify compilation**: Ensure you're back to working state
5. **Report issues**: Document what went wrong for debugging

## Performance Optimization

### After Restoration
1. **TypeScript compilation**: Should be <10 seconds
2. **Development server**: Should start in <15 seconds
3. **Hot reload**: Should work properly
4. **Bundle size**: Should be optimized

### Monitoring
- Watch compilation times with each change
- Monitor memory usage during development
- Track error frequency

## Success Indicators

✅ **Compilation Success**: `npx tsc --noEmit` passes cleanly
✅ **Fast Development**: Server starts quickly
✅ **No Runtime Errors**: Clean browser console
✅ **Full Functionality**: All features work
✅ **Surface Fixes Work**: Previous Claude fixes now function

If all these indicators pass, the TypeScript foundation restoration was successful.