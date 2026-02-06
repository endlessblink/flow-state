# Crisis Analysis: Auth & Data Loss - January 20, 2026

## Executive Summary

User `endlessblink@gmail.com` lost access to their account and potentially significant data due to multiple system failures in the backup and persistence infrastructure.

---

## All Issues Discovered (Complete Table)

| # | Issue | Root Cause | Status | Priority |
|---|-------|------------|--------|----------|
| 1 | **Auth.users wiped overnight** | Supabase restart wiped user table | ✅ Fixed (user recreated) | CRITICAL |
| 2 | **seed.sql missing production user** | Only had dev user, not endlessblink | ✅ Fixed (added to seed.sql) | CRITICAL |
| 3 | **Shadow-mirror never ran before Jan 19** | Script existed but no npm script to run it | ⚠️ Documented | HIGH |
| 4 | **Wrong localStorage file checked** | `com.pomoflow.desktop` vs `com.flowstate.app` | ✅ Fixed | MEDIUM |
| 5 | **IS_SERVICE_ROLE detection bug** | Checked raw JWT string, not decoded payload | ✅ Fixed | HIGH |
| 6 | **Password lost** | Original password unrecoverable (bcrypt) | ✅ New password set | MEDIUM |
| 7 | **Download Backup button stuck** | Tauri file dialog permissions | ✅ Workaround (manual extract) | MEDIUM |
| 8 | **"Database error querying schema"** | PostgREST schema cache stale | ✅ Fixed (restart) | HIGH |
| 9 | **Golden Backup shows offline** | Requires Supabase connection | ℹ️ Expected behavior | LOW |
| 10 | **53 tasks vs 42 in backup** | Jan 15 backup older than current localStorage | ⚠️ User has newer data | HIGH |
| 11 | **auth.users NULL columns** | GoTrue can't handle NULL in email_change etc | ✅ Fixed (set to '') | CRITICAL |
| 12 | **No Change Password UI** | Feature never implemented | ✅ Fixed (added to Settings) | MEDIUM |
| 13 | **Tauri DevTools disabled** | Not in tauri.conf.json | ✅ Fixed (enabled) | LOW |
| 14 | **No `supabase stop --backup`** | Never implemented despite being in plan | ❌ Still missing | CRITICAL |
| 15 | **auth.users not in shadow backup** | Script only backed up tasks/groups | ✅ Fixed (added) | HIGH |

---

## Timeline of Events

| Date/Time | Event |
|-----------|-------|
| **Jan 9, 2026** | `shadow-mirror.cjs` script committed to repo |
| **Jan 12, 2026** | Shadow-mirror updated in commit cc515ba |
| **Jan 15, 2026 23:16** | Last known good backup: `RECOVERY-2026-01-15T23-16-49-145Z.json` (50 tasks, 17 groups, 3 projects) |
| **Jan 15-19** | **DATA LOSS EVENT** - Unknown cause wiped database |
| **Jan 19, 2026 17:39** | TASK-317 implemented - seed.sql created with ONLY dev user |
| **Jan 19, 2026 19:39** | `shadow.db` file CREATED (Birth timestamp) - first time shadow-mirror actually ran |
| **Jan 19, 2026 19:40** | First shadow snapshot: only 5 items (database already corrupted) |
| **Jan 19-20 overnight** | Supabase restarted, auth.users table wiped |
| **Jan 20, 2026 morning** | User discovers they cannot login |

---

## Root Causes Identified

### 1. Shadow-Mirror Never Actually Ran Before Jan 19

**Evidence:**
- `shadow.db` Birth timestamp: `2026-01-19 19:39:34`
- No npm script to run shadow-mirror automatically
- Script existed in repo since Jan 9 but was never executed

**Impact:** No backups existed between Jan 9-19

### 2. seed.sql Did Not Include Production User

**Evidence:**
```sql
-- seed.sql only contained:
-- dev@flowstate.local (UUID: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11)
--
-- MISSING:
-- endlessblink@gmail.com (UUID: 717f5209-42d8-4bb9-8781-740107a384e5)
```

**Impact:** When Supabase restarted, only dev user was recreated

### 3. No Automatic Backup on Supabase Stop

**Evidence:**
- `supabase stop --backup` was discussed in TASK-317 plan but never implemented
- No shutdown hook exists

**Impact:** No automatic protection against Supabase restarts

### 4. auth.users Not Included in Shadow Backup

**Evidence:**
- Shadow-mirror only backed up: tasks, groups, projects
- Missing: auth.users, user_settings, timer_sessions, notifications

**Impact:** Even if shadow worked, user accounts would not be recoverable

### 5. TASK-317 Marked Complete Without Verification

**Evidence:**
- Plan stated "✅ COMPLETE"
- User never tested that backup/restore actually worked
- Violated CLAUDE.md rule: "NEVER CLAIM SUCCESS UNTIL USER CONFIRMS"

---

## Data State Analysis

### Available Backups

| Backup | Date | Contents | User ID |
|--------|------|----------|---------|
| `RECOVERY-2026-01-15T23-16-49-145Z.json` | Jan 15 | 50 tasks, 17 groups, 3 projects | `717f5209-42d8-4bb9-8781-740107a384e5` |
| `shadow.db` snapshots | Jan 19-20 | 2-5 items only | `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11` (dev user) |

### Database Current State (Jan 20 morning)

```
auth.users:
  - dev@flowstate.local (seeded)
  - endlessblink@gmail.com (recreated with ORIGINAL UUID)

tasks: 44 (restored from Jan 15 + some test data)
groups: 7 (restored from Jan 15 + some test data)
projects: 3 (restored from Jan 15)
```

