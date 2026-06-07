---
name: superpowers-flowstate-auto-router
description: FlowState-safe auto-router for selected Superpowers workflows. Use at the start of bugs, fixes, behavior changes, reviews, planning, and completion checks to choose the relevant superpowers-* support skill without overriding FlowState rules.
---

# Superpowers FlowState Auto-Router

Use this as the project-local automatic Superpowers entrypoint. It is intentionally narrower than upstream `using-superpowers`.

## Authority

FlowState rules always win:
- `AGENTS.md`
- `CLAUDE.md`
- `docs/MASTER_PLAN.md`
- OMX workflow state
- branch safety rules
- Electron-first build/deploy rules
- user instructions in the active turn

If a Superpowers instruction conflicts with any of those, follow FlowState and treat Superpowers as optional process support.

## Route Selection

At the start of a task, classify the work and use the matching project-local skill when it helps:

| Task shape | Use |
| --- | --- |
| Bug, test failure, unexpected behavior, regression, production symptom | `superpowers-systematic-debugging` |
| Feature, bugfix, behavior change, refactor with behavior risk | `superpowers-test-driven-development` |
| Multi-step implementation where design/test shape is not obvious | `superpowers-writing-plans` |
| Substantial completed implementation or high-risk change | `superpowers-requesting-code-review` |
| Review feedback from user/agent/CI that needs evaluation | `superpowers-receiving-code-review` |
| About to claim work is done, fixed, passing, shipped, or safe | `superpowers-verification-before-completion` |

## FlowState-Safe Defaults

- Do not stop for approval just because upstream Superpowers would; this repo's autonomy directive still applies.
- Do not create separate worktrees by default.
- Do not replace MASTER_PLAN tracking with `docs/superpowers/plans`.
- Do not skip Electron release obligations for desktop-facing code changes.
- Do not commit or push unrelated user changes.
- Keep Superpowers usage proportional: for tiny documentation/config changes, a short routing decision is enough.

## Expected Agent Behavior

1. State the selected route briefly when it materially changes the work.
2. Load the selected `superpowers-*` skill if available.
3. Apply only the parts compatible with FlowState.
4. Before final completion claims, run fresh verification and report evidence.
