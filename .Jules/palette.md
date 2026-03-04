## 2025-02-20 - [ARIA Linkage in Reusable Inputs]
**Learning:** When linking an input field to its descriptive text via `aria-describedby` in a reusable Vue component, relying on Vue 3.5's native `useId()` ensures robust and deterministic ID generation across instances, avoiding potential SSR hydration mismatches that occur with `Math.random()`.
**Action:** Default to `useId()` for all ARIA-based ID generation within Vue components.
