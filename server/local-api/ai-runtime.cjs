'use strict'

const { join } = require('path')
const { Mastra } = require('@mastra/core/mastra')
const { createStep, createWorkflow } = require('@mastra/core/workflows')
const { LibSQLStore } = require('@mastra/libsql')
const { z } = require('zod')

const DEFAULT_ASK_THRESHOLD = 0.42
const DEFAULT_INFER_THRESHOLD = 0.72
const DEFAULT_COOLDOWN_DAYS = 14
const MS_PER_DAY = 86_400_000

const questionCandidateSchema = z.object({
  id: z.string(),
  question: z.string(),
  scope: z.string(),
  targetEntityKey: z.string(),
  durableLearningTarget: z.string().optional(),
  infoValueScore: z.number(),
  interruptionCost: z.number(),
  confidenceToInfer: z.number().optional(),
  actionImpact: z.enum(['low', 'medium', 'high']).optional(),
})

const questionEventSchema = z.object({
  questionKey: z.string(),
  scope: z.string(),
  targetEntityKey: z.string(),
  eventType: z.enum(['asked', 'answered', 'dismissed', 'skipped', 'generated_with_uncertainty']),
  createdAt: z.string(),
})

const chatDecisionRuntimeInputSchema = z.object({
  requestId: z.string(),
  scope: z.string(),
  candidates: z.array(questionCandidateSchema),
  recentEvents: z.array(questionEventSchema).optional(),
  sessionResolvedQuestionKeys: z.array(z.string()).optional(),
  nowIso: z.string().optional(),
  askThreshold: z.number().optional(),
  inferThreshold: z.number().optional(),
  cooldownDays: z.number().optional(),
})

const candidateTraceSchema = z.object({
  id: z.string(),
  questionKey: z.string(),
  score: z.number(),
  infoValueScore: z.number(),
  interruptionCost: z.number(),
  decision: z.enum(['eligible', 'blocked']),
  reason: z.enum([
    'eligible',
    'no_durable_learning_target',
    'already_resolved_in_session',
    'recently_resolved',
    'below_ask_threshold',
  ]),
})

const decisionTraceSchema = z.object({
  requestId: z.string(),
  scope: z.string(),
  askThreshold: z.number(),
  inferThreshold: z.number(),
  candidateCount: z.number(),
  candidates: z.array(candidateTraceSchema),
  selectedQuestionKey: z.string().optional(),
  reason: z.string(),
})

const clarificationResumeSchema = z.object({
  questionKey: z.string(),
  answer: z.string(),
  action: z.enum(['answered', 'skipped', 'use_default']).default('answered'),
})

const clarificationSuspendSchema = z.object({
  requestId: z.string(),
  scope: z.string(),
  questionKey: z.string(),
  question: questionCandidateSchema,
  trace: decisionTraceSchema,
})

const clarificationWorkflowOutputSchema = z.object({
  status: z.enum(['proceed', 'infer', 'answered']),
  questionKey: z.string().optional(),
  answer: z.string().optional(),
  answerAction: z.enum(['answered', 'skipped', 'use_default']).optional(),
  decisionTrace: decisionTraceSchema,
})

function questionKey(candidate) {
  return [
    candidate.scope,
    candidate.targetEntityKey,
    candidate.durableLearningTarget || candidate.id,
  ].join('::')
}

