describe('FlowState Smoke Test', () => {
  it('should load the app', async () => {
    await browser.waitUntil(
      async () => (await $('body')).isExisting(),
      { timeout: 15000, timeoutMsg: 'App body did not appear within 15s' }
    )
  })

  it('should have a title', async () => {
    const title = await browser.getTitle()
    console.log('App title:', title)
  })

  it('should wait for app initialization and read task count', async () => {
    // Wait for the app to fully initialize (auth, data load)
    await browser.pause(5000)

    // Try multiple approaches to read task data
    const result = await browser.execute(() => {
      // Approach 1: Vue devtools hook
      const app = document.querySelector('#app')?.__vue_app__
      if (app) {
        const pinia = app.config.globalProperties.$pinia
        if (pinia) {
          const tasksState = pinia.state.value.tasks
          if (tasksState) {
            const raw = tasksState._rawTasks || []
            const uniqueIds = new Set(raw.map(t => t.id)).size
            return {
              source: 'vue_app',
              rawTasksCount: raw.length,
              uniqueIds: uniqueIds,
              duplicateCount: raw.length - uniqueIds,
              sampleIds: raw.slice(0, 5).map(t => t.id?.slice(0, 8)),
              filteredTasksCount: tasksState.filteredTasks?.length ?? 'N/A'
            }
          }
        }
      }

      // Approach 2: Check __pinia on window
      if (window.__pinia) {
        const tasksState = window.__pinia.state.value.tasks
        return {
          source: 'window.__pinia',
          rawTasksCount: tasksState?._rawTasks?.length ?? -1
        }
      }

      return { error: 'Could not access Pinia store' }
    })
    console.log('Tasks state:', JSON.stringify(result, null, 2))
  })

  it('should check inbox badge count', async () => {
    // Navigate to canvas view
    await browser.execute(() => { window.location.hash = '#/canvas' })
    await browser.pause(3000)

    const badgeEl = await $('.inbox-header .n-badge')
    if (await badgeEl.isExisting()) {
      const badgeText = await badgeEl.getText()
      console.log('Inbox badge value:', badgeText)
    } else {
      console.log('Inbox badge not found')
    }
  })

  it('should read IndexedDB cache size', async () => {
    const result = await browser.execute(async () => {
      try {
        // Open the Dexie DB directly
        return new Promise((resolve) => {
          const req = indexedDB.open('FlowStateReadCache')
          req.onsuccess = (e) => {
            const db = e.target.result
            const storeNames = Array.from(db.objectStoreNames)
            if (!storeNames.includes('tasks')) {
              resolve({ error: 'No tasks store', stores: storeNames })
              return
            }
            const tx = db.transaction('tasks', 'readonly')
            const store = tx.objectStore('tasks')
            const countReq = store.count()
            countReq.onsuccess = () => {
              resolve({
                indexedDBTaskCount: countReq.result,
                stores: storeNames
              })
            }
            countReq.onerror = () => resolve({ error: 'count failed' })
          }
          req.onerror = () => resolve({ error: 'Failed to open DB' })
        })
      } catch (e) {
        return { error: String(e) }
      }
    })
    console.log('IndexedDB state:', JSON.stringify(result, null, 2))
  })

  it('should check version', async () => {
    const version = await browser.execute(() => {
      // Check package version from meta tag or app config
      const metaVersion = document.querySelector('meta[name="version"]')?.content
      // Check from Vite env
      const buildVersion = window.__BUILD_VERSION__ || 'unknown'
      return { metaVersion, buildVersion }
    })
    console.log('Version info:', JSON.stringify(version))
  })
})
