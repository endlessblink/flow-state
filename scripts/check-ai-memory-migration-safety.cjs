#!/usr/bin/env node

/**
 * Read-only safety gate for the FlowState AI memory live migration bundle.
 *
 * The bundle is allowed to be additive and retry-safe. It may drop/recreate RLS
 * policies and triggers, but it must not drop tables, delete data, truncate
 * data, or remove existing columns.
 */

const fs = require('node:fs')
const path = require('node:path')

const DEFAULT_BUNDLE_PATH = path.join('/tmp', 'flowstate-ai-memory-live-migration.sql')

const ALLOWED_DROP_PATTERNS = [
  /^drop\s+policy\s+if\s+exists\b/i,
  /^drop\s+trigger\s+if\s+exists\b/i,
]

const DESTRUCTIVE_PATTERNS = [
  { label: 'drop table', pattern: /^drop\s+table\b/i },
  { label: 'drop schema', pattern: /^drop\s+schema\b/i },
  { label: 'drop index', pattern: /^drop\s+index\b/i },
  { label: 'drop function', pattern: /^drop\s+function\b/i },
  { label: 'drop view', pattern: /^drop\s+view\b/i },
  { label: 'truncate', pattern: /^truncate\b/i },
  { label: 'delete from', pattern: /^delete\s+from\b/i },
  { label: 'alter table drop column', pattern: /^alter\s+table\b[\s\S]*\bdrop\s+column\b/i },
]

function stripCommentsAndStrings(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n\r]*/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, '$$body$$')
    .replace(/'([^']|'')*'/g, "''")
}

function splitStatements(sql) {
  return stripCommentsAndStrings(sql)
    .split(';')
    .map(statement => statement.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function validateStatement(statement) {
  if (ALLOWED_DROP_PATTERNS.some(pattern => pattern.test(statement))) {
    return null
  }

  if (/^drop\b/i.test(statement)) {
    return { label: 'unsupported drop statement', statement }
  }

  const match = DESTRUCTIVE_PATTERNS.find(({ pattern }) => pattern.test(statement))
  return match ? { label: match.label, statement } : null
}

function validateSql(sql) {
  return splitStatements(sql)
    .map(validateStatement)
    .filter(Boolean)
}

function main() {
  const bundlePath = process.argv[2] || DEFAULT_BUNDLE_PATH
  if (!fs.existsSync(bundlePath)) {
    console.error(`[ai-memory-safety] Bundle not found: ${bundlePath}`)
    process.exit(2)
  }

  const sql = fs.readFileSync(bundlePath, 'utf8')
  const failures = validateSql(sql)

  if (failures.length > 0) {
    console.error(`[ai-memory-safety] Refusing unsafe AI memory migration bundle: ${bundlePath}`)
    for (const failure of failures) {
      console.error(`- ${failure.label}: ${failure.statement.slice(0, 220)}`)
    }
    process.exit(1)
  }

  console.log(`[ai-memory-safety] Bundle passed destructive-operation safety check: ${bundlePath}`)
}

if (require.main === module) {
  main()
}

module.exports = {
  validateSql,
}
