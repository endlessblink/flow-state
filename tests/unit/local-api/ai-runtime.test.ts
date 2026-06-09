import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const supportsMastraRuntime = Number(process.versions.node.split('.')[0]) >= 22
const require = createRequire(import.meta.url)

describe('Local API Mastra AI runtime', () => {
  it.runIf(supportsMastraRuntime)('resumes a suspended clarification from a fresh LibSQL-backed runtime', async () => {
    const { createAIMastraRuntime } = require('../../../server/local-api/ai-runtime.cjs') as {
      createAIMastraRuntime: (options: { dataDir: string }) => {
        start: (input: unknown, runId: string) => Promise<unknown>
        resume: (runId: string, resumeData: unknown) => Promise<unknown>
        close: () => Promise<void>
      }
    }
    const storageDir = await mkdtemp(join(tmpdir(), 'flowstate-local-api-ai-'))

    try {
      const first = createAIMastraRuntime({ dataDir: storageDir })
      const started = await first.start({
        requestId: 'req-local-api',
        scope: 'planning',
        candidates: [{
          id: 'weekly_capacity',
          question: 'How many focused hours are available?',
          scope: 'planning',
          targetEntityKey: 'week:2026-06-09',
          durableLearningTarget: 'weekly_capacity',
          infoValueScore: 0.91,
          interruptionCost: 0.16,
        }],
      }, 'local-api-ai-runtime-run')

      expect(started).toMatchObject({
        status: 'suspended',
        runId: 'local-api-ai-runtime-run',
        payload: {
          questionKey: 'planning::week:2026-06-09::weekly_capacity',
        },
      })
      await first.close()

      const second = createAIMastraRuntime({ dataDir: storageDir })
      const resumed = await second.resume('local-api-ai-runtime-run', {
        questionKey: 'planning::week:2026-06-09::weekly_capacity',
        action: 'answered',
        answer: 'About 8 hours',
      })

      expect(resumed).toMatchObject({
        status: 'success',
        runId: 'local-api-ai-runtime-run',
        output: {
          status: 'answered',
          questionKey: 'planning::week:2026-06-09::weekly_capacity',
          answer: 'About 8 hours',
        },
      })
      await second.close()
    } finally {
      await rm(storageDir, { recursive: true, force: true })
    }
  })

  it.skipIf(supportsMastraRuntime)('documents that the sidecar AI runtime requires Node 22+', () => {
    expect(process.versions.node).toMatch(/^20\./)
  })
})
