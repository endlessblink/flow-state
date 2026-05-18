import type { Page } from '@playwright/test'
import { expect } from '../../fixtures/auth'

/** Locator for the bottom navigation bar */
export const getMobileNav = (page: Page) => page.locator('nav.mobile-nav')

/** Locator for a specific nav item by label text */
export const getNavItemByLabel = (page: Page, label: string) =>
  page.locator('.mobile-nav .nav-item').filter({ hasText: new RegExp(`^${label}$`) }).first()

/** Assert the mobile shell (layout + header + nav) is visible */
export async function expectMobileShell(page: Page) {
  await expect(page.locator('.mobile-layout')).toBeVisible()
  await expect(page.locator('header.mobile-header')).toBeVisible()
  await expect(getMobileNav(page)).toBeVisible()
}

/** Dismiss any blocking modals (AI wizard, onboarding) */
export async function dismissBlockingModals(page: Page) {
  const aiWizard = page.locator('.wizard-overlay')
  if (await aiWizard.isVisible({ timeout: 1500 }).catch(() => false)) {
    await page.locator('.wizard-overlay .close-btn').click({ force: true })
    await expect(aiWizard).toBeHidden({ timeout: 5000 })
  }

  const onboarding = page.locator('.onboarding-overlay')
  if (await onboarding.isVisible({ timeout: 1500 }).catch(() => false)) {
    const getStarted = page.locator('.onboarding-modal button').filter({ hasText: /Get Started|Start/i }).first()
    if (await getStarted.isVisible().catch(() => false)) {
      await getStarted.click({ force: true })
      await expect(onboarding).toBeHidden({ timeout: 5000 })
    }
  }
}

/** Standard mobile test.use options for phone viewport */
export const MOBILE_PHONE_OPTIONS = {
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
} as const

/** Standard mobile test.use options for tablet viewport */
export const MOBILE_TABLET_OPTIONS = {
  viewport: { width: 768, height: 1024 },
  hasTouch: true,
  isMobile: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
} as const

/** Register locator handlers for modals that may block interaction */
export async function registerModalHandlers(page: Page) {
  await page.addLocatorHandler(page.locator('.wizard-overlay'), async () => {
    const closeBtn = page.locator('.wizard-overlay .close-btn')
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click({ force: true })
    }
  })

  await page.addLocatorHandler(page.locator('.onboarding-overlay'), async () => {
    const dismissBtn = page.locator('.onboarding-modal button').filter({ hasText: /Get Started|Start/i }).first()
    if (await dismissBtn.isVisible().catch(() => false)) {
      await dismissBtn.click({ force: true })
    }
  })
}

/** Suppress onboarding/wizard localStorage flags */
export async function suppressOnboarding(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('flowstate-onboarding-v2', JSON.stringify({
      seen: true,
      version: 2,
      dismissedAt: new Date().toISOString(),
    }))
    localStorage.setItem('flowstate-welcome-seen', 'true')
    localStorage.setItem('flowstate-settings-v2', JSON.stringify({
      aiSetupComplete: true,
      aiPreferredProvider: 'groq',
    }))
    // Ensure personal workspace so mobile-only routes aren't blocked by workspace guard
    localStorage.setItem('flowstate-last-workspace', 'personal')
  })
}
