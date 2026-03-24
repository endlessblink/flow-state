#!/usr/bin/env node
/**
 * Compare web baseline screenshots vs Tauri screenshots using pixelmatch.
 *
 * Usage:
 *   node tests/visual/compare.mjs
 *
 * Expects:
 *   tests/visual/baseline/web-{view}.png   — from Playwright
 *   tests/visual/artifacts/tauri-{view}.png — from WebDriver/webkit-test
 *
 * Outputs:
 *   tests/visual/artifacts/diff-{view}.png  — visual diff image
 *   JSON summary to stdout
 *   Exit code 1 if any view exceeds threshold
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASELINE_DIR = path.join(__dirname, 'baseline')
const ARTIFACTS_DIR = path.join(__dirname, 'artifacts')

// Max allowed diff ratio (percentage of different pixels)
const MAX_DIFF_RATIO = 0.5 // 0.5% — strict for dark theme

const VIEWS = ['canvas', 'board', 'catalog', 'calendar', 'inbox']

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function comparePair(viewName) {
  const webPath = path.join(BASELINE_DIR, `web-${viewName}.png`)
  const tauriPath = path.join(ARTIFACTS_DIR, `tauri-${viewName}.png`)

  if (!fs.existsSync(webPath)) {
    return { view: viewName, status: 'skip', reason: 'no web baseline' }
  }
  if (!fs.existsSync(tauriPath)) {
    return { view: viewName, status: 'skip', reason: 'no tauri screenshot' }
  }

  const webImg = PNG.sync.read(fs.readFileSync(webPath))
  const tauriImg = PNG.sync.read(fs.readFileSync(tauriPath))

  // Resize to match if dimensions differ
  const width = Math.min(webImg.width, tauriImg.width)
  const height = Math.min(webImg.height, tauriImg.height)

  if (webImg.width !== tauriImg.width || webImg.height !== tauriImg.height) {
    console.warn(
      `⚠️  ${viewName}: size mismatch — web ${webImg.width}x${webImg.height} vs tauri ${tauriImg.width}x${tauriImg.height}. Comparing ${width}x${height} overlap.`
    )
  }

  const diff = new PNG({ width, height })

  const numDiff = pixelmatch(
    webImg.data,
    tauriImg.data,
    diff.data,
    width,
    height,
    {
      threshold: 0.15, // Per-pixel color distance threshold
      includeAA: false, // Ignore anti-aliasing differences
    }
  )

  const total = width * height
  const ratio = (numDiff / total) * 100

  // Save diff image
  ensureDir(ARTIFACTS_DIR)
  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, `diff-${viewName}.png`),
    PNG.sync.write(diff)
  )

  return {
    view: viewName,
    status: ratio > MAX_DIFF_RATIO ? 'fail' : 'pass',
    diffPixels: numDiff,
    totalPixels: total,
    diffRatio: parseFloat(ratio.toFixed(4)),
    threshold: MAX_DIFF_RATIO,
    diffImage: `artifacts/diff-${viewName}.png`,
  }
}

// Run comparisons
ensureDir(ARTIFACTS_DIR)
const results = VIEWS.map(comparePair)

const passed = results.filter(r => r.status === 'pass').length
const failed = results.filter(r => r.status === 'fail').length
const skipped = results.filter(r => r.status === 'skip').length

// Output
console.log(JSON.stringify({ summary: { passed, failed, skipped }, results }, null, 2))

// Human-readable
console.error('\n' + '='.repeat(55))
console.error(`  Visual Regression: ${passed} passed, ${failed} failed, ${skipped} skipped`)
console.error('='.repeat(55))
results.forEach(r => {
  const icon = r.status === 'pass' ? '✅' : r.status === 'fail' ? '❌' : '⏭️'
  const detail = r.diffRatio !== undefined
    ? `${r.diffRatio}% diff (threshold: ${r.threshold}%)`
    : r.reason
  console.error(`  ${icon} ${r.view}: ${detail}`)
})
console.error('='.repeat(55) + '\n')

process.exit(failed > 0 ? 1 : 0)
