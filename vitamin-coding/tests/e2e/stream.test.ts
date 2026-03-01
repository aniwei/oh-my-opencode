// E2E 测试 — AgentStream 异步迭代
import { describe, it, expect } from 'vitest'

import { createAgentStream } from '@vitamin/sdk'
import type { StreamEvent } from '@vitamin/sdk'

describe('E2E: AgentStream 流式消费', () => {
  describe('#given AgentStream 流式消费', () => {
    it('#then 可用 for-await-of 迭代所有事件', async () => {
      const events: StreamEvent[] = []

      const stream = createAgentStream(async (push, done) => {
        push({ type: 'start' })
        push({ type: 'text_delta', text: '你好' })
        push({ type: 'tool_call', name: 'read-file', args: { path: 'test.ts' } })
        push({ type: 'tool_result', name: 'read-file', result: '文件内容' })
        push({
          type: 'done',
          result: {
            response: '你好',
            cost: 0,
            tokens: { input: 10, output: 5 },
            toolCalls: [],
            duration: 100,
          },
        })
        done()
        return {
          response: '你好',
          cost: 0,
          tokens: { input: 10, output: 5 },
          toolCalls: [],
          duration: 100,
        }
      })

      for await (const event of stream) {
        events.push(event)
      }

      expect(events.length).toBe(5)
      expect(events[0]?.type).toBe('start')
      expect(events[1]?.type).toBe('text_delta')
      expect(events[2]?.type).toBe('tool_call')
      expect(events[3]?.type).toBe('tool_result')
      expect(events[4]?.type).toBe('done')

      const result = await stream.result()
      expect(result.response).toBe('你好')
    })
  })

  describe('#given Stream 中途取消', () => {
    it('#then 部分事件正常消费', async () => {
      const events: StreamEvent[] = []

      const stream = createAgentStream(async (push, done) => {
        push({ type: 'start' })
        push({ type: 'text_delta', text: '部分' })
        push({ type: 'text_delta', text: '内容' })
        push({
          type: 'done',
          result: {
            response: '部分内容',
            cost: 0,
            tokens: { input: 5, output: 3 },
            toolCalls: [],
            duration: 50,
          },
        })
        done()
        return {
          response: '部分内容',
          cost: 0,
          tokens: { input: 5, output: 3 },
          toolCalls: [],
          duration: 50,
        }
      })

      for await (const event of stream) {
        events.push(event)
        if (events.length >= 2) break
      }

      expect(events.length).toBe(2)
      expect(events[0]?.type).toBe('start')
      expect(events[1]?.type).toBe('text_delta')
    })
  })
})
