import type { AIClarificationArtifact } from '@/types/aiMemory'
import { questionKey, type ChatDecisionRuntimeInput } from './chatDecisionRuntime'

type ElectronLocalApiRuntime = {
  isElectron?: boolean
  getLocalApiToken?: () => Promise<string>
  getLocalApiStatus?: () => Promise<{ enabled: boolean; running: boolean; listening: boolean; port: number }>
}

type LocalRuntimeResult =
  | { ok: true; status: string; runId: string; payload?: { questionKey: string }; output?: { status: string; questionKey?: string; answer?: string } }
  | { ok: false; error: string }

const RUNTIME_TIMEOUT_MS = 2_500

function electronApi(): ElectronLocalApiRuntime | null {
  if (typeof window === 'undefined') return null
  const api = (window as unknown as { electronAPI?: ElectronLocalApiRuntime }).electronAPI
  return api?.isElectron ? api : null
}

export function canUseLocalClarificationRuntime(): boolean {
  const api = electronApi()
  return Boolean(api?.getLocalApiStatus && api.getLocalApiToken)
}

function withTimeout<T>(operation: Promise<T>, timeoutMs = RUNTIME_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`local AI runtime timed out after ${timeoutMs}ms`)), timeoutMs)
    operation
      .then(value => resolve(value))
      .catch(error => reject(error))
      .finally(() => window.clearTimeout(timer))
  })
}

async function postLocalRuntime(path: string, body: unknown): Promise<LocalRuntimeResult> {
  const api = electronApi()
  if (!api?.getLocalApiStatus || !api.getLocalApiToken) {
    return { ok: false, error: 'electron local API unavailable' }
  }
  try {
    const [status, token] = await Promise.all([
      api.getLocalApiStatus(),
      api.getLocalApiToken(),
    ])
    if (!status.port) return { ok: false, error: 'local API port unavailable' }
    const response = await withTimeout(fetch(`http://127.0.0.1:${status.port}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }))
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return { ok: false, error: typeof data.error === 'string' ? data.error : `local AI runtime returned ${response.status}` }
    }
    return data as LocalRuntimeResult
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'local AI runtime request failed' }
  }
}

export function buildClarificationRuntimeInput(card: AIClarificationArtifact): ChatDecisionRuntimeInput {
  const evpi = card.debug?.evpi?.candidates.find(candidate => candidate.questionId === card.question.id)
  const durableLearningTarget = evpi?.targetedParameters?.length
    ? evpi.targetedParameters.join(',')
    : card.question.reason
  const candidate = {
    id: card.question.id,
    question: card.question.question,
    scope: card.responseMode ?? card.kind,
    targetEntityKey: card.memoryKey,
    durableLearningTarget,
    infoValueScore: evpi?.heuristicEvpi ?? card.debug?.evpi?.heuristicEvpi ?? card.coverage?.score ?? 0.75,
    interruptionCost: evpi?.userCost ?? card.debug?.evpi?.userCost ?? 0.12,
    actionImpact: card.coverage?.materiality === 'high' ? 'high' as const : card.coverage?.materiality === 'medium' ? 'medium' as const : 'low' as const,
  }
  return {
    requestId: `${card.kind}:${card.memoryKey}:${card.question.id}`,
    scope: candidate.scope,
    candidates: [candidate],
    askThreshold: Math.max(0.1, Math.min(0.42, candidate.infoValueScore - candidate.interruptionCost - 0.01)),
  }
}

export function assignLocalRuntime(card: AIClarificationArtifact, sourceMessageId: string): AIClarificationArtifact {
  if (!canUseLocalClarificationRuntime()) return card
  const input = buildClarificationRuntimeInput(card)
  const candidate = input.candidates[0]
  const runId = `clarification:${sourceMessageId}:${card.question.id}`
  return {
    ...card,
    runtime: {
      provider: 'mastra_local_api',
      runId,
      questionKey: questionKey(candidate),
      status: 'pending',
    },
  }
}

export async function startLocalClarificationRuntime(card: AIClarificationArtifact): Promise<LocalRuntimeResult> {
  if (!card.runtime) return { ok: false, error: 'clarification runtime metadata missing' }
  return postLocalRuntime('/api/ai/clarifications/start', {
    runId: card.runtime.runId,
    input: buildClarificationRuntimeInput(card),
  })
}

export async function resumeLocalClarificationRuntime(card: AIClarificationArtifact, answer: string): Promise<LocalRuntimeResult> {
  if (!card.runtime) return { ok: false, error: 'clarification runtime metadata missing' }
  return postLocalRuntime(`/api/ai/clarifications/${encodeURIComponent(card.runtime.runId)}/resume`, {
    resumeData: {
      questionKey: card.runtime.questionKey,
      answer,
      action: 'answered',
    },
  })
}
