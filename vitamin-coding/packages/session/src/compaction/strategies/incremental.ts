// 增量压缩策略（vitamin 独创）
// 仅对"新过期"消息摘要，保留最近 N 条原文 + Todo 状态
import type { Message } from '@vitamin/ai'

import { appendTodoState, extractTodoState } from '../todo-preserver'

import type { CompactionOptions, CompactionResult, CompactionStrategy } from '../../types'

// 将消息格式化为待摘要文本
function formatMessagesForUpdate(messages: Message[]): string {
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
    }
  }

  return lines.join('\n')
}

// 增量压缩策略
export class IncrementalStrategy implements CompactionStrategy {
  readonly name = 'incremental'

  async compact(options: CompactionOptions): Promise<CompactionResult> {
    const { messages, existingSummary, retainRecent, summarize } = options

    if (messages.length <= retainRecent) {
      return {
        summary: existingSummary ?? '',
        retainedMessages: messages,
        compactedCount: 0,
      }
    }

    const oldMessages = messages.slice(0, messages.length - retainRecent)
    const recentMessages = messages.slice(messages.length - retainRecent)

    let updatedSummary: string

    if (existingSummary) {
      // 增量模式：仅对新过期消息摘要
      // "新过期" = 上次摘要之后到本次 retainRecent 窗口之前的消息
      const newExpiredFormatted = formatMessagesForUpdate(oldMessages)
      const incrementalPrompt = [
        '以下是已有的对话摘要：',
        '',
        existingSummary,
        '',
        '以下是新增的对话内容，请将其合并到已有摘要中，保留关键决策和上下文：',
        '',
        newExpiredFormatted,
      ].join('\n')

      updatedSummary = await summarize(incrementalPrompt)
    } else {
      // 首次压缩：全量摘要
      const formatted = formatMessagesForUpdate(oldMessages)
      const fullPrompt = [
        '请将以下对话摘要为简洁的摘要，保留关键决策、代码变更和重要上下文：',
        '',
        formatted,
      ].join('\n')

      updatedSummary = await summarize(fullPrompt)
    }

    // 提取并保留 todo 状态
    const todoState = extractTodoState(recentMessages)
    const finalSummary = appendTodoState(updatedSummary, todoState)

    return {
      summary: finalSummary,
      retainedMessages: recentMessages,
      compactedCount: oldMessages.length,
      todoState,
    }
  }
}

// 工厂函数
export function createIncrementalStrategy(): IncrementalStrategy {
  return new IncrementalStrategy()
}
