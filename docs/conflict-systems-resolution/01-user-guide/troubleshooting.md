# Troubleshooting

Common issues and solutions for conflict resolution in Pomo-Flow.

## Quick Fixes

| Problem | Quick Fix |
|---------|-----------|
| Conflict won't resolve | Refresh and try again |
| Dialog not opening | Check for JavaScript errors in console |
| Resolution not saving | Check network connection |
| Data looks corrupted | Cancel and re-sync from server |

---

## Common Issues

### Issue: Conflict Dialog Won't Open

**Symptoms:**
- Click on conflict notification, nothing happens
- Sync indicator shows conflicts but no dialog appears

**Causes & Solutions:**

1. **JavaScript Error**
   - Open browser DevTools (F12)
   - Check Console for errors
   - Refresh the page

2. **Modal Already Open**
   - Close any other open dialogs
   - Try again

3. **UI State Issue**
   - Press Escape to reset UI state
   - Refresh the page

---

### Issue: "Apply Resolutions" Button Disabled

**Symptoms:**
- Button is grayed out
- Can't complete resolution

**Causes & Solutions:**

1. **Incomplete Selections**
   - Review all conflicting fields
   - Ensure each field has a selection (local, remote, or custom)
   - Look for fields you may have scrolled past

2. **Validation Error**
   - Check for red error indicators
   - Ensure custom values are valid

---

### Issue: Resolution Doesn't Save

**Symptoms:**
- Click Apply, but conflict reappears
- Task doesn't update

**Causes & Solutions:**

1. **Network Issue**
   - Check internet connection
   - Wait for sync to complete
   - Try again

2. **Database Conflict**
   - Another change occurred during resolution
   - Re-open conflict dialog
   - Resolve with updated data

3. **Revision Mismatch**
   - Document was modified elsewhere
   - Refresh and re-resolve

---

### Issue: Data Looks Corrupted

**Symptoms:**
- Strange characters in text
- Missing or scrambled content
- Values don't match what you entered

**Causes & Solutions:**

1. **Encoding Issue**
   - Cancel current resolution
   - Check original documents in database
   - Re-sync from server if needed

2. **Partial Sync**
   - Wait for complete sync
   - Force full sync from settings

3. **Browser Cache**
   - Clear browser cache
   - Reload application

---

### Issue: Same Conflict Keeps Appearing

**Symptoms:**
- Resolve conflict, but it comes back
- Stuck in resolution loop

**Causes & Solutions:**

1. **Failed Cleanup**
   - Old conflict revisions weren't deleted
   - Check database for orphaned revisions
   - Manual cleanup may be needed

2. **Sync Race Condition**
   - Changes syncing faster than resolution
   - Pause sync temporarily
   - Resolve, then resume sync

3. **Multiple Devices**
   - Another device creating new conflicts
   - Sync all devices before resolving
   - Resolve on one device at a time

---

### Issue: Auto-Resolution Made Wrong Choice

**Symptoms:**
- Data changed unexpectedly
- Auto-resolved to wrong value

**Causes & Solutions:**

1. **Immediate Undo**
   - Look for undo notification
   - Click "Undo" within 10 seconds

2. **Version History**
   - Open task details
   - View version history
   - Restore previous version

3. **Disable Auto-Resolution**
   - Go to Settings > Sync
   - Disable "Auto-resolve simple conflicts"
   - All conflicts will require manual review

---

### Issue: Manual Merge Not Working

**Symptoms:**
- Can't type in merge editor
- Merge save fails

**Causes & Solutions:**

1. **Field Type Mismatch**
   - Some fields can't be manually merged
   - Use local or remote selection instead

2. **Invalid Value**
   - Check for validation requirements
   - Ensure format is correct (dates, numbers, etc.)

3. **Editor Issue**
   - Click inside the editor to focus
   - Try keyboard navigation

---

### Issue: Subtask Conflicts Confusing

**Symptoms:**
- Subtask conflicts hard to understand
- Wrong subtasks being compared

**Causes & Solutions:**

1. **Subtask Order Changed**
   - Subtasks may have been reordered
   - Compare by subtask title, not position

2. **Subtask Added/Removed**
   - Look for "Added" or "Removed" indicators
   - These are additions, not conflicts

3. **Complex Nesting**
   - Expand all nested items
   - Resolve from innermost to outermost

---

## Error Messages

### "ConflictDetectionError: Failed to parse revisions"

**Meaning:** Database couldn't load conflict versions.

**Solution:**
1. Check database connection
2. Verify document exists
3. Try re-syncing

### "ResolutionError: Merge operation failed"

**Meaning:** Couldn't combine document versions.

**Solution:**
1. Try a different resolution strategy
2. Use manual resolution
3. Check for data type conflicts

### "DatabaseError: Document update conflict"

**Meaning:** Document changed while resolving.

**Solution:**
1. Refresh conflict data
2. Re-apply resolution
3. Check for concurrent edits

### "ChecksumError: Data integrity validation failed"

**Meaning:** Data may be corrupted.

**Solution:**
1. Do not apply resolution
2. Fetch fresh data from server
3. Report issue if persists

---

## Recovery Procedures

### Recovering from Bad Resolution

**Step 1:** Check for undo option (within 10 seconds)

**Step 2:** If no undo, open task history:
1. Click task to open details
2. Find "History" or "Versions"
3. Locate version before resolution
4. Click "Restore"

**Step 3:** If no history, check database:
1. Open DevTools > Application > IndexedDB
2. Find task document
3. Check for backup revisions

### Full Data Recovery

If multiple tasks are affected:

1. **Stop syncing** - Disable auto-sync
2. **Export current data** - Use export feature
3. **Contact support** - For database-level recovery
4. **Restore from backup** - If available

---

## Diagnostic Tools

### Check Sync Status

1. Look at sync indicator in header
2. Click for detailed status
3. View last sync time and any errors

### View Conflict Details

```javascript
// In browser console
const conflicts = await pouchDB.get('task-id', { conflicts: true })
console.log(conflicts._conflicts)
```

### Force Re-Sync

1. Go to Settings > Sync
2. Click "Force Full Sync"
3. Wait for completion

### Clear Conflict State

**Warning:** Only use if stuck in broken state.

1. Settings > Advanced
2. "Clear Conflict Cache"
3. Re-sync all data

---

## Getting Help

### Before Contacting Support

1. **Note the error message** - Exact text helps diagnosis
2. **Check console** - DevTools > Console for errors
3. **Document steps** - What you did before the issue
4. **Try basic fixes** - Refresh, re-sync, restart

### Information to Provide

- Browser and version
- Operating system
- Pomo-Flow version
- Steps to reproduce
- Error messages (screenshots help)
- When the issue started

### Support Channels

- GitHub Issues: For bug reports
- Documentation: Check other guides first
- Community: Ask other users

---

## Prevention Tips

1. **Sync frequently** - Reduce conflict likelihood
2. **Use one device at a time** - Avoid simultaneous edits
3. **Stay connected** - Offline editing increases conflicts
4. **Review before bulk changes** - Sync before major edits
5. **Keep app updated** - Latest version has bug fixes

---

## See Also

- [Understanding Conflicts](./understanding-conflicts.md) - Background on conflicts
- [Resolution Workflows](./resolution-workflows.md) - Step-by-step guides
- [API Reference](../02-developer-guide/api-reference.md) - Technical details
