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

  it('TASK-2114: the hidden app adds no tray icon of its own; the PomoFlow widget is the one control', () => {
    expect(source).not.toMatch(/new Tray\(/)
    const widget = readFileSync(resolve(process.cwd(), 'packages/kde-widget/contents/ui/main.qml'), 'utf8')
    expect(widget).toContain('Plasmoid.contextualActions: [')
    expect(widget).toContain('text: "Open FlowState"')
    expect(widget).toContain('onTriggered: executableDataSource.connectSource(root.backgroundOpenCmd)')
    expect(widget).toContain('onTriggered: executableDataSource.connectSource(root.backgroundQuitCmd)')
    expect(widget).toContain('        executableDataSource.connectSource(root.backgroundServiceStartCmd)\n        root.loadAuthTokens()')
    expect(widget).toContain('"systemctl --user start flowstate-background.service"')
    // Quit must TERM the Electron main process (graceful flush, exit 0), never kill the service.
    expect(widget).toContain("pkill -TERM -f '/[.]mount_FlowSt[^ ]*/flowstate --no-sandbox'")
    expect(widget).not.toContain('systemctl --user stop flowstate-background.service')
    // Open keeps the TASK-1871 launcher flags by going through the launcher script.
    expect(widget).toContain('$HOME/.local/bin/FlowState-launch.sh')
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
