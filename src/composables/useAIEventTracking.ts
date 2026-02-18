/**
 * AI Behavioral Event Tracking (TASK-1356)
 *
 * Tracks AI interaction events for behavioral proxy metrics:
 * - Acceptance rate: suggestions accepted / shown
 * - Edit rate: accepted suggestions that were modified
 * - Retry rate: prompts re-sent or rephrased
 * - Session depth: average turns per conversation
 * - Abandonment rate: sessions ended without task completion
 *
 * Research basis: DX Research, Google Cloud Gen AI KPIs, Mem0 benchmarks
 *
 * Events stored in localStorage for assessment consumption.
 * Capped at 500 events (rolling window).
 */

import { ref, computed } from 'vue'

// ============================================================================
// Types
// ============================================================================

export type AIEventType =
  | 'suggestion_shown'
  | 'suggestion_accepted'
  | 'suggestion_rejected'
  | 'suggestion_edited'    // accepted but modified before use
  | 'chat_message_sent'
  | 'chat_retry'           // user re-sent or rephrased
  | 'chat_session_start'
  | 'chat_session_end'
  | 'chat_tool_call'
  | 'task_completed_via_ai' // user completed a task that AI helped with

export interface AIEvent {
  id: string
  type: AIEventType
  feature: 'chat' | 'task_assist' | 'weekly_plan' | 'quick_sort' | 'insights'
  sessionId?: string
  metadata?: Record<string, unknown>
  timestamp: string
}

export interface BehavioralMetrics {
  totalEvents: number
  period: string // 'all' | '7d' | '30d'

  // Suggestion metrics
  suggestionsShown: number
  suggestionsAccepted: number
  suggestionsRejected: number
  suggestionsEdited: number
  acceptanceRate: number     // 0-100
  editRate: number           // 0-100 (of accepted)

  // Chat metrics
  chatSessions: number
  chatMessages: number
  chatRetries: number
  retryRate: number          // 0-100
  avgSessionDepth: number    // avg messages per session
  toolCallRate: number       // tool calls per session

  // Effectiveness
  tasksCompletedViaAI: number
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'flowstate-ai-events'
const MAX_EVENTS = 500

// ============================================================================
// Composable
// ============================================================================

// Module-level storage for reactivity
const events = ref<AIEvent[]>(loadEvents())

function loadEvents(): AIEvent[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as AIEvent[]
  } catch {
    return []
  }
}

function persistEvents() {
  try {
    // Trim to max and persist
    const trimmed = events.value.slice(0, MAX_EVENTS)
    events.value = trimmed
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // localStorage not available
  }
}

