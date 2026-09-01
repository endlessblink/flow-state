export function traceTaskCompletion(
  phase: string,
  data: Record<string, unknown> = {},
): void {
  const line = JSON.stringify({ at: new Date().toISOString(), phase, ...data })
  console.warn(`[TaskCompletionTrace] ${line}`)
  const electronAPI = (window as unknown as {
    electronAPI?: { appendTaskCompletionDiag?: (entry: string) => Promise<string> }
  }).electronAPI
  void electronAPI?.appendTaskCompletionDiag?.(line)
}
