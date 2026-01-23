# Auto-Recovery Skill

Automatically detect data loss scenarios and recover from shadow.db backup.

## Triggers

Use this skill when:
- User reports "tasks missing", "data lost", "data disappeared", "everything gone"
- You see 409 errors with "foreign key constraint" during sync
- Database appears empty after a restart
- auth.users table is empty but shadow.db has data

## Detection Steps

### Step 1: Check Shadow Backup Status

```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('./backups/shadow.db', { readonly: true });
const snapshot = db.prepare('SELECT timestamp, item_count FROM snapshots WHERE item_count > 0 ORDER BY timestamp DESC LIMIT 1').get();
if (snapshot) {
  console.log('Latest snapshot:', new Date(snapshot.timestamp).toISOString());
  console.log('Items:', snapshot.item_count);
} else {
  console.log('No snapshots with data found');
}
db.close();
"
```

### Step 2: Check Current Database State

```bash
docker exec supabase_db_flow-state psql -U postgres -d postgres -c "
SELECT 'tasks' as tbl, COUNT(*) FROM tasks
UNION ALL SELECT 'groups', COUNT(*) FROM groups
UNION ALL SELECT 'projects', COUNT(*) FROM projects
UNION ALL SELECT 'users', COUNT(*) FROM auth.users;"
```

### Step 3: Compare and Diagnose

If shadow.db has data but database is empty/low:
- **Data loss detected** - offer recovery

If both are empty:
- User hasn't created data yet - no recovery needed

If database has data but shadow.db is empty:
- Shadow mirror not running - warn user

## Recovery Workflow

### Step 1: Show Preview to User

Run dry-run to show what can be recovered:

```bash
npm run restore:dry-run
```

### Step 2: Confirm with User

Ask: "Shadow backup has X tasks, Y groups, Z projects. The database appears to have lost this data. Would you like me to restore from the backup?"

### Step 3: Execute Recovery

If user confirms:

```bash
npm run restore
```

### Step 4: Verify Recovery

```bash
docker exec supabase_db_flow-state psql -U postgres -d postgres -c "
SELECT 'tasks' as tbl, COUNT(*) FROM tasks
UNION ALL SELECT 'groups', COUNT(*) FROM groups
UNION ALL SELECT 'projects', COUNT(*) FROM projects;"
```

### Step 5: Instruct User

Tell user: "Recovery complete. Please hard refresh the app (Ctrl+Shift+R) to see your restored data."

## Common Scenarios

### Scenario: 409 Foreign Key Errors

**Symptom**: Multiple 409 errors in console with "foreign key constraint" messages

**Cause**: User was deleted from auth.users, tasks reference non-existent user

**Recovery**:
1. User must sign in again (creates new user)
2. Run `npm run restore` to restore data with new user_id

### Scenario: Empty Database After Restart

**Symptom**: User says "all my tasks are gone" after restart

**Cause**: Likely `supabase stop && supabase start` recreated database

**Recovery**:
1. Check shadow.db for recent snapshot
2. User signs in to create account
3. Run `npm run restore`

### Scenario: Partial Data Loss

**Symptom**: Some tasks visible, others missing

**Cause**: Sync issue or partial restore

**Recovery**:
1. Run `npm run restore` - UPSERT will fill gaps without duplicating

## Important Notes

- **Never assume data is gone** - Always check shadow.db first
- **Always show preview** - Run `npm run restore:dry-run` before actual restore
- **User must be signed in** - Recovery needs a valid user_id in auth.users
- **Refresh required** - After restore, user must hard refresh (Ctrl+Shift+R)

## Related Commands

| Command | Purpose |
|---------|---------|
| `npm run restore` | Full recovery from shadow.db |
| `npm run restore:dry-run` | Preview without changes |
| `npm run backup:watch` | Start shadow mirror daemon |
