const { spawnSync } = require('node:child_process')

function createVitestEnvironment(environment = process.env) {
  return { ...environment, TZ: 'Asia/Jerusalem' }
}

if (require.main === module) {
  const result = spawnSync(
    process.execPath,
    [require.resolve('vitest/vitest.mjs'), 'run', '--maxWorkers=4', ...process.argv.slice(2)],
    { env: createVitestEnvironment(), stdio: 'inherit' }
  )

  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
}

module.exports = { createVitestEnvironment }
