# SOP-010: Dev-Manager AI Orchestrator

**Created**: 2026-01-16
**Status**: Active
**Related Task**: TASK-303

---

## Overview

The Dev-Manager Orchestrator is a multi-agent system that breaks down user goals into tasks, spawns Claude Code agents to implement each task in isolated git worktrees, and provides a review interface for merging changes.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATOR FLOW                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. GOAL INPUT        2. QUESTIONS         3. PLANNING              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐            │
│  │ User enters │ ──► │ Claude asks │ ──► │ Claude      │            │
│  │ project goal│     │ clarifying  │     │ generates   │            │
│  └─────────────┘     │ questions   │     │ task plan   │            │
│                      └─────────────┘     └─────────────┘            │
│                                                 │                    │
│                                                 ▼                    │
│  6. MERGE/DISCARD    5. REVIEW            4. EXECUTION              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐            │
│  │ User merges │ ◄── │ User reviews│ ◄── │ Agents work │            │
│  │ or discards │     │ diff per    │     │ in isolated │            │
│  │ each branch │     │ branch      │     │ worktrees   │            │
│  └─────────────┘     └─────────────┘     └─────────────┘            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Components

### Backend (`dev-manager/server.js`)

| Function | Location | Purpose |
|----------|----------|---------|
| `spawnSubAgent()` | Lines 2316-2516 | Spawns Claude agent with worktree isolation |
| `createAgentWorktree()` | Lines 792-833 | Creates git worktree for agent |
| `cleanupWorktree()` | Lines 835-852 | Removes worktree after use |
| `getOrchestrationStats()` | Lines 2271-2278 | Returns completed/running/pending counts |
| `executeNextTasks()` | Lines 2280-2314 | Manages task queue and concurrency |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/orchestrator` | POST | Start new orchestration |
| `/api/orchestrator/:id` | GET | Get orchestration status |
| `/api/orchestrator/:id` | DELETE | Cancel and cleanup |
| `/api/orchestrator/:id/answers` | POST | Submit question answers |
| `/api/orchestrator/:id/execute` | POST | Start execution phase |
| `/api/orchestrator/task/:id/diff` | GET | Get diff for completed task |
| `/api/orchestrator/task/:id/merge` | POST | Merge task branch to master |
| `/api/orchestrator/task/:id/discard` | POST | Discard task worktree/branch |

### SSE Event Types

| Event | Payload | When Sent |
|-------|---------|-----------|
| `phase` | `{ phase, message }` | Phase transitions |
| `questions` | `{ questions[] }` | Clarifying questions ready |
| `plan` | `{ plan[] }` | Implementation plan ready |
| `task_started` | `{ taskId, task, stats, worktree, branch }` | Agent begins work |
| `task_completed` | `{ taskId, task, stats, diffSummary, filesChanged, branch, reviewCommands }` | Agent finished |
| `task_retrying` | `{ taskId, task, stats, retries, maxRetries }` | Agent retry after failure |
| `task_failed` | `{ taskId, task, stats, error }` | Agent failed after max retries |

## Agent Spawn Configuration

```javascript
// Current configuration (TASK-303)
spawn('claude', [
    '--permission-mode', 'bypassPermissions',  // Full file access
    '--output-format', 'stream-json',          // Structured output
    '--max-turns', '30',                       // Prevent runaway
    '-p', prompt
], {
    cwd: worktreePath,           // Isolated worktree
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env }      // Preserve API key!
});

// Close stdin to prevent hanging
agentProcess.stdin.end();
```

### Permission Mode Options

| Mode | Use Case | Risk Level |
|------|----------|------------|
| `bypassPermissions` | Isolated worktrees (current) | Medium - full access in worktree |
| `acceptEdits` | Auto-approve file edits only | Low - still prompts for bash |
| `allowedTools` | Whitelist specific tools | Lowest - maximum control |

## Worktree Structure

```
pomo-flow/
├── .agent-worktrees/           # Gitignored
│   ├── orch-task-1/           # Worktree for task 1
│   │   └── (full repo copy)
│   └── orch-task-2/           # Worktree for task 2
│       └── (full repo copy)
└── (main repo)
```

Each worktree:
- Has its own branch: `bd-orch-{taskId}`
- Is a full working copy of the repo
- Changes are isolated until merge
- Can be discarded without affecting main

## Review Panel Features

### Statistics Grid
- Tasks Completed
- Branches Ready
- Files Changed (total)
- Pending Merge (highlighted)

### Per-Branch Cards
- Task title + branch name
- Diff summary preview
- Actions: View Diff | Merge | Discard

### Git Commands Section
- Copy-to-clipboard commands
- `git branch | grep bd-` - list all agent branches
- `git diff master...{branch}` - view changes

## Troubleshooting

### Agent Not Making Changes
1. Check API key is preserved (not cleared)
2. Verify `--permission-mode bypassPermissions` is set
3. Check worktree was created successfully
4. Look for errors in agent stderr

### Worktree Conflicts
```bash
# List worktrees
git worktree list

# Force remove stuck worktree
git worktree remove .agent-worktrees/orch-task-x --force

# Prune stale worktrees
git worktree prune
```

### Branch Cleanup
```bash
# List orchestrator branches
git branch | grep bd-orch

# Delete specific branch
git branch -D bd-orch-task-x

# Delete all orchestrator branches
git branch | grep bd-orch | xargs git branch -D
```

## Safety Measures

1. **Worktree Isolation** - Each task in separate worktree
2. **No Auto-Push** - Changes stay local until user approves
3. **Review Required** - User must explicitly merge each branch
4. **Max Turns** - Agents limited to 30 API turns
5. **Cleanup on Failure** - Worktrees removed if task fails

## Future Improvements

- [ ] Stream agent output in real-time (currently batched)
- [ ] Add `--allowedTools` whitelist for tighter security
- [ ] Support parallel execution across multiple tasks
- [ ] Add rollback capability after merge
- [ ] Integrate with PR workflow for team review
