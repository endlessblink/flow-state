# Git Safe Operations Guide

Best practices for preserving history and ensuring data integrity during documentation reorganization.

## Core Principles

### 1. Never Lose History
- Always use `git mv` instead of `rm` + `mkdir` + `cp`
- Preserve commit history with `--follow` flag
- Create branches for major reorganization

### 2. Maintain Traceability
- Use descriptive commit messages
- Link related commits with references
- Document the "why" behind structural changes

### 3. Enable Rollback
- Create checkpoints before major operations
- Keep original files until verification is complete
- Test changes in isolation

## Safe File Operations

### Moving Files
```bash
# ✅ SAFE: Preserves history
git mv old/path/file.md new/path/file.md

# ✅ SAFE: Batch move with history
mkdir -p new/directory/
git mv old/directory/*.md new/directory/

# ❌ UNSAFE: Loses history
rm old/path/file.md
mkdir -p new/path/
cp old/path/file.md new/path/
git add new/path/file.md
git rm old/path/file.md
```

### Renaming Files
```bash
# ✅ SAFE: Single file rename
git mv old-name.md new-name.md

# ✅ SAFE: Case-sensitive rename (two-step process)
git mv old-name.md temp-name.md
git mv temp-name.md Old-Name.md

# ✅ SAFE: Batch rename with pattern
for file in docs/*.md; do
    new_name=$(echo "$file" | sed 's/old-prefix/new-prefix/')
    git mv "$file" "$new_name"
done
```

### Directory Restructuring
```bash
# ✅ SAFE: Create new structure first
mkdir -p docs/{guides,api,architecture,contributing}

# ✅ SAFE: Move files with history preservation
git mv docs/quickstart.md docs/guides/
git mv docs/api-reference.md docs/api/
git mv docs/system-design.md docs/architecture/

# ✅ SAFE: Commit logical groupings
git commit -m "docs: reorganize into logical structure

- Create category-based directory structure
- Move guides to /guides/ directory
- Move API docs to /api/ directory
- Move architecture docs to /architecture/ directory

Preserves file history using git mv for all operations.
Related to #123 - documentation organization."
```

## Branch Strategy

### Feature Branch Workflow
```bash
# ✅ SAFE: Create dedicated branch for reorganization
git checkout -b docs/reorganization-2025-11-23

# ✅ SAFE: Make changes in logical commits
git mv docs/old-structure.md docs/new-structure.md
git commit -m "docs: move old-structure.md to new location"

# ✅ SAFE: Batch related changes
git commit -m "docs: complete directory reorganization

- Moved 15 files from flat structure to categorized folders
- Updated all internal links to reflect new paths
- Verified no broken references remain"

# ✅ SAFE: Create pull request for review
git push origin docs/reorganization-2025-11-23
gh pr create --title "docs: reorganize documentation structure" \
  --body "This PR reorganizes the documentation from flat structure to categorized folders. All links have been updated and verified." \
  --reviewer @tech-writer @docs-team
```

### Emergency Rollback
```bash
# ✅ SAFE: Complete rollback if needed
git checkout main
git branch -D docs/reorganization-2025-11-23  # Delete problematic branch

# ✅ SAFE: Selective rollback
git checkout main
git revert <commit-hash>  # Revert specific reorganization commit

# ✅ SAFE: File-level rollback
git checkout <commit-hash>~1 -- docs/problematic-file.md
git add docs/problematic-file.md
git commit -m "docs: rollback problematic-file.md to previous state"
```

## Commit Message Guidelines

### Standard Format
```
docs: <concise description>

Optional detailed explanation:
- What changed and why
- How migration was performed
- Impact on existing documentation
- Any breaking changes

Resolves #issue-number
Related #other-issue-number
```

### Examples
```
docs: consolidate API documentation

- Merge api-endpoints.md and api-auth.md into unified api.md
- Remove duplicate content (95% similarity)
- Update all cross-references to point to new file
- Preserve history of both source files

Resolves #156 - API documentation consolidation

docs: archive deprecated v1 documentation

- Move api-v1.md to archive/ directory
- Add ARCHIVED.md with migration notes
- Update all references to point to v2 documentation
- Maintain history via git mv operation

Related #201 - API v2 migration
```

