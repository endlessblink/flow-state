import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const modulePath = resolve(process.cwd(), 'server/local-api/capabilities.cjs')

type Capability = {
  id: string
  mode: 'read' | 'write'
  approval: 'none' | 'canonical_preview_apply'
  scope: 'personal_or_active_workspace' | 'personal_only'
  contractVersion: string
  receiptVersion: string | null
}

function manifest(): { manifestVersion: string; capabilities: Capability[] } {
  const { getCapabilityManifest } = require(modulePath) as {
    getCapabilityManifest: () => {
      manifestVersion: string
      capabilities: Capability[]
    }
  }
  return getCapabilityManifest()
}

describe('Local API canonical assistant capability manifest', () => {
  it('is pure, versioned, deterministic, and duplicate-free', () => {
    const first = manifest()
    const second = manifest()
    const ids = first.capabilities.map((capability) => capability.id)

    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    expect(first.manifestVersion).toBe('assistant-capabilities-v1')
    expect(ids).toEqual([...ids].sort())
    expect(new Set(ids).size).toBe(ids.length)
    expect(first).not.toHaveProperty('generatedAt')
  })

  it('enumerates the implemented canonical organization contracts', () => {
    const byId = new Map(manifest().capabilities.map((capability) => [capability.id, capability]))

    expect(byId.get('organization.inventory')).toEqual({
      id: 'organization.inventory',
      mode: 'read',
      approval: 'none',
      scope: 'personal_or_active_workspace',
      contractVersion: 'organization-inventory-v1',
      receiptVersion: null,
    })
    for (const id of ['organization.assign_project', 'organization.set_canvas_group']) {
      expect(byId.get(id)).toMatchObject({
        mode: 'write',
        approval: 'canonical_preview_apply',
        scope: 'personal_or_active_workspace',
        contractVersion: 'task-v1',
        receiptVersion: 'canonical-receipt-v1',
      })
    }
  })

  it('omits unsupported organization and Canvas operations instead of advertising fallbacks', () => {
    const ids = new Set(manifest().capabilities.map((capability) => capability.id))

    for (const unsupported of [
      'organization.create_project',
      'organization.create_group',
      'organization.assign_lane',
      'organization.move_canvas',
      'organization.ungroup_canvas',
      'organization.remove_canvas',
      'organization.assign_smart_group',
    ]) {
      expect(ids.has(unsupported), unsupported).toBe(false)
    }
  })

  it('advertises the integrated recurrence and explicit timer command contracts', () => {
    const byId = new Map(manifest().capabilities.map((capability) => [capability.id, capability]))

    expect(byId.get('recurrence.chain')).toMatchObject({
      mode: 'read',
      approval: 'none',
      contractVersion: 'task-v1',
      receiptVersion: null,
    })
    for (const id of ['recurrence.edit_future', 'recurrence.pause', 'recurrence.resume', 'recurrence.end_series']) {
      expect(byId.get(id)).toMatchObject({
        mode: 'write',
        approval: 'canonical_preview_apply',
        contractVersion: 'task-v1',
        receiptVersion: 'canonical-receipt-v1',
      })
    }
    expect(byId.get('timer.session')).toMatchObject({
      mode: 'read',
      approval: 'none',
      contractVersion: 'timer-v1',
      receiptVersion: null,
    })
    for (const id of ['timer.start', 'timer.pause', 'timer.resume', 'timer.stop', 'timer.switch_task', 'timer.extend']) {
      expect(byId.get(id)).toMatchObject({
        mode: 'write',
        approval: 'canonical_preview_apply',
        contractVersion: 'timer-v1',
        receiptVersion: 'canonical-receipt-v1',
      })
    }
    expect(byId.has('timer.toggle')).toBe(false)
  })
})
