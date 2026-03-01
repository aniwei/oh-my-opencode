// 压缩引擎入口
// 统一管理压缩策略的选择和执行
import { createLogger, SessionError } from '@vitamin/shared'

import type { Message } from '@vitamin/ai'

import { createIncrementalStrategy } from './strategies/incremental'
import { createSlidingWindowStrategy } from './strategies/sliding-window'
import { createSummaryStrategy } from './strategies/summary'

import type { CompactionResult, CompactionStrategy } from '../types'

const log = createLogger('session:compactor')

// 策略名称
export type StrategyName = 'summary' | 'sliding-window' | 'incremental'

// 压缩器配置
export interface CompactorConfig {
  // 默认策略
  strategy: StrategyName
  // 保留最近消息数
  retainRecent: number
  // LLM 摘要函数
  summarize: (prompt: string) => Promise<string>
}

// 默认配置
const DEFAULT_CONFIG: CompactorConfig = {
  strategy: 'incremental',
  retainRecent: 5,
  summarize: async () => '[摘要不可用 - 未配置 LLM]',
}

// 压缩引擎
export class Compactor {
  private readonly strategies: Map<string, CompactionStrategy>
  private readonly config: CompactorConfig

  constructor(config: Partial<CompactorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.strategies = new Map()

    // 注册内置策略
    const summary = createSummaryStrategy()
    const slidingWindow = createSlidingWindowStrategy()
    const incremental = createIncrementalStrategy()

    this.strategies.set(summary.name, summary)
    this.strategies.set(slidingWindow.name, slidingWindow)
    this.strategies.set(incremental.name, incremental)
  }

  // 使用默认策略压缩
  async compact(
    messages: Message[],
    existingSummary?: string,
  ): Promise<CompactionResult> {
    return this.compactWith(this.config.strategy, messages, existingSummary)
  }

  // 使用指定策略压缩
  async compactWith(
    strategyName: StrategyName,
    messages: Message[],
    existingSummary?: string,
  ): Promise<CompactionResult> {
    const strategy = this.strategies.get(strategyName)
    if (!strategy) {
      throw new SessionError(`未知压缩策略: "${strategyName}"`, {
        code: 'SESSION_UNKNOWN_STRATEGY',
      })
    }

    log.info(`使用 ${strategyName} 策略压缩 ${messages.length} 条消息`)

    const result = await strategy.compact({
      messages,
      existingSummary,
      retainRecent: this.config.retainRecent,
      summarize: this.config.summarize,
    })

    log.info(
      `压缩完成: ${result.compactedCount} 条消息 → 摘要(${result.summary.length} 字符) + ${result.retainedMessages.length} 条保留`,
    )

    return result
  }

  // 注册自定义策略
  registerStrategy(strategy: CompactionStrategy): void {
    this.strategies.set(strategy.name, strategy)
  }

  // 获取可用策略列表
  getAvailableStrategies(): string[] {
    return [...this.strategies.keys()]
  }
}

// 工厂函数
export function createCompactor(config?: Partial<CompactorConfig>): Compactor {
  return new Compactor(config)
}
