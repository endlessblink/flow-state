describe('Badge Debug', () => {
  it('should trace the badge inflation', async () => {
    // Wait for data load
    await browser.pause(5000)

    // Navigate to canvas (which has inbox panel)
    await browser.execute(() => { window.location.hash = '#/canvas' })
    await browser.pause(3000)

    const result = await browser.execute(() => {
      const app = document.querySelector('#app')?.__vue_app__
      if (!app) return { error: 'No Vue app' }
      const pinia = app.config.globalProperties.$pinia
      if (!pinia) return { error: 'No Pinia' }
      const tasksState = pinia.state.value.tasks
      if (!tasksState) return { error: 'No tasks state' }

      const raw = tasksState._rawTasks || []

      // Check filteredTasks via getter
      // In Pinia, getters are accessible directly on the store
      // But state.value only has state, not getters.
      // We need to access the actual store instance.

      // Try finding the tasks store from app provides
      let taskStore = null
      try {
        // Pinia stores are keyed by their id
        const storeMap = pinia._s
        if (storeMap) {
          taskStore = storeMap.get('tasks')
        }
      } catch(e) {}

      if (!taskStore) return { error: 'Could not get task store instance', rawCount: raw.length }

      // Read computed values from the store
      const filteredTasks = taskStore.filteredTasks
      const calendarFilteredTasks = taskStore.calendarFilteredTasks

      // Now check the inbox state
      // The baseInboxTasks is a computed in useUnifiedInboxState composable
      // It filters from filteredTasks. Let's simulate it.
      const inboxTasks = filteredTasks.filter(task => {
        if (task.status === 'done') return false
        if (task._soft_deleted) return false
        if (task.isPinned) return false
        // Canvas inbox: hide tasks on canvas
        if (task.canvasPosition) return false
        if (!task.isInInbox) return false
        return true
      })

      return {
        rawTasksCount: raw.length,
        rawUniqueIds: new Set(raw.map(t => t.id)).size,
        filteredTasksCount: filteredTasks?.length ?? 'N/A',
        filteredUniqueIds: filteredTasks ? new Set(filteredTasks.map(t => t.id)).size : 'N/A',
        calendarFilteredCount: calendarFilteredTasks?.length ?? 'N/A',
        simulatedInboxCount: inboxTasks.length,
        // Check if filteredTasks has duplicates
        filteredDuplicates: filteredTasks ? filteredTasks.length - new Set(filteredTasks.map(t => t.id)).size : 'N/A',
        // Sample some task IDs from filtered to check for patterns
        filteredSample: filteredTasks?.slice(0, 3).map(t => ({ id: t.id?.slice(0, 8), title: t.title?.slice(0, 20) })),
        // Check _rawTasks isInInbox count
        rawInboxCount: raw.filter(t => t.isInInbox && t.status !== 'done' && !t.canvasPosition).length,
        // Check tasks getter (which is actually filteredTasks in the store)
        tasksGetterLength: taskStore.tasks?.length ?? 'N/A',
      }
    })
    console.log('Badge debug result:', JSON.stringify(result, null, 2))
  })
})
