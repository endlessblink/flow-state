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
q_checked() {
  local output
  if ! output=$(docker exec "$DB_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -t -A -c "$1" 2>&1); then
    return 1
  fi
  printf '%s' "$output" | tr -d '[:space:]'
}

ANOMALIES=()

# (0) BUG-1941 observability: lifecycle audit schema and triggers must exist.
# Without this immutable server evidence, the watchdog can detect malformed rows
# but cannot distinguish an attempted lifecycle action from no action at all.
if ! audit_table=$(q_checked "SELECT COALESCE(to_regclass('public.task_audit_log')::text,'')"); then
  ANOMALIES+=("task-audit-query-failed=schema")
  audit_ready=false
elif [ -z "${audit_table:-}" ]; then
  ANOMALIES+=("task-audit-log-missing")
  audit_ready=false
else
  if ! audit_triggers=$(q_checked "SELECT count(*) FROM pg_trigger WHERE tgrelid='public.tasks'::regclass AND tgname IN ('trg_task_audit_log_iu','trg_task_audit_log_d') AND NOT tgisinternal AND tgenabled<>'D' AND tgfoid='public.fn_task_audit_log()'::regprocedure"); then
    ANOMALIES+=("task-audit-query-failed=triggers")
    audit_ready=false
  elif [ "${audit_triggers:-0}" != "2" ]; then
    ANOMALIES+=("task-audit-triggers-missing=${audit_triggers:-0}/2")
    audit_ready=false
  else
    audit_ready=true
  fi
fi

if [ "$audit_ready" = true ]; then
  # Latest delete/restore intent must agree with both the task row and the
  # anti-resurrection tombstone. Only counts are emitted; task content stays private.
  if ! lifecycle_mismatches=$(q_checked "WITH latest AS (
    SELECT DISTINCT ON (task_id) task_id,user_id,event_type,id
    FROM task_audit_log
    WHERE user_id='$MAIN_USER_ID'
      AND event_at > now()-interval '24 hours'
      AND event_type IN ('SOFT_DELETED','HARD_DELETED','RESTORED')
    ORDER BY task_id,event_at DESC,id DESC
  )
  SELECT count(*) FROM latest
  LEFT JOIN tasks t ON t.id::text=latest.task_id AND t.user_id=latest.user_id
  LEFT JOIN tombstones ts ON ts.entity_type='task' AND ts.entity_id::text=latest.task_id AND ts.user_id=latest.user_id
  WHERE (latest.event_type='SOFT_DELETED' AND (t.id IS NULL OR t.is_deleted=false OR ts.entity_id IS NULL))
     OR (latest.event_type='HARD_DELETED' AND (t.id IS NOT NULL OR ts.entity_id IS NULL))
     OR (latest.event_type='RESTORED' AND (t.id IS NULL OR t.is_deleted=true OR ts.entity_id IS NOT NULL))"); then
    ANOMALIES+=("task-audit-query-failed=lifecycle-state")
  elif [ "${lifecycle_mismatches:-0}" != "0" ]; then
    ANOMALIES+=("lifecycle-audit-state-mismatches-24h=$lifecycle_mismatches")
  fi

  # The newest lifecycle event being STATUS_CHANGED means the live row must
  # still carry that audited status. A later delete/restore event supersedes it.
  if ! status_mismatches=$(q_checked "WITH latest AS (
    SELECT DISTINCT ON (task_id) task_id,user_id,event_type,status,id
    FROM task_audit_log
    WHERE user_id='$MAIN_USER_ID' AND event_at > now()-interval '24 hours'
    ORDER BY task_id,event_at DESC,id DESC
  )
  SELECT count(*) FROM latest
  LEFT JOIN tasks t ON t.id::text=latest.task_id AND t.user_id=latest.user_id
  WHERE latest.event_type='STATUS_CHANGED'
    AND (t.id IS NULL OR t.status IS DISTINCT FROM latest.status)"); then
    ANOMALIES+=("task-audit-query-failed=status-state")
  elif [ "${status_mismatches:-0}" != "0" ]; then
    ANOMALIES+=("status-audit-state-mismatches-24h=$status_mismatches")
  fi
fi

# (0b) TASK-1949 canonical assistant authority. These probes are read-only and
# emit only stable labels and counts; no task or Notion content leaves the VPS.
if ! canonical_authority=$(q_checked "SELECT
  ((to_regclass('public.canonical_operations') IS NOT NULL)::int
   + (to_regclass('public.canonical_operation_previews') IS NOT NULL)::int
   + (to_regclass('public.canonical_change_log') IS NOT NULL)::int)::text
  || '/'
  || ((to_regprocedure('public.flowstate_patch_task_v1(text,text,text,text,bigint,jsonb,boolean,text,timestamptz,uuid)') IS NOT NULL)::int
   + (to_regprocedure('public.flowstate_activate_notion_task_v1(text,jsonb,jsonb,jsonb,boolean,text,timestamptz)') IS NOT NULL)::int)::text"); then
  ANOMALIES+=("canonical-schema-query-failed=authority")
  canonical_ready=false
elif [ "${canonical_authority:-0/0}" != "3/2" ]; then
  ANOMALIES+=("canonical-authority-missing=${canonical_authority:-0/0}")
  canonical_ready=false
else
  canonical_ready=true
fi

if [ "$canonical_ready" = true ]; then
  if ! canonical_triggers=$(q_checked "SELECT count(*) FROM pg_trigger
    WHERE tgrelid='public.tasks'::regclass
      AND tgname IN ('flowstate_task_canonical_revision','flowstate_task_canonical_change','guard_task_external_provenance_v1')
      AND NOT tgisinternal AND tgenabled<>'D'"); then
    ANOMALIES+=("canonical-schema-query-failed=triggers")
  elif [ "${canonical_triggers:-0}" != "3" ]; then
    ANOMALIES+=("canonical-triggers-missing=${canonical_triggers:-0}/3")
  fi

  if ! notion_index=$(q_checked "SELECT count(*) FROM pg_index AS index
    WHERE index.indexrelid=to_regclass('public.tasks_active_external_identity_uidx')
      AND index.indisvalid AND index.indisready AND index.indisunique"); then
    ANOMALIES+=("canonical-schema-query-failed=notion-index")
  elif [ "${notion_index:-0}" != "1" ]; then
    ANOMALIES+=("canonical-notion-index-missing")
  fi

  if ! stale_applying=$(q_checked "SELECT count(*) FROM public.canonical_operations
    WHERE user_id='$MAIN_USER_ID' AND state='applying'
      AND updated_at < now()-interval '15 minutes'"); then
    ANOMALIES+=("canonical-query-failed=stale-applying")
  elif [ "${stale_applying:-0}" != "0" ]; then
    ANOMALIES+=("canonical-stale-applying=$stale_applying")
  fi

  if ! incomplete_committed=$(q_checked "SELECT count(*) FROM public.canonical_operations
    WHERE user_id='$MAIN_USER_ID' AND state='committed'
      AND (canonical_result IS NULL OR canonical_revision IS NULL
        OR change_sequence IS NULL OR committed_at IS NULL
        OR nullif(canonical_result->>'operationId','') IS NULL
        OR nullif(canonical_result->>'readBackHash','') IS NULL)"); then
    ANOMALIES+=("canonical-query-failed=incomplete-committed")
  elif [ "${incomplete_committed:-0}" != "0" ]; then
    ANOMALIES+=("canonical-incomplete-committed=$incomplete_committed")
  fi

  if ! revision_mismatches=$(q_checked "WITH latest AS (
    SELECT DISTINCT ON (entity_id) entity_id,canonical_revision
    FROM public.canonical_change_log
    WHERE user_id='$MAIN_USER_ID' AND entity_type='task'
    ORDER BY entity_id,change_sequence DESC
  )
  SELECT count(*) FROM public.tasks AS task
  JOIN latest ON latest.entity_id=task.id::text
  WHERE task.user_id='$MAIN_USER_ID' AND task.is_deleted=false
    AND latest.canonical_revision IS DISTINCT FROM task.canonical_revision"); then
    ANOMALIES+=("canonical-query-failed=task-change-revision")
  elif [ "${revision_mismatches:-0}" != "0" ]; then
    ANOMALIES+=("canonical-task-change-revision-mismatches=$revision_mismatches")
  fi

  if ! malformed_notion=$(q_checked "SELECT count(*) FROM public.tasks AS task
    WHERE task.user_id='$MAIN_USER_ID' AND task.is_deleted=false
      AND ((task.external_source='notion'
          AND (task.external_id IS NULL OR task.external_url IS NULL
            OR task.external_data_source_id IS NULL OR task.external_last_edited_at IS NULL))
        OR (task.external_source IS NULL
          AND (task.external_id IS NOT NULL OR task.external_url IS NOT NULL
            OR task.external_data_source_id IS NOT NULL
            OR task.external_last_edited_at IS NOT NULL)))"); then
    ANOMALIES+=("canonical-query-failed=notion-provenance")
  elif [ "${malformed_notion:-0}" != "0" ]; then
    ANOMALIES+=("canonical-notion-provenance-malformed=$malformed_notion")
  fi

  if ! missing_notion_evidence=$(q_checked "SELECT count(*)
    FROM public.canonical_operations AS operation
    LEFT JOIN public.tasks AS task
      ON task.user_id=operation.user_id AND task.id::text=operation.entity_id
    LEFT JOIN public.canonical_change_log AS change
      ON change.user_id=operation.user_id
      AND change.operation_id=operation.operation_id
      AND change.change_sequence=operation.change_sequence
    WHERE operation.user_id='$MAIN_USER_ID'
      AND operation.state='committed'
      AND operation.contract_version='notion-activation-v1'
      AND operation.source='notion' AND operation.action='activate'
      AND (change.id IS NULL
        OR change.canonical_revision IS DISTINCT FROM operation.canonical_revision
        OR (task.id IS NULL AND NOT EXISTS (
          SELECT 1 FROM public.canonical_change_log AS later
          WHERE later.user_id=operation.user_id
            AND later.entity_type='task' AND later.entity_id=operation.entity_id
            AND later.action='deleted'
            AND later.change_sequence > operation.change_sequence
        )))"); then
    ANOMALIES+=("canonical-query-failed=notion-evidence")
  elif [ "${missing_notion_evidence:-0}" != "0" ]; then
    ANOMALIES+=("canonical-notion-commit-evidence-missing=$missing_notion_evidence")
  fi
fi

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

# (d3) Approval-gated domain actions must leave durable receipts that still
# agree with task truth. This catches partial or later-corrupted recurring
# completion and merge results without emitting task titles or receipt bodies.
if ! receipt_table=$(q_checked "SELECT COALESCE(to_regclass('public.flowstate_action_receipts')::text,'')"); then
  ANOMALIES+=("action-receipt-query-failed=schema")
elif [ -n "${receipt_table:-}" ]; then
  if ! broken_done_for_now=$(q_checked "SELECT count(*)
    FROM flowstate_action_receipts r
    LEFT JOIN tasks completed ON completed.id::text=r.receipt#>>'{completedOccurrence,id}'
      AND completed.user_id=r.user_id
    LEFT JOIN tasks living ON living.id::text=r.receipt->>'taskId'
      AND living.user_id=r.user_id
    WHERE r.user_id='$MAIN_USER_ID'
      AND r.operation='done_for_now'
      AND r.created_at > now()-interval '24 hours'
      AND (completed.id IS NULL OR completed.status<>'done'
        OR completed.completed_at IS NULL OR completed.is_deleted=true
        OR living.id IS NULL OR living.is_deleted=true OR living.status='done'
        OR living.due_date::text IS DISTINCT FROM r.receipt#>>'{nextOccurrence,dueDate}')"); then
    ANOMALIES+=("action-receipt-query-failed=done-for-now")
  elif [ "${broken_done_for_now:-0}" != "0" ]; then
    ANOMALIES+=("done-for-now-broken-receipts=$broken_done_for_now")
  fi

  if ! broken_merges=$(q_checked "SELECT count(*)
    FROM flowstate_action_receipts r
    LEFT JOIN tasks survivor ON survivor.id::text=r.receipt#>>'{survivor,id}'
      AND survivor.user_id=r.user_id
    LEFT JOIN tasks duplicate ON duplicate.id::text=r.receipt#>>'{duplicate,id}'
      AND duplicate.user_id=r.user_id
    WHERE r.user_id='$MAIN_USER_ID'
      AND r.operation='merge_tasks'
      AND r.created_at > now()-interval '24 hours'
      AND (survivor.id IS NULL OR survivor.is_deleted=true
        OR duplicate.id IS NULL OR duplicate.is_deleted=false OR duplicate.deleted_at IS NULL)"); then
    ANOMALIES+=("action-receipt-query-failed=task-merge")
  elif [ "${broken_merges:-0}" != "0" ]; then
    ANOMALIES+=("task-merge-broken-receipts=$broken_merges")
  fi
fi

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
