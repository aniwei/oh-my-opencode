// AgentStream 测试（验收 4.3.2, 4.3.3）
import { createAgentStream } from '../src/agent-stream'

import type { AgentSessionResult } from '@vitamin/coding-agent'
import type { StreamEvent } from '../src/types'

function createMockResult(): AgentSessionResult {
  return {
    response: 'Hello from agent',
    cost: 0.01,
    tokens: { input: 100, output: 50 },
    toolCalls: [],
    duration: 500,
  }
}

describe('AgentStream', () => {
  // 验收 4.3.2: AgentStream 支持 for await 逐事件消费
  describe('#given 正常执行的流', () => {
    describe('#when 用 for await 遍历', () => {
      it('#then 按顺序收到 start → text_delta → done（4.3.2）', async () => {
        const mockResult = createMockResult()
        const stream = createAgentStream(async (push, done) => {
          push({ type: 'start' })
          push({ type: 'text_delta', text: 'Hello' })
          push({ type: 'text_delta', text: ' world' })
          push({ type: 'done', result: mockResult })
          done()
          return mockResult
        })

        const events: StreamEvent[] = []
        for await (const event of stream) {
          events.push(event)
        }

        expect(events).toHaveLength(4)
        expect(events[0]!.type).toBe('start')
        expect(events[1]!.type).toBe('text_delta')
        expect((events[1] as { type: 'text_delta'; text: string }).text).toBe('Hello')
        expect(events[2]!.type).toBe('text_delta')
        expect(events[3]!.type).toBe('done')
      })
    })
  })

  describe('#given result() 调用', () => {
    describe('#when 流完成', () => {
      it('#then 返回完整的 AgentSessionResult', async () => {
        const mockResult = createMockResult()
        const stream = createAgentStream(async (push, done) => {
          push({ type: 'start' })
          push({ type: 'done', result: mockResult })
          done()
          return mockResult
        })

        const result = await stream.result()

        expect(result.response).toBe('Hello from agent')
        expect(result.cost).toBe(0.01)
        expect(result.tokens.input).toBe(100)
      })
    })
  })

  describe('#given 包含工具调用的流', () => {
    describe('#when 包含 tool_call 和 tool_result', () => {
      it('#then 事件序列完整', async () => {
        const mockResult = createMockResult()
        const stream = createAgentStream(async (push, done) => {
          push({ type: 'start' })
          push({ type: 'tool_call', name: 'read_file', args: { path: '/a.ts' } })
          push({ type: 'tool_result', name: 'read_file', result: 'file content' })
          push({ type: 'text_delta', text: 'I read the file.' })
          push({ type: 'done', result: mockResult })
          done()
          return mockResult
        })

        const events: StreamEvent[] = []
        for await (const event of stream) {
          events.push(event)
        }

        expect(events).toHaveLength(5)
        const toolCall = events[1] as { type: 'tool_call'; name: string; args: Record<string, unknown> }
        expect(toolCall.name).toBe('read_file')
        expect(toolCall.args).toEqual({ path: '/a.ts' })

        const toolResult = events[2] as { type: 'tool_result'; name: string; result: string }
        expect(toolResult.result).toBe('file content')
      })
    })
  })

  describe('#given 执行异常', () => {
    describe('#when executor 抛出错误', () => {
      it('#then 流包含 error 事件', async () => {
        const stream = createAgentStream(async (_push, _done) => {
          throw new Error('Agent crashed')
        })

        const events: StreamEvent[] = []
        for await (const event of stream) {
          events.push(event)
        }

        const errorEvent = events.find(e => e.type === 'error')
        expect(errorEvent).toBeDefined()
        expect((errorEvent as { type: 'error'; error: string }).error).toContain('crashed')
      })

      it('#then result() 会 reject', async () => {
        const stream = createAgentStream(async (_push, _done) => {
          throw new Error('Agent crashed')
        })

        // 消费流来触发执行
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _event of stream) {
          // consume
        }

        await expect(stream.result()).rejects.toThrow('crashed')
      })
    })
  })

  // 验收 4.3.3: SDK abort() 可控制 Agent
  describe('#given abort() 调用', () => {
    describe('#when 流进行中调用 abort', () => {
      it('#then 流终止（4.3.3）', async () => {
        const mockResult = createMockResult()
        let pushFn: ((event: StreamEvent) => void) | null = null

        const stream = createAgentStream(async (push, _done) => {
          pushFn = push
          push({ type: 'start' })
          // 永远不会完成 — 等待外部 abort
          await new Promise(() => {
            // 永远 pending
          })
          return mockResult
        })

        // 给执行器时间启动
        await new Promise(r => setTimeout(r, 10))

        // 中止
        stream.abort()

        // abort 后 iterator 应该结束
        const events: StreamEvent[] = []
        for await (const event of stream) {
          events.push(event)
        }

        // 至少收到了 start 事件
        expect(events.length).toBeGreaterThanOrEqual(1)
        expect(events[0]!.type).toBe('start')
      })
    })
  })

  describe('#given 空流', () => {
    describe('#when executor 立即完成', () => {
      it('#then 无事件', async () => {
        const mockResult = createMockResult()
        const stream = createAgentStream(async (_push, done) => {
          done()
          return mockResult
        })

        const events: StreamEvent[] = []
        for await (const event of stream) {
          events.push(event)
        }

        expect(events).toHaveLength(0)
      })
    })
  })

  describe('#given 延迟事件', () => {
    describe('#when 事件间有延迟', () => {
      it('#then for await 正确接收所有事件', async () => {
        const mockResult = createMockResult()
        const stream = createAgentStream(async (push, done) => {
          push({ type: 'start' })
          await new Promise(r => setTimeout(r, 10))
          push({ type: 'text_delta', text: 'delayed' })
          await new Promise(r => setTimeout(r, 10))
          push({ type: 'done', result: mockResult })
          done()
          return mockResult
        })

        const events: StreamEvent[] = []
        for await (const event of stream) {
          events.push(event)
        }

        expect(events).toHaveLength(3)
        expect(events[1]!.type).toBe('text_delta')
        expect((events[1] as { type: 'text_delta'; text: string }).text).toBe('delayed')
      })
    })
  })
})
