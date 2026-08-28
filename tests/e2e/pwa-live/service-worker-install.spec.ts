import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'allow' })

test('live PWA installs the current service worker and bundle', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await page.goto('https://in-theflow.com/?release-check=1461', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3_000)
  await page.waitForLoadState('networkidle')

  const worker = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration('/')
    const active = registration?.active
    const source = active
      ? await fetch(active.scriptURL, { cache: 'no-store' }).then((response) => response.text())
      : ''
    return {
      activeScript: active?.scriptURL ?? null,
      controllerScript: navigator.serviceWorker.controller?.scriptURL ?? null,
      source,
    }
  })

  expect(worker.activeScript).toContain('/sw.js')
  expect(worker.source).toMatch(/index-[A-Za-z0-9_-]+\.js/)
  expect(errors.filter((error) => /Supabase client not initialized|Invalid supabaseUrl|ServiceWorker script.*encountered an error/.test(error))).toEqual([])
  await page.screenshot({ path: '/tmp/flowstate-production-verified.png', fullPage: false })
})
