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

  it('should read _rawTasks count from Pinia store', async () => {
    const result = await browser.execute(() => {
      // Access Pinia store via window — check if accessible
      const pinia = (window).__pinia
      if (!pinia) return { error: 'Pinia not found on window' }
      const tasksState = pinia.state.value.tasks
      if (!tasksState) return { error: 'Tasks store not found' }
      return {
        rawTasksCount: tasksState._rawTasks?.length ?? -1,
        uniqueIds: new Set(tasksState._rawTasks?.map(t => t.id) ?? []).size
      }
    })
    console.log('Tasks state:', JSON.stringify(result))
  })

  it('should check inbox badge count', async () => {
    // Navigate to canvas view (has inbox panel)
    await browser.execute(() => {
      window.location.hash = '#/canvas'
    })
    await browser.pause(3000) // Wait for canvas to load

    // Read the badge value
    const badgeEl = await $('.inbox-header .n-badge')
    if (await badgeEl.isExisting()) {
      const badgeText = await badgeEl.getText()
      console.log('Inbox badge value:', badgeText)
    } else {
      console.log('Inbox badge not found (may be collapsed)')
    }
  })

  it('should test task deletion on canvas', async () => {
    // Check if there are task nodes on canvas
    const taskNodes = await $$('.vue-flow .task-node')
    console.log('Task nodes on canvas:', taskNodes.length)

    if (taskNodes.length > 0) {
      // Right-click on first task
      await taskNodes[0].click({ button: 'right' })
      await browser.pause(500)

      // Look for delete option in context menu
      const deleteBtn = await $('[data-action="delete"]')
      if (await deleteBtn.isExisting()) {
        console.log('Delete button found in context menu')
      } else {
        console.log('Context menu items:', await $$('.context-menu-item').map(el => el.getText()))
      }
    }
  })

  it('should capture console logs', async () => {
    const logs = await browser.execute(() => {
      return (window).__consoleLogs || []
    })
    console.log('Captured console logs:', logs.length)
    logs.slice(-10).forEach(log => console.log('  >', log))
  })
})
