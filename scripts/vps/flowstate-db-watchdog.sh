#!/usr/bin/env bash
# TASK-1914: FlowState production DB watchdog.
# Runs on the VPS via cron (every 15 min). READ-ONLY: detects data-integrity
# anomalies and silent write-drop windows (BUG-1913 class) and alerts via
# ntfy.sh (counts only — no task content) + /var/log/flowstate-watchdog.log.
#
# Install (from repo root):
#   scp scripts/vps/flowstate-db-watchdog.sh root@$VPS_HOST:/root/scripts/
#   ssh root@$VPS_HOST 'chmod +x /root/scripts/flowstate-db-watchdog.sh'
#   cron: */15 * * * * /root/scripts/flowstate-db-watchdog.sh >> /var/log/flowstate-watchdog.log 2>&1
set -u

DB_CONTAINER="supabase-db"
MAIN_USER_ID="717f5209-42d8-4bb9-8781-740107a384e5"
NTFY_TOPIC="${FLOWSTATE_NTFY_TOPIC:-flowstate-watchdog-eb7k2}"
UPDATER_URL="https://in-theflow.com/updates/electron/latest-linux.yml"
STATE_FILE="/var/tmp/flowstate-watchdog.state"
REALERT_SECONDS=$((4 * 3600))

q() { docker exec "$DB_CONTAINER" psql -U postgres -t -A -c "$1" 2>/dev/null | tr -d '[:space:]'; }

ANOMALIES=()

# (a) BUG-1891 asymmetry: soft-deleted tasks (last 24h) missing a tombstone
missing_ts=$(q "SELECT count(*) FROM tasks t WHERE t.is_deleted=true AND t.deleted_at > now()-interval '24 hours'
  AND NOT EXISTS (SELECT 1 FROM tombstones ts WHERE ts.entity_type='task' AND ts.entity_id::text=t.id::text)")
[ "${missing_ts:-0}" != "0" ] && ANOMALIES+=("soft-deletes-missing-tombstone=$missing_ts")

# (b) True resurrection: alive rows that carry a tombstone
alive_ts=$(q "SELECT count(*) FROM tasks t JOIN tombstones ts ON ts.entity_type='task' AND ts.entity_id::text=t.id::text WHERE t.is_deleted=false")
[ "${alive_ts:-0}" != "0" ] && ANOMALIES+=("alive-with-tombstone=$alive_ts")

# (c) Undelete flips: is_deleted cleared but deleted_at left behind
flips=$(q "SELECT count(*) FROM tasks WHERE is_deleted=false AND deleted_at IS NOT NULL AND updated_at > now()-interval '24 hours'")
[ "${flips:-0}" != "0" ] && ANOMALIES+=("undelete-flips-24h=$flips")

# (d) BUG-1913 write-gap: app demonstrably alive but no task writes for >90min —
#     the silent write-drop signature. Liveness = timer heartbeat OR auth token
#     activity (timer-only keying missed the 2026-07-03 window: timer was off).
# 2026-07-05 tuning: token activity alone is ambient (KDE widget refreshes 24/7)
# and produced 129 alerts over an idle day; a zombie timer row (BUG-1919) also
# kept the timer signal warm. Two tiers now:
#  - STRONG (alert): active NON-expired-looking timer session heart-beaten <10min
#    AND remaining_time > 0 (a zombie stuck at 0 is BUG-1919's own signature,
#    reported separately below).
#  - WEAK (log-only WARN): token activity with a very large gap. No push.
hb_strong=$(q "SELECT count(*) FROM timer_sessions WHERE user_id='$MAIN_USER_ID' AND is_active=true AND remaining_time > 0 AND updated_at > now()-interval '10 minutes'")
hb_weak=$(q "SELECT count(*) FROM auth.refresh_tokens WHERE user_id::text='$MAIN_USER_ID' AND updated_at > now()-interval '30 minutes'")
last_write_age_min=$(q "SELECT COALESCE(floor(extract(epoch FROM (now()-max(updated_at)))/60)::int, 99999) FROM tasks WHERE user_id='$MAIN_USER_ID'")
if [ "${hb_strong:-0}" != "0" ] && [ "${last_write_age_min:-0}" -gt 90 ]; then
  ANOMALIES+=("write-gap: active-timer but last task write ${last_write_age_min}min ago")
elif [ "${hb_weak:-0}" != "0" ] && [ "${last_write_age_min:-0}" -gt 360 ]; then
  echo "$(date -u +%FT%TZ) WARN weak-liveness write-gap ${last_write_age_min}min (log-only)"
fi

# (d2) BUG-1919 signature: an active session heart-beaten while remaining_time=0
# for >15min = a zombie the client failed to complete
zombies=$(q "SELECT count(*) FROM timer_sessions WHERE user_id='$MAIN_USER_ID' AND is_active=true AND remaining_time=0 AND completed_at IS NULL AND updated_at > now()-interval '10 minutes' AND created_at < now()-interval '15 minutes'")
[ "${zombies:-0}" != "0" ] && ANOMALIES+=("zombie-timer-sessions=$zombies (active, 0 remaining, still heart-beaten — BUG-1919 class)")

# (e) Updater manifest health
manifest_version=$(curl -sS --max-time 15 "$UPDATER_URL" | grep -m1 '^version:' | awk '{print $2}')
[ -z "${manifest_version:-}" ] && ANOMALIES+=("updater-manifest-unreachable-or-unparseable")

ts="$(date -u +%FT%TZ)"
if [ ${#ANOMALIES[@]} -eq 0 ]; then
  echo "$ts OK manifest=${manifest_version:-?} last_write_age_min=${last_write_age_min:-?}"
  rm -f "$STATE_FILE"
  exit 0
fi

msg="FlowState watchdog: ${ANOMALIES[*]}"
echo "$ts ALERT $msg"

# Dedup: alert on new fingerprint, re-alert every 4h while it persists
fingerprint=$(printf '%s' "${ANOMALIES[*]}" | md5sum | awk '{print $1}')
now_epoch=$(date +%s)
last_fp=""; last_epoch=0
[ -f "$STATE_FILE" ] && read -r last_fp last_epoch < "$STATE_FILE"
if [ "$fingerprint" != "$last_fp" ] || [ $((now_epoch - ${last_epoch:-0})) -ge $REALERT_SECONDS ]; then
  curl -sS --max-time 15 -H "Title: FlowState watchdog" -H "Priority: high" -H "Tags: warning" \
    -d "$msg" "https://ntfy.sh/$NTFY_TOPIC" >/dev/null 2>&1
  echo "$fingerprint $now_epoch" > "$STATE_FILE"
fi
