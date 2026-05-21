## $(date +%Y-%m-%d) - [Icon-Only Button Accessibility Pattern]
**Learning:** Found a recurring pattern where `title` attributes are incorrectly used as the sole accessibility mechanism for icon-only buttons (like `.close-btn`, `.filter-toggle`, `.reveal-canvas-btn`) in Vue components. `title` attributes are not reliably announced by all screen readers.
**Action:** Always verify icon-only buttons include a proper `aria-label` attribute using existing i18n keys (e.g. `$t('common.close')`) or localized strings.
