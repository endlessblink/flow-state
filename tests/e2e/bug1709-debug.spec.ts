import { test, expect } from '../fixtures/auth'
import fs from 'fs'

test('BUG-1709 inbox card spacing', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/#/')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)

  // If error boundary shows, click Reset & Continue
  const resetBtn = page.getByText('Reset & Continue')
  if (await resetBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await resetBtn.click()
    await page.waitForTimeout(2000)
  }

  // Open inbox
  const collapseBtn = page.locator('.collapse-btn').first()
  if (await collapseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await collapseBtn.click()
    await page.waitForTimeout(1500)
  }

  await page.screenshot({ path: '.dev/screenshots/bug1709-inbox-v2.png' })

  // Measure inbox task cards specifically
  const m = await page.evaluate(() => {
    // Look for inbox-specific cards
    const panel = document.querySelector('.unified-inbox-panel, .inbox-panel, [class*="inbox"]')
    const cards = panel ? panel.querySelectorAll('.task-card') : document.querySelectorAll('.task-card')
    if (!cards.length) {
      return { 
        error: 'No .task-card in inbox', 
        panelFound: !!panel,
        panelClass: panel?.className,
        allCards: document.querySelectorAll('.task-card').length
      }
    }
    const results: any[] = []
    for (let i = 0; i < Math.min(cards.length, 3); i++) {
      const el = cards[i] as HTMLElement
      const s = getComputedStyle(el)
      results.push({
        padding: s.padding,
        height: Math.round(el.getBoundingClientRect().height),
        width: Math.round(el.getBoundingClientRect().width),
        actionsInDOM: !!el.querySelector('.task-actions'),
        title: el.querySelector('.task-title')?.textContent?.trim().slice(0, 25)
      })
    }
    // Gap between cards
    let gap = 'N/A'
    if (cards.length >= 2) {
      gap = String(Math.round((cards[1] as HTMLElement).getBoundingClientRect().top - (cards[0] as HTMLElement).getBoundingClientRect().bottom))
    }
    return { cardCount: cards.length, gap, cards: results }
  })
  fs.writeFileSync('.dev/screenshots/bug1709-measurements.json', JSON.stringify(m, null, 2))

  // Hover first inbox card
  const inboxCard = page.locator('.unified-inbox-panel .task-card, .inbox-panel .task-card, .task-card').first()
  if (await inboxCard.isVisible({ timeout: 2000 }).catch(() => false)) {
    await inboxCard.hover()
    await page.waitForTimeout(500)
    const hm = await page.evaluate(() => {
      const card = document.querySelector('.task-card:hover, .task-card')
      return { actionsInDOM: !!card?.querySelector('.task-actions') }
    })
    fs.appendFileSync('.dev/screenshots/bug1709-measurements.json', '\nHOVER: ' + JSON.stringify(hm))
    await page.screenshot({ path: '.dev/screenshots/bug1709-inbox-hover.png' })
  }
})