## Link Update Strategies

### Internal Link Updates
```bash
# ✅ SAFE: Update links systematically
find docs/ -name "*.md" -exec sed -i \
  -e 's|](docs/quickstart.md)|](docs/guides/quickstart.md)|g' \
  -e 's|](docs/api-endpoints.md)|](docs/api/rest-api.md)|g' \
  {} \;

# ✅ SAFE: Verify link updates
rg '\[.*\]\(docs/.*\)' docs/ --only-matching | sort -u

# ✅ SAFE: Test link validity
for link in $(rg -o '\[.*\]\((docs/[^)]+)\)' docs/ | sort -u); do
  target="${link#*(}"
  target="${target%)}"
  if [ ! -f "$target" ]; then
    echo "BROKEN: $link"
  fi
done
```

### Cross-Reference Updates
```python
# Script to update cross-references safely
import re
from pathlib import Path

def update_cross_references(docs_dir, mapping):
    """
    Update cross-references based on file mapping

    Args:
        docs_dir: Path to documentation directory
        mapping: Dict of old_path -> new_path mappings
    """
    docs_path = Path(docs_dir)

    for md_file in docs_path.rglob("*.md"):
        content = md_file.read_text(encoding='utf-8')
        original_content = content

        # Update each mapping
        for old_path, new_path in mapping.items():
            # Update markdown links
            pattern = rf'\[([^\]]*)\]\({re.escape(old_path)}(#[^)]*)?\)'
            replacement = fr'[\1]({new_path}\2)'
            content = re.sub(pattern, replacement, content)

        # Only write if content changed
        if content != original_content:
            md_file.write_text(content, encoding='utf-8')
            print(f"Updated: {md_file.relative_to(docs_path)}")

# Usage
file_mapping = {
    "docs/quickstart.md": "docs/guides/quickstart.md",
    "docs/api-endpoints.md": "docs/api/rest-api.md",
    "docs/authentication.md": "docs/guides/authentication.md"
}

update_cross_references("docs", file_mapping)
```

## Verification Procedures

### History Verification
```bash
# ✅ SAFE: Verify history is preserved
git log --follow --oneline docs/new/location/file.md

# ✅ SAFE: Check all moved files have history
git log --name-only --pretty=format:"%h %s" | grep -A1 -B1 "^git mv"

# ✅ SAFE: Verify no data was lost
git diff main docs/reorganization-branch --name-status
```

### Link Verification
```bash
# ✅ SAFE: Comprehensive link check
find docs/ -name "*.md" -exec markdown-link-check {} \;

# ✅ SAFE: Check internal links only
for file in docs/**/*.md; do
  echo "Checking: $file"
  rg '\[.*\]\(([^h][^)]*)\)' "$file" -o | while read link; do
    target=$(echo "$link" | sed 's/.*(\([^)]*\)).*/\1/')
    if [ ! -f "docs/$target" ] && [ ! -f "$target" ]; then
      echo "  BROKEN: $target"
    fi
  done
done
```

## Backup and Recovery

### Creating Backups
```bash
# ✅ SAFE: Complete documentation backup
BACKUP_DIR=".backup-docs-$(date +%Y%m%d-%H%M%S)"
cp -r docs/ "$BACKUP_DIR/"
echo "Backup created: $BACKUP_DIR"

# ✅ SAFE: Git stash for temporary changes
git stash push -u -m "Pre-reorganization state" -m "Created before major docs restructure"

# ✅ SAFE: Tag important states
git tag -a "docs/pre-restructure-$(date +%Y%m%d)" -m "Documentation state before reorganization"
```

### Recovery Procedures
```bash
# ✅ SAFE: Restore from backup
cp -r .backup-docs-20251123/* docs/
git add docs/
git commit -m "docs: restore from backup due to issues with reorganization"

# ✅ SAFE: Restore from git stash
git stash pop

# ✅ SAFE: Reset to specific tag
git reset --hard docs/pre-restructure-20251123
```

