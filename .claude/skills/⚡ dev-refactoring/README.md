# Systematic Refactoring Skill

## Purpose

This skill MUST be automatically activated whenever working on refactoring tasks in the PomoFlow project.

## Auto-Activation Rules

### Directory-Based Activation
```bash
# Working in this directory? → Skill activates automatically
/mnt/d/MY PROJECTS/AI/LLM/AI Code Gen/my-builds/Productivity/pomo-flow/pomo-flow-refactor
```

### Keyword Triggers
Skill activates when task description contains:
- "refactor"
- "composable"
- "extract"
- "split component"
- "reduce file size"
- "break down component"
- "pomo-flow-refactor"

### File Path Triggers
Skill activates when working with:
- `src/composables/**/*.ts`
- Any file in `/pomo-flow-refactor/` worktree

## Critical Enforcement: Port 5550 ONLY

**MANDATORY RULE**: The refactor worktree (`pomo-flow-refactor`) MUST use port 5550.

### Why This Matters
- Main worktree uses port 5546
- Refactor worktree uses port 5550
- Prevents port conflicts and confusion
- Ensures proper testing isolation

### Enforcement Commands
```bash
# Always use these commands for refactor worktree
cd /mnt/d/MY\ PROJECTS/AI/LLM/AI\ Code\ Gen/my-builds/Productivity/pomo-flow/pomo-flow-refactor
lsof -ti:5550 | xargs kill -9
npm run dev -- --port 5550
```

## What This Skill Provides

1. **Port Management**: Enforces port 5550 for refactor worktree
2. **Baseline Testing**: Test BEFORE refactoring to establish proof features work
3. **Integration Testing**: Test AFTER refactoring to detect regressions
4. **Composable Patterns**: Best practices for Vue 3 composable extraction
5. **Regression Prevention**: Zero-tolerance for breaking changes
6. **Documentation Templates**: Baseline and integration test documentation

## How to Use

### Automatic (Recommended)
Simply start working in the refactor worktree or mention refactoring in your request. The skill will activate automatically.

### Manual
```
Use the systematic-refactoring skill
```

## Key Requirements

1. **Port 5550**: ALWAYS use for refactor worktree
2. **Baseline First**: Test original code before refactoring
3. **Zero Regressions**: All baseline tests must pass after refactoring
4. **Documentation**: Create test result docs in `docs/`
5. **Composable Patterns**: Follow dependency injection, initialization order, cleanup rules
