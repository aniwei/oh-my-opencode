// 压缩策略测试
import { createIncrementalStrategy } from '../src/compaction/strategies/incremental'
import { createSlidingWindowStrategy } from '../src/compaction/strategies/sliding-window'
import { createSummaryStrategy } from '../src/compaction/strategies/summary'
import { extractTodoItems, extractTodoState, appendTodoState } from '../src/compaction/todo-preserver'
import { createCompactor } from '../src/compaction/compactor'

import type { Message } from '@vitamin/ai'

function makeUserMsg(text: string): Message {
  return { role: 'user', content: text, timestamp: Date.now() }
}

function makeAssistantMsg(text: string): Message {
  return {
    role: 'assistant',
    content: [{ type: 'text', text }],
    usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
    stopReason: 'end_turn',
    model: 'test',
  }
}

function stubSummarize(response: string): (prompt: string) => Promise<string> {
  return async () => response
}

describe('TodoPreserver', () => {
  describe('#given markdown checkbox 文本', () => {
    describe('#when extractTodoItems', () => {
      it('#then 正确提取 todo 项', () => {
        const text = [
          '- [x] 完成测试',
          '- [ ] 添加文档',
          '- [X] 修复 bug',
          '* [ ] 部署',
        ].join('\n')

        const items = extractTodoItems(text)
        expect(items).toHaveLength(4)
        expect(items[0]).toEqual({ completed: true, text: '完成测试' })
        expect(items[1]).toEqual({ completed: false, text: '添加文档' })
        expect(items[2]).toEqual({ completed: true, text: '修复 bug' })
        expect(items[3]).toEqual({ completed: false, text: '部署' })
      })
    })

    describe('#when 无 checkbox 内容', () => {
      it('#then 返回空数组', () => {
        const items = extractTodoItems('普通文本内容')
        expect(items).toHaveLength(0)
      })
    })
  })

  describe('#given 消息列表含 todo', () => {
    describe('#when extractTodoState', () => {
      it('#then 提取并去重 todo 状态', () => {
        const messages: Message[] = [
          makeAssistantMsg('- [ ] 任务 A\n- [ ] 任务 B'),
          makeAssistantMsg('- [x] 任务 A\n- [ ] 任务 C'),
        ]

        const state = extractTodoState(messages)
        expect(state).toBeDefined()
        expect(state).toContain('[x] 任务 A')
        expect(state).toContain('[ ] 任务 B')
        expect(state).toContain('[ ] 任务 C')
      })
    })

    describe('#when 无 todo 消息', () => {
      it('#then 返回 undefined', () => {
        const messages: Message[] = [makeAssistantMsg('普通回复')]
        const state = extractTodoState(messages)
        expect(state).toBeUndefined()
      })
    })
  })

  describe('#given appendTodoState', () => {
    describe('#when 有 todo 状态', () => {
      it('#then 注入到摘要末尾', () => {
        const result = appendTodoState('摘要内容', '- [ ] 待办')
        expect(result).toContain('摘要内容')
        expect(result).toContain('## Active Todos')
        expect(result).toContain('- [ ] 待办')
      })
    })

    describe('#when 无 todo 状态', () => {
      it('#then 返回原始摘要', () => {
        const result = appendTodoState('摘要内容', undefined)
        expect(result).toBe('摘要内容')
      })
    })
  })
})

describe('SummaryStrategy', () => {
  describe('#given 30 条消息 + retainRecent=5', () => {
    describe('#when compact', () => {
      it('#then 前 25 条摘要 + 后 5 条原文', async () => {
        const strategy = createSummaryStrategy()
        const messages: Message[] = Array.from({ length: 30 }, (_, i) =>
          makeUserMsg(`消息 ${i}`),
        )

        const result = await strategy.compact({
          messages,
          retainRecent: 5,
          summarize: stubSummarize('压缩摘要'),
        })

        expect(result.compactedCount).toBe(25)
        expect(result.retainedMessages).toHaveLength(5)
        expect(result.summary).toContain('压缩摘要')
      })
    })
  })

  describe('#given 消息数 <= retainRecent', () => {
    describe('#when compact', () => {
      it('#then 不压缩', async () => {
        const strategy = createSummaryStrategy()
        const messages: Message[] = [makeUserMsg('hello')]

        const result = await strategy.compact({
          messages,
          retainRecent: 5,
          summarize: stubSummarize('不应调用'),
        })

        expect(result.compactedCount).toBe(0)
        expect(result.retainedMessages).toHaveLength(1)
      })
    })
  })
})