## Automation Scripts

### Safe Migration Script
```bash
#!/bin/bash
# safe-migration.sh - Safe documentation migration script

set -e  # Exit on any error

# Configuration
SOURCE_DIR="docs"
BACKUP_DIR=".backup-docs-$(date +%Y%m%d-%H%M%S)"
BRANCH_NAME="docs/migration-$(date +%Y%m%d-%H%M%S)"

# Pre-flight checks
echo "=== Pre-flight Safety Checks ==="

# Check working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Working directory not clean. Commit or stash changes first."
    exit 1
fi

# Create backup
echo "📦 Creating backup..."
cp -r "$SOURCE_DIR/" "$BACKUP_DIR/"
echo "✅ Backup created: $BACKUP_DIR"

# Create branch
echo "🌿 Creating branch..."
git checkout -b "$BRANCH_NAME"

# Migration function
safe_move() {
    local source="$1"
    local target="$2"

    if [ ! -f "$source" ]; then
        echo "⚠️ Source file not found: $source"
        return 1
    fi

    # Create target directory if needed
    mkdir -p "$(dirname "$target")"

    # Move file with git mv
    git mv "$source" "$target"
    echo "✅ Moved: $source -> $target"
}

# Example migration
safe_move "docs/old-structure.md" "docs/guides/old-structure.md"
safe_move "docs/api-endpoints.md" "docs/api/rest-api.md"

# Commit changes
git commit -m "docs: safe migration of documentation files

- Moved files using git mv to preserve history
- Created backup at $BACKUP_DIR
- All operations performed on branch $BRANCH_NAME

This commit can be safely rolled back if needed."

echo "✅ Migration completed successfully!"
echo "Backup location: $BACKUP_DIR"
echo "Working branch: $BRANCH_NAME"
echo "To rollback: git checkout main && git branch -D $BRANCH_NAME"
```

### Rollback Script
```bash
#!/bin/bash
# rollback.sh - Rollback documentation changes

ROLLBACK_BRANCH="$1"
BACKUP_DIR="$2"

if [ -z "$ROLLBACK_BRANCH" ]; then
    echo "Usage: $0 <branch-to-rollback> [backup-directory]"
    exit 1
fi

echo "=== Rolling Back Documentation Changes ==="

# Switch to main branch
git checkout main

# Delete the problematic branch
if git rev-parse --verify "$ROLLBACK_BRANCH" >/dev/null 2>&1; then
    git branch -D "$ROLLBACK_BRANCH"
    echo "✅ Deleted branch: $ROLLBACK_BRANCH"
fi

# Restore from backup if provided
if [ -n "$BACKUP_DIR" ] && [ -d "$BACKUP_DIR" ]; then
    echo "🔄 Restoring from backup: $BACKUP_DIR"
    rm -rf docs/
    cp -r "$BACKUP_DIR" docs/
    git add docs/
    git commit -m "docs: restore from backup - rollback of $ROLLBACK_BRANCH"
    echo "✅ Restored from backup"
fi

echo "✅ Rollback completed!"
```

## Troubleshooting

### Common Issues and Solutions

#### Lost History After Move
```bash
# Problem: Used rm + cp instead of git mv
# Solution: Restore history from git reflog
git reflog --follow -- docs/file/path.md
# Find the commit before the bad move and reset to it
```

#### Broken Links After Reorganization
```bash
# Problem: Internal links not updated after file moves
# Solution: Systematic link update
find docs/ -name "*.md" -exec sed -i 's|old/path/|new/path/|g' {} +
# Then verify all links
find docs/ -name "*.md" -exec markdown-link-check {} \;
```

#### Merge Conflicts During Reorganization
```bash
# Problem: Conflicts when merging reorganization branch
# Solution: Resolve conflicts systematically
git checkout main
git merge docs/reorganization-branch
# Use merge tools to resolve conflicts
git mergetool
# Test links after resolution
```