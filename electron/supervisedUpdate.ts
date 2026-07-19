export const SUPERVISED_UPDATE_EXIT_CODE = 75

export interface UpdateRelaunchPlan {
  strategy: 'systemd' | 'direct'
  exitCode: number
}

export function resolveUpdateRelaunch(
  env: Record<string, string | undefined>,
): UpdateRelaunchPlan {
  if (env.FLOWSTATE_SUPERVISED === '1') {
    return { strategy: 'systemd', exitCode: SUPERVISED_UPDATE_EXIT_CODE }
  }
  return { strategy: 'direct', exitCode: 0 }
}
