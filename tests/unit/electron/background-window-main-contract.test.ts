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
    expect(source).toContain("window.webContents.once('did-finish-load'")
    expect(source).toContain('backgroundLifecycle.handleLoadFinished(window, process.argv)')
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

  it('TASK-2114: background launches live in the tray with Open and a real Quit', () => {
    expect(source).toContain('if (backgroundEnabled) createTray()')
    const trayStart = source.indexOf('function createTray()')
    const trayBody = source.slice(trayStart, trayStart + 700)
    expect(trayBody).toContain("join(__dirname, '../dist/icons/pwa-64x64.png')")
    expect(trayBody).toContain("{ label: 'Open FlowState', click: () => backgroundLifecycle.showOrCreate() }")
    expect(trayBody).toContain("{ label: 'Quit FlowState', click: forceQuit }")
    expect(trayBody).toContain("tray.on('click', () => backgroundLifecycle.showOrCreate())")
  })

  it('TASK-2114: the login service starts FlowState hidden in the tray', () => {
    const unit = readFileSync(
      resolve(process.cwd(), 'infra/electron-background/flowstate-background.service'),
      'utf8',
    )
    expect(unit).toContain(
      'ExecStart=%h/.local/bin/FlowState-launch.sh --background --user-data-dir=%h/.config/flow-state',
    )
    expect(unit).toContain('Restart=on-failure')
    expect(unit).toContain('RestartPreventExitStatus=75')
    expect(unit).toContain('WantedBy=graphical-session.target')
  })

  it('keeps runtime visibility diagnostics bound to the current window', () => {
    const runtimeSource = readFileSync(resolve(process.cwd(), 'electron/runtimeDiagnostics.ts'), 'utf8')
    expect(runtimeSource).toContain('const currentWindow = getWindow()')
    expect(runtimeSource).toContain('currentWindow && !currentWindow.isDestroyed() && currentWindow.isVisible()')
    expect(runtimeSource).not.toContain('window && !window.isDestroyed() && window.isVisible()')
  })
})