---

## Fixes Applied During This Session

### 1. User Account Recreated with Original UUID
```sql
-- Preserves FK relationships with existing data
INSERT INTO auth.users (id, email, ...)
VALUES ('717f5209-42d8-4bb9-8781-740107a384e5', 'endlessblink@gmail.com', ...);
```

### 2. seed.sql Updated
- Added `endlessblink@gmail.com` with stable UUID
- Now survives Supabase restarts
- Password: `<redacted>`

### 3. shadow-mirror.cjs Enhanced
- Added auth.users backup via Docker SQL query
- Added user_settings backup
- Added timer_sessions backup
- Fixed service role key detection (was checking raw JWT string instead of decoded payload)

### 4. Data Restored from Jan 15 Backup
- 42 active tasks restored
- 5 active groups restored
- 3 projects restored

### 5. Fixed auth.users NULL Column Bug
```sql
-- GoTrue can't handle NULL in these columns, expects empty strings
UPDATE auth.users SET
  email_change = '',
  email_change_token_new = '',
  email_change_token_current = '',
  phone_change = '',
  phone_change_token = '',
  reauthentication_token = ''
WHERE email = 'endlessblink@gmail.com';
```

### 6. Extracted User's Current 53 Tasks from Tauri localStorage
- Location: `~/.local/share/com.flowstate.app/localstorage/tauri_localhost_0.localstorage`
- Encoding: UTF-16-LE (not UTF-8)
- Backup saved to: `~/Desktop/flowstate-FULL-backup-2026-01-20.json`

### 7. Added Change Password Feature to Settings UI
- File: `src/components/settings/tabs/AccountSettingsTab.vue`
- Uses `supabase.auth.updateUser()` API

### 8. Enabled DevTools in Tauri
- File: `src-tauri/tauri.conf.json`
- Added `"devtools": true` to security config

---

## Still Missing / Not Implemented

| Item | Status | Priority |
|------|--------|----------|
| Automatic `supabase stop --backup` on shutdown | ❌ NOT DONE | CRITICAL |
| npm script to run shadow-mirror periodically | ❌ NOT DONE | HIGH |
| Integration of shadow-mirror with `npm run dev` | ❌ NOT DONE | HIGH |
| Golden backup rotation (keep last N good backups) | ❌ NOT DONE | MEDIUM |
| Backup verification tests | ❌ NOT DONE | HIGH |

---

## User's Original UUID (CRITICAL - DO NOT LOSE)

```
User: endlessblink@gmail.com
UUID: 717f5209-42d8-4bb9-8781-740107a384e5
```

This UUID must be preserved for FK relationships with all user data.

---

## Recovery Commands Reference

### Recreate User Account
```sql
-- Run in Supabase SQL editor or via psql
INSERT INTO auth.users (id, email, encrypted_password, ...)
VALUES ('717f5209-42d8-4bb9-8781-740107a384e5', 'endlessblink@gmail.com',
        crypt('PASSWORD_HERE', gen_salt('bf')), ...);

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, ...)
VALUES ('717f5209-42d8-4bb9-8781-740107a384e5', ...);
```

### Restore from Jan 15 Backup
```bash
node scripts/restore-recovery.cjs
```

### Run Shadow Mirror Manually
```bash
node scripts/shadow-mirror.cjs
```

### Check Database State
```bash
docker exec supabase_db_flow-state psql -U postgres -d postgres -c "
SELECT 'users' as table, count(*) FROM auth.users
UNION ALL SELECT 'tasks', count(*) FROM tasks
UNION ALL SELECT 'groups', count(*) FROM groups
UNION ALL SELECT 'projects', count(*) FROM projects;"
```

---

## Lessons Learned

1. **Never mark backup systems as "complete" without user testing actual restore**
2. **Scripts that exist in repo but aren't in npm scripts don't run**
3. **seed.sql must include ALL production users, not just dev users**
4. **auth.users is special - standard backups don't capture it**
5. **Shadow backups are useless if they start AFTER data loss**

---

## Action Items for Full Resolution

- [ ] User to verify login works with restored account
- [ ] User to verify Jan 15 data is acceptable (or find newer backup)
- [ ] Implement automatic shadow-mirror in `npm run dev`
- [ ] Implement `supabase stop --backup` hook
- [ ] Create backup verification test suite
- [ ] Set up external backup (not just local)

---

## Files Modified in This Session

| File | Change |
|------|--------|
| `supabase/seed.sql` | Added endlessblink@gmail.com user with password `<redacted>` |
| `scripts/shadow-mirror.cjs` | Added auth.users, user_settings, timer_sessions backup |
| `scripts/shadow-mirror.cjs` | Fixed IS_SERVICE_ROLE detection |
| `scripts/restore-recovery.cjs` | Created for Jan 15 backup restore |
| `src/components/settings/tabs/AccountSettingsTab.vue` | Added Change Password feature |
| `src-tauri/tauri.conf.json` | Enabled DevTools (`"devtools": true`) |

## Backups Created

| File | Location | Contents |
|------|----------|----------|
| `flowstate-guest-tasks-backup.json` | `~/Desktop/` | 53 tasks from localStorage |
| `flowstate-FULL-backup-2026-01-20.json` | `~/Desktop/` | Full localStorage (tasks + history + golden backup) |

---

*Document created: 2026-01-20 ~10:00*
*Last updated: 2026-01-20 ~11:30*
*Purpose: Preserve crisis context across session compaction*
