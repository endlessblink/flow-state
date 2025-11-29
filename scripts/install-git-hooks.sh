#!/bin/bash
# Git hooks installer for Pomo-Flow conflict resolution safety

set -e

HOOKS_DIR=".git/hooks"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installing Pomo-Flow git hooks..."

# Backup existing hooks
if [ -f "$HOOKS_DIR/pre-commit" ]; then
    cp "$HOOKS_DIR/pre-commit" "$HOOKS_DIR/pre-commit.backup"
    echo "Backed up existing pre-commit hook"
fi

# Create pre-commit hook
cat > "$HOOKS_DIR/pre-commit" << 'EOF'
#!/bin/bash
# Pomo-Flow Pre-Commit Safety Hook

echo "Running pre-commit safety checks..."

# 1. Check for TypeScript errors in staged files
STAGED_TS_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|vue)$' || true)

if [ -n "$STAGED_TS_FILES" ]; then
    echo "Checking TypeScript in staged files..."
    # Quick type check - skip full build
    if ! npx vue-tsc --noEmit 2>/dev/null; then
        echo "WARNING: TypeScript errors detected (non-blocking)"
    fi
fi

# 2. Check for conflict resolution system files
CONFLICT_FILES=$(git diff --cached --name-only | grep -E 'conflict|Conflict' || true)

if [ -n "$CONFLICT_FILES" ]; then
    echo "Conflict resolution files modified:"
    echo "$CONFLICT_FILES"
    echo ""
    echo "Ensure tests pass before pushing: npm run test:conflict-system"
fi

# 3. Warn about large changes
LINES_CHANGED=$(git diff --cached --numstat | awk '{sum += $1 + $2} END {print sum}')

if [ "${LINES_CHANGED:-0}" -gt 500 ]; then
    echo "WARNING: Large commit (${LINES_CHANGED} lines changed)"
    echo "Consider breaking into smaller commits for easier review"
fi

# 4. Check for debug statements
if git diff --cached | grep -E 'console\.log|debugger' >/dev/null 2>&1; then
    echo "WARNING: Debug statements found in staged changes"
fi

echo "Pre-commit checks complete"
exit 0
EOF

chmod +x "$HOOKS_DIR/pre-commit"
echo "Installed pre-commit hook"

# Create pre-push hook
cat > "$HOOKS_DIR/pre-push" << 'EOF'
#!/bin/bash
# Pomo-Flow Pre-Push Safety Hook

echo "Running pre-push safety checks..."

# Run tests before push
if ! npm run test 2>/dev/null; then
    echo "Tests failed - push blocked"
    exit 1
fi

echo "Pre-push checks passed"
exit 0
EOF

chmod +x "$HOOKS_DIR/pre-push"
echo "Installed pre-push hook"

echo ""
echo "Git hooks installed successfully!"
echo "To uninstall: npm run file:uninstall-hooks"
