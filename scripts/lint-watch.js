#!/usr/bin/env node
import { watch } from 'chokidar'
import path from 'path'
import { fileURLToPath } from 'url'

// Use loadESLint to get the FlatESLint class for flat config (ESLint v8.57.0+)
import { loadESLint } from 'eslint'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

// Load FlatESLint for flat config support
const ESLint = await loadESLint({ useFlatConfig: true })
const eslint = new ESLint({
  cwd: projectRoot
})

let debounceTimer = null

// Lint all files and show summary
async function lintAll() {
  console.log('\x1b[36m👀 ESLint watching src/**/*.{ts,vue}...\x1b[0m\n')
  console.log('\x1b[90mRunning initial lint...\x1b[0m\n')

  try {
    const results = await eslint.lintFiles([path.join(projectRoot, 'src/**/*.{ts,tsx,vue}')])

    let totalErrors = 0
    let totalWarnings = 0
    const filesWithIssues = []

    for (const result of results) {
      if (result.messages.length > 0) {
        const relativePath = path.relative(projectRoot, result.filePath)
        filesWithIssues.push({ path: relativePath, messages: result.messages })
        totalErrors += result.errorCount
        totalWarnings += result.warningCount
      }
    }

    // Don't clear on initial lint so output is visible
    console.log('\x1b[36m👀 ESLint watching src/**/*.{ts,vue}...\x1b[0m\n')

    if (filesWithIssues.length > 0) {
      for (const file of filesWithIssues) {
        console.log(`\x1b[33m${file.path}\x1b[0m`)
        file.messages.forEach(msg => {
          const icon = msg.severity === 2 ? '\x1b[31m✖\x1b[0m' : '\x1b[33m⚠\x1b[0m'
          console.log(`  ${icon} ${msg.line}:${msg.column}  ${msg.message}  \x1b[90m${msg.ruleId || 'unknown'}\x1b[0m`)
        })
        console.log('')
      }
      console.log(`\x1b[31m${totalErrors} error(s), ${totalWarnings} warning(s) in ${filesWithIssues.length} file(s)\x1b[0m\n`)
    } else {
      console.log(`\x1b[32m✓\x1b[0m All files pass - No issues\n`)
    }

    console.log('\x1b[90mWaiting for file changes... (Ctrl+C to stop)\x1b[0m\n')
  } catch (error) {
    console.error(`\x1b[31mError:\x1b[0m ${error.message}`)
  }
}

// Lint a single file on change
async function lintFile(filePath) {
  // Only lint .ts, .tsx, and .vue files
  if (!filePath.match(/\.(ts|tsx|vue)$/)) {
    return
  }

  try {
    const results = await eslint.lintFiles([filePath])
    const relativePath = path.relative(projectRoot, filePath)

    // Clear console for fresh output
    console.clear()
    console.log('\x1b[36m👀 ESLint watching src/**/*.{ts,vue}...\x1b[0m\n')

    if (results.length > 0 && results[0].messages.length > 0) {
      console.log(`\x1b[33m${relativePath}\x1b[0m\n`)
      results[0].messages.forEach(msg => {
        const icon = msg.severity === 2 ? '\x1b[31m✖\x1b[0m' : '\x1b[33m⚠\x1b[0m'
        console.log(`  ${icon} ${msg.line}:${msg.column}  ${msg.message}`)
        console.log(`    \x1b[90m${msg.ruleId || 'unknown'}\x1b[0m\n`)
      })
      console.log(`\x1b[31m${results[0].errorCount} error(s), ${results[0].warningCount} warning(s)\x1b[0m`)
    } else {
      console.log(`\x1b[32m✓\x1b[0m ${relativePath} - No issues`)
    }

    console.log('\n\x1b[90mWaiting for file changes...\x1b[0m')
  } catch (error) {
    console.error(`\x1b[31mError:\x1b[0m ${error.message}`)
  }
}

function debouncedLint(filePath) {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => lintFile(filePath), 300)
}

// Run initial lint
await lintAll()

// Start watching for changes
const watcher = watch(path.join(projectRoot, 'src'), {
  ignored: /node_modules/,
  persistent: true,
  ignoreInitial: true,
})
  .on('add', debouncedLint)
  .on('change', debouncedLint)

process.on('SIGINT', async () => {
  console.log('\n\x1b[90mStopping watcher...\x1b[0m')
  await watcher.close()
  process.exit(0)
})
