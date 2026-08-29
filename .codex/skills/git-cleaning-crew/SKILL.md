---
name: git-cleaning-crew
description: Safely reduce a busy Git repository to one canonical local main branch tracking the verified origin default branch, with zero extra branches, worktrees, dirty files, untracked files, and stale worktree metadata. Use whenever the user asks to clean up, consolidate, finish, merge, archive, discard, or monitor many Git branches or worktrees.
---

# Git Cleaning Crew

Use this skill for a complete, resumable repository cleanup. The target state is:

- one local branch: `main`, tracking the verified `origin/<default-branch>`;
- no dirty tracked files or untracked files;
- no linked worktrees other than the primary checkout;
- no stale worktree administrative records;
- no unreviewed local commits lost in the process.

Remote branches are read-only by default and are never deleted by this skill.

## Operating modes

Accept one mode, defaulting to `audit`:

- `audit`: inspect state without changing Git data;
- `plan`: classify every local branch, worktree, commit, and dirty path;
- `execute`: perform only actions recorded in the approved plan, checkpointing after each item;
- `monitor`: repeat the audit at an interval and stop on drift or failure;
- `resume`: continue an interrupted approved run from its receipt.

Never silently switch from `audit` or `plan` to `execute`.

## Safety contract

1. Load the repository instructions and continuation contract before acting.
2. Confirm the repository root, current branch, remotes, and whether the checkout is a linked worktree or submodule.
3. Verify the remote's advertised default branch and its reachable ref before changing branches. Prefer `origin/main` when it exists; otherwise record the actual default, such as `origin/master`, and do not invent a missing ref.
4. Preserve the primary checkout and all user changes until an archive receipt exists.
5. Inventory every local branch and every registered worktree; do not sample or infer from names.
6. Treat dirty changes, untracked files, unique commits, merge commits, deletion-heavy diffs, migrations, release artifacts, and branches with missing upstreams as review items.
7. Never use reset, clean, stash, branch deletion, worktree removal, merge, rebase, push, or force operations without an approved run plan and a recoverable checkpoint.
8. Do not read or archive credentials, tokens, `.env` contents, authorization files, or private transcripts. Record their paths as protected items instead.
9. Never delete remote branches. Never force-push. Never rewrite shared history.
10. If a conflict, unexpected file, changed HEAD, changed remote, running process, or failed verification appears, pause the run, preserve the receipt, and report the exact recovery action.

## Receipts and recovery

Create an ignored run directory outside the tracked tree when possible, for example:

```text
<repo>/.git/git-cleaning-crew/runs/<run-id>/
```

Each run records:

- immutable starting HEAD, remote refs, branch list, worktree list, and status;
- the exact approved target and policy;
- per-item decisions: `merge`, `archive`, `discard`, `keep`, or `manual_review`;
- archive paths and SHA-256 checksums for every preserved commit and dirty snapshot;
- commands run, exit codes, timestamps, and post-step verification;
- final state or the first failed gate.

For unique commits, create a local recovery bundle before deletion and verify it with `git bundle verify`. For dirty tracked changes, save a binary patch and a plain diff. For untracked files, preserve a file-list manifest and an archive while excluding protected paths; if a protected or unreadable path is present, use `manual_review` instead of guessing.

## Required workflow

### 1. Audit

Run read-only checks equivalent to:

```bash
git rev-parse --show-toplevel
git status --porcelain=v1
git branch -vv
git worktree list --porcelain
git remote -v
git ls-remote --symref origin HEAD
git show-ref --verify refs/remotes/origin/<verified-default>
git worktree prune --dry-run
```

Also inspect each local branch against `origin/main` with merge-base, ahead/behind counts, unique commits, deletion-only paths, and upstream status. Do not rely on a remote-tracking summary that has not been refreshed.

### 2. Plan

Refresh remote-tracking refs only with a normal, non-destructive fetch of the verified default branch. Re-audit afterward because the base may change. Classify every item:

- `merge`: compatible work with a clear destination and passing checks;
- `archive`: valuable or uncertain work that is not ready to merge;
- `discard`: verified disposable duplicate, generated output, abandoned experiment, or already-contained branch;
- `keep`: the canonical `main` checkout only;
- `manual_review`: conflicts, unclear ownership, missing base, protected data, or failed evidence.

The plan must name the exact branch/worktree/path and the evidence supporting its decision. A branch is never discarded merely because it is old, merged by name, or points at an old release.

### 3. Prepare

Create and verify recovery bundles for all non-contained commits. Save the dirty-state snapshot separately from committed history. Run the repository's applicable tests on any branch selected for merging, and record the exact commit tested.

Before integration, inspect `git diff origin/<verified-default>..branch --stat` and deletion-only paths. Use a clean temporary integration checkout based on `origin/<verified-default>`; do not merge in a dirty primary checkout.

### 4. Execute approved actions

Process one item at a time:

1. verify the receipt and current HEAD still match the checkpoint;
2. perform the approved merge or archive/discard action;
3. verify branch reachability, worktree registration, and repository status;
4. append the result and checksum to the receipt;
5. stop immediately on unexpected state.

Move the primary checkout to the verified local `main` branch before removing other local branches. Remove only branches explicitly marked `discard` or branches proven fully contained after the archive checkpoint. Remove extra worktrees only after their branch and dirty state have been separately handled. Prune stale administrative records only after verifying their target directories are absent and the receipt preserves the evidence.

### 5. Final verification

Require all of the following, observed from the primary checkout:

```bash
git branch --show-current                 # main
git status --porcelain=v1                 # empty
git ls-files --others --exclude-standard  # empty
git worktree list --porcelain             # primary checkout only
git branch --format='%(refname:short)'    # main only
git rev-list --left-right --count main...origin/<verified-default>
git worktree prune --dry-run              # empty
```

Then verify `main` tracks the verified remote default ref, the working tree is clean, the final HEAD is reachable from the intended remote ref, and every archive bundle verifies. Report `complete` only when all gates pass. Otherwise report `in_progress` or `manual_action_required`, naming the exact failed gate.

## Monitoring

`monitor` reruns the full audit, not just `git status`, at the requested interval. It watches branch count, worktree count, remote ref identity, HEAD, dirty/untracked paths, stale metadata, and receipt integrity. If any value changes, it records the diff and returns to `plan`; it never auto-discards newly appearing work.

## User-facing report

Always report:

1. current state and target state;
2. counts for branches, worktrees, dirty paths, untracked paths, and stale records;
3. what was merged, archived, discarded, or left for review;
4. archive receipt location and recovery status;
5. tests and final verification evidence;
6. exactly one state: `in_progress`, `manual_action_required`, or `complete`.
