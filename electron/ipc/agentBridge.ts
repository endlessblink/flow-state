import { ipcMain } from 'electron'
import { agentBridgeState } from '../agentBridgeState'
import { startAgentBridgeServer, stopAgentBridgeServer, registerAgentBridgeResponseHandler } from '../agentBridgeServer'
import type { BrowserWindow } from 'electron'

export function registerAgentBridgeHandlers(getMainWindow: () => BrowserWindow | null) {
  ipcMain.handle('agent:status', async () => agentBridgeState.getStatus())
  ipcMain.handle('agent:enable', async () => {
    const window = getMainWindow()
    if (!window) throw new Error('FlowState window is not available')
    await startAgentBridgeServer(window)
    return agentBridgeState.getStatus()
  })
  ipcMain.handle('agent:disable', async () => {
    await stopAgentBridgeServer()
    return agentBridgeState.getStatus()
  })
  registerAgentBridgeResponseHandler()
}
