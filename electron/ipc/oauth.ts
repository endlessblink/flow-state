import { ipcMain } from 'electron'
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http'
import { isOAuthCallbackUrl } from './oauthValidation'

// Must match the documented Google/Supabase allow-listed loopback redirects.
// See docs/GOOGLE-CLOUD-SETUP.md and src/composables/useTauriOAuth.ts.
const OAUTH_PORTS = [24892, 24893, 24894]
const OAUTH_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

let activeServer: Server | null = null
let cancelPendingWait: (() => void) | null = null

function cancelActiveOAuth() {
  if (cancelPendingWait) {
    cancelPendingWait()
  } else if (activeServer) {
    activeServer.close()
    activeServer = null
  }
}

const SUCCESS_HTML = `<!DOCTYPE html>
<html><head><style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
display:flex;justify-content:center;align-items:center;
height:100vh;margin:0;background:#1a1a2e;color:#e0e0e0}
.c{text-align:center}h2{color:#4ECDC4;margin-bottom:8px}p{opacity:.7}
</style></head><body><div class="c">
<h2>Authentication Successful</h2>
<p>You can close this tab and return to FlowState.</p>
</div></body></html>`

function startServer(port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject)
      resolve(server)
    })
  })
}

export function registerOAuthHandlers() {
  // Start localhost OAuth server, returns the port
  ipcMain.handle('oauth:start', async () => {
    // Clean up any previous server
    cancelActiveOAuth()

    // Try each port until one works
    let server: Server | null = null
    let port = 0
    for (const p of OAUTH_PORTS) {
      try {
        server = await startServer(p)
        port = p
        break
      } catch {
        // Port in use, try next
      }
    }

    if (!server) {
      throw new Error('Failed to start OAuth server — all ports in use')
    }

    activeServer = server
    console.log(`[ELECTRON-OAUTH] Server listening on port ${port}`)
    return port
  })

  // Wait for the OAuth callback, returns the full callback URL
  ipcMain.handle('oauth:waitForCallback', async () => {
    if (!activeServer) {
      throw new Error('OAuth server not started')
    }
    if (cancelPendingWait) throw new Error('OAuth callback wait already in progress')

    const server = activeServer

    return new Promise<string>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout)
        server.removeListener('request', onRequest)
        server.close()
        if (activeServer === server) activeServer = null
        if (cancelPendingWait === cancel) cancelPendingWait = null
      }
      const cancel = () => {
        cleanup()
        reject(new Error('OAuth cancelled'))
      }
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error('OAuth timed out — no response received within 5 minutes'))
      }, OAUTH_TIMEOUT_MS)

      const onRequest = (req: IncomingMessage, res: ServerResponse) => {
        const url = `http://127.0.0.1${req.url || '/'}`

        if (!isOAuthCallbackUrl(url)) {
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end('Waiting for the OAuth callback.')
          return
        }

        // Send success page to the browser
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(SUCCESS_HTML)

        // Clean up
        cleanup()

        resolve(url)
      }
      cancelPendingWait = cancel
      server.on('request', onRequest)
    })
  })

  // Cancel/cleanup
  ipcMain.handle('oauth:cancel', async () => {
    cancelActiveOAuth()
  })
}
