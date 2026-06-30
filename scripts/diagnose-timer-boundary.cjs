#!/usr/bin/env node
'use strict'

const fs = require('fs')
const http = require('http')
const https = require('https')
const { execFileSync } = require('child_process')
const { join } = require('path')

const ROOT = process.cwd()
const LOCAL_API = process.env.FLOWSTATE_LOCAL_API_URL || 'http://127.0.0.1:5577'
const PUBLIC_MANIFEST = 'https://in-theflow.com/updates/electron/latest-linux.yml'
const ACTIVE_TASK_FILE = '/tmp/flowstate-active-task.json'

function getText(url, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const client = url.startsWith('https:') ? https : http
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      let raw = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => {
        raw += chunk
      })
      res.on('end', () => {
        resolve({ ok: true, status: res.statusCode, body: raw.trim() })
      })
    })
    req.on('timeout', () => {
      req.destroy(new Error('timeout'))
    })
    req.on('error', (error) => {
      resolve({ ok: false, error: error.message })
    })
  })
}

function readText(path) {
  try {
    return fs.readFileSync(path, 'utf8').trim()
  } catch (error) {
    return `[unavailable: ${error.message}]`
  }
}

function readPackageVersion() {
  try {
    return JSON.parse(readText(join(ROOT, 'package.json'))).version || 'unknown'
  } catch {
    return 'unknown'
  }
}

function matchingProcesses() {
  try {
    const output = execFileSync('ps', ['-eo', 'pid,ppid,lstart,cmd'], { encoding: 'utf8' })
    return output
      .split('\n')
      .filter((line) => /flowstate|FlowState|local-api-server|5577|AppImage/i.test(line))
      .join('\n')
  } catch (error) {
    return `[unavailable: ${error.message}]`
  }
}

function extractVersion(yml) {
  const match = String(yml || '').match(/^version:\s*(.+)$/m)
  return match ? match[1].trim() : 'unknown'
}

async function main() {
  const diagnostics = await getText(`${LOCAL_API}/api/timer/diagnostics`)
  const current = await getText(`${LOCAL_API}/api/timer/current`)
  const publicManifest = await getText(PUBLIC_MANIFEST)
  const localManifest = readText(join(ROOT, 'release', 'latest-linux.yml'))

  const report = {
    capturedAt: new Date().toISOString(),
    packageVersion: readPackageVersion(),
    localReleaseVersion: extractVersion(localManifest),
    publicReleaseVersion: publicManifest.ok ? extractVersion(publicManifest.body) : 'unavailable',
    localApiUrl: LOCAL_API,
    timerDiagnostics: diagnostics,
    timerCurrent: current,
    kdeActiveTaskFile: readText(ACTIVE_TASK_FILE),
    matchingProcesses: matchingProcesses(),
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
