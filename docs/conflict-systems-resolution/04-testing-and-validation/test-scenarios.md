# Test Scenarios

Comprehensive test case documentation for conflict resolution.

## Scenario Categories

1. [Detection Scenarios](#detection-scenarios)
2. [Resolution Scenarios](#resolution-scenarios)
3. [UI Scenarios](#ui-scenarios)
4. [Edge Cases](#edge-cases)
5. [Performance Scenarios](#performance-scenarios)

---

## Detection Scenarios

### DET-001: No Conflict Detection

**Description**: Document without conflicts should not trigger detection.

**Preconditions**:
- Document exists in database
- No `_conflicts` array present

**Steps**:
1. Call `detectConflict(doc)`

**Expected Result**:
- Returns `null`
- No conflict event emitted

---

### DET-002: Single Conflict Detection

**Description**: Document with one conflict revision is detected.

**Preconditions**:
- Document has `_conflicts: ['2-xyz']`

**Steps**:
1. Call `detectConflict(doc)`

**Expected Result**:
- Returns `ConflictInfo` object
- `conflictingFields` populated
- `severity` calculated

---

### DET-003: Multiple Conflict Detection

**Description**: Document with multiple conflict revisions.

**Preconditions**:
- Document has `_conflicts: ['2-abc', '2-def', '2-ghi']`

**Steps**:
1. Call `detectConflict(doc)`

**Expected Result**:
- Returns `ConflictInfo` with all conflicts analyzed
- Uses most relevant revision for comparison

---

### DET-004: Conflict Type - EDIT_EDIT

**Description**: Same field modified in both versions.

**Test Data**:
```javascript
local:  { title: 'Local Title', status: 'done' }
remote: { title: 'Remote Title', status: 'done' }
```

**Expected Result**:
- `type` = `ConflictType.EDIT_EDIT`
- `conflictingFields` = `['title']`

---

### DET-005: Conflict Type - MERGE_CANDIDATES

**Description**: Different fields modified, no overlap.

**Test Data**:
```javascript
local:  { title: 'Same', status: 'done' }
remote: { title: 'Same', priority: 'high' }
```

**Expected Result**:
- `type` = `ConflictType.MERGE_CANDIDATES`
- `canAutoResolve` = `true`

---

### DET-006: Conflict Type - EDIT_DELETE

**Description**: Field deleted in one version, edited in other.

**Test Data**:
```javascript
local:  { title: 'Title', description: 'Updated desc' }
remote: { title: 'Title' }  // description deleted
```

**Expected Result**:
- `type` = `ConflictType.EDIT_DELETE`
- `canAutoResolve` = `false`

---

### DET-007: Nested Field Detection

**Description**: Conflict in nested object field.

**Test Data**:
```javascript
local:  { subtasks: [{ id: '1', completed: true }] }
remote: { subtasks: [{ id: '1', completed: false }] }
```

**Expected Result**:
- `conflictingFields` includes `'subtasks[1].completed'`

---

### DET-008: Severity - Critical

**Description**: Title field conflict.

**Test Data**:
```javascript
conflictingFields: ['title']
```

**Expected Result**:
- `severity` = `'critical'`

---

### DET-009: Severity - High

**Description**: Due date or priority conflict.

**Test Data**:
```javascript
conflictingFields: ['dueDate', 'priority']
```

**Expected Result**:
- `severity` = `'high'`

---

### DET-010: Severity - Low

**Description**: Metadata-only conflict.

**Test Data**:
```javascript
conflictingFields: ['updatedAt', 'syncVersion']
```

**Expected Result**:
- `severity` = `'low'`
- `canAutoResolve` = `true`

---

## Resolution Scenarios

### RES-001: LOCAL Strategy

**Description**: Keep local version entirely.

**Input**:
```javascript
conflict: { localVersion: { title: 'Local' }, remoteVersion: { title: 'Remote' } }
strategy: ResolutionType.LOCAL
```

**Expected Result**:
- `resolvedDocument.title` = `'Local'`
- `resolutionType` = `'local'`

---

### RES-002: REMOTE Strategy

**Description**: Accept remote version entirely.

**Input**:
```javascript
conflict: { localVersion: { title: 'Local' }, remoteVersion: { title: 'Remote' } }
strategy: ResolutionType.REMOTE
```

**Expected Result**:
- `resolvedDocument.title` = `'Remote'`
- `resolutionType` = `'remote'`

---

### RES-003: LAST_WRITE_WINS - Local Newer

**Description**: Local has later timestamp.

**Input**:
```javascript
localVersion: { updatedAt: 2000, title: 'Local' }
remoteVersion: { updatedAt: 1000, title: 'Remote' }
```

**Expected Result**:
- `resolvedDocument.title` = `'Local'`

---

### RES-004: LAST_WRITE_WINS - Remote Newer

**Description**: Remote has later timestamp.

**Input**:
```javascript
localVersion: { updatedAt: 1000, title: 'Local' }
remoteVersion: { updatedAt: 2000, title: 'Remote' }
```

**Expected Result**:
- `resolvedDocument.title` = `'Remote'`

---

### RES-005: MERGE - Non-overlapping Fields

**Description**: Merge different field changes.

**Input**:
```javascript
local:  { title: 'Title', status: 'done' }
remote: { title: 'Title', priority: 'high' }
```

**Expected Result**:
```javascript
{ title: 'Title', status: 'done', priority: 'high' }
```

---

### RES-006: MERGE - Array Combination

**Description**: Merge tag arrays.

**Input**:
```javascript
local:  { tags: ['work', 'urgent'] }
remote: { tags: ['work', 'important'] }
```

**Expected Result**:
```javascript
{ tags: ['work', 'urgent', 'important'] }
```

---

### RES-007: MANUAL - Field Selection

**Description**: User selects per-field.

**Input**:
```javascript
userSelections: { title: 'local', description: 'remote' }
```

**Expected Result**:
- `title` from local version
- `description` from remote version

---

### RES-008: MANUAL - Custom Value

**Description**: User provides custom value.

**Input**:
```javascript
userSelections: { title: 'My Custom Title' }
```

**Expected Result**:
- `resolvedDocument.title` = `'My Custom Title'`

---

### RES-009: CUSTOM Resolver

**Description**: Custom resolver function applied.

**Input**:
```javascript
customResolvers: {
  priority: (local, remote) => local === 'high' ? local : remote
}
```

**Expected Result**:
- Custom logic determines field value

---

### RES-010: Resolution with Subtasks

**Description**: Merge subtask arrays by ID.

**Input**:
```javascript
local:  { subtasks: [{ id: '1', title: 'A', completed: true }] }
remote: { subtasks: [{ id: '1', title: 'A', completed: false }, { id: '2', title: 'B' }] }
```

**Expected Result**:
- Subtask '1' merged (needs decision on completed)
- Subtask '2' added from remote

---

## UI Scenarios

### UI-001: Dialog Opens on Conflict

**Description**: Conflict dialog appears when manual resolution needed.

**Steps**:
1. Navigate to app
2. Trigger sync with conflict
3. Observe UI

**Expected Result**:
- Conflict notification appears
- Click opens dialog
- Fields displayed for selection

---

### UI-002: Field Selection Visual Feedback

**Description**: Selected values show visual indication.

**Steps**:
1. Open conflict dialog
2. Click "Use This Value" for local

**Expected Result**:
- Local button highlighted
- Selection count updates

---

### UI-003: Bulk Actions

**Description**: "Keep All Local" selects all local values.

**Steps**:
1. Open dialog with multiple conflicts
2. Click "Keep All Local"

**Expected Result**:
- All fields show local selected
- Apply button enabled

---

### UI-004: Manual Merge Modal

**Description**: Manual merge for complex fields.

**Steps**:
1. Click "Merge Manually" on text field
2. Edit in merge modal
3. Save

**Expected Result**:
- Modal opens with both values
- Can edit merged result
- Custom value applied

---

### UI-005: Cancel Without Saving

**Description**: Cancel discards selections.

**Steps**:
1. Make selections
2. Click Cancel

**Expected Result**:
- Dialog closes
- Conflict remains unresolved
- No data changed

---

## Edge Cases

### EDGE-001: Empty Document Conflict

**Description**: Conflict between empty documents.

**Input**:
```javascript
local:  {}
remote: {}
```

**Expected Result**:
- No conflicts detected (identical)

---

### EDGE-002: Null Field Values

**Description**: Conflict where one value is null.

**Input**:
```javascript
local:  { description: 'Has content' }
remote: { description: null }
```

**Expected Result**:
- Field detected as conflicting
- Can resolve to either value

---

### EDGE-003: Deeply Nested Conflict

**Description**: Conflict 5+ levels deep.

**Input**:
```javascript
local:  { a: { b: { c: { d: { e: 'local' } } } } }
remote: { a: { b: { c: { d: { e: 'remote' } } } } }
```

**Expected Result**:
- `conflictingFields` = `['a.b.c.d.e']`

---

### EDGE-004: Large Array Conflict

**Description**: Conflict in array with 100+ items.

**Input**:
```javascript
local:  { items: [/* 100 items, #50 modified */] }
remote: { items: [/* 100 items, #50 different */] }
```

**Expected Result**:
- Performance within acceptable range
- Specific item identified

---

### EDGE-005: Same Timestamp

**Description**: Both versions have identical timestamp.

**Input**:
```javascript
localVersion:  { updatedAt: 1000 }
remoteVersion: { updatedAt: 1000 }
```

**Expected Result**:
- LAST_WRITE_WINS prefers local (tie-breaker)

---

### EDGE-006: Missing Timestamp

**Description**: Timestamp field missing.

**Input**:
```javascript
localVersion:  { updatedAt: undefined }
remoteVersion: { updatedAt: 1000 }
```

**Expected Result**:
- Fallback to revision number
- Or treat missing as oldest

---

### EDGE-007: Circular Reference

**Description**: Document with circular reference.

**Input**:
```javascript
const obj = { name: 'Test' }
obj.self = obj  // circular
```

**Expected Result**:
- Handled gracefully (no infinite loop)
- Error or skip circular parts

---

### EDGE-008: Unicode Content

**Description**: Conflict in Unicode text fields.

**Input**:
```javascript
local:  { title: 'å,žÆ¹È' }
remote: { title: '-‡KÕ' }
```

**Expected Result**:
- Correct encoding preserved
- Comparison works correctly

---

## Performance Scenarios

### PERF-001: 100 Concurrent Conflicts

**Description**: Handle many conflicts simultaneously.

**Metrics**:
- Detection: < 500ms total
- Memory: < 50MB additional

---

### PERF-002: Large Document (1MB)

**Description**: Conflict in large document.

**Metrics**:
- Detection: < 100ms
- Comparison: < 200ms

---

### PERF-003: Rapid Sync Events

**Description**: 100 sync events per second.

**Metrics**:
- No missed conflicts
- Debouncing effective

---

## Test Execution Checklist

- [ ] All DET-* scenarios pass
- [ ] All RES-* scenarios pass
- [ ] All UI-* scenarios pass
- [ ] All EDGE-* scenarios pass
- [ ] All PERF-* scenarios pass
- [ ] Coverage > 90% for core modules
- [ ] No memory leaks detected
- [ ] E2E tests pass on CI

---

## See Also

- [Test Strategy](./test-strategy.md) - Testing approach
- [Validation Procedures](./validation-procedures.md) - Validation checklist
