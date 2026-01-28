## 2025-02-18 - Voice Input Accessibility
**Learning:** Voice input controls (mic buttons, transcript status) require specific ARIA attributes (`aria-pressed`, `aria-live`) to be accessible, as visual feedback (waveforms, changing icons) is insufficient for screen readers.
**Action:** When implementing voice features, always add `aria-pressed` to toggle buttons and `aria-live="polite"` to the transcript display container.
