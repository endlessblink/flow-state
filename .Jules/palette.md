## 2024-05-24 - Missing ARIA Labels on Layout Modal Close Buttons
**Learning:** Global layout-level modals (like `SettingsModal.vue`) heavily utilize icon-only close buttons lacking explicit screen-reader labels. Relying on visual `<X />` icons without `aria-label` degrades navigation for assistive tech.
**Action:** Always ensure any `.close-btn` pattern containing an icon explicitly declares an `aria-label` utilizing i18n variables (e.g. `$t("common.close")`) to maintain localization support.
