
## 2024-05-18 - Calendar View Options Accessibility
**Learning:** Icon-only view option togglers that trigger drop-downs (popovers) must clearly communicate their expanded state and use dynamically localized properties (`aria-label`, `title`). Without `aria-expanded`, screen readers may incorrectly announce them as static icon buttons.
**Action:** Always include `:aria-expanded="state.toString()"` along with i18n-supported `:aria-label`s on custom popover triggers.
