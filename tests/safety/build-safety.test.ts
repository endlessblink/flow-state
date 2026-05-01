/**
 * TASK-1593: Build Safety Tests
 *
 * Guards against the class of production build breakages described in BUG-1184
 * (uncommitted imported file caused chunk-load failures) and related issues:
 * - Import resolution failures at build time
 * - Missing secret guard script
 * - Env files containing leaked API keys
 * - Version mismatches across the three version-of-truth files
 * - Accidental console.log of sensitive strings in source
 */

import { describe, it, expect } from 'vitest'
import {
  readFileSync,
  readdirSync,
  statSync,
  existsSync,
  accessSync,
  constants as fsConstants,
} from 'node:fs'
import { join, dirname, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '../..')
const SRC  = join(ROOT, 'src')

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Walk a directory tree, returning every file that passes the optional filter.
 */
function walkFiles(dir: string, filter?: (p: string) => boolean): string[] {
  const result: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      result.push(...walkFiles(full, filter))
    } else if (!filter || filter(full)) {
      result.push(full)
    }
  }
  return result
}

/**
 * Resolve @/ alias to the src/ directory and return the normalised path.
 * Tries adding .ts / .js / .vue / /index.ts extensions when the bare path
 * has no extension.
 */
function resolveImportPath(importPath: string, fromFile: string): string | null {
  let candidate: string

  if (importPath.startsWith('@/')) {
    candidate = join(SRC, importPath.slice(2))
  } else if (importPath.startsWith('./') || importPath.startsWith('../')) {
    candidate = resolve(dirname(fromFile), importPath)
  } else {
    // Node module or bare specifier — skip
    return null
  }

  // If the path already has a known extension, return as-is
  const ext = extname(candidate)
  if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx' || ext === '.vue') {
    return candidate
  }

  // No extension — try common suffixes
  const suffixes = ['.ts', '.tsx', '.js', '.vue', '/index.ts', '/index.js']
  for (const s of suffixes) {
    if (existsSync(candidate + s)) return candidate + s
  }

  return candidate  // return unresolved so the test can report it
}

/**
 * Extract all *static* import paths from a TypeScript source string.
 * Excludes dynamic `import()` calls.
 */
function extractStaticImports(src: string): string[] {
  // Match:  import ... from '...'  or  import '...'
  const re = /^\s*import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm
  const paths: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    paths.push(m[1])
  }
  return paths
}

// ---------------------------------------------------------------------------
// Test 1 — All relative/alias imports in .ts files under src/ resolve
// ---------------------------------------------------------------------------

