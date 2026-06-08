#!/usr/bin/env node

/**
 * Build a deterministic SQL bundle for the server-backed AI memory layer.
 *
 * The production VPS does not reliably use Supabase CLI migration tracking, so
 * this creates one reviewable SQL payload from the ordered migration files. The
 * bundle is still additive, but policy statements are guarded with a preceding
 * DROP POLICY IF EXISTS so partial/manual application can be retried safely.
 */

const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const migrationsDir = path.join(root, 'supabase', 'migrations')

const MIGRATION_FILES = [
  '20260608090000_ai_clarification_memory.sql',
  '20260608093000_ai_assistant_memory_metadata.sql',
  '20260608100000_ai_parameter_beliefs.sql',
  '20260608103000_ai_memory_snapshots.sql',
  '20260608110000_ai_clarification_event_delete_policy.sql',
  '20260608111500_ai_parameter_belief_lifecycle.sql',
]

function guardPolicyCreates(sql) {
  return sql.replace(
    /create policy "([^"]+)"\s+on public\.([a-z0-9_]+)\s+for/gi,
    (_match, policyName, tableName) => `drop policy if exists "${policyName}" on public.${tableName};\ncreate policy "${policyName}"\n  on public.${tableName} for`,
  )
}

function migrationBody(file) {
  const fullPath = path.join(migrationsDir, file)
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing migration file: ${file}`)
  }
  const sql = fs.readFileSync(fullPath, 'utf8').trim()
  return [
    `-- ============================================================================`,
    `-- ${file}`,
    `-- ============================================================================`,
    guardPolicyCreates(sql),
    '',
  ].join('\n')
}

function main() {
  const outputPath = process.argv[2] || path.join('/tmp', 'flowstate-ai-memory-live-migration.sql')
  const outputDir = path.dirname(outputPath)
  fs.mkdirSync(outputDir, { recursive: true })

  const header = [
    '-- FlowState AI memory live migration bundle',
    `-- Generated at: ${new Date().toISOString()}`,
    '-- Source: scripts/build-ai-memory-migration-bundle.cjs',
    '--',
    '-- Review before applying to production. This bundle is intended for psql',
    '-- against the FlowState Supabase Postgres database, then verification with:',
    '--   npm run check:ai-memory-schema',
    '',
  ].join('\n')

  const body = MIGRATION_FILES.map(migrationBody).join('\n')
  const footer = [
    '-- Ask PostgREST/Supabase REST to reload the schema cache after applying.',
    "notify pgrst, 'reload schema';",
    '',
    '-- Verification query for psql:',
    '-- select table_name from information_schema.tables where table_schema = \'public\' and table_name like \'ai_%\' order by table_name;',
    '',
  ].join('\n')

  fs.writeFileSync(outputPath, `${header}${body}${footer}`)
  console.log(`[ai-memory-bundle] Wrote ${MIGRATION_FILES.length} migrations to ${outputPath}`)
}

main()
