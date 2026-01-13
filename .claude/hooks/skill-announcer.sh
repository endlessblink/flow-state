#!/bin/bash
# Skill Announcer Hook - Reminds Claude about available skills at session start
# This hook runs on SessionStart and outputs a reminder about skill availability

cat << 'EOF'
<session-start-hook>
AVAILABLE SKILLS REMINDER:

This project has 30+ specialized skills. Use the Skill tool to invoke them:

DEBUGGING & FIXES:
- Skill(dev-debugging) - General bug fixing, state issues
- Skill(vue-flow-debug) - Canvas/Vue Flow issues
- Skill(dev-fix-timer) - Pomodoro timer issues
- Skill(dev-fix-keyboard) - Keyboard shortcuts
- Skill(dev-fix-task-store) - Task CRUD issues
- Skill(ops-port-manager) - Port/server issues

DEVELOPMENT:
- Skill(arch-planning) - Plan features/projects
- Skill(dev-vueuse) - VueUse composables
- Skill(dev-refactoring) - Code refactoring
- Skill(dev-implement-ui-ux) - UI/UX implementation
- Skill(dev-storybook) - Storybook stories

QUALITY:
- Skill(qa-testing) - Testing and verification (MANDATORY before claiming "done")
- Skill(codebase-health-auditor) - Dead code detection

UTILITIES:
- Skill(smart-doc-manager) - Documentation
- Skill(master-plan-manager) - MASTER_PLAN.md updates
- Skill(skill-creator-doctor) - Skill management

When user requests match a skill's purpose, INVOKE IT using the Skill tool.
After ANY code changes, invoke Skill(qa-testing) before claiming completion.
</session-start-hook>
EOF

exit 0
