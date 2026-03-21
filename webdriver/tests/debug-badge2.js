describe('Badge Debug v2', () => {
  it('should read baseTasks directly from component', async () => {
    await browser.pause(5000)
    await browser.execute(() => { window.location.hash = '#/canvas' })
    await browser.pause(3000)

    const result = await browser.execute(() => {
      // Find the inbox header component instance via Vue internals
      const header = document.querySelector('.inbox-header')
      if (!header) return { error: 'No inbox header found' }

      // Walk up to find the __vue__ component
      let vnode = header.__vueParentComponent || header._vnode

      // Alternative: find via the NBadge element directly
      const badgeEl = document.querySelector('.inbox-header .n-badge')
      const badgeText = badgeEl?.textContent || 'not found'

      // Try to read the count-summary div
      const countSummary = document.querySelector('.count-summary')
      const countHTML = countSummary?.innerHTML || 'not found'

      // Try to access the UnifiedInboxPanel component
      // Walk up the DOM tree to find Vue component instances
      let el = header
      let componentData = null
      while (el && !componentData) {
        if (el.__vueParentComponent) {
          const comp = el.__vueParentComponent
          const setupState = comp.setupState
          if (setupState) {
            // Look for baseTasks or baseInboxTasks
            const keys = Object.keys(setupState)
            const relevantKeys = keys.filter(k =>
              k.includes('task') || k.includes('Task') || k.includes('inbox') || k.includes('Inbox') || k.includes('base') || k.includes('total')
            )

            const baseTasksRef = setupState.baseInboxTasks || setupState.baseTasks
            const inboxTasksRef = setupState.inboxTasks

            componentData = {
              componentName: comp.type?.name || comp.type?.__name || 'unknown',
              relevantKeys: relevantKeys.slice(0, 20),
              baseInboxTasksLength: baseTasksRef?.value?.length ?? baseTasksRef?.length ?? 'N/A',
              inboxTasksLength: inboxTasksRef?.value?.length ?? inboxTasksRef?.length ?? 'N/A',
            }
          }
        }
        el = el.parentElement
      }

      return {
        badgeText,
        countHTML: countHTML.slice(0, 200),
        componentData,
      }
    })
    console.log('Badge v2 debug:', JSON.stringify(result, null, 2))
  })
})
