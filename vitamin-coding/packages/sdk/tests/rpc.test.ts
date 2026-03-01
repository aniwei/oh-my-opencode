// RPC 服务器/客户端集成测试（验收 4.3.4）
import { existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

import { createRpcServer } from '../src/rpc-server'
import { createRpcClient } from '../src/rpc-client'

import type { VitaminAgent, VitaminAgentState, AgentStream } from '../src/types'
import type { AgentSessionResult } from '@vitamin/coding-agent'

// 创建 mock VitaminAgent
function createMockAgent(): VitaminAgent & { mockState: VitaminAgentState; disposed: boolean } {
  const state: VitaminAgentState = {
    model: 'claude-sonnet',
    isRunning: false,
    messageCount: 5,
    totalTokens: { input: 3000, output: 1500 },
  }

  let disposed = false

  return {
    mockState: state,
    disposed,

    prompt(_text: string): AgentStream {
      // 返回一个简单的可 await 的 stream
      const result: AgentSessionResult = {
        response: `Echo: ${_text}`,
        cost: 0.005,
        tokens: { input: 50, output: 25 },
        toolCalls: [],
        duration: 100,
      }

      return {
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'start' as const }
          yield { type: 'done' as const, result }
        },
        result: async () => result,
        abort: () => undefined,
      }
    },

    steer(_message: string): void {
      // no-op for mock
    },

    abort(): void {
      state.isRunning = false
    },

    getState(): VitaminAgentState {
      return { ...state }
    },

    async dispose(): Promise<void> {
      disposed = true
    },
  }
}

describe('RPC Server/Client', () => {
  let socketPath: string

  beforeEach(() => {
    socketPath = join(tmpdir(), `vitamin-test-${randomUUID()}.sock`)
  })

  afterEach(() => {
    if (existsSync(socketPath)) {
      try { unlinkSync(socketPath) } catch { /* ignore */ }
    }
  })

  // 验收 4.3.4: RPC 模式 — 跨进程通信
  describe('#given RPC server 和 client', () => {
    describe('#when prompt 通过 RPC', () => {
      it('#then client 收到 server 的响应（4.3.4）', async () => {
        const agent = createMockAgent()
        const server = createRpcServer(agent, { socketPath })

        await server.start()

        try {
          const client = createRpcClient({ socketPath })
          await client.connect()

          try {
            const stream = client.agent.prompt('Hello RPC')
            const result = await stream.result()

            expect(result.response).toBe('Echo: Hello RPC')
            expect(result.cost).toBe(0.005)
          } finally {
            await client.disconnect()
          }
        } finally {
          await server.stop()
        }
      })
    })

    describe('#when getState 通过 RPC', () => {
      it('#then 返回 agent 状态', async () => {
        const agent = createMockAgent()
        const server = createRpcServer(agent, { socketPath })

        await server.start()

        try {
          const client = createRpcClient({ socketPath })
          await client.connect()

          try {
            // RPC getState 是同步接口，返回缓存状态
            // 但 server 端可以异步处理
            const state = client.agent.getState()
            expect(state).toBeDefined()
            expect(state.model).toBe('unknown') // client 缓存状态
          } finally {
            await client.disconnect()
          }
        } finally {
          await server.stop()
        }
      })
    })

    describe('#when 调用未知方法', () => {
      it('#then server 返回 method not found', async () => {
        const agent = createMockAgent()
        const server = createRpcServer(agent, { socketPath })

        await server.start()

        try {
          // 直接用 net 连接发送原始 JSON-RPC
          const { connect } = await import('node:net')
          const sock = connect({ path: socketPath })

          const response = await new Promise<string>((resolve) => {
            sock.on('data', (data) => {
              resolve(data.toString())
              sock.destroy()
            })
            sock.write(JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'nonexistent',
            }) + '\n')
          })

          const parsed = JSON.parse(response.trim())
          expect(parsed.error).toBeDefined()
          expect(parsed.error.code).toBe(-32601)
          expect(parsed.error.message).toContain('Method not found')
        } finally {
          await server.stop()
        }
      })
    })

    describe('#when 发送无效 JSON', () => {
      it('#then server 返回 parse error', async () => {
        const agent = createMockAgent()
        const server = createRpcServer(agent, { socketPath })

        await server.start()

        try {
          const { connect } = await import('node:net')
          const sock = connect({ path: socketPath })

          const response = await new Promise<string>((resolve) => {
            sock.on('data', (data) => {
              resolve(data.toString())
              sock.destroy()
            })
            sock.write('not valid json\n')
          })

          const parsed = JSON.parse(response.trim())
          expect(parsed.error).toBeDefined()
          expect(parsed.error.code).toBe(-32700)
        } finally {
          await server.stop()
        }
      })
    })
  })

  describe('#given 多个 client 连接', () => {
    describe('#when 两个 client 同时连接', () => {
      it('#then 均可正常通信', async () => {
        const agent = createMockAgent()
        const server = createRpcServer(agent, { socketPath })

        await server.start()

        try {
          const client1 = createRpcClient({ socketPath })
          const client2 = createRpcClient({ socketPath })

          await client1.connect()
          await client2.connect()

          try {
            const [result1, result2] = await Promise.all([
              client1.agent.prompt('Client 1').result(),
              client2.agent.prompt('Client 2').result(),
            ])

            expect(result1.response).toBe('Echo: Client 1')
            expect(result2.response).toBe('Echo: Client 2')
          } finally {
            await client1.disconnect()
            await client2.disconnect()
          }
        } finally {
          await server.stop()
        }
      })
    })
  })
})
