const TASK_UPDATE_TARGET_MISSING_PREFIX = 'Task update target no longer exists:'

export const isTaskUpdateTargetMissingError = (error: unknown): boolean =>
  error instanceof Error && error.message.startsWith(TASK_UPDATE_TARGET_MISSING_PREFIX)

/**
 * Fire-and-forget UI gestures can race a background refresh that removes the
 * task from the local snapshot. That stale gesture is safe to ignore; all
 * other failures still reject so the global handler can surface them.
 */
export const settleBackgroundTaskMutation = async (
  mutation: Promise<unknown>,
  source: string,
): Promise<void> => {
  try {
    await mutation
  } catch (error) {
    if (isTaskUpdateTargetMissingError(error)) {
      console.warn(`[TASKS] Ignored stale ${source} gesture`, error)
      return
    }
    throw error
  }
}
