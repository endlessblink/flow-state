import { join, resolve, sep } from 'path'

/**
 * BUG-1932: Electron derives `userData` from `$XDG_CONFIG_HOME` / `$HOME`. Any launcher that
 * rewrites `HOME` (agent sandboxes, systemd units with `Environment=`, containers) therefore gets
 * a pristine, empty profile — no `store.json`, no auth session, no `local-api.json` — and the user
 * sees an unexplained "Sign In" screen while their real session sits untouched in the passwd home.
 * The sandboxed instance also binds the Local API port with a token no other client can read.
 *
 * We pin `userData` to the home directory recorded in `/etc/passwd`, which no environment variable
 * can forge. Note `os.homedir()` is unusable here: it prefers `$HOME`. Callers must pass
 * `os.userInfo().homedir`.
 */

export interface ResolveUserDataOptions {
  env: NodeJS.ProcessEnv
  /** From `os.userInfo().homedir` — reads passwd, NOT the environment. */
  passwdHome: string
  /** `app.getName()`, i.e. the same basename Electron would have used. */
  appName: string
  platform: NodeJS.Platform
}

/** True when `child` is `parent` itself or nested inside it. */
function isInside(parent: string, child: string): boolean {
  const p = resolve(parent)
  const c = resolve(child)
  return c === p || c.startsWith(p.endsWith(sep) ? p : p + sep)
}

/**
 * Returns the directory `userData` should be pinned to, or `null` to leave Electron's own
 * resolution alone (the common case — nothing to correct).
 */
export function resolveUserDataDir({
  env,
  passwdHome,
  appName,
  platform,
}: ResolveUserDataOptions): string | null {
  // Only Linux maps userData onto ~/.config. macOS and Windows use Application Support / APPDATA,
  // which this function has no business rewriting.
  if (platform !== 'linux') return null

  if (!passwdHome || !appName) return null

  // Deliberate isolation — honour it.
  if (env.FLOWSTATE_ALLOW_HOME_OVERRIDE === '1') return null

  // An explicit XDG_CONFIG_HOME anywhere under the real home is a legitimate user preference.
  // Pointing it outside the real home is the same hijack as rewriting HOME.
  if (env.XDG_CONFIG_HOME) {
    return isInside(passwdHome, env.XDG_CONFIG_HOME) ? null : join(passwdHome, '.config', appName)
  }

  // For HOME, containment is NOT enough: agent sandboxes commonly nest their profile *inside* the
  // real home (e.g. ~/.hermes/profiles/office-work/home), which would pass a startsWith check while
  // still yielding a pristine, empty profile. Only an exact match means "not hijacked".
  if (env.HOME && resolve(env.HOME) === resolve(passwdHome)) return null

  return join(passwdHome, '.config', appName)
}
