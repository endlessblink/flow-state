import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'electron/main.ts'), 'utf8')

describe('Electron main background-window integration', () => {
  it('keeps the authenticated renderer alive for supervised visible launches', () => {
    expect(source).toContain("from './backgroundWindowLifecycle'")
    expect(source).toContain('createBackgroundWindowLifecycle({')
    expect(source).toContain('isBackgroundLaunch(process.argv)')
    expect(source).toContain('backgroundLifecycle.handleReadyToShow(window, process.argv)')
    expect(source).toContain("window.on('close', (event) => {")
    expect(source).toContain('backgroundLifecycle.handleClose(event, window)')
    expect(source).toContain('backgroundThrottling: false')
    expect(source).toContain('if (!backgroundEnabled) window.show()')
  })

  it('shows the same managed window for activate and second-instance', () => {
    const activateStart = source.indexOf("app.on('activate'")
    const secondStart = source.indexOf("app.on('second-instance'")
    expect(source.slice(activateStart, activateStart + 220)).toContain(
      'backgroundLifecycle.showOrCreate()',
    )
    expect(source.slice(secondStart, secondStart + 180)).toContain(
      'backgroundLifecycle.showOrCreate()',
    )
  })

  it('marks explicit quit before closing the window', () => {
    const quitStart = source.indexOf('function forceQuit()')
    const quitBody = source.slice(quitStart, quitStart + 180)
    expect(quitBody).toContain('backgroundLifecycle.beginQuit()')
    expect(quitBody.indexOf('backgroundLifecycle.beginQuit()')).toBeLessThan(
      quitBody.indexOf('app.quit()'),
    )
  })

  it('routes supervisor termination signals through the durable quit gate', () => {
    expect(source).toContain("process.on('SIGTERM', requestGracefulSignalQuit)")
    expect(source).toContain("process.on('SIGINT', requestGracefulSignalQuit)")
    const handlerStart = source.indexOf('function requestGracefulSignalQuit()')
    const handler = source.slice(handlerStart, handlerStart + 240)
    expect(handler).toContain('signalQuitRequested = true')
    expect(handler).toContain('forceQuit()')
  })
})