describe('SlidingWindowStrategy', () => {
  describe('#given 10 条消息 + retainRecent=3', () => {
    describe('#when compact', () => {
      it('#then 截断旧消息不调用 LLM', async () => {
        const strategy = createSlidingWindowStrategy()
        const messages: Message[] = Array.from({ length: 10 }, (_, i) =>
          makeUserMsg(`消息 ${i}`),
        )

        const result = await strategy.compact({
          messages,
          retainRecent: 3,
          summarize: stubSummarize('不应调用'),
        })

        expect(result.compactedCount).toBe(7)
        expect(result.retainedMessages).toHaveLength(3)
        expect(result.summary).toContain('7 条消息被截断')
      })
    })
  })
})

describe('IncrementalStrategy', () => {
  describe('#given 首次压缩 retainRecent=5', () => {
    describe('#when compact 30 条消息', () => {
      it('#then 全量摘要 + 保留 5 条', async () => {
        const strategy = createIncrementalStrategy()
        const messages: Message[] = Array.from({ length: 30 }, (_, i) =>
          makeUserMsg(`消息 ${i}`),
        )

        const result = await strategy.compact({
          messages,
          retainRecent: 5,
          summarize: stubSummarize('首次摘要'),
        })

        expect(result.compactedCount).toBe(25)
        expect(result.retainedMessages).toHaveLength(5)
        expect(result.summary).toContain('首次摘要')
      })
    })
  })

  describe('#given 已有摘要 + 新增消息', () => {
    describe('#when 增量 compact', () => {
      it('#then 仅对新过期消息摘要', async () => {
        const strategy = createIncrementalStrategy()
        const messages: Message[] = Array.from({ length: 10 }, (_, i) =>
          makeUserMsg(`消息 ${i}`),
        )

        let promptReceived = ''
        const result = await strategy.compact({
          messages,
          existingSummary: '已有摘要',
          retainRecent: 5,
          summarize: async (prompt) => {
            promptReceived = prompt
            return '增量摘要'
          },
        })

        expect(result.summary).toContain('增量摘要')
        expect(promptReceived).toContain('已有的对话摘要')
        expect(promptReceived).toContain('已有摘要')
      })
    })
  })

  describe('#given 带 todo 的消息', () => {
    describe('#when compress', () => {
      it('#then 保留 todo 状态', async () => {
        const strategy = createIncrementalStrategy()
        const messages: Message[] = [
          ...Array.from({ length: 8 }, (_, i) => makeUserMsg(`消息 ${i}`)),
          makeAssistantMsg('- [ ] 待完成任务'),
          makeAssistantMsg('- [x] 已完成任务'),
        ]

        const result = await strategy.compact({
          messages,
          retainRecent: 5,
          summarize: stubSummarize('摘要'),
        })

        expect(result.todoState).toBeDefined()
        expect(result.summary).toContain('Active Todos')
      })
    })
  })
})

describe('Compactor', () => {
  describe('#given 默认配置', () => {
    describe('#when compact', () => {
      it('#then 使用 incremental 策略', async () => {
        const compactor = createCompactor({
          retainRecent: 3,
          summarize: stubSummarize('压缩摘要'),
        })

        const messages: Message[] = Array.from({ length: 10 }, (_, i) =>
          makeUserMsg(`消息 ${i}`),
        )

        const result = await compactor.compact(messages)
        expect(result.compactedCount).toBe(7)
        expect(result.retainedMessages).toHaveLength(3)
      })
    })
  })

  describe('#given getAvailableStrategies', () => {
    describe('#when 默认实例', () => {
      it('#then 包含 3 种策略', () => {
        const compactor = createCompactor()
        const strategies = compactor.getAvailableStrategies()
        expect(strategies).toContain('summary')
        expect(strategies).toContain('sliding-window')
        expect(strategies).toContain('incremental')
      })
    })
  })

  describe('#given 未知策略', () => {
    describe('#when compactWith', () => {
      it('#then 抛出错误', async () => {
        const compactor = createCompactor()
        await expect(
          compactor.compactWith('nonexistent' as 'summary', []),
        ).rejects.toThrow('未知压缩策略')
      })
    })
  })
})
