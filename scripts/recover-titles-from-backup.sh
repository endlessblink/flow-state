#!/usr/bin/env bash
# BUG-1777: Recover original titles for 7 tasks whose titles were relabeled
# to "Untitled Task" by the v1.3.70 load-time repair on 2026-04-21 22:54 UTC.
#
# Strategy:
#   1. Pull a pg_dump backup from BEFORE the corruption timestamp.
#   2. Restore into a TEMPORARY database on the VPS Postgres container.
#      (Non-destructive — production `postgres` DB is untouched.)
#   3. SELECT the 7 task titles from the temp DB.
#   4. Emit a ready-to-run UPDATE script with the recovered titles.
#   5. Drop the temp DB.
#
# Run from your local machine (has the SSH key):
#   bash scripts/recover-titles-from-backup.sh
#
# Requires: SSH access to VPS root@84.46.253.137, rclone configured with gdrive: remote.

set -euo pipefail

VPS="root@84.46.253.137"
SSH_KEY="$HOME/.ssh/id_ed25519"
PGCONTAINER_CMD='docker ps --format "{{.Names}}" | grep -E "supabase.*db|postgres" | head -1'
CORRUPTION_CUTOFF="2026-04-21 22:54:00"  # any backup older than this is safe

# The 7 task IDs from VPS query (update if the list ever changes).
TASK_IDS=(
  690d1743-ea6b-4ac1-b31c-8975b44ec6c4
  18aa9b99-1619-47bb-b1f8-8083bf733ca9
  1973b557-c267-4dd3-8b2a-307f902b0aed
  915c1e7e-4576-4b9d-a242-72dc2abfc64c
  a79d15b6-671d-4b53-aa0e-909ad8e2d41c
  8f511a58-f5e1-4673-89a4-e55613b18a93
  7009f622-e45f-428e-be41-f0e0900ee549
)

TASK_IDS_SQL=$(printf "'%s'," "${TASK_IDS[@]}" | sed 's/,$//')

echo "=== Step 1: Locate the most recent pre-corruption backup ==="
echo "Cutoff: older than $CORRUPTION_CUTOFF UTC"
echo
echo "Checking local cache on VPS (/var/backups/supabase/daily/):"
ssh -i "$SSH_KEY" "$VPS" "ls -la /var/backups/supabase/daily/ 2>/dev/null | grep -E 'flowstate_[0-9]+' | sort"
echo
echo "Checking Google Drive (last 30 on gdrive:flowstate-backups/):"
ssh -i "$SSH_KEY" "$VPS" "rclone ls gdrive:flowstate-backups/ 2>/dev/null | sort -k 2 | tail -30"
echo

read -r -p "Paste the exact backup filename you want to use (e.g. flowstate_20260421_223001.sql.gz): " BACKUP_NAME
if [[ -z "$BACKUP_NAME" ]]; then
  echo "No backup filename provided. Aborting."
  exit 1
fi

echo
echo "=== Step 2: Download the backup to /tmp on VPS (if not already local) ==="
ssh -i "$SSH_KEY" "$VPS" "
  if [[ -f /var/backups/supabase/daily/$BACKUP_NAME ]]; then
    cp /var/backups/supabase/daily/$BACKUP_NAME /tmp/bug1777-recovery.sql.gz
    echo 'Copied from local cache.'
  else
    rclone copy 'gdrive:flowstate-backups/$BACKUP_NAME' /tmp/ && \
    mv /tmp/$BACKUP_NAME /tmp/bug1777-recovery.sql.gz
    echo 'Downloaded from Google Drive.'
  fi
  ls -la /tmp/bug1777-recovery.sql.gz
"

