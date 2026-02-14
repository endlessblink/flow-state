/**
 * AI Usage Tracker
 *
 * Centralized, reactive usage log for ALL AI calls in the app.
 * The router calls recordAIUsage() automatically after every chat/stream request.
 * This means weekly plan, task assist, gamification, and any future AI consumer
 * is tracked without per-call-site wiring.
 *
 * Persisted to localStorage so data survives page refreshes.
 * Reactive (Vue ref) so computed properties in useAIUsageTracking update automatically.
 *
 * @see TASK-1316 in MASTER_PLAN.md
 */

import { ref } from 'vue'

// ============================================================================
// Types
// ============================================================================

export interface UsageEntry {
  /** ISO timestamp of the request */
  timestamp: string
  /** Provider identifier ('ollama', 'groq', 'openrouter') */
  provider: string
  /** Model identifier (e.g., 'llama-3.3-70b-versatile') */
  model: string
  /** Estimated input tokens (from prompt messages) */
  inputTokens: number
  /** Estimated output tokens (from response content) */
  outputTokens: number
}

// ============================================================================
// Storage
// ============================================================================

const STORAGE_KEY = 'flowstate-ai-usage-log'

function loadFromStorage(): UsageEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usageEntries.value))
  } catch {
    // localStorage full or unavailable — silently skip
  }
}

// ============================================================================
// Reactive State
// ============================================================================

/** Reactive usage log — single source of truth for the UI */
const usageEntries = ref<UsageEntry[]>(loadFromStorage())

// ============================================================================
// Public API
// ============================================================================

/**
 * Record an AI usage event. Called by the router after each request.
 */
export function recordAIUsage(entry: Omit<UsageEntry, 'timestamp'>) {
  usageEntries.value.push({ ...entry, timestamp: new Date().toISOString() })
  saveToStorage()
}

/**
 * Get the reactive usage entries ref.
 * Used by useAIUsageTracking composable for reactive computed properties.
 */
export function getUsageEntries() {
  return usageEntries
}

/**
 * Clear all usage data.
 */
export function clearUsageEntries() {
  usageEntries.value = []
  saveToStorage()
}
