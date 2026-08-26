import { expect, test } from '@playwright/test'

test('live PWA installs the current service worker and bundle', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await page.goto('https://in-theflow.com/?release-check=1461', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3_000)

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
  expect(worker.source).toContain('index-DxkvzP9N.js')
  expect(errors.filter((error) => /Supabase client not initialized|Invalid supabaseUrl|ServiceWorker script.*encountered an error/.test(error))).toEqual([])
})
