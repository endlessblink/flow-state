export type ChatRuntimeDecision = 'ask' | 'infer' | 'proceed'

export type ChatQuestionCandidate = {
  id: string
  question: string
  scope: string
  targetEntityKey: string
  durableLearningTarget?: string
  infoValueScore: number
  interruptionCost: number
  confidenceToInfer?: number
  actionImpact?: 'low' | 'medium' | 'high'
}

export type ChatQuestionEvent = {
  questionKey: string
  scope: string
  targetEntityKey: string
  eventType: 'asked' | 'answered' | 'dismissed' | 'skipped' | 'generated_with_uncertainty'
  createdAt: string
}

export type ChatDecisionRuntimeInput = {
  requestId: string
  scope: string
  candidates: ChatQuestionCandidate[]
  recentEvents?: ChatQuestionEvent[]
  sessionResolvedQuestionKeys?: Iterable<string>
  now?: Date
  askThreshold?: number
  inferThreshold?: number
  cooldownDays?: number
}

export type ChatDecisionCandidateTrace = {
  id: string
  questionKey: string
  score: number
  infoValueScore: number
  interruptionCost: number
  decision: 'eligible' | 'blocked'
  reason:
    | 'eligible'
    | 'no_durable_learning_target'
    | 'already_resolved_in_session'
    | 'recently_resolved'
    | 'below_ask_threshold'
}

export type ChatDecisionRuntimeResult = {
  decision: ChatRuntimeDecision
  question?: ChatQuestionCandidate
  inferredQuestion?: ChatQuestionCandidate
  trace: {
    requestId: string
    scope: string
    askThreshold: number
    inferThreshold: number
    candidateCount: number
    candidates: ChatDecisionCandidateTrace[]
    selectedQuestionKey?: string
    reason: string
  }
}

const DEFAULT_ASK_THRESHOLD = 0.42
const DEFAULT_INFER_THRESHOLD = 0.72
const DEFAULT_COOLDOWN_DAYS = 14
const MS_PER_DAY = 86_400_000

export function decideChatRuntimeAction(input: ChatDecisionRuntimeInput): ChatDecisionRuntimeResult {
  const now = input.now ?? new Date()
  const askThreshold = input.askThreshold ?? DEFAULT_ASK_THRESHOLD
  const inferThreshold = input.inferThreshold ?? DEFAULT_INFER_THRESHOLD
  const cooldownDays = input.cooldownDays ?? DEFAULT_COOLDOWN_DAYS
  const sessionResolved = new Set(input.sessionResolvedQuestionKeys ?? [])

  const traces = input.candidates
    .map(candidate => traceCandidate(candidate, {
      askThreshold,
      cooldownDays,
      now,
      recentEvents: input.recentEvents ?? [],
      sessionResolved,
    }))
    .sort((a, b) => b.score - a.score)

  const eligible = traces.find(trace => trace.decision === 'eligible')
  const selected = eligible
    ? input.candidates.find(candidate => questionKey(candidate) === eligible.questionKey)
    : undefined

  if (selected && eligible && eligible.score >= askThreshold) {
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

export function questionKey(candidate: Pick<ChatQuestionCandidate, 'scope' | 'targetEntityKey' | 'durableLearningTarget' | 'id'>): string {
  return [
    candidate.scope,
    candidate.targetEntityKey,
    candidate.durableLearningTarget || candidate.id,
  ].join('::')
}

function traceCandidate(
  candidate: ChatQuestionCandidate,
  context: {
    askThreshold: number
    cooldownDays: number
    now: Date
    recentEvents: ChatQuestionEvent[]
    sessionResolved: Set<string>
  },
): ChatDecisionCandidateTrace {
  const key = questionKey(candidate)
  const score = Number((candidate.infoValueScore - candidate.interruptionCost).toFixed(3))
  if (!candidate.durableLearningTarget) {
    return blocked(candidate, key, score, 'no_durable_learning_target')
  }
  if (context.sessionResolved.has(key)) {
    return blocked(candidate, key, score, 'already_resolved_in_session')
  }
  if (recentlyResolved(candidate, key, context)) {
    return blocked(candidate, key, score, 'recently_resolved')
  }
  if (score < context.askThreshold) {
    return blocked(candidate, key, score, 'below_ask_threshold')
  }
  return {
    id: candidate.id,
    questionKey: key,
    score,
    infoValueScore: candidate.infoValueScore,
    interruptionCost: candidate.interruptionCost,
    decision: 'eligible',
    reason: 'eligible',
  }
}

function blocked(
  candidate: ChatQuestionCandidate,
  key: string,
  score: number,
  reason: ChatDecisionCandidateTrace['reason'],
): ChatDecisionCandidateTrace {
  return {
    id: candidate.id,
    questionKey: key,
    score,
    infoValueScore: candidate.infoValueScore,
    interruptionCost: candidate.interruptionCost,
    decision: 'blocked',
    reason,
  }
}

function recentlyResolved(
  candidate: ChatQuestionCandidate,
  key: string,
  context: {
    cooldownDays: number
    now: Date
    recentEvents: ChatQuestionEvent[]
  },
): boolean {
  const cutoff = context.now.getTime() - context.cooldownDays * MS_PER_DAY
  return context.recentEvents.some(event =>
    event.scope === candidate.scope &&
    event.targetEntityKey === candidate.targetEntityKey &&
    event.questionKey === key &&
    ['answered', 'dismissed', 'generated_with_uncertainty'].includes(event.eventType) &&
    new Date(event.createdAt).getTime() >= cutoff
  )
}
