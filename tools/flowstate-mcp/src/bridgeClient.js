export function getBridgeConfig(env = process.env) {
  const bridgeUrl = env.FLOWSTATE_AGENT_BRIDGE_URL
  const token = env.FLOWSTATE_AGENT_BRIDGE_TOKEN

  if (!bridgeUrl || !token) return null
  if (!isLoopbackHttpUrl(bridgeUrl)) return null
  return { bridgeUrl, token }
}

export function isLoopbackHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:'
      && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
      && !url.username
      && !url.password
  } catch {
    return false
  }
}

export async function callFlowStateBridge(toolName, args = {}, options = {}) {
  const config = options.config ?? getBridgeConfig(options.env)
  if (!config) {
    return {
      status: 'error',
      code: 'flowstate_bridge_unavailable',
      message: `Tool ${toolName} is registered, but the FlowState desktop bridge is not connected yet.`,
    }
  }

  const requestId = options.requestId ?? `mcp-${Date.now()}-${Math.random().toString(36).slice(2)}`
  try {
    const response = await (options.fetch ?? fetch)(`${config.bridgeUrl}/agent/read`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({ requestId, command: toolName, arguments: args }),
    })

    const payload = await response.json()
    if (!response.ok) {
      return {
        status: 'error',
        code: payload.error ?? 'flowstate_bridge_error',
        message: payload.message ?? `FlowState bridge returned HTTP ${response.status}`,
      }
    }

    return payload.result
  } catch (error) {
    return {
      status: 'error',
      code: 'flowstate_bridge_error',
      message: error instanceof Error ? error.message : 'FlowState bridge request failed.',
    }
  }
}
