import { describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const supportsMastraRuntime = Number(process.versions.node.split('.')[0]) >= 22

describe('Mastra chat decision runtime adapter', () => {
  it.runIf(supportsMastraRuntime)('wraps the no-loop decision contract as a Mastra workflow step', async () => {
    const {
      chatDecisionStep,
      createChatDecisionWorkflow,
    } = await import('@/services/ai/runtime/mastraChatDecisionWorkflow')
    const inputData = {
      requestId: 'req-mastra',
      scope: 'planning',
      candidates: [{
        id: 'available_hours',
        question: 'How many hours are realistically available?',
        scope: 'planning',
        targetEntityKey: 'week:2026-06-09',
        durableLearningTarget: 'available_hours',
        infoValueScore: 0.9,
        interruptionCost: 0.15,
        actionImpact: 'high' as const,
      }],
    }

    const workflow = createChatDecisionWorkflow()
    const result = await chatDecisionStep.execute({
      inputData,
    } as Parameters<typeof chatDecisionStep.execute>[0])

    expect(workflow.id).toBe('flowstate-chat-decision-runtime')
    expect(chatDecisionStep.id).toBe('chat-decision-runtime')
    expect(result.decision).toBe('ask')
    expect(result.question?.id).toBe('available_hours')
    expect(result.trace.reason).toBe('highest_value_question_above_threshold')
  })

  it.runIf(supportsMastraRuntime)('suspends for a durable clarification and resumes from the user answer', async () => {
    const {
      createClarificationGateWorkflow,
    } = await import('@/services/ai/runtime/mastraChatDecisionWorkflow')
    const { Mastra } = await import('@mastra/core/mastra')
    const { InMemoryStore } = await import('@mastra/core/storage')
    const inputData = {
      requestId: 'req-clarify',
      scope: 'planning',
      candidates: [{
        id: 'weekly_priority_axis',
        question: 'What matters most this week?',
        scope: 'planning',
        targetEntityKey: 'week:2026-06-09',
        durableLearningTarget: 'weekly_priority_axis',
        infoValueScore: 0.88,
        interruptionCost: 0.12,
        actionImpact: 'high' as const,
      }],
    }

    const mastra = new Mastra({
      logger: false,
      storage: new InMemoryStore({ id: 'clarification-test-storage' }),
    })
    const workflow = createClarificationGateWorkflow(mastra)
    const run = await workflow.createRun({ runId: 'clarification-test-run' })
    const started = await run.start({ inputData })

    expect(started.status).toBe('suspended')
    expect(started.steps['clarification-gate']).toMatchObject({
      status: 'suspended',
      suspendPayload: {
        requestId: 'req-clarify',
        questionKey: 'planning::week:2026-06-09::weekly_priority_axis',
      },
    })

    const resumed = await run.resume({
      step: 'clarification-gate',
      resumeData: {
        questionKey: 'planning::week:2026-06-09::weekly_priority_axis',
        action: 'answered',
        answer: 'Health and client deadlines',
      },
    })

    expect(resumed.status).toBe('success')
    expect(resumed.result).toMatchObject({
      status: 'answered',
      questionKey: 'planning::week:2026-06-09::weekly_priority_axis',
      answer: 'Health and client deadlines',
      answerAction: 'answered',
    })
  })

  it.runIf(supportsMastraRuntime)('exposes a storage-backed start/resume runtime API for app wiring', async () => {
    const { MastraClarificationRuntime } = await import('@/services/ai/runtime/mastraClarificationRuntime')
    const { Mastra } = await import('@mastra/core/mastra')
    const { InMemoryStore } = await import('@mastra/core/storage')
    const runtime = new MastraClarificationRuntime(new Mastra({
      logger: false,
      storage: new InMemoryStore({ id: 'clarification-runtime-test-storage' }),
    }))

    const started = await runtime.startClarification({
      requestId: 'req-runtime',
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
      sessionResolvedQuestionKeys: new Set(),
      now: new Date('2026-06-09T10:00:00Z'),
    }, 'clarification-runtime-run')

    expect(started).toMatchObject({
      status: 'suspended',
      runId: 'clarification-runtime-run',
      payload: {
        questionKey: 'planning::week:2026-06-09::weekly_capacity',
      },
    })

    const resumed = await runtime.resumeClarification('clarification-runtime-run', {
      questionKey: 'planning::week:2026-06-09::weekly_capacity',
      action: 'answered',
      answer: 'About 8 hours',
    })

    expect(resumed).toMatchObject({
      status: 'success',
      runId: 'clarification-runtime-run',
      output: {
        status: 'answered',
        questionKey: 'planning::week:2026-06-09::weekly_capacity',
        answer: 'About 8 hours',
      },
    })
  })

  it.runIf(supportsMastraRuntime)('resumes a suspended clarification from a fresh runtime using local LibSQL storage', async () => {
    const { MastraClarificationRuntime } = await import('@/services/ai/runtime/mastraClarificationRuntime')
    const { Mastra } = await import('@mastra/core/mastra')
    const { LibSQLStore } = await import('@mastra/libsql')
    const storageDir = await mkdtemp(join(tmpdir(), 'flowstate-mastra-'))
    const dbUrl = `file:${join(storageDir, 'mastra.db')}`

    const createRuntime = () => {
      const storage = new LibSQLStore({
        id: 'clarification-libsql-test-storage',
        url: dbUrl,
      })
      return {
        storage,
        runtime: new MastraClarificationRuntime(new Mastra({
          logger: false,
          storage,
        })),
      }
    }

    try {
      const first = createRuntime()
      const started = await first.runtime.startClarification({
        requestId: 'req-libsql',
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
      }, 'clarification-libsql-run')

      expect(started.status).toBe('suspended')
      await first.storage.close()

      const second = createRuntime()
      const resumed = await second.runtime.resumeClarification('clarification-libsql-run', {
        questionKey: 'planning::week:2026-06-09::weekly_capacity',
        action: 'answered',
        answer: 'About 8 hours',
      })

      expect(resumed).toMatchObject({
        status: 'success',
        output: {
          status: 'answered',
          questionKey: 'planning::week:2026-06-09::weekly_capacity',
          answer: 'About 8 hours',
        },
      })
      await second.storage.close()
    } finally {
      await rm(storageDir, { recursive: true, force: true })
    }
  })

  it.skipIf(supportsMastraRuntime)('documents that Mastra adapter execution requires Node 22+', () => {
    expect(process.versions.node).toMatch(/^20\./)
  })
})
