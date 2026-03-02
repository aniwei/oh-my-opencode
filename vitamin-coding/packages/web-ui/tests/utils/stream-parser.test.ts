import { describe, it, expect } from 'vitest'
import {
  isTextDelta, isThinkingDelta, isToolStart, isToolEnd, isDone, isError,
  parseStreamEventType,
} from '../../src/utils/stream-parser'
import type { StreamEvent } from '../../src/types/api'

function createEvent(type: string, data: unknown = {}): StreamEvent {
  return { type: type as StreamEvent['type'], data }
}

describe('stream-parser', () => {
  describe('type guards', () => {
    describe('#given 各类 StreamEvent', () => {
      describe('#when 调用 isTextDelta', () => {
        it('#then 仅匹配 text_delta 类型', () => {
          expect(isTextDelta(createEvent('text_delta', { delta: 'hi' }))).toBe(true)
          expect(isTextDelta(createEvent('thinking_delta'))).toBe(false)
        })
      })

      describe('#when 调用 isThinkingDelta', () => {
        it('#then 仅匹配 thinking_delta 类型', () => {
          expect(isThinkingDelta(createEvent('thinking_delta', { delta: '...' }))).toBe(true)
          expect(isThinkingDelta(createEvent('text_delta'))).toBe(false)
        })
      })

      describe('#when 调用 isToolStart', () => {
        it('#then 仅匹配 tool_start 类型', () => {
          expect(isToolStart(createEvent('tool_start', { toolCallId: 't1', name: 'bash' }))).toBe(true)
          expect(isToolStart(createEvent('tool_end'))).toBe(false)
        })
      })

      describe('#when 调用 isToolEnd', () => {
        it('#then 仅匹配 tool_end 类型', () => {
          expect(isToolEnd(createEvent('tool_end', { toolCallId: 't1', status: 'success' }))).toBe(true)
          expect(isToolEnd(createEvent('tool_start'))).toBe(false)
        })
      })

      describe('#when 调用 isDone', () => {
        it('#then 仅匹配 done 类型', () => {
          expect(isDone(createEvent('done', { messageId: 'm1' }))).toBe(true)
          expect(isDone(createEvent('error'))).toBe(false)
        })
      })

      describe('#when 调用 isError', () => {
        it('#then 仅匹配 error 类型', () => {
          expect(isError(createEvent('error', { code: 'E01', message: 'fail' }))).toBe(true)
          expect(isError(createEvent('done'))).toBe(false)
        })
      })
    })
  })

  describe('parseStreamEventType', () => {
    describe('#given 有效事件类型字符串', () => {
      describe('#when type 是已知类型', () => {
        it('#then 返回该类型', () => {
          expect(parseStreamEventType('text_delta')).toBe('text_delta')
          expect(parseStreamEventType('thinking_delta')).toBe('thinking_delta')
          expect(parseStreamEventType('tool_start')).toBe('tool_start')
          expect(parseStreamEventType('tool_end')).toBe('tool_end')
          expect(parseStreamEventType('done')).toBe('done')
          expect(parseStreamEventType('error')).toBe('error')
        })
      })
    })

    describe('#given 无效事件类型字符串', () => {
      describe('#when type 是未知字符串', () => {
        it('#then 返回 null', () => {
          expect(parseStreamEventType('unknown')).toBeNull()
          expect(parseStreamEventType('')).toBeNull()
        })
      })
    })
  })
})
