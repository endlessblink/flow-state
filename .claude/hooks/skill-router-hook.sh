#!/bin/bash
# Skill Router Hook - Automatically suggests appropriate skills based on user prompt
# This hook parses the user's prompt and outputs a reminder to invoke the matching skill

# Read user prompt from stdin (with timeout to prevent freeze)
USER_PROMPT=$(timeout 2 cat 2>/dev/null || echo '')

# Convert to lowercase for matching
PROMPT_LOWER=$(echo "$USER_PROMPT" | tr '[:upper:]' '[:lower:]')

# Exit early if no prompt
if [ -z "$PROMPT_LOWER" ]; then
  exit 0
fi

# Skill trigger mappings - ORDER MATTERS (most specific first)
# Format: "skill_name:trigger_pattern"
SKILL_MAPPINGS=(
  # Timer specific (before general debug)
  "dev-fix-timer:timer|pomodoro|countdown|session time|time display|timer stuck|timer won't start"

  # Keyboard shortcuts (routed to dev-debugging)
  "dev-debugging:keyboard|shortcut|hotkey|ctrl\+|cmd\+|key binding|key handler|keypress"

  # Port issues (specific)
  "ops-port-manager:port conflict|server won't start|address in use|eaddrinuse|port 5546|port 6006"

  # Supabase (before general database)
  "supabase-debugger:supabase|rls policy|row level|realtime subscription|postgres connection"

  # Canvas/Vue Flow (before general vue)
  "vue-flow-debug:vue flow|canvas|nested node|parent.child|node position|drag.* canvas|position.* canvas"

  # Calendar (specific)
  "calendar-interface-architect:calendar event|schedule task|inbox sync|date picker|scheduling"

  # Task store (routed to dev-debugging)
  "dev-debugging:task store|tasks don't save|tasks disappear|crud operation|state persist"

  # Storybook (specific)
  "dev-storybook:storybook|story file|component story|visual docs"

  # Documentation
  "smart-doc-manager:documentation|consolidate docs|organize docs|readme"

  # Master plan (routed to smart-doc-manager)
  "smart-doc-manager:master plan|roadmap|task tracking|update plan"

  # Ideas/Issues
  "idea-issue-creator:process idea|new issue|ideas inbox|go over issues"

  # Skills management
  "skill-creator-doctor:create skill|fix skill|skill won't load|consolidate skill"

  # Undo/Redo
  "dev-undo-redo:undo|redo|history|revert change"

  # Refactoring
  "dev-refactoring:refactor|extract composable|split component|reduce file size"

  # TypeScript types (routed to dev-debugging)
  "dev-debugging:type error|generic type|type inference|typescript error"

  # Filter management
  "vue-filter-manager:filter architecture|duplicate filter|cross-view filter"

  # Tiptap
  "tiptap-vue3:tiptap|wysiwyg|rich text editor|markdown editor"

  # UI/UX
  "dev-implement-ui-ux:ui fix|ux fix|design token|accessibility|visual consistency"

  # VueUse
  "dev-vueuse:vueuse|usemagickey|useclipboard|uselocalstorage|useevent"

  # Testing & Auditing (broad)
  "qa-testing:playwright|visual test|verify|check if|screenshot test|test if|run test|does.*work|audit|complexity|analyze system"

  # Vue development (broad)
  "dev-vue:vue component|reactivity|composable|pinia store|props emit"

  # Chief architect - unified (planning + architecture)
  "chief-architect:plan feature|breakdown task|implementation strategy|architecture plan|architecture decision|tech stack|app structure|design decision|roadmap|how.*implement|break.*down"

  # General debugging (LAST - catches remaining)
  "dev-debugging:bug|broken|fix|debug|not working|disappear|crash|error|issue|missing|stuck|drift"
)

# Check each skill's triggers in order
MATCHED_SKILL=""
MATCH_REASON=""

for mapping in "${SKILL_MAPPINGS[@]}"; do
  skill="${mapping%%:*}"
  triggers="${mapping#*:}"

  # Check if any trigger matches the prompt
  if echo "$PROMPT_LOWER" | grep -qE "$triggers"; then
    MATCHED_SKILL="$skill"
    # Extract what matched
    MATCH_REASON=$(echo "$triggers" | tr '|' '\n' | while read pattern; do
      if echo "$PROMPT_LOWER" | grep -qE "$pattern" 2>/dev/null; then
        echo "$pattern"
        break
      fi
    done)
    break
  fi
done

# Output skill suggestion if matched
if [ -n "$MATCHED_SKILL" ]; then
  cat << EOF
<user-prompt-submit-hook>
SKILL MATCH: The '$MATCHED_SKILL' skill is relevant for this request (matched: $MATCH_REASON).
Consider using: Skill tool with skill="$MATCHED_SKILL"
</user-prompt-submit-hook>
EOF
fi

# Always exit 0 - this is just a suggestion, not a blocker
exit 0
