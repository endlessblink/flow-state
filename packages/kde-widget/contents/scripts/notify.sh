#!/bin/bash
# BUG-1112: Timer completion notification with FUNCTIONAL buttons
# Buttons trigger Supabase API calls to start next session

TITLE="$1"
BODY="$2"
BTN1="$3"
BTN2="$4"
IS_WORK="$5"           # "true" if work session completed
SUPABASE_URL="$6"      # e.g., http://127.0.0.1:54321
SUPABASE_KEY="$7"      # anon key
ACCESS_TOKEN="$8"      # user's access token
USER_ID="$9"           # user's ID
WORK_DURATION="${10}"  # work duration in seconds
BREAK_DURATION="${11}" # break duration in seconds

# Play high-quality bell sound (single play)
paplay /usr/share/sounds/freedesktop/stereo/bell.oga 2>/dev/null &

# Add emoji icons to match app design
if [ "$IS_WORK" = "true" ]; then
    ICON_BTN1="☕"
    ICON_BTN2="⏰"
    TITLE="🍅 $TITLE"
else
    ICON_BTN1="🍅"
    ICON_BTN2="⏰"
    TITLE="☕ $TITLE"
fi

# BUG-1292: Log file for debugging session creation failures
LOGFILE="/tmp/pomoflow-notify.log"

# Function to create a new timer session via Supabase
# Retries up to 2 times with 1s delay on failure
create_session() {
    local is_break="$1"
    local duration="$2"
    local session_id=$(uuidgen)
    local start_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local max_retries=2
    local attempt=0

    while [ $attempt -le $max_retries ]; do
        local http_code
        http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${SUPABASE_URL}/rest/v1/timer_sessions" \
            -H "apikey: ${SUPABASE_KEY}" \
            -H "Authorization: Bearer ${ACCESS_TOKEN}" \
            -H "Content-Type: application/json" \
            -H "Prefer: return=minimal" \
            -d "{
                \"id\": \"${session_id}\",
                \"user_id\": \"${USER_ID}\",
                \"task_id\": \"general\",
                \"start_time\": \"${start_time}\",
                \"duration\": ${duration},
                \"remaining_time\": ${duration},
                \"is_active\": true,
                \"is_paused\": false,
                \"is_break\": ${is_break},
                \"device_leader_id\": \"kde-widget\",
                \"device_leader_last_seen\": \"${start_time}\"
            }" 2>/dev/null)

        echo "[$(date '+%H:%M:%S')] create_session: is_break=${is_break} duration=${duration} attempt=$((attempt+1)) status=${http_code}" >> "$LOGFILE"

        if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
            echo "[$(date '+%H:%M:%S')] Session created successfully: ${session_id}" >> "$LOGFILE"
            return 0
        fi

        attempt=$((attempt + 1))
        if [ $attempt -le $max_retries ]; then
            echo "[$(date '+%H:%M:%S')] Retrying in 1s..." >> "$LOGFILE"
            sleep 1
            # Regenerate IDs for retry to avoid conflicts
            session_id=$(uuidgen)
            start_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        fi
    done

    echo "[$(date '+%H:%M:%S')] FAILED to create session after $((max_retries+1)) attempts" >> "$LOGFILE"
    return 1
}

# BUG-1462: Kill any previous notify-send still waiting for user action
pkill -f 'notify-send.*FlowState' 2>/dev/null || true

# Show notification and handle button clicks in background
(
    # notify-send --action blocks until user clicks, returns action name
    ACTION=$(notify-send -u critical -i chronometer -a "FlowState" \
        --action="action1=$ICON_BTN1 $BTN1" \
        --action="action2=$ICON_BTN2 $BTN2" \
        "$TITLE" "$BODY" 2>/dev/null)

    case "$ACTION" in
        "action1")
            # Start Break or Work depending on context
            if [ "$IS_WORK" = "true" ]; then
                create_session "true" "$BREAK_DURATION"
            else
                create_session "false" "$WORK_DURATION"
            fi
            ;;
        "action2")
            # +5 min - continue same type
            if [ "$IS_WORK" = "true" ]; then
                create_session "false" "300"
            else
                create_session "true" "300"
            fi
            ;;
    esac
) &

exit 0
