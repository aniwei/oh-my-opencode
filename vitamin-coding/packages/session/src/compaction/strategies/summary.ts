// LLM 全量摘要策略
// 将所有旧消息一次性摘要为简短文本
import type { Message } from '@vitamin/ai'

import { appendTodoState, extractTodoState } from '../todo-preserver'

import type { CompactionOptions, CompactionResult, CompactionStrategy } from '../../types'

// 将消息格式化为摘要 prompt
function formatMessagesForSummary(messages: Message[]): string {
  const lines: string[] = []

  for (const msg of messages) {
    if (msg.role === 'user') {
      const text = typeof msg.content === 'string'
        ? msg.content
        : msg.content.map((p) => (p.type === 'text' ? p.text : `[${p.type}]`)).join(' ')
      lines.push(`User: ${text}`)
    } else if (msg.role === 'assistant') {
      const text = msg.content
        .filter((p) => p.type === 'text')
        .map((p) => (p as { type: 'text'; text: string }).text)
        .join(' ')
      if (text) {
        lines.push(`Assistant: ${text}`)
      }
    } else if (msg.role === 'tool_result') {
      const text = msg.content
        .filter((p) => p.type === 'text')
        .map((p) => (p as { type: 'text'; text: string }).text)
        .join(' ')
      if (text) {
        lines.push(`Tool[${msg.toolCallId}]: ${text.slice(0, 200)}`)
      }
    }
  }

  return lines.join('\n')
}

// 全量摘要策略
export class SummaryStrategy implements CompactionStrategy {
  readonly name = 'summary'

  async compact(options: CompactionOptions): Promise<CompactionResult> {
    const { messages, retainRecent, summarize } = options

    if (messages.length <= retainRecent) {
      return {
        summary: '',
        retainedMessages: messages,
        compactedCount: 0,
      }
    }

    const oldMessages = messages.slice(0, messages.length - retainRecent)
    const recentMessages = messages.slice(messages.length - retainRecent)

    // 格式化待摘要消息
    const formatted = formatMessagesForSummary(oldMessages)
    const summaryPrompt = [
      '请将以下对话摘要为简洁的中文摘要，保留关键决策、代码变更和重要上下文：',
      '',
      formatted,
    ].join('\n')

    const summary = await summarize(summaryPrompt)

    // 提取并保留 todo 状态
    const todoState = extractTodoState(recentMessages)
    const finalSummary = appendTodoState(summary, todoState)

    return {
      summary: finalSummary,
      retainedMessages: recentMessages,
      compactedCount: oldMessages.length,
      todoState,
    }
  }
}

// 工厂函数
export function createSummaryStrategy(): SummaryStrategy {
  return new SummaryStrategy()
}
