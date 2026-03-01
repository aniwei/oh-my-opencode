// 滑动窗口策略
// 简单截断旧消息，只保留最近 N 条
import type { CompactionOptions, CompactionResult, CompactionStrategy } from '../../types'

// 滑动窗口策略（无 LLM 调用，纯截断）
export class SlidingWindowStrategy implements CompactionStrategy {
  readonly name = 'sliding-window'

  async compact(options: CompactionOptions): Promise<CompactionResult> {
    const { messages, retainRecent, existingSummary } = options

    if (messages.length <= retainRecent) {
      return {
        summary: existingSummary ?? '',
        retainedMessages: messages,
        compactedCount: 0,
      }
    }

    const compactedCount = messages.length - retainRecent
    const retainedMessages = messages.slice(messages.length - retainRecent)

    // 不调用 LLM，仅保留已有摘要
    const summary = existingSummary
      ? `${existingSummary}\n\n[...${compactedCount} 条消息被截断...]`
      : `[...${compactedCount} 条消息被截断...]`

    return {
      summary,
      retainedMessages,
      compactedCount,
    }
  }
}

// 工厂函数
export function createSlidingWindowStrategy(): SlidingWindowStrategy {
  return new SlidingWindowStrategy()
}
