/**
 * TASK-1610: Database/Migration Safety Tests (15 tests)
 *
 * Static analysis of migration files and schema.
 * Reads the actual SQL files from supabase/migrations/ and validates
 * structural safety invariants without requiring a running database.
 */

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// Setup: load all migration files
// ============================================================================

const MIGRATIONS_DIR = join(__dirname, '../../supabase/migrations')

function getMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()
}

function readMigration(filename: string): string {
  return readFileSync(join(MIGRATIONS_DIR, filename), 'utf-8')
}

function getAllMigrationContent(): string {
  return getMigrationFiles().map(readMigration).join('\n')
}

// Extract all table names created across all migrations
function getCreatedTableNames(): string[] {
  const allContent = getAllMigrationContent()
  const createTableRegex = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)/gi
  const names = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = createTableRegex.exec(allContent)) !== null) {
    names.add(match[1].toLowerCase())
  }
  return Array.from(names)
}

// ============================================================================
// Tests
// ============================================================================

describe('Database Migration Safety', () => {

  // 1. Migration files are present and readable (basic syntax sanity)
  it('all migration files can be read as UTF-8 strings', () => {
    const files = getMigrationFiles()
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const content = readMigration(file)
      expect(typeof content).toBe('string')
      expect(content.length).toBeGreaterThan(0)
    }
  })

  // 2. No DROP TABLE without IF EXISTS
  it('no DROP TABLE in migrations without IF EXISTS safeguard', () => {
    const files = getMigrationFiles()
    const violations: string[] = []
    for (const file of files) {
      const content = readMigration(file)
      // Match DROP TABLE that is NOT followed by IF EXISTS (case-insensitive)
      const bareDropTable = /drop\s+table\s+(?!if\s+exists)/gi
      if (bareDropTable.test(content)) {
        violations.push(file)
      }
    }
    expect(violations).toEqual([])
  })

  // 3. No TRUNCATE in migrations
  it('no TRUNCATE statement in any migration', () => {
    const files = getMigrationFiles()
    const violations: string[] = []
    for (const file of files) {
      const content = readMigration(file)
      if (/\btruncate\b/i.test(content)) {
        violations.push(file)
      }
    }
    expect(violations).toEqual([])
  })

  // 4. All foreign keys reference known tables
  it('foreign key references resolve to tables defined in migrations', () => {
    const allContent = getAllMigrationContent()
    const tableNames = getCreatedTableNames()
    const tableSet = new Set(tableNames)

    // Also include well-known external tables (auth.users, etc.)
    const externalTables = new Set(['users', 'identities', 'sessions'])

    // Match REFERENCES schema.table or just table
    const referencesRegex = /references\s+(?:(\w+)\.)?(\w+)\s*\(/gi
    let match: RegExpExecArray | null
    const unresolved: string[] = []

    while ((match = referencesRegex.exec(allContent)) !== null) {
      const schema = match[1]?.toLowerCase()
      const tableName = match[2]?.toLowerCase()

      // Skip auth.* references (auth schema tables)
      if (schema === 'auth') continue
      if (externalTables.has(tableName)) continue

      if (!tableSet.has(tableName)) {
        unresolved.push(`${schema ? schema + '.' : ''}${tableName}`)
      }
    }

    // Allow at most 0 unresolved (unique ones only for cleaner output)
    const uniqueUnresolved = [...new Set(unresolved)]
    expect(uniqueUnresolved).toEqual([])
  })

  // 5. All tables have created_at column
  it('all created tables have a created_at column', () => {
    const allContent = getAllMigrationContent()

    // Get table blocks — find CREATE TABLE ... ); blocks
    const tableBlockRegex = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)\s*\(([^;]+?)\);/gi
    let match: RegExpExecArray | null
    const missing: string[] = []

    while ((match = tableBlockRegex.exec(allContent)) !== null) {
      const tableName = match[1]
      const columns = match[2]
      if (!/created_at/i.test(columns)) {
        missing.push(tableName)
      }
    }

    // Some utility tables may lack created_at — report but don't fail on known exceptions
    // These tables are known to skip created_at (e.g. simple lookup/junction tables,
    // audit tables, membership tables that use joined_at instead):
    const knownExceptions = new Set([
      'whatsapp_conversations',
      'tombstones',          // uses deleted_at, not created_at
      'user_achievements',   // junction: user_id + achievement_id
      'user_purchases',      // junction: user_id + item_id
      'user_stats',          // stats aggregation table
      'arena_runs',          // arena session table
      'workspace_members',   // membership table uses joined_at
      'task_audit_log',      // immutable audit log uses event_at instead of created_at
      'device_sync_receipts', // sync tracking table uses last_synced_at instead of created_at
    ])
    const unexpectedMissing = missing.filter(t => !knownExceptions.has(t.toLowerCase()))
    expect(unexpectedMissing).toEqual([])
  })

  // 6. All tables have updated_at column (where applicable — skip immutable tables)
  it('core data tables have an updated_at column', () => {
    const CORE_TABLES = ['tasks', 'projects', 'groups', 'user_settings', 'timer_sessions']
    const allContent = getAllMigrationContent()

    // Combine all table blocks
    const tableBlockRegex = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)\s*\(([^;]+?)\);/gi
    const tableBlocks: Record<string, string> = {}
    let match: RegExpExecArray | null
    while ((match = tableBlockRegex.exec(allContent)) !== null) {
      tableBlocks[match[1].toLowerCase()] = match[2]
    }

    const missing: string[] = []
    for (const table of CORE_TABLES) {
      if (!tableBlocks[table]) continue // Table may be in a later migration
      if (!/updated_at/i.test(tableBlocks[table])) {
        missing.push(table)
      }
    }

    expect(missing).toEqual([])
  })

  // 7. Tombstones table exists with correct columns
  it('tombstones table exists with entity_type, entity_id, user_id columns', () => {
    const allContent = getAllMigrationContent()
    const tableBlockRegex = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?tombstones\s*\(([^;]+?)\);/gi
    const match = tableBlockRegex.exec(allContent)
    expect(match).not.toBeNull()
    const columns = match![1]
    expect(/entity_type/i.test(columns)).toBe(true)
    expect(/entity_id/i.test(columns)).toBe(true)
    expect(/user_id/i.test(columns)).toBe(true)
  })

  // 8. task_dedup_audit table exists
  it('task_dedup_audit table is defined in migrations', () => {
    const allContent = getAllMigrationContent()
    expect(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?task_dedup_audit/i.test(allContent)).toBe(true)
  })

  // 9. Core tables all exist in schema
  it('all 8 core tables exist across migrations', () => {
    const EXPECTED_CORE_TABLES = [
      'tasks',
      'projects',
      'groups',
      'timer_sessions',
      'pomodoro_history',
      'notifications',
      'user_settings',
      'quick_sort_sessions'
    ]
    const tableNames = getCreatedTableNames()
    const tableSet = new Set(tableNames)
    const missing = EXPECTED_CORE_TABLES.filter(t => !tableSet.has(t))
    expect(missing).toEqual([])
  })

  // 10. No migration deletes data without a comment indicating a backup step
  it('destructive DELETE statements are accompanied by a backup comment', () => {
    const files = getMigrationFiles()
    const violations: string[] = []

    for (const file of files) {
      const content = readMigration(file)
      // Look for DELETE FROM (not tombstone inserts)
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (/\bdelete\s+from\s+/i.test(line) && !/tombstones/i.test(line)) {
          // Check if there's a backup/safety comment within 5 lines before
          const windowStart = Math.max(0, i - 5)
          const window = lines.slice(windowStart, i).join('\n')
          if (!/(backup|safety|cleanup|cascade)/i.test(window)) {
            violations.push(`${file}:${i + 1} — ${line.trim()}`)
          }
        }
      }
    }

    // Allow known cleanup migrations (e.g. BUG-1477 tombstone cleanup trigger)
    const filteredViolations = violations.filter(v => !v.includes('tombstone'))
    expect(filteredViolations).toEqual([])
  })

  // 11. Migration filenames follow timestamp convention
  it('all migration filenames match the YYYYMMDD[HHMMSS]_*.sql pattern', () => {
    const files = getMigrationFiles()
    // Some migrations use YYYYMMDD (8 digits), others use YYYYMMDDHHmmSS (14 digits)
    // Accept 8+ digit timestamps
    const MIGRATION_PATTERN = /^\d{8,}_[a-z0-9_]+\.sql$/i
    const nonConforming = files.filter(f => !MIGRATION_PATTERN.test(f))
    expect(nonConforming).toEqual([])
  })

  // 12. No duplicate migration timestamps
  it('no two migrations share the same timestamp prefix', () => {
    const files = getMigrationFiles()
    const timestamps = files.map(f => f.split('_')[0])
    const seen = new Set<string>()
    const duplicates: string[] = []
    for (const ts of timestamps) {
      if (seen.has(ts)) duplicates.push(ts)
      seen.add(ts)
    }
    expect(duplicates).toEqual([])
  })

  // 13. All tables have a primary key
  it('all created tables have a primary key defined', () => {
    const allContent = getAllMigrationContent()
    const tableBlockRegex = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)\s*\(([^;]+?)\);/gi
    const missing: string[] = []
    let match: RegExpExecArray | null

    while ((match = tableBlockRegex.exec(allContent)) !== null) {
      const tableName = match[1]
      const columns = match[2]
      const hasPK = /primary\s+key/i.test(columns)
      if (!hasPK) {
        missing.push(tableName)
      }
    }

    // Some junction tables use composite PKs defined separately — known exceptions:
    const knownExceptions = new Set(['whatsapp_conversations'])
    const unexpected = missing.filter(t => !knownExceptions.has(t.toLowerCase()))
    expect(unexpected).toEqual([])
  })

  // 14. User-facing tables have user_id column
  it('user-facing data tables have a user_id column', () => {
    const USER_TABLES = ['tasks', 'projects', 'groups', 'notifications', 'user_settings']
    const allContent = getAllMigrationContent()

    const tableBlockRegex = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)\s*\(([^;]+?)\);/gi
    const tableBlocks: Record<string, string> = {}
    let match: RegExpExecArray | null
    while ((match = tableBlockRegex.exec(allContent)) !== null) {
      tableBlocks[match[1].toLowerCase()] = match[2]
    }

    const missing: string[] = []
    for (const table of USER_TABLES) {
      const block = tableBlocks[table]
      if (!block) continue
      if (!/user_id/i.test(block)) {
        missing.push(table)
      }
    }

    expect(missing).toEqual([])
  })

  // 15. RLS is enabled on all core user-facing tables
  it('ENABLE ROW LEVEL SECURITY is present for all core tables', () => {
    const CORE_TABLES_WITH_RLS = [
      'tasks',
      'projects',
      'groups',
      'notifications',
      'user_settings',
      'tombstones',
      'timer_sessions',
      'pomodoro_history',
      'quick_sort_sessions'
    ]

    const allContent = getAllMigrationContent()
    const missing: string[] = []

    for (const table of CORE_TABLES_WITH_RLS) {
      // Look for: ALTER TABLE public.tablename ENABLE ROW LEVEL SECURITY
      const rlsPattern = new RegExp(
        `alter\\s+table\\s+(?:public\\.)?${table}\\s+enable\\s+row\\s+level\\s+security`,
        'i'
      )
      if (!rlsPattern.test(allContent)) {
        missing.push(table)
      }
    }

    expect(missing).toEqual([])
  })
})