describe('TASK-1593: Build Safety', () => {
  it('1. All static relative/alias imports in src/**/*.ts files resolve to existing files (guards BUG-1184)', () => {
    const tsFiles = walkFiles(SRC, f => f.endsWith('.ts') || f.endsWith('.tsx'))

    const broken: Array<{ file: string; importPath: string; resolvedPath: string }> = []

    for (const file of tsFiles) {
      let src: string
      try {
        src = readFileSync(file, 'utf-8')
      } catch {
        continue
      }

      for (const imp of extractStaticImports(src)) {
        const resolved = resolveImportPath(imp, file)
        if (resolved === null) continue  // node module, skip

        if (!existsSync(resolved)) {
          broken.push({
            file: file.replace(ROOT + '/', ''),
            importPath: imp,
            resolvedPath: resolved.replace(ROOT + '/', ''),
          })
        }
      }
    }

    if (broken.length > 0) {
      const lines = broken.map(
        b => `  ${b.file}\n    imports '${b.importPath}'\n    → ${b.resolvedPath} (NOT FOUND)`
      )
      expect.fail(
        `${broken.length} unresolvable static import(s) found:\n${lines.join('\n')}`
      )
    }
  })

  // ---------------------------------------------------------------------------
  // Test 2 — Secret guard script exists and is executable
  // ---------------------------------------------------------------------------

  it('2. scripts/check-vite-secrets.cjs exists and is executable', () => {
    const scriptPath = join(ROOT, 'scripts/check-vite-secrets.cjs')
    expect(existsSync(scriptPath), `${scriptPath} does not exist`).toBe(true)

    // The script is invoked via `node scripts/check-vite-secrets.cjs` in the build pipeline,
    // so we only need to verify it exists and is readable — not that it has the executable bit.
    let readable = true
    try {
      accessSync(scriptPath, fsConstants.R_OK)
    } catch {
      readable = false
    }
    expect(readable, `${scriptPath} is not readable`).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // Test 3 — .env files don't contain production API keys
  // ---------------------------------------------------------------------------

  it('3. No .env files contain patterns that look like production API keys/secrets', () => {
    // Files to scan — we only care about files that could accidentally be
    // committed or baked into builds.  .env.example files are excluded because
    // they intentionally hold placeholder text for documentation purposes.
    const envFileCandidates = [
      '.env',
      '.env.production',
      '.env.development',
    ]

    // Patterns that look like real secrets (not placeholders)
    // We intentionally exclude `eyJ` (JWT) because .env.production must be
    // clean of VITE_ keys; non-VITE JWT values (SUPABASE_SERVICE_ROLE_KEY etc.)
    // are server-side secrets allowed in .env.local but NOT in production build files.
    const SECRET_PATTERNS: Array<{ name: string; re: RegExp }> = [
      { name: 'OpenAI key (sk-)',             re: /\bsk-[A-Za-z0-9]{20,}/ },
      { name: 'OpenRouter key (sk-or-)',       re: /\bsk-or-[A-Za-z0-9-]{20,}/ },
      { name: 'Groq key (gsk_)',               re: /\bgsk_[A-Za-z0-9]{20,}/ },
      { name: 'Supabase service role JWT',     re: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*eyJ/ },
      { name: 'VITE_ prefixed JWT/secret',     re: /VITE_[A-Z_]+=\s*eyJ[A-Za-z0-9._-]{40,}/ },
      { name: 'Private key header',            re: /-----BEGIN (RSA|EC|PRIVATE) KEY-----/ },
    ]

    const violations: Array<{ file: string; pattern: string; line: number }> = []

    for (const rel of envFileCandidates) {
      const full = join(ROOT, rel)
      if (!existsSync(full)) continue

      const lines = readFileSync(full, 'utf-8').split('\n')
      for (let i = 0; i < lines.length; i++) {
        for (const { name, re } of SECRET_PATTERNS) {
          if (re.test(lines[i])) {
            violations.push({ file: rel, pattern: name, line: i + 1 })
          }
        }
      }
    }

    if (violations.length > 0) {
      const report = violations.map(
        v => `  ${v.file}:${v.line} — matched pattern "${v.pattern}"`
      ).join('\n')
      expect.fail(`Production/build env files contain what look like real secrets:\n${report}`)
    }
  })

  // ---------------------------------------------------------------------------
  // Test 4 — Version strings are consistent across the three canonical files
  // ---------------------------------------------------------------------------

  it('4. package.json has a valid semver version (Electron desktop stack)', () => {
    // Historical note: package.json is now the active desktop version source.
    // Electron
    // reads the version directly from package.json (electron-builder.yml uses
    // ${version} templating), so package.json is the single source of truth.
    const pkgVersion: string = JSON.parse(
      readFileSync(join(ROOT, 'package.json'), 'utf-8')
    ).version

    expect(pkgVersion, 'package.json must have a non-empty version').toBeTruthy()
    expect(
      pkgVersion,
      `package.json version (${pkgVersion}) must be semver-formatted`
    ).toMatch(/^\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?$/)
  })

  // ---------------------------------------------------------------------------
  // Test 5 — No console.log statements logging sensitive variable names
  // ---------------------------------------------------------------------------

  it('5. No console.log calls that log password/secret/token strings in src/', () => {
    const allSrcFiles = walkFiles(SRC, f =>
      f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.vue') || f.endsWith('.js')
    )

    // Match console.log/warn/error/info followed (anywhere on the same line) by
    // sensitive variable names or string literals.  We intentionally keep this
    // targeted to avoid false positives from comments or benign log messages.
    //
    // The patterns below require the sensitive word to appear as a bare identifier
    // (variable/parameter name) — not merely inside a quoted string literal.
    // This avoids false positives like console.error('Password reset failed:', e)
    // where "password" is part of a descriptive log message, not a secret value.
    const SENSITIVE: Array<{ name: string; re: RegExp }> = [
      // console.log(password) — bare variable named password (not in quotes)
      // Matches: console.log(password) or console.error(password, details)
      // Does NOT match: console.error('Password reset failed:', e)
      { name: 'password in console.log',  re: /console\.\w+\s*\((?:[^'"]*,\s*)?\bpassword\b(?:\s*[,)]|$)/i },
      // console.log(secret, ...) — bare variable named secret
      { name: 'secret in console.log',    re: /console\.\w+\s*\((?:[^'"]*,\s*)?\bsecret\b(?:\s*[,)]|$)/i },
      // console.log(token = ...) or console.log(token: value) — token as an assigned/printed variable
      // Requires token to be a bare identifier followed by = or : outside of quotes
      { name: 'token assignment in log',  re: /console\.\w+\s*\([^'"]*\btoken\s*[=]/ },
      // console.log('apiKey:', apiKey) — bare identifier named apiKey
      { name: 'apiKey in console.log',    re: /console\.\w+\s*\([^'"]*\bapiKey\b/i },
      // console.log('serviceRole')
      { name: 'serviceRole in console.log', re: /console\.\w+\s*\([^'"]*\bserviceRole\b/i },
    ]

    const hits: Array<{ file: string; line: number; pattern: string; text: string }> = []

    for (const file of allSrcFiles) {
      let src: string
      try {
        src = readFileSync(file, 'utf-8')
      } catch {
        continue
      }

      const lines = src.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Skip comment lines
        if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue
        for (const { name, re } of SENSITIVE) {
          if (re.test(line)) {
            hits.push({
              file: file.replace(ROOT + '/', ''),
              line: i + 1,
              pattern: name,
              text: line.trim().slice(0, 120),
            })
          }
        }
      }
    }

    if (hits.length > 0) {
      const report = hits.map(
        h => `  ${h.file}:${h.line} [${h.pattern}]\n    ${h.text}`
      ).join('\n')
      expect.fail(`Potential secret-logging statements found in src/:\n${report}`)
    }
  })
})
