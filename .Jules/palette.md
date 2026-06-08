## 2025-06-08 - Icon-Only Close Buttons Need ARIA Labels
**Learning:** Found multiple instances of `<button class="close-btn">` wrapping an icon (like `<X />`) without proper accessibility text. While some had `title` attributes, `aria-label` provides much better screen reader support. Using `:aria-label="$t('close')"` ensures they are both accessible and properly localized.
**Action:** When adding or updating icon-only buttons, especially common ones like close buttons, always include `aria-label` using Vue's existing i18n translation keys.
