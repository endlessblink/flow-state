#!/usr/bin/env node
const { spawnSync } = require('node:child_process')
const { join } = require('node:path')

const result = spawnSync(process.execPath, [
  join(__dirname, 'recurring-issue-guard.cjs'),
  '--mode',
  'precommit',
], {
  encoding: 'utf8',
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
