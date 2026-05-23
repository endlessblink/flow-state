## 2024-05-23 - Accessibility Bindings with i18n
**Learning:** When adding ARIA labels to components that use internationalization (i18n), it is crucial to use the dynamic Vue binding syntax (`:aria-label="$t('key')"`) rather than standard static strings to ensure the accessibility text translates correctly.
**Action:** Always verify if an existing string uses the `$t` function or is a dynamic expression, and prepend the colon (`:`) to the `aria-label` attribute in Vue templates.
