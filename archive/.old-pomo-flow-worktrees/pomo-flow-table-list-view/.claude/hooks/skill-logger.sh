#!/bin/bash

# Claude Code Skill Logging Hook
# Safe and secure skill usage tracking
# Reads JSON from stdin as per Claude Code hooks specification

set -euo pipefail

# Configuration
readonly PROJECT_ROOT="/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow"
readonly LOG_DIR="$PROJECT_ROOT/.claude/logs"
readonly TEMP_DIR="/tmp/claude-skill-logs"
readonly LOG_FILE="$LOG_DIR/skill-usage.jsonl"

# Allowed skills for security
readonly ALLOWED_SKILLS=(
    "comprehensive-testing"
    "port-manager"
    "vue-development"
    "pinia-state-management"
    "vue-use"
    "audit-ui-ux-consistency"
    "debug-vue-reactivity"
    "fix-pinia-state"
    "fix-timer-bugs"
    "optimize-performance"
    "systematic-planning"
)

# Initialize directories
mkdir -p "$LOG_DIR" "$TEMP_DIR"

# Read JSON from stdin
read_hook_data() {
    # Read all stdin into variable
    cat
}

# Extract and validate skill name
extract_skill_name() {
    local json_data="$1"

    # Extract tool_name from JSON
    local tool_name
    tool_name=$(echo "$json_data" | jq -r '.tool_name // empty' 2>/dev/null || echo "")

    # Only process if tool is "Skill"
    if [[ "$tool_name" != "Skill" ]]; then
        exit 0  # Not a skill invocation, exit silently
    fi

    # Extract skill name from tool_input.command
    local skill_name
    skill_name=$(echo "$json_data" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")

    # Check if skill is in allowlist
    if [[ -z "$skill_name" ]]; then
        exit 0  # No skill name found, exit silently
    fi

    local found=0
    for allowed in "${ALLOWED_SKILLS[@]}"; do
        if [[ "$skill_name" == "$allowed" ]]; then
            found=1
            break
        fi
    done

    if [[ $found -eq 0 ]]; then
        exit 0  # Skill not in allowlist, exit silently
    fi

    echo "$skill_name"
}

# Sanitize sensitive data
sanitize_data() {
    local data="$1"

    # Remove sensitive information (passwords, tokens, keys)
    echo "$data" | jq '
        with_entries(
            if .key | test("password|token|key|secret|auth"; "i")
            then .value = "[REDACTED]"
            else .
            end
        )
    ' 2>/dev/null || echo "{}"
}

# Create log entry
create_log_entry() {
    local action="$1"
    local json_data="$2"

    # Extract skill name
    local skill_name
    skill_name=$(extract_skill_name "$json_data")

    # Exit if validation failed or not a whitelisted skill
    if [[ -z "$skill_name" ]]; then
        exit 0
    fi

    # Generate session ID from environment or create new one
    local session_id="${CLAUDE_SESSION_ID:-$(date +%s)-$$}"

    # Sanitize the tool_input data
    local tool_input
    tool_input=$(echo "$json_data" | jq '.tool_input // {}' 2>/dev/null || echo "{}")
    local sanitized_data
    sanitized_data=$(sanitize_data "$tool_input")

    # Create timestamp
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")

    # Build log entry
    local log_entry
    log_entry=$(jq -n \
        --arg timestamp "$timestamp" \
        --arg session_id "$session_id" \
        --arg action "$action" \
        --arg skill_name "$skill_name" \
        --argjson data "$sanitized_data" \
        --arg hostname "${HOSTNAME:-$(hostname)}" \
        --arg user "${USER:-$(whoami)}" \
        '{
            timestamp: $timestamp,
            session_id: $session_id,
            action: $action,
            skill_name: $skill_name,
            data: $data,
            hostname: $hostname,
            user: $user
        }'
    )

    # Atomic write to log file
    local temp_file="$TEMP_DIR/skill-log-$$.jsonl"
    echo "$log_entry" >> "$LOG_FILE"

    # Send to MCP server if available
    if command -v curl >/dev/null 2>&1; then
        send_to_mcp_server "$log_entry" &
    fi
}

# Send log entry to MCP server (if enabled)
send_to_mcp_server() {
    local log_entry="$1"

    # Send to local MCP logging server if running
    curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$log_entry" \
        http://localhost:6777/mcp/skill-usage \
    >/dev/null 2>&1 || true
}

# Main execution
main() {
    local action="${1:-pre}"

    # Validate action
    if [[ "$action" != "pre" && "$action" != "post" ]]; then
        exit 0
    fi

    # Read JSON data from stdin
    local json_data
    json_data=$(read_hook_data)

    # Skip if no data received
    if [[ -z "$json_data" ]]; then
        exit 0
    fi

    # Process the log entry
    create_log_entry "$action" "$json_data"
}

# Execute main function with action argument
main "$@"
