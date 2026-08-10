import { test, expect, chromium, devices, type BrowserContext, type Page } from '@playwright/test'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'

const SITE_URL = 'https://in-theflow.com'

async function enableStandaloneSimulation(context: BrowserContext) {
  await context.addInitScript(() => {
    const originalMatchMedia = window.matchMedia.bind(window)

    window.matchMedia = (query: string) => {
      if (query === '(display-mode: standalone)') {
        return {
          matches: true,
          media: query,
          onchange: null,
          addListener() {},
          removeListener() {},
          addEventListener() {},
          removeEventListener() {},
          dispatchEvent() {
            return true
          },
        } as MediaQueryList
      }

      return originalMatchMedia(query)
    }

    Object.defineProperty(navigator, 'standalone', {
      configurable: true,
      get: () => true,
    })
  })
}

function attachFailureCollectors(page: Page) {
  const failedRequests: string[] = []
  const pageErrors: string[] = []

  page.on('requestfailed', request => {
    failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`)
  })

  page.on('pageerror', error => {
    pageErrors.push(String(error))
  })

  return { failedRequests, pageErrors }
}

async function readAppState(page: Page) {
  return await page.evaluate(async () => {
    const registration = await navigator.serviceWorker?.ready.catch(() => null)
    const manifestHref = document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? null
    const [manifestResponse, serviceWorkerResponse] = await Promise.all([
      manifestHref ? fetch(manifestHref, { cache: 'no-store' }).catch(() => null) : Promise.resolve(null),
      fetch('/sw.js', { cache: 'no-store' }).catch(() => null),
    ])
    const manifestText = manifestResponse ? await manifestResponse.text().catch(() => '') : ''
    const serviceWorkerText = serviceWorkerResponse ? await serviceWorkerResponse.text().catch(() => '') : ''
    return {
      href: location.href,
      route: location.hash,
      title: document.title,
      hasLoader: !!document.querySelector('#fs-loader'),
      bodyText: document.body?.innerText?.slice(0, 250) ?? '',
      isStandalone: document.documentElement.classList.contains('pwa-app'),
      hasController: !!navigator.serviceWorker?.controller,
      scope: registration?.scope ?? null,
      manifestHref,
      manifestStatus: manifestResponse?.status ?? null,
      manifestContentType: manifestResponse?.headers.get('content-type') ?? null,
      manifestIsJson: manifestText.trimStart().startsWith('{'),
      serviceWorkerStatus: serviceWorkerResponse?.status ?? null,
      serviceWorkerContentType: serviceWorkerResponse?.headers.get('content-type') ?? null,
      serviceWorkerHasWorkbox: /workbox/i.test(serviceWorkerText),
      serviceWorkerScriptUrl: registration?.active?.scriptURL ?? null,
    }
  })
}

function expectRuntimeAssets(state: Awaited<ReturnType<typeof readAppState>>) {
  expect(state.manifestHref).toBeTruthy()
  expect(state.manifestStatus).toBe(200)
  expect(state.manifestContentType).toBeTruthy()
  expect(state.manifestIsJson).toBe(true)
  if (state.serviceWorkerStatus === 200) {
    expect(state.serviceWorkerContentType).toBeTruthy()
    expect(state.serviceWorkerHasWorkbox).toBe(true)
  } else {
    expect(state.serviceWorkerScriptUrl).toContain('/sw.js')
  }
}

test('live site boots in browser, standalone simulation, and offline reload', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'allow' })
  await enableStandaloneSimulation(context)

  const page = await context.newPage()
  const { failedRequests, pageErrors } = attachFailureCollectors(page)

  await page.goto(SITE_URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(5000)

  const initialState = await readAppState(page)

  expect(initialState.title).toContain('FlowState')
  expect(initialState.hasLoader).toBe(false)
  expect(initialState.isStandalone).toBe(true)
  expect(initialState.hasController).toBe(true)
  expect(initialState.bodyText).toContain('FlowState')
  expectRuntimeAssets(initialState)

  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  const offlineState = await readAppState(page)

  expect(offlineState.hasLoader).toBe(false)
  expect(offlineState.hasController).toBe(true)
  expect(offlineState.bodyText).toContain('FlowState')
  expect(offlineState.route).toBe(initialState.route)
  expectRuntimeAssets(offlineState)

  console.log(JSON.stringify({ initialState, offlineState, pageErrors, failedRequests }, null, 2))

  await context.close()
})

test('mobile standalone route boots and survives offline reload', async ({ browser }) => {
  const context = await browser.newContext({
    ...devices['iPhone 14 Pro Max'],
    serviceWorkers: 'allow',
  })
  await enableStandaloneSimulation(context)

  const page = await context.newPage()
  const { failedRequests, pageErrors } = attachFailureCollectors(page)

  await page.goto(`${SITE_URL}/#/tasks`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(5000)

  const initialState = await readAppState(page)

  expect(initialState.route).toBe('#/tasks')
  expect(initialState.hasLoader).toBe(false)
  expect(initialState.isStandalone).toBe(true)
  expect(initialState.hasController).toBe(true)
  expect(initialState.bodyText).toContain('FlowState')
  expect(initialState.bodyText).toContain('Tasks')
  expectRuntimeAssets(initialState)

  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  const offlineState = await readAppState(page)

  expect(offlineState.route).toBe('#/tasks')
  expect(offlineState.hasLoader).toBe(false)
  expect(offlineState.hasController).toBe(true)
  expect(offlineState.bodyText).toContain('Tasks')
  expectRuntimeAssets(offlineState)

  console.log(JSON.stringify({ initialState, offlineState, pageErrors, failedRequests }, null, 2))

  await context.close()
})

test('repeated standalone reloads keep service worker control', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'allow' })
  await enableStandaloneSimulation(context)

  const page = await context.newPage()
  const { failedRequests, pageErrors } = attachFailureCollectors(page)

  await page.goto(SITE_URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(5000)

  const snapshots: Array<Awaited<ReturnType<typeof readAppState>>> = []

  for (let i = 0; i < 4; i += 1) {
    if (i > 0) {
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForTimeout(2000)
    }

    const state = await readAppState(page)
    snapshots.push(state)

    expect(state.hasLoader).toBe(false)
    expect(state.hasController).toBe(true)
    expect(state.isStandalone).toBe(true)
    expect(state.bodyText).toContain('FlowState')
    expectRuntimeAssets(state)
  }

  expect(new Set(snapshots.map(snapshot => snapshot.route)).size).toBe(1)

  console.log(JSON.stringify({ snapshots, pageErrors, failedRequests }, null, 2))

  await context.close()
})

