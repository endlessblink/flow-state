describe('Badge Debug v3', () => {
  it('should inject diagnostic into the running app', async () => {
    await browser.pause(5000)
    await browser.execute(() => { window.location.hash = '#/canvas' })
    await browser.pause(3000)

    // Inject a MutationObserver to watch the badge value
    // AND directly read baseInboxTasks from the composable
    const result = await browser.execute(() => {
      // Read all n-badge elements and their sup text
      const badges = document.querySelectorAll('.n-badge')
      const badgeValues = Array.from(badges).map(b => ({
        text: b.textContent?.trim(),
        supText: b.querySelector('sup')?.textContent?.trim(),
        html: b.innerHTML?.slice(0, 100)
      }))

      // Read the actual count-summary content
      const countSummary = document.querySelector('.count-summary')
      const countChildren = countSummary ? Array.from(countSummary.children).map(c => ({
        tag: c.tagName,
        class: c.className?.slice(0, 50),
        text: c.textContent?.trim()
      })) : []

      // Check if there are multiple inbox panels rendering
      const inboxHeaders = document.querySelectorAll('.inbox-header')
      const inboxPanels = document.querySelectorAll('.unified-inbox-panel, .calendar-inbox-panel')

      // Look at the sup element inside NBadge — that's where the value renders
      const supEl = countSummary?.querySelector('.n-badge sup')
      const supValue = supEl?.textContent?.trim()

      // Check the NBadge's data-value or any attribute
      const badgeEl = countSummary?.querySelector('.n-badge')
      const badgeAttrs = badgeEl ? Object.fromEntries(
        Array.from(badgeEl.attributes).map(a => [a.name, a.value?.slice(0, 50)])
      ) : {}

      return {
        allBadgeValues: badgeValues,
        countSummaryChildren: countChildren,
        supValue,
        badgeAttrs,
        inboxHeaderCount: inboxHeaders.length,
        inboxPanelCount: inboxPanels.length,
      }
    })
    console.log('Badge v3 debug:', JSON.stringify(result, null, 2))
  })
})
