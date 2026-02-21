---
name: next
description: Next-task workflow for Flow State. Default is chat-first list selection; optional TUI picker on request.
---

# /next

Use a chat-first task selection flow by default.

## Default Behavior (required)

1. Run:

```bash
npm run --silent pick:list -- --planned --limit=8
```

2. Return a numbered list in chat (do not launch TUI automatically).
3. Ask the user to reply with a number or task ID.
4. After selection, show full context:

```bash
npm run --silent pick:show -- <TASK-ID>
```

5. Offer next action:
- start work now
- show another task
- open TUI picker

## Optional TUI (only if user asks)

```bash
npm run next:interactive -- choose
```

## Notes

- Never auto-run the TUI unless explicitly requested.
- If user asks for bugs/progress/review, use:
  - `npm run --silent pick:list -- --bugs --limit=12`
  - `npm run --silent pick:list -- --progress --limit=12`
  - `npm run --silent pick:list -- --review --limit=12`