test('persistent profile keeps service worker and manifest across sessions', async () => {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flowstate-pwa-'))

  try {
    const firstContext = await chromium.launchPersistentContext(userDataDir, {
      ...devices['Desktop Chrome'],
      headless: true,
      serviceWorkers: 'allow',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    })
    await enableStandaloneSimulation(firstContext)

    const firstPage = firstContext.pages()[0] ?? await firstContext.newPage()
    await firstPage.goto(SITE_URL, { waitUntil: 'networkidle' })
    await firstPage.waitForTimeout(5000)
    const firstState = await readAppState(firstPage)
    await firstContext.close()

    const secondContext = await chromium.launchPersistentContext(userDataDir, {
      ...devices['Desktop Chrome'],
      headless: true,
      serviceWorkers: 'allow',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    })
    await enableStandaloneSimulation(secondContext)

    const secondPage = secondContext.pages()[0] ?? await secondContext.newPage()
    await secondPage.goto(SITE_URL, { waitUntil: 'networkidle' })
    await secondPage.waitForTimeout(3000)
    const secondState = await readAppState(secondPage)
    await secondContext.close()

    expect(firstState.hasController).toBe(true)
    expect(secondState.hasController).toBe(true)
    expect(firstState.manifestHref).toBeTruthy()
    expect(secondState.manifestHref).toBeTruthy()
    expect(secondState.hasLoader).toBe(false)
    expect(secondState.bodyText).toContain('FlowState')
    expectRuntimeAssets(firstState)
    expectRuntimeAssets(secondState)

    console.log(JSON.stringify({ firstState, secondState }, null, 2))
  } finally {
    await fs.rm(userDataDir, { recursive: true, force: true })
  }
})
