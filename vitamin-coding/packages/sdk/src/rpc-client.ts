// RPC 客户端 — JSON-RPC 2.0 over Unix socket / TCP
import { connect } from 'node:net'

import { createLogger } from '@vitamin/shared'

import { createAgentStream } from './agent-stream'

import type { Socket } from 'node:net'
import type { AgentSessionResult } from '@vitamin/coding-agent'
import type { RPCClientOptions, RPCRequest, RPCResponse, VitaminAgent, VitaminAgentState, ConversationHandle, AgentStream } from './types'

const logger = createLogger('sdk:rpc-client')

// 创建 RPC 客户端（返回 VitaminAgent 兼容接口）
export function createRpcClient(options: RPCClientOptions): RPCClientHandle {
  let socket: Socket | null = null
  let nextId = 1
  const pending = new Map<number | string, {
    resolve: (v: unknown) => void
    reject: (e: Error) => void
  }>()

  let buffer = ''

  function handleData(data: Buffer): void {
    buffer += data.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.length === 0) continue

      try {
        const response = JSON.parse(trimmed) as RPCResponse
        const id = response.id
        if (id === null) continue

        const p = pending.get(id)
        if (!p) continue

        pending.delete(id)
        if (response.error) {
          p.reject(new Error(response.error.message))
        } else {
          p.resolve(response.result)
        }
      } catch {
        logger.error('Failed to parse RPC response')
      }
    }
  }

  async function send(method: string, params?: unknown): Promise<unknown> {
    if (!socket || socket.destroyed) {
      throw new Error('RPC client not connected')
    }

    const id = nextId++
    const request: RPCRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    }

    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      socket!.write(JSON.stringify(request) + '\n')
    })
  }

  const agent: VitaminAgent = {
    prompt(text: string): AgentStream {
      return createAgentStream(async (push, done) => {
        push({ type: 'start' })
        const result = await send('prompt', { text }) as AgentSessionResult
        push({ type: 'done', result })
        done()
        return result
      })
    },

    conversation(): ConversationHandle {
      const history: AgentSessionResult[] = []
      let ended = false

      return {
        send(text: string): AgentStream {
          if (ended) {
            throw new Error('Conversation has ended')
          }

          return createAgentStream(async (push, done) => {
            push({ type: 'start' })
            const result = await send('prompt', { text }) as AgentSessionResult
            history.push(result)
            push({ type: 'done', result })
            done()
            return result
          })
        },

        getHistory() {
          return [...history]
        },

        get turnCount() {
          return history.length
        },

        end() {
          ended = true
        },
      }
    },

    steer(message: string): void {
      send('steer', { message }).catch(e => {
        logger.error('steer failed: %s', (e as Error).message)
      })
    },

    abort(): void {
      send('abort').catch(e => {
        logger.error('abort failed: %s', (e as Error).message)
      })
    },

    getState(): VitaminAgentState {
      // 同步接口;; RPC 是异步的 — 返回缓存状态（暂用占位）
      return {
        model: 'unknown',
        isRunning: false,
        messageCount: 0,
        totalTokens: { input: 0, output: 0 },
      }
    },

    async dispose(): Promise<void> {
      try {
        await send('dispose')
      } finally {
        socket?.destroy()
        socket = null
      }
    },
  }

  return {
    agent,

    async connect(): Promise<void> {
      return new Promise((resolve, reject) => {
        const connectOptions = options.socketPath
          ? { path: options.socketPath }
          : { host: options.host ?? 'localhost', port: options.port ?? 9999 }

        socket = connect(connectOptions, () => {
          logger.info('RPC client connected')
          resolve()
        })

        socket.on('data', handleData)
        socket.on('error', reject)
        socket.on('close', () => {
          logger.info('RPC client disconnected')
          // Reject 所有 pending
          for (const [, p] of pending) {
            p.reject(new Error('Connection closed'))
          }
          pending.clear()
        })
      })
    },

    async disconnect(): Promise<void> {
      if (socket) {
        socket.destroy()
        socket = null
      }
    },

    get connected(): boolean {
      return socket !== null && !socket.destroyed
    },
  }
}

export interface RPCClientHandle {
  agent: VitaminAgent
  connect(): Promise<void>
  disconnect(): Promise<void>
  connected: boolean
}
