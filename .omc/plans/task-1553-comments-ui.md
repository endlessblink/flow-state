# TASK-1553: Task Comments Thread UI

## Summary

Add a comment thread UI section to `TaskEditModal.vue` for workspace tasks. The composable (`useTaskComments.ts`), DB table, RLS, and realtime are already done. This plan covers the Vue component and its integration.

## Decisions (from interview)

| Decision | Choice |
|----------|--------|
| Scope | Workspace tasks only (workspace_id != null) |
| Threading | Flat chronological list |
| Edit/Delete | Hover three-dot menu, immediate soft-delete (no confirm) |
| Input | Single-line, Enter to send, Shift+Enter for newline |
| Author display | Initials circle + display name + relative time |
| Empty state | Collapsed section header with count badge, expand to see input |

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/components/tasks/edit/TaskComments.vue` | **CREATE** | Comment thread component |
| `src/components/tasks/TaskEditModal.vue` | EDIT | Add TaskComments section |
| `src/locales/en.json` | EDIT | Add comments i18n strings |
| `src/locales/he.json` | EDIT | Add Hebrew comments strings |

## Implementation Steps

### Step 1: Create `TaskComments.vue` component

Single-file Vue component with these sections:

**Template structure:**
```
<section class="comments-section">
  <!-- Collapsible header: "Comments (3)" with chevron -->
  <button @click="toggleExpanded" class="section-toggle">
    <MessageCircle icon />
    <span>Comments</span>
    <BaseBadge variant="count">{{ comments.length }}</BaseBadge>
    <ChevronDown icon (rotates when expanded) />
  </button>

  <!-- Expanded content -->
  <div v-if="isExpanded">
    <!-- Comment list -->
    <div v-for="comment in comments" class="comment-item">
      <!-- Initials circle -->
      <div class="comment-avatar">{{ initials(comment) }}</div>

      <!-- Content area -->
      <div class="comment-body">
        <div class="comment-header">
          <span class="comment-author">{{ comment.userName || comment.userEmail || 'Unknown' }}</span>
          <span class="comment-time">{{ relativeTime(comment.createdAt) }}</span>
          <!-- Three-dot menu (own comments only) -->
          <button v-if="isOwnComment(comment)" class="comment-menu-btn">
            <MoreHorizontal />
            <!-- Dropdown: Edit | Delete -->
          </button>
        </div>

        <!-- Display mode vs Edit mode -->
        <p v-if="!isEditing(comment)" class="comment-text">{{ comment.content }}</p>
        <div v-else class="comment-edit-row">
          <input v-model="editContent" @keydown.enter="saveEdit" @keydown.escape="cancelEdit" />
          <button @click="saveEdit">Save</button>
          <button @click="cancelEdit">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Empty state (when expanded but no comments) -->
    <p v-if="!comments.length" class="comments-empty">No comments yet</p>

    <!-- Input row -->
    <div class="comment-input-row">
      <input v-model="newComment" placeholder="Add a comment..."
             @keydown.enter.exact="sendComment" />
      <button @click="sendComment" :disabled="!newComment.trim()">
        <Send icon />
      </button>
    </div>
  </div>
</section>
```

**Props:**
- `taskId: string` — the task being viewed
- `workspaceId: string | null` — null = personal task, hide section entirely

**Logic:**
- On mount (when workspaceId is truthy): call `fetchComments(taskId)` + `subscribeToComments(taskId)`
- On unmount: call the unsubscribe function returned by `subscribeToComments`
- Watch `taskId` — if it changes, unsubscribe old, fetch+subscribe new
- `isExpanded` ref, defaults to `false`, toggled by header click. Auto-expand if comments.length > 0 on fetch.
- `relativeTime()` — simple helper: "<1m ago", "5m ago", "2h ago", "yesterday", date for older
- Editing state: `editingCommentId` ref + `editContent` ref. Three-dot menu sets these.
- Delete: call `deleteComment(id)` directly (optimistic, no confirmation)

**Styling:**
- Glass morphism tokens from design-system.md
- `.comment-avatar`: 28px circle, `var(--glass-bg-soft)`, `var(--brand-primary)` text, `var(--text-xs)` font
- `.comment-item`: flex row, gap `var(--space-2)`, padding `var(--space-2)`
- `.comment-input-row`: flex, input with `var(--glass-bg-soft)` bg, send button with `var(--brand-primary)` color
- Hover menu: absolute positioned, appears on `.comment-item:hover`
- RTL-safe: use `gap`, `margin-inline-start`, logical properties

### Step 2: Integrate into TaskEditModal.vue

- Import `TaskComments` component
- Add it in `modal-body` after `TaskEditChildTasks` and before the pomodoro section
- Pass `taskId` from `editedTask.value.id` and `workspaceId` from `editedTask.value.workspaceId`
- Only render when `editedTask.value.workspaceId` is truthy (v-if)

### Step 3: Add i18n strings

**en.json** — add under a `comments` namespace:
```json
"comments": {
  "title": "Comments",
  "placeholder": "Add a comment...",
  "empty": "No comments yet",
  "edit": "Edit",
  "delete": "Delete",
  "edited": "edited"
}
```

**he.json** — Hebrew translations:
```json
"comments": {
  "title": "תגובות",
  "placeholder": "הוסף תגובה...",
  "empty": "אין תגובות עדיין",
  "edit": "עריכה",
  "delete": "מחיקה",
  "edited": "נערך"
}
```

### Step 4: Verify & Test

- Run `npm run build` to confirm no type errors
- Run Playwright E2E to verify modal still works
- Manual verification: open a workspace task's edit modal, confirm comments section appears collapsed

## Architecture Notes

- **No new store needed** — `useTaskComments` composable manages its own reactive state per-instance
- **Realtime lifecycle** — subscribe on component mount, unsubscribe on unmount. The composable handles deduplication (optimistic + realtime won't double-insert)
- **workspace_id in insert** — The composable currently doesn't pass `workspace_id` to the insert. Need to add it since the DB column is NOT NULL. Will pass it from the component prop.
- **No workspace_members query for personal tasks** — Section is hidden entirely when `workspaceId` is null, so the member resolution in the composable won't fire unnecessarily

## Risk: workspace_id missing from insert

The `useTaskComments.ts` composable's `addComment()` doesn't currently include `workspace_id` in the insert payload, but the DB column `workspace_id` is NOT NULL. **Must fix this** by either:
- Adding a `workspaceId` parameter to `addComment()`
- Or having the composable accept it at initialization time

Will use option A (parameter) to keep the composable stateless regarding workspace context.
