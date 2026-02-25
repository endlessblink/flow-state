/**
 * Centralized external URL constants.
 * Import from here instead of hardcoding URLs in components.
 */
export const EXTERNAL_URLS = {
  DICEBEAR_API: 'https://api.dicebear.com/7.x/pixel-art/svg',
  GITHUB_REPO: 'https://github.com/endlessblink/flow-state',
  PRODUCTION_SITE: import.meta.env.VITE_SITE_URL || 'http://localhost:5546',
  STORYBOOK_DEV: 'http://localhost:6006',
} as const
