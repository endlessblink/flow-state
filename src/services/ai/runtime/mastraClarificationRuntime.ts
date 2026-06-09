import type { Mastra } from '@mastra/core/mastra'
import type { ChatDecisionRuntimeInput } from './chatDecisionRuntime'
import {
  clarificationResumeSchema,
  clarificationSuspendSchema,
  clarificationWorkflowOutputSchema,
  createClarificationGateWorkflow,
} from './mastraChatDecisionWorkflow'
import type { z } from 'zod'

export type ClarificationResumeInput = z.infer<typeof clarificationResumeSchema>
export type ClarificationSuspendPayload = z.infer<typeof clarificationSuspendSchema>
export type ClarificationWorkflowOutput = z.infer<typeof clarificationWorkflowOutputSchema>

export type ClarificationStartResult =
  | {
      status: 'suspended'
      runId: string
      payload: ClarificationSuspendPayload
    }
  | {
      status: 'success'
      runId: string
      output: ClarificationWorkflowOutput
    }

export type ClarificationResumeResult = {
  status: 'success'
  runId: string
  output: ClarificationWorkflowOutput
}

export class MastraClarificationRuntime {
  private readonly workflow: ReturnType<typeof createClarificationGateWorkflow>

  constructor(mastra: Mastra) {
    this.workflow = createClarificationGateWorkflow(mastra)
  }

  async startClarification(input: ChatDecisionRuntimeInput, runId: string): Promise<ClarificationStartResult> {
    const {
      now,
      sessionResolvedQuestionKeys,
      ...schemaInput
    } = input
    const run = await this.workflow.createRun({ runId })
    const result = await run.start({
      inputData: {
        ...schemaInput,
        sessionResolvedQuestionKeys: Array.from(sessionResolvedQuestionKeys ?? []),
        nowIso: now?.toISOString(),
      },
    })

    if (result.status === 'suspended') {
      const payload = result.steps['clarification-gate']?.suspendPayload
      if (!payload) {
        throw new Error('Clarification workflow suspended without a payload')
      }
      const parsedPayload = clarificationSuspendSchema.parse(payload)
      return {
        status: 'suspended',
        runId,
        payload: parsedPayload,
      }
    }

    if (result.status === 'success' && result.result) {
      const output = clarificationWorkflowOutputSchema.parse(result.result)
      return {
        status: 'success',
        runId,
        output,
      }
    }

    throw new Error(`Clarification workflow ended unexpectedly: ${result.status}`)
  }

  async resumeClarification(runId: string, resumeData: ClarificationResumeInput): Promise<ClarificationResumeResult> {
    const run = await this.workflow.createRun({ runId })
    const result = await run.resume({
      step: 'clarification-gate',
      resumeData,
    })

    if (result.status !== 'success' || !result.result) {
      throw new Error(`Clarification workflow resume ended unexpectedly: ${result.status}`)
    }
    const output = clarificationWorkflowOutputSchema.parse(result.result)

    return {
      status: 'success',
      runId,
      output,
    }
  }
}
