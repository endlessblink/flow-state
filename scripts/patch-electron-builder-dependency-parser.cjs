#!/usr/bin/env node

/**
 * electron-builder 26.8.1 can fail while parsing `npm list --json` when npm
 * prints a warning before the JSON payload. Its fallback parser accidentally
 * starts scanning at index 0 whenever either "{" or "[" is absent, so polluted
 * output can throw "No JSON content found in output" even when JSON exists.
 *
 * Remove this patch once app-builder-lib ships the same start-index fix.
 */

const fs = require('fs')
const path = require('path')

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'app-builder-lib',
  'out',
  'node-module-collector',
  'nodeModulesCollector.js'
)

const broken = `        // Find the first index that starts with { or [
        const bracketOpen = Math.max(consoleOutput.indexOf("{"), 0);
        const bracketOpenSquare = Math.max(consoleOutput.indexOf("["), 0);
        const start = Math.min(bracketOpen, bracketOpenSquare); // always non-negative due to Math.max above
        for (let i = start; i < consoleOutput.length; i++) {`

const fixed = `        // Find the first real JSON bracket. The upstream 26.8.1 code uses
        // Math.max(index, 0), which turns a missing bracket into index 0 and
        // prevents parsing when npm emits warnings before the JSON payload.
        const bracketOpen = consoleOutput.indexOf("{");
        const bracketOpenSquare = consoleOutput.indexOf("[");
        const starts = [bracketOpen, bracketOpenSquare].filter((index) => index >= 0);
        if (starts.length === 0) {
            throw new Error("No JSON content found in output");
        }
        const start = Math.min(...starts);
        for (let i = start; i < consoleOutput.length; i++) {`

if (!fs.existsSync(target)) {
  console.warn(`[electron-builder-patch] skipped; ${target} does not exist`)
  process.exit(0)
}

const current = fs.readFileSync(target, 'utf8')

if (current.includes(fixed)) {
  console.log('[electron-builder-patch] dependency parser already patched')
  process.exit(0)
}

if (!current.includes(broken)) {
  console.warn('[electron-builder-patch] skipped; expected parser snippet not found')
  process.exit(0)
}

fs.writeFileSync(target, current.replace(broken, fixed))
console.log('[electron-builder-patch] patched app-builder-lib dependency parser')
