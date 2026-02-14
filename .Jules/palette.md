## 2025-02-26 - Accessible Focus States for Icon-Only Buttons
**Learning:** Icon-only buttons (like `BaseIconButton`) often rely solely on `outline: none` for clean aesthetics, inadvertently removing critical focus indicators for keyboard users.
**Action:** Always pair `outline: none` with explicit `:focus-visible` styles (using high-contrast outline/ring) to restore accessibility without compromising mouse interaction design.
