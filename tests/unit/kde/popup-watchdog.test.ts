import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const MAIN_QML = readFileSync(
  resolve(__dirname, '../../../packages/kde-widget/contents/ui/main.qml'),
  'utf-8',
)

function functionBody(name: string): string {
  const start = MAIN_QML.indexOf(`function ${name}(`)
  expect(start, `${name} not found`).toBeGreaterThan(-1)
  const nextFunction = MAIN_QML.indexOf('\n    function ', start + name.length)
  return MAIN_QML.slice(start, nextFunction === -1 ? undefined : nextFunction)
}

function timerBlock(id: string): string {
  const start = MAIN_QML.indexOf(`id: ${id}`)
  expect(start, `${id} timer not found`).toBeGreaterThan(-1)
  const nextTopLevel = MAIN_QML.indexOf('\n    //', start + id.length)
  return MAIN_QML.slice(start, nextTopLevel === -1 ? start + 900 : nextTopLevel)
}

function windowBlock(id: string): string {
  const idIndex = MAIN_QML.indexOf(`id: ${id}`)
  expect(idIndex, `${id} popup not found`).toBeGreaterThan(-1)
  const previousWindow = MAIN_QML.lastIndexOf('Window {', idIndex)
  expect(previousWindow, `${id} Window block not found`).toBeGreaterThan(-1)
  const nextWindow = MAIN_QML.indexOf('\n    Window {', idIndex + id.length)
  return MAIN_QML.slice(previousWindow, nextWindow === -1 ? undefined : nextWindow)
}

describe('KDE popup watchdog regression contract', () => {
  it('defines bounded lifetimes for every always-on-top popup', () => {
    expect(MAIN_QML).toContain('property real overlayShownAt: 0')
    expect(MAIN_QML).toContain('property real nannyShownAt: 0')
    expect(MAIN_QML).toContain('property real nudgeShownAt: 0')
    expect(MAIN_QML).toContain('property real preEndShownAt: 0')
    expect(MAIN_QML).toContain('readonly property int overlayMaxMs')
    expect(MAIN_QML).toContain('readonly property int nannyMaxMs')
    expect(MAIN_QML).toContain('readonly property int nudgeMaxMs')
    expect(MAIN_QML).toContain('readonly property int preEndMaxMs')
  })

  it('runs a watchdog timer continuously instead of relying on popup dismissal callbacks', () => {
    const block = timerBlock('popupWatchdog')

    expect(block).toContain('interval: 5000')
    expect(block).toContain('running: true')
    expect(block).toContain('repeat: true')
    expect(block).toContain('onTriggered: root.hideAllPopups(false)')
  })

  it('force-hides every popup and clears completion notification state', () => {
    const body = functionBody('hideAllPopups')

    for (const popupId of [
      'fullScreenOverlay',
      'nannyPopup',
      'nudgePopup',
      'preEndWarningPopup',
    ]) {
      expect(body).toContain(`${popupId}.visible`)
      expect(body).toContain(`${popupId}.visible = false`)
    }

    expect(body).toContain('root.sessionJustCompleted = false')
    expect(body).toContain('root.dismissSystemNotification()')
  })

  it('records show timestamps for each popup so the watchdog can expire stale windows', () => {
    const expectations = [
      ['fullScreenOverlay', 'overlayShownAt'],
      ['nannyPopup', 'nannyShownAt'],
      ['nudgePopup', 'nudgeShownAt'],
      ['preEndWarningPopup', 'preEndShownAt'],
    ] as const

    for (const [popupId, timestampProperty] of expectations) {
      const block = windowBlock(popupId)
      expect(block).toContain('onVisibleChanged:')
      expect(block).toContain(`root.${timestampProperty} = visible ? Date.now() : 0`)
    }
  })
})
