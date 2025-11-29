# Understanding Conflicts

## What Are Sync Conflicts?

When you use Pomo-Flow across multiple devices (phone, tablet, computer), your tasks and data synchronize between them. A **sync conflict** occurs when the same task is modified on two different devices before they have a chance to sync with each other.

### Simple Example

Imagine this scenario:

1. **Morning on your laptop**: You change a task title from "Buy groceries" to "Buy groceries for dinner"
2. **At the same time on your phone**: You mark that same task as "high priority"
3. **Later**: Both devices try to sync

Now Pomo-Flow has two different versions of the same task. This is a conflict that needs to be resolved.

## Why Do Conflicts Happen?

Conflicts occur due to:

| Cause | Description |
|-------|-------------|
| **Offline editing** | You edit tasks while offline on multiple devices |
| **Simultaneous edits** | Two people (or devices) edit the same task at once |
| **Network delays** | Changes don't sync instantly due to connection issues |
| **Long sync intervals** | Large gaps between sync operations |

## Types of Conflicts

### 1. Edit-Edit Conflicts

**What it is**: Both versions changed the same field.

**Example**:
- Device A: Changed title to "Morning workout"
- Device B: Changed title to "Evening workout"

**Resolution options**: Choose one title or write a new one.

### 2. Edit-Delete Conflicts

**What it is**: One device edited a task while another deleted it.

**Example**:
- Device A: Updated task description with more details
- Device B: Deleted the entire task

**Resolution options**: Keep the task (with edits) or confirm deletion.

### 3. Merge Candidates

**What it is**: Both versions changed *different* fields - no actual conflict!

**Example**:
- Device A: Changed the due date
- Device B: Added a new subtask

**Resolution**: Pomo-Flow automatically merges both changes. No action needed!

### 4. Version Mismatch

**What it is**: The document versions don't follow expected sequence.

**Example**: Database sync got interrupted and documents are out of order.

**Resolution**: Usually handled automatically or requires choosing which version to keep.

### 5. Checksum Mismatch

**What it is**: Data integrity check failed - something went wrong during transfer.

**Example**: Network error corrupted data during sync.

**Resolution**: Re-sync from server or restore from backup.

## Conflict Severity Levels

Pomo-Flow assigns a severity level to help you prioritize:

### Critical (Red)

**Affected fields**: Task title, status, or task ID

**Why it matters**: These fields fundamentally define the task. Getting them wrong could cause confusion or data loss.

**Action needed**: Immediate attention required.

### High (Orange)

**Affected fields**: Due date, priority, completion state

**Why it matters**: These affect your planning and workflow. Wrong values could cause you to miss deadlines or work on wrong priorities.

**Action needed**: Review before continuing work.

### Medium (Yellow)

**Affected fields**: Description, tags, subtasks

**Why it matters**: Important for task details but won't cause major issues if delayed.

**Action needed**: Review when convenient.

### Low (Green)

**Affected fields**: Metadata, timestamps, non-essential fields

**Why it matters**: Minimal impact on your workflow.

**Action needed**: Can often be auto-resolved.

## Auto-Resolution

Pomo-Flow can automatically resolve some conflicts without your input:

### When Auto-Resolution Happens

1. **No overlapping changes**: Different fields were modified
2. **Clear winner**: One version is clearly newer and more complete
3. **Safe to merge**: Changes can be combined without data loss
4. **Low severity**: Only non-critical fields affected

### What Gets Auto-Resolved

| Scenario | Resolution |
|----------|------------|
| Only timestamps differ | Use newest timestamp |
| One side added, other unchanged | Keep the addition |
| Different fields modified | Merge all changes |
| Metadata only | Use most recent |

### What Needs Your Decision

- Same field changed to different values
- Task deleted on one device, edited on another
- Critical fields (title, status) affected
- Data integrity concerns

## Preventing Conflicts

### Best Practices

1. **Sync frequently**: Enable automatic sync or sync manually before editing
2. **Avoid simultaneous edits**: If possible, finish editing on one device before switching
3. **Stay connected**: Conflicts are less likely when you have a stable internet connection
4. **Plan device usage**: Designate a primary device for major task management

### Sync Indicators

Watch for these indicators in Pomo-Flow:

| Indicator | Meaning |
|-----------|---------|
| Cloud icon (synced) | All changes are synced |
| Cloud with arrow | Sync in progress |
| Cloud with X | Offline or sync failed |
| Warning triangle | Conflicts need attention |

## What Happens to Conflicting Data?

**Nothing is permanently lost!**

When a conflict is detected:

1. **Both versions are preserved** until you make a decision
2. **Original data is backed up** before any resolution
3. **Resolution history is logged** for reference
4. **You can undo** most resolution decisions

### Recovery Options

If you make a mistake during resolution:

1. **Undo button**: Available immediately after resolution
2. **Version history**: View and restore previous versions
3. **Sync log**: See all changes and when they occurred
4. **Support**: Contact support for data recovery assistance

## Frequently Asked Questions

### Q: Will I lose data if I don't resolve a conflict?

**A**: No. Conflicts are safely preserved until you resolve them. Your data remains intact.

### Q: Can I ignore conflicts?

**A**: You can delay resolution, but unresolved conflicts may cause sync issues until addressed.

### Q: What if I choose wrong during resolution?

**A**: Most resolutions can be undone. Version history helps you recover previous states.

### Q: How often should I check for conflicts?

**A**: Pomo-Flow notifies you automatically. The conflict count appears in the sync status area.

### Q: Can conflicts happen if I only use one device?

**A**: Rarely. Conflicts mainly occur in multi-device or shared scenarios. Single-device usage might see occasional version conflicts during network issues.

### Q: Do conflicts affect my other tasks?

**A**: No. Conflicts are isolated to specific tasks. Other tasks sync normally.

## Next Steps

- [Resolution Workflows](./resolution-workflows.md) - Step-by-step resolution guides
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions
