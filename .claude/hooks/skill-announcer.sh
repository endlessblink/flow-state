#!/bin/bash
# Skill Announcer Hook - Reminds Claude about available skills at session start
# This hook runs on SessionStart and outputs a reminder about skill availability

cat << 'EOF'
<session-start-hook>
AVAILABLE SKILLS REMINDER:

This project has 30+ specialized skills. Use the Skill tool to invoke them:

DEBUGGING & FIXES:
- Skill(dev-debugging) - General bug fixing, state issues, task store CRUD, keyboard shortcuts
- Skill(vue-flow-debug) - Canvas/Vue Flow issues
- Skill(dev-fix-timer) - Pomodoro timer issues
- Skill(ops-port-manager) - Port/server issues

DEVELOPMENT:
- Skill(chief-architect) - Plan features/projects, architecture decisions
- Skill(dev-vueuse) - VueUse composables
- Skill(dev-refactoring) - Code refactoring
- Skill(dev-implement-ui-ux) - UI/UX implementation
- Skill(dev-storybook) - Storybook stories

QUALITY:
- Skill(qa-testing) - Testing and verification (MANDATORY before claiming "done")
- Skill(codebase-health-auditor) - Dead code detection

UTILITIES:
- Skill(smart-doc-manager) - Documentation and MASTER_PLAN.md management
- Skill(skill-creator-doctor) - Skill management

When user requests match a skill's purpose, INVOKE IT using the Skill tool.
After ANY code changes, invoke Skill(qa-testing) before claiming completion.
</session-start-hook>
EOF

# ── Active Work Awareness ──────────────────────────────────────────
# Show locked tasks and in-progress work so this session avoids collisions

LOCKS_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/locks"
ACTIVE_WARNINGS=""

# Check lock files (other sessions' active tasks)
if [ -d "$LOCKS_DIR" ]; then
  for lock_file in "$LOCKS_DIR"/*.lock; do
    [ -f "$lock_file" ] || continue
    task_id=$(jq -r '.task_id // ""' "$lock_file" 2>/dev/null)
    session_id=$(jq -r '.session_id // ""' "$lock_file" 2>/dev/null)
    locked_at=$(jq -r '.locked_at // "unknown"' "$lock_file" 2>/dev/null)
    [ -n "$task_id" ] && ACTIVE_WARNINGS="${ACTIVE_WARNINGS}\n- ${task_id} (locked by session ${session_id:0:8}… since ${locked_at})"
  done
fi

# Check Watchpost for IN PROGRESS tasks (2s timeout, graceful fallback)
WP_RESPONSE=$(curl -s --max-time 2 http://localhost:6010/api/master-plan 2>/dev/null || echo "")
if [ -n "$WP_RESPONSE" ]; then
  WP_IN_PROGRESS=$(echo "$WP_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    tasks = data.get('tasks', [])
    for t in tasks:
        s = t.get('status', '')
        if s in ('in_progress', 'in-progress'):
            print(f\"- {t['id']}: {t.get('title', '?')[:60]} (IN PROGRESS)\")
except: pass
" 2>/dev/null)
  [ -n "$WP_IN_PROGRESS" ] && ACTIVE_WARNINGS="${ACTIVE_WARNINGS}\n${WP_IN_PROGRESS}"
fi

# Output warning if there's active work
if [ -n "$ACTIVE_WARNINGS" ]; then
  echo ""
  echo "<active-work-warning>"
  echo "⚠️ ACTIVE WORK — avoid these tasks (already claimed by other sessions or in progress):"
  echo -e "$ACTIVE_WARNINGS"
  echo ""
  echo "Pick a DIFFERENT task to work on. Use /next or check MASTER_PLAN.md for available tasks."
  echo "</active-work-warning>"
fi

exit 0
