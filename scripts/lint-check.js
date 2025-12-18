#!/usr/bin/env node
// Simple one-time lint check without watching
import path from 'path'
import { fileURLToPath } from 'url'
import { loadESLint } from 'eslint'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

console.log('Loading ESLint...')
const ESLint = await loadESLint({ useFlatConfig: true })
const eslint = new ESLint({ cwd: projectRoot })

console.log('Running lint on src/**/*.{ts,tsx,vue}...\n')
const results = await eslint.lintFiles([path.join(projectRoot, 'src/**/*.{ts,tsx,vue}')])

let totalErrors = 0
let totalWarnings = 0
const filesWithIssues = []

for (const result of results) {
  if (result.messages.length > 0) {
    const relativePath = path.relative(projectRoot, result.filePath)
    filesWithIssues.push({ path: relativePath, messages: result.messages, errorCount: result.errorCount, warningCount: result.warningCount })
    totalErrors += result.errorCount
    totalWarnings += result.warningCount
  }
}

if (filesWithIssues.length > 0) {
  for (const file of filesWithIssues) {
    console.log(`\x1b[33m${file.path}\x1b[0m`)
    file.messages.forEach(msg => {
      const icon = msg.severity === 2 ? '\x1b[31m✖\x1b[0m' : '\x1b[33m⚠\x1b[0m'
      console.log(`  ${icon} ${msg.line}:${msg.column}  ${msg.message}  \x1b[90m${msg.ruleId || 'unknown'}\x1b[0m`)
    })
    console.log('')
  }
  console.log(`\n\x1b[31m${totalErrors} error(s), ${totalWarnings} warning(s) in ${filesWithIssues.length} file(s)\x1b[0m`)
} else {
  console.log('\x1b[32m✓\x1b[0m All files pass - No issues')
}
