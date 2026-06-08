#!/usr/bin/env node

const { spawn } = require('node:child_process')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const viteBin = path.join(root, 'node_modules', '.bin', 'vite')
const host = process.env.FLOWSTATE_AI_E2E_HOST || '127.0.0.1'
const port = process.env.FLOWSTATE_AI_E2E_PORT || '5564'

const child = spawn(viteBin, ['--host', host, '--port', port, '--strictPort'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    BROWSER: 'none',
  },
})

let shuttingDown = false

function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  if (!child.killed) child.kill(signal)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

child.on('exit', (code, signal) => {
  if (signal) process.exit(0)
  process.exit(code ?? 0)
})
