import { chromium } from 'playwright'

const electronCdpUrl = process.env.ELECTRON_CDP_URL || 'http://127.0.0.1:9229'
const pwaUrl = process.env.FLOWSTATE_PWA_URL || 'https://in-theflow.com/#/catalog'
const browserExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium'

const electronBrowser = await chromium.connectOverCDP(electronCdpUrl)
const electronPage = electronBrowser.contexts()[0]?.pages().find(page => page.url().includes('in-theflow.com'))
if (!electronPage) throw new Error('No authenticated Electron page available')

const authStorage = await electronPage.evaluate(() => Object.entries(localStorage))
const pwaBrowser = await chromium.launch({ headless: true, executablePath: browserExecutable })
const pwaContext = await pwaBrowser.newContext()
await pwaContext.addInitScript(entries => {
  for (const [key, value] of entries) localStorage.setItem(key, value)
}, authStorage)
const pwaPage = await pwaContext.newPage()

const readTask = page => page.evaluate(() => {
  const root = document.querySelector('#app')
  const pinia = root?.__vue_app__?._context.config.globalProperties.$pinia
  const store = pinia?._s.get('tasks')
  const task = (store?.rawTasks || []).find(item => item.status !== 'done' && typeof item.title === 'string')
  return task ? { id: task.id, title: task.title } : null
})

const readIdentity = page => page.evaluate(() => {
  const root = document.querySelector('#app')
  const pinia = root?.__vue_app__?._context.config.globalProperties.$pinia
  const auth = pinia?._s.get('auth')
  return { userId: auth?.user?.id || null, authenticated: !!auth?.isAuthenticated, storageKeys: Object.keys(localStorage) }
})

const updateTask = (page, taskId, title) => page.evaluate(async ({ taskId: id, title: nextTitle }) => {
  const root = document.querySelector('#app')
  const pinia = root?.__vue_app__?._context.config.globalProperties.$pinia
  const store = pinia?._s.get('tasks')
  await store.updateTask(id, { title: nextTitle }, 'USER')
}, { taskId, title })

const waitForTaskTitle = (page, taskId, title) => page.waitForFunction(({ id, expectedTitle }) => {
  const root = document.querySelector('#app')
  const pinia = root?.__vue_app__?._context.config.globalProperties.$pinia
  const store = pinia?._s.get('tasks')
  return (store?.rawTasks || []).some(task => task.id === id && task.title === expectedTitle)
}, { id: taskId, expectedTitle: title }, { timeout: 30_000 })

await pwaPage.goto(pwaUrl, { waitUntil: 'domcontentloaded' })
await pwaPage.waitForFunction(() => !!document.querySelector('#app')?.__vue_app__?._context.config.globalProperties.$pinia?._s.get('tasks'), null, { timeout: 30_000 })
await pwaPage.waitForFunction(() => {
  const store = document.querySelector('#app')?.__vue_app__?._context.config.globalProperties.$pinia?._s.get('tasks')
  return (store?.rawTasks || []).length > 0
}, null, { timeout: 30_000 }).catch(() => undefined)
await pwaPage.waitForTimeout(2_000)

const sourceTask = await readTask(electronPage)
if (!sourceTask) throw new Error('Authenticated Electron task projection is empty')
const pwaTask = await readTask(pwaPage)
if (!pwaTask || pwaTask.id !== sourceTask.id) {
  throw new Error(`Authenticated PWA task projection does not overlap Electron: ${JSON.stringify({ sourceTask, pwaTask, electronIdentity: await readIdentity(electronPage), pwaIdentity: await readIdentity(pwaPage), url: pwaPage.url(), body: (await pwaPage.locator('body').innerText()).slice(0, 240) })}`)
}

const marker = `${sourceTask.title} [sync-proof-${Date.now()}]`
let forwardMs = null
let reverseMs = null
let offlineMs = null
let modified = false
try {
  const startedAt = Date.now()
  await updateTask(pwaPage, sourceTask.id, marker)
  modified = true
  await waitForTaskTitle(electronPage, sourceTask.id, marker)
  forwardMs = Date.now() - startedAt
  await updateTask(electronPage, sourceTask.id, sourceTask.title)
  await waitForTaskTitle(pwaPage, sourceTask.id, sourceTask.title)
  modified = false

  const reverseMarker = `${sourceTask.title} [electron-sync-proof-${Date.now()}]`
  const reverseStartedAt = Date.now()
  await updateTask(electronPage, sourceTask.id, reverseMarker)
  modified = true
  await waitForTaskTitle(pwaPage, sourceTask.id, reverseMarker)
  reverseMs = Date.now() - reverseStartedAt

  const offlineMarker = `${sourceTask.title} [offline-sync-proof-${Date.now()}]`
  await pwaContext.setOffline(true)
  try {
    await updateTask(pwaPage, sourceTask.id, offlineMarker)
    await waitForTaskTitle(pwaPage, sourceTask.id, offlineMarker)
  } finally {
    await pwaContext.setOffline(false)
  }
  modified = true
  const offlineStartedAt = Date.now()
  await waitForTaskTitle(electronPage, sourceTask.id, offlineMarker)
  offlineMs = Date.now() - offlineStartedAt
} finally {
  if (modified) {
    await updateTask(electronPage, sourceTask.id, sourceTask.title)
    await waitForTaskTitle(pwaPage, sourceTask.id, sourceTask.title)
  }
}

console.log(JSON.stringify({
  electronVersion: await electronPage.evaluate(() => navigator.userAgent.match(/flow-state\/([^ ]+)/)?.[1] || null),
  pwaUrl: pwaPage.url(),
  taskId: sourceTask.id,
  propagatedWithoutReload: true,
  forwardMs,
  reverseMs,
  offlineMs,
  restored: true,
}, null, 2))

await pwaBrowser.close()
await electronBrowser.close()
