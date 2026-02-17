#!/usr/bin/env node

/**
 * BUG-1131: Build-time guard against client-side secret leaks
 *
 * Scans src/ for import.meta.env.VITE_* references and fails the build
 * if any non-allowlisted VITE_ variable is found. This prevents API keys
 * from being accidentally bundled into the client JavaScript.
 *
 * Allowlisted vars are safe to bundle (public endpoints, config flags, etc.)
 * All cloud API keys MUST go through Supabase Edge Function proxies.
 *
 * Usage: node scripts/check-vite-secrets.cjs
 * Wired as "prebuild" in package.json
 */

const fs = require('fs')
const path = require('path')

// ============================================================================
// Allowlist: VITE_ vars that are safe to bundle into client JS
// ============================================================================

const ALLOWLISTED_VARS = new Set([
  'VITE_SUPABASE_URL',        // Public endpoint (RLS-protected)
  'VITE_SUPABASE_ANON_KEY',   // Public by design (Supabase RLS)
  'VITE_OLLAMA_HOST',         // Local config, not a secret
  'VITE_OLLAMA_PORT',         // Local config, not a secret
  'VITE_VAPID_PUBLIC_KEY',    // Public by VAPID spec
  'VITE_APP_VERSION',         // Version number
  'VITE_USE_LOCAL_SUPABASE',  // Boolean flag
])

// ============================================================================
// Scanner
// ============================================================================

const SRC_DIR = path.resolve(__dirname, '..', 'src')

// Match import.meta.env.VITE_SOMETHING patterns
const VITE_ENV_PATTERN = /import\.meta\.env\.(VITE_[A-Z0-9_]+)/g

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const violations = []
  let match

  while ((match = VITE_ENV_PATTERN.exec(content)) !== null) {
    const varName = match[1]
    if (!ALLOWLISTED_VARS.has(varName)) {
      // Find line number
      const upToMatch = content.substring(0, match.index)
      const lineNumber = upToMatch.split('\n').length
      violations.push({ varName, lineNumber })
    }
  }

  return violations
}

function walkDir(dir) {
  const files = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // Skip node_modules, dist, .git
      if (['node_modules', 'dist', '.git'].includes(entry.name)) continue
      files.push(...walkDir(fullPath))
    } else if (entry.isFile()) {
      // Scan TypeScript, JavaScript, and Vue files
      if (/\.(ts|tsx|js|jsx|vue)$/.test(entry.name)) {
        files.push(fullPath)
      }
    }
  }

  return files
}

// ============================================================================
// Main
// ============================================================================

function main() {
  console.log('[check-vite-secrets] Scanning src/ for non-allowlisted VITE_ env vars...')

  const files = walkDir(SRC_DIR)
  const allViolations = []

  for (const file of files) {
    const violations = scanFile(file)
    if (violations.length > 0) {
      const relPath = path.relative(path.resolve(__dirname, '..'), file)
      for (const v of violations) {
        allViolations.push({ file: relPath, ...v })
      }
    }
  }

  if (allViolations.length === 0) {
    console.log(`[check-vite-secrets] ✅ All ${files.length} files clean. No secret leaks detected.`)
    console.log(`[check-vite-secrets] Allowlisted vars: ${[...ALLOWLISTED_VARS].join(', ')}`)
    process.exit(0)
  }

  // Report violations
  console.error('')
  console.error('╔══════════════════════════════════════════════════════════════╗')
  console.error('║  🚨 VITE_ SECRET LEAK DETECTED — BUILD BLOCKED (BUG-1131)  ║')
  console.error('╠══════════════════════════════════════════════════════════════╣')
  console.error('║                                                              ║')
  console.error('║  VITE_ prefixed vars get bundled into client JavaScript!     ║')
  console.error('║  API keys MUST use Supabase Edge Function proxies instead.   ║')
  console.error('║                                                              ║')
  console.error('╚══════════════════════════════════════════════════════════════╝')
  console.error('')

  for (const v of allViolations) {
    console.error(`  ❌ ${v.file}:${v.lineNumber} — ${v.varName}`)
  }

  console.error('')
  console.error('To fix:')
  console.error('  1. Remove the VITE_ reference from client code')
  console.error('  2. Route through a Supabase Edge Function proxy instead')
  console.error('  3. Or add to ALLOWLISTED_VARS in scripts/check-vite-secrets.cjs if truly safe')
  console.error('')

  process.exit(1)
}

main()
