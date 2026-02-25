## 2025-02-18 - [Inconsistent Focus Implementations]
**Learning:** `BaseButton` uses a dedicated `div.focus-indicator` for complex focus rings, while `BaseIconButton` had no focus styles. Simple components can rely on CSS `outline` with `--brand-focus-ring` token, but complex ones might need the div approach for border-radius handling or z-index.
**Action:** Standardize on `--brand-focus-ring` token for all interactive elements. When modifying base components, check for focus consistency with `BaseButton`.
