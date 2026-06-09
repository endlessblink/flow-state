import { createStep, createWorkflow } from '@mastra/core/workflows'
import type { Mastra } from '@mastra/core/mastra'
import { z } from 'zod'
import {
  decideChatRuntimeAction,
  questionKey,
  type ChatDecisionRuntimeResult,
} from './chatDecisionRuntime'

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

export const chatDecisionRuntimeInputSchema = z.object({
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

export const chatDecisionRuntimeOutputSchema = z.object({
  decision: z.enum(['ask', 'infer', 'proceed']),
  question: questionCandidateSchema.optional(),
  inferredQuestion: questionCandidateSchema.optional(),
  trace: z.object({
    requestId: z.string(),
    scope: z.string(),
    askThreshold: z.number(),
    inferThreshold: z.number(),
    candidateCount: z.number(),
    candidates: z.array(z.object({
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
    })),
    selectedQuestionKey: z.string().optional(),
    reason: z.string(),
  }),
})

export const clarificationResumeSchema = z.object({
  questionKey: z.string(),
  answer: z.string(),
  action: z.enum(['answered', 'skipped', 'use_default']).default('answered'),
})

export const clarificationSuspendSchema = z.object({
  requestId: z.string(),
  scope: z.string(),
  questionKey: z.string(),
  question: questionCandidateSchema,
  trace: chatDecisionRuntimeOutputSchema.shape.trace,
})

export const clarificationWorkflowOutputSchema = z.object({
  status: z.enum(['proceed', 'infer', 'answered']),
  questionKey: z.string().optional(),
  answer: z.string().optional(),
  answerAction: z.enum(['answered', 'skipped', 'use_default']).optional(),
  decisionTrace: chatDecisionRuntimeOutputSchema.shape.trace,
})

export const chatDecisionStep = createStep({
  id: 'chat-decision-runtime',
  inputSchema: chatDecisionRuntimeInputSchema,
  outputSchema: chatDecisionRuntimeOutputSchema,
  execute: async ({ inputData }): Promise<ChatDecisionRuntimeResult> => {
    return decideChatRuntimeAction({
      ...inputData,
      now: inputData.nowIso ? new Date(inputData.nowIso) : undefined,
      sessionResolvedQuestionKeys: inputData.sessionResolvedQuestionKeys,
    })
  },
})

export const clarificationGateStep = createStep({
  id: 'clarification-gate',
  inputSchema: chatDecisionRuntimeInputSchema,
  outputSchema: clarificationWorkflowOutputSchema,
  resumeSchema: clarificationResumeSchema,
  suspendSchema: clarificationSuspendSchema,
  execute: async ({ inputData, resumeData, suspend }) => {
    const decision = decideChatRuntimeAction({
      ...inputData,
      now: inputData.nowIso ? new Date(inputData.nowIso) : undefined,
      sessionResolvedQuestionKeys: inputData.sessionResolvedQuestionKeys,
    })

    if (resumeData) {
      return {
        status: 'answered' as const,
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
      status: decision.decision === 'infer' ? 'infer' as const : 'proceed' as const,
      questionKey: decision.inferredQuestion ? questionKey(decision.inferredQuestion) : undefined,
      decisionTrace: decision.trace,
    }
  },
})

export function createChatDecisionWorkflow(mastra?: Mastra) {
  return createWorkflow({
    mastra,
    id: 'flowstate-chat-decision-runtime',
    inputSchema: chatDecisionRuntimeInputSchema,
    outputSchema: chatDecisionRuntimeOutputSchema,
  })
    .then(chatDecisionStep)
    .commit()
}

export function createClarificationGateWorkflow(mastra?: Mastra) {
  return createWorkflow({
    mastra,
    id: 'flowstate-clarification-gate',
    inputSchema: chatDecisionRuntimeInputSchema,
    outputSchema: clarificationWorkflowOutputSchema,
    options: {
      shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus === 'suspended',
    },
  })
    .then(clarificationGateStep)
    .commit()
}