export function useAIEventTracking() {
  /**
   * Record an AI interaction event.
   */
  function trackEvent(
    type: AIEventType,
    feature: AIEvent['feature'],
    metadata?: Record<string, unknown>,
    sessionId?: string,
  ) {
    const event: AIEvent = {
      id: `aie-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      feature,
      sessionId,
      metadata,
      timestamp: new Date().toISOString(),
    }
    events.value.unshift(event)
    persistEvents()
  }

  // Shorthand helpers
  function trackSuggestionShown(feature: AIEvent['feature'], meta?: Record<string, unknown>) {
    trackEvent('suggestion_shown', feature, meta)
  }
  function trackSuggestionAccepted(feature: AIEvent['feature'], meta?: Record<string, unknown>) {
    trackEvent('suggestion_accepted', feature, meta)
  }
  function trackSuggestionRejected(feature: AIEvent['feature'], meta?: Record<string, unknown>) {
    trackEvent('suggestion_rejected', feature, meta)
  }
  function trackSuggestionEdited(feature: AIEvent['feature'], meta?: Record<string, unknown>) {
    trackEvent('suggestion_edited', feature, meta)
  }
  function trackChatMessage(sessionId: string, meta?: Record<string, unknown>) {
    trackEvent('chat_message_sent', 'chat', meta, sessionId)
  }
  function trackChatRetry(sessionId: string, meta?: Record<string, unknown>) {
    trackEvent('chat_retry', 'chat', meta, sessionId)
  }
  function trackChatSessionStart(sessionId: string) {
    trackEvent('chat_session_start', 'chat', undefined, sessionId)
  }
  function trackChatSessionEnd(sessionId: string) {
    trackEvent('chat_session_end', 'chat', undefined, sessionId)
  }
  function trackToolCall(sessionId: string, toolName: string) {
    trackEvent('chat_tool_call', 'chat', { toolName }, sessionId)
  }
  function trackTaskCompletedViaAI(feature: AIEvent['feature']) {
    trackEvent('task_completed_via_ai', feature)
  }

  /**
   * Compute behavioral metrics from event history.
   * @param periodDays - Number of days to look back (0 = all time)
   */
  function computeMetrics(periodDays: number = 0): BehavioralMetrics {
    const cutoff = periodDays > 0
      ? new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()
      : '1970-01-01'

    const filtered = events.value.filter(e => e.timestamp >= cutoff)

    // Suggestion metrics
    const suggestionsShown = filtered.filter(e => e.type === 'suggestion_shown').length
    const suggestionsAccepted = filtered.filter(e => e.type === 'suggestion_accepted').length
    const suggestionsRejected = filtered.filter(e => e.type === 'suggestion_rejected').length
    const suggestionsEdited = filtered.filter(e => e.type === 'suggestion_edited').length
    const totalSuggestionResponses = suggestionsAccepted + suggestionsRejected + suggestionsEdited
    const acceptanceRate = totalSuggestionResponses > 0
      ? Math.round(((suggestionsAccepted + suggestionsEdited) / totalSuggestionResponses) * 100)
      : 0
    const editRate = (suggestionsAccepted + suggestionsEdited) > 0
      ? Math.round((suggestionsEdited / (suggestionsAccepted + suggestionsEdited)) * 100)
      : 0

    // Chat metrics
    const chatSessions = filtered.filter(e => e.type === 'chat_session_start').length
    const chatMessages = filtered.filter(e => e.type === 'chat_message_sent').length
    const chatRetries = filtered.filter(e => e.type === 'chat_retry').length
    const retryRate = chatMessages > 0
      ? Math.round((chatRetries / chatMessages) * 100)
      : 0
    const avgSessionDepth = chatSessions > 0
      ? Math.round((chatMessages / chatSessions) * 10) / 10
      : 0

    const toolCalls = filtered.filter(e => e.type === 'chat_tool_call').length
    const toolCallRate = chatSessions > 0
      ? Math.round((toolCalls / chatSessions) * 10) / 10
      : 0

    const tasksCompletedViaAI = filtered.filter(e => e.type === 'task_completed_via_ai').length

    return {
      totalEvents: filtered.length,
      period: periodDays > 0 ? `${periodDays}d` : 'all',
      suggestionsShown,
      suggestionsAccepted,
      suggestionsRejected,
      suggestionsEdited,
      acceptanceRate,
      editRate,
      chatSessions,
      chatMessages,
      chatRetries,
      retryRate,
      avgSessionDepth,
      toolCallRate,
      tasksCompletedViaAI,
    }
  }

  /**
   * Reactive metrics for current 7-day window.
   */
  const weeklyMetrics = computed(() => computeMetrics(7))

  /**
   * Get all events (for assessment engine).
   */
  function getEvents(): AIEvent[] {
    return events.value
  }

  /**
   * Clear all tracked events.
   */
  function clearEvents() {
    events.value = []
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    // Track events
    trackEvent,
    trackSuggestionShown,
    trackSuggestionAccepted,
    trackSuggestionRejected,
    trackSuggestionEdited,
    trackChatMessage,
    trackChatRetry,
    trackChatSessionStart,
    trackChatSessionEnd,
    trackToolCall,
    trackTaskCompletedViaAI,

    // Metrics
    computeMetrics,
    weeklyMetrics,

    // Data access
    getEvents,
    clearEvents,
  }
}
