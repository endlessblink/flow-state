#!/usr/bin/env node
import { createInterface } from 'node:readline'
import { FLOWSTATE_TOOLS, getToolByName } from './toolDefinitions.js'
import { callFlowStateBridge } from './bridgeClient.js'

const SERVER_INFO = {
  name: 'flowstate-local-mcp',
  version: '0.1.0',
}

function jsonRpcResult(id, result) {
  return { jsonrpc: '2.0', id, result }
}

function jsonRpcError(id, code, message, data) {
  return { jsonrpc: '2.0', id, error: { code, message, ...(data === undefined ? {} : { data }) } }
}

function toolResult(toolName, result) {
  const isError = result?.status === 'error' || result?.status === 'denied' || result?.status === 'validation_error' || result?.status === 'conflict'
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result),
      },
    ],
    structuredContent: { toolName, result },
    isError,
  }
}

export async function handleJsonRpcMessage(message) {
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return jsonRpcError(message?.id ?? null, -32600, 'Invalid JSON-RPC request')
  }

  switch (message.method) {
    case 'initialize':
      return jsonRpcResult(message.id, {
        protocolVersion: message.params?.protocolVersion ?? '2025-06-18',
        capabilities: {
          tools: { listChanged: false },
        },
        serverInfo: SERVER_INFO,
      })

    case 'tools/list':
      return jsonRpcResult(message.id, { tools: FLOWSTATE_TOOLS })

    case 'tools/call': {
      const toolName = message.params?.name
      if (typeof toolName !== 'string' || !getToolByName(toolName)) {
        return jsonRpcError(message.id, -32602, `Unknown tool: ${String(toolName)}`)
      }

      const result = await callFlowStateBridge(toolName, message.params?.arguments ?? {})
      return jsonRpcResult(message.id, toolResult(toolName, result))
    }

    default:
      return jsonRpcError(message.id, -32601, `Method not found: ${message.method}`)
  }
}

function writeMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

export async function runStdioServer() {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity })

  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed) continue

    try {
      writeMessage(await handleJsonRpcMessage(JSON.parse(trimmed)))
    } catch (error) {
      writeMessage(jsonRpcError(null, -32700, 'Parse error', error instanceof Error ? error.message : String(error)))
    }
  }
}

if (process.argv.includes('--list-tools')) {
  writeMessage({ tools: FLOWSTATE_TOOLS })
} else if (import.meta.url === `file://${process.argv[1]}`) {
  runStdioServer().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exitCode = 1
  })
}
