import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const masterPlan = readFileSync(join(root, 'docs/MASTER_PLAN.md'), 'utf-8')
const architectureDoc = readFileSync(join(root, 'docs/architecture/local-agent-mcp.md'), 'utf-8')

describe('local agent MCP planning docs', () => {
  it('tracks the local-only MCP lane and all planned sub-tasks', () => {
    expect(masterPlan).toContain('FEATURE-1791~~: Local-only MCP access for external AI agents')

    for (let taskId = 1792; taskId <= 1806; taskId++) {
      expect(masterPlan, `TASK-${taskId} should be tracked in the MCP lane`).toContain(`TASK-${taskId}`)
    }
  })

  it('keeps the architecture local-only and stdio-first', () => {
    expect(architectureDoc).toContain('Local-only desktop agent access')
    expect(architectureDoc).toContain('Preferred transport: stdio MCP')
    expect(architectureDoc).toContain('Public API access is out of scope for this phase')
    expect(architectureDoc).toContain('The MCP server is a protocol adapter')
  })

  it('documents local MCP setup without persisting bridge secrets', () => {
    expect(architectureDoc).toContain('npm run mcp:flowstate')
    expect(architectureDoc).toContain('FLOWSTATE_AGENT_BRIDGE_URL')
    expect(architectureDoc).toContain('FLOWSTATE_AGENT_BRIDGE_TOKEN')
    expect(architectureDoc).toContain('Do not hardcode these values')
    expect(architectureDoc).toContain('Do not store the token in a repo file')
    expect(architectureDoc).toContain('Local Agent Access must be enabled in AI settings')
  })

  it('preserves hard safety bans for agent access', () => {
    const requiredBans = [
      'Use Supabase service-role keys',
      'Execute raw SQL',
      'Write directly to Supabase tables',
      'Write directly to IndexedDB',
      'Write directly to localStorage',
      'Mutate `_rawTasks`, `_rawProjects`, `_rawGroups`, or other raw Pinia state directly',
      'Expose permanent delete tools',
      'Treat personal workspace as an unfiltered all-workspaces query',
    ]

    for (const ban of requiredBans) {
      expect(architectureDoc, `Missing hard ban: ${ban}`).toContain(ban)
    }
  })

  it('requires safe write graduation before MCP write tools ship', () => {
    const requiredWriteRules = [
      '`dryRun` defaults to `true`',
      'Dry-run returns a structured before/after diff',
      'Execution requires explicit confirmation or in-app approval',
      'Write commands require an `idempotencyKey`',
      'Permanent delete remains unavailable',
      'All writes go through existing FlowState actions and sync queue behavior',
    ]

    for (const rule of requiredWriteRules) {
      expect(architectureDoc, `Missing write safety rule: ${rule}`).toContain(rule)
    }
  })
})