function decideChatRuntimeAction(input) {
  const now = input.nowIso ? new Date(input.nowIso) : new Date()
  const askThreshold = input.askThreshold ?? DEFAULT_ASK_THRESHOLD
  const inferThreshold = input.inferThreshold ?? DEFAULT_INFER_THRESHOLD
  const cooldownDays = input.cooldownDays ?? DEFAULT_COOLDOWN_DAYS
  const recentEvents = input.recentEvents ?? []
  const sessionResolved = new Set(input.sessionResolvedQuestionKeys ?? [])
  const cutoff = now.getTime() - cooldownDays * MS_PER_DAY

  const traces = input.candidates.map(candidate => {
    const key = questionKey(candidate)
    const score = Number((candidate.infoValueScore - candidate.interruptionCost).toFixed(3))
    let reason = 'eligible'
    let decision = 'eligible'
    if (!candidate.durableLearningTarget) {
      reason = 'no_durable_learning_target'
      decision = 'blocked'
    } else if (sessionResolved.has(key)) {
      reason = 'already_resolved_in_session'
      decision = 'blocked'
    } else if (recentEvents.some(event =>
      event.scope === candidate.scope &&
      event.targetEntityKey === candidate.targetEntityKey &&
      event.questionKey === key &&
      ['answered', 'dismissed', 'generated_with_uncertainty'].includes(event.eventType) &&
      new Date(event.createdAt).getTime() >= cutoff
    )) {
      reason = 'recently_resolved'
      decision = 'blocked'
    } else if (score < askThreshold) {
      reason = 'below_ask_threshold'
      decision = 'blocked'
    }
    return {
      id: candidate.id,
      questionKey: key,
      score,
      infoValueScore: candidate.infoValueScore,
      interruptionCost: candidate.interruptionCost,
      decision,
      reason,
    }
  }).sort((a, b) => b.score - a.score)

  const eligible = traces.find(trace => trace.decision === 'eligible')
  const selected = eligible
    ? input.candidates.find(candidate => questionKey(candidate) === eligible.questionKey)
    : null
  if (selected && eligible.score >= askThreshold) {
    return {
      decision: 'ask',
      question: selected,
      trace: {
        requestId: input.requestId,
        scope: input.scope,
        askThreshold,
        inferThreshold,
        candidateCount: input.candidates.length,
        candidates: traces,
        selectedQuestionKey: eligible.questionKey,
        reason: 'highest_value_question_above_threshold',
      },
    }
  }

  const inferable = input.candidates.find(candidate =>
    (candidate.confidenceToInfer ?? 0) >= inferThreshold &&
    !sessionResolved.has(questionKey(candidate))
  )
  if (inferable) {
    return {
      decision: 'infer',
      inferredQuestion: inferable,
      trace: {
        requestId: input.requestId,
        scope: input.scope,
        askThreshold,
        inferThreshold,
        candidateCount: input.candidates.length,
        candidates: traces,
        selectedQuestionKey: questionKey(inferable),
        reason: 'confidence_high_enough_to_infer',
      },
    }
  }

  return {
    decision: 'proceed',
    trace: {
      requestId: input.requestId,
      scope: input.scope,
      askThreshold,
      inferThreshold,
      candidateCount: input.candidates.length,
      candidates: traces,
      reason: input.candidates.length ? 'no_question_worth_interruption' : 'no_candidate_questions',
    },
  }
}

const clarificationGateStep = createStep({
  id: 'clarification-gate',
  inputSchema: chatDecisionRuntimeInputSchema,
  outputSchema: clarificationWorkflowOutputSchema,
  resumeSchema: clarificationResumeSchema,
  suspendSchema: clarificationSuspendSchema,
  execute: async ({ inputData, resumeData, suspend }) => {
    const decision = decideChatRuntimeAction(inputData)
    if (resumeData) {
      return {
        status: 'answered',
        questionKey: resumeData.questionKey,
        answer: resumeData.answer,
        answerAction: resumeData.action,
        decisionTrace: decision.trace,
      }
    }
    if (decision.decision === 'ask' && decision.question) {
      return suspend({
        requestId: inputData.requestId,
        scope: inputData.scope,
        questionKey: questionKey(decision.question),
        question: decision.question,
        trace: decision.trace,
      })
    }
    return {
      status: decision.decision === 'infer' ? 'infer' : 'proceed',
      questionKey: decision.inferredQuestion ? questionKey(decision.inferredQuestion) : undefined,
      decisionTrace: decision.trace,
    }
  },
})

function createClarificationGateWorkflow(mastra) {
  return createWorkflow({
    mastra,
    id: 'flowstate-clarification-gate',
    inputSchema: chatDecisionRuntimeInputSchema,
    outputSchema: clarificationWorkflowOutputSchema,
    options: {
      shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus === 'suspended',
    },
  }).then(clarificationGateStep).commit()
}

function createAIMastraRuntime(options = {}) {
  const dataDir = options.dataDir || process.env.FLOW_STATE_API_DATA_DIR || process.cwd()
  const storage = new LibSQLStore({
    id: 'flowstate-ai-runtime',
    url: `file:${join(dataDir, 'flowstate-ai-runtime.db')}`,
  })
  const mastra = new Mastra({
    logger: false,
    storage,
  })
  const workflow = createClarificationGateWorkflow(mastra)

  return {
    async start(input, runId) {
      const parsed = chatDecisionRuntimeInputSchema.parse(input)
      const run = await workflow.createRun({ runId })
      const result = await run.start({ inputData: parsed })
      if (result.status === 'suspended') {
        const payload = clarificationSuspendSchema.parse(result.steps['clarification-gate']?.suspendPayload)
        return { status: 'suspended', runId, payload }
      }
      if (result.status === 'success' && result.result) {
        const output = clarificationWorkflowOutputSchema.parse(result.result)
        return { status: 'success', runId, output }
      }
      throw new Error(`Clarification workflow ended unexpectedly: ${result.status}`)
    },
    async resume(runId, resumeData) {
      const parsed = clarificationResumeSchema.parse(resumeData)
      const run = await workflow.createRun({ runId })
      const result = await run.resume({
        step: 'clarification-gate',
        resumeData: parsed,
      })
      if (result.status !== 'success' || !result.result) {
        throw new Error(`Clarification workflow resume ended unexpectedly: ${result.status}`)
      }
      return {
        status: 'success',
        runId,
        output: clarificationWorkflowOutputSchema.parse(result.result),
      }
    },
    close: () => storage.close(),
  }
}

module.exports = {
  createAIMastraRuntime,
  decideChatRuntimeAction,
  questionKey,
}
