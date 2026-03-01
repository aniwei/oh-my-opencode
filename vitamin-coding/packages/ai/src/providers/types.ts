// Provider 适配器接口
// 每个 LLM 提供商必须实现此接口

import type { Model, StreamContext, StreamEvent, StreamOptions } from '../types'

// Provider 适配器接口
export interface ProviderAdapter {
  // 唯一标识（如 'anthropic-messages'）
  readonly id: string
  // 显示名称（如 'Anthropic'）
  readonly displayName: string

  // 流式调用（核心方法）
  stream(
    model: Model,
    context: StreamContext,
    options: StreamOptions,
    signal: AbortSignal,
  ): AsyncIterable<StreamEvent>

  // 平台健康检查（可选）
  healthCheck?(apiKey: string): Promise<boolean>
}

// Provider 工厂函数类型
export type ProviderFactory = () => ProviderAdapter