echo
echo "=== Step 3: Create temp DB, restore backup into it, query titles ==="
ssh -i "$SSH_KEY" "$VPS" "
  PGCONTAINER=\$($PGCONTAINER_CMD)
  echo \"Using Postgres container: \$PGCONTAINER\"

  # Clean slate
  docker exec \$PGCONTAINER psql -U postgres -c 'DROP DATABASE IF EXISTS bug1777_recovery;' >/dev/null
  docker exec \$PGCONTAINER psql -U postgres -c 'CREATE DATABASE bug1777_recovery;' >/dev/null

  # Restore (errors on duplicate role creation etc. are expected & benign)
  echo 'Restoring backup into bug1777_recovery DB (this takes 30-90s, ignore NOTICE/ERROR on role/extension creation)...'
  zcat /tmp/bug1777-recovery.sql.gz | docker exec -i \$PGCONTAINER psql -U postgres -d bug1777_recovery >/dev/null 2>&1 || true

  echo
  echo '=== Recovered titles (from pre-corruption backup) ==='
  docker exec \$PGCONTAINER psql -U postgres -d bug1777_recovery -c \"
    SELECT id, title, updated_at
    FROM tasks
    WHERE id IN ($TASK_IDS_SQL)
    ORDER BY id;
  \"
"

echo
echo "=== Step 4: Review the output above ==="
echo "If the titles look correct, next command will UPDATE production with them."
echo "If any title is still 'Untitled Task' or blank, that backup is ALSO post-corruption — pick an older one."
echo
read -r -p "Type YES to generate the UPDATE SQL (does NOT run it yet): " CONFIRM
if [[ "$CONFIRM" != "YES" ]]; then
  echo "Skipping UPDATE generation. To clean up temp DB run:"
  echo "  ssh -i $SSH_KEY $VPS \"docker exec \\\$($PGCONTAINER_CMD) psql -U postgres -c 'DROP DATABASE bug1777_recovery;'\""
  exit 0
fi

echo
echo "=== Step 5: Generating UPDATE SQL from recovered titles ==="
ssh -i "$SSH_KEY" "$VPS" "
  PGCONTAINER=\$($PGCONTAINER_CMD)
  docker exec \$PGCONTAINER psql -U postgres -d bug1777_recovery -t -A -F'|' -c \"
    SELECT id, title FROM tasks WHERE id IN ($TASK_IDS_SQL);
  \"
" | while IFS='|' read -r id recovered; do
  if [[ -n "$recovered" && "$recovered" != "Untitled Task" ]]; then
    # Escape single quotes inside the title
    safe_title=${recovered//\'/\'\'}
    echo "UPDATE tasks SET title = '$safe_title', updated_at = now() WHERE id = '$id' AND title = 'Untitled Task';"
  else
    echo "-- SKIP $id: recovered value is empty/Untitled — no good title in this backup"
  fi
done | tee /tmp/bug1777-recovery.sql

echo
echo "SQL written to /tmp/bug1777-recovery.sql on local machine."
echo
read -r -p "Type APPLY to run these UPDATEs on production now: " APPLY
if [[ "$APPLY" != "APPLY" ]]; then
  echo "Skipping apply. Temp DB still present on VPS. To apply later:"
  echo "  ssh -i $SSH_KEY $VPS 'docker exec -i \$($PGCONTAINER_CMD) psql -U postgres -d postgres' < /tmp/bug1777-recovery.sql"
  echo "To clean up temp DB:"
  echo "  ssh -i $SSH_KEY $VPS \"docker exec \\\$($PGCONTAINER_CMD) psql -U postgres -c 'DROP DATABASE bug1777_recovery;'\""
  exit 0
fi

echo
echo "=== Step 6: Applying UPDATEs to production ==="
ssh -i "$SSH_KEY" "$VPS" "docker exec -i \$($PGCONTAINER_CMD) psql -U postgres -d postgres" < /tmp/bug1777-recovery.sql

echo
echo "=== Step 7: Cleanup ==="
ssh -i "$SSH_KEY" "$VPS" "docker exec \$($PGCONTAINER_CMD) psql -U postgres -c 'DROP DATABASE bug1777_recovery;' >/dev/null && rm /tmp/bug1777-recovery.sql.gz"
echo "Temp DB dropped. Backup file removed from VPS /tmp."
echo
echo "Done. Realtime should push the restored titles to your Electron app within seconds."
