# TASK-2073 Sure Gate — HIGH / PASS

1. **Root cause.** `completeSession()` used to schedule a silent new work session after a completed focus session; the pending-break state did not render a visible prompt, so the user experienced an unexplained reset instead of a break choice.
2. **Confidence rating.** **HIGH.** The former 90-second restart was reproduced by the focused state-machine regression before the change; the historical intent was to preserve user choice, not auto-start work.
3. **Evidence needed.** Complete. The red regression showed a new work session after two minutes; the repaired regression now keeps the active session empty and the break offer pending. The renderer contract verifies a visible, live break prompt beside the existing Start Break action.
4. **Fix.** Remove the automatic work restart from the timer store, retain pending-break state until a user starts a break, and render that state as an accessible visible prompt in the header.
5. **Side effects and regressions.** Starting a break still clears the pending prompt; manual stops do not create one; completion persistence and the Electron/KDE inactive snapshot stay covered by existing timer regressions. No settings behavior is expanded: this restores the existing explicit-choice model rather than reintroducing automatic breaks.
