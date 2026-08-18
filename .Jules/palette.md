## 2024-05-30 - Consistent Accessibility for Toggle Buttons
**Learning:** Icon-only toggle buttons in the settings (like showing/hiding API keys or passwords, and copying tokens) often lack proper ARIA labels because they use `title` for visual tooltips. However, screen readers handle `title` inconsistently.
**Action:** Always add dynamic `:aria-label` along with `title` for icon-only toggles, and use `:aria-pressed` for stateful buttons that toggle visibility.
